import { Cpu, FolderKanban, TerminalSquare } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isElectronRuntime } from '@/lib/hub-client'

type TopBarProps = {
  activeProjectName: string | null
  workspaceCount: number
  terminalCount: number
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
  }).format(now)
}

export function TopBar({ activeProjectName, workspaceCount, terminalCount }: TopBarProps) {
  const mode = isElectronRuntime() ? 'electron' : 'preview'
  const clock = useClock()

  return (
    <header className="hypr-tile hypr-waybar">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--hypr-accent)] opacity-40" />
            <span className="relative inline-flex size-2.5 rounded-full bg-[var(--hypr-accent)]" />
          </span>
          <span className="font-display text-[15px] font-semibold tracking-[0.14em] text-[var(--hypr-fg)]">
            WTF HUB
          </span>
        </div>

        <div className="flex items-center gap-2 px-1">
          {[1, 2, 3, 4].map((workspace) => (
            <span
              key={workspace}
              className={workspace === 1 ? 'hypr-ws hypr-ws-active' : 'hypr-ws'}
              aria-hidden
            />
          ))}
        </div>
      </div>

      <div className="mx-auto hidden items-center gap-2 md:flex">
        <div className="hypr-module">
          <FolderKanban className="size-3.5 text-[var(--hypr-accent)]" />
          <span>
            <span className="text-[var(--hypr-fg)]">{workspaceCount}</span> projects
          </span>
        </div>
        <div className="hypr-module">
          <TerminalSquare className="size-3.5 text-[var(--hypr-accent-2)]" />
          <span>
            <span className="text-[var(--hypr-fg)]">{terminalCount}</span> terms
          </span>
        </div>
        <div className="hypr-module max-w-[180px]">
          <Cpu className="size-3.5 text-[var(--hypr-accent-3)]" />
          <span className="truncate text-[var(--hypr-accent)]">
            {activeProjectName ?? 'idle'}
          </span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="hypr-module uppercase tracking-wide">{mode}</div>
        <div className="hypr-module text-[var(--hypr-fg)]">{clock}</div>
      </div>
    </header>
  )
}
