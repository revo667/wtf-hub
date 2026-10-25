import type {
  CliTool,
  HubApi,
  HubSettings,
  MusicNowPlaying,
  MusicService,
  MusicSession,
  OpenFileResult,
  ProjectFileEntry,
  ProjectInfo,
  PtyCreateOptions,
  SaveFileResult,
  SpotifyPlaylist,
  SpotifyTrack,
} from '@shared/types'
import { formatThemedPrompt } from '@shared/prompt'
import { bridgeAvailable, createBridgeApi } from '@/lib/bridge-client'

declare global {
  interface Window {
    hub?: HubApi
  }
}

const DEMO_PROJECTS: ProjectInfo[] = [
  {
    id: '/demo/alpha-api',
    name: 'alpha-api',
    path: '/demo/alpha-api',
    hasGit: true,
    hasPackageJson: true,
    hasReadme: true,
  },
  {
    id: '/demo/beta-web',
    name: 'beta-web',
    path: '/demo/beta-web',
    hasGit: true,
    hasPackageJson: true,
    hasReadme: false,
  },
  {
    id: '/demo/gamma-cli',
    name: 'gamma-cli',
    path: '/demo/gamma-cli',
    hasGit: true,
    hasPackageJson: false,
    hasReadme: true,
  },
  {
    id: '/demo/delta-notes',
    name: 'delta-notes',
    path: '/demo/delta-notes',
    hasGit: false,
    hasPackageJson: false,
    hasReadme: true,
  },
]

const DEMO_CLIS: CliTool[] = [
  { id: 'claude', label: 'Claude', command: 'claude', available: false },
  { id: 'antigravity', label: 'Antigravity', command: 'antigravity', available: false },
  { id: 'cursor', label: 'Cursor', command: 'cursor-agent', available: false },
]

const DEMO_FILES: Record<string, ProjectFileEntry[]> = {
  '/demo/alpha-api': [
    { name: 'package.json', path: '/demo/alpha-api/package.json', relative: 'package.json' },
    { name: 'README.md', path: '/demo/alpha-api/README.md', relative: 'README.md' },
    { name: 'index.ts', path: '/demo/alpha-api/src/index.ts', relative: 'src/index.ts' },
    { name: 'routes.ts', path: '/demo/alpha-api/src/routes.ts', relative: 'src/routes.ts' },
  ],
  '/demo/beta-web': [
    { name: 'package.json', path: '/demo/beta-web/package.json', relative: 'package.json' },
    { name: 'App.tsx', path: '/demo/beta-web/src/App.tsx', relative: 'src/App.tsx' },
    { name: 'index.css', path: '/demo/beta-web/src/index.css', relative: 'src/index.css' },
    { name: 'vite.config.ts', path: '/demo/beta-web/vite.config.ts', relative: 'vite.config.ts' },
  ],
  '/demo/gamma-cli': [
    { name: 'README.md', path: '/demo/gamma-cli/README.md', relative: 'README.md' },
    { name: 'main.go', path: '/demo/gamma-cli/main.go', relative: 'main.go' },
    { name: 'go.mod', path: '/demo/gamma-cli/go.mod', relative: 'go.mod' },
  ],
  '/demo/delta-notes': [
    { name: 'README.md', path: '/demo/delta-notes/README.md', relative: 'README.md' },
    { name: 'ideas.md', path: '/demo/delta-notes/ideas.md', relative: 'ideas.md' },
    { name: 'todo.txt', path: '/demo/delta-notes/todo.txt', relative: 'todo.txt' },
  ],
}

const DEMO_PLAYLISTS: SpotifyPlaylist[] = [
  {
    id: 'pl-focus',
    name: 'Focus Flow',
    description: 'Deep work',
    trackCount: 3,
    owner: 'yildiz',
    owned: true,
    uri: 'spotify:playlist:pl-focus',
    url: 'https://open.spotify.com/playlist/pl-focus',
  },
  {
    id: 'pl-night',
    name: 'Night Drive',
    description: 'Low lights',
    trackCount: 3,
    owner: 'yildiz',
    owned: true,
    uri: 'spotify:playlist:pl-night',
    url: 'https://open.spotify.com/playlist/pl-night',
  },
  {
    id: 'pl-rice',
    name: 'Hypr Rice',
    trackCount: 2,
    owner: 'yildiz',
    owned: true,
    uri: 'spotify:playlist:pl-rice',
    url: 'https://open.spotify.com/playlist/pl-rice',
  },
]

