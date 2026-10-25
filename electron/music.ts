import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { shell } from 'electron'
import type {
  MusicNowPlaying,
  MusicService,
  MusicSession,
  MusicTransportResult,
  SpotifyPlaylist,
  SpotifyTrack,
} from '../shared/types'

type TokenBundle = {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  tokenType: string
  scope?: string
}

type MusicStore = {
  spotify?: TokenBundle & { displayName?: string; userId?: string }
  soundcloud?: TokenBundle & { displayName?: string; userId?: string }
}

type MusicConfig = {
  spotifyClientId: string
  soundcloudClientId: string
  soundcloudClientSecret: string
}

const SPOTIFY_REDIRECT = 'http://127.0.0.1:43128/callback'
const SOUNDCLOUD_REDIRECT = 'http://127.0.0.1:43129/callback'
const SPOTIFY_SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ')

let userDataDir = ''
let getConfig: () => MusicConfig = () => ({
  spotifyClientId: '',
  soundcloudClientId: '',
  soundcloudClientSecret: '',
})

export function configureMusic(dir: string, configFn: () => MusicConfig): void {
  userDataDir = dir
  getConfig = configFn
}

function storePath(): string {
  return path.join(userDataDir, 'music-auth.json')
}

function readStore(): MusicStore {
  try {
    if (!fs.existsSync(storePath())) return {}
    return JSON.parse(fs.readFileSync(storePath(), 'utf8')) as MusicStore
  } catch {
    return {}
  }
}

function writeStore(store: MusicStore): void {
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2), 'utf8')
}

function base64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function createPkce(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(32))
  const challenge = base64Url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

function waitForRedirect(port: number, expectedState: string): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
        if (url.pathname !== '/callback') {
          res.writeHead(404)
          res.end('Not found')
          return
        }
        const error = url.searchParams.get('error')
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`<h1>Auth failed</h1><p>${error}</p>`)
          server.close()
          reject(new Error(error))
          return
        }
        const state = url.searchParams.get('state')
        const code = url.searchParams.get('code')
        if (!code || state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<h1>Invalid callback</h1>')
          server.close()
          reject(new Error('Invalid OAuth callback'))
          return
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(
          '<h1>Connected</h1><p>You can close this tab and return to WTF HUB.</p><script>window.close?.()</script>',
        )
        server.close()
        resolve({ code })
      } catch (err) {
        server.close()
        reject(err)
      }
    })

    server.listen(port, '127.0.0.1')
    server.on('error', reject)
    setTimeout(() => {
      server.close()
      reject(new Error('Auth timed out'))
    }, 180_000)
  })
}

async function exchangeSpotifyToken(
  clientId: string,
  code: string,
  verifier: string,
): Promise<TokenBundle> {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: SPOTIFY_REDIRECT,
    code_verifier: verifier,
  })
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    throw new Error(`Spotify token exchange failed (${res.status})`)
  }
  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
    scope?: string
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 30_000,
    tokenType: data.token_type,
    scope: data.scope,
  }
}

async function refreshSpotifyToken(clientId: string, refreshToken: string): Promise<TokenBundle> {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    throw new Error(`Spotify refresh failed (${res.status})`)
  }
  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
    scope?: string
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000 - 30_000,
    tokenType: data.token_type,
    scope: data.scope,
  }
}

async function exchangeSoundCloudToken(
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<TokenBundle> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: SOUNDCLOUD_REDIRECT,
    code,
  })
  const res = await fetch('https://api.soundcloud.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    throw new Error(`SoundCloud token exchange failed (${res.status})`)
  }
  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    token_type: string
    scope?: string
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 30_000,
    tokenType: data.token_type,
    scope: data.scope,
  }
}

async function ensureSpotifyAccess(): Promise<string> {
  const cfg = getConfig()
  if (!cfg.spotifyClientId) {
    throw new Error('Set Spotify Client ID in Settings')
  }
  const store = readStore()
  const session = store.spotify
  if (!session?.accessToken) {
    throw new Error('Spotify not connected')
  }
  if (session.expiresAt > Date.now()) {
    return session.accessToken
  }
  if (!session.refreshToken) {
    throw new Error('Spotify session expired — reconnect')
  }
  const refreshed = await refreshSpotifyToken(cfg.spotifyClientId, session.refreshToken)
  store.spotify = { ...session, ...refreshed }
  writeStore(store)
  return refreshed.accessToken
}

