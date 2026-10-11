import { create } from 'zustand'
import { uid, type Frame, type ImageLayer, type Layer, type ShapeKind, type ShapeLayer, type TextLayer } from '../model/doc'
import { apply, dist, frameCenter, frameMatrix, invert, normDeg, reframe, toLocal, type Mat, type Pt } from '../model/geometry'
import { FORMATS, SAFE_MM } from '../model/formats'
import { ptToMm } from '../model/units'
import { useDoc, activeCover, selectedLayer } from '../store/doc'
import { useEditor } from '../store/editor'
import { handlesFor, layerAt, boundsEdges, snap1, snapLines, type HandleId } from './hit'
import { fullBleedLayer, importFiles } from './importImage'
import { pickImages } from './imagePicker'

/** What the canvas shows on top of the art while you work: snap guides. */
interface OverlayState {
  guides: { axis: 'x' | 'y'; at: number }[]
  cursor: string | null
  set: (p: Partial<Omit<OverlayState, 'set'>>) => void
}

export const useOverlay = create<OverlayState>((set) => ({ guides: [], cursor: null, set }))

export interface ScenePointer {
  world: Pt
  screen: Pt
  shift: boolean
  alt: boolean
  pointerType: string
  /** 2 on a double click or double tap. */
  taps: number
}

export interface SceneHandlers {
  down: (e: ScenePointer) => boolean
  move: (e: ScenePointer) => void
  up: (e: ScenePointer) => void
  cancel: () => void
  hover?: (e: ScenePointer) => void
}

type Gesture =
  | { kind: 'move'; id: string; start: Pt; frame0: Frame }
  | { kind: 'resize'; id: string; handle: HandleId; frame0: Frame; inv: Mat; content0?: ImageLayer['content'] }
  | { kind: 'rotate'; id: string; center: Pt; a0: number; rot0: number }
  | { kind: 'line-end'; id: string; fixed: Pt }
  | { kind: 'content-pan'; id: string; start: Pt; content0: ImageLayer['content'] }
  | { kind: 'content-scale'; id: string; anchor: Pt; content0: ImageLayer['content'] }
  | { kind: 'draw'; id: string; start: Pt; shape: ShapeKind }
  | { kind: 'image-pick' }
  | { kind: 'text-place' }

/** Grab radius in screen pixels: fingers need more room than a mouse. */
const grabPx = (pointerType: string) => (pointerType === 'touch' ? 22 : pointerType === 'pen' ? 12 : 8)

const HANDLE_X: Record<string, number> = { nw: 0, w: 0, sw: 0, n: 0.5, s: 0.5, ne: 1, e: 1, se: 1 }
const HANDLE_Y: Record<string, number> = { nw: 0, n: 0, ne: 0, w: 0.5, e: 0.5, sw: 1, s: 1, se: 1 }

/** Smallest frame side, mm. */
const MIN = 0.5

let gesture: Gesture | null = null

const zoom = () => useEditor.getState().camera.zoom
const tolMm = (e: ScenePointer) => grabPx(e.pointerType) / zoom()
const snapTol = () => 6 / zoom()
const update = <L extends Layer>(id: string, patch: Partial<L>) => useDoc.getState().updateLayer<L>(id, patch)

const contentCorners = (l: ImageLayer) => {
  const c = l.content
  return [
    { x: c.x, y: c.y },
    { x: c.x + c.w, y: c.y },
    { x: c.x + c.w, y: c.y + c.h },
    { x: c.x, y: c.y + c.h },
  ]
}

