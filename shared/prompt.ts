export function shortPath(cwd: string, home?: string): string {
  if (cwd === '~') return '~'
  if (home && (cwd === home || cwd.startsWith(`${home}/`))) {
    return cwd.replace(home, '~')
  }
  if (cwd.startsWith('/Users/')) {
    return cwd.replace(/^\/Users\/[^/]+/, '~')
  }
  if (cwd.startsWith('/home/')) {
    return cwd.replace(/^\/home\/[^/]+/, '~')
  }
  return cwd
}

export function formatClock(date = new Date()): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatThemedPrompt(options: {
  cwd: string
  user: string
  home?: string
  date?: Date
}): string {
  const time = formatClock(options.date)
  const path = shortPath(options.cwd, options.home)
  return (
    `\x1b[38;2;111;148;118m[${time}]\x1b[0m ` +
    `\x1b[38;2;158;181;162m${options.user}\x1b[0m ` +
    `\x1b[38;2;214;219;214m${path}\x1b[0m % `
  )
}

export function bashPs1(): string {
  return String.raw`\[\e[38;2;111;148;118m\][\t]\[\e[0m\] \[\e[38;2;158;181;162m\]\u\[\e[0m\] \[\e[38;2;214;219;214m\]\w\[\e[0m\] %# `
}

export function zshPrompt(): string {
  return `%F{#6f9476}[%D{%H:%M:%S}]%f %F{#9eb5a2}%n%f %F{#d6dbd6}%~%f %# `
}
