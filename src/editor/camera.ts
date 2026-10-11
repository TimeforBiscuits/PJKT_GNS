import { actualSizeZoom, useEditor, type Camera } from '../store/editor'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 120

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

/** Keep the world point under screen point (sx, sy) fixed while changing zoom. */
export const zoomAt = (cam: Camera, zoom: number, sx: number, sy: number): Camera => {
  const z = clampZoom(zoom)
  const wx = (sx - cam.x) / cam.zoom
  const wy = (sy - cam.y) / cam.zoom
  return { zoom: z, x: sx - wx * z, y: sy - wy * z }
}

/** Zoom about the centre of the workspace. */
export const zoomCentered = (zoom: number) => {
  const { camera, viewSize, setCamera } = useEditor.getState()
  setCamera(zoomAt(camera, zoom, viewSize.w / 2, viewSize.h / 2))
}

const ZOOM_STEP = 1.25

export const zoomIn = () => zoomCentered(useEditor.getState().camera.zoom * ZOOM_STEP)
export const zoomOut = () => zoomCentered(useEditor.getState().camera.zoom / ZOOM_STEP)

/** 1:1 — the cover at its real printed size on screen (exact once calibrated). */
export const zoomActual = () => zoomCentered(actualSizeZoom(useEditor.getState().pxPerMm))

/** Zoom as a percentage of real size. */
export const zoomPercent = (zoom: number, pxPerMm: number | null) => (zoom / actualSizeZoom(pxPerMm)) * 100
