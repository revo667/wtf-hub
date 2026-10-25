import { Client } from '@xhayper/discord-rpc'

export type DiscordPresencePayload = {
  projectName?: string | null
  surfaces: string[]
}

type DiscordConfig = {
  enabled: boolean
  clientId: string
  largeImageKey: string
}

let client: Client | null = null
let ready = false
let loginPromise: Promise<void> | null = null
let startedAt = Date.now()
let lastPayload: DiscordPresencePayload = { surfaces: [] }
let config: DiscordConfig = {
  enabled: false,
  clientId: '',
  largeImageKey: 'discord-rich-presence-512',
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(0, max - 1))}…`
}

async function ensureClient(): Promise<boolean> {
  if (!config.enabled || !config.clientId.trim()) {
    await clearActivity()
    await destroyClient()
    return false
  }

  if (ready && client) return true
  if (loginPromise) {
    await loginPromise
    return ready
  }

  const clientId = config.clientId.trim()
  loginPromise = (async () => {
    await destroyClient()
    const next = new Client({ clientId })
    client = next
    await next.login()
    ready = Boolean(next.user) || next.isConnected
    startedAt = Date.now()
  })()

  try {
    await loginPromise
    return ready
  } catch (error) {
    console.error('[discord-presence] login failed', error)
    ready = false
    client = null
    return false
  } finally {
    loginPromise = null
  }
}

async function destroyClient(): Promise<void> {
  ready = false
  const current = client
  client = null
  if (!current) return
  try {
    await current.destroy()
  } catch {
    // ignore
  }
}

export function configureDiscordPresence(next: DiscordConfig): void {
  const changed =
    next.enabled !== config.enabled ||
    next.clientId.trim() !== config.clientId.trim() ||
    next.largeImageKey.trim() !== config.largeImageKey.trim()
  config = {
    enabled: next.enabled,
    clientId: next.clientId.trim(),
    largeImageKey: next.largeImageKey.trim() || 'discord-rich-presence-512',
  }
  if (changed) {
    void (async () => {
      await destroyClient()
      if (config.enabled && config.clientId) {
        await setDiscordPresence(lastPayload)
      } else {
        await clearActivity()
      }
    })()
  }
}

async function clearActivity(): Promise<void> {
  if (!client || !ready) return
  try {
    await client.user?.clearActivity()
  } catch {
    // ignore
  }
}

export async function setDiscordPresence(payload: DiscordPresencePayload): Promise<void> {
  lastPayload = payload
  const ok = await ensureClient()
  if (!ok || !client?.user) return

  const project = payload.projectName?.trim()
  const details = truncate(project ? `Working on ${project}` : 'Browsing projects', 128)
  const surfaces = payload.surfaces.filter(Boolean)
  const state = truncate(surfaces.length > 0 ? surfaces.join(' · ') : 'Idle desktop', 128)

  try {
    await client.user.setActivity({
      details,
      state,
      startTimestamp: startedAt,
      largeImageKey: config.largeImageKey || 'discord-rich-presence-512',
      largeImageText: 'WTF HUB',
      instance: false,
    })
  } catch (error) {
    console.error('[discord-presence] setActivity failed', error)
  }
}

export async function shutdownDiscordPresence(): Promise<void> {
  await clearActivity()
  await destroyClient()
}
