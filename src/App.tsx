import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CliTool, HubSettings, ProjectFileEntry, ProjectInfo } from '@shared/types'
import { CliToolbar } from '@/components/CliToolbar'
import { EditorWindow, type EditorOpenRequest } from '@/components/EditorWindow'
import { EmptyDesktop } from '@/components/EmptyDesktop'
import { MusicControl } from '@/components/MusicControl'
import { ProjectSidebar } from '@/components/ProjectSidebar'
import { SettingsPanel } from '@/components/SettingsPanel'
import { SpotifyLibrary } from '@/components/SpotifyLibrary'
import { TerminalPane } from '@/components/TerminalPane'
import { WidgetsPanel } from '@/components/WidgetsPanel'
import { WindowFrame } from '@/components/WindowFrame'
import { getHub, getHubRuntime, isLiveTerminalRuntime } from '@/lib/hub-client'

type TermWindow = {
  id: string
  title: string
  cwd: string
  ptyId: string | null
}

const WIN_PROJECTS = 'projects'
const WIN_CLI = 'cli'
const WIN_WIDGETS = 'widgets'
const WIN_EDITOR = 'editor'
const WIN_LIBRARY = 'library'
const WIN_MUSIC = 'music'

function createTermId(): string {
  return `term-${crypto.randomUUID()}`
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return true
  }
  return Boolean(target.closest('.xterm') || target.closest('.cm-editor') || target.closest('.cm-host'))
}

function tileColumns(count: number): number {
  if (count <= 1) return 1
  if (count === 2) return 2
  if (count <= 4) return 2
  if (count <= 6) return 3
  return Math.ceil(Math.sqrt(count))
}

