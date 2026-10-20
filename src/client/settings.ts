/**
 * Browser-half preferences for the side-chat plugin.
 *
 * The 0.1 plugin persisted its master switch through the Host settings
 * document (`ctx.settingsScope` + a `settings.section` registration). DSH 0.2.1
 * changed that whole surface (`ctx.settingsScope` no longer exists and the
 * Settings UI is form-driven), so this port keeps the switch local to the
 * browser half in `localStorage` — no Host settings dependency, no service
 * injection, just a durable value that survives reloads.
 * @module dsh-sidechat/client/settings
 */

/** localStorage key owning the browser-side side-chat preferences. */
export const SIDECHAT_SETTINGS_STORAGE_KEY = 'dsh-sidechat.settings.v1'

/** Durable browser-side side-chat preferences. */
export interface SidechatSettings {
  /** Master switch: when false the hover hot zone stays dormant and selection-send is hidden. */
  enabled: boolean
}

/** Value applied before the user has ever toggled the switch. */
export const SIDECHAT_SETTINGS_DEFAULT: SidechatSettings = { enabled: true }

/** Normalize one untrusted parsed value into complete settings. */
function normalize(raw: unknown): SidechatSettings {
  if (raw === null || typeof raw !== 'object') return { ...SIDECHAT_SETTINGS_DEFAULT }
  const enabled = (raw as { enabled?: unknown }).enabled
  return { enabled: typeof enabled === 'boolean' ? enabled : SIDECHAT_SETTINGS_DEFAULT.enabled }
}

/**
 * Read the persisted preferences.
 * @returns complete settings, falling back to defaults when storage is absent,
 * unreadable, or holds a malformed document.
 */
export function loadSettings(): SidechatSettings {
  try {
    const stored = globalThis.localStorage?.getItem(SIDECHAT_SETTINGS_STORAGE_KEY)
    if (stored === null || stored === undefined || stored === '') return { ...SIDECHAT_SETTINGS_DEFAULT }
    return normalize(JSON.parse(stored))
  } catch {
    return { ...SIDECHAT_SETTINGS_DEFAULT }
  }
}

/**
 * Persist one patch of the preferences and return the merged result.
 * @param patch - fields to change.
 * @returns the complete settings after the patch (even when persistence failed).
 */
export function saveSettings(patch: Partial<SidechatSettings>): SidechatSettings {
  const next: SidechatSettings = { ...loadSettings(), ...patch }
  try {
    globalThis.localStorage?.setItem(SIDECHAT_SETTINGS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* private-mode or quota failures keep the in-memory value */
  }
  return next
}
