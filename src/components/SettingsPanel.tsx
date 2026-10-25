import type { HubSettings } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type SettingsPanelProps = {
  open: boolean
  settings: HubSettings
  draftRoot: string
  draftShell: string
  draftSpotifyClientId: string
  draftSoundcloudClientId: string
  draftSoundcloudClientSecret: string
  draftDiscordEnabled: boolean
  draftDiscordClientId: string
  draftDiscordImageKey: string
  saving: boolean
  onDraftRootChange: (value: string) => void
  onDraftShellChange: (value: string) => void
  onDraftSpotifyClientIdChange: (value: string) => void
  onDraftSoundcloudClientIdChange: (value: string) => void
  onDraftSoundcloudClientSecretChange: (value: string) => void
  onDraftDiscordEnabledChange: (value: boolean) => void
  onDraftDiscordClientIdChange: (value: string) => void
  onDraftDiscordImageKeyChange: (value: string) => void
  onSave: () => void
  onClose: () => void
}

export function SettingsPanel({
  open,
  settings,
  draftRoot,
  draftShell,
  draftSpotifyClientId,
  draftSoundcloudClientId,
  draftSoundcloudClientSecret,
  draftDiscordEnabled,
  draftDiscordClientId,
  draftDiscordImageKey,
  saving,
  onDraftRootChange,
  onDraftShellChange,
  onDraftSpotifyClientIdChange,
  onDraftSoundcloudClientIdChange,
  onDraftSoundcloudClientSecretChange,
  onDraftDiscordEnabledChange,
  onDraftDiscordClientIdChange,
  onDraftDiscordImageKeyChange,
  onSave,
  onClose,
}: SettingsPanelProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-xl">
      <div className="hypr-tile hypr-tile-active max-h-[90vh] w-full max-w-lg overflow-y-auto p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-[var(--hypr-fg)]">Settings</h2>
            <p className="font-mono text-[11px] text-[var(--hypr-muted)]">
              Workspace, shell, music & Discord
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="font-mono text-[11px] tracking-wide text-[var(--hypr-muted)] uppercase">
              Projects root
            </span>
            <Input
              value={draftRoot}
              onChange={(event) => onDraftRootChange(event.target.value)}
              placeholder={settings.projectsRoot}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="font-mono text-[11px] tracking-wide text-[var(--hypr-muted)] uppercase">
              Default shell
            </span>
            <Input
              value={draftShell}
              onChange={(event) => onDraftShellChange(event.target.value)}
              placeholder={settings.defaultShell}
            />
          </label>

          <div className="rounded-2xl border border-[var(--hypr-accent)]/35 bg-[var(--hypr-accent)]/8 p-3">
            <p className="mb-2 font-mono text-[11px] tracking-wide text-[var(--hypr-accent)] uppercase">
              Discord Rich Presence
            </p>
            <div className="space-y-3">
              <label className="flex items-center gap-2 font-mono text-[11px] text-[var(--hypr-fg)]">
                <input
                  type="checkbox"
                  checked={draftDiscordEnabled}
                  onChange={(event) => onDraftDiscordEnabledChange(event.target.checked)}
                  className="size-3.5 accent-[var(--hypr-accent)]"
                />
                Enable Rich Presence (Electron + Discord desktop)
              </label>
              <label className="block space-y-1.5">
                <span className="font-mono text-[10px] text-[var(--hypr-muted)]">
                  Discord Application ID (Client ID)
                </span>
                <Input
                  value={draftDiscordClientId}
                  onChange={(event) => onDraftDiscordClientIdChange(event.target.value)}
                  placeholder="Genel Bilgiler → Application ID"
                  autoComplete="off"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="font-mono text-[10px] text-[var(--hypr-muted)]">
                  Large image key
                </span>
                <Input
                  value={draftDiscordImageKey}
                  onChange={(event) => onDraftDiscordImageKeyChange(event.target.value)}
                  placeholder={settings.discordLargeImageKey || 'discord-rich-presence-512'}
                  autoComplete="off"
                />
                <p className="font-mono text-[10px] leading-4 text-[var(--hypr-muted)]">
                  Discord Art Assets’teki key (seninki: `discord-rich-presence-512`). Details =
                  proje, state = Terminal · Code editor…
                </p>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
            <p className="mb-2 font-mono text-[11px] tracking-wide text-[var(--hypr-muted)] uppercase">
              Music accounts
            </p>
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="font-mono text-[10px] text-[var(--hypr-muted)]">
                  Spotify Client ID
                </span>
                <Input
                  value={draftSpotifyClientId}
                  onChange={(event) => onDraftSpotifyClientIdChange(event.target.value)}
                  placeholder="from developer.spotify.com"
                  autoComplete="off"
                />
                <p className="font-mono text-[10px] text-[var(--hypr-muted)]">
                  Redirect URI: http://127.0.0.1:43128/callback
                </p>
              </label>
              <label className="block space-y-1.5">
                <span className="font-mono text-[10px] text-[var(--hypr-muted)]">
                  SoundCloud Client ID
                </span>
                <Input
                  value={draftSoundcloudClientId}
                  onChange={(event) => onDraftSoundcloudClientIdChange(event.target.value)}
                  placeholder="from SoundCloud app"
                  autoComplete="off"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="font-mono text-[10px] text-[var(--hypr-muted)]">
                  SoundCloud Client Secret
                </span>
                <Input
                  type="password"
                  value={draftSoundcloudClientSecret}
                  onChange={(event) => onDraftSoundcloudClientSecretChange(event.target.value)}
                  placeholder="kept in local settings"
                  autoComplete="off"
                />
                <p className="font-mono text-[10px] text-[var(--hypr-muted)]">
                  Redirect URI: http://127.0.0.1:43129/callback
                </p>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
            <p className="mb-2 font-mono text-[11px] tracking-wide text-[var(--hypr-muted)] uppercase">
              CLI templates
            </p>
            <ul className="space-y-1.5 font-mono text-xs text-[var(--hypr-fg)]">
              {Object.entries(settings.cliTemplates).map(([id, command]) => (
                <li key={id} className="flex justify-between gap-3">
                  <span className="text-[var(--hypr-accent)]">{id}</span>
                  <span className="truncate text-[var(--hypr-muted)]">{command}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
