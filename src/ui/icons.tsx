import type { ReactNode } from 'react'

// Tool icons drawn on a 24-unit grid with 2-unit square-capped strokes,
// in the manner of a 90s technical manual.

const Svg = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="square"
    strokeLinejoin="miter"
    aria-hidden="true"
  >
    {children}
  </svg>
)

export const IconSelect = () => (
  <Svg>
    <path d="M5 3 L5 19 L9.5 14.5 L12.5 21 L15 20 L12 13.5 L18 13.5 Z" fill="currentColor" strokeLinejoin="round" />
  </Svg>
)

export const IconHand = () => (
  <Svg>
    <path d="M7 12 V6.5 a1.5 1.5 0 0 1 3 0 V11 M10 10 V4.5 a1.5 1.5 0 0 1 3 0 V11 M13 10 V5.5 a1.5 1.5 0 0 1 3 0 V12 M16 11 V8.5 a1.5 1.5 0 0 1 3 0 V15 c0 4 -2.5 6 -6 6 h-1 c-2.5 0 -4 -1.2 -5.2 -3.2 L4 13.5 a1.6 1.6 0 0 1 2.7 -1.6 L8 14" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
  </Svg>
)

export const IconImage = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" />
    <path d="M3 17 L9 11 L13 15 L16 12 L21 17" />
    <rect x="15" y="7" width="2.5" height="2.5" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconRect = () => (
  <Svg>
    <rect x="4" y="6" width="16" height="12" />
  </Svg>
)

export const IconEllipse = () => (
  <Svg>
    <circle cx="12" cy="12" r="8" />
  </Svg>
)

export const IconPolygon = () => (
  <Svg>
    <path d="M12 3.5 L21 19.5 L3 19.5 Z" />
  </Svg>
)

export const IconLine = () => (
  <Svg>
    <path d="M4 20 L20 4" strokeWidth={2.5} />
  </Svg>
)

export const IconText = () => (
  <Svg>
    <path d="M4 7 V4 H20 V7 M12 4 V20 M8.5 20 H15.5" />
  </Svg>
)

export const IconMinus = () => (
  <Svg>
    <path d="M6 12 H18" strokeWidth={2.5} />
  </Svg>
)

export const IconPlus = () => (
  <Svg>
    <path d="M6 12 H18 M12 6 V18" strokeWidth={2.5} />
  </Svg>
)

export const IconFit = () => (
  <Svg>
    <path d="M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15" />
  </Svg>
)

export const IconPrint = () => (
  <Svg>
    <path d="M7 9 V3 H17 V9" />
    <rect x="3" y="9" width="18" height="8" />
    <path d="M7 14 H17 V21 H7 Z" fill="var(--chassis, #fff)" />
    <path d="M9.5 17.5 H14.5" strokeWidth={1.5} />
  </Svg>
)

export const IconUndo = () => (
  <Svg>
    <path d="M9 5 L4 10 L9 15" />
    <path d="M4 10 H14 a6 6 0 0 1 0 12 H10" />
  </Svg>
)

export const IconRedo = () => (
  <Svg>
    <path d="M15 5 L20 10 L15 15" />
    <path d="M20 10 H10 a6 6 0 0 0 0 12 H14" />
  </Svg>
)

export const IconCopy = () => (
  <Svg>
    <rect x="8" y="8" width="12" height="13" />
    <path d="M5 16 H4 V3 H16 V5" />
  </Svg>
)

export const IconPaste = () => (
  <Svg>
    <path d="M8 5 H5 V21 H19 V5 H16" />
    <rect x="8" y="3" width="8" height="4" fill="currentColor" />
    <path d="M9 12 H15 M9 16 H15" strokeWidth={1.5} />
  </Svg>
)