function startSelect(e: ScenePointer): boolean {
  const doc = useDoc.getState()
  const cam = useEditor.getState().camera
  const sel = selectedLayer()
  const r = grabPx(e.pointerType)

  // 1 · handles of the current selection
  if (sel && !sel.locked && !doc.contentEdit) {
    const h = handlesFor(sel, cam).find((h) => dist(h.s, e.screen) <= r)
    if (h) {
      doc.beginGesture()
      if (h.id === 'rot') {
        const center = frameCenter(sel)
        gesture = {
          kind: 'rotate',
          id: sel.id,
          center,
          a0: (Math.atan2(e.world.y - center.y, e.world.x - center.x) * 180) / Math.PI,
          rot0: sel.rotation,
        }
      } else if (h.id === 'a' || h.id === 'b') {
        const m = frameMatrix(sel)
        const fixed = apply(m, { x: h.id === 'a' ? sel.w : 0, y: sel.h / 2 })
        gesture = { kind: 'line-end', id: sel.id, fixed }
      } else {
        gesture = {
          kind: 'resize',
          id: sel.id,
          handle: h.id,
          frame0: { x: sel.x, y: sel.y, w: sel.w, h: sel.h, rotation: sel.rotation },
          inv: invert(frameMatrix(sel)),
          content0: sel.kind === 'image' ? sel.content : undefined,
        }
      }
      return true
    }
  }

  // 2 · inside an image in content mode: move or scale the picture
  if (sel && sel.kind === 'image' && doc.contentEdit) {
    const m = frameMatrix(sel)
    const local = toLocal(sel, e.world)
    const corners = contentCorners(sel)
    const ci = corners.findIndex((c) => dist(toWorldScreen(apply(m, c)), e.screen) <= r)
    if (ci >= 0) {
      doc.beginGesture()
      gesture = { kind: 'content-scale', id: sel.id, anchor: corners[(ci + 2) % 4], content0: sel.content }
      return true
    }
    const c = sel.content
    const inContent = local.x >= c.x && local.y >= c.y && local.x <= c.x + c.w && local.y <= c.y + c.h
    const inFrame = local.x >= 0 && local.y >= 0 && local.x <= sel.w && local.y <= sel.h
    if (inContent || inFrame) {
      if (e.taps === 2) {
        doc.setContentEdit(false)
        return false
      }
      doc.beginGesture()
      gesture = { kind: 'content-pan', id: sel.id, start: local, content0: sel.content }
      return true
    }
    doc.setContentEdit(false)
  }

  // 3 · pick a layer and drag it
  const hit = layerAt(activeCover(), e.world, tolMm(e))
  if (!hit) {
    doc.select(null)
    return false
  }
  if (hit.id !== doc.selectedId) doc.select(hit.id)
  if (e.taps === 2 && hit.kind === 'image') {
    doc.setContentEdit(true)
    return false
  }
  if (e.taps === 2 && hit.kind === 'text') {
    useEditor.getState().focusText()
    return false
  }
  doc.beginGesture()
  gesture = { kind: 'move', id: hit.id, start: e.world, frame0: { x: hit.x, y: hit.y, w: hit.w, h: hit.h, rotation: hit.rotation } }
  return true
}

const toWorldScreen = (p: Pt): Pt => {
  const cam = useEditor.getState().camera
  return { x: cam.x + p.x * cam.zoom, y: cam.y + p.y * cam.zoom }
}

function shapeDefaults(shape: ShapeKind, frame: Frame): ShapeLayer {
  const st = useEditor.getState().style
  const line = shape === 'line'
  return {
    id: uid('ly'),
    kind: 'shape',
    name: { rect: 'Rectangle', ellipse: 'Ellipse', polygon: 'Polygon', line: 'Line' }[shape],
    hidden: false,
    locked: false,
    opacity: 1,
    ...frame,
    shape,
    sides: st.sides,
    radius: st.radius,
    // Lines are all stroke; other shapes take the current fill and stroke.
    fill: line ? null : st.fill,
    stroke: line ? (st.stroke ?? st.fill ?? '#111111') : st.stroke,
    strokeWidthPt: st.strokeWidthPt,
    strokeAlign: st.strokeAlign,
    cap: st.cap,
  }
}

