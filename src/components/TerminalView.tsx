import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getHub } from '@/lib/hub-client'
import { cn } from '@/lib/utils'

export type TerminalTab = {
  id: string
  title: string
  cwd: string
  ptyId: string | null
}

type TerminalViewProps = {
  tabs: TerminalTab[]
  activeTabId: string | null
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  onCreateTab: () => void
  onBindPty: (tabId: string, ptyId: string) => void
  onResetPtys: () => void
}

export function TerminalView({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCreateTab,
  onBindPty,
  onResetPtys,
}: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const activePtyRef = useRef<string | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hub = getHub()
    const offData = hub.pty.onData(({ id, data }) => {
      if (id === activePtyRef.current) {
        termRef.current?.write(data)
      }
    })
    const offExit = hub.pty.onExit(({ id }) => {
      if (id === activePtyRef.current) {
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
      theme: {
        background: '#00000000',
        foreground: '#d6dbd6',
        cursor: '#6f9476',
        cursorAccent: '#0e120e',
        selectionBackground: '#6f947644',
        black: '#0e120e',
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
      const ptyId = activePtyRef.current
      if (!ptyId) return
      void getHub().pty.write(ptyId, data)
    })

    termRef.current = term
    fitRef.current = fit
    setReady(true)

    const observer = new ResizeObserver(() => {
      fit.fit()
      const ptyId = activePtyRef.current
      if (ptyId) {
        void getHub().pty.resize(ptyId, term.cols, term.rows)
      }
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      term.dispose()
      termRef.current = null
      fitRef.current = null
      activePtyRef.current = null
      onResetPtys()
    }
  }, [onResetPtys])

  useEffect(() => {
    const tab = tabs.find((item) => item.id === activeTabId)
    if (!tab || !ready || !termRef.current || !fitRef.current) return

    let cancelled = false

    const attach = async () => {
      setError(null)
      fitRef.current?.fit()
      const term = termRef.current
      if (!term) return

      if (tab.ptyId) {
        activePtyRef.current = tab.ptyId
        void getHub().pty.resize(tab.ptyId, term.cols, term.rows)
        return
      }

      try {
        const { id } = await getHub().pty.create({
          cwd: tab.cwd,
          cols: term.cols,
          rows: term.rows,
        })
        if (cancelled) {
          void getHub().pty.dispose(id)
          return
        }
        term.reset()
        activePtyRef.current = id
        onBindPty(tab.id, id)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start terminal'
        setError(message)
      }
    }

    void attach()

    return () => {
      cancelled = true
    }
  }, [activeTabId, tabs, ready, onBindPty])

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null

  return (
    <section className="hypr-tile hypr-tile-active hypr-rise-3 flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center gap-1 border-b border-white/8 px-2.5 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {tabs.map((tab) => {
            const active = tab.id === activeTabId
            return (
              <div
                key={tab.id}
                className={cn(
                  'group flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors',
                  active
                    ? 'border-[var(--hypr-accent)]/50 bg-[var(--hypr-accent)]/10 text-[var(--hypr-accent)]'
                    : 'border-transparent text-[var(--hypr-muted)] hover:border-white/10 hover:bg-white/5 hover:text-[var(--hypr-fg)]',
                )}
              >
                <button type="button" onClick={() => onSelectTab(tab.id)} className="max-w-[140px] truncate">
                  {tab.title}
                </button>
                <button
                  type="button"
                  className="rounded-full p-0.5 opacity-50 hover:bg-white/10 hover:opacity-100"
                  onClick={() => onCloseTab(tab.id)}
                  aria-label={`Close ${tab.title}`}
                >
                  <X className="size-3" />
                </button>
              </div>
            )
          })}
        </div>
        <button
          type="button"
          onClick={onCreateTab}
          title="New terminal tab"
          className="hypr-chip size-8 justify-center px-0"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 bg-[rgba(10,14,10,0.55)]">
        {!activeTab && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="text-center">
              <p className="font-display text-lg font-medium text-[var(--hypr-fg)]">No terminal session</p>
              <p className="mt-1 font-mono text-xs text-[var(--hypr-muted)]">
                Select a project or open a new terminal tab.
              </p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-x-0 top-0 z-10 border-b border-[var(--hypr-danger)]/40 bg-[color-mix(in_oklab,var(--hypr-danger)_12%,transparent)] px-3 py-2 font-mono text-xs text-[var(--hypr-danger)]">
            {error}
          </div>
        )}
        <div ref={containerRef} className="h-full w-full p-3" />
      </div>
    </section>
  )
}
