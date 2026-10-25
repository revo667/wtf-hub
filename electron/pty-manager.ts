import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { WebContents } from 'electron'
import * as pty from 'node-pty'
import { ensureHubShellInit } from './hub-prompt'
import { enrichedPath } from './path-env'

type Session = {
  id: string
  process: pty.IPty
}

function cleanEnv(overrides: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    // node-pty / posix_spawnp choke on undefined-like env entries under Electron
    if (typeof value === 'string' && value.length > 0) {
      env[key] = value
    }
  }
  for (const [key, value] of Object.entries(overrides)) {
    env[key] = value
  }
  // Avoid leaking Electron helper quirks into the shell
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_NO_ASAR
  return env
}

function resolveShellBinary(preferred: string): string {
  const candidates = [
    preferred,
    process.env.SHELL,
    process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash',
    '/bin/zsh',
    '/bin/bash',
    '/usr/bin/zsh',
    '/usr/bin/bash',
  ].filter((value): value is string => Boolean(value && value.trim()))

  for (const candidate of candidates) {
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) {
      try {
        fs.accessSync(candidate, fs.constants.X_OK)
        return candidate
      } catch {
        // try next
      }
    }
  }

  for (const candidate of candidates) {
    if (path.isAbsolute(candidate)) continue
    const name = path.basename(candidate)
    for (const dir of ['/bin', '/usr/bin', '/usr/local/bin', '/opt/homebrew/bin']) {
      const full = path.join(dir, name)
      if (fs.existsSync(full)) return full
    }
  }

  return process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash'
}

function ensureCwd(cwd: string): string {
  const home = os.homedir()
  const target = cwd && cwd !== '~' ? cwd : home
  try {
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      return target
    }
  } catch {
    // fall through
  }
  return home
}

function trySpawn(
  shell: string,
  args: string[],
  opts: { cols: number; rows: number; cwd: string; env: Record<string, string> },
): pty.IPty {
  return pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: opts.cols,
    rows: opts.rows,
    cwd: opts.cwd,
    env: opts.env,
  })
}

export class PtyManager {
  private sessions = new Map<string, Session>()
  private seq = 0
  private initPaths: { bashRc: string; zshDir: string } | null = null

  configure(userDataPath: string): void {
    this.initPaths = ensureHubShellInit(userDataPath)
  }

  create(
    webContents: WebContents,
    options: { cwd: string; shell: string; cols?: number; rows?: number },
  ): string {
    const id = `pty-${++this.seq}`
    const cols = options.cols ?? 80
    const rows = options.rows ?? 24
    const shell = resolveShellBinary(options.shell)
    const cwd = ensureCwd(options.cwd)
    const shellName = path.basename(shell).toLowerCase()

    const pathParts = [
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
      ...enrichedPath().split(path.delimiter),
    ].filter(Boolean)

    const baseEnv = cleanEnv({
      PATH: [...new Set(pathParts)].join(path.delimiter),
      HOME: os.homedir(),
      USER: os.userInfo().username,
      LOGNAME: os.userInfo().username,
      SHELL: shell,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'wtf-hub',
      LANG: process.env.LANG || 'en_US.UTF-8',
    })

    const attempts: Array<{ shell: string; args: string[]; env: Record<string, string> }> = []

    if (shellName.includes('zsh') && this.initPaths) {
      attempts.push({
        shell,
        args: ['-i'],
        env: { ...baseEnv, ZDOTDIR: this.initPaths.zshDir },
      })
    }
    if (shellName.includes('bash') && this.initPaths) {
      attempts.push({
        shell,
        args: ['--rcfile', this.initPaths.bashRc, '-i'],
        env: baseEnv,
      })
    }
    // Plain login / interactive — most reliable on macOS Electron
    attempts.push({ shell, args: ['-l'], env: baseEnv })
    attempts.push({ shell, args: ['-i'], env: baseEnv })
    attempts.push({ shell, args: [], env: baseEnv })
    if (shell !== '/bin/zsh' && fs.existsSync('/bin/zsh')) {
      attempts.push({ shell: '/bin/zsh', args: ['-l'], env: { ...baseEnv, SHELL: '/bin/zsh' } })
    }
    if (shell !== '/bin/bash' && fs.existsSync('/bin/bash')) {
      attempts.push({ shell: '/bin/bash', args: ['-l'], env: { ...baseEnv, SHELL: '/bin/bash' } })
    }

    let proc: pty.IPty | null = null
    let lastError: unknown = null
    for (const attempt of attempts) {
      try {
        proc = trySpawn(attempt.shell, attempt.args, {
          cols,
          rows,
          cwd,
          env: attempt.env,
        })
        break
      } catch (error) {
        lastError = error
      }
    }

    if (!proc) {
      const detail = lastError instanceof Error ? lastError.message : String(lastError)
      throw new Error(
        `Failed to spawn shell "${shell}" in "${cwd}": ${detail}. Run: npm run electron:rebuild`,
      )
    }

    proc.onData((data) => {
      if (!webContents.isDestroyed()) {
        webContents.send('pty:data', { id, data })
      }
    })

    proc.onExit(({ exitCode }) => {
      this.sessions.delete(id)
      if (!webContents.isDestroyed()) {
        webContents.send('pty:exit', { id, exitCode })
      }
    })

    this.sessions.set(id, { id, process: proc })
    return id
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id)
    if (!session) return
    session.process.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id)
    if (!session) return
    session.process.resize(cols, rows)
  }

  dispose(id: string): void {
    const session = this.sessions.get(id)
    if (!session) return
    try {
      session.process.kill()
    } catch {
      // ignore
    }
    this.sessions.delete(id)
  }

  disposeAll(): void {
    for (const id of [...this.sessions.keys()]) {
      this.dispose(id)
    }
  }

  defaultCwd(): string {
    return os.homedir()
  }
}
