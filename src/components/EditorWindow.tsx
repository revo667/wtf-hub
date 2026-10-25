import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState } from '@codemirror/state'
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import {
  IconCode,
  IconCursor,
  IconDirty,
  IconFile,
  IconNewFile,
  IconOpen,
  IconSave,
  IconSaveAs,
  IconSaved,
} from '@/components/editor-icons'
import { languageForFile } from '@/lib/editor-language'
import { hubEditorTheme, hubSyntax } from '@/lib/editor-theme'
import { getHub } from '@/lib/hub-client'
import { cn } from '@/lib/utils'

type EditorTab = {
  id: string
  name: string
  path: string | null
  content: string
  dirty: boolean
}

export type EditorOpenRequest = {
  id: number
  path: string
  name: string
  content: string
}

type EditorWindowProps = {
  defaultPath?: string
  active: boolean
  openRequest?: EditorOpenRequest | null
  onStatus?: (message: string) => void
}

function createTabId(): string {
  return `tab-${crypto.randomUUID()}`
}

function untitledName(index: number): string {
  return `untitled-${index}.txt`
}

function languageTitle(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.tsx')) return 'TypeScript React'
  if (lower.endsWith('.ts')) return 'TypeScript'
  if (lower.endsWith('.jsx')) return 'JavaScript React'
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'JavaScript'
  if (lower.endsWith('.json')) return 'JSON'
  if (lower.endsWith('.py')) return 'Python'
  if (lower.endsWith('.md') || lower.endsWith('.mdx')) return 'Markdown'
  if (lower.endsWith('.css') || lower.endsWith('.scss')) return 'CSS'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'HTML'
  if (lower.endsWith('.rs')) return 'Rust'
  if (lower.endsWith('.go')) return 'Go'
  if (lower.endsWith('.sh')) return 'Shell'
  return 'Plain text'
}

