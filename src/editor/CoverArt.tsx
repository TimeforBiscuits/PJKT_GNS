import { BLEED_MM, panelSize, type CoverFormat } from '../model/formats'

/**
 * Everything printed on a cover, drawn in cover millimetres (origin at the
 * trim's top-left corner, bleed at negative coordinates). Shared by the
 * cover editor and the sheet preview so both always show the same thing.
 *
 * Until image, shape and text layers arrive this draws a demo composition
 * in the "clean, bold sans, weighted lines" direction, so the bleed and
 * fold have something real to sit on.
 */
export function CoverArt({ format, demo }: { format: CoverFormat; demo: boolean }) {
  const b = BLEED_MM
  const { w: pw, h: ph } = panelSize(format)
  const W = format.trim.w
  return (
    <g>
      <rect x={-b} y={-b} width={W + 2 * b} height={ph + 2 * b} fill="#fff" />
      {demo && <Demo format={format} pw={pw} ph={ph} b={b} />}
    </g>
  )
}

function Demo({ format, pw, ph, b }: { format: CoverFormat; pw: number; ph: number; b: number }) {
  const s = 3 // safe inset
  const big = Math.min(pw * 0.3, 30)
  return (
    <g fontFamily="'Archivo Variable', Archivo, sans-serif">
      {/* front: full-bleed black field with a signal rule running off the edge */}
      <rect x={pw} y={-b} width={pw + b} height={ph + 2 * b} fill="#111" />
      <rect x={pw} y={ph * 0.56} width={pw + b} height={4.2} fill="#ff4f00" />
      <text
        x={pw + s + 4}
        y={ph * 0.56 - 3}
        fill="#fff"
        fontSize={big}
        fontWeight={900}
        style={{ fontStretch: '112%' }}
        letterSpacing={-0.02 * big}
      >
        GNS
      </text>
      <text x={pw + s + 4} y={s + 9} fill="#fff" fontSize={3.4} fontWeight={700} letterSpacing={0.5}>
        PJKT — 01
      </text>
      <text
        x={pw + s + 4}
        y={ph - s - 6}
        fill="#8f8a7f"
        fontSize={2.6}
        fontFamily="'IBM Plex Mono', monospace"
        letterSpacing={0.2}
      >
        {format.name.toUpperCase()} / MILANO
      </text>

      {/* back: paper with one weighted line bleeding off the spine-less edge */}
      <rect x={-b} y={ph - 26} width={pw * 0.72 + b} height={2.4} fill="#111" />
      <text x={s + 4} y={ph - 14} fill="#111" fontSize={4.2} fontWeight={800} letterSpacing={-0.1}>
        Project Gans
      </text>
      <text
        x={s + 4}
        y={ph - s - 6}
        fill="#6b665c"
        fontSize={2.4}
        fontFamily="'IBM Plex Mono', monospace"
        letterSpacing={0.15}
      >
        {format.trim.w} × {format.trim.h} — FOLD AT {pw}
      </text>
      <circle cx={pw - s - 10} cy={s + 11} r={6} fill="none" stroke="#111" strokeWidth={1.6} />
    </g>
  )
}
