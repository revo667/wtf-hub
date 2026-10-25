import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import type { Extension } from '@codemirror/state'

export function languageForFile(name: string): Extension | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.json')) return json()
  if (lower.endsWith('.py')) return python()
  if (lower.endsWith('.md') || lower.endsWith('.mdx')) return markdown()
  if (lower.endsWith('.css') || lower.endsWith('.scss')) return css()
  if (lower.endsWith('.html') || lower.endsWith('.htm') || lower.endsWith('.xml')) return html()
  if (
    lower.endsWith('.js') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.mjs') ||
    lower.endsWith('.cjs') ||
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx')
  ) {
    return javascript({
      typescript: lower.endsWith('.ts') || lower.endsWith('.tsx'),
      jsx: lower.endsWith('.jsx') || lower.endsWith('.tsx'),
    })
  }
  return null
}
