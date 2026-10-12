import { produce, type Draft } from 'immer'
import { create } from 'zustand'
import { newCover, uid, type Cover, type Layer, type Project } from '../model/doc'
import { dropCover, newSheet, placeCover, refileCover } from '../model/sheets'
import { reframe } from '../model/geometry'
import type { FormatId } from '../model/formats'

// The document store: the project, which cover is open, what's selected, and
// undo history. History holds whole project snapshots — immer shares every
// unchanged object between them, so they cost almost nothing.

interface Snapshot {
  project: Project
  activeId: string
}

const HISTORY_LIMIT = 200

interface DocState {
  project: Project
  activeId: string
  selectedId: string | null
  /** Image content mode: drag moves the picture inside its frame. */
  contentEdit: boolean
  past: Snapshot[]
  future: Snapshot[]
  /** The state before the gesture in progress, if any. */
  pending: Snapshot | null

  /** Change the project. Inside a gesture, changes merge into one undo step. */
  edit: (recipe: (p: Draft<Project>, cover: Draft<Cover>) => void) => void
  beginGesture: () => void
  endGesture: () => void
  undo: () => void
  redo: () => void

  select: (id: string | null) => void
  setContentEdit: (on: boolean) => void
  openCover: (id: string) => void

  addCover: (formatId: FormatId) => void
  duplicateCover: (id: string) => void
  deleteCover: (id: string) => void

  addLayer: (layer: Layer) => void
  updateLayer: <L extends Layer>(id: string, patch: Partial<L>) => void
  removeLayer: (id: string) => void
  duplicateLayer: (id: string) => void
  /** Add a copy of a layer (from the clipboard) to the open cover. */
  pasteLayer: (layer: Layer) => void
  restack: (id: string, to: 'up' | 'down' | 'top' | 'bottom') => void
  /** Replace the whole project (restore or open a file); history starts fresh. */
  loadProject: (project: Project, activeId?: string) => void
  /** Change a cover's format, moving it onto sheets of that format. */
  setCoverFormat: (id: string, formatId: FormatId, recipe?: (c: Draft<Cover>) => void) => void
  /** Text frames grow and shrink with their text; not an undoable edit. */
  syncTextHeight: (id: string, h: number) => void
}

const first = newCover('notebook', 1)

const snapshot = (s: DocState): Snapshot => ({ project: s.project, activeId: s.activeId })

const findCover = (p: Project | Draft<Project>, id: string) => p.covers.find((c) => c.id === id)!

