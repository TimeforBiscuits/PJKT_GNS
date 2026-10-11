import { ppiColor } from '../../editor/draw'
import { addImagesFromPicker } from '../../editor/interact'
import { layerPpi, placeContent } from '../../editor/importImage'
import { bleedFrame, type ImageLayer } from '../../model/doc'
import { clampToFill, isFullBleed, pictureScale, pictureShift, scalePicture, shiftPicture } from '../../model/picture'
import { useAssets } from '../../store/assets'
import { activeCover, useActiveCover, useDoc } from '../../store/doc'
import { Key, LcdField, Panel, Toggle } from '../../ui/controls'

export function ImageToolPanel() {
  return (
    <Panel num="01" it="IMMAGINE" en="Image">
      <Key variant="ink" onClick={() => void addImagesFromPicker()}>
        Import image…
      </Key>
      <p className="note">
        Or drop files on the canvas{navigator.maxTouchPoints > 1 ? '' : ', or paste'}. New images are placed{' '}
        <b>full-bleed</b>. Double-tap a picture to move it inside its frame; drag the frame’s handles to crop.
      </p>
    </Panel>
  )
}

/** Range slider whose drag counts as one undo step. */
function GestureSlider({ value, min, max, step, onChange, label }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string }) {
  const begin = useDoc((s) => s.beginGesture)
  const end = useDoc((s) => s.endGesture)
  return (
    <input
      className="slider"
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={Math.min(max, Math.max(min, value))}
      onPointerDown={() => {
        begin()
        window.addEventListener('pointerup', () => end(), { once: true })
      }}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

export function ImagePanel({ layer }: { layer: ImageLayer }) {
  const asset = useAssets((s) => s.assets[layer.assetId])
  const update = useDoc((s) => s.updateLayer)
  const contentEdit = useDoc((s) => s.contentEdit)
  const setContentEdit = useDoc((s) => s.setContentEdit)
  const cover = useActiveCover()
  const set = (patch: Partial<ImageLayer>) => update<ImageLayer>(layer.id, patch)
  const ppi = asset ? layerPpi(layer, asset) : 0
  const scale = asset ? pictureScale(layer, asset.width, asset.height) * 100 : 100
  const shift = pictureShift(layer)
  const minScale = layer.fillLock ? 100 : 10
  const fullBleedFrame = isFullBleed(layer, cover)

  const setScale = (pct: number) => asset && set({ content: scalePicture(layer, asset.width, asset.height, pct / 100) })

  const place = (mode: 'fill' | 'fit') =>
    asset && set({ content: placeContent(asset.width, asset.height, layer.w, layer.h, mode), fillLock: mode === 'fill' ? layer.fillLock : false })

  const fullBleed = () => {
    if (!asset) return
    const f = bleedFrame(activeCover())
    set({ ...f, content: placeContent(asset.width, asset.height, f.w, f.h, 'fill'), fillLock: true })
  }

  return (
    <Panel num="01" it="IMMAGINE" en="Image">
      <div className="ppi-meter">
        <span className="field-label">Print resolution</span>
        <span className="lcd lcd--big" style={{ color: ppiColor(ppi) }}>
          {Math.round(ppi)}
          <span className="unit">ppi</span>
          <span className="ppi-verdict">{ppi >= 300 ? 'SHARP' : ppi >= 200 ? 'SOFT' : 'LOW'}</span>
        </span>
        <span className="note">
          {asset ? `${asset.width} × ${asset.height} px` : 'missing'} · placed {layer.content.w.toFixed(1)} ×{' '}
          {layer.content.h.toFixed(1)} mm
        </span>
      </div>

      <div className="field">
        <span className="field-label">Picture scale · 100 % fills the frame</span>
        <GestureSlider label="Picture scale" value={scale} min={minScale} max={400} step={1} onChange={setScale} />
      </div>
      <div className="grid-2">
        <LcdField label="Scale" unit="%" value={Math.round(scale * 10) / 10} step={5} min={minScale} max={800} decimals={1} onChange={setScale} />
        <div className="field">
          <span className="field-label">&nbsp;</span>
          <Key size="sm" onClick={() => set({ content: shiftPicture(layer, { x: 0, y: 0 }) })} title="Centre the picture in its frame">
            Centre
          </Key>
        </div>
        <LcdField label="Shift →" unit="mm" value={Math.round(shift.x * 10) / 10} step={1} decimals={1} onChange={(x) => set({ content: shiftPicture(layer, { x, y: shift.y }) })} />
        <LcdField label="Shift ↓" unit="mm" value={Math.round(shift.y * 10) / 10} step={1} decimals={1} onChange={(y) => set({ content: shiftPicture(layer, { x: shift.x, y }) })} />
      </div>
      <Toggle
        on={layer.fillLock}
        onChange={(fillLock) => set({ fillLock, content: fillLock ? clampToFill(layer.content, layer) : layer.content })}
        chip="var(--guide-bleed)"
      >
        Keep frame filled — no gaps
      </Toggle>
      {!fullBleedFrame && (
        <Toggle on={contentEdit} onChange={setContentEdit} chip="var(--guide-trim)">
          Move picture in frame
        </Toggle>
      )}
      <div className="grid-3">
        <Key size="sm" onClick={() => place('fill')} title="Scale the picture to cover the frame">
          Fill
        </Key>
        <Key size="sm" onClick={() => place('fit')} title="Scale the picture to fit inside the frame">
          Fit
        </Key>
        <Key size="sm" onClick={fullBleed} title="Frame = whole cover including bleed">
          Bleed
        </Key>
        <Key size="sm" onClick={() => set({ flipX: !layer.flipX })} pressed={layer.flipX}>
          Flip ↔
        </Key>
        <Key size="sm" onClick={() => set({ flipY: !layer.flipY })} pressed={layer.flipY}>
          Flip ↕
        </Key>
        <Key size="sm" onClick={() => set({ rotation: ((layer.rotation + 90 + 180) % 360) - 180 })}>
          ⟳ 90°
        </Key>
      </div>
      <p className="note">
        {fullBleedFrame ? (
          <>
            <b>Scale up</b>, then <b>drag the picture</b> on the cover to recompose it against the fold and edges — it
            snaps to the fold and panel centres.
          </>
        ) : (
          <>
            <b>Double-tap</b> the picture to slide it inside its frame; cyan corners scale it. Frame handles crop.
          </>
        )}{' '}
        Alt/⌥ + scroll scales at the pointer.
      </p>
    </Panel>
  )
}
