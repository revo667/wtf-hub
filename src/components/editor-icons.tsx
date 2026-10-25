import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

type IconProps = SVGProps<SVGSVGElement> & {
  className?: string
}

function BaseIcon({ className, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconEditor({ className, ...props }: IconProps) {
  return (
    <BaseIcon className={className} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm0 1.5L18.5 8H14V3.5zM8 13h8v1.5H8V13zm0 3h5v1.5H8V16z" />
    </BaseIcon>
  )
}

export function IconNewFile({ className, ...props }: IconProps) {
  return (
    <BaseIcon className={className} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7.25a1 1 0 1 0 0-2H6V4h7v4a1 1 0 0 0 1 1h4v2.25a1 1 0 1 0 2 0V8.83a2 2 0 0 0-.59-1.41l-4.83-4.83A2 2 0 0 0 14 2zm1 5V4.41L17.59 7H15z" />
      <path d="M18 14a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2h-2a1 1 0 1 1 0-2h2v-2a1 1 0 0 1 1-1z" />
    </BaseIcon>
  )
}

export function IconOpen({ className, ...props }: IconProps) {
  return (
    <BaseIcon className={className} {...props}>
      <path d="M10.41 4.41A2 2 0 0 0 9 4H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h16a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-8.17l-1.42-1.59zM4 6h5l1.5 1.5H4V6zm0 3.5h7.17l1.42 1.5H20v9H4v-10.5z" />
    </BaseIcon>
  )
}

export function IconSave({ className, ...props }: IconProps) {
  return (
    <BaseIcon className={className} {...props}>
      <path d="M17.59 3.59A2 2 0 0 0 16.17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7.83a2 2 0 0 0-.59-1.41l-2.82-2.83zM15 5v3H7V5h8zm2 14H7v-4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4z" />
    </BaseIcon>
  )
}

export function IconSaveAs({ className, ...props }: IconProps) {
  return (
    <BaseIcon className={className} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7a1 1 0 1 0 0-2H6V4h7v3a1 1 0 0 0 1 1h3v1.5a1 1 0 1 0 2 0V7.83a2 2 0 0 0-.59-1.41L14.59 2.6A2 2 0 0 0 14 2zm1 5V4.41L17.59 7H15z" />
      <path d="M16.3 13.3a1 1 0 0 1 1.4 0l3 3a1 1 0 0 1-1.4 1.4L18 16.42V21a1 1 0 1 1-2 0v-4.58l-1.3 1.28a1 1 0 0 1-1.4-1.42l3-3z" />
    </BaseIcon>
  )
}

export function IconFile({ className, ...props }: IconProps) {
  return (
    <BaseIcon className={className} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4.5 6H14V3.5L18.5 8z" />
    </BaseIcon>
  )
}

export function IconCursor({ className, ...props }: IconProps) {
  return (
    <BaseIcon className={className} {...props}>
      <path d="M5.5 3.2a1 1 0 0 1 1.05-.08l12.5 7a1 1 0 0 1-.12 1.82l-4.9 1.64 1.64 4.9a1 1 0 0 1-1.82.12l-7-12.5A1 1 0 0 1 5.5 3.2zm1.7 2.05 5.6 10-.95-2.85a1 1 0 0 1 .63-1.25l2.85-.95-8.13-4.55z" />
    </BaseIcon>
  )
}

export function IconCode({ className, ...props }: IconProps) {
  return (
    <BaseIcon className={className} {...props}>
      <path d="M8.7 7.3a1 1 0 0 1 0 1.4L6.42 11l2.3 2.3a1 1 0 1 1-1.42 1.4l-3-3a1 1 0 0 1 0-1.4l3-3a1 1 0 0 1 1.4 0zm6.6 0a1 1 0 0 1 1.4 0l3 3a1 1 0 0 1 0 1.4l-3 3a1 1 0 0 1-1.4-1.4l2.3-2.3-2.3-2.3a1 1 0 0 1 0-1.4zM13.1 6.2a1 1 0 0 1 .8 1.15l-2 10a1 1 0 1 1-1.96-.4l2-10a1 1 0 0 1 1.16-.75z" />
    </BaseIcon>
  )
}

export function IconSaved({ className, ...props }: IconProps) {
  return (
    <BaseIcon className={className} {...props}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.7 7.3a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4 0l-2.5-2.5a1 1 0 1 1 1.4-1.4l1.8 1.79 4.3-4.29a1 1 0 0 1 1.4 0z" />
    </BaseIcon>
  )
}

export function IconDirty({ className, ...props }: IconProps) {
  return (
    <BaseIcon className={className} {...props}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2h-3v3a1 1 0 1 1-2 0v-3H8a1 1 0 1 1 0-2h3V8a1 1 0 0 1 1-1z" />
    </BaseIcon>
  )
}
