import fs from 'node:fs'
import path from 'node:path'
import type { ProjectFileEntry } from '../shared/types'

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-electron',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '.cache',
  'target',
  'vendor',
  '__pycache__',
  '.venv',
  'venv',
])

const MAX_FILES = 80
const MAX_DEPTH = 3

export function listProjectFiles(root: string): ProjectFileEntry[] {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return []
  }

  const out: ProjectFileEntry[] = []

  const walk = (dir: string, depth: number) => {
    if (out.length >= MAX_FILES || depth > MAX_DEPTH) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    entries.sort((a, b) => a.name.localeCompare(b.name))

    for (const entry of entries) {
      if (out.length >= MAX_FILES) break
      if (entry.name.startsWith('.') && entry.name !== '.env' && entry.name !== '.env.example') {
        if (entry.isDirectory()) continue
      }
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        walk(path.join(dir, entry.name), depth + 1)
        continue
      }
      if (!entry.isFile()) continue

      const filePath = path.join(dir, entry.name)
      out.push({
        name: entry.name,
        path: filePath,
        relative: path.relative(root, filePath).split(path.sep).join('/'),
      })
    }
  }

  walk(root, 0)
  return out
}

export function readTextFile(filePath: string): { ok: boolean; content?: string; error?: string } {
  try {
    if (!fs.existsSync(filePath)) {
      return { ok: false, error: 'File not found' }
    }
    return { ok: true, content: fs.readFileSync(filePath, 'utf8') }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to read file' }
  }
}
