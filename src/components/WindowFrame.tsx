import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type WindowFrameProps = {
  id: string
  title: string
  focused: boolean
  children: ReactNode
  className?: string
  compact?: boolean
  hideChrome?: boolean
  /** Solid icon instead of the title text */
  titleIcon?: ReactNode
  onFocus: (id: string) => void
  onClose: (id: string) => void
  onHover: (id: string | null) => void
}

export function WindowFrame({
  id,
  title,
  focused,
  children,
  className,
  compact = false,
  hideChrome = false,
  titleIcon,
  onFocus,
  onClose,
  onHover,
}: WindowFrameProps) {
  return (
    <section
      data-window-id={id}
      className={cn(
        'hypr-tile flex min-h-0 min-w-0 flex-col overflow-hidden',
        focused && 'hypr-tile-active',
        compact && 'hypr-tile-compact',
        className,
      )}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onMouseDown={() => onFocus(id)}
    >
      {!hideChrome && (
        <div
          className={cn(
            'flex items-center gap-2 border-b border-white/8',
            compact ? 'px-2.5 py-1' : 'px-3 py-1.5',
          )}
        >
          <span
            className={cn(
              'rounded-full',
              compact ? 'size-1.5' : 'size-2',
              focused ? 'bg-[var(--hypr-accent)]' : 'bg-[var(--hypr-muted)]',
            )}
          />
          <div className="flex min-w-0 flex-1 items-center">
            {titleIcon ? (
              <span
                className={cn(
                  'inline-flex items-center',
                  focused ? 'text-[var(--hypr-accent)]' : 'text-[var(--hypr-fg)]/80',
                )}
                title={title}
                aria-label={title}
              >
                {titleIcon}
              </span>
            ) : (
              <p
                className={cn(
                  'min-w-0 flex-1 truncate font-mono text-[var(--hypr-muted)]',
                  compact ? 'text-[10px]' : 'text-[11px]',
                )}
              >
                <span className={focused ? 'text-[var(--hypr-accent)]' : 'text-[var(--hypr-fg)]'}>
                  {title}
                </span>
              </p>
            )}
          </div>
          <button
            type="button"
            className={cn(
              'rounded-full text-[var(--hypr-muted)] hover:bg-white/8 hover:text-[var(--hypr-fg)]',
              compact ? 'p-0.5' : 'p-1',
            )}
            onClick={(event) => {
              event.stopPropagation()
              onClose(id)
            }}
            aria-label={`Close ${title}`}
          >
            <X className={compact ? 'size-3' : 'size-3.5'} />
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}
