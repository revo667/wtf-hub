/**
 * Local hub bridge: real node-pty + CLI detection for the Vite browser UI.
 * Electron still uses its own IPC path; this unlocks real terminals without Electron.
 */
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { WebSocketServer, type WebSocket } from 'ws'
import * as pty from 'node-pty'
import { detectCliTools } from '../electron/cli'
import { listProjectFiles, readTextFile } from '../electron/fs-local'
import { ensureHubShellInit } from '../electron/hub-prompt'
import { enrichedPath } from '../electron/path-env'
import { scanProjects } from '../electron/projects'
import { loadSettings, saveSettings } from '../electron/settings'
import type { HubSettings, PtyCreateOptions } from '../shared/types'

const HOST = '127.0.0.1'
const PORT = 43126
const userData = path.join(os.homedir(), '.wtf-hub-bridge')
fs.mkdirSync(userData, { recursive: true })

let settings = loadSettings(userData)
const initPaths = ensureHubShellInit(userData)

type PtySession = { id: string; process: pty.IPty }
const sessions = new Map<string, PtySession>()
let seq = 0

type ClientMsg =
  | { type: 'rpc'; id: number; method: string; params?: unknown }
  | { type: 'ping' }

type ServerMsg =
  | { type: 'rpc'; id: number; ok: true; result: unknown }
  | { type: 'rpc'; id: number; ok: false; error: string }
  | { type: 'pty:data'; payload: { id: string; data: string } }
  | { type: 'pty:exit'; payload: { id: string; exitCode: number } }
  | { type: 'ready'; bridge: true }
  | { type: 'pong' }

const sockets = new Set<WebSocket>()

function broadcast(msg: ServerMsg): void {
  const raw = JSON.stringify(msg)
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) socket.send(raw)
  }
}

function spawnPty(options: PtyCreateOptions): { id: string } {
  const cwd =
    options.cwd && fs.existsSync(options.cwd) && fs.statSync(options.cwd).isDirectory()
      ? options.cwd
      : os.homedir()
  const shell = settings.defaultShell || process.env.SHELL || '/bin/bash'
  const shellName = path.basename(shell).toLowerCase()
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PATH: enrichedPath(),
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    TERM_PROGRAM: 'wtf-hub-bridge',
  }

  let shellArgs: string[] = []
  if (process.platform !== 'win32') {
    if (shellName.includes('zsh')) {
      env.ZDOTDIR = initPaths.zshDir
      shellArgs = ['-i']
    } else if (shellName.includes('bash')) {
      shellArgs = ['--rcfile', initPaths.bashRc, '-i']
    } else {
      shellArgs = ['-l']
    }
  }

  const id = `bridge-pty-${++seq}`
  const proc = pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols: options.cols ?? 80,
    rows: options.rows ?? 24,
    cwd,
    env,
  })

  proc.onData((data) => {
    broadcast({ type: 'pty:data', payload: { id, data } })
  })
  proc.onExit(({ exitCode }) => {
    sessions.delete(id)
    broadcast({ type: 'pty:exit', payload: { id, exitCode } })
  })

  sessions.set(id, { id, process: proc })
  return { id }
}