function textDefaults(at: Pt): TextLayer {
  const st = useEditor.getState().style
  const size = ptToMm(st.fontSizePt)
  // Run the frame to the panel's safe edge so new text never spills over the fold.
  const { w: W } = FORMATS[activeCover().formatId].trim
  const edge = at.x < W / 2 ? W / 2 - SAFE_MM : W - SAFE_MM
  const w = Math.max(20, edge - at.x)
  return {
    id: uid('ly'),
    kind: 'text',
    name: 'Text',
    hidden: false,
    locked: false,
    opacity: 1,
    x: at.x,
    y: at.y - size * 0.8,
    w,
    h: size,
    rotation: 0,
    text: 'Text',
    family: st.fontFamily,
    weight: st.fontWeight,
    sizePt: st.fontSizePt,
    leadingPt: st.leadingPt,
    tracking: st.tracking,
    align: st.textAlign,
    color: st.textColor,
    uppercase: st.uppercase,
  }
}

const lineFrame = (a: Pt, b: Pt): Frame => {
  const w = Math.max(dist(a, b), 0.01)
  const rotation = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  return { x: (a.x + b.x) / 2 - w / 2, y: (a.y + b.y) / 2, w, h: 0, rotation }
}

/** Snap a free point to template and layer lines. */
function snapPoint(p: Pt, exclude: string, alt: boolean): Pt {
  if (alt) return p
  const lines = snapLines(activeCover(), exclude)
  const sx = snap1([p.x], lines.x, snapTol())
  const sy = snap1([p.y], lines.y, snapTol())
  showGuides(sx.at, sy.at)
  return { x: p.x + sx.delta, y: p.y + sy.delta }
}

function showGuides(x: number | null, y: number | null) {
  const guides: OverlayState['guides'] = []
  if (x !== null) guides.push({ axis: 'x', at: x })
  if (y !== null) guides.push({ axis: 'y', at: y })
  useOverlay.getState().set({ guides })
}

