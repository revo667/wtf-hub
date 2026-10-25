import { contextBridge, ipcRenderer } from 'electron'
import type {
  DiscordPresencePayload,
  HubApi,
  HubSettings,
  MusicService,
  PtyCreateOptions,
} from '../shared/types'

const api: HubApi = {
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    listFiles: (projectPath) => ipcRenderer.invoke('projects:listFiles', projectPath),
    openInFolder: (projectPath) => ipcRenderer.invoke('projects:openInFolder', projectPath),
    openInEditor: (projectPath) => ipcRenderer.invoke('projects:openInEditor', projectPath),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<HubSettings>) => ipcRenderer.invoke('settings:set', patch),
  },
  music: {
    sessions: () => ipcRenderer.invoke('music:sessions'),
    connect: (service: MusicService) => ipcRenderer.invoke('music:connect', service),
    disconnect: (service: MusicService) => ipcRenderer.invoke('music:disconnect', service),
    nowPlaying: (service: MusicService) => ipcRenderer.invoke('music:nowPlaying', service),
    transport: (service, action) => ipcRenderer.invoke('music:transport', service, action),
    playlists: () => ipcRenderer.invoke('music:playlists'),
    playlistTracks: (playlistId) => ipcRenderer.invoke('music:playlistTracks', playlistId),
    play: (options) => ipcRenderer.invoke('music:play', options),
  },
  cli: {
    list: () => ipcRenderer.invoke('cli:list'),
  },
  files: {
    open: (defaultPath) => ipcRenderer.invoke('files:open', defaultPath),
    save: (options) => ipcRenderer.invoke('files:save', options),
    read: (filePath) => ipcRenderer.invoke('files:read', filePath),
    rename: (filePath, newName) => ipcRenderer.invoke('files:rename', filePath, newName),
    create: (dirPath, name) => ipcRenderer.invoke('files:create', dirPath, name),
    trash: (filePath) => ipcRenderer.invoke('files:trash', filePath),
    reveal: (filePath) => ipcRenderer.invoke('files:reveal', filePath),
  },
  pty: {
    create: (options: PtyCreateOptions) => ipcRenderer.invoke('pty:create', options),
    write: (id, data) => ipcRenderer.invoke('pty:write', id, data),
    resize: (id, cols, rows) => ipcRenderer.invoke('pty:resize', id, cols, rows),
    dispose: (id) => ipcRenderer.invoke('pty:dispose', id),
    onData: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { id: string; data: string }) => {
        callback(payload)
      }
      ipcRenderer.on('pty:data', listener)
      return () => {
        ipcRenderer.removeListener('pty:data', listener)
      }
    },
    onExit: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: { id: string; exitCode: number },
      ) => {
        callback(payload)
      }
      ipcRenderer.on('pty:exit', listener)
      return () => {
        ipcRenderer.removeListener('pty:exit', listener)
      }
    },
  },
  presence: {
    set: (payload: DiscordPresencePayload) => ipcRenderer.invoke('presence:set', payload),
  },
  platform: {
    isElectron: true,
    homeDir: () => ipcRenderer.invoke('platform:homeDir'),
  },
}

contextBridge.exposeInMainWorld('hub', api)
