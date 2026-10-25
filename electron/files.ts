import { BrowserWindow, dialog } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { OpenFileResult, SaveFileResult } from '../shared/types'

export { listProjectFiles, readTextFile } from './fs-local'

const TEXT_FILTERS = [
  {
    name: 'Text',
    extensions: [
      'txt',
      'md',
      'json',
      'js',
      'ts',
      'tsx',
      'jsx',
      'css',
      'html',
      'py',
      'rs',
      'go',
      'toml',
      'yml',
      'yaml',
      'sh',
    ],
  },
  { name: 'All Files', extensions: ['*'] },
]

export async function openTextFile(
  win: BrowserWindow | null,
  defaultPath?: string,
): Promise<OpenFileResult> {
  const result = win
    ? await dialog.showOpenDialog(win, {
        title: 'Open File',
        defaultPath,
        properties: ['openFile'],
        filters: TEXT_FILTERS,
      })
    : await dialog.showOpenDialog({
        title: 'Open File',
        defaultPath,
        properties: ['openFile'],
        filters: TEXT_FILTERS,
      })

  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true }
  }

  const filePath = result.filePaths[0]
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    return {
      canceled: false,
      path: filePath,
      name: path.basename(filePath),
      content,
    }
  } catch (err) {
    return {
      canceled: false,
      error: err instanceof Error ? err.message : 'Failed to read file',
    }
  }
}

export async function saveTextFile(
  win: BrowserWindow | null,
  options: {
    path?: string | null
    name?: string
    content: string
    defaultPath?: string
  },
): Promise<SaveFileResult> {
  let target = options.path || null

  if (!target) {
    const saveOpts = {
      title: 'Save File',
      defaultPath: options.defaultPath || options.name || 'untitled.txt',
    }
    const result = win
      ? await dialog.showSaveDialog(win, saveOpts)
      : await dialog.showSaveDialog(saveOpts)
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    target = result.filePath
  }

  try {
    fs.writeFileSync(target, options.content, 'utf8')
    return {
      canceled: false,
      path: target,
      name: path.basename(target),
    }
  } catch (err) {
    return {
      canceled: false,
      error: err instanceof Error ? err.message : 'Failed to save file',
    }
  }
}
