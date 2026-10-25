import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hypr-accent)] disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        default:
          'bg-white/5 text-[var(--hypr-fg)] border border-white/10 hover:border-[var(--hypr-accent)]/50 hover:text-[var(--hypr-accent)] hover:bg-[var(--hypr-accent)]/10',
        accent:
          'bg-[var(--hypr-accent)]/20 text-[#b7c9b8] border border-[var(--hypr-accent)]/50 hover:bg-[var(--hypr-accent)]/30 shadow-[0_0_18px_rgba(79,122,88,0.18)]',
        ghost: 'border border-transparent hover:border-white/10 hover:bg-white/5',
        danger:
          'bg-[var(--hypr-danger)]/15 text-[var(--hypr-danger)] border border-[var(--hypr-danger)]/45',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 px-3 text-xs',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
