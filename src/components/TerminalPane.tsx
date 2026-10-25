import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { ClipboardPaste, Copy, Delete, Eraser, Scissors, TextSelect } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ContextMenu, useContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import { getHub } from '@/lib/hub-client'

type TerminalPaneProps = {
  cwd: string
  ptyId: string | null
  active: boolean
  onBindPty: (ptyId: string) => void
}

function editableSelection(term: Terminal) {
  const range = term.getSelectionPosition()
  if (!range) return null
  const buffer = term.buffer.active
  const cursorRow = buffer.baseY + buffer.cursorY
  if (range.start.y !== cursorRow || range.end.y !== cursorRow) return null
  return { start: range.start.x, end: range.end.x, cursor: buffer.cursorX }
}

function eraseSelection(term: Terminal, write: (data: string) => void) {
  const range = editableSelection(term)
  if (!range || range.end <= range.start) return
  const shift = range.end - range.cursor
  const move = shift > 0 ? '\x1b[C'.repeat(shift) : '\x1b[D'.repeat(-shift)
  write(move + '\x7f'.repeat(range.end - range.start))
  term.clearSelection()
}

async function copySelection(term: Terminal) {
  const text = term.getSelection()
  if (!text) return
  await navigator.clipboard.writeText(text)
}

function writeToPty(ptyId: string | null, data: string) {
  if (ptyId) void getHub().pty.write(ptyId, data)
}

export function TerminalPane({ cwd, ptyId, active, onBindPty }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const ptyIdRef = useRef<string | null>(ptyId)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { menu, open: openMenu, close: closeMenu } = useContextMenu()

  useEffect(() => {
    ptyIdRef.current = ptyId
  }, [ptyId])

  useEffect(() => {
    const hub = getHub()
    const offData = hub.pty.onData(({ id, data }) => {
      if (id === ptyIdRef.current) {
        termRef.current?.write(data)
      }
    })
    const offExit = hub.pty.onExit(({ id }) => {
      if (id === ptyIdRef.current) {
        termRef.current?.writeln('\r\n\x1b[90m[process exited]\x1b[0m')
      }
    })
    return () => {
      offData()
      offExit()
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current || termRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      allowTransparency: true,
      theme: {
        background: 'rgba(0, 0, 0, 0)',
        foreground: '#d6dbd6',
        cursor: '#6f9476',
        cursorAccent: 'rgba(0, 0, 0, 0)',
        selectionBackground: 'rgba(111, 148, 118, 0.28)',
        black: '#1a221a',
        red: '#b86b6b',
        green: '#6f9476',
        yellow: '#a39a72',
        blue: '#6b756b',
        magenta: '#7e877e',
        cyan: '#5f8a68',
        white: '#d6dbd6',
        brightBlack: '#6b736b',
        brightRed: '#c98888',
        brightGreen: '#6f9a78',
        brightYellow: '#b8ae86',
        brightBlue: '#8a958a',
        brightMagenta: '#9aa39a',
        brightCyan: '#7aaa82',
        brightWhite: '#e8ebe8',
      },
      allowProposedApi: true,
      rightClickSelectsWord: false,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(containerRef.current)
    fit.fit()

    const write = (data: string) => writeToPty(ptyIdRef.current, data)

    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown' || !event.metaKey) return true
      const key = event.key.toLowerCase()
      if (key === 'k') {
        term.clear()
        return false
      }
      if (key === 'c' && term.hasSelection()) {
        void copySelection(term)
        return false
      }
      if (key === 'x' && term.hasSelection()) {
        void copySelection(term).then(() => eraseSelection(term, write))
        return false
      }
      return true
    })

    const container = containerRef.current
    const onContextMenu = (event: MouseEvent) => {
      const hasSelection = term.hasSelection()
      const canEdit = Boolean(ptyIdRef.current)
      const editable = hasSelection && editableSelection(term) !== null
      const items: ContextMenuItem[] = [
        {
          label: 'Copy',
          icon: Copy,
          shortcut: '⌘C',
          disabled: !hasSelection,
          onSelect: () => {
            void copySelection(term)
          },
        },
        {
          label: 'Cut',
          icon: Scissors,
          shortcut: '⌘X',
          disabled: !editable || !canEdit,
          onSelect: () => {
            void copySelection(term).then(() => eraseSelection(term, write))
          },
        },
        {
          label: 'Paste',
          icon: ClipboardPaste,
          shortcut: '⌘V',
          disabled: !canEdit,
          onSelect: () => {
            void navigator.clipboard.readText().then((text) => {
              if (text) term.paste(text)
            })
          },
        },
        {
          label: editable ? 'Delete' : 'Delete line',
          icon: Delete,
          disabled: !canEdit || (hasSelection && !editable),
          onSelect: () => {
            if (editable) eraseSelection(term, write)
            else write('\x05\x15')
          },
        },
        { type: 'separator' },
        { label: 'Select all', icon: TextSelect, onSelect: () => term.selectAll() },
        { label: 'Clear terminal', icon: Eraser, shortcut: '⌘K', onSelect: () => term.clear() },
      ]
      openMenu(event, items)
    }
    container.addEventListener('contextmenu', onContextMenu, true)

    term.onData((data) => {
      const id = ptyIdRef.current
      if (!id) return
      void getHub().pty.write(id, data)
    })

    termRef.current = term
    fitRef.current = fit
    setReady(true)

    const observer = new ResizeObserver(() => {
      fit.fit()
      const id = ptyIdRef.current
      if (id) {
        void getHub().pty.resize(id, term.cols, term.rows)
      }
    })
    observer.observe(containerRef.current)

    return () => {
      container.removeEventListener('contextmenu', onContextMenu, true)
      observer.disconnect()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [openMenu])

  useEffect(() => {
    if (!ready || !termRef.current || !fitRef.current) return
    if (ptyId) {
      fitRef.current.fit()
      void getHub().pty.resize(ptyId, termRef.current.cols, termRef.current.rows)
      if (active) termRef.current.focus()
      return
    }

    let cancelled = false
    const start = async () => {
      setError(null)
      fitRef.current?.fit()
      const term = termRef.current
      if (!term) return
      try {
        const { id } = await getHub().pty.create({
          cwd,
          cols: term.cols,
          rows: term.rows,
        })
        if (cancelled) {
          void getHub().pty.dispose(id)
          return
        }
        term.reset()
        ptyIdRef.current = id
        onBindPty(id)
        if (active) term.focus()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start terminal')
      }
    }
    void start()
    return () => {
      cancelled = true
    }
  }, [ready, ptyId, cwd, onBindPty, active])

  useEffect(() => {
    if (active) termRef.current?.focus()
  }, [active])

  return (
    <div className="terminal-glass relative h-full min-h-0">
      {error && (
        <div className="absolute inset-x-0 top-0 z-10 border-b border-[var(--hypr-danger)]/40 bg-[color-mix(in_oklab,var(--hypr-danger)_12%,transparent)] px-3 py-2 font-mono text-xs text-[var(--hypr-danger)]">
          {error}
        </div>
      )}
      <div ref={containerRef} className="terminal-host h-full w-full p-2" />
      <ContextMenu
        menu={menu}
        onClose={() => {
          closeMenu()
          termRef.current?.focus()
        }}
      />
    </div>
  )
}
