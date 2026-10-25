import { useEffect, useState } from 'react'

type EmptyDesktopProps = {
  visible: boolean
}

function useClock(): string {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)
}

export function EmptyDesktop({ visible }: EmptyDesktopProps) {
  const clock = useClock()
  if (!visible) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
      <div className="hypr-rise-2 text-center">
        <p className="font-display text-4xl font-semibold tracking-[0.18em] text-white/85">
          WTF HUB
        </p>
        <p className="mt-3 font-mono text-xs tracking-[0.18em] text-white/40">{clock}</p>
      </div>
    </div>
  )
}