const DEMO_TRACKS: Record<string, SpotifyTrack[]> = {
  'pl-focus': [
    {
      id: 't1',
      name: 'Glass Terminal',
      artists: 'Hub Ensemble',
      album: 'Desktop',
      durationMs: 214000,
      uri: 'spotify:track:t1',
    },
    {
      id: 't2',
      name: 'Soft Blur',
      artists: 'Vignette',
      album: 'Desktop',
      durationMs: 198000,
      uri: 'spotify:track:t2',
    },
    {
      id: 't3',
      name: 'Accent Ring',
      artists: 'Tilework',
      album: 'Desktop',
      durationMs: 241000,
      uri: 'spotify:track:t3',
    },
  ],
  'pl-night': [
    {
      id: 't4',
      name: 'Olive Hour',
      artists: 'Waybar',
      durationMs: 205000,
      uri: 'spotify:track:t4',
    },
    {
      id: 't5',
      name: 'Late Commit',
      artists: 'Mainline',
      durationMs: 189000,
      uri: 'spotify:track:t5',
    },
    {
      id: 't6',
      name: 'Empty Desktop',
      artists: 'Binder',
      durationMs: 223000,
      uri: 'spotify:track:t6',
    },
  ],
  'pl-rice': [
    {
      id: 't7',
      name: 'Rounded Corners',
      artists: 'Hyprland',
      durationMs: 176000,
      uri: 'spotify:track:t7',
    },
    {
      id: 't8',
      name: 'Floating Tile',
      artists: 'Hyprland',
      durationMs: 202000,
      uri: 'spotify:track:t8',
    },
  ],
}

const DEMO_CONTENTS: Record<string, string> = {
  '/demo/alpha-api/package.json': '{\n  "name": "alpha-api",\n  "private": true\n}\n',
  '/demo/alpha-api/README.md': '# alpha-api\n\nDemo API project.\n',
  '/demo/alpha-api/src/index.ts': "export function boot() {\n  console.log('alpha-api')\n}\n",
  '/demo/alpha-api/src/routes.ts': "export const routes = ['/health', '/v1/items']\n",
  '/demo/beta-web/package.json': '{\n  "name": "beta-web",\n  "private": true\n}\n',
  '/demo/beta-web/src/App.tsx': "export default function App() {\n  return <main>beta-web</main>\n}\n",
  '/demo/beta-web/src/index.css': ':root {\n  color-scheme: dark;\n}\n',
  '/demo/beta-web/vite.config.ts': "export default { server: { port: 5173 } }\n",
  '/demo/gamma-cli/README.md': '# gamma-cli\n\nDemo CLI.\n',
  '/demo/gamma-cli/main.go': 'package main\n\nfunc main() {}\n',
  '/demo/gamma-cli/go.mod': 'module gamma-cli\n\ngo 1.22\n',
  '/demo/delta-notes/README.md': '# delta-notes\n\nScratch pad.\n',
  '/demo/delta-notes/ideas.md': '- glass tiles\n- themed prompt\n',
  '/demo/delta-notes/todo.txt': '[ ] rice the hub\n[x] add editor\n',
}

type MockSession = {
  id: string
  cwd: string
  inputLen: number
  timer?: ReturnType<typeof setInterval>
}

const SESSION_OWNER = 'yildiz'

