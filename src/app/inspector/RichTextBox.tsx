import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { cssFamily, fontEntry } from '../../fonts/registry'
import { variantFor } from '../../fonts/variants'
import type { TextSpan } from '../../model/doc'
import { runsOf, spansFromFlags } from '../../model/richtext'

// The text box: type freely, select words and tap B or I (or ⌘B / ⌘I).
// It's an editable element showing bold and italic as you set them; what it
// holds is read back as plain text plus bold/italic ranges.

const isBlock = (n: Node) => n instanceof HTMLElement && (n.tagName === 'DIV' || n.tagName === 'P')

/** Read the editor back into text + spans. */
function readDom(root: HTMLElement): { text: string; spans: TextSpan[] } {
  let text = ''
  const bold: number[] = []
  const italic: number[] = []
  const push = (s: string, b: boolean, i: boolean) => {
    for (let k = 0; k < s.length; k++) {
      text += s[k]
      bold.push(b ? 1 : 0)
      italic.push(i ? 1 : 0)
    }
  }
  const walk = (n: Node, b: boolean, i: boolean) => {
    if (n.nodeType === Node.TEXT_NODE) {
      push((n as Text).data.replace(/ /g, ' '), b, i)
      return
    }
    if (!(n instanceof HTMLElement)) return
    const tag = n.tagName
    if (tag === 'BR') {
      // A <br> that ends its block only holds an empty line open; it adds no text.
      const parent = n.parentNode
      if (parent && parent.lastChild === n && (parent === root || isBlock(parent))) return
      push('\n', false, false)
      return
    }
    let nb = b
    let ni = i
    if (tag === 'B' || tag === 'STRONG') nb = true
    if (tag === 'I' || tag === 'EM') ni = true
    const fw = n.style.fontWeight
    if (fw) nb = fw === 'bold' || fw === 'bolder' || Number(fw) >= 600
    const fs = n.style.fontStyle
    if (fs) ni = fs === 'italic' || fs === 'oblique'
    if (isBlock(n) && text.length && !text.endsWith('\n')) push('\n', false, false)
    n.childNodes.forEach((c) => walk(c, nb, ni))
  }
  root.childNodes.forEach((c) => walk(c, false, false))
  return { text, spans: spansFromFlags(bold, italic) }
}

/** Write text + spans into the editor. */
function writeDom(root: HTMLElement, text: string, spans: TextSpan[]) {
  root.replaceChildren()
  for (const r of runsOf(text.length, spans)) {
    const parts = text.slice(r.start, r.end).split('\n')
    parts.forEach((part, i) => {
      if (i > 0) root.appendChild(document.createElement('br'))
      if (!part) return
      if (!r.bold && !r.italic) {
        root.appendChild(document.createTextNode(part))
        return
      }
      const span = document.createElement('span')
      if (r.bold) span.style.fontWeight = '700'
      if (r.italic) span.style.fontStyle = 'italic'
      span.textContent = part
      root.appendChild(span)
    })
  }
  // An empty last line needs a placeholder to be visible.
  if (text.endsWith('\n')) root.appendChild(document.createElement('br'))
}

const sig = (text: string, spans: TextSpan[]) => JSON.stringify([text, spans])

export interface RichTextHandle {
  focusAll: () => void
  /** Toggle bold or italic on the selection (the whole text if nothing is selected). */
  toggle: (style: 'bold' | 'italic') => void
}

export const RichTextBox = forwardRef<
  RichTextHandle,
  {
    text: string
    spans: TextSpan[]
    family: string
    onChange: (text: string, spans: TextSpan[]) => void
    onFocus?: () => void
    onBlur?: () => void
    onActive?: (s: { bold: boolean; italic: boolean }) => void
  }
>(function RichTextBox({ text, spans, family, onChange, onFocus, onBlur, onActive }, ref) {
  const el = useRef<HTMLDivElement>(null)
  const shown = useRef('')

  // Only rewrite the editor when the layer changed from outside (undo,
  // another layer selected) — never while you type, which would lose the caret.
  useLayoutEffect(() => {
    const s = sig(text, spans)
    if (!el.current || s === shown.current) return
    writeDom(el.current, text, spans)
    shown.current = s
  }, [text, spans])

  const read = () => {
    if (!el.current) return
    const next = readDom(el.current)
    shown.current = sig(next.text, next.spans)
    onChange(next.text, next.spans)
  }

  const selectionInside = () => {
    const sel = window.getSelection()
    return !!sel && sel.rangeCount > 0 && !!el.current?.contains(sel.anchorNode) && !sel.isCollapsed
  }

  useImperativeHandle(ref, () => ({
    focusAll: () => {
      const node = el.current
      if (!node) return
      node.focus()
      const r = document.createRange()
      r.selectNodeContents(node)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(r)
    },
    toggle: (style) => {
      const node = el.current
      if (!node) return
      if (!selectionInside()) {
        node.focus()
        document.execCommand('selectAll')
      }
      document.execCommand('styleWithCSS', false, 'false')
      document.execCommand(style)
      read()
    },
  }))

  // Light up B / I for the selection.
  useEffect(() => {
    if (!onActive) return
    const update = () => {
      const sel = window.getSelection()
      if (!sel || !el.current?.contains(sel.anchorNode)) return
      onActive({ bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic') })
    }
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [onActive])

  const entry = fontEntry(family)
  const bold = variantFor(family, 400, true, false)
  const ital = variantFor(family, 400, false, true)
  const name = cssFamily(entry, variantFor(family, 400, false, false).weight)
  cssFamily(entry, bold.weight)
  if (ital.italic) cssFamily(entry, ital.weight, true)

  return (
    <div
      ref={el}
      className="text-input rich-text"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="Text"
      spellCheck={false}
      style={{ fontFamily: `${name}, var(--font-ui)` }}
      onInput={read}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          document.execCommand('insertLineBreak')
        }
      }}
      onPaste={(e) => {
        // Paste words, not someone else's formatting.
        e.preventDefault()
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
      }}
    />
  )
})

/** B / I keys that act on the editor's selection without stealing it. */
export function StyleKeys({ editor, active }: { editor: React.RefObject<RichTextHandle | null>; active: { bold: boolean; italic: boolean } }) {
  const keep = (e: React.SyntheticEvent) => e.preventDefault()
  return (
    <div className="style-keys" role="group" aria-label="Word style">
      <button type="button" className="key key--sm style-key" aria-pressed={active.bold} onPointerDown={keep} onMouseDown={keep} onClick={() => editor.current?.toggle('bold')} title="Bold (⌘B)">
        <b>B</b>
      </button>
      <button type="button" className="key key--sm style-key" aria-pressed={active.italic} onPointerDown={keep} onMouseDown={keep} onClick={() => editor.current?.toggle('italic')} title="Italic (⌘I)">
        <i>I</i>
      </button>
      <span className="note">Select words, then B or I. Nothing selected = whole text.</span>
    </div>
  )
}
