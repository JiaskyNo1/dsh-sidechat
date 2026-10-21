/**
 * Side chat plugin, browser half (DSH 0.2.1 port).
 *
 * The chat lives in the product's **right Sidebar** as a docking tab, next to the
 * shipped website / files / CLI tabs:
 *
 * 1. a tab type (`kind: 'sidechat'`) registered through
 *    `ctx.sidebarRightTabs.register`, with a guide entry so the column's add
 *    control and guide page can open it;
 * 2. its body registered into the keyed `sidebar.right.pane.tab` seat — a normal
 *    docked pane that only exists while the user opens the tab (no hover
 *    overlay, no floating panel covering other content);
 * 3. one small `shell.overlay` entry: the floating 「添加到侧边聊天」 button that
 *    appears next to a main-conversation selection. Clicking it opens the tab
 *    (via `ctx.sidebarRight.openTab`) and hands the marked excerpt to the body.
 *
 * The body is a focused project Q&A surface: model/effort selection, streaming
 * replies with collapsible reasoning, table markdown, a confirm-guarded clear,
 * and a marked-excerpt chip. Everything is driven through the Host `sidechat`
 * Remote mounted from `./remote.ts`.
 *
 * The tab body is session-scoped: the slot runtime supplies `sessionId` as a
 * framework standard prop, so every session keeps its own side-chat history.
 * @module dsh-sidechat/client
 */

