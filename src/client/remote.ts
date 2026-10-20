/**
 * Hand-written Remote contribution for the `sidechat` namespace, ported to the
 * DSH 0.2.1 Typert protocol.
 *
 * 0.2.1 generated Remote artifacts (`@deepseek-ai/<owner>/remote`) still mount
 * a `TypertRemoteContribution` —`{ package, descriptors: InvocationDescriptor[] }`
 * (dsh-typert-protocol/lib/types/types.d.ts:432-437) —through
 * `ctx.remote.$mount(contribution)` (types.d.ts:519-525). What changed from 0.1
 * is the codec envelope: a strict codec is now
 * `{ mode: 'strict', typeSymbol, create: () => TypertSchema, decode?, encode? }`
 * (types.d.ts:243-250, 255-274), where `TypertSchema` only needs
 * `parse(value)`. The 0.1 `{ mode: 'strict', typeSymbol, schema }` field no
 * longer exists.
 *
 * A self-contained package cannot run the harness Typert generator (it requires
 * the monorepo workspace layout), so this module restates the same wire
 * contract by hand. Wire method names and argument objects are unchanged from
 * 0.1 (getContext/models/start/poll/stop); only the codec envelope moved from
 * `schema` to `create()`. The wire interfaces below are derived from these
 * schemas, so the browser half and the Host `./typert` manifest share one
 * literal contract rather than a drifting copy.
 * @module dsh-sidechat/client/remote
 */

import { z } from 'zod'
import type {
  RemoteResult,
  TypertRemoteContribution,
  TypertRemoteNamespaceMap,
} from '@deepseek-ai/dsh-typert-protocol'

/* ------------------------------------------------------------------------- */
/* Strict wire schemas.                                                       */
/* ------------------------------------------------------------------------- */

/** getContext request. */
const contextArgsSchema = z.object({ sessionId: z.string() })

/** Project + conversation snapshot injected into every side-chat system prompt. */
const projectContextSchema = z.object({
  root: z.union([z.literal(null), z.string()]),
  branch: z.union([z.literal(null), z.string()]),
  conversation: z.object({
    title: z.union([z.literal(null), z.string()]),
    messages: z.array(z.object({ role: z.string(), text: z.string() })),
  }),
})

/** Advisory model catalog plus the currently selected default route. */
const modelsResultSchema = z.object({
  groups: z.array(z.object({
    id: z.string(),
    name: z.string(),
    models: z.array(z.object({
      id: z.string(),
      name: z.string(),
      reasoning: z.object({
        efforts: z.array(z.object({ id: z.string(), name: z.string() })),
        defaultEffort: z.union([z.literal(null), z.string()]),
      }).optional(),
    })),
  })),
  current: z.union([z.literal(null), z.object({ provider: z.string(), model: z.string() })]),
})

/** start request; provider/model/effort override the default selection when present. */
const startArgsSchema = z.object({
  sessionId: z.string(),
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
  provider: z.string().optional(),
  model: z.string().optional(),
  reasoningEffort: z.string().optional(),
})

/** One started generation job. */
const jobIdResultSchema = z.object({ jobId: z.string() })

/** poll request. */
const pollArgsSchema = z.object({ jobId: z.string() })

/** Accumulated text and reasoning of one job; `done` once generation settled. */
const pollResultSchema = z.object({
  done: z.boolean(),
  text: z.string(),
  reasoning: z.string(),
  error: z.union([z.literal(null), z.string()]),
})

/** stop request. */
const stopArgsSchema = z.object({ jobId: z.string() })

/** Stop acknowledgement. */
const stopResultSchema = z.object({ stopped: z.boolean() })

/* ------------------------------------------------------------------------- */
/* Wire types (the same structural shapes the Host half publishes from        */
/* src/types.ts; this module owns its copy so the browser bundle stays a       */
/* self-contained artifact).                                                  */
/* ------------------------------------------------------------------------- */

/** Project + conversation snapshot injected into every side-chat system prompt. */
export type SidechatProjectContext = z.infer<typeof projectContextSchema>
/** Advisory provider group of the model catalog. */
export type SidechatModelGroup = z.infer<typeof modelsResultSchema>['groups'][number]
/** One model entry of the advisory catalog. */
export type SidechatModelOption = SidechatModelGroup['models'][number]
/** Advisory model catalog plus the currently selected default route. */
export type SidechatModelsResult = z.infer<typeof modelsResultSchema>
/** One started generation job. */
export type SidechatJobIdResult = z.infer<typeof jobIdResultSchema>
/** Accumulated text and reasoning of one job. */
export type SidechatPollResult = z.infer<typeof pollResultSchema>
/** getContext request. */
export type SidechatContextArgs = z.infer<typeof contextArgsSchema>
/** start request. */
export type SidechatStartArgs = z.infer<typeof startArgsSchema>
/** poll request. */
export type SidechatPollArgs = z.infer<typeof pollArgsSchema>
/** stop request. */
export type SidechatStopArgs = z.infer<typeof stopArgsSchema>
/** Stop acknowledgement. */
export type SidechatStopResult = z.infer<typeof stopResultSchema>

