import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CATALOG, cssFamily, fontEntry, nearestWeight, type FontCategory } from '../../fonts/registry'
import type { TextAlign, TextLayer } from '../../model/doc'
import { useDoc } from '../../store/doc'
import { useEditor } from '../../store/editor'
import { ColorRow } from '../../ui/ColorRow'
import { LcdField, Panel, Segmented, Toggle } from '../../ui/controls'
import { RichTextBox, StyleKeys, type RichTextHandle } from './RichTextBox'

interface TypeStyle {
  family: string
  weight: number
  sizePt: number
  leadingPt: number
  tracking: number
  align: TextAlign
  uppercase: boolean
  color: string
  knockout: boolean
}

const WEIGHT_NAMES: Record<number, string> = { 400: 'Reg', 500: 'Med', 700: 'Bold', 800: 'XBold', 900: 'Black' }

const STYLE_LABEL: Record<string, string> = {
  grotesk: 'Grotesk',
  geometric: 'Geometric',
  display: 'Display',
  tech: 'Technical',
  condensed: 'Condensed',
  mono: 'Mono',
  serif: 'Serif',
}

function FontPicker({ family, onPick }: { family: string; onPick: (family: string) => void }) {
  const current = fontEntry(family)
  const [open, setOpen] = useState(false)
  const [cat, setCat] = useState<FontCategory>(current.category)
  const list = CATALOG.filter((f) => f.category === cat)
  const groups = [...new Set(list.map((f) => f.style))]
  return (
    <div className="field">
      <span className="field-label">Typeface</span>
      <button type="button" className="font-current" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span style={{ fontFamily: cssFamily(current, nearestWeight(current, 800)), fontWeight: nearestWeight(current, 800) }}>
          {current.family}
        </span>
        <span className="font-caret">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="font-browser">
          <Segmented<FontCategory>
            label="Font category"
            fill
            size="sm"
            value={cat}
            onChange={setCat}
            options={[
              { value: 'sans', label: `Sans · ${CATALOG.filter((f) => f.category === 'sans').length}` },
              { value: 'serif', label: 'Serif' },
              { value: 'mono', label: 'Mono' },
            ]}
          />
          <div className="font-list" role="listbox" aria-label="Typefaces">
            {groups.map((g) => (
              <div key={g} className="font-group">
                <div className="font-group-label">{STYLE_LABEL[g] ?? g}</div>
                {list
                  .filter((f) => f.style === g)
                  .map((f) => {
                    const w = nearestWeight(f, 800)
                    return (
                      <button
                        key={f.id}
                        type="button"
                        role="option"
                        aria-selected={f.family === current.family}
                        aria-pressed={f.family === current.family}
                        className="font-item"
                        onClick={() => {
                          onPick(f.family)
                          setOpen(false)
                        }}
                      >
                        <span style={{ fontFamily: cssFamily(f, w), fontWeight: w }}>{f.family}</span>
                        <small>{f.weights.length > 1 ? `${f.weights.length} wts` : '1 wt'}</small>
                      </button>
                    )
                  })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TypeControls({ value, onChange }: { value: TypeStyle; onChange: (p: Partial<TypeStyle>) => void }) {
  const entry = fontEntry(value.family)
  const weight = nearestWeight(entry, value.weight)
  return (
    <>
      <FontPicker family={value.family} onPick={(family) => onChange({ family, weight: nearestWeight(fontEntry(family), value.weight) })} />
      {entry.weights.length > 1 && (
        <div className="field">
          <span className="field-label">Weight</span>
          <Segmented
            label="Weight"
            fill
            size="sm"
            value={String(weight)}
            onChange={(w) => onChange({ weight: Number(w) })}
            options={entry.weights.map((w) => ({ value: String(w), label: WEIGHT_NAMES[w] ?? String(w), title: String(w) }))}
          />
        </div>
      )}
      <div className="grid-2">
        <LcdField
          label="Size"
          unit="pt"
          value={value.sizePt}
          step={1}
          min={2}
          max={1200}
          decimals={1}
          // Leading follows size, keeping the same ratio, until set by hand.
          onChange={(sizePt) => onChange({ sizePt, leadingPt: Math.round(((value.leadingPt / value.sizePt) * sizePt) * 10) / 10 })}
        />
        <LcdField label="Leading" unit="pt" value={value.leadingPt} step={1} min={0} max={1500} decimals={1} onChange={(leadingPt) => onChange({ leadingPt })} />
        <LcdField label="Tracking" unit="/1000" value={value.tracking} step={5} min={-300} max={1500} onChange={(tracking) => onChange({ tracking })} />
        <div className="field">
          <span className="field-label">Align</span>
          <Segmented<TextAlign>
            label="Alignment"
            fill
            size="sm"
            value={value.align}
            onChange={(align) => onChange({ align })}
            options={[
              { value: 'left', label: 'L', title: 'Left' },
              { value: 'center', label: 'C', title: 'Centre' },
              { value: 'right', label: 'R', title: 'Right' },
            ]}
          />
        </div>
      </div>
      <div className="grid-2">
        <Toggle on={value.uppercase} onChange={(uppercase) => onChange({ uppercase })}>
          All caps
        </Toggle>
        <Toggle on={value.knockout} onChange={(knockout) => onChange({ knockout })}>
          Knockout
        </Toggle>
      </div>
      {value.knockout ? (
        <KnockoutNote />
      ) : (
        <ColorRow label="Colour" allowNone={false} value={value.color} onChange={(c) => onChange({ color: c ?? '#111111' })} />
      )}
    </>
  )
}

/** What a knockout does, in place of the colour it no longer uses. */
export function KnockoutNote() {
  return (
    <p className="note">
      The letters print <b>no ink</b>, whatever is beneath them, so the card shows through. To see its colour
      here, turn on <b>Card stock</b> (Document) and set Paper to your card.
    </p>
  )
}

export function TextPanel({ layer }: { layer: TextLayer }) {
  const update = useDoc((s) => s.updateLayer)
  const begin = useDoc((s) => s.beginGesture)
  const end = useDoc((s) => s.endGesture)
  const textFocus = useEditor((s) => s.textFocus)
  const textFocused = useEditor((s) => s.textFocused)
  const editor = useRef<RichTextHandle>(null)
  const [active, setActive] = useState({ bold: false, italic: false })

  // A typing session ends when another layer is picked or the panel closes:
  // iPad never blurs a field that simply goes away, which used to leave the
  // session open and undo switched off.
  useLayoutEffect(
    () => () => {
      const box = document.activeElement
      if (box instanceof HTMLElement && box.isContentEditable) box.blur()
      end()
    },
    [layer.id, end],
  )

  // Placing text (or double-tapping it) asks for the keyboard, even if this panel only just appeared.
  useEffect(() => {
    if (!textFocus || !editor.current) return
    textFocused()
    editor.current.focusAll()
  }, [textFocus, textFocused])

  return (
    <Panel num="03" it="TESTO" en="Type">
      <div className="field">
        <span className="field-label">Text</span>
        <RichTextBox
          ref={editor}
          text={layer.text}
          spans={layer.spans ?? []}
          family={layer.family}
          // A whole typing session is one undo step.
          onFocus={begin}
          onBlur={end}
          onActive={setActive}
          onChange={(text, spans) => update<TextLayer>(layer.id, { text, spans })}
        />
        <StyleKeys editor={editor} active={active} />
      </div>
      <TypeControls value={{ ...layer, knockout: !!layer.knockout }} onChange={(p) => update<TextLayer>(layer.id, p)} />
    </Panel>
  )
}

/** Defaults for the next text you place. */
export function TextToolPanel() {
  const st = useEditor((s) => s.style)
  const setStyle = useEditor((s) => s.setStyle)
  const value: TypeStyle = {
    family: st.fontFamily,
    weight: st.fontWeight,
    sizePt: st.fontSizePt,
    leadingPt: st.leadingPt,
    tracking: st.tracking,
    align: st.textAlign,
    uppercase: st.uppercase,
    color: st.textColor,
    knockout: st.textKnockout,
  }
  return (
    <Panel num="03" it="TESTO" en="New text">
      <TypeControls
        value={value}
        onChange={(p) =>
          setStyle({
            ...(p.family !== undefined && { fontFamily: p.family }),
            ...(p.weight !== undefined && { fontWeight: p.weight }),
            ...(p.sizePt !== undefined && { fontSizePt: p.sizePt }),
            ...(p.leadingPt !== undefined && { leadingPt: p.leadingPt }),
            ...(p.tracking !== undefined && { tracking: p.tracking }),
            ...(p.align !== undefined && { textAlign: p.align }),
            ...(p.uppercase !== undefined && { uppercase: p.uppercase }),
            ...(p.color !== undefined && { textColor: p.color }),
            ...(p.knockout !== undefined && { textKnockout: p.knockout }),
          })
        }
      />
      <p className="note">
        <b>Tap</b> the cover to place text, then type in the box above the controls. Text prints as outlines, exactly as
        shown.
      </p>
    </Panel>
  )
}