async function ensureSoundCloudAccess(): Promise<string> {
  const store = readStore()
  const session = store.soundcloud
  if (!session?.accessToken) {
    throw new Error('SoundCloud not connected')
  }
  if (session.expiresAt > Date.now()) {
    return session.accessToken
  }
  throw new Error('SoundCloud session expired — reconnect')
}

export async function connectMusicService(service: MusicService): Promise<MusicSession> {
  const cfg = getConfig()
  if (service === 'spotify') {
    if (!cfg.spotifyClientId) {
      throw new Error('Add your Spotify Client ID in Settings first')
    }
    const state = base64Url(randomBytes(16))
    const { verifier, challenge } = createPkce()
    const authUrl = new URL('https://accounts.spotify.com/authorize')
    authUrl.searchParams.set('client_id', cfg.spotifyClientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', SPOTIFY_REDIRECT)
    authUrl.searchParams.set('scope', SPOTIFY_SCOPES)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('code_challenge', challenge)

    const wait = waitForRedirect(43128, state)
    await shell.openExternal(authUrl.toString())
    const { code } = await wait
    const tokens = await exchangeSpotifyToken(cfg.spotifyClientId, code, verifier)

    const meRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    })
    const me = meRes.ok
      ? ((await meRes.json()) as { id?: string; display_name?: string })
      : {}

    const store = readStore()
    store.spotify = {
      ...tokens,
      displayName: me.display_name || me.id || 'Spotify',
      userId: me.id,
    }
    writeStore(store)
    return getMusicSession('spotify')
  }

  if (!cfg.soundcloudClientId || !cfg.soundcloudClientSecret) {
    throw new Error('Add SoundCloud Client ID + Secret in Settings first')
  }
  const state = base64Url(randomBytes(16))
  const authUrl = new URL('https://secure.soundcloud.com/authorize')
  authUrl.searchParams.set('client_id', cfg.soundcloudClientId)
  authUrl.searchParams.set('redirect_uri', SOUNDCLOUD_REDIRECT)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'non-expiring')
  authUrl.searchParams.set('state', state)

  const wait = waitForRedirect(43129, state)
  await shell.openExternal(authUrl.toString())
  const { code } = await wait
  const tokens = await exchangeSoundCloudToken(
    cfg.soundcloudClientId,
    cfg.soundcloudClientSecret,
    code,
  )

  const meRes = await fetch(
    `https://api.soundcloud.com/me?oauth_token=${encodeURIComponent(tokens.accessToken)}`,
  )
  const me = meRes.ok
    ? ((await meRes.json()) as { id?: number; username?: string; full_name?: string })
    : {}

  const store = readStore()
  store.soundcloud = {
    ...tokens,
    displayName: me.full_name || me.username || 'SoundCloud',
    userId: me.id != null ? String(me.id) : undefined,
  }
  writeStore(store)
  return getMusicSession('soundcloud')
}

export function disconnectMusicService(service: MusicService): MusicSession {
  const store = readStore()
  delete store[service]
  writeStore(store)
  return getMusicSession(service)
}

export function getMusicSession(service: MusicService): MusicSession {
  const store = readStore()
  const entry = store[service]
  const cfg = getConfig()
  const configured =
    service === 'spotify'
      ? Boolean(cfg.spotifyClientId)
      : Boolean(cfg.soundcloudClientId && cfg.soundcloudClientSecret)

  return {
    service,
    connected: Boolean(entry?.accessToken),
    configured,
    displayName: entry?.displayName,
    userId: entry?.userId,
  }
}

export function listMusicSessions(): MusicSession[] {
  return [getMusicSession('spotify'), getMusicSession('soundcloud')]
}

