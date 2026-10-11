import { zoomActual, zoomIn, zoomOut, zoomPercent } from '../editor/camera'
import { placeContent } from '../editor/importImage'
import { bleedFrame } from '../model/doc'
import { FORMATS, FORMAT_IDS, type FormatId } from '../model/formats'
import { coversPerSheet } from '../model/imposition'
import { useAssets } from '../store/assets'
import { useActiveCover, useDoc } from '../store/doc'
import { useEditor, type ViewId } from '../store/editor'
import { Key, Led, Segmented } from '../ui/controls'
import { IconFit, IconMinus, IconPlus, IconPrint } from '../ui/icons'

export function TopBar() {
  const formatId = useActiveCover().formatId
  const edit = useDoc((s) => s.edit)
  const view = useEditor((s) => s.view)
  const setView = useEditor((s) => s.setView)
  const zoom = useEditor((s) => s.camera.zoom)
  const pxPerMm = useEditor((s) => s.pxPerMm)
  const requestFit = useEditor((s) => s.requestFit)
  const setCalibrating = useEditor((s) => s.setCalibrating)

  const pct = zoomPercent(zoom, pxPerMm)

  const setFormat = (id: FormatId) => {
    const assets = useAssets.getState().assets
    edit((p, cover) => {
      const old = bleedFrame(cover)
      // A cover still on its default copy count follows the new format's sheet.
      if (p.queue[cover.id] === coversPerSheet(FORMATS[cover.formatId])) p.queue[cover.id] = coversPerSheet(FORMATS[id])
      cover.formatId = id
      const next = bleedFrame(cover)
      // Full-bleed pictures follow the new size; everything else stays put.
      for (const l of cover.layers) {
        const a = l.kind === 'image' ? assets[l.assetId] : undefined
        if (!a || l.kind !== 'image' || l.rotation !== 0) continue
        const was = Math.abs(l.x - old.x) + Math.abs(l.y - old.y) + Math.abs(l.w - old.w) + Math.abs(l.h - old.h)
        if (was > 0.01) continue
        Object.assign(l, next, { content: placeContent(a.width, a.height, next.w, next.h, 'fill') })
      }
    })
    requestFit()
  }

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-word">
          <b>
            <i className="slashes">//</i>PJKT<i>_</i>GNS
          </b>
          <small>Project Gans · Cover Studio</small>
        </div>
      </div>

      <div className="topbar-group">
        <span className="topbar-label">Formato</span>
        <Segmented<FormatId>
          label="Format"
          value={formatId}
          onChange={setFormat}
          options={FORMAT_IDS.map((id) => ({
            value: id,
            label: FORMATS[id].name,
            sub: `${FORMATS[id].trim.w}×${FORMATS[id].trim.h}`,
          }))}
        />
      </div>

      <div className="topbar-group">
        <span className="topbar-label">Vista</span>
        <Segmented<ViewId>
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'cover', label: 'Cover', sub: 'edit' },
            { value: 'sheet', label: 'Sheet', sub: 'A4 print' },
          ]}
        />
      </div>

      <div className="spacer" />

      <div className="topbar-group" role="group" aria-label="Zoom">
        <Key square size="sm" onClick={zoomOut} aria-label="Zoom out" title="Zoom out (⌘/Ctrl −)">
          <IconMinus />
        </Key>
        <span className="lcd zoom-lcd" title="Zoom, as a percentage of real printed size">
          {pct < 10 ? pct.toFixed(1) : Math.round(pct)}
          <span className="unit">%</span>
        </span>
        <Key square size="sm" onClick={zoomIn} aria-label="Zoom in" title="Zoom in (⌘/Ctrl +)">
          <IconPlus />
        </Key>
        <Key size="sm" onClick={requestFit} title="Fit to screen (⌘/Ctrl 0)">
          <IconFit />
          Fit
        </Key>
        <Key size="sm" onClick={zoomActual} title="Real size on screen (⌘/Ctrl 1)">
          1:1
        </Key>
        <Key size="sm" onClick={() => setCalibrating(true)} title="Calibrate real size for this screen">
          <Led on={pxPerMm !== null} />
          Cal
        </Key>
      </div>

      <Key variant="signal" onClick={() => setView('sheet')} title="Lay out covers on A4 and export the PDF">
        <IconPrint />
        Stampa
      </Key>
    </header>
  )
}