export function EditorWindow({
  defaultPath,
  active,
  openRequest = null,
  onStatus,
}: EditorWindowProps) {
  const hub = useMemo(() => getHub(), [])
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const langCompartment = useRef(new Compartment())
  const tabsRef = useRef<EditorTab[]>([])
  const activeTabIdRef = useRef<string>('')
  const untitledSeq = useRef(1)
  const suppressDirtyRef = useRef(false)
  const onStatusRef = useRef(onStatus)
  const defaultPathRef = useRef(defaultPath)

  const [tabs, setTabs] = useState<EditorTab[]>(() => {
    const first: EditorTab = {
      id: createTabId(),
      name: untitledName(1),
      path: null,
      content: '',
      dirty: false,
    }
    untitledSeq.current = 2
    return [first]
  })
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]?.id ?? '')
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    tabsRef.current = tabs
  }, [tabs])

  useEffect(() => {
    activeTabIdRef.current = activeTabId
  }, [activeTabId])

  useEffect(() => {
    onStatusRef.current = onStatus
  }, [onStatus])

  useEffect(() => {
    defaultPathRef.current = defaultPath
  }, [defaultPath])

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null

  const applyLanguage = useCallback((view: EditorView, name: string) => {
    const lang = languageForFile(name)
    view.dispatch({
      effects: langCompartment.current.reconfigure(lang ? [lang] : []),
    })
  }, [])

  const loadTabIntoView = useCallback(
    (tab: EditorTab) => {
      const view = viewRef.current
      if (!view) return
      suppressDirtyRef.current = true
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: tab.content },
      })
      suppressDirtyRef.current = false
      applyLanguage(view, tab.name)
      setTabs((current) =>
        current.map((item) =>
          item.id === tab.id ? { ...item, content: tab.content, dirty: tab.dirty } : item,
        ),
      )
      const pos = view.state.selection.main.head
      const line = view.state.doc.lineAt(pos)
      setCursor({ line: line.number, col: pos - line.from + 1 })
    },
    [applyLanguage],
  )

  // Mount CodeMirror once; keep callbacks via refs so StrictMode remounts cleanly.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const initial = tabsRef.current.find((tab) => tab.id === activeTabIdRef.current)
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initial?.content ?? '',
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          history(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          EditorView.lineWrapping,
          hubEditorTheme,
          hubSyntax,
          langCompartment.current.of([]),
          keymap.of([
            indentWithTab,
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...completionKeymap,
            ...searchKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const tabId = activeTabIdRef.current
              const content = update.state.doc.toString()
              const dirty = !suppressDirtyRef.current
              setTabs((current) =>
                current.map((tab) =>
                  tab.id === tabId
                    ? { ...tab, content, dirty: dirty ? true : tab.dirty }
                    : tab,
                ),
              )
            }
            if (update.selectionSet || update.docChanged) {
              const pos = update.state.selection.main.head
              const line = update.state.doc.lineAt(pos)
              setCursor({ line: line.number, col: pos - line.from + 1 })
            }
          }),
        ],
      }),
    })

    viewRef.current = view
    if (initial) applyLanguage(view, initial.name)

    return () => {
      view.destroy()
      if (viewRef.current === view) viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per editor window lifetime
  }, [])

  const selectTab = useCallback(
    (tabId: string) => {
      if (tabId === activeTabIdRef.current) return
      const view = viewRef.current
      let nextTabs = tabsRef.current

      if (view) {
        const currentId = activeTabIdRef.current
        const content = view.state.doc.toString()
        nextTabs = tabsRef.current.map((tab) =>
          tab.id === currentId
            ? { ...tab, content, dirty: tab.dirty || content !== tab.content }
            : tab,
        )
        tabsRef.current = nextTabs
        setTabs(nextTabs)
      }

      const next = nextTabs.find((tab) => tab.id === tabId)
      activeTabIdRef.current = tabId
      setActiveTabId(tabId)
      if (next) loadTabIntoView(next)
    },
    [loadTabIntoView],
  )

  const handleNew = useCallback(() => {
    const view = viewRef.current
    if (view) {
      const currentId = activeTabIdRef.current
      const content = view.state.doc.toString()
      const synced = tabsRef.current.map((tab) =>
        tab.id === currentId
          ? { ...tab, content, dirty: tab.dirty || content !== tab.content }
          : tab,
      )
      tabsRef.current = synced
      setTabs(synced)
    }

    const tab: EditorTab = {
      id: createTabId(),
      name: untitledName(untitledSeq.current++),
      path: null,
      content: '',
      dirty: false,
    }
    const nextTabs = [...tabsRef.current, tab]
    tabsRef.current = nextTabs
    setTabs(nextTabs)
    activeTabIdRef.current = tab.id
    setActiveTabId(tab.id)
    loadTabIntoView(tab)
  }, [loadTabIntoView])

  const handleOpen = useCallback(async () => {
    setBusy(true)
    try {
      const result = await hub.files.open(defaultPathRef.current)
      if (result.canceled) return
      if (result.error) {
        onStatusRef.current?.(result.error)
        return
      }
      const tab: EditorTab = {
        id: createTabId(),
        name: result.name ?? 'untitled.txt',
        path: result.path ?? null,
        content: result.content ?? '',
        dirty: false,
      }
      const nextTabs = [...tabsRef.current, tab]
      tabsRef.current = nextTabs
      setTabs(nextTabs)
      activeTabIdRef.current = tab.id
      setActiveTabId(tab.id)
      loadTabIntoView(tab)
      onStatusRef.current?.(tab.name)
    } finally {
      setBusy(false)
    }
  }, [hub, loadTabIntoView])

  const handleSave = useCallback(
    async (saveAs = false) => {
      const view = viewRef.current
      const tab = tabsRef.current.find((item) => item.id === activeTabIdRef.current)
      if (!view || !tab) return

      setBusy(true)
      try {
        const content = view.state.doc.toString()
        const result = await hub.files.save({
          path: saveAs ? null : tab.path,
          name: tab.name,
          content,
          defaultPath: defaultPathRef.current,
        })
        if (result.canceled) return
        if (result.error) {
          onStatusRef.current?.(result.error)
          return
        }
        const nextName = result.name ?? tab.name
        const nextPath = result.path ?? tab.path
        setTabs((current) =>
          current.map((item) =>
            item.id === tab.id
              ? { ...item, name: nextName, path: nextPath ?? null, content, dirty: false }
              : item,
          ),
        )
        applyLanguage(view, nextName)
        onStatusRef.current?.(`saved ${nextName}`)
      } finally {
        setBusy(false)
      }
    },
    [applyLanguage, hub],
  )

  const handleCloseTab = useCallback(
    (tabId: string, event?: MouseEvent) => {
      event?.preventDefault()
      event?.stopPropagation()

      const current = tabsRef.current
      if (current.length <= 1) {
        const only = current[0]
        if (!only) return
        const blank: EditorTab = {
          id: createTabId(),
          name: untitledName(untitledSeq.current++),
          path: null,
          content: '',
          dirty: false,
        }
        tabsRef.current = [blank]
        setTabs([blank])
        activeTabIdRef.current = blank.id
        setActiveTabId(blank.id)
        loadTabIntoView(blank)
        return
      }

      const index = current.findIndex((tab) => tab.id === tabId)
      const nextTabs = current.filter((tab) => tab.id !== tabId)
      tabsRef.current = nextTabs
      setTabs(nextTabs)

      if (tabId === activeTabIdRef.current) {
        const fallback = nextTabs[Math.max(0, index - 1)] ?? nextTabs[0]
        if (fallback) {
          activeTabIdRef.current = fallback.id
          setActiveTabId(fallback.id)
          loadTabIntoView(fallback)
        }
      }
    },
    [loadTabIntoView],
  )

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey
      if (!mod) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        event.stopPropagation()
        void handleSave(event.shiftKey)
      } else if (key === 'o') {
        event.preventDefault()
        event.stopPropagation()
        void handleOpen()
      } else if (key === 'n') {
        event.preventDefault()
        event.stopPropagation()
        handleNew()
      } else if (key === 'w') {
        event.preventDefault()
        event.stopPropagation()
        handleCloseTab(activeTabIdRef.current)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, handleCloseTab, handleNew, handleOpen, handleSave])

  useEffect(() => {
    if (!active) return
    const view = viewRef.current
    if (!view) return
    view.focus()
    // Relayout after the tile becomes visible again
    requestAnimationFrame(() => {
      view.requestMeasure()
    })
  }, [active])

  useEffect(() => {
    if (!openRequest) return

    const existing = tabsRef.current.find((tab) => tab.path === openRequest.path)
    if (existing) {
      const view = viewRef.current
      if (view && activeTabIdRef.current !== existing.id) {
        const currentId = activeTabIdRef.current
        const content = view.state.doc.toString()
        const synced = tabsRef.current.map((tab) =>
          tab.id === currentId
            ? { ...tab, content, dirty: tab.dirty || content !== tab.content }
            : tab,
        )
        tabsRef.current = synced
        setTabs(synced)
      }
      activeTabIdRef.current = existing.id
      setActiveTabId(existing.id)
      loadTabIntoView(existing)
      return
    }

    const view = viewRef.current
    if (view) {
      const currentId = activeTabIdRef.current
      const content = view.state.doc.toString()
      const synced = tabsRef.current.map((tab) =>
        tab.id === currentId
          ? { ...tab, content, dirty: tab.dirty || content !== tab.content }
          : tab,
      )
      tabsRef.current = synced
      setTabs(synced)
    }

    const tab: EditorTab = {
      id: createTabId(),
      name: openRequest.name,
      path: openRequest.path,
      content: openRequest.content,
      dirty: false,
    }

    const sole = tabsRef.current[0]
    const replaceBlank =
      tabsRef.current.length === 1 &&
      sole &&
      !sole.path &&
      !sole.dirty &&
      sole.content.length === 0

    const nextTabs = replaceBlank ? [tab] : [...tabsRef.current, tab]
    tabsRef.current = nextTabs
    setTabs(nextTabs)
    activeTabIdRef.current = tab.id
    setActiveTabId(tab.id)
    loadTabIntoView(tab)
  }, [openRequest, loadTabIntoView])

  const fileTitle = activeTab?.path ?? activeTab?.name ?? 'untitled'
  const langTitle = activeTab ? languageTitle(activeTab.name) : 'Plain text'
  const dirty = Boolean(activeTab?.dirty)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-white/8 px-2 py-1.5">
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-xl text-[var(--hypr-fg)]/85 transition-colors hover:bg-white/8 hover:text-[var(--hypr-accent)] disabled:opacity-40"
          disabled={busy}
          onClick={handleNew}
          title="New"
          aria-label="New"
        >
          <IconNewFile className="size-5" />
        </button>
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-xl text-[var(--hypr-fg)]/85 transition-colors hover:bg-white/8 hover:text-[var(--hypr-accent)] disabled:opacity-40"
          disabled={busy}
          onClick={() => {
            void handleOpen()
          }}
          title="Open"
          aria-label="Open"
        >
          <IconOpen className="size-5" />
        </button>
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-xl text-[var(--hypr-fg)]/85 transition-colors hover:bg-white/8 hover:text-[var(--hypr-accent)] disabled:opacity-40"
          disabled={busy}
          onClick={() => {
            void handleSave(false)
          }}
          title="Save"
          aria-label="Save"
        >
          <IconSave className="size-5" />
        </button>
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-xl text-[var(--hypr-fg)]/85 transition-colors hover:bg-white/8 hover:text-[var(--hypr-accent)] disabled:opacity-40"
          disabled={busy}
          onClick={() => {
            void handleSave(true)
          }}
          title="Save As"
          aria-label="Save As"
        >
          <IconSaveAs className="size-5" />
        </button>
      </div>

      <div className="flex min-h-0 items-stretch gap-0.5 overflow-x-auto border-b border-white/8 bg-black/10 px-1 pt-1">
        {tabs.map((tab) => {
          const selected = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              className={cn(
                'group flex max-w-[200px] items-center gap-1 rounded-t-lg border border-b-0 pl-2.5 pr-1 py-1 transition-colors',
                selected
                  ? 'border-white/12 bg-[rgba(22,26,22,0.55)] text-[var(--hypr-fg)]'
                  : 'border-transparent text-[var(--hypr-muted)] hover:bg-white/5 hover:text-[var(--hypr-fg)]',
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5 text-left"
                onClick={() => selectTab(tab.id)}
                title={tab.name}
              >
                <IconFile
                  className={cn('size-3.5 shrink-0', tab.dirty && 'text-[var(--hypr-accent)]')}
                />
                <span className="truncate font-mono text-[11px]">
                  {tab.dirty ? '● ' : ''}
                  {tab.name}
                </span>
              </button>
              <button
                type="button"
                className="rounded p-0.5 text-[var(--hypr-muted)] opacity-50 hover:bg-white/10 hover:text-[var(--hypr-fg)] group-hover:opacity-100"
                onClick={(event) => handleCloseTab(tab.id, event)}
                aria-label={`Close ${tab.name}`}
                title="Close tab"
              >
                <X className="size-3" strokeWidth={2} />
              </button>
            </div>
          )
        })}
      </div>

      <div ref={hostRef} className="cm-host min-h-[160px] flex-1 overflow-hidden" />

      <div className="flex items-center justify-between gap-3 border-t border-white/8 px-2.5 py-1.5 text-[var(--hypr-muted)]">
        <span className="inline-flex min-w-0 items-center gap-1.5" title={fileTitle}>
          <IconFile className="size-3.5 shrink-0 text-[var(--hypr-fg)]/70" />
          <span className="truncate font-mono text-[10px] text-[var(--hypr-muted)]">{fileTitle}</span>
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className="inline-flex items-center gap-1"
            title={`Ln ${cursor.line}, Col ${cursor.col}`}
          >
            <IconCursor className="size-3.5 text-[var(--hypr-fg)]/70" />
            <span className="font-mono text-[10px] tabular-nums">
              {cursor.line}:{cursor.col}
            </span>
          </span>
          <span className="inline-flex items-center" title={langTitle}>
            <IconCode className="size-3.5 text-[var(--hypr-fg)]/70" />
          </span>
          <span className="inline-flex items-center" title={dirty ? 'Modified' : 'Saved'}>
            {dirty ? (
              <IconDirty className="size-3.5 text-[var(--hypr-accent)]" />
            ) : (
              <IconSaved className="size-3.5 text-[var(--hypr-fg)]/55" />
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
