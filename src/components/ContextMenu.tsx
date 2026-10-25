import type { LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export type ContextMenuItem =
  | {
      type?: 'item'
      label: string
      icon?: LucideIcon
      shortcut?: string
      danger?: boolean
      disabled?: boolean
      confirmLabel?: string
      onSelect: () => void
    }
  | { type: 'separator' }
  | { type: 'label'; label: string }

export type ContextMenuState = {
  x: number
  y: number
  items: ContextMenuItem[]
}

const EDGE = 8

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState | null>(null)

  const open = useCallback((event: { clientX: number; clientY: number; preventDefault: () => void; stopPropagation: () => void }, items: ContextMenuItem[]) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, items })
  }, [])

  const close = useCallback(() => setMenu(null), [])

  return { menu, open, close }
}

export function ContextMenu({ menu, onClose }: { menu: ContextMenuState | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [armed, setArmed] = useState<number | null>(null)
  const [cursor, setCursor] = useState<number>(-1)

  useLayoutEffect(() => {
    setArmed(null)
    setCursor(-1)
    if (!menu || !ref.current) {
      setPos(null)
      return
    }
    const rect = ref.current.getBoundingClientRect()
    const left = Math.min(menu.x, window.innerWidth - rect.width - EDGE)
    const top =
      menu.y + rect.height + EDGE > window.innerHeight
        ? Math.max(EDGE, menu.y - rect.height)
        : menu.y
    setPos({ left: Math.max(EDGE, left), top })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const onPointer = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return
      onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      const actionable = menu.items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => (item.type ?? 'item') === 'item' && !('disabled' in item && item.disabled))
        .map(({ index }) => index)
      if (actionable.length === 0) return
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setCursor((current) => {
          const at = actionable.indexOf(current)
          const step = event.key === 'ArrowDown' ? 1 : -1
          const next = at === -1 ? (step === 1 ? 0 : actionable.length - 1) : (at + step + actionable.length) % actionable.length
          return actionable[next]
        })
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        ref.current?.querySelector<HTMLButtonElement>(`[data-index="${cursor}"]`)?.click()
      }
    }
    const onDismiss = () => onClose()
    window.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', onDismiss)
    window.addEventListener('resize', onDismiss)
    window.addEventListener('wheel', onDismiss, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', onDismiss)
      window.removeEventListener('resize', onDismiss)
      window.removeEventListener('wheel', onDismiss)
    }
  }, [menu, onClose, cursor])

  if (!menu) return null

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="hypr-menu"
      style={{
        left: pos?.left ?? menu.x,
        top: pos?.top ?? menu.y,
        visibility: pos ? 'visible' : 'hidden',
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {menu.items.map((item, index) => {
        if (item.type === 'separator') {
          return <div key={index} className="hypr-menu-separator" />
        }
        if (item.type === 'label') {
          return (
            <div key={index} className="hypr-menu-label">
              {item.label}
            </div>
          )
        }
        const Icon = item.icon
        const isArmed = armed === index
        return (
          <button
            key={index}
            type="button"
            role="menuitem"
            data-index={index}
            disabled={item.disabled}
            className={cn(
              'hypr-menu-item',
              item.danger && 'hypr-menu-item-danger',
              isArmed && 'hypr-menu-item-armed',
              cursor === index && 'hypr-menu-item-cursor',
            )}
            onPointerEnter={() => setCursor(index)}
            onClick={() => {
              if (item.confirmLabel && !isArmed) {
                setArmed(index)
                return
              }
              onClose()
              item.onSelect()
            }}
          >
            <span className="flex size-4 items-center justify-center">
              {Icon && <Icon className="size-3.5" />}
            </span>
            <span className="flex-1 truncate">{isArmed ? item.confirmLabel : item.label}</span>
            {item.shortcut && <span className="hypr-menu-shortcut">{item.shortcut}</span>}
          </button>
        )
      })}
    </div>,
    document.body,
  )
}