function moveGesture(e: ScenePointer) {
  const g = gesture
  if (!g) return
  switch (g.kind) {
    case 'move': {
      let dx = e.world.x - g.start.x
      let dy = e.world.y - g.start.y
      if (e.shift) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0
        else dx = 0
      }
      if (!e.alt) {
        const lines = snapLines(activeCover(), g.id)
        const edges = boundsEdges({ ...g.frame0, x: g.frame0.x + dx, y: g.frame0.y + dy })
        const sx = snap1(edges.x, lines.x, snapTol())
        const sy = snap1(edges.y, lines.y, snapTol())
        dx += sx.delta
        dy += sy.delta
        showGuides(sx.at, sy.at)
      }
      update(g.id, { x: g.frame0.x + dx, y: g.frame0.y + dy })
      break
    }
    case 'resize': {
      const f0 = g.frame0
      const layer = selectedLayer()
      if (!layer) return
      const hx = HANDLE_X[g.handle]
      const hy = HANDLE_Y[g.handle]
      // Work in the frame's own (unrotated) coordinates.
      let q = apply(g.inv, e.world)
      if (f0.rotation === 0 && !e.alt) {
        const lines = snapLines(activeCover(), g.id)
        const sx = hx === 0.5 ? { delta: 0, at: null } : snap1([f0.x + q.x], lines.x, snapTol())
        const sy = hy === 0.5 ? { delta: 0, at: null } : snap1([f0.y + q.y], lines.y, snapTol())
        q = { x: q.x + sx.delta, y: q.y + sy.delta }
        showGuides(sx.at, sy.at)
      }
      let l = hx === 0 ? Math.min(q.x, f0.w - MIN) : 0
      let r = hx === 1 ? Math.max(q.x, MIN) : f0.w
      let t = hy === 0 ? Math.min(q.y, f0.h - MIN) : 0
      let b = hy === 1 ? Math.max(q.y, MIN) : f0.h
      if (hx === 0.5) [l, r] = [0, f0.w]
      if (hy === 0.5) [t, b] = [0, f0.h]
      // Shift keeps proportions on shapes (pictures crop freely).
      if (e.shift && layer.kind === 'shape' && hx !== 0.5 && hy !== 0.5 && f0.w > 0 && f0.h > 0) {
        const k = Math.max((r - l) / f0.w, (b - t) / f0.h)
        if (hx === 0) l = f0.w - f0.w * k
        else r = f0.w * k
        if (hy === 0) t = f0.h - f0.h * k
        else b = f0.h * k
      }
      if (layer.kind === 'text') [t, b] = [0, f0.h]
      const next = reframe(f0, l, t, r, b)
      if (layer.kind === 'image' && g.content0) {
        // Cropping: the picture stays put on the page while the frame moves.
        update<ImageLayer>(g.id, { ...next, content: { ...g.content0, x: g.content0.x - l, y: g.content0.y - t } })
      } else update(g.id, next)
      break
    }
    case 'rotate': {
      const a = (Math.atan2(e.world.y - g.center.y, e.world.x - g.center.x) * 180) / Math.PI
      let rot = normDeg(g.rot0 + a - g.a0)
      if (e.shift) rot = Math.round(rot / 15) * 15
      else {
        const near = Math.round(rot / 90) * 90
        if (Math.abs(rot - near) < 2) rot = near
      }
      const layer = selectedLayer()
      if (!layer) return
      // Rotation turns about the centre, which frame x/y already encode.
      update(g.id, { rotation: normDeg(rot) })
      break
    }
    case 'line-end': {
      let p = snapPoint(e.world, g.id, e.alt)
      if (e.shift) p = constrain45(g.fixed, p)
      const layer = selectedLayer()
      if (!layer) return
      update(g.id, lineFrame(g.fixed, p))
      break
    }
    case 'content-pan': {
      const layer = selectedLayer()
      if (!layer) return
      const q = toLocal(layer, e.world)
      let dx = q.x - g.start.x
      let dy = q.y - g.start.y
      if (e.shift) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0
        else dx = 0
      }
      update<ImageLayer>(g.id, { content: { ...g.content0, x: g.content0.x + dx, y: g.content0.y + dy } })
      break
    }
    case 'content-scale': {
      const layer = selectedLayer()
      if (!layer) return
      const q = toLocal(layer, e.world)
      const c0 = g.content0
      // Scale uniformly about the opposite corner.
      const k = Math.max(
        Math.abs(q.x - g.anchor.x) / c0.w,
        Math.abs(q.y - g.anchor.y) / c0.h,
        0.02,
      )
      const w = c0.w * k
      const h = c0.h * k
      const x = g.anchor.x === c0.x ? c0.x : g.anchor.x - w
      const y = g.anchor.y === c0.y ? c0.y : g.anchor.y - h
      update<ImageLayer>(g.id, { content: { x, y, w, h } })
      break
    }
    case 'draw': {
      let p = snapPoint(e.world, g.id, e.alt)
      if (g.shape === 'line') {
        if (e.shift) p = constrain45(g.start, p)
        update(g.id, lineFrame(g.start, p))
        break
      }
      let w = p.x - g.start.x
      let h = p.y - g.start.y
      if (e.shift) {
        const s = Math.max(Math.abs(w), Math.abs(h))
        w = Math.sign(w || 1) * s
        h = Math.sign(h || 1) * s
      }
      update(g.id, {
        x: Math.min(g.start.x, g.start.x + w),
        y: Math.min(g.start.y, g.start.y + h),
        w: Math.abs(w),
        h: Math.abs(h),
      })
      break
    }
  }
}

const constrain45 = (a: Pt, p: Pt): Pt => {
  const ang = Math.atan2(p.y - a.y, p.x - a.x)
  const step = Math.PI / 4
  const s = Math.round(ang / step) * step
  const d = dist(a, p)
  return { x: a.x + Math.cos(s) * d, y: a.y + Math.sin(s) * d }
}

