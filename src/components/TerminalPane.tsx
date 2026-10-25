import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { useEffect, useRef, useState } from 'react'
import { getHub } from '@/lib/hub-client'

type TerminalPaneProps = {
  cwd: string
  ptyId: string | null
  active: boolean
  onBindPty: (ptyId: string) => void
}

export function TerminalPane({ cwd, ptyId, active, onBindPty }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const ptyIdRef = useRef<string | null>(ptyId)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(containerRef.current)
    fit.fit()

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
      observer.disconnect()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [])

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
    </div>
  )
}
