import { ppiColor } from '../../editor/draw'
import { addImagesFromPicker } from '../../editor/interact'
import { layerPpi, placeContent } from '../../editor/importImage'
import { bleedFrame, type ImageLayer } from '../../model/doc'
import { useAssets } from '../../store/assets'
import { activeCover, useDoc } from '../../store/doc'
import { Key, Panel, Toggle } from '../../ui/controls'

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

export function ImagePanel({ layer }: { layer: ImageLayer }) {
  const asset = useAssets((s) => s.assets[layer.assetId])
  const update = useDoc((s) => s.updateLayer)
  const contentEdit = useDoc((s) => s.contentEdit)
  const setContentEdit = useDoc((s) => s.setContentEdit)
  const set = (patch: Partial<ImageLayer>) => update<ImageLayer>(layer.id, patch)
  const ppi = asset ? layerPpi(layer, asset) : 0

  const place = (mode: 'fill' | 'fit') =>
    asset && set({ content: placeContent(asset.width, asset.height, layer.w, layer.h, mode) })

  const fullBleed = () => {
    if (!asset) return
    const f = bleedFrame(activeCover())
    set({ ...f, content: placeContent(asset.width, asset.height, f.w, f.h, 'fill') })
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
      <Toggle on={contentEdit} onChange={setContentEdit} chip="var(--guide-trim)">
        Move picture in frame
      </Toggle>
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
        <b>Double-tap</b> the picture (or the toggle above) to slide it inside its frame; drag its cyan corners to
        scale. Frame handles crop.
      </p>
    </Panel>
  )
}