export default function App() {
  const hub = useMemo(() => getHub(), [])
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [tools, setTools] = useState<CliTool[]>([])
  const [settings, setSettings] = useState<HubSettings | null>(null)
  const [activeProject, setActiveProject] = useState<ProjectInfo | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [cliOpen, setCliOpen] = useState(false)
  const [widgetsOpen, setWidgetsOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [musicOpen, setMusicOpen] = useState(false)
  const [editorRequest, setEditorRequest] = useState<EditorOpenRequest | null>(null)
  const [terminals, setTerminals] = useState<TermWindow[]>([])
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draftRoot, setDraftRoot] = useState('')
  const [draftShell, setDraftShell] = useState('')
  const [draftSpotifyClientId, setDraftSpotifyClientId] = useState('')
  const [draftSoundcloudClientId, setDraftSoundcloudClientId] = useState('')
  const [draftSoundcloudClientSecret, setDraftSoundcloudClientSecret] = useState('')
  const [draftDiscordEnabled, setDraftDiscordEnabled] = useState(false)
  const [draftDiscordClientId, setDraftDiscordClientId] = useState('')
  const [draftDiscordImageKey, setDraftDiscordImageKey] = useState(
    'discord-rich-presence-512',
  )
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const pendingCommandRef = useRef<string | null>(null)
  const terminalsRef = useRef<TermWindow[]>([])
  const focusedIdRef = useRef<string | null>(null)
  const hoveredIdRef = useRef<string | null>(null)
  const editorRequestSeq = useRef(0)
  const editorOpenRef = useRef(false)

  useEffect(() => {
    editorOpenRef.current = editorOpen
  }, [editorOpen])

  useEffect(() => {
    terminalsRef.current = terminals
  }, [terminals])

  useEffect(() => {
    focusedIdRef.current = focusedId
  }, [focusedId])

  useEffect(() => {
    hoveredIdRef.current = hoveredId
  }, [hoveredId])

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextSettings, nextProjects, nextTools] = await Promise.all([
        hub.settings.get(),
        hub.projects.list(),
        hub.cli.list(),
      ])
      setSettings(nextSettings)
      setDraftRoot(nextSettings.projectsRoot)
      setDraftShell(nextSettings.defaultShell)
      setDraftSpotifyClientId(nextSettings.spotifyClientId)
      setDraftSoundcloudClientId(nextSettings.soundcloudClientId)
      setDraftSoundcloudClientSecret(nextSettings.soundcloudClientSecret)
      setDraftDiscordEnabled(nextSettings.discordRichPresence)
      setDraftDiscordClientId(nextSettings.discordClientId)
      setDraftDiscordImageKey(
        nextSettings.discordLargeImageKey || 'discord-rich-presence-512',
      )
      setProjects(nextProjects)
      setTools(nextTools)
      setActiveProject((current) => {
        if (!current) return null
        return nextProjects.find((project) => project.id === current.id) ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace')
    } finally {
      setLoading(false)
    }
  }, [hub])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const surfaces: string[] = []
    if (terminals.length > 0) {
      surfaces.push(terminals.length === 1 ? 'Terminal' : `Terminal ×${terminals.length}`)
    }
    if (editorOpen) surfaces.push('Code editor')
    if (cliOpen) surfaces.push('AI CLIs')
    if (libraryOpen) surfaces.push('Spotify library')
    if (musicOpen) surfaces.push('Music')
    if (projectsOpen) surfaces.push('Projects')
    if (widgetsOpen) surfaces.push('Widgets')

    void hub.presence.set({
      projectName: activeProject?.name ?? null,
      surfaces,
    })
  }, [
    hub,
    activeProject?.name,
    terminals.length,
    editorOpen,
    cliOpen,
    libraryOpen,
    musicOpen,
    projectsOpen,
    widgetsOpen,
  ])

  const openTerminal = useCallback(() => {
    const project = activeProject
    const term: TermWindow = {
      id: createTermId(),
      title: project?.name ?? `term-${terminalsRef.current.length + 1}`,
      cwd: project?.path ?? '~',
      ptyId: null,
    }
    setTerminals((current) => [...current, term])
    setFocusedId(term.id)
    return term.id
  }, [activeProject, settings?.projectsRoot])

  const isOpenWindow = useCallback(
    (id: string | null | undefined): boolean => {
      if (!id) return false
      if (id === WIN_PROJECTS) return projectsOpen
      if (id === WIN_CLI) return cliOpen
      if (id === WIN_WIDGETS) return widgetsOpen
      if (id === WIN_EDITOR) return editorOpen
      if (id === WIN_LIBRARY) return libraryOpen
      if (id === WIN_MUSIC) return musicOpen
      return terminalsRef.current.some((term) => term.id === id)
    },
    [projectsOpen, cliOpen, widgetsOpen, editorOpen, libraryOpen, musicOpen],
  )

  const resolveCloseTarget = useCallback((): string | null => {
    const preferred = [hoveredIdRef.current, focusedIdRef.current]
    for (const id of preferred) {
      if (isOpenWindow(id)) return id as string
    }
    const topTerm = terminalsRef.current.at(-1)
    if (topTerm) return topTerm.id
    if (editorOpen) return WIN_EDITOR
    if (libraryOpen) return WIN_LIBRARY
    if (musicOpen) return WIN_MUSIC
    if (cliOpen) return WIN_CLI
    if (widgetsOpen) return WIN_WIDGETS
    if (projectsOpen) return WIN_PROJECTS
    return null
  }, [isOpenWindow, editorOpen, libraryOpen, musicOpen, cliOpen, widgetsOpen, projectsOpen])

  const closeWindow = useCallback(
    async (id: string | null) => {
      if (!id) return

      if (hoveredIdRef.current === id) {
        hoveredIdRef.current = null
        setHoveredId(null)
      }

      if (id === WIN_PROJECTS) {
        setProjectsOpen(false)
        if (focusedIdRef.current === id) setFocusedId(null)
        return
      }
      if (id === WIN_CLI) {
        setCliOpen(false)
        if (focusedIdRef.current === id) setFocusedId(null)
        return
      }
      if (id === WIN_WIDGETS) {
        setWidgetsOpen(false)
        if (focusedIdRef.current === id) setFocusedId(null)
        return
      }
      if (id === WIN_EDITOR) {
        setEditorOpen(false)
        if (focusedIdRef.current === id) setFocusedId(null)
        return
      }
      if (id === WIN_LIBRARY) {
        setLibraryOpen(false)
        if (focusedIdRef.current === id) setFocusedId(null)
        return
      }
      if (id === WIN_MUSIC) {
        setMusicOpen(false)
        if (focusedIdRef.current === id) setFocusedId(null)
        return
      }

      const term = terminalsRef.current.find((item) => item.id === id)
      if (!term) return
      if (term.ptyId) {
        await hub.pty.dispose(term.ptyId)
      }
      setTerminals((current) => {
        const next = current.filter((item) => item.id !== id)
        const nextFocus = next.at(-1)?.id ?? null
        focusedIdRef.current = nextFocus
        setFocusedId(nextFocus)
        return next
      })
    },
    [hub],
  )

  const flushPendingCommand = useCallback(
    async (ptyId: string) => {
      const command = pendingCommandRef.current
      if (!command) return
      pendingCommandRef.current = null
      await hub.pty.write(ptyId, command)
    },
    [hub],
  )

  const handleBindPty = useCallback(
    (termId: string, ptyId: string) => {
      setTerminals((current) =>
        current.map((term) => (term.id === termId ? { ...term, ptyId } : term)),
      )
      void flushPendingCommand(ptyId)
    },
    [flushPendingCommand],
  )

  const handleLaunchCli = async (tool: CliTool) => {
    if (!isLiveTerminalRuntime()) {
      showToast('Start with npm run dev (live bridge) or npm run electron:dev')
      return
    }

    const project = activeProject
    const target =
      terminalsRef.current.find((term) => term.id === focusedIdRef.current) ??
      terminalsRef.current.find((term) => (project ? term.cwd === project.path : true))

    pendingCommandRef.current = `${tool.command}\r`

    if (!target) {
      openTerminal()
      showToast(tool.available ? tool.label : `${tool.label} · ${tool.command}`)
      return
    }

    setFocusedId(target.id)
    if (target.ptyId) {
      await flushPendingCommand(target.ptyId)
      showToast(tool.available ? tool.label : `${tool.label} · ${tool.command}`)
      return
    }
    showToast(tool.available ? tool.label : `${tool.label} · ${tool.command}`)
  }

  const handleProjectSelect = useCallback((project: ProjectInfo) => {
    setActiveProject((current) => (current?.id === project.id ? null : project))
    setFocusedId(WIN_PROJECTS)
  }, [])

  const handleOpenProjectFile = useCallback(
    async (file: ProjectFileEntry, project: ProjectInfo) => {
      setActiveProject(project)
      setFocusedId(WIN_EDITOR)

      const result = await hub.files.read(file.path)
      if (!result.ok || result.content === undefined) {
        showToast(result.error ?? 'Failed to read file')
        return
      }

      const request: EditorOpenRequest = {
        id: ++editorRequestSeq.current,
        path: file.path,
        name: file.name,
        content: result.content,
      }
      setEditorRequest(request)
      if (!editorOpenRef.current) {
        setEditorOpen(true)
      }
      showToast(file.relative)
    },
    [hub, showToast],
  )

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const next = await hub.settings.set({
        projectsRoot: draftRoot.trim() || settings?.projectsRoot,
        defaultShell: draftShell.trim() || settings?.defaultShell,
        spotifyClientId: draftSpotifyClientId.trim(),
        soundcloudClientId: draftSoundcloudClientId.trim(),
        soundcloudClientSecret: draftSoundcloudClientSecret.trim(),
        discordRichPresence: draftDiscordEnabled,
        discordClientId: draftDiscordClientId.trim(),
        discordLargeImageKey:
          draftDiscordImageKey.trim() || 'discord-rich-presence-512',
      })
      setSettings(next)
      setSettingsOpen(false)
      await refresh()
      showToast('Settings saved')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (settingsOpen) return
      const key = event.key.toLowerCase()
      if (!['a', 'w', 's', 'd', 'e', 'm', 'p', 'q'].includes(key)) return

      const mod =
        event.metaKey ||
        event.altKey ||
        event.getModifierState('OS') ||
        event.getModifierState('Super')
      const typing = isTypingTarget(event.target)
      const focusedIsTerminal = Boolean(focusedIdRef.current?.startsWith('term-'))
      const focusedIsEditor = focusedIdRef.current === WIN_EDITOR

      if (key === 'q') {
        event.preventDefault()
        event.stopPropagation()
        void closeWindow(resolveCloseTarget())
        return
      }

      if ((typing || focusedIsTerminal || focusedIsEditor) && !mod) return

      event.preventDefault()
      event.stopPropagation()

      if (key === 'a') {
        setProjectsOpen((open) => {
          const next = !open
          if (next) setFocusedId(WIN_PROJECTS)
          else if (focusedIdRef.current === WIN_PROJECTS) setFocusedId(null)
          return next
        })
        return
      }
      if (key === 's') {
        setCliOpen((open) => {
          const next = !open
          if (next) setFocusedId(WIN_CLI)
          else if (focusedIdRef.current === WIN_CLI) setFocusedId(null)
          return next
        })
        return
      }
      if (key === 'd') {
        setWidgetsOpen((open) => {
          const next = !open
          if (next) setFocusedId(WIN_WIDGETS)
          else if (focusedIdRef.current === WIN_WIDGETS) setFocusedId(null)
          return next
        })
        return
      }
      if (key === 'e') {
        setEditorOpen((open) => {
          const next = !open
          if (next) setFocusedId(WIN_EDITOR)
          else if (focusedIdRef.current === WIN_EDITOR) setFocusedId(null)
          return next
        })
        return
      }
      if (key === 'm') {
        setLibraryOpen((open) => {
          const next = !open
          if (next) setFocusedId(WIN_LIBRARY)
          else if (focusedIdRef.current === WIN_LIBRARY) setFocusedId(null)
          return next
        })
        return
      }
      if (key === 'p') {
        setMusicOpen((open) => {
          const next = !open
          if (next) setFocusedId(WIN_MUSIC)
          else if (focusedIdRef.current === WIN_MUSIC) setFocusedId(null)
          return next
        })
        return
      }
      if (key === 'w') {
        openTerminal()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [closeWindow, openTerminal, resolveCloseTarget, settingsOpen])

  const desktopEmpty =
    !projectsOpen &&
    !cliOpen &&
    !widgetsOpen &&
    !editorOpen &&
    !libraryOpen &&
    !musicOpen &&
    terminals.length === 0
  const mainTiles = terminals.length + (editorOpen ? 1 : 0) + (libraryOpen ? 1 : 0)
  const cols = tileColumns(mainTiles)
  const runtime = getHubRuntime()

  return (
    <div
      className="hypr-shell"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setFocusedId(null)
      }}
    >
      <div className="hypr-wallpaper" aria-hidden />
      <div className="hypr-vignette" aria-hidden />
      <EmptyDesktop visible={desktopEmpty} />

      <div className="pointer-events-none absolute top-3 right-3 z-30">
        <div
          className={
            runtime === 'mock'
              ? 'rounded-full border border-[var(--hypr-danger)]/35 bg-black/35 px-2.5 py-1 font-mono text-[10px] text-[var(--hypr-danger)] backdrop-blur-md'
              : 'rounded-full border border-[var(--hypr-accent)]/35 bg-black/35 px-2.5 py-1 font-mono text-[10px] text-[var(--hypr-accent)] backdrop-blur-md'
          }
        >
          {runtime === 'electron'
            ? 'live · electron'
            : runtime === 'bridge'
              ? 'live · pty bridge'
              : 'demo · no pty'}
        </div>
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col gap-[var(--hypr-gap)] p-[var(--hypr-gap)]">
        {cliOpen && (
          <WindowFrame
            id={WIN_CLI}
            title="ai clis"
            compact
            focused={focusedId === WIN_CLI}
            onFocus={setFocusedId}
            onHover={setHoveredId}
            onClose={(id) => {
              void closeWindow(id)
            }}
            className="hypr-rise-1 w-fit max-w-full shrink-0 self-start"
          >
            <CliToolbar
              tools={tools}
              onLaunchCli={(tool) => {
                void handleLaunchCli(tool)
              }}
            />
          </WindowFrame>
        )}

        <div className="flex min-h-0 flex-1 gap-[var(--hypr-gap)]">
          {projectsOpen && (
            <WindowFrame
              id={WIN_PROJECTS}
              title="projects"
              focused={focusedId === WIN_PROJECTS}
              onFocus={setFocusedId}
              onHover={setHoveredId}
              onClose={(id) => {
                void closeWindow(id)
              }}
              className="hypr-rise-2 w-[300px] shrink-0"
            >
              <ProjectSidebar
                projects={projects}
                activeId={activeProject?.id ?? null}
                query={query}
                loading={loading}
                error={error}
                projectsRoot={settings?.projectsRoot ?? '…'}
                onQueryChange={setQuery}
                onSelect={handleProjectSelect}
                onOpenFile={(file, project) => {
                  void handleOpenProjectFile(file, project)
                }}
              />
            </WindowFrame>
          )}

          <div
            className="grid min-h-0 min-w-0 flex-1 gap-[var(--hypr-gap)]"
            style={{
              gridTemplateColumns: mainTiles === 0 ? '1fr' : `repeat(${cols}, minmax(0, 1fr))`,
            }}
          >
            {editorOpen && (
              <WindowFrame
                id={WIN_EDITOR}
                title="editor"
                hideChrome
                focused={focusedId === WIN_EDITOR}
                onFocus={setFocusedId}
                onHover={setHoveredId}
                onClose={(id) => {
                  void closeWindow(id)
                }}
                className="hypr-rise-3 min-h-[280px]"
              >
                <EditorWindow
                  defaultPath={activeProject?.path ?? settings?.projectsRoot}
                  active={focusedId === WIN_EDITOR}
                  openRequest={editorRequest}
                  onStatus={showToast}
                />
              </WindowFrame>
            )}

            {libraryOpen && (
              <WindowFrame
                id={WIN_LIBRARY}
                title="spotify"
                focused={focusedId === WIN_LIBRARY}
                onFocus={setFocusedId}
                onHover={setHoveredId}
                onClose={(id) => {
                  void closeWindow(id)
                }}
                className="hypr-rise-3 min-h-[280px]"
              >
                <SpotifyLibrary onStatus={showToast} />
              </WindowFrame>
            )}

            {terminals.map((term) => (
              <WindowFrame
                key={term.id}
                id={term.id}
                title={term.title}
                hideChrome
                focused={focusedId === term.id}
                onFocus={setFocusedId}
                onHover={setHoveredId}
                onClose={(id) => {
                  void closeWindow(id)
                }}
                className="hypr-rise-3 min-h-[220px]"
              >
                <TerminalPane
                  cwd={term.cwd}
                  ptyId={term.ptyId}
                  active={focusedId === term.id}
                  onBindPty={(ptyId) => handleBindPty(term.id, ptyId)}
                />
              </WindowFrame>
            ))}
          </div>

          {widgetsOpen && (
            <WindowFrame
              id={WIN_WIDGETS}
              title="widgets"
              focused={focusedId === WIN_WIDGETS}
              onFocus={setFocusedId}
              onHover={setHoveredId}
              onClose={(id) => {
                void closeWindow(id)
              }}
              className="hypr-rise-2 w-[280px] shrink-0"
            >
              <WidgetsPanel
                workspaceCount={projects.length}
                terminalCount={terminals.length}
                activeProjectName={activeProject?.name ?? null}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            </WindowFrame>
          )}
        </div>

        {musicOpen && (
          <div
            className="pointer-events-none flex shrink-0 justify-end"
            onMouseEnter={() => setHoveredId(WIN_MUSIC)}
            onMouseLeave={() => setHoveredId(null)}
            onMouseDown={() => setFocusedId(WIN_MUSIC)}
          >
            <div className="pointer-events-auto w-[min(320px,100%)]">
              <MusicControl
                focused={focusedId === WIN_MUSIC}
                onClose={() => {
                  void closeWindow(WIN_MUSIC)
                }}
              />
            </div>
          </div>
        )}
      </div>

      {settings && (
        <SettingsPanel
          open={settingsOpen}
          settings={settings}
          draftRoot={draftRoot}
          draftShell={draftShell}
          draftSpotifyClientId={draftSpotifyClientId}
          draftSoundcloudClientId={draftSoundcloudClientId}
          draftSoundcloudClientSecret={draftSoundcloudClientSecret}
          draftDiscordEnabled={draftDiscordEnabled}
          draftDiscordClientId={draftDiscordClientId}
          draftDiscordImageKey={draftDiscordImageKey}
          saving={saving}
          onDraftRootChange={setDraftRoot}
          onDraftShellChange={setDraftShell}
          onDraftSpotifyClientIdChange={setDraftSpotifyClientId}
          onDraftSoundcloudClientIdChange={setDraftSoundcloudClientId}
          onDraftSoundcloudClientSecretChange={setDraftSoundcloudClientSecret}
          onDraftDiscordEnabledChange={setDraftDiscordEnabled}
          onDraftDiscordClientIdChange={setDraftDiscordClientId}
          onDraftDiscordImageKeyChange={setDraftDiscordImageKey}
          onSave={() => {
            void handleSaveSettings()
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {toast && (
        <div className="hypr-toast pointer-events-none fixed bottom-4 left-4 z-50 px-3.5 py-2.5 font-mono text-xs text-[var(--hypr-accent)]">
          {toast}
        </div>
      )}
    </div>
  )
}
