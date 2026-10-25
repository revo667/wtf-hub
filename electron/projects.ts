import fs from 'node:fs'
import path from 'node:path'
import type { ProjectInfo } from '../shared/types'

function isDirectory(entryPath: string): boolean {
  try {
    return fs.statSync(entryPath).isDirectory()
  } catch {
    return false
  }
}

function exists(entryPath: string): boolean {
  try {
    fs.accessSync(entryPath)
    return true
  } catch {
    return false
  }
}

export function scanProjects(root: string): ProjectInfo[] {
  if (!exists(root) || !isDirectory(root)) {
    return []
  }

  const entries = fs.readdirSync(root, { withFileTypes: true })
  const projects: ProjectInfo[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue

    const projectPath = path.join(root, entry.name)
    projects.push({
      id: projectPath,
      name: entry.name,
      path: projectPath,
      hasGit: exists(path.join(projectPath, '.git')),
      hasPackageJson: exists(path.join(projectPath, 'package.json')),
      hasReadme:
        exists(path.join(projectPath, 'README.md')) ||
        exists(path.join(projectPath, 'readme.md')),
    })
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name))
}
