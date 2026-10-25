import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { bashPs1, zshPrompt } from '../shared/prompt'

export function ensureHubShellInit(userDataPath: string): {
  bashRc: string
  zshDir: string
} {
  const dir = path.join(userDataPath, 'shell')
  fs.mkdirSync(dir, { recursive: true })

  const bashRc = path.join(dir, 'hub.bashrc')
  fs.writeFileSync(
    bashRc,
    [
      '#!/usr/bin/env bash',
      'if [ -f /etc/bashrc ]; then . /etc/bashrc; fi',
      'if [ -f "$HOME/.bashrc" ]; then . "$HOME/.bashrc"; fi',
      `PS1='${bashPs1()}'`,
      '',
    ].join('\n'),
    'utf8',
  )

  const zshDir = path.join(dir, 'zdotdir')
  fs.mkdirSync(zshDir, { recursive: true })
  fs.writeFileSync(
    path.join(zshDir, '.zshrc'),
    [
      '#!/usr/bin/env zsh',
      '[[ -f /etc/zshrc ]] && source /etc/zshrc',
      '[[ -f "$HOME/.zshrc" ]] && source "$HOME/.zshrc"',
      `PROMPT=$'${zshPrompt()}'`,
      '',
    ].join('\n'),
    'utf8',
  )

  return { bashRc, zshDir }
}

export function shellIdentity(): { user: string; host: string; home: string } {
  return {
    user: os.userInfo().username || 'user',
    host: os.hostname().replace(/\.local$/i, '') || 'host',
    home: os.homedir(),
  }
}