import * as React from 'react'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactElement } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { TypertClientRemote } from '@deepseek-ai/dsh-typert-protocol'
// Type-only: installs ctx.slots (SlotRegistry) and the built-in 'root' SlotMap key.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: installs the 'shell.overlay' SlotMap key and ctx.layout.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: installs the global `useSessions` standard prop.
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
// Type-only: installs the right-Sidebar tab API, `ctx.sidebarRight(Tabs)`, and
// the `sidebar.right.pane.tab` SlotMap key (whose props carry sessionId).
import type {
  ISidebarRight,
  SidebarRightTabDefinition,
} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
// Type-only: installs `ctx.shortcuts` and the command/binding vocabulary.
import type { ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'
import { TYPERT_REMOTE, type SidechatModelOption, type SidechatNamespace } from './remote.ts'
import { loadSettings, saveSettings } from './settings.ts'
import css from './sidechat.module.css'

/**
 * Required services: the slot registry, the typed Client Remote mount face, and
 * the right-Sidebar tab registry (the body seat is declared by that package).
 * `remote.sidechat` must NOT be listed: it only appears once this plugin's own
 * `apply` calls `$mount`, so waiting on it would deadlock the fiber.
 */
export const inject: string[] = ['slots', 'remote', 'sidebarRightTabs']

/** Tab type discriminator: what `ctx.sidebarRight.openTab` names. */
export const SIDECHAT_KIND = 'sidechat'
/** This implementation's identity in the tab system; the body registers under it. */
export const SIDECHAT_TAB_ID = 'dsh-sidechat'
/**
 * Product command that opens the tab. Registered with `ctx.shortcuts`, so the
 * right Sidebar's guide card and the shortcut reference show it exactly like
 * the shipped workspace-files / terminal / browser commands.
 */
export const SIDECHAT_OPEN_COMMAND = 'sidechat.open' as ShortcutCommandId

/** Wire failure branch shared by every generated Remote method. */
type RemoteResultLike<T> = { ok: true; value: T } | { ok: false; error: { message: string; code: string } }

/** Unwrap one remote result into its value, throwing the wire error. */
async function callRemote<T>(call: () => Promise<RemoteResultLike<T>>): Promise<T> {
  const result = await call()
  if (!result.ok) throw new Error(`${result.error.message} (${result.error.code})`)
  return result.value
}

/* ------------------------------------------------------------------------- */
/* Shared state (module-level so the tab body and the selection button share  */
/* one pending-excerpt hand-off).                                             */
/* ------------------------------------------------------------------------- */

/** What the tab body and the floating selection button share. */
interface SharedState {
  /** Durable switch for the floating 「添加到侧边聊天」 button (localStorage-backed). */
  enabled: boolean
  /** Excerpt the user marked in the main conversation and has not consumed yet. */
  pendingExcerpt: string | null
}

let sharedState: SharedState = {
  enabled: loadSettings().enabled,
  pendingExcerpt: null,
}
const sharedListeners = new Set<() => void>()

function subscribeShared(listener: () => void): () => void {
  sharedListeners.add(listener)
  return () => { sharedListeners.delete(listener) }
}

function getSharedSnapshot(): SharedState {
  return sharedState
}

function patchShared(patch: Partial<SharedState>): void {
  let changed = false
  for (const key of Object.keys(patch) as (keyof SharedState)[]) {
    if (sharedState[key] !== patch[key]) changed = true
  }
  if (!changed) return
  sharedState = { ...sharedState, ...patch }
  for (const listener of [...sharedListeners]) listener()
}

/** Subscribe a component to the shared panel state. */
function useShared(): SharedState {
  return useSyncExternalStore(subscribeShared, getSharedSnapshot, getSharedSnapshot)
}

/** Publish the floating-button switch to the durable browser preference. */
function setEnabledShared(value: boolean): void {
  patchShared({ enabled: value })
  saveSettings({ enabled: value })
}

/* ------------------------------------------------------------------------- */
/* Per-session chat state.                                                    */
/* ------------------------------------------------------------------------- */

/** One rendered side-chat message (owned plain copy, never a live handle). */
interface SidechatMessage {
  id: string
  role: string
  content: string
  reasoning: string
  error: string | null
}

/** One session's side-chat state; each conversation owns an independent entry. */
interface SessionChatState {
  modelKey: string
  effort: string
  messages: SidechatMessage[]
  input: string
  busy: boolean
  jobId: string | null
  error: string | null
}

function emptySessionChatState(): SessionChatState {
  return {
    modelKey: '',
    effort: '',
    messages: [],
    input: '',
    busy: false,
    jobId: null,
    error: null,
  }
}

/**
 * Per-session chat state, keyed by session id and kept OUTSIDE the panel
 * component. `shell.overlay` is root-scoped, so it no longer remounts on a
 * session switch (the 0.1 `details` slot did); the panel body is instead keyed
 * by the current session id and seeds itself from this map, giving every
 * conversation its own side chat.
 */
const sessionStores = new Map<string, SessionChatState>()
function getSessionStore(sessionKey: string): SessionChatState {
  let entry = sessionStores.get(sessionKey)
  if (entry === undefined) {
    entry = emptySessionChatState()
    sessionStores.set(sessionKey, entry)
  }
  return entry
}

/* ------------------------------------------------------------------------- */
/* Marked-excerpt draft composition.                                          */
/* ------------------------------------------------------------------------- */

/**
 * Turn a marked excerpt into a Markdown quote draft for the composer. The
 * excerpt is only *staged* here: the user can add their own question and presses
 * send when they want the answer — nothing is sent automatically.
 */
function buildQuoteDraft(excerpt: string): string {
  const quoted = excerpt
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n')
  return `${quoted}\n\n`
}

/* ------------------------------------------------------------------------- */
/* Markdown renderer (kept from the 0.1 reference implementation).            */
/* ------------------------------------------------------------------------- */

const isHr = (line: string): boolean => /^-{3,}$/.test(line) || /^\*{3,}$/.test(line) || /^_{3,}$/.test(line)

/** Split one markdown table row into cells, or null when the line is not a row. */
function splitTableRow(line: string): string[] | null {
  const trimmed = line.trim()
  if (!trimmed.includes('|')) return null
  return trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
}

/** Inline markdown spans: code, bold, italic, links. */
function renderInline(text: string): (string | ReactElement)[] {
  const nodes: (string | ReactElement)[] = []
  const tokenRe = /(`+)([\s\S]*?)\1|(\*\*|__)([\s\S]*?)\3|(\*|_)([\s\S]*?)\5|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  let key = 0
  let match: RegExpExecArray | null
  while ((match = tokenRe.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const codeDelim = match[1]
    if (codeDelim !== undefined) {
      nodes.push(<code key={`md-c-${key++}`}>{match[2] ?? ''}</code>)
    } else if (match[3] !== undefined) {
      nodes.push(<strong key={`md-s-${key++}`}>{...renderInline(match[4] ?? '')}</strong>)
    } else if (match[5] !== undefined) {
      nodes.push(<em key={`md-e-${key++}`}>{...renderInline(match[6] ?? '')}</em>)
    } else if (match[7] !== undefined && match[8] !== undefined) {
      nodes.push(<a key={`md-a-${key++}`} className={css.mdLink} href={match[8]} target="_blank" rel="noreferrer">{match[7]}</a>)
    }
    last = tokenRe.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

/** Lightweight markdown → React renderer (text-only output; never raw HTML). */
function renderMarkdown(text: string): (string | ReactElement)[] {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n')
  const nodes: (string | ReactElement)[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()
    const fence = /^```(\w*)\s*$/.exec(trimmed)
    if (fence !== null) {
      const body: string[] = []
      i += 1
      while (i < lines.length && !/^```\s*$/.test((lines[i] ?? '').trim())) { body.push(lines[i] ?? ''); i += 1 }
      i += 1
      nodes.push(<pre key={`md-pre-${nodes.length}`} className={css.mdPre}><code className={css.mdCodeblock}>{body.join('\n')}</code></pre>)
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed)
    if (heading !== null) {
      const level = heading[1]?.length ?? 1
      nodes.push(React.createElement(`h${level}`, { key: `md-h-${nodes.length}`, className: `${css.mdH} ${css[`mdH${level}`]}` }, ...renderInline(heading[2] ?? '')))
      i += 1
      continue
    }
    const headerCells = splitTableRow(line)
    const nextCells = i + 1 < lines.length ? splitTableRow(lines[i + 1] ?? '') : null
    if (headerCells !== null && nextCells !== null
      && nextCells.length >= 2 && nextCells.every(cell => /^:?-+:?$/.test(cell))) {
      const bodyRows: string[][] = []
      i += 2
      while (i < lines.length) {
        const cells = splitTableRow(lines[i] ?? '')
        if (cells === null || (lines[i] ?? '').trim() === '') break
        bodyRows.push(cells)
        i += 1
      }
      nodes.push(React.createElement('table', { key: `md-table-${nodes.length}`, className: css.mdTable },
        React.createElement('thead', null,
          React.createElement('tr', null, headerCells.map((cell, idx) =>
            React.createElement('th', { key: idx }, ...renderInline(cell)))),
        ),
        React.createElement('tbody', null,
          bodyRows.map((row, ri) =>
            React.createElement('tr', { key: ri },
              row.map((cell, ci) =>
                React.createElement('td', { key: ci }, ...renderInline(cell))))),
        ),
      ))
      continue
    }
    if (isHr(trimmed)) {
      nodes.push(<hr key={`md-hr-${nodes.length}`} className={css.mdHr} />)
      i += 1
      continue
    }
    if (/^>\s?/.test(trimmed)) {
      const quote: string[] = []
      while (i < lines.length && /^>\s?/.test((lines[i] ?? '').trim())) { quote.push((lines[i] ?? '').trim().replace(/^>\s?/, '')); i += 1 }
      nodes.push(<blockquote key={`md-q-${nodes.length}`} className={css.mdQuote}><p>{...renderInline(quote.join(' '))}</p></blockquote>)
      continue
    }
    const ulMatch = /^(\s*)[-*+]\s+(.*)$/.exec(line)
    const olMatch = /^(\s*)\d+[.)]\s+(.*)$/.exec(line)
    if (ulMatch !== null || olMatch !== null) {
      const ordered = olMatch !== null
      const items: ReactElement[] = []
      while (i < lines.length) {
        const m2 = /^(\s*)[-*+]\s+(.*)$/.exec(lines[i] ?? '')
        const m3 = /^(\s*)\d+[.)]\s+(.*)$/.exec(lines[i] ?? '')
        if (ordered ? m3 !== null : m2 !== null) {
          items.push(<li key={`md-li-${items.length}`}>{...renderInline((ordered ? m3![2] : m2![2]) ?? '')}</li>)
          i += 1
        } else if (/^\s+/.test(lines[i] ?? '') && (lines[i] ?? '').trim() !== '') {
          i += 1
        } else break
      }
      nodes.push(React.createElement(ordered ? 'ol' : 'ul', { key: `md-ul-${nodes.length}`, className: css.mdList }, items))
      continue
    }
    if (trimmed === '') { i += 1; continue }
    const paragraph = [line]
    i += 1
    while (i < lines.length) {
      const t = (lines[i] ?? '').trim()
      if (t === '') break
      if (/^```/.test(t) || /^#{1,6}\s/.test(t) || /^>\s?/.test(t) || isHr(t) || /^[-*+]\s+/.test(t) || /^\d+[.)]\s+/.test(t)) break
      paragraph.push(lines[i] ?? '')
      i += 1
    }
    nodes.push(<p key={`md-p-${nodes.length}`} className={css.mdP}>{...renderInline(paragraph.join(' '))}</p>)
  }
  return nodes
}

/* ------------------------------------------------------------------------- */
/* Floating selection button (the only `shell.overlay` entry).                */
/* ------------------------------------------------------------------------- */

/**
 * Selection-triggered button: hands the main-chat selection to the side-chat
 * tab. The button itself is a small overlay entry; clicking it opens the
 * right-Sidebar tab through `ctx.sidebarRight.openTab`, which expands the
 * column, and publishes the excerpt for the tab body to consume.
 */
function SelectionSendButton(props: { ctx: Context }): ReactElement | null {
  const { ctx } = props
  const shared = useShared()
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [selectedText, setSelectedText] = useState('')
  useEffect(() => {
    const onSelectionChange = (): void => {
      try {
        const selection = window.getSelection()
        const value = selection?.toString().trim() ?? ''
        if (value === '') {
          setPosition(null)
          setSelectedText('')
          return
        }
        const node = selection?.anchorNode
        const el = node !== null && node !== undefined && node.nodeType === 1
          ? node
          : (node !== null && node !== undefined ? node.parentElement : null)
        // Ignore selections inside our own panel (and anything else that opts out).
        if (el instanceof Element && el.closest('.sidechatPanel') !== null) {
          setPosition(null)
          setSelectedText('')
          return
        }
        const range = selection?.getRangeAt(0)
        if (range === undefined) { setPosition(null); return }
        const rect = range.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) { setPosition(null); return }
        setSelectedText(value.slice(0, 2000))
        setPosition({ x: Math.max(0, rect.left), y: Math.max(0, rect.top) })
      } catch { setPosition(null) }
    }
    window.document.addEventListener('selectionchange', onSelectionChange)
    window.document.addEventListener('mouseup', onSelectionChange)
    return () => {
      window.document.removeEventListener('selectionchange', onSelectionChange)
      window.document.removeEventListener('mouseup', onSelectionChange)
    }
  }, [])
  if (position === null || selectedText === '' || !shared.enabled) return null
  return React.createElement('button', {
    className: css.sendsel,
    type: 'button',
    'data-sidechat-send': 'true',
    title: '添加到侧边聊天',
    style: { left: `${position.x}px`, top: `${position.y}px` },
    onMouseDown: (event: React.MouseEvent) => event.preventDefault(),
    onClick: () => {
      patchShared({ pendingExcerpt: selectedText })
      setPosition(null)
      setSelectedText('')
      // Open (and expand) the right Sidebar on our tab. Without a session on
      // screen the controller throws; the excerpt stays pending until a session
      // exists and the tab is opened by hand.
      const nav = ctx.get('sidebarRight') as ISidebarRight | undefined
      try { nav?.openTab(SIDECHAT_KIND) } catch { /* no session on screen */ }
    },
  }, '添加到侧边聊天')
}

/* ------------------------------------------------------------------------- */
/* Tab body.                                                                  */
/* ------------------------------------------------------------------------- */

/** One model entry of the advisory catalog (wire shape from `./remote.ts`). */
type ModelOption = SidechatModelOption

/** The docked tab body: session-scoped props plus the mounted Remote namespace. */
type TabBodyProps = PropsRuntime<'sidebar.right.pane.tab'> & { sidechat: SidechatNamespace }

/** One session's chat surface receives only the mount face and its session key. */
type PanelBodyProps = { sidechat: SidechatNamespace; sessionKey: string }

/**
 * The side-chat tab body. The right Sidebar renders one body per session and
 * passes the Session identity as a framework standard prop; the per-session
 * map above keeps each conversation's chat alive across tab switches.
 */
function SidechatTabBody(props: TabBodyProps): ReactElement {
  const { sidechat, sessionId } = props
  const sessionKey = typeof sessionId === 'string' ? sessionId : ''
  return (
    <div className={`${css.tab} sidechatPanel`} data-sidechat-tab="true" aria-label="侧边聊天">
      <PanelBody key={sessionKey} sidechat={sidechat} sessionKey={sessionKey} />
    </div>
  )
}

/** Strip tool-call markup if an older host or a provider leak ever delivers it. */
function stripToolMarkup(text: string): string {
  return text
    .replace(/<\s*\/?\s*(?:\|\s*)*DSML\s*(?:\|\s*)*[^>]*calls[^>]*>[\s\S]*?<\s*\/\s*(?:\|\s*)*DSML\s*(?:\|\s*)*[^>]*calls[^>]*>/gi, '')
    .replace(/<\s*\/?\s*(?:\|\s*)*DSML\s*(?:\|\s*)*[^>]*>/gi, '')
    .replace(/<\|[^>]*\|>/g, '')
    .trim()
}

/**
 * Collapsible reasoning row, presented like the main conversation's disclosure:
 * one quiet line showing "思考" while streaming / "已思考" when settled, with the
 * first completed paragraph as the collapsed preview. Expanding shows the full
 * reasoning in secondary typography. Nothing auto-expands.
 */
function ReasoningRow(props: { text: string; running: boolean }): ReactElement {
  const { text, running } = props
  const [expanded, setExpanded] = useState(false)
  const firstLine = (() => {
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (trimmed !== '') return trimmed.replaceAll('**', '')
    }
    return ''
  })()
  return (
    <div className={css.reasoning} data-expanded={expanded ? 'true' : undefined}>
      <button
        type="button"
        className={css.reasoningHeader}
        aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
      >
        <span className={css.reasoningIcon} aria-hidden="true">✳</span>
        <span className={css.reasoningTitle}>{running ? '思考' : '已思考'}</span>
        {!expanded && firstLine !== '' ? <span className={css.reasoningPreview}>{firstLine}</span> : null}
        <span className={css.reasoningChevron} aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded ? <div className={css.reasoningBody}>{text}</div> : null}
    </div>
  )
}

