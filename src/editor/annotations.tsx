// Screen-space drafting annotations: dimension lines, labels and hatches.
// They stay the same pixel size at every zoom.

import { crisp } from './draw'

const ANN = '#a39d91'
const ANN_TEXT = '#d8d3c8'

export function Hatches() {
  return (
    <defs>
      <pattern id="hatch-bleed" patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
        <rect width={6} height={6} fill="rgba(255,176,0,0.22)" />
        <rect width={2} height={6} fill="rgba(255,176,0,0.75)" />
      </pattern>
      <pattern id="hatch-noprint" patternUnits="userSpaceOnUse" width={7} height={7} patternTransform="rotate(-45)">
        <rect width={7} height={7} fill="rgba(35,35,33,0.06)" />
        <rect width={1.5} height={7} fill="rgba(35,35,33,0.28)" />
      </pattern>
    </defs>
  )
}

function Label({ x, y, text, rotate }: { x: number; y: number; text: string; rotate?: boolean }) {
  const w = text.length * 6.2 + 10
  return (
    <g transform={rotate ? `rotate(-90 ${x} ${y})` : undefined}>
      <rect x={x - w / 2} y={y - 8} width={w} height={16} fill="var(--graphite)" />
      <text
        x={x}
        y={y + 3.5}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={10}
        letterSpacing={0.4}
        fill={ANN_TEXT}
      >
        {text}
      </text>
    </g>
  )
}

/** Architectural 45° tick marking the end of a dimension. */
const tick = (x: number, y: number) => `M${x - 4} ${y + 4}L${x + 4} ${y - 4}`

/** Horizontal dimension from x1 to x2 at height y, with extension lines down to `from`. */
export function DimH({ x1, x2, y, from, label }: { x1: number; x2: number; y: number; from: number; label: string }) {
  const a = crisp(x1)
  const b = crisp(x2)
  const yy = crisp(y)
  return (
    <g>
      <path
        d={`M${a} ${from}V${yy - 5}M${b} ${from}V${yy - 5}M${a} ${yy}H${b}${tick(a, yy)}${tick(b, yy)}`}
        stroke={ANN}
        strokeWidth={1}
        fill="none"
      />
      {b - a > 44 && <Label x={(a + b) / 2} y={yy} text={label} />}
    </g>
  )
}

/** Vertical dimension from y1 to y2 at x, with extension lines across to `from`. */
export function DimV({ y1, y2, x, from, label }: { y1: number; y2: number; x: number; from: number; label: string }) {
  const a = crisp(y1)
  const b = crisp(y2)
  const xx = crisp(x)
  return (
    <g>
      <path
        d={`M${from} ${a}H${xx - 5}M${from} ${b}H${xx - 5}M${xx} ${a}V${b}${tick(xx, a)}${tick(xx, b)}`}
        stroke={ANN}
        strokeWidth={1}
        fill="none"
      />
      {b - a > 44 && <Label x={xx} y={(a + b) / 2} text={label} rotate />}
    </g>
  )
}

export function Caption({
  x,
  y,
  children,
  anchor = 'middle',
  color = ANN_TEXT,
  size = 10,
  weight = 700,
}: {
  x: number
  y: number
  children: string
  anchor?: 'start' | 'middle' | 'end'
  color?: string
  size?: number
  weight?: number
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontFamily="var(--font-ui)"
      fontSize={size}
      fontWeight={weight}
      letterSpacing={size * 0.14}
      style={{ fontStretch: '85%' }}
      fill={color}
    >
      {children}
    </text>
  )
}
