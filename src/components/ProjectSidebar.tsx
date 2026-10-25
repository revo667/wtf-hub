import { FileText, FolderGit2, Package, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ProjectFileEntry, ProjectInfo } from '@shared/types'
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
}

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
}: ProjectSidebarProps) {
  const hub = getHub()
  const [files, setFiles] = useState<ProjectFileEntry[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)

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
  }, [activeProject, hub])

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
            return (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => onSelect(project)}
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
                      files.map((file) => (
                        <button
                          key={file.path}
                          type="button"
                          className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left hover:bg-white/6"
                          title={file.relative}
                          onClick={() => onOpenFile(file, project)}
                        >
                          <FileText className="size-2.5 shrink-0 text-[var(--hypr-muted)]" />
                          <span className="truncate font-mono text-[10px] leading-4 text-[var(--hypr-fg)]/75">
                            {file.relative}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
