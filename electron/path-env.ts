import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Extra dirs where user-installed AI CLIs often live */
export function extraBinDirs(): string[] {
  const home = os.homedir()
  const dirs = [
    path.join(home, '.local', 'bin'),
    path.join(home, '.npm-global', 'bin'),
    path.join(home, '.nvm', 'current', 'bin'),
    path.join(home, 'bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
  ]

  const nvmVersions = path.join(home, '.nvm', 'versions', 'node')
  try {
    if (fs.existsSync(nvmVersions)) {
      const versions = fs
        .readdirSync(nvmVersions)
        .filter((name) => !name.startsWith('.'))
        .sort()
        .reverse()
      for (const version of versions.slice(0, 3)) {
        dirs.push(path.join(nvmVersions, version, 'bin'))
      }
    }
  } catch {
    // ignore
  }

  return dirs.filter((dir) => {
    try {
      return fs.existsSync(dir)
    } catch {
      return false
    }
  })
}

export function enrichedPath(base = process.env.PATH || ''): string {
  const parts = [...extraBinDirs(), ...base.split(path.delimiter).filter(Boolean)]
  return [...new Set(parts)].join(path.delimiter)
}