function finishDraw(g: Extract<Gesture, { kind: 'draw' }>, e: ScenePointer) {
  const layer = selectedLayer()
  if (!layer) return
  const tiny = g.shape === 'line' ? layer.w < 1 : layer.w < 1 || layer.h < 1
  if (tiny) {
    // A tap rather than a drag: drop a standard-size shape centred there.
    const s = 30
    update(
      g.id,
      g.shape === 'line'
        ? lineFrame({ x: e.world.x - s, y: e.world.y }, { x: e.world.x + s, y: e.world.y })
        : { x: e.world.x - s / 2, y: e.world.y - s / 2, w: s, h: s },
    )
  }
  useEditor.getState().setTool('select')
}

export const coverHandlers: SceneHandlers = {
  down(e) {
    const tool = useEditor.getState().tool
    const doc = useDoc.getState()
    if (tool === 'select') return startSelect(e)
    if (tool === 'rect' || tool === 'ellipse' || tool === 'polygon' || tool === 'line') {
      const start = snapPoint(e.world, '', e.alt)
      const layer = shapeDefaults(tool, tool === 'line' ? lineFrame(start, start) : { x: start.x, y: start.y, w: 0, h: 0, rotation: 0 })
      doc.beginGesture()
      doc.addLayer(layer)
      gesture = { kind: 'draw', id: layer.id, start, shape: tool }
      return true
    }
    if (tool === 'image') {
      // Browsers only open a file dialog during a user gesture: mouse presses
      // count on the way down, finger taps on the way up.
      if (e.pointerType === 'mouse') {
        void addImagesFromPicker()
        return false
      }
      gesture = { kind: 'image-pick' }
      return true
    }
    if (tool === 'text') {
      gesture = { kind: 'text-place' }
      return true
    }
    return false
  },
  move: moveGesture,
  up(e) {
    const g = gesture
    gesture = null
    useOverlay.getState().set({ guides: [] })
    if (!g) return
    if (g.kind === 'draw') finishDraw(g, e)
    if (g.kind === 'image-pick') {
      // Opening a file dialog needs a completed tap on iPad, hence on release.
      void addImagesFromPicker()
      return
    }
    if (g.kind === 'text-place') {
      useDoc.getState().addLayer(textDefaults(e.world))
      useEditor.getState().setTool('select')
      useEditor.getState().focusText()
      return
    }
    useDoc.getState().endGesture()
  },
  cancel() {
    if (gesture && gesture.kind !== 'image-pick' && gesture.kind !== 'text-place') useDoc.getState().endGesture()
    gesture = null
    useOverlay.getState().set({ guides: [] })
  },
  hover(e) {
    const sel = selectedLayer()
    const doc = useDoc.getState()
    let cursor: string | null = null
    if (sel && !sel.locked && !doc.contentEdit && useEditor.getState().tool === 'select') {
      const h = handlesFor(sel, useEditor.getState().camera).find((h) => dist(h.s, e.screen) <= grabPx(e.pointerType))
      if (h) cursor = h.id === 'rot' ? 'grab' : h.id === 'a' || h.id === 'b' ? 'crosshair' : resizeCursor(h.id, sel.rotation)
    }
    if (!cursor && doc.contentEdit) cursor = 'move'
    if (useOverlay.getState().cursor !== cursor) useOverlay.getState().set({ cursor })
  },
}

const CURSORS = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize']
const HANDLE_ANGLE: Record<string, number> = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 }

const resizeCursor = (id: HandleId, rotation: number) => {
  const a = (((HANDLE_ANGLE[id] + rotation) % 180) + 180) % 180
  return CURSORS[Math.round(a / 45) % 4]
}

/** Ask for image files and lay each one full-bleed on the open cover. */
export async function addImagesFromPicker() {
  const files = await pickImages()
  if (files.length) await addImages(files)
}

export async function addImages(files: Iterable<File>) {
  const ed = useEditor.getState()
  try {
    const assets = await importFiles(files)
    for (const a of assets) useDoc.getState().addLayer(fullBleedLayer(activeCover(), a))
    if (assets.length) ed.setTool('select')
    else ed.flash('No images found in that selection.')
  } catch (err) {
    ed.flash(err instanceof Error ? err.message : 'That image could not be opened.')
  }
}

