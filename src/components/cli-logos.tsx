import { cn } from '@/lib/utils'

const LOGO_SRC: Record<string, string> = {
  claude: '/logos/claude.svg',
  antigravity: '/logos/antigravity.png',
  cursor: '/logos/cursor.svg',
}

export function CliLogo({ id, className }: { id: string; className?: string }) {
  const src = LOGO_SRC[id]
  if (!src) return null

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={cn('cli-logo-img size-5 object-contain select-none', `cli-logo-img-${id}`, className)}
    />
  )
}
