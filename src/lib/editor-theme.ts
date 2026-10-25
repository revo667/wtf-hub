import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

export const hubEditorTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      backgroundColor: 'transparent',
      color: '#d6dbd6',
      fontSize: '13px',
    },
    '.cm-scroller': {
      fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace',
      lineHeight: '1.45',
    },
    '.cm-content': {
      caretColor: '#6f9476',
      paddingTop: '8px',
      paddingBottom: '8px',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#6f9476',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(111, 148, 118, 0.28)',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(111, 148, 118, 0.06)',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent !important',
      color: 'rgba(158, 181, 162, 0.45)',
      border: 'none',
      borderRight: 'none',
      boxShadow: 'none',
    },
    '.cm-gutter': {
      backgroundColor: 'transparent !important',
    },
    '.cm-gutter.cm-lineNumbers': {
      backgroundColor: 'transparent !important',
    },
    '.cm-gutterElement': {
      backgroundColor: 'transparent !important',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent !important',
      color: 'rgba(158, 181, 162, 0.9)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      minWidth: '1.35rem',
      paddingLeft: '4px',
      paddingRight: '6px',
      fontSize: '10px',
      opacity: '0.7',
      lineHeight: 'inherit',
    },
    '.cm-panels': {
      backgroundColor: 'rgba(14, 18, 14, 0.85)',
      color: '#d6dbd6',
    },
    '.cm-searchMatch': {
      backgroundColor: 'rgba(163, 154, 114, 0.35)',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'rgba(111, 148, 118, 0.45)',
    },
    '.cm-tooltip': {
      backgroundColor: 'rgba(18, 24, 18, 0.95)',
      border: '1px solid rgba(160, 180, 160, 0.18)',
    },
  },
  { dark: true },
)

const hubHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#8fb396' },
  { tag: t.string, color: '#c4b48a' },
  { tag: t.number, color: '#b7c9b8' },
  { tag: t.comment, color: '#6b736b', fontStyle: 'italic' },
  { tag: t.function(t.variableName), color: '#9eb5a2' },
  { tag: t.variableName, color: '#d6dbd6' },
  { tag: t.typeName, color: '#a3b89f' },
  { tag: t.className, color: '#a3b89f' },
  { tag: t.propertyName, color: '#b8c7b4' },
  { tag: t.operator, color: '#8a958a' },
  { tag: t.bool, color: '#8fb396' },
  { tag: t.null, color: '#8fb396' },
  { tag: t.heading, color: '#9eb5a2', fontWeight: 'bold' },
  { tag: t.link, color: '#8fb396' },
  { tag: t.meta, color: '#7e877e' },
])

export const hubSyntax = syntaxHighlighting(hubHighlight)