export async function getNowPlaying(service: MusicService): Promise<MusicNowPlaying> {
  if (service === 'spotify') {
    const token = await ensureSpotifyAccess()
    const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 204) {
      return { service, isPlaying: false }
    }
    if (!res.ok) {
      throw new Error(`Spotify now-playing failed (${res.status})`)
    }
    const data = (await res.json()) as {
      is_playing?: boolean
      progress_ms?: number
      item?: {
        name?: string
        duration_ms?: number
        external_urls?: { spotify?: string }
        artists?: Array<{ name?: string }>
        album?: { images?: Array<{ url?: string }> }
      }
    }
    const item = data.item
    return {
      service,
      isPlaying: Boolean(data.is_playing),
      title: item?.name,
      artist: item?.artists?.map((a) => a.name).filter(Boolean).join(', ') || undefined,
      albumArtUrl: item?.album?.images?.[0]?.url,
      url: item?.external_urls?.spotify,
      progressMs: data.progress_ms,
      durationMs: item?.duration_ms,
    }
  }

  const token = await ensureSoundCloudAccess()
  const res = await fetch('https://api.soundcloud.com/me/activities/tracks/affiliated?limit=1', {
    headers: { Authorization: `OAuth ${token}` },
  })
  // Fallback: user stream / likes
  if (!res.ok) {
    const likes = await fetch('https://api.soundcloud.com/me/favorites?limit=1', {
      headers: { Authorization: `OAuth ${token}` },
    })
    if (!likes.ok) {
      return {
        service,
        isPlaying: false,
        title: 'SoundCloud connected',
        artist: 'Open a track in SoundCloud',
      }
    }
    const list = (await likes.json()) as Array<{
      title?: string
      permalink_url?: string
      user?: { username?: string }
      artwork_url?: string
    }>
    const track = list[0]
    return {
      service,
      isPlaying: false,
      title: track?.title,
      artist: track?.user?.username,
      url: track?.permalink_url,
      albumArtUrl: track?.artwork_url?.replace('-large', '-t200x200'),
    }
  }

  const payload = (await res.json()) as {
    collection?: Array<{
      origin?: {
        title?: string
        permalink_url?: string
        user?: { username?: string }
        artwork_url?: string
      }
    }>
  }
  const origin = payload.collection?.[0]?.origin
  return {
    service,
    isPlaying: false,
    title: origin?.title || 'SoundCloud connected',
    artist: origin?.user?.username,
    url: origin?.permalink_url,
    albumArtUrl: origin?.artwork_url?.replace('-large', '-t200x200'),
  }
}

export async function musicTransport(
  service: MusicService,
  action: 'play' | 'pause' | 'next' | 'previous',
): Promise<MusicTransportResult> {
  if (service !== 'spotify') {
    return {
      ok: false,
      error: 'SoundCloud in-app transport needs an active embed; open your track in SoundCloud',
    }
  }
  try {
    const token = await ensureSpotifyAccess()
    const endpoints: Record<typeof action, { method: string; url: string }> = {
      play: { method: 'PUT', url: 'https://api.spotify.com/v1/me/player/play' },
      pause: { method: 'PUT', url: 'https://api.spotify.com/v1/me/player/pause' },
      next: { method: 'POST', url: 'https://api.spotify.com/v1/me/player/next' },
      previous: { method: 'POST', url: 'https://api.spotify.com/v1/me/player/previous' },
    }
    const target = endpoints[action]
    const res = await fetch(target.url, {
      method: target.method,
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok && res.status !== 204) {
      const text = await res.text()
      return {
        ok: false,
        error:
          res.status === 404
            ? 'No active Spotify device — open Spotify on a device first'
            : text || `Spotify ${action} failed (${res.status})`,
      }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Transport failed' }
  }
}

type SpotifyPlaylistPage = {
  items?: Array<{
    id?: string
    name?: string
    description?: string | null
    uri?: string
    external_urls?: { spotify?: string }
    images?: Array<{ url?: string }>
    /** Pre–Feb 2026 */
    tracks?: { total?: number }
    /** Feb 2026+ Dev Mode: tracks renamed to items */
    items?: { total?: number }
    owner?: { id?: string; display_name?: string }
    collaborative?: boolean
  }>
  next?: string | null
}

async function ensureSpotifyUserId(token: string): Promise<string | undefined> {
  const store = readStore()
  if (store.spotify?.userId) return store.spotify.userId
  const meRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!meRes.ok || !store.spotify) return undefined
  const me = (await meRes.json()) as { id?: string; display_name?: string }
  if (!me.id) return undefined
  store.spotify = {
    ...store.spotify,
    userId: me.id,
    displayName: store.spotify.displayName || me.display_name || me.id,
  }
  writeStore(store)
  return me.id
}

export async function listSpotifyPlaylists(): Promise<SpotifyPlaylist[]> {
  const token = await ensureSpotifyAccess()
  const meId = await ensureSpotifyUserId(token)
  const out: SpotifyPlaylist[] = []
  let url: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50'

  while (url && out.length < 200) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new Error(`Failed to load playlists (${res.status})`)
    }
    const data = (await res.json()) as SpotifyPlaylistPage
    for (const item of data.items || []) {
      if (!item.id || !item.uri) continue
      const owned = Boolean(meId) && item.owner?.id === meId
      out.push({
        id: item.id,
        name: item.name || 'Playlist',
        description: item.description || undefined,
        imageUrl: item.images?.[0]?.url,
        // Feb 2026: playlist.tracks → playlist.items
        trackCount: item.items?.total ?? item.tracks?.total ?? 0,
        owner: item.owner?.display_name,
        owned,
        uri: item.uri,
        url: item.external_urls?.spotify,
      })
    }
    url = data.next || null
  }

  return out
}

