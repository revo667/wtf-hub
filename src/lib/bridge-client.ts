import type {
  HubApi,
  HubSettings,
  MusicService,
  PtyCreateOptions,
} from '@shared/types'

const BRIDGE_WS = 'ws://127.0.0.1:43126/hub'
const BRIDGE_HEALTH = 'http://127.0.0.1:43126/health'

type ServerMsg =
  | { type: 'rpc'; id: number; ok: true; result: unknown }
  | { type: 'rpc'; id: number; ok: false; error: string }
  | { type: 'pty:data'; payload: { id: string; data: string } }
  | { type: 'pty:exit'; payload: { id: string; exitCode: number } }
  | { type: 'ready'; bridge: true }
  | { type: 'pong' }

export async function bridgeAvailable(): Promise<boolean> {
  try {
    const res = await fetch(BRIDGE_HEALTH, { signal: AbortSignal.timeout(600) })
    if (!res.ok) return false
    const data = (await res.json()) as { ok?: boolean }
    return Boolean(data.ok)
  } catch {
    return false
  }
}

export async function createBridgeApi(): Promise<HubApi> {
  const socket = new WebSocket(BRIDGE_WS)
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Bridge connect timeout')), 2500)
    socket.addEventListener('open', () => {
      window.clearTimeout(timer)
      resolve()
    })
    socket.addEventListener('error', () => {
      window.clearTimeout(timer)
      reject(new Error('Bridge connect failed'))
    })
  })

  let rpcSeq = 0
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (err: Error) => void }
  >()
  const dataListeners = new Set<(payload: { id: string; data: string }) => void>()
  const exitListeners = new Set<(payload: { id: string; exitCode: number }) => void>()

  socket.addEventListener('message', (event) => {
    let msg: ServerMsg
    try {
      msg = JSON.parse(String(event.data)) as ServerMsg
    } catch {
      return
    }
    if (msg.type === 'rpc') {
      const waiter = pending.get(msg.id)
      if (!waiter) return
      pending.delete(msg.id)
      if (msg.ok) waiter.resolve(msg.result)
      else waiter.reject(new Error(msg.error))
      return
    }
    if (msg.type === 'pty:data') {
      for (const listener of dataListeners) listener(msg.payload)
      return
    }
    if (msg.type === 'pty:exit') {
      for (const listener of exitListeners) listener(msg.payload)
    }
  })

  const rpc = async <T>(method: string, params?: unknown): Promise<T> => {
    if (socket.readyState !== WebSocket.OPEN) {
      throw new Error('Hub bridge disconnected')
    }
    const id = ++rpcSeq
    const result = new Promise<T>((resolve, reject) => {
      pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      })
    })
    socket.send(JSON.stringify({ type: 'rpc', id, method, params }))
    return result
  }

  const api: HubApi = {
    projects: {
      list: () => rpc('projects.list'),
      listFiles: (projectPath) => rpc('projects.listFiles', { projectPath }),
      openInFolder: (projectPath) => rpc('projects.openInFolder', { projectPath }),
      openInEditor: (projectPath) => rpc('projects.openInEditor', { projectPath }),
    },
    settings: {
      get: () => rpc('settings.get'),
      set: (patch: Partial<HubSettings>) => rpc('settings.set', patch),
    },
    music: {
      sessions: () => rpc('music.sessions'),
      connect: (service: MusicService) => rpc('music.connect', { service }),
      disconnect: (service: MusicService) => rpc('music.disconnect', { service }),
      nowPlaying: (service: MusicService) => rpc('music.nowPlaying', { service }),
      transport: (service, action) => rpc('music.transport', { service, action }),
      playlists: () => rpc('music.playlists'),
      playlistTracks: (playlistId) => rpc('music.playlistTracks', { playlistId }),
      play: (options) => rpc('music.play', options),
    },
    cli: {
      list: () => rpc('cli.list'),
    },
    files: {
      open: (defaultPath) => rpc('files.open', { defaultPath }),
      save: (options) => rpc('files.save', options),
      read: (filePath) => rpc('files.read', { filePath }),
      rename: (filePath, newName) => rpc('files.rename', { filePath, newName }),
      create: (dirPath, name) => rpc('files.create', { dirPath, name }),
      trash: (filePath) => rpc('files.trash', { filePath }),
      reveal: (filePath) => rpc('files.reveal', { filePath }),
    },
    pty: {
      create: (options: PtyCreateOptions) => rpc('pty.create', options),
      write: (id, data) => rpc('pty.write', { id, data }),
      resize: (id, cols, rows) => rpc('pty.resize', { id, cols, rows }),
      dispose: (id) => rpc('pty.dispose', { id }),
      onData: (callback) => {
        dataListeners.add(callback)
        return () => {
          dataListeners.delete(callback)
        }
      },
      onExit: (callback) => {
        exitListeners.add(callback)
        return () => {
          exitListeners.delete(callback)
        }
      },
    },
    presence: {
      set: async () => undefined,
    },
    platform: {
      isElectron: false,
      homeDir: () => rpc('platform.homeDir'),
    },
  }

  return api
}
