import { ArrowLeft, ListMusic, Play } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SpotifyPlaylist, SpotifyTrack } from '@shared/types'
import { SpotifyMark } from '@/components/music-logos'
import { getHub } from '@/lib/hub-client'
import { cn } from '@/lib/utils'

type SpotifyLibraryProps = {
  onStatus?: (message: string) => void
}

function formatDuration(ms: number): string {
  if (!ms) return '0:00'
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function SpotifyLibrary({ onStatus }: SpotifyLibraryProps) {
  const hub = useMemo(() => getHub(), [])
  const [connected, setConnected] = useState(false)
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [tracks, setTracks] = useState<SpotifyTrack[]>([])
  const [active, setActive] = useState<SpotifyPlaylist | null>(null)
  const [loading, setLoading] = useState(true)
  const [tracksLoading, setTracksLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyUri, setBusyUri] = useState<string | null>(null)

  const loadPlaylists = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sessions = await hub.music.sessions()
      const spotify = sessions.find((item) => item.service === 'spotify')
      const isConnected = Boolean(spotify?.connected)
      setConnected(isConnected)
      if (!isConnected) {
        setPlaylists([])
        return
      }
      const list = await hub.music.playlists()
      setPlaylists(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playlists')
      setPlaylists([])
    } finally {
      setLoading(false)
    }
  }, [hub])

  useEffect(() => {
    void loadPlaylists()
  }, [loadPlaylists])

  const openPlaylist = async (playlist: SpotifyPlaylist) => {
    setActive(playlist)
    setTracksLoading(true)
    setError(null)
    if (!playlist.owned) {
      setTracks([])
      setTracksLoading(false)
      setError(
        'Spotify Feb 2026: followed playlists are metadata-only. Open a playlist you own to see tracks.',
      )
      return
    }
    try {
      const list = await hub.music.playlistTracks(playlist.id)
      setTracks(list)
    } catch (err) {
      setTracks([])
      setError(err instanceof Error ? err.message : 'Failed to load tracks')
    } finally {
      setTracksLoading(false)
    }
  }

  const playContext = async (playlist: SpotifyPlaylist, track?: SpotifyTrack) => {
    setBusyUri(track?.uri || playlist.uri)
    try {
      const result = await hub.music.play({
        contextUri: playlist.uri,
        offsetUri: track?.uri,
      })
      if (!result.ok) {
        onStatus?.(result.error || 'Play failed')
      } else {
        onStatus?.(track ? track.name : playlist.name)
      }
    } finally {
      setBusyUri(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
        {active ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[var(--hypr-muted)] hover:bg-white/8 hover:text-[var(--hypr-fg)]"
            onClick={() => {
              setActive(null)
              setTracks([])
              setError(null)
            }}
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            <span className="font-mono text-[10px]">playlists</span>
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-[var(--hypr-accent)]">
            <SpotifyMark className="size-3.5" />
            <span className="font-mono text-[10px]">your lists</span>
          </div>
        )}
        <div className="min-w-0 flex-1 truncate text-right font-mono text-[10px] text-[var(--hypr-muted)]">
          {active ? active.name : `${playlists.length} playlists`}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {!connected && !loading && (
          <div className="px-2 py-8 text-center">
            <SpotifyMark className="mx-auto size-8 text-[var(--hypr-accent)]" />
            <p className="mt-3 font-display text-sm text-[var(--hypr-fg)]">Spotify not connected</p>
            <p className="mt-1 font-mono text-[11px] text-[var(--hypr-muted)]">
              Connect from the music panel, then press M again.
            </p>
          </div>
        )}

        {loading && (
          <p className="px-2 py-8 text-center font-mono text-xs text-[var(--hypr-muted)]">
            Loading playlists…
          </p>
        )}

        {error && (
          <p className="mx-1 mb-2 rounded-xl border border-[var(--hypr-danger)]/30 bg-[color-mix(in_oklab,var(--hypr-danger)_10%,transparent)] px-2.5 py-2 font-mono text-[10px] text-[var(--hypr-danger)]">
            {error}
          </p>
        )}

        {!loading && connected && !active && playlists.length === 0 && !error && (
          <p className="px-2 py-8 text-center font-mono text-xs text-[var(--hypr-muted)]">
            No playlists found
          </p>
        )}

        {!loading && connected && !active && (
          <ul className="space-y-1">
            {playlists.map((playlist) => (
              <li key={playlist.id}>
                <button
                  type="button"
                  className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/6"
                  onClick={() => {
                    void openPlaylist(playlist)
                  }}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/25">
                    {playlist.imageUrl ? (
                      <img src={playlist.imageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <ListMusic className="size-3.5 text-[var(--hypr-muted)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[12px] text-[var(--hypr-fg)]">
                      {playlist.name}
                    </p>
                    <p className="truncate font-mono text-[10px] text-[var(--hypr-muted)]">
                      {playlist.trackCount} tracks
                      {playlist.owner ? ` · ${playlist.owner}` : ''}
                      {!playlist.owned ? ' · followed' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={cn(
                      'rounded-full p-1.5 text-[var(--hypr-muted)] opacity-0 transition-opacity hover:bg-white/8 hover:text-[var(--hypr-accent)] group-hover:opacity-100',
                      busyUri === playlist.uri && 'opacity-100 text-[var(--hypr-accent)]',
                    )}
                    title="Play playlist"
                    aria-label={`Play ${playlist.name}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      void playContext(playlist)
                    }}
                  >
                    <Play className="size-3.5" strokeWidth={2} />
                  </button>
                </button>
              </li>
            ))}
          </ul>
        )}

        {active && tracksLoading && (
          <p className="px-2 py-8 text-center font-mono text-xs text-[var(--hypr-muted)]">
            Loading tracks…
          </p>
        )}

        {active && !tracksLoading && (
          <ul className="space-y-0.5">
            {tracks.map((track, index) => (
              <li key={`${track.id}-${index}`}>
                <button
                  type="button"
                  className="group flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-white/6"
                  onClick={() => {
                    void playContext(active, track)
                  }}
                >
                  <span className="w-5 shrink-0 text-right font-mono text-[10px] text-[var(--hypr-muted)]">
                    {index + 1}
                  </span>
                  <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/8 bg-black/20">
                    {track.imageUrl ? (
                      <img src={track.imageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <Play className="size-3 text-[var(--hypr-muted)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[12px] text-[var(--hypr-fg)]">
                      {track.name}
                    </p>
                    <p className="truncate font-mono text-[10px] text-[var(--hypr-muted)]">
                      {track.artists}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-[var(--hypr-muted)]">
                    {formatDuration(track.durationMs)}
                  </span>
                </button>
              </li>
            ))}
            {tracks.length === 0 && !error && (
              <p className="px-2 py-8 text-center font-mono text-xs text-[var(--hypr-muted)]">
                Empty playlist
              </p>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
