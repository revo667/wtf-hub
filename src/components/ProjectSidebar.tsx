import {
  Code2,
  Copy,
  FilePlus,
  FileText,
  FolderGit2,
  FolderOpen,
  Package,
  PenLine,
  RefreshCw,
  Search,
  SquareTerminal,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ProjectFileEntry, ProjectInfo } from '@shared/types'
import { ContextMenu, useContextMenu, type ContextMenuItem } from '@/components/ContextMenu'
import { Input } from '@/components/ui/input'
import { getHub } from '@/lib/hub-client'
import { cn } from '@/lib/utils'

type ProjectSidebarProps = {
  projects: ProjectInfo[]
  activeId: string | null
  query: string
  loading: boolean
  error: string | null
  projectsRoot: string
  onQueryChange: (value: string) => void
  onSelect: (project: ProjectInfo) => void
  onOpenFile: (file: ProjectFileEntry, project: ProjectInfo) => void
  onOpenTerminal: (project: ProjectInfo) => void
  onChanged: () => void
  onNotify: (message: string) => void
}

type RenameTarget = { path: string; value: string; kind: 'project' | 'file' }
type CreateTarget = { dir: string; project: ProjectInfo; value: string }

export function ProjectSidebar({
  projects,
  activeId,
  query,
  loading,
  error,
  projectsRoot,
  onQueryChange,
  onSelect,
  onOpenFile,
  onOpenTerminal,
  onChanged,
  onNotify,
}: ProjectSidebarProps) {
  const hub = getHub()
  const [files, setFiles] = useState<ProjectFileEntry[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)
  const [filesVersion, setFilesVersion] = useState(0)
  const [renaming, setRenamingState] = useState<RenameTarget | null>(null)
  const renamingRef = useRef<RenameTarget | null>(null)
  const setRenaming = (next: RenameTarget | null) => {
    renamingRef.current = next
    setRenamingState(next)
  }
  const [creating, setCreatingState] = useState<CreateTarget | null>(null)
  const creatingRef = useRef<CreateTarget | null>(null)
  const setCreating = (next: CreateTarget | null) => {
    creatingRef.current = next
    setCreatingState(next)
  }
  const { menu, open: openMenu, close: closeMenu } = useContextMenu()

  const filtered = projects.filter((project) =>
    project.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const activeProject = projects.find((project) => project.id === activeId) ?? null

  useEffect(() => {
    if (!activeProject) {
      setFiles([])
      setFilesError(null)
      setFilesLoading(false)
      return
    }

    let cancelled = false
    setFilesLoading(true)
    setFilesError(null)
    void hub.projects
      .listFiles(activeProject.path)
      .then((entries) => {
        if (cancelled) return
        setFiles(entries)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setFiles([])
        setFilesError(err instanceof Error ? err.message : 'Failed to list files')
      })
      .finally(() => {
        if (!cancelled) setFilesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeProject, hub, filesVersion])

  const copyPath = (value: string) => {
    void navigator.clipboard
      .writeText(value)
      .then(() => onNotify('Path copied'))
      .catch(() => onNotify('Clipboard unavailable'))
  }

  const commitRename = async () => {
    const target = renamingRef.current
    if (!target) return
    setRenaming(null)
    const currentName = target.path.split('/').pop() ?? ''
    if (!target.value.trim() || target.value.trim() === currentName) return
    const result = await hub.files.rename(target.path, target.value)
    if (!result.ok) {
      onNotify(result.error ?? 'Rename failed')
      return
    }
    onNotify(`Renamed to ${target.value.trim()}`)
    if (target.kind === 'project') onChanged()
    else setFilesVersion((version) => version + 1)
  }

  const startCreate = (project: ProjectInfo, dir: string) => {
    if (project.id !== activeId) onSelect(project)
    setCreating({ dir, project, value: '' })
  }

  const commitCreate = async () => {
    const target = creatingRef.current
    if (!target) return
    setCreating(null)
    const name = target.value.trim()
    if (!name) return
    const result = await hub.files.create(target.dir, name)
    if (!result.ok || !result.path) {
      onNotify(result.error ?? 'Create failed')
      return
    }
    setFilesVersion((version) => version + 1)
    const root = target.project.path.replace(/\/+$/, '')
    onOpenFile(
      {
        name: result.path.split('/').pop() ?? name,
        path: result.path,
        relative: result.path.startsWith(`${root}/`) ? result.path.slice(root.length + 1) : name,
      },
      target.project,
    )
  }

  const moveToTrash = async (targetPath: string, kind: 'project' | 'file') => {
    const result = await hub.files.trash(targetPath)
    if (!result.ok) {
      onNotify(result.error ?? 'Delete failed')
      return
    }
    onNotify('Moved to trash')
    if (kind === 'project') onChanged()
    else setFilesVersion((version) => version + 1)
  }

  const projectMenu = (project: ProjectInfo): ContextMenuItem[] => [
    { type: 'label', label: project.name },
    {
      label: project.id === activeId ? 'Collapse' : 'Show files',
      icon: FileText,
      onSelect: () => onSelect(project),
    },
    { label: 'New file', icon: FilePlus, onSelect: () => startCreate(project, project.path) },
    { label: 'Open terminal here', icon: SquareTerminal, onSelect: () => onOpenTerminal(project) },
    {
      label: 'Open in editor',
      icon: Code2,
      onSelect: () => {
        void hub.projects.openInEditor(project.path).then((result) => {
          if (!result.ok) onNotify(result.error ?? 'Failed to open editor')
        })
      },
    },
    {
      label: 'Reveal in Finder',
      icon: FolderOpen,
      onSelect: () => {
        void hub.projects.openInFolder(project.path)
      },
    },
    { type: 'separator' },
    { label: 'Copy path', icon: Copy, onSelect: () => copyPath(project.path) },
    {
      label: 'Rename',
      icon: PenLine,
      shortcut: 'F2',
      onSelect: () => setRenaming({ path: project.path, value: project.name, kind: 'project' }),
    },
    { label: 'Refresh', icon: RefreshCw, onSelect: onChanged },
    { type: 'separator' },
    {
      label: 'Move to trash',
      confirmLabel: 'Click again to confirm',
      icon: Trash2,
      danger: true,
      onSelect: () => {
        void moveToTrash(project.path, 'project')
      },
    },
  ]

  const fileMenu = (file: ProjectFileEntry, project: ProjectInfo): ContextMenuItem[] => [
    { type: 'label', label: file.relative },
    { label: 'Open', icon: FileText, shortcut: '↵', onSelect: () => onOpenFile(file, project) },
    {
      label: 'New file here',
      icon: FilePlus,
      onSelect: () => startCreate(project, file.path.slice(0, file.path.lastIndexOf('/'))),
    },
    {
      label: 'Reveal in Finder',
      icon: FolderOpen,
      onSelect: () => {
        void hub.files.reveal(file.path)
      },
    },
    { type: 'separator' },
    { label: 'Copy path', icon: Copy, onSelect: () => copyPath(file.path) },
    { label: 'Copy relative path', icon: Copy, onSelect: () => copyPath(file.relative) },
    {
      label: 'Rename',
      icon: PenLine,
      shortcut: 'F2',
      onSelect: () => setRenaming({ path: file.path, value: file.name, kind: 'file' }),
    },
    { type: 'separator' },
    {
      label: 'Move to trash',
      confirmLabel: 'Click again to confirm',
      icon: Trash2,
      danger: true,
      onSelect: () => {
        void moveToTrash(file.path, 'file')
      },
    },
  ]

  const renameInput = (
    <input
      autoFocus
      value={renaming?.value ?? ''}
      className="hypr-rename-input text-[12px]"
      onChange={(event) => {
        const current = renamingRef.current
        if (current) setRenaming({ ...current, value: event.target.value })
      }}
      onFocus={(event) => {
        const dot = event.target.value.lastIndexOf('.')
        event.target.setSelectionRange(0, renaming?.kind === 'file' && dot > 0 ? dot : event.target.value.length)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          void commitRename()
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          setRenaming(null)
        }
      }}
      onBlur={() => {
        void commitRename()
      }}
    />
  )

  const createInput = creating && (
    <div className="flex items-center gap-1.5 py-0.5">
      <FilePlus className="size-2.5 shrink-0 text-[var(--hypr-accent)]" />
      <input
        autoFocus
        value={creating.value}
        placeholder={
          creating.dir === creating.project.path
            ? 'name or path/to/file'
            : `${creating.dir.slice(creating.project.path.length + 1)}/…`
        }
        className="hypr-rename-input text-[11px]"
        onChange={(event) => {
          const current = creatingRef.current
          if (current) setCreating({ ...current, value: event.target.value })
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void commitCreate()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            setCreating(null)
          }
        }}
        onBlur={() => {
          void commitCreate()
        }}
      />
    </div>
  )

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-3">
        <div>
          <p className="max-w-[210px] truncate font-mono text-[10px] text-[var(--hypr-muted)]">
            {projectsRoot}
          </p>
        </div>
        <span className="hypr-module text-[var(--hypr-accent)]">{filtered.length}</span>
      </div>

      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[var(--hypr-muted)]" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Filter projects"
            className="h-9 rounded-xl border-white/10 bg-white/5 pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading && (
          <p className="px-2 py-8 text-center font-mono text-xs text-[var(--hypr-muted)]">
            Scanning workspace…
          </p>
        )}

        {!loading && error && (
          <div className="mx-1 rounded-xl border border-[var(--hypr-danger)]/35 bg-[color-mix(in_oklab,var(--hypr-danger)_12%,transparent)] p-3">
            <p className="font-mono text-xs text-[var(--hypr-danger)]">{error}</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="px-3 py-8 text-center">
            <p className="font-display text-sm text-[var(--hypr-fg)]">No projects found</p>
            <p className="mt-1 font-mono text-[11px] text-[var(--hypr-muted)]">
              Point Hub at your Documents/Projects folder in settings.
            </p>
          </div>
        )}

        <ul className="space-y-1">
          {filtered.map((project) => {
            const active = project.id === activeId
            if (renaming?.path === project.path) {
              return (
                <li key={project.id} className="px-2 py-1.5">
                  {renameInput}
                </li>
              )
            }
            return (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => onSelect(project)}
                  onContextMenu={(event) => openMenu(event, projectMenu(project))}
                  onKeyDown={(event) => {
                    if (event.key === 'F2') {
                      event.preventDefault()
                      setRenaming({ path: project.path, value: project.name, kind: 'project' })
                    }
                  }}
                  className={cn(
                    'hypr-project flex w-full flex-col gap-1 px-3 py-2 text-left',
                    active && 'hypr-project-active',
                  )}
                >
                  <span
                    className={cn(
                      'font-mono text-[13px]',
                      active ? 'text-[var(--hypr-accent)]' : 'text-[var(--hypr-fg)]',
                    )}
                  >
                    {project.name}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--hypr-muted)]">
                    {project.hasGit && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-1.5 py-0.5">
                        <FolderGit2 className="size-3" />
                        git
                      </span>
                    )}
                    {project.hasPackageJson && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-1.5 py-0.5">
                        <Package className="size-3" />
                        npm
                      </span>
                    )}
                    {project.hasReadme && (
                      <span className="rounded-full bg-white/5 px-1.5 py-0.5">readme</span>
                    )}
                  </span>
                </button>

                {active && (
                  <div className="mt-0.5 mb-1 ml-2 border-l border-white/10 pl-2">
                    {creating?.project.id === project.id && createInput}
                    {filesLoading && (
                      <p className="py-1 font-mono text-[10px] text-[var(--hypr-muted)]">…</p>
                    )}
                    {!filesLoading && filesError && (
                      <p className="py-1 font-mono text-[10px] text-[var(--hypr-danger)]">
                        {filesError}
                      </p>
                    )}
                    {!filesLoading && !filesError && files.length === 0 && (
                      <p className="py-1 font-mono text-[10px] text-[var(--hypr-muted)]">
                        no files
                      </p>
                    )}
                    {!filesLoading &&
                      !filesError &&
                      files.map((file) =>
                        renaming?.path === file.path ? (
                          <div key={file.path} className="py-0.5">
                            {renameInput}
                          </div>
                        ) : (
                        <button
                          key={file.path}
                          type="button"
                          className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left hover:bg-white/6"
                          title={file.relative}
                          onClick={() => onOpenFile(file, project)}
                          onContextMenu={(event) => openMenu(event, fileMenu(file, project))}
                          onKeyDown={(event) => {
                            if (event.key === 'F2') {
                              event.preventDefault()
                              setRenaming({ path: file.path, value: file.name, kind: 'file' })
                            }
                          }}
                        >
                          <FileText className="size-2.5 shrink-0 text-[var(--hypr-muted)]" />
                          <span className="truncate font-mono text-[10px] leading-4 text-[var(--hypr-fg)]/75">
                            {file.relative}
                          </span>
                        </button>
                        ),
                      )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      <ContextMenu menu={menu} onClose={closeMenu} />
    </aside>
  )
}