/** One session's chat surface: header, messages, streaming, model selectors, composer. */
function PanelBody(props: PanelBodyProps): ReactElement {
  const { sidechat, sessionKey } = props
  const shared = useShared()
  // Seed every panel field from THIS session's own store so a session-switch
  // remount restores exactly that conversation's side chat (messages,
  // in-flight job, model choice, draft, marked excerpt).
  const chat = getSessionStore(sessionKey)
  const [modelCatalog, setModelCatalog] = useState<{ groups: { id: string; name: string; models: ModelOption[] }[]; current: { provider: string; model: string } | null } | null>(null)
  const [modelKey, setModelKey] = useState(chat.modelKey)
  const [effort, setEffort] = useState(chat.effort)
  const [messages, setMessages] = useState<SidechatMessage[]>(chat.messages)
  const [input, setInput] = useState(chat.input)
  const [busy, setBusy] = useState(chat.busy)
  const [jobId, setJobId] = useState<string | null>(chat.jobId)
  const [error, setError] = useState<string | null>(chat.error)
  const [confirmClear, setConfirmClear] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  chat.modelKey = modelKey
  chat.effort = effort
  chat.messages = messages
  chat.input = input
  chat.busy = busy
  chat.jobId = jobId
  chat.error = error

  const findModel = (key: string): ModelOption | null => {
    if (key === '') return null
    const parts = key.split('/')
    if (parts.length !== 2) return null
    for (const group of modelCatalog?.groups ?? []) {
      if (group.id !== parts[0]) continue
      for (const model of group.models) if (model.id === parts[1]) return model
    }
    return null
  }

  useEffect(() => {
    let cancelled = false
    void callRemote(() => sidechat.models()).then(value => {
      if (!cancelled) setModelCatalog(value)
    }, () => { /* catalog load failure is non-fatal */ })
    return () => { cancelled = true }
  }, [sidechat])

  useEffect(() => {
    if (modelKey !== '' || modelCatalog?.current == null) return
    const { provider, model } = modelCatalog.current
    if (provider === '' || model === '') return
    if (findModel(`${provider}/${model}`) !== null) setModelKey(`${provider}/${model}`)
  }, [modelCatalog])

  useEffect(() => {
    if (modelKey === '') { setEffort(''); return }
    const info = findModel(modelKey)
    const def = info?.reasoning?.defaultEffort
    setEffort(typeof def === 'string' && def.length > 0 ? def : '')
  }, [modelKey])

  useEffect(() => {
    if (jobId === null) return
    const timer = window.setInterval(() => {
      void callRemote(() => sidechat.poll({ jobId })).then(value => {
        setMessages(prev => prev.map(message => (
          message.id === jobId
            ? { ...message, content: value.text, reasoning: value.reasoning, error: value.error }
            : message
        )))
        if (value.done) {
          setJobId(null)
          setBusy(false)
          if (value.error !== null) setError(value.error)
        }
      }, (reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
        setJobId(null)
        setBusy(false)
      })
    }, 200)
    return () => { window.clearInterval(timer) }
  }, [sidechat, jobId])

  const send = (externalText?: string): void => {
    const text = (externalText !== undefined && externalText !== null ? externalText : input).trim()
    if (text === '' || busy) return
    const userMessage: SidechatMessage = { id: `user-${Date.now()}`, role: 'user', content: text, reasoning: '', error: null }
    const history = messages.concat([userMessage])
      .filter(message => message.content !== '')
      .map(message => ({ role: message.role, content: message.content }))
    setMessages(prev => prev.concat([userMessage]))
    setInput('')
    setBusy(true)
    setError(null)
    const args: {
      sessionId: string
      messages: { role: string; content: string }[]
      provider?: string
      model?: string
      reasoningEffort?: string
    } = { sessionId: sessionKey, messages: history }
    if (modelKey !== '') {
      const parts = modelKey.split('/')
      const provider = parts[0]
      const model = parts[1]
      if (provider !== undefined && model !== undefined) {
        args.provider = provider
        args.model = model
        if (effort !== '') args.reasoningEffort = effort
      }
    }
    void callRemote(() => sidechat.start(args)).then(value => {
      setJobId(value.jobId)
      setMessages(prev => prev.concat([{ id: value.jobId, role: 'assistant', content: '', reasoning: '', error: null }]))
    }, (reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason))
      setBusy(false)
    })
  }

  // A selection click publishes the excerpt and opens the tab. The body stages it
  // as a quote draft in the composer — it does not send anything. The user adds
  // their question and submits when ready.
  useEffect(() => {
    const pending = shared.pendingExcerpt
    if (pending === null || pending === '') return
    patchShared({ pendingExcerpt: null })
    setInput(prev => (prev.trim() === '' ? buildQuoteDraft(pending) : `${buildQuoteDraft(pending)}${prev}`))
    window.setTimeout(() => {
      const element = inputRef.current
      if (element !== null) {
        element.focus()
        element.setSelectionRange(element.value.length, element.value.length)
      }
    }, 0)
  }, [shared.pendingExcerpt])

  const stop = (): void => {
    if (jobId !== null) {
      void sidechat.stop({ jobId }).then(() => {}, () => {})
      setJobId(null)
      setBusy(false)
    }
  }

  const clear = (): void => {
    stop()
    setMessages([])
    setError(null)
    setConfirmClear(false)
  }

  const modelOptions: ReactElement[] = []
  for (const group of modelCatalog?.groups ?? []) {
    const options = group.models.map(model => (
      <option key={`${group.id}/${model.id}`} value={`${group.id}/${model.id}`}>{model.name}</option>
    ))
    modelOptions.push(<optgroup key={`g-${group.id}`} label={group.name}>{options}</optgroup>)
  }
  const selectedModel = findModel(modelKey)
  const efforts = selectedModel?.reasoning?.efforts ?? []
  const effortSelect = efforts.length > 0 ? (
    <select className={css.select} value={effort} title="推理等级" onChange={event => setEffort(event.target.value)}>
      {efforts.map(effortOption => <option key={effortOption.id} value={effortOption.id}>{effortOption.name}</option>)}
    </select>
  ) : null

  const messageNodes = messages.map(message => {
    const isUser = message.role === 'user'
    const cleanContent = stripToolMarkup(message.content)
    const cleanReasoning = stripToolMarkup(message.reasoning)
    const body = isUser
      ? cleanContent
      : (cleanContent === '' && busy ? '…' : renderMarkdown(cleanContent))
    const reasoningBlock = !isUser && cleanReasoning !== ''
      ? <ReasoningRow text={cleanReasoning} running={busy && message.id === jobId} />
      : null
    return (
      <div key={message.id} className={isUser ? `${css.msg} ${css.msgUser}` : `${css.msg} ${css.msgAssistant}`}>
        <div className={css.msgRole}>{isUser ? '你' : '助手'}</div>
        {reasoningBlock}
        <div className={css.msgBody}>{body}</div>
        {message.error !== null ? <div className={css.msgError}>{message.error}</div> : null}
      </div>
    )
  })

  return (
    <>
      <div className={css.header}>
        <span className={css.headerTitle}>侧边聊天</span>
        <label className={css.switch} title="划选文字时显示「添加到侧边聊天」按钮">
          <input
            type="checkbox"
            checked={shared.enabled}
            aria-label="划选时提示"
            onChange={event => setEnabledShared(event.target.checked)}
          />
          <span className={css.switchTrack} aria-hidden="true" />
        </label>
        <button className={css.iconBtn} type="button" title="清空对话，开始新的侧边聊天" onClick={() => setConfirmClear(true)}>清空</button>
      </div>
      {confirmClear ? (
        <div className={css.confirm}>
          <span>清空后内容不可恢复，确认清空？</span>
          <button className={`${css.confirmBtn} ${css.confirmBtnDanger}`} type="button" onClick={clear}>确认清空</button>
          <button className={css.confirmBtn} type="button" onClick={() => setConfirmClear(false)}>取消</button>
        </div>
      ) : null}
      {error !== null ? <div className={css.error}>{error}</div> : null}
      <div className={css.messages}>
        {messageNodes.length === 0 ? (
          <div className={css.empty}>可以问项目或旁边对话相关的问题。</div>
        ) : messageNodes}
      </div>
      <div className={css.composer}>
        <div className={css.inputRow}>
          <textarea
            ref={inputRef}
            className={css.input}
            value={input}
            placeholder="输入问题…（划选主对话文字可插入引用，Enter 发送，Shift+Enter 换行）"
            rows={2}
            disabled={busy}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
          />
          <button
            className={css.send}
            type="button"
            disabled={!busy && input.trim() === ''}
            onClick={busy ? stop : () => send()}
          >{busy ? '停止' : '发送'}</button>
        </div>
        <div className={css.composerTools}>
          <select className={css.select} value={modelKey} title="侧边聊天的回复模型" onChange={event => setModelKey(event.target.value)}>
            {modelOptions}
          </select>
          {effortSelect}
        </div>
      </div>
      <div className={css.tip}>侧边聊天只是临时聊天</div>
    </>
  )
}

