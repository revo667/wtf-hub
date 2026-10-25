import * as React from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-sm text-[var(--hypr-fg)] placeholder:text-[var(--hypr-muted)] focus-visible:outline-none focus-visible:border-[var(--hypr-accent)]/60 focus-visible:ring-1 focus-visible:ring-[var(--hypr-accent)]/40',
        className,
      )}
      {...props}
    />
  )
}