type SpotifyTrackObject = {
  id?: string | null
  name?: string
  uri?: string
  duration_ms?: number
  external_urls?: { spotify?: string }
  artists?: Array<{ name?: string }>
  album?: { name?: string; images?: Array<{ url?: string }> }
}

type SpotifyTracksPage = {
  items?: Array<{
    /** Pre–Feb 2026 */
    track?: SpotifyTrackObject | null
    /** Feb 2026+: track renamed to item */
    item?: SpotifyTrackObject | null
    type?: string
  } | null>
  next?: string | null
}

function pushTrack(out: SpotifyTrack[], track: SpotifyTrackObject | null | undefined): void {
  if (!track?.id || !track.uri) return
  out.push({
    id: track.id,
    name: track.name || 'Track',
    artists: (track.artists || []).map((a) => a.name).filter(Boolean).join(', '),
    album: track.album?.name,
    durationMs: track.duration_ms || 0,
    imageUrl: track.album?.images?.[0]?.url,
    uri: track.uri,
    url: track.external_urls?.spotify,
  })
}

async function fetchPlaylistPages(
  token: string,
  firstUrl: string,
): Promise<{ ok: true; pages: SpotifyTracksPage[] } | { ok: false; status: number; body: string }> {
  const pages: SpotifyTracksPage[] = []
  let url: string | null = firstUrl
  while (url && pages.length < 20) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      return { ok: false, status: res.status, body: await res.text() }
    }
    const data = (await res.json()) as SpotifyTracksPage
    pages.push(data)
    url = data.next || null
  }
  return { ok: true, pages }
}

export async function listSpotifyPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const token = await ensureSpotifyAccess()
  const id = encodeURIComponent(playlistId)
  // Feb 2026: /tracks removed for Dev Mode — only /items, max limit 50
  const firstUrl = `https://api.spotify.com/v1/playlists/${id}/items?limit=50&additional_types=track`

  const result = await fetchPlaylistPages(token, firstUrl)
  if (!result.ok) {
    if (result.status === 403) {
      throw new Error(
        'Spotify only returns tracks for playlists you own or collaborate on (Feb 2026 API). Followed/public lists stay metadata-only.',
      )
    }
    throw new Error(
      `Failed to load tracks (${result.status})${result.body ? `: ${result.body.slice(0, 160)}` : ''}`,
    )
  }

  const out: SpotifyTrack[] = []
  for (const page of result.pages) {
    for (const row of page.items || []) {
      // Feb 2026: .track → .item
      pushTrack(out, row?.item ?? row?.track)
    }
  }
  return out
}

export async function playSpotify(options: {
  contextUri?: string
  uris?: string[]
  offsetUri?: string
}): Promise<MusicTransportResult> {
  try {
    const token = await ensureSpotifyAccess()
    const body: Record<string, unknown> = {}
    if (options.contextUri) {
      body.context_uri = options.contextUri
      if (options.offsetUri) {
        body.offset = { uri: options.offsetUri }
      }
    } else if (options.uris?.length) {
      body.uris = options.uris
    } else {
      return { ok: false, error: 'Nothing to play' }
    }

    const res = await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok && res.status !== 204) {
      const text = await res.text()
      return {
        ok: false,
        error:
          res.status === 404
            ? 'No active Spotify device — open Spotify on a device first'
            : text || `Play failed (${res.status})`,
      }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Play failed' }
  }
}
