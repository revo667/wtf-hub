export type ProjectInfo = {
  id: string
  name: string
  path: string
  hasGit: boolean
  hasPackageJson: boolean
  hasReadme: boolean
}

export type HubSettings = {
  projectsRoot: string
  defaultShell: string
  cliTemplates: Record<string, string>
  spotifyClientId: string
  soundcloudClientId: string
  soundcloudClientSecret: string
  discordRichPresence: boolean
  discordClientId: string
  discordLargeImageKey: string
}

export type DiscordPresencePayload = {
  projectName?: string | null
  surfaces: string[]
}

export type MusicService = 'spotify' | 'soundcloud'

export type MusicSession = {
  service: MusicService
  connected: boolean
  configured: boolean
  displayName?: string
  userId?: string
}

export type MusicNowPlaying = {
  service: MusicService
  isPlaying: boolean
  title?: string
  artist?: string
  albumArtUrl?: string
  url?: string
  progressMs?: number
  durationMs?: number
}

export type MusicTransportResult = {
  ok: boolean
  error?: string
}

export type SpotifyPlaylist = {
  id: string
  name: string
  description?: string
  imageUrl?: string
  trackCount: number
  owner?: string
  /** Spotify Feb 2026: track lists only for owned / collaborative playlists */
  owned: boolean
  uri: string
  url?: string
}

export type SpotifyTrack = {
  id: string
  name: string
  artists: string
  album?: string
  durationMs: number
  imageUrl?: string
  uri: string
  url?: string
}

export type CliTool = {
  id: string
  label: string
  command: string
  available: boolean
}

export type PtyCreateOptions = {
  cwd: string
  cols?: number
  rows?: number
}

export type OpenFileResult = {
  canceled: boolean
  path?: string
  name?: string
  content?: string
  error?: string
}

export type SaveFileResult = {
  canceled: boolean
  path?: string
  name?: string
  error?: string
}

export type ProjectFileEntry = {
  name: string
  path: string
  relative: string
}

export type HubApi = {
  projects: {
    list: () => Promise<ProjectInfo[]>
    listFiles: (projectPath: string) => Promise<ProjectFileEntry[]>
    openInFolder: (projectPath: string) => Promise<void>
    openInEditor: (projectPath: string) => Promise<{ ok: boolean; error?: string }>
  }
  settings: {
    get: () => Promise<HubSettings>
    set: (patch: Partial<HubSettings>) => Promise<HubSettings>
  }
  music: {
    sessions: () => Promise<MusicSession[]>
    connect: (service: MusicService) => Promise<MusicSession>
    disconnect: (service: MusicService) => Promise<MusicSession>
    nowPlaying: (service: MusicService) => Promise<MusicNowPlaying>
    transport: (
      service: MusicService,
      action: 'play' | 'pause' | 'next' | 'previous',
    ) => Promise<MusicTransportResult>
    playlists: () => Promise<SpotifyPlaylist[]>
    playlistTracks: (playlistId: string) => Promise<SpotifyTrack[]>
    play: (options: {
      contextUri?: string
      uris?: string[]
      offsetUri?: string
    }) => Promise<MusicTransportResult>
  }
  cli: {
    list: () => Promise<CliTool[]>
  }
  files: {
    open: (defaultPath?: string) => Promise<OpenFileResult>
    save: (options: {
      path?: string | null
      name?: string
      content: string
      defaultPath?: string
    }) => Promise<SaveFileResult>
    read: (filePath: string) => Promise<{ ok: boolean; content?: string; error?: string }>
  }
  pty: {
    create: (options: PtyCreateOptions) => Promise<{ id: string }>
    write: (id: string, data: string) => Promise<void>
    resize: (id: string, cols: number, rows: number) => Promise<void>
    dispose: (id: string) => Promise<void>
    onData: (callback: (payload: { id: string; data: string }) => void) => () => void
    onExit: (callback: (payload: { id: string; exitCode: number }) => void) => () => void
  }
  presence: {
    set: (payload: DiscordPresencePayload) => Promise<void>
  }
  platform: {
    isElectron: boolean
    homeDir: () => Promise<string>
  }
}
