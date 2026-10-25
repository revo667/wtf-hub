import { app, BrowserWindow, ipcMain, shell } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { detectCliTools, findEditorCommand } from './cli'
import { listProjectFiles, openTextFile, readTextFile, saveTextFile } from './files'
import {
  configureMusic,
  connectMusicService,
  disconnectMusicService,
  getNowPlaying,
  listMusicSessions,
  listSpotifyPlaylistTracks,
  listSpotifyPlaylists,
  musicTransport,
  playSpotify,
} from './music'
import {
  configureDiscordPresence,
  setDiscordPresence,
  shutdownDiscordPresence,
  type DiscordPresencePayload,
} from './discord-presence'
import { scanProjects } from './projects'
import { PtyManager } from './pty-manager'
import { createDefaultSettings, loadSettings, saveSettings } from './settings'
import type { HubSettings, MusicService } from '../shared/types'

function syncDiscordFromSettings(next: HubSettings): void {
  configureDiscordPresence({
    enabled: next.discordRichPresence,
    clientId: next.discordClientId,
    largeImageKey: next.discordLargeImageKey,
  })
}

const ptyManager = new PtyManager()
let mainWindow: BrowserWindow | null = null
let settings: HubSettings = createDefaultSettings()

function userDataPath(): string {
  return app.getPath('userData')
}

function resolveAppIcon(): string | undefined {
  const candidates = [
    path.join(__dirname, '../public/icon.png'),
    path.join(__dirname, '../dist/icon.png'),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate))
}

function createWindow(): void {
  const icon = resolveAppIcon()
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    fullscreen: true,
    backgroundColor: '#0a0c0a',
    title: 'WTF HUB',
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Allow Spotify / SoundCloud CDN artwork (Feb 2026 clients still need https img-src)
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders }
    headers['Content-Security-Policy'] = [
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https: blob:; media-src 'self' https: blob:; connect-src 'self' ws: wss: http://127.0.0.1:* http://localhost:* https://api.spotify.com https://accounts.spotify.com https://api.soundcloud.com",
    ]
    callback({ responseHeaders: headers })
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    void mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => settings)

  ipcMain.handle('settings:set', (_event, patch: Partial<HubSettings>) => {
    settings = {
      ...settings,
      ...patch,
      cliTemplates: {
        ...settings.cliTemplates,
        ...(patch.cliTemplates || {}),
      },
    }
    saveSettings(userDataPath(), settings)
    syncDiscordFromSettings(settings)
    return settings
  })

  ipcMain.handle('presence:set', async (_event, payload: DiscordPresencePayload) => {
    await setDiscordPresence(payload)
  })

  ipcMain.handle('projects:list', () => {
    return scanProjects(settings.projectsRoot)
  })

  ipcMain.handle('projects:listFiles', (_event, projectPath: string) => {
    return listProjectFiles(projectPath)
  })

  ipcMain.handle('projects:openInFolder', async (_event, projectPath: string) => {
    if (!fs.existsSync(projectPath)) {
      throw new Error('Project path not found')
    }
    await shell.openPath(projectPath)
  })

  ipcMain.handle('projects:openInEditor', async (_event, projectPath: string) => {
    const editor = findEditorCommand()
    if (!editor) {
      return { ok: false, error: 'No editor found (cursor/code)' }
    }
    const { spawn } = await import('node:child_process')
    spawn(editor, [projectPath], {
      cwd: projectPath,
      detached: true,
      stdio: 'ignore',
    }).unref()
    return { ok: true }
  })

  ipcMain.handle('cli:list', () => detectCliTools(settings))

  ipcMain.handle('music:sessions', () => listMusicSessions())
  ipcMain.handle('music:connect', async (_event, service: MusicService) => {
    return connectMusicService(service)
  })
  ipcMain.handle('music:disconnect', (_event, service: MusicService) => {
    return disconnectMusicService(service)
  })
  ipcMain.handle('music:nowPlaying', async (_event, service: MusicService) => {
    return getNowPlaying(service)
  })
  ipcMain.handle(
    'music:transport',
    async (_event, service: MusicService, action: 'play' | 'pause' | 'next' | 'previous') => {
      return musicTransport(service, action)
    },
  )
  ipcMain.handle('music:playlists', async () => listSpotifyPlaylists())
  ipcMain.handle('music:playlistTracks', async (_event, playlistId: string) => {
    return listSpotifyPlaylistTracks(playlistId)
  })
  ipcMain.handle(
    'music:play',
    async (
      _event,
      options: { contextUri?: string; uris?: string[]; offsetUri?: string },
    ) => playSpotify(options),
  )

  ipcMain.handle(
    'pty:create',
    (event, options: { cwd: string; cols?: number; rows?: number }) => {
      const cwd =
        options.cwd && fs.existsSync(options.cwd) ? options.cwd : ptyManager.defaultCwd()
      const id = ptyManager.create(event.sender, {
        cwd,
        shell: settings.defaultShell,
        cols: options.cols,
        rows: options.rows,
      })
      return { id }
    },
  )

  ipcMain.handle('pty:write', (_event, id: string, data: string) => {
    ptyManager.write(id, data)
  })

  ipcMain.handle('pty:resize', (_event, id: string, cols: number, rows: number) => {
    ptyManager.resize(id, cols, rows)
  })

  ipcMain.handle('pty:dispose', (_event, id: string) => {
    ptyManager.dispose(id)
  })

  ipcMain.handle('platform:homeDir', () => os.homedir())

  ipcMain.handle('files:open', async (_event, defaultPath?: string) => {
    return openTextFile(mainWindow, defaultPath)
  })

  ipcMain.handle(
    'files:save',
    async (
      _event,
      options: { path?: string | null; name?: string; content: string; defaultPath?: string },
    ) => {
      return saveTextFile(mainWindow, options)
    },
  )

  ipcMain.handle('files:read', (_event, filePath: string) => readTextFile(filePath))
}

app.whenReady().then(() => {
  settings = loadSettings(userDataPath())
  ptyManager.configure(userDataPath())
  configureMusic(userDataPath(), () => ({
    spotifyClientId: settings.spotifyClientId,
    soundcloudClientId: settings.soundcloudClientId,
    soundcloudClientSecret: settings.soundcloudClientSecret,
  }))
  syncDiscordFromSettings(settings)
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  ptyManager.disposeAll()
  void shutdownDiscordPresence()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  ptyManager.disposeAll()
  void shutdownDiscordPresence()
})
