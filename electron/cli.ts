import { execFileSync } from 'node:child_process'
import type { CliTool, HubSettings } from '../shared/types'
import { enrichedPath } from './path-env'

function whichEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: enrichedPath() }
}

const LABELS: Record<string, string> = {
  claude: 'Claude',
  antigravity: 'Antigravity',
  cursor: 'Cursor',
}

const ORDER = ['claude', 'antigravity', 'cursor'] as const

function commandExists(command: string): boolean {
  const binary = command.trim().split(/\s+/)[0]
  if (!binary) return false
  try {
    if (process.platform === 'win32') {
      execFileSync('where', [binary], { stdio: 'ignore', env: whichEnv() })
    } else {
      execFileSync('which', [binary], { stdio: 'ignore', env: whichEnv() })
    }
    return true
  } catch {
    return false
  }
}

function resolveCommand(id: string, configured: string): { command: string; available: boolean } {
  if (commandExists(configured)) {
    return { command: configured, available: true }
  }
  if (id === 'cursor') {
    for (const fallback of ['cursor-agent', 'cursor', 'agent']) {
      if (commandExists(fallback)) {
        return { command: fallback, available: true }
      }
    }
  }
  if (id === 'antigravity') {
    for (const fallback of ['antigravity', 'agy']) {
      if (commandExists(fallback)) {
        return { command: fallback, available: true }
      }
    }
  }
  return { command: configured, available: false }
}

export function detectCliTools(settings: HubSettings): CliTool[] {
  return ORDER.map((id) => {
    const configured = settings.cliTemplates[id] || id
    const resolved = resolveCommand(id, configured)
    return {
      id,
      label: LABELS[id] || id,
      command: resolved.command,
      available: resolved.available,
    }
  })
}

export function findEditorCommand(): string | null {
  const candidates = ['cursor', 'code', 'codium']
  for (const candidate of candidates) {
    if (commandExists(candidate)) return candidate
  }
  return null
}