async function handleRpc(method: string, params: unknown): Promise<unknown> {
  switch (method) {
    case 'platform.homeDir':
      return os.homedir()
    case 'settings.get':
      return settings
    case 'settings.set': {
      const patch = (params || {}) as Partial<HubSettings>
      settings = {
        ...settings,
        ...patch,
        cliTemplates: {
          ...settings.cliTemplates,
          ...(patch.cliTemplates || {}),
        },
      }
      saveSettings(userData, settings)
      return settings
    }
    case 'projects.list':
      return scanProjects(settings.projectsRoot)
    case 'projects.listFiles':
      return listProjectFiles(String((params as { projectPath: string }).projectPath))
    case 'projects.openInFolder': {
      const projectPath = String((params as { projectPath: string }).projectPath)
      const { spawn } = await import('node:child_process')
      if (process.platform === 'darwin') spawn('open', [projectPath], { detached: true })
      else if (process.platform === 'win32') spawn('explorer', [projectPath], { detached: true })
      else spawn('xdg-open', [projectPath], { detached: true })
      return undefined
    }
    case 'projects.openInEditor':
      return { ok: false, error: 'Open in editor is available in Electron' }
    case 'cli.list':
      return detectCliTools(settings)
    case 'files.read':
      return readTextFile(String((params as { filePath: string }).filePath))
    case 'files.open':
      return { canceled: true, error: 'File dialog needs Electron — use project file list' }
    case 'files.save':
      return { canceled: true, error: 'Save dialog needs Electron' }
    case 'pty.create':
      return spawnPty((params || {}) as PtyCreateOptions)
    case 'pty.write': {
      const { id, data } = params as { id: string; data: string }
      sessions.get(id)?.process.write(data)
      return undefined
    }
    case 'pty.resize': {
      const { id, cols, rows } = params as { id: string; cols: number; rows: number }
      sessions.get(id)?.process.resize(cols, rows)
      return undefined
    }
    case 'pty.dispose': {
      const { id } = params as { id: string }
      const session = sessions.get(id)
      if (session) {
        try {
          session.process.kill()
        } catch {
          // ignore
        }
        sessions.delete(id)
      }
      return undefined
    }
    case 'music.sessions':
      return [
        {
          service: 'spotify',
          connected: false,
          configured: Boolean(settings.spotifyClientId),
        },
        {
          service: 'soundcloud',
          connected: false,
          configured: Boolean(settings.soundcloudClientId && settings.soundcloudClientSecret),
        },
      ]
    case 'music.connect':
      throw new Error('Connect Spotify/SoundCloud in Electron (`npm run electron:dev`)')
    case 'music.disconnect':
      return {
        service: (params as { service: string }).service,
        connected: false,
        configured: false,
      }
    case 'music.nowPlaying':
      return { service: (params as { service: string }).service, isPlaying: false }
    case 'music.transport':
      return { ok: false, error: 'Music transport needs Electron + connected account' }
    case 'music.playlists':
      throw new Error('Connect Spotify in Electron to load playlists')
    case 'music.playlistTracks':
      throw new Error('Connect Spotify in Electron to load tracks')
    case 'music.play':
      return { ok: false, error: 'Playback needs Electron + connected Spotify' }
    default:
      throw new Error(`Unknown method: ${method}`)
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, bridge: true }))
    return
  }
  res.writeHead(404)
  res.end('wtf-hub bridge')
})

const wss = new WebSocketServer({ server, path: '/hub' })

wss.on('connection', (socket) => {
  sockets.add(socket)
  socket.send(JSON.stringify({ type: 'ready', bridge: true } satisfies ServerMsg))

  socket.on('message', (raw) => {
    void (async () => {
      let msg: ClientMsg
      try {
        msg = JSON.parse(String(raw)) as ClientMsg
      } catch {
        return
      }
      if (msg.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' } satisfies ServerMsg))
        return
      }
      if (msg.type !== 'rpc') return
      try {
        const result = await handleRpc(msg.method, msg.params)
        socket.send(
          JSON.stringify({ type: 'rpc', id: msg.id, ok: true, result } satisfies ServerMsg),
        )
      } catch (err) {
        socket.send(
          JSON.stringify({
            type: 'rpc',
            id: msg.id,
            ok: false,
            error: err instanceof Error ? err.message : 'Bridge error',
          } satisfies ServerMsg),
        )
      }
    })()
  })

  socket.on('close', () => {
    sockets.delete(socket)
  })
})

server.listen(PORT, HOST, () => {
  console.log(`[wtf-hub bridge] real PTY on ws://${HOST}:${PORT}/hub`)
  console.log(`[wtf-hub bridge] PATH enriched · projects root: ${settings.projectsRoot}`)
})

function shutdown(): void {
  for (const session of sessions.values()) {
    try {
      session.process.kill()
    } catch {
      // ignore
    }
  }
  server.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