/* ------------------------------------------------------------------------- */
/* Contribution.                                                              */
/* ------------------------------------------------------------------------- */

/**
 * One strict codec in the 0.2.1 envelope: `create()` materializes the parser
 * lazily. The Client Remote service itself does not parse arguments —it maps
 * positional values onto `args[wire]` and forwards them (`dsh-api-gateway`
 * client `prepareInvocation`); the Host gateway validates against the owning
 * package's `./typert` manifest. The codec still has to satisfy the protocol
 * type, which is what `create()` replaced `schema` for.
 */
function strictCodec(typeSymbol: string, schema: z.ZodType): {
  mode: 'strict'
  typeSymbol: string
  create: () => z.ZodType
} {
  return { mode: 'strict', typeSymbol, create: () => schema }
}

/**
 * Remote contribution owned by this package: one descriptor per endpoint.
 *
 * `parameter.wire` names the field inside the wire `args` object; the 0.2.1
 * Client Remote service forwards positional values as `args[wire]`, so the
 * 0.1 single-object signatures stay byte-compatible on the wire.
 */
export const TYPERT_REMOTE: TypertRemoteContribution = {
  package: 'dsh-sidechat',
  descriptors: [
    {
      id: 'dsh-sidechat#sidechat/getContext',
      service: 'sidechat',
      namespace: 'sidechat',
      method: 'getContext',
      invocation: { kind: 'direct' },
      parameters: [{
        name: 'args',
        wire: 'args',
        source: 'json',
        codec: strictCodec('dsh-sidechat#SidechatContextArgs', contextArgsSchema),
      }],
      result: strictCodec('dsh-sidechat#SidechatProjectContext', projectContextSchema),
    },
    {
      id: 'dsh-sidechat#sidechat/models',
      service: 'sidechat',
      namespace: 'sidechat',
      method: 'models',
      invocation: { kind: 'direct' },
      parameters: [],
      result: strictCodec('dsh-sidechat#SidechatModelsResult', modelsResultSchema),
    },
    {
      id: 'dsh-sidechat#sidechat/start',
      service: 'sidechat',
      namespace: 'sidechat',
      method: 'start',
      invocation: { kind: 'direct' },
      parameters: [{
        name: 'args',
        wire: 'args',
        source: 'json',
        codec: strictCodec('dsh-sidechat#SidechatStartArgs', startArgsSchema),
      }],
      result: strictCodec('dsh-sidechat#SidechatJobIdResult', jobIdResultSchema),
    },
    {
      id: 'dsh-sidechat#sidechat/poll',
      service: 'sidechat',
      namespace: 'sidechat',
      method: 'poll',
      invocation: { kind: 'direct' },
      parameters: [{
        name: 'args',
        wire: 'args',
        source: 'json',
        codec: strictCodec('dsh-sidechat#SidechatPollArgs', pollArgsSchema),
      }],
      result: strictCodec('dsh-sidechat#SidechatPollResult', pollResultSchema),
    },
    {
      id: 'dsh-sidechat#sidechat/stop',
      service: 'sidechat',
      namespace: 'sidechat',
      method: 'stop',
      invocation: { kind: 'direct' },
      parameters: [{
        name: 'args',
        wire: 'args',
        source: 'json',
        codec: strictCodec('dsh-sidechat#SidechatStopArgs', stopArgsSchema),
      }],
      result: strictCodec('dsh-sidechat#SidechatStopResult', stopResultSchema),
    },
  ],
}

/**
 * Typed client surface of the mounted `remote.sidechat` namespace service.
 *
 * 0.2.1 mounts one Cordis service per namespace under the key
 * `remote.<namespace>` (`dsh-api-gateway` client `remoteServiceKey`), and the
 * traceable Remote service resolves `ctx.remote.sidechat` to it through its
 * `{ associate: 'remote' }` tracker. This package restates the member shape,
 * because the TypeScript merge the harness generator would emit
 * (`TypertRemoteNamespaceMap`, types.d.ts:237-238) is not available to a
 * hand-written contribution.
 */
export interface SidechatNamespace {
  getContext: (args: SidechatContextArgs) => Promise<RemoteResult<SidechatProjectContext>>
  models: () => Promise<RemoteResult<SidechatModelsResult>>
  start: (args: SidechatStartArgs) => Promise<RemoteResult<SidechatJobIdResult>>
  poll: (args: SidechatPollArgs) => Promise<RemoteResult<SidechatPollResult>>
  stop: (args: SidechatStopArgs) => Promise<RemoteResult<SidechatStopResult>>
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    sidechat: SidechatNamespace
  }
}