/* ------------------------------------------------------------------------- */
/* Plugin body.                                                               */
/* ------------------------------------------------------------------------- */

/**
 * Browser plugin body: mount the Host Remote contribution, register the
 * side-chat tab type in the right Sidebar, and contribute the one floating
 * selection button.
 * @param ctx - client root context.
 * @returns async disposer that unmounts the Remote and every registration.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const remote = ctx.get('remote') as TypertClientRemote | undefined
  if (remote === undefined) throw new Error('side chat: remote service is unavailable')
  const disposeMount = await remote.$mount(TYPERT_REMOTE)
  const sidechat = ctx.get('remote.sidechat') as SidechatNamespace | undefined
  if (sidechat === undefined) throw new Error('side chat: remote.sidechat not mounted')

  const definition: SidebarRightTabDefinition = {
    id: SIDECHAT_TAB_ID,
    kind: SIDECHAT_KIND,
    title: () => '侧边聊天',
    priority: 'extension',
    keepMounted: true,
    guide: [{
      id: 'sidechat',
      order: 40,
      commandId: SIDECHAT_OPEN_COMMAND,
      title: () => '侧边聊天',
      description: () => '与主对话并行的临时问答；划选主对话文字可一键带入',
    }],
  }
  const disposeType = ctx.sidebarRightTabs.register(definition)

  // Keyboard command, registered exactly like the shipped right-Sidebar
  // providers (workspace.files Ctrl+P, terminal.new Ctrl+`, browser.new Ctrl+T):
  // Ctrl+J on Desktop, Ctrl+Alt+J on the Web (Ctrl+J is Chrome's downloads).
  // `ctx.inject` keeps the plugin working on hosts without the shortcuts service.
  ctx.inject(['shortcuts'], shortcutCtx => {
    shortcutCtx.effect(() => shortcutCtx.shortcuts.register({
      id: SIDECHAT_OPEN_COMMAND,
      label: () => '打开侧边聊天',
      aliases: ['side chat', 'sidechat', '侧边聊天'],
      defaults: {
        'desktop:macos': { code: 'KeyJ', modifiers: ['primary'] },
        'desktop:windows': { code: 'KeyJ', modifiers: ['primary'] },
        'desktop:linux': { code: 'KeyJ', modifiers: ['primary'] },
        // Web admits Ctrl+Alt+J on Windows/macOS only; Linux has no admitted
        // two-modifier web binding for this key (same omission as the shipped
        // files/browser commands), so the default stays unbound there.
        'web:macos': { code: 'KeyJ', modifiers: ['primary', 'alt'] },
        'web:windows': { code: 'KeyJ', modifiers: ['primary', 'alt'] },
      },
      regions: ['page', 'editable', 'terminal'],
      modals: [],
      resolve: () => ({
        status: 'handled',
        run: () => {
          const nav = ctx.get('sidebarRight') as ISidebarRight | undefined
          try { nav?.openTab(SIDECHAT_KIND) } catch { /* no session on screen */ }
        },
      }),
    }), 'sidechat: open shortcut')
  })

  const disposers: (() => void)[] = [disposeType]
  disposers.push(ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: SIDECHAT_TAB_ID },
    (props: PropsRuntime<'sidebar.right.pane.tab'>) => <SidechatTabBody {...props} sidechat={sidechat} />,
  )))
  disposers.push(ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'sidechat-sendsel', order: 6 },
    () => <SelectionSendButton ctx={ctx} />,
  )))
  return async () => {
    for (const dispose of disposers.reverse()) dispose()
    await disposeMount()
  }
}