function createMockApi(): HubApi {
  let settings: HubSettings = {
    projectsRoot: '~/Documents/Projects',
    defaultShell: '/bin/bash',
    cliTemplates: {
      claude: 'claude',
      antigravity: 'antigravity',
      cursor: 'cursor-agent',
    },
    spotifyClientId: '',
    soundcloudClientId: '',
    soundcloudClientSecret: '',
    discordRichPresence: false,
    discordClientId: '',
    discordLargeImageKey: 'discord-rich-presence-512',
  }

  const musicState: Record<MusicService, MusicSession> = {
    spotify: { service: 'spotify', connected: false, configured: false, displayName: undefined },
    soundcloud: {
      service: 'soundcloud',
      connected: false,
      configured: false,
      displayName: undefined,
    },
  }
  let mockPlaying = false

  const sessions = new Map<string, MockSession>()
  const dataListeners = new Set<(payload: { id: string; data: string }) => void>()
  const exitListeners = new Set<(payload: { id: string; exitCode: number }) => void>()
  let seq = 0

  const emit = (id: string, data: string) => {
    for (const listener of dataListeners) listener({ id, data })
  }

  const promptFor = (cwd: string) =>
    formatThemedPrompt({
      cwd,
      user: SESSION_OWNER,
      home: `/Users/${SESSION_OWNER}`,
    })

  return {
    projects: {
      list: async () => DEMO_PROJECTS,
      listFiles: async (projectPath) => DEMO_FILES[projectPath] ?? [],
      openInFolder: async () => undefined,
      openInEditor: async () => ({ ok: false, error: 'Browser preview mode' }),
    },
    settings: {
      get: async () => settings,
      set: async (patch) => {
        settings = {
          ...settings,
          ...patch,
          cliTemplates: { ...settings.cliTemplates, ...(patch.cliTemplates || {}) },
        }
        musicState.spotify.configured = Boolean(settings.spotifyClientId)
        musicState.soundcloud.configured = Boolean(
          settings.soundcloudClientId && settings.soundcloudClientSecret,
        )
        return settings
      },
    },
    music: {
      sessions: async () => {
        musicState.spotify.configured = Boolean(settings.spotifyClientId)
        musicState.soundcloud.configured = Boolean(
          settings.soundcloudClientId && settings.soundcloudClientSecret,
        )
        return [musicState.spotify, musicState.soundcloud]
      },
      connect: async (service) => {
        musicState[service] = {
          service,
          connected: true,
          configured: true,
          displayName: service === 'spotify' ? 'yildiz (demo)' : 'yildiz-sc (demo)',
          userId: 'demo',
        }
        return musicState[service]
      },
      disconnect: async (service) => {
        musicState[service] = {
          service,
          connected: false,
          configured:
            service === 'spotify'
              ? Boolean(settings.spotifyClientId)
              : Boolean(settings.soundcloudClientId && settings.soundcloudClientSecret),
        }
        mockPlaying = false
        return musicState[service]
      },
      nowPlaying: async (service): Promise<MusicNowPlaying> => {
        if (!musicState[service].connected) {
          return { service, isPlaying: false }
        }
        return {
          service,
          isPlaying: mockPlaying,
          title: service === 'spotify' ? 'Demo Track' : 'Demo Cloud Track',
          artist: musicState[service].displayName || 'You',
          url:
            service === 'spotify'
              ? 'https://open.spotify.com'
              : 'https://soundcloud.com',
        }
      },
      transport: async (_service, action) => {
        if (action === 'play') mockPlaying = true
        if (action === 'pause') mockPlaying = false
        return { ok: true }
      },
      playlists: async () => {
        if (!musicState.spotify.connected) {
          throw new Error('Spotify not connected')
        }
        return DEMO_PLAYLISTS
      },
      playlistTracks: async (playlistId) => {
        if (!musicState.spotify.connected) {
          throw new Error('Spotify not connected')
        }
        return DEMO_TRACKS[playlistId] ?? []
      },
      play: async () => {
        if (!musicState.spotify.connected) {
          return { ok: false, error: 'Spotify not connected' }
        }
        mockPlaying = true
        return { ok: true }
      },
    },
    cli: {
      list: async () => DEMO_CLIS,
    },
    files: {
      open: async (): Promise<OpenFileResult> => {
        return new Promise((resolve) => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept =
            '.txt,.md,.json,.js,.ts,.tsx,.jsx,.css,.html,.py,.rs,.go,.toml,.yml,.yaml,.sh,*'
          input.onchange = async () => {
            const file = input.files?.[0]
            if (!file) {
              resolve({ canceled: true })
              return
            }
            try {
              const content = await file.text()
              resolve({
                canceled: false,
                path: `browser://${file.name}`,
                name: file.name,
                content,
              })
            } catch (err) {
              resolve({
                canceled: false,
                error: err instanceof Error ? err.message : 'Failed to read file',
              })
            }
          }
          input.addEventListener('cancel', () => resolve({ canceled: true }))
          input.click()
        })
      },
      save: async (options): Promise<SaveFileResult> => {
        const name = options.name || 'untitled.txt'
        const blob = new Blob([options.content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = name
        anchor.click()
        URL.revokeObjectURL(url)
        return {
          canceled: false,
          path: options.path || `browser://${name}`,
          name,
        }
      },
      read: async (filePath) => {
        if (filePath in DEMO_CONTENTS) {
          return { ok: true, content: DEMO_CONTENTS[filePath] }
        }
        if (filePath.startsWith('browser://')) {
          return { ok: false, error: 'Browser preview cannot re-read local picks' }
        }
        return { ok: false, error: 'Browser preview mode' }
      },
      rename: async () => ({ ok: false, error: 'Browser preview mode' }),
      create: async () => ({ ok: false, error: 'Browser preview mode' }),
      trash: async () => ({ ok: false, error: 'Browser preview mode' }),
      reveal: async () => undefined,
    },
    pty: {
      create: async (options: PtyCreateOptions) => {
        const id = `mock-pty-${++seq}`
        sessions.set(id, { id, cwd: options.cwd, inputLen: 0 })
        window.setTimeout(() => {
          emit(id, promptFor(options.cwd))
        }, 40)
        return { id }
      },
      write: async (id, data) => {
        const session = sessions.get(id)
        if (!session) return
        if (data === '\r') {
          session.inputLen = 0
          emit(id, `\r\n${promptFor(session.cwd)}`)
          return
        }
        if (data === '\u007f') {
          if (session.inputLen <= 0) return
          session.inputLen -= 1
          emit(id, '\b \b')
          return
        }
        if (data === '\u0003') {
          session.inputLen = 0
          emit(id, '^C\r\n' + promptFor(session.cwd))
          return
        }
        if (data === '\u0015') {
          if (session.inputLen <= 0) return
          emit(id, '\b \b'.repeat(session.inputLen))
          session.inputLen = 0
          return
        }
        if (data.length === 1 && data >= ' ') {
          session.inputLen += 1
        }
        emit(id, data.replace(/\r/g, '\r\n'))
      },
      resize: async () => undefined,
      dispose: async (id) => {
        const session = sessions.get(id)
        if (!session) return
        if (session.timer) clearInterval(session.timer)
        sessions.delete(id)
        for (const listener of exitListeners) listener({ id, exitCode: 0 })
      },
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
      homeDir: async () => '/home/user',
    },
  }
}

export type HubRuntime = 'electron' | 'bridge' | 'mock'

let cached: HubApi | null = null
let runtime: HubRuntime = 'mock'

export async function initHub(): Promise<HubApi> {
  if (cached) return cached

  if (window.hub) {
    cached = window.hub
    runtime = 'electron'
    return cached
  }

  if (await bridgeAvailable()) {
    try {
      cached = await createBridgeApi()
      runtime = 'bridge'
      return cached
    } catch (err) {
      console.warn('[wtf-hub] bridge connect failed, falling back to mock', err)
    }
  }

  cached = createMockApi()
  runtime = 'mock'
  return cached
}

export function getHub(): HubApi {
  if (!cached) {
    // Sync fallback for first paint edge cases; prefer initHub() before render.
    cached = window.hub ?? createMockApi()
    runtime = window.hub ? 'electron' : 'mock'
  }
  return cached
}

export function getHubRuntime(): HubRuntime {
  return runtime
}

export function isElectronRuntime(): boolean {
  return runtime === 'electron' || Boolean(window.hub?.platform.isElectron)
}

export function isLiveTerminalRuntime(): boolean {
  return runtime === 'electron' || runtime === 'bridge'
}
