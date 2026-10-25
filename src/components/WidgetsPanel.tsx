import { Cpu, FolderKanban, Settings2, TerminalSquare } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isElectronRuntime } from '@/lib/hub-client'

type WidgetsPanelProps = {
  workspaceCount: number
  terminalCount: number
  activeProjectName: string | null
  onOpenSettings: () => void
}

function useClock(): string {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now)
}

export function WidgetsPanel({
  workspaceCount,
  terminalCount,
  activeProjectName,
  onOpenSettings,
}: WidgetsPanelProps) {
  const clock = useClock()
  const mode = isElectronRuntime() ? 'electron' : 'preview'

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <p className="font-mono text-[10px] tracking-wide text-[var(--hypr-muted)] uppercase">
          Clock
        </p>
        <p className="mt-1 font-display text-xl text-[var(--hypr-fg)]">{clock}</p>
        <p className="mt-1 font-mono text-[10px] text-[var(--hypr-accent)] uppercase">{mode}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <p className="mb-2 font-mono text-[10px] tracking-wide text-[var(--hypr-muted)] uppercase">
          Session
        </p>
        <ul className="space-y-2 font-mono text-xs text-[var(--hypr-fg)]">
          <li className="flex items-center gap-2">
            <FolderKanban className="size-3.5 text-[var(--hypr-accent)]" />
            {workspaceCount} projects
          </li>
          <li className="flex items-center gap-2">
            <TerminalSquare className="size-3.5 text-[var(--hypr-accent-2)]" />
            {terminalCount} terminals
          </li>
          <li className="flex items-center gap-2">
            <Cpu className="size-3.5 text-[var(--hypr-accent-3)]" />
            <span className="truncate text-[var(--hypr-accent)]">
              {activeProjectName ?? 'no project'}
            </span>
          </li>
        </ul>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <p className="mb-2 font-mono text-[10px] tracking-wide text-[var(--hypr-muted)] uppercase">
          Binds
        </p>
        <ul className="space-y-1.5 font-mono text-[11px] text-[var(--hypr-muted)]">
          <li>
            <span className="text-[var(--hypr-accent)]">A</span> projects
          </li>
          <li>
            <span className="text-[var(--hypr-accent)]">W</span> new terminal
          </li>
          <li>
            <span className="text-[var(--hypr-accent)]">S</span> AI CLIs
          </li>
          <li>
            <span className="text-[var(--hypr-accent)]">D</span> widgets
          </li>
          <li>
            <span className="text-[var(--hypr-accent)]">Q</span> close (spam Q Q Q)
          </li>
        </ul>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-[var(--hypr-muted)]">
          Terminaldayken W/A/S/D için Super/Alt · Q her zaman kapatır
        </p>
      </div>

      <button
        type="button"
        className="hypr-chip mt-auto justify-center"
        onClick={onOpenSettings}
      >
        <Settings2 className="size-3.5" />
        Settings
      </button>
    </div>
  )
}
