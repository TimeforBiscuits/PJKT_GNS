import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Rect } from '../model/units'
import { useEditor, type Camera } from '../store/editor'
import { clampZoom, zoomAt } from './camera'
import { Rulers, RULER } from './Rulers'

export interface ViewInfo {
  cam: Camera
  size: { w: number; h: number }
}

/** Screen padding kept around the scene when fitting, for labels and dimensions. */
export interface FitPad {
  t: number
  r: number
  b: number
  l: number
}


interface GestureEvent extends UIEvent {
  scale: number
  clientX: number
  clientY: number
}

type Drag =
  | { kind: 'pan'; sx: number; sy: number; cam: Camera }
  | { kind: 'pinch'; dist: number; mx: number; my: number; cam: Camera }

/**
 * The light table: a pannable, zoomable millimetre space.
 *
 * Mouse: wheel pans, Ctrl/⌘ + wheel zooms, middle-drag or Space-drag pans.
 * Trackpad: two-finger scroll pans, pinch zooms (Chrome sends Ctrl+wheel,
 * Safari sends gesture events). Touch: two fingers pan and pinch. The Hand
 * tool pans with any single pointer.
 */
export function Viewport({
  fitBounds,
  fitPad,
  children,
}: {
  fitBounds: Rect
  fitPad: FitPad
  children: (v: ViewInfo) => ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const cam = useEditor((s) => s.camera)
  const setCamera = useEditor((s) => s.setCamera)
  const setCursor = useEditor((s) => s.setCursor)
  const setViewSize = useEditor((s) => s.setViewSize)
  const fitRequest = useEditor((s) => s.fitRequest)
  const tool = useEditor((s) => s.tool)
  const rulers = useEditor((s) => s.guides.rulers)

  const pointers = useRef(new Map<number, { x: number; y: number; touch: boolean }>())
  const drag = useRef<Drag | null>(null)
  const space = useRef(false)
  const [panning, setPanning] = useState(false)
  const [spaceDown, setSpaceDown] = useState(false)

  // Latest camera for native listeners registered once.
  const camRef = useRef(cam)
  useLayoutEffect(() => {
    camRef.current = cam
  }, [cam])

  const sizeRef = useRef(size)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const prev = sizeRef.current
      // Keep the scene centred while the window resizes.
      if (prev.w > 0) {
        const c = camRef.current
        setCamera({ ...c, x: c.x + (width - prev.w) / 2, y: c.y + (height - prev.h) / 2 })
      }
      sizeRef.current = { w: width, h: height }
      setSize(sizeRef.current)
      setViewSize(sizeRef.current)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [setCamera, setViewSize])

  // Fit on explicit requests (format or view change, Fit key) and on first layout.
  const hasSize = size.w > 0 && size.h > 0
  useLayoutEffect(() => {
    if (!hasSize) return
    const r = rulers ? RULER : 0
    const availW = size.w - fitPad.l - fitPad.r - r
    const availH = size.h - fitPad.t - fitPad.b - r
    const zoom = clampZoom(Math.min(availW / fitBounds.w, availH / fitBounds.h))
    setCamera({
      zoom,
      x: r + fitPad.l + (availW - fitBounds.w * zoom) / 2 - fitBounds.x * zoom,
      y: r + fitPad.t + (availH - fitBounds.h * zoom) / 2 - fitBounds.y * zoom,
    })
    // Deliberately not refitting when bounds or size change on their own.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest, hasSize])

  // Wheel and Safari gesture events must be non-passive to stop page zoom.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const local = (e: { clientX: number; clientY: number }) => {
      const b = el.getBoundingClientRect()
      return { x: e.clientX - b.left, y: e.clientY - b.top }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const c = camRef.current
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1
      if (e.ctrlKey || e.metaKey) {
        const p = local(e)
        const d = Math.max(-60, Math.min(60, e.deltaY * unit))
        setCamera(zoomAt(c, c.zoom * Math.exp(-d * 0.01), p.x, p.y))
      } else {
        const dx = (e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX) * unit
        const dy = (e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY) * unit
        setCamera({ ...c, x: c.x - dx, y: c.y - dy })
      }
    }
    let gestureBase: Camera | null = null
    const touchesActive = () => [...pointers.current.values()].some((p) => p.touch)
    const onGestureStart = (e: Event) => {
      e.preventDefault()
      // On iPad these accompany touch pinches, which pointer events already handle.
      gestureBase = touchesActive() ? null : camRef.current
    }
    const onGestureChange = (e: Event) => {
      e.preventDefault()
      if (!gestureBase) return
      const g = e as GestureEvent
      const p = local(g)
      setCamera(zoomAt(gestureBase, gestureBase.zoom * g.scale, p.x, p.y))
    }
    const onGestureEnd = (e: Event) => {
      e.preventDefault()
      gestureBase = null
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('gesturestart', onGestureStart)
    el.addEventListener('gesturechange', onGestureChange)
    el.addEventListener('gestureend', onGestureEnd)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('gesturestart', onGestureStart)
      el.removeEventListener('gesturechange', onGestureChange)
      el.removeEventListener('gestureend', onGestureEnd)
    }
  }, [setCamera])

  // Space bar = temporary hand tool, as in every design app since the 90s.
  useEffect(() => {
    const typing = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !typing(e.target)) {
        e.preventDefault()
        space.current = true
        setSpaceDown(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        space.current = false
        setSpaceDown(false)
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const localPoint = (e: React.PointerEvent) => {
    const b = ref.current!.getBoundingClientRect()
    return { x: e.clientX - b.left, y: e.clientY - b.top }
  }

  const touchPair = () => [...pointers.current.values()].filter((p) => p.touch).slice(0, 2)

  const onPointerDown = (e: React.PointerEvent) => {
    const p = localPoint(e)
    pointers.current.set(e.pointerId, { ...p, touch: e.pointerType === 'touch' })
    ref.current!.setPointerCapture(e.pointerId)
    const touches = touchPair()
    if (touches.length === 2) {
      const [a, b] = touches
      drag.current = {
        kind: 'pinch',
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        cam,
      }
      setPanning(true)
    } else if (tool === 'hand' || space.current || e.button === 1) {
      e.preventDefault()
      drag.current = { kind: 'pan', sx: p.x, sy: p.y, cam }
      setPanning(true)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const p = localPoint(e)
    if (e.pointerType !== 'touch' || pointers.current.size <= 1) {
      setCursor({ x: (p.x - cam.x) / cam.zoom, y: (p.y - cam.y) / cam.zoom })
    }
    const tracked = pointers.current.get(e.pointerId)
    if (!tracked) return
    tracked.x = p.x
    tracked.y = p.y
    const d = drag.current
    if (d?.kind === 'pan') {
      setCamera({ ...d.cam, x: d.cam.x + p.x - d.sx, y: d.cam.y + p.y - d.sy })
    } else if (d?.kind === 'pinch') {
      const [a, b] = touchPair()
      if (!a || !b) return
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const z = clampZoom(d.cam.zoom * (dist / Math.max(1, d.dist)))
      // Zoom about the starting midpoint, then follow the fingers' travel.
      const wx = (d.mx - d.cam.x) / d.cam.zoom
      const wy = (d.my - d.cam.y) / d.cam.zoom
      setCamera({ zoom: z, x: mx - wx * z, y: my - wy * z })
    }
  }

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    const d = drag.current
    if (d?.kind === 'pinch' && touchPair().length < 2) drag.current = null
    if (d?.kind === 'pan') drag.current = null
    if (!drag.current) setPanning(false)
  }

  const cls = ['workspace']
  if (panning) cls.push('workspace--panning')
  else if (tool === 'hand' || spaceDown) cls.push('workspace--hand')

  return (
    <div
      ref={ref}
      className={cls.join(' ')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setCursor(null)
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {size.w > 0 && (
        <svg width={size.w} height={size.h}>
          <MatGrid cam={cam} size={size} />
          {children({ cam, size })}
          {rulers && <Rulers cam={cam} size={size} />}
        </svg>
      )}
    </div>
  )
}

/** Cutting-mat grid: a line every 10 mm, a stronger one every 50 mm. */
function MatGrid({ cam, size }: ViewInfo) {
  const lines = (step: number) => {
    if (step * cam.zoom < 9) return ''
    let d = ''
    const x0 = Math.floor(-cam.x / cam.zoom / step) * step
    const x1 = (size.w - cam.x) / cam.zoom
    for (let x = x0; x <= x1; x += step) {
      const sx = Math.round(cam.x + x * cam.zoom) + 0.5
      d += `M${sx} 0V${size.h}`
    }
    const y0 = Math.floor(-cam.y / cam.zoom / step) * step
    const y1 = (size.h - cam.y) / cam.zoom
    for (let y = y0; y <= y1; y += step) {
      const sy = Math.round(cam.y + y * cam.zoom) + 0.5
      d += `M0 ${sy}H${size.w}`
    }
    return d
  }
  return (
    <g pointerEvents="none">
      <rect width={size.w} height={size.h} fill="var(--graphite)" />
      <path d={lines(10)} stroke="var(--grid)" strokeWidth={1} />
      <path d={lines(50)} stroke="var(--grid-strong)" strokeWidth={1} />
    </g>
  )
}
