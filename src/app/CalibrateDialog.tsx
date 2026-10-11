import { useState } from 'react'
import { CSS_PX_PER_MM } from '../model/units'
import { useEditor } from '../store/editor'
import { Key, Panel } from '../ui/controls'

/** ISO/IEC 7810 ID-1: every bank, ID and loyalty card. */
const CARD_W = 85.6
const CARD_H = 53.98

/**
 * Real-size calibration. Screens report "CSS pixels" that are only nominally
 * 1/96 inch, so 1:1 is only trustworthy after matching a physical card.
 */
export function CalibrateDialog() {
  const pxPerMm = useEditor((s) => s.pxPerMm)
  const setPxPerMm = useEditor((s) => s.setPxPerMm)
  const setCalibrating = useEditor((s) => s.setCalibrating)
  const [width, setWidth] = useState(() => CARD_W * (pxPerMm ?? CSS_PX_PER_MM))

  const close = () => setCalibrating(false)

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Calibrate screen" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dialog">
        <Panel num="◎" it="CALIBRA" en="Calibrate real size">
          <p className="note">
            Hold any <b>bank card</b> flat against the screen and drag the slider until the cyan outline matches the
            card’s width exactly. 1:1 zoom then shows covers at their true printed size on this screen.
          </p>
          <div className="calib-stage">
            <div className="calib-card" style={{ width, height: (width * CARD_H) / CARD_W }} />
          </div>
          <input
            className="slider"
            type="range"
            min={CARD_W * 2}
            max={CARD_W * 9}
            step={0.25}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            aria-label="Card outline width"
          />
          <div className="field-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', gap: 6 }}>
              <Key size="sm" square onClick={() => setWidth((w) => w - 1)} aria-label="Narrower">
                ◀
              </Key>
              <Key size="sm" square onClick={() => setWidth((w) => w + 1)} aria-label="Wider">
                ▶
              </Key>
            </span>
            <span className="lcd">
              {(width / CARD_W).toFixed(3)}
              <span className="unit">px / mm</span>
            </span>
          </div>
          <div className="field-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <Key
              onClick={() => {
                setPxPerMm(null)
                close()
              }}
            >
              Reset
            </Key>
            <Key onClick={close}>Cancel</Key>
            <Key
              variant="signal"
              onClick={() => {
                setPxPerMm(width / CARD_W)
                close()
              }}
            >
              Save
            </Key>
          </div>
        </Panel>
      </div>
    </div>
  )
}
