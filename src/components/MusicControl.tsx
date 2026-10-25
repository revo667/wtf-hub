import { ExternalLink, LogOut, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MusicNowPlaying, MusicService, MusicSession } from '@shared/types'
import { SoundCloudMark, SpotifyMark } from '@/components/music-logos'
import { getHub, isElectronRuntime } from '@/lib/hub-client'
import { cn } from '@/lib/utils'

const SOURCE_ORDER: MusicService[] = ['spotify', 'soundcloud']

type MusicControlProps = {
  focused?: boolean
  onClose?: () => void
}

export function MusicControl({ focused = false, onClose }: MusicControlProps) {
  const hub = useMemo(() => getHub(), [])
  const [source, setSource] = useState<MusicService>('spotify')
  const [sessions, setSessions] = useState<MusicSession[]>([])
  const [now, setNow] = useState<MusicNowPlaying | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const session = sessions.find((item) => item.service === source) ?? null
  const connected = Boolean(session?.connected)

  const refreshSessions = useCallback(async () => {
    const next = await hub.music.sessions()
    setSessions(next)
    return next
  }, [hub])

  const refreshNowPlaying = useCallback(async () => {
    if (!session?.connected) {
      setNow(null)
      return
    }
    try {
      const playing = await hub.music.nowPlaying(source)
      setNow(playing)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to read playback')
    }
  }, [hub, session?.connected, source])

  useEffect(() => {
    void refreshSessions()
  }, [refreshSessions])

  useEffect(() => {
    void refreshNowPlaying()
    if (!connected) return
    const id = window.setInterval(() => {
      void refreshNowPlaying()
    }, 4000)
    return () => window.clearInterval(id)
  }, [connected, refreshNowPlaying])

  const showStatus = useCallback((message: string) => {
    setStatus(message)
    window.setTimeout(() => setStatus(null), 2800)
  }, [])

  const handleConnect = async () => {
    setBusy(true)
    try {
      const next = await hub.music.connect(source)
      await refreshSessions()
      setSessions((current) =>
        current.map((item) => (item.service === source ? next : item)),
      )
      showStatus(`Connected as ${next.displayName || source}`)
      const playing = await hub.music.nowPlaying(source)
      setNow(playing)
    } catch (err) {
      showStatus(err instanceof Error ? err.message : 'Connect failed')
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    setBusy(true)
    try {
      const next = await hub.music.disconnect(source)
      setSessions((current) =>
        current.map((item) => (item.service === source ? next : item)),
      )
      setNow(null)
      showStatus('Disconnected')
    } finally {
      setBusy(false)
    }
  }

  const handleTransport = async (action: 'play' | 'pause' | 'next' | 'previous') => {
    setBusy(true)
    try {
      const result = await hub.music.transport(source, action)
      if (!result.ok) {
        showStatus(result.error || 'Transport failed')
      }
      await refreshNowPlaying()
    } finally {
      setBusy(false)
    }
  }

  const title = now?.title || (connected ? 'Nothing playing' : `Connect your ${source}`)
  const artist =
    now?.artist ||
    (connected ? session?.displayName || 'Your account' : 'Link account in Settings, then connect')

  return (
    <section
      className={cn(
        'hypr-tile hypr-rise-2 relative overflow-hidden',
        focused && 'hypr-tile-active',
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
        <span
          className={cn(
            'size-2 rounded-full',
            focused || connected ? 'bg-[var(--hypr-accent)]' : 'bg-[var(--hypr-muted)]',
          )}
        />
        <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--hypr-muted)]">
          <span className={focused ? 'text-[var(--hypr-accent)]' : 'text-[var(--hypr-fg)]'}>
            music
          </span>
          {session?.displayName ? ` · ${session.displayName}` : ''}
        </p>
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/20 p-0.5">
          {SOURCE_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={cn(
                'inline-flex items-center rounded-full px-2 py-1 transition-colors',
                source === id
                  ? 'bg-[var(--hypr-accent)]/25 text-[var(--hypr-accent)]'
                  : 'text-[var(--hypr-muted)] hover:text-[var(--hypr-fg)]',
              )}
              onClick={() => setSource(id)}
              title={id}
              aria-label={id}
            >
              {id === 'spotify' ? (
                <SpotifyMark className="size-3.5" />
              ) : (
                <SoundCloudMark className="size-3.5" />
              )}
            </button>
          ))}
        </div>
        {onClose && (
          <button
            type="button"
            className="rounded-full p-1 text-[var(--hypr-muted)] hover:bg-white/8 hover:text-[var(--hypr-fg)]"
            onClick={onClose}
            aria-label="Close music"
            title="Close"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/25 text-[var(--hypr-accent)]">
          {now?.albumArtUrl ? (
            <img src={now.albumArtUrl} alt="" className="size-full object-cover" />
          ) : source === 'spotify' ? (
            <SpotifyMark className="size-5" />
          ) : (
            <SoundCloudMark className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[12px] text-[var(--hypr-fg)]">{title}</p>
          <p className="truncate font-mono text-[10px] text-[var(--hypr-muted)]">{artist}</p>
        </div>
        {now?.url && (
          <a
            href={now.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg p-1.5 text-[var(--hypr-muted)] hover:bg-white/8 hover:text-[var(--hypr-fg)]"
            title="Open"
          >
            <ExternalLink className="size-3.5" strokeWidth={2} />
          </a>
        )}
      </div>

      {connected ? (
        <div className="flex items-center justify-center gap-3 px-3 pb-2.5">
          <button
            type="button"
            className="rounded-full p-1.5 text-[var(--hypr-muted)] hover:bg-white/8 hover:text-[var(--hypr-fg)] disabled:opacity-40"
            disabled={busy || source !== 'spotify'}
            onClick={() => {
              void handleTransport('previous')
            }}
            title="Previous"
            aria-label="Previous"
          >
            <SkipBack className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--hypr-accent)]/45 bg-[var(--hypr-accent)]/20 text-[var(--hypr-accent)] hover:bg-[var(--hypr-accent)]/30 disabled:opacity-40"
            disabled={busy}
            onClick={() => {
              void handleTransport(now?.isPlaying ? 'pause' : 'play')
            }}
            title={now?.isPlaying ? 'Pause' : 'Play'}
            aria-label={now?.isPlaying ? 'Pause' : 'Play'}
          >
            {now?.isPlaying ? (
              <Pause className="size-4" strokeWidth={2} />
            ) : (
              <Play className="size-4 translate-x-[1px]" strokeWidth={2} />
            )}
          </button>
          <button
            type="button"
            className="rounded-full p-1.5 text-[var(--hypr-muted)] hover:bg-white/8 hover:text-[var(--hypr-fg)] disabled:opacity-40"
            disabled={busy || source !== 'spotify'}
            onClick={() => {
              void handleTransport('next')
            }}
            title="Next"
            aria-label="Next"
          >
            <SkipForward className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            className="rounded-full p-1.5 text-[var(--hypr-muted)] hover:bg-white/8 hover:text-[var(--hypr-fg)]"
            disabled={busy}
            onClick={() => {
              void handleDisconnect()
            }}
            title="Disconnect"
            aria-label="Disconnect"
          >
            <LogOut className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div className="px-3 pb-3">
          <button
            type="button"
            className="w-full rounded-xl border border-[var(--hypr-accent)]/40 bg-[var(--hypr-accent)]/15 px-3 py-2 font-mono text-[11px] text-[var(--hypr-accent)] hover:bg-[var(--hypr-accent)]/25 disabled:opacity-40"
            disabled={busy}
            onClick={() => {
              void handleConnect()
            }}
          >
            {busy ? 'Connecting…' : `Connect ${source === 'spotify' ? 'Spotify' : 'SoundCloud'}`}
          </button>
          <p className="mt-2 font-mono text-[10px] leading-4 text-[var(--hypr-muted)]">
            {isElectronRuntime()
              ? 'Add API credentials in Settings, then connect your account in the browser.'
              : 'Browser preview uses a demo account. Real OAuth runs in Electron.'}
          </p>
        </div>
      )}

      {status && (
        <p className="border-t border-white/8 px-3 py-1.5 font-mono text-[10px] text-[var(--hypr-accent)]">
          {status}
        </p>
      )}
    </section>
  )
}
