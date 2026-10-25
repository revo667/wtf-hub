import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { HubSettings } from '../shared/types'

export const DEFAULT_CLI_TEMPLATES: Record<string, string> = {
  claude: 'claude',
  antigravity: 'antigravity',
  cursor: 'cursor-agent',
}

function defaultProjectsRoot(): string {
  return path.join(os.homedir(), 'Documents', 'Projects')
}

function defaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.SHELL || 'powershell.exe'
  }
  // macOS default login shell is zsh; keep an absolute path Electron can spawn.
  const candidates = [
    process.env.SHELL,
    process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash',
    '/bin/zsh',
    '/bin/bash',
    '/usr/bin/zsh',
    '/usr/bin/bash',
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) {
      return candidate
    }
  }
  return process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash'
}

export function createDefaultSettings(): HubSettings {
  return {
    projectsRoot: defaultProjectsRoot(),
    defaultShell: defaultShell(),
    cliTemplates: { ...DEFAULT_CLI_TEMPLATES },
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
    soundcloudClientId: process.env.SOUNDCLOUD_CLIENT_ID || '',
    soundcloudClientSecret: process.env.SOUNDCLOUD_CLIENT_SECRET || '',
    discordRichPresence: false,
    discordClientId: process.env.DISCORD_CLIENT_ID || '',
    discordLargeImageKey: 'discord-rich-presence-512',
  }
}

function normalizeCliTemplates(raw: Record<string, string> | undefined): Record<string, string> {
  return {
    claude: raw?.claude || DEFAULT_CLI_TEMPLATES.claude,
    antigravity: raw?.antigravity || DEFAULT_CLI_TEMPLATES.antigravity,
    cursor: raw?.cursor || DEFAULT_CLI_TEMPLATES.cursor,
  }
}

export function loadSettings(userDataPath: string): HubSettings {
  const filePath = path.join(userDataPath, 'hub-settings.json')
  const defaults = createDefaultSettings()
  try {
    if (!fs.existsSync(filePath)) {
      return defaults
    }
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<HubSettings>
    const shellCandidate = parsed.defaultShell || defaults.defaultShell
    const defaultShellPath =
      path.isAbsolute(shellCandidate) && fs.existsSync(shellCandidate)
        ? shellCandidate
        : defaults.defaultShell

    return {
      projectsRoot: parsed.projectsRoot || defaults.projectsRoot,
      defaultShell: defaultShellPath,
      cliTemplates: normalizeCliTemplates(parsed.cliTemplates),
      spotifyClientId: parsed.spotifyClientId || defaults.spotifyClientId,
      soundcloudClientId: parsed.soundcloudClientId || defaults.soundcloudClientId,
      soundcloudClientSecret: parsed.soundcloudClientSecret || defaults.soundcloudClientSecret,
      discordRichPresence: Boolean(parsed.discordRichPresence),
      discordClientId: parsed.discordClientId || defaults.discordClientId,
      discordLargeImageKey: parsed.discordLargeImageKey || defaults.discordLargeImageKey,
    }
  } catch {
    return defaults
  }
}

export function saveSettings(userDataPath: string, settings: HubSettings): void {
  const filePath = path.join(userDataPath, 'hub-settings.json')
  fs.mkdirSync(userDataPath, { recursive: true })
  const normalized: HubSettings = {
    ...settings,
    cliTemplates: normalizeCliTemplates(settings.cliTemplates),
  }
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf8')
}