export const useDoc = create<DocState>((set, get) => {
  /** Apply a recipe to the project, recording history unless a gesture is open. */
  const commit = (recipe: (p: Draft<Project>, cover: Draft<Cover>) => void, extra: Partial<DocState> = {}) =>
    set((s) => {
      const project = produce(s.project, (p) => recipe(p, findCover(p, s.activeId)))
      if (project === s.project) return extra
      if (s.pending) return { project, ...extra }
      return {
        project,
        past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
        future: [],
        ...extra,
      }
    })

  const restore = (snap: Snapshot): Partial<DocState> => {
    const cover = findCover(snap.project, snap.activeId)
    const s = get()
    const keep = s.selectedId && cover.layers.some((l) => l.id === s.selectedId)
    return { ...snap, selectedId: keep ? s.selectedId : null, contentEdit: keep ? s.contentEdit : false }
  }

  return {
    project: { covers: [first], sheets: [newSheet('notebook', first.id)] },
    activeId: first.id,
    selectedId: null,
    contentEdit: false,
    past: [],
    future: [],
    pending: null,

    edit: (recipe) => commit(recipe),
    beginGesture: () => set((s) => (s.pending ? {} : { pending: snapshot(s) })),
    endGesture: () =>
      set((s) => {
        if (!s.pending) return {}
        if (s.pending.project === s.project) return { pending: null }
        return { pending: null, past: [...s.past, s.pending].slice(-HISTORY_LIMIT), future: [] }
      }),
    // Undo and redo first close anything still open (a typing session, a
    // slider that never heard its pointer lift), so they can never get stuck.
    undo: () =>
      set((s) => {
        const open = s.pending && s.pending.project !== s.project
        const past = open ? [...s.past, s.pending!] : s.past
        const prev = past[past.length - 1]
        if (!prev) return s.pending ? { pending: null } : {}
        return { ...restore(prev), pending: null, past: past.slice(0, -1), future: [snapshot(s), ...(open ? [] : s.future)] }
      }),
    redo: () =>
      set((s) => {
        // An open change is newer than anything redo could bring back.
        if (s.pending && s.pending.project !== s.project)
          return { pending: null, past: [...s.past, s.pending].slice(-HISTORY_LIMIT), future: [] }
        const next = s.future[0]
        if (!next) return s.pending ? { pending: null } : {}
        return { ...restore(next), pending: null, past: [...s.past, snapshot(s)], future: s.future.slice(1) }
      }),

    select: (selectedId) => set((s) => ({ selectedId, contentEdit: selectedId === s.selectedId ? s.contentEdit : false })),
    setContentEdit: (contentEdit) => set({ contentEdit }),
    openCover: (activeId) => set({ activeId, selectedId: null, contentEdit: false }),

    addCover: (formatId) => {
      const s = get()
      const cover = newCover(formatId, s.project.covers.length + 1)
      commit(
        (p) => {
          p.covers.push(cover)
          p.sheets = placeCover(p.sheets, cover)
        },
        { activeId: cover.id, selectedId: null, contentEdit: false },
      )
    },
    duplicateCover: (id) => {
      const src = findCover(get().project, id)
      const copy: Cover = {
        ...structuredClone(src),
        id: uid('cv'),
        name: `${src.name} copy`,
      }
      copy.layers = copy.layers.map((l) => ({ ...l, id: uid('ly') }))
      commit(
        (p) => {
          p.covers.splice(p.covers.findIndex((c) => c.id === id) + 1, 0, copy)
          p.sheets = placeCover(p.sheets, copy)
        },
        { activeId: copy.id, selectedId: null, contentEdit: false },
      )
    },
    deleteCover: (id) => {
      const s = get()
      if (s.project.covers.length < 2) return
      const i = s.project.covers.findIndex((c) => c.id === id)
      const next = s.project.covers[i + 1] ?? s.project.covers[i - 1]
      commit(
        (p) => {
          p.covers.splice(i, 1)
          p.sheets = dropCover(p.sheets, id)
        },
        s.activeId === id ? { activeId: next.id, selectedId: null, contentEdit: false } : {},
      )
    },

    addLayer: (layer) => commit((_, c) => void c.layers.push(layer), { selectedId: layer.id, contentEdit: false }),
    updateLayer: (id, patch) =>
      commit((_, c) => {
        const l = c.layers.find((l) => l.id === id)
        if (l) Object.assign(l, patch)
      }),
    removeLayer: (id) =>
      commit(
        (_, c) => {
          c.layers = c.layers.filter((l) => l.id !== id)
        },
        get().selectedId === id ? { selectedId: null, contentEdit: false } : {},
      ),
    pasteLayer: (src) => {
      const cover = findCover(get().project, get().activeId)
      // Same spot as the original (handy across covers), nudged while that spot is taken.
      let { x, y } = src
      while (cover.layers.some((l) => Math.abs(l.x - x) < 0.01 && Math.abs(l.y - y) < 0.01)) {
        x += 5
        y += 5
      }
      const copy = { ...structuredClone(src), id: uid('ly'), x, y }
      commit((_, c) => void c.layers.push(copy), { selectedId: copy.id, contentEdit: false })
    },
    duplicateLayer: (id) => {
      const s = get()
      const src = findCover(s.project, s.activeId).layers.find((l) => l.id === id)
      if (!src) return
      const copy = { ...structuredClone(src), id: uid('ly'), name: `${src.name} copy`, x: src.x + 5, y: src.y + 5 }
      commit(
        (_, c) => {
          c.layers.splice(c.layers.findIndex((l) => l.id === id) + 1, 0, copy)
        },
        { selectedId: copy.id, contentEdit: false },
      )
    },
    restack: (id, to) =>
      commit((_, c) => {
        const i = c.layers.findIndex((l) => l.id === id)
        if (i < 0) return
        const [l] = c.layers.splice(i, 1)
        const j = to === 'top' ? c.layers.length : to === 'bottom' ? 0 : to === 'up' ? i + 1 : i - 1
        c.layers.splice(Math.max(0, Math.min(c.layers.length, j)), 0, l)
      }),
    setCoverFormat: (id, formatId, recipe) =>
      commit((p) => {
        const c = findCover(p, id)
        recipe?.(c)
        c.formatId = formatId
        p.sheets = refileCover(p.sheets, c)
      }),
    loadProject: (project, activeId) =>
      set({
        project,
        activeId: activeId && project.covers.some((c) => c.id === activeId) ? activeId : project.covers[0].id,
        selectedId: null,
        contentEdit: false,
        past: [],
        future: [],
        pending: null,
      }),
    syncTextHeight: (id, h) =>
      set((s) => {
        const project = produce(s.project, (p) => {
          for (const c of p.covers)
            for (const l of c.layers)
              if (l.id === id && Math.abs(l.h - h) > 1e-4) {
                // Keep the frame's top-left corner where it is, even when rotated.
                Object.assign(l, reframe(l, 0, 0, l.w, h))
              }
        })
        return project === s.project ? {} : { project }
      }),
  }
})

export const useActiveCover = () => useDoc((s) => findCover(s.project, s.activeId))

export const useSelectedLayer = () =>
  useDoc((s) => (s.selectedId ? findCover(s.project, s.activeId).layers.find((l) => l.id === s.selectedId) ?? null : null))

export const activeCover = () => {
  const s = useDoc.getState()
  return findCover(s.project, s.activeId)
}

export const selectedLayer = () => {
  const s = useDoc.getState()
  return s.selectedId ? activeCover().layers.find((l) => l.id === s.selectedId) ?? null : null
}
