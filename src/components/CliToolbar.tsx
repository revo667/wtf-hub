import type { CliTool } from '@shared/types'
import { CliLogo } from '@/components/cli-logos'
import { cn } from '@/lib/utils'

type CliToolbarProps = {
  tools: CliTool[]
  onLaunchCli: (tool: CliTool) => void
}

export function CliToolbar({ tools, onLaunchCli }: CliToolbarProps) {
  return (
    <div className="flex items-center gap-1.5 px-1.5 pb-1.5 pt-0.5">
      {tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          onClick={() => onLaunchCli(tool)}
          title={
            tool.available
              ? `${tool.label} · ${tool.command}`
              : `${tool.label} not detected on PATH — still sends \`${tool.command}\``
          }
          aria-label={tool.label}
          className={cn(
            'cli-logo-btn',
            tool.available ? 'cli-logo-btn-live' : 'cli-logo-btn-missing',
            `cli-logo-btn-${tool.id}`,
          )}
        >
          <CliLogo id={tool.id} className="size-5" />
        </button>
      ))}
    </div>
  )
}
