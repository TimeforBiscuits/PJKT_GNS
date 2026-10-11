import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../store/editor'
import { booted } from './boot'
import '../styles/splash.css'

// The title card: an ident in the manner of a 1995 Milanese studio reel.
// It plays while the last session is restored, then opens down the fold
// like a notebook cover. Tap or press any key to skip.

const SEEN = 'pjkt_gns.splash'

const seenThisSession = () => {
  try {
    return sessionStorage.getItem(SEEN) === '1'
  } catch {
    return false
  }
}

const markSeen = () => {
  try {
    sessionStorage.setItem(SEEN, '1')
  } catch {
    // private mode: play the full title every time
  }
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

const STATUS = ['CARATTERI · FONTS', 'IMMAGINI · PICTURES', 'PROGETTO · PROJECT', 'PRONTO · READY']

/** Ruler ticks for 0–180 mm at 10 units per mm. */
const ticks = (() => {
  let d = ''
  for (let mm = 0; mm <= 180; mm++) {
    const len = mm % 10 === 0 ? 26 : mm % 5 === 0 ? 16 : 9
    d += `M${mm * 10 + 1} 60V${60 - len}`
  }
  return d
})()

function Card({ pct }: { pct: number }) {
  const status = STATUS[Math.min(STATUS.length - 1, Math.floor((pct / 100) * (STATUS.length - 1) + 0.0001))]
  return (
    <div className="sp-card">
      <div className="sp-grid" />
      <i className="sp-crop sp-crop--tl" />
      <i className="sp-crop sp-crop--tr" />
      <i className="sp-crop sp-crop--bl" />
      <i className="sp-crop sp-crop--br" />
      <div className="sp-fold" />

      <header className="sp-top">
        <span>PJKT_GNS / N° 001 — EDIZIONE STUDIO</span>
        <span>MILANO · MCMXCV</span>
      </header>

      <div className="sp-title">
        <h1 className="sp-word" aria-label="PJKT_GNS">
          <span className="sp-slashes">//</span>
          <span className="sp-letters">
            PJKT<em>_</em>GNS
          </span>
          <span className="sp-cursor" />
        </h1>
        <div className="sp-rule" />
        <p className="sp-sub">PROJECT GANS — STUDIO COPERTINE</p>
        <p className="sp-tag">Notebook covers, printed true to the millimetre.</p>
      </div>

      <div className="sp-ruler">
        <div className="sp-span">
          <span>180 × 140 MM</span>
          <span>PIEGA · FOLD 90</span>
        </div>
        <svg viewBox="0 0 1802 62" preserveAspectRatio="none" aria-hidden="true">
          <path d="M1 60H1801" stroke="currentColor" strokeWidth="2" />
          <path d={ticks} stroke="currentColor" strokeWidth="2" />
          <path d="M901 0V62" stroke="#ff4f00" strokeWidth="3" strokeDasharray="4 5" />
        </svg>
      </div>

      <footer className="sp-bottom">
        <div className="sp-bar" aria-hidden="true">
          {['#00aeef', '#ec008c', '#fff200', '#111', '#ff4f00', '#808080', '#fff'].map((c, i) => (
            <i key={c} style={{ background: c, animationDelay: `${0.95 + i * 0.06}s` }} />
          ))}
        </div>
        <div className="sp-lcd">
          <span className="sp-lcd-label">{status}</span>
          <span className="sp-lcd-num">
            {String(Math.round(pct)).padStart(3, '0')}
            <small>%</small>
          </span>
        </div>
      </footer>
    </div>
  )
}

export function Splash({ onDone }: { onDone: () => void }) {
  const [quick] = useState(() => seenThisSession() || reducedMotion())
  const [pct, setPct] = useState(quick ? 100 : 0)
  const [ready, setReady] = useState<{ had: boolean } | null>(null)
  const [exiting, setExiting] = useState(false)
  const done = useRef(false)

  useEffect(() => {
    booted.then((had) => setReady({ had }))
  }, [])

  // The counter runs on one clock, but waits at 92 until the session is back.
  const readyRef = useRef(false)
  useEffect(() => {
    readyRef.current = !!ready
  }, [ready])
  useEffect(() => {
    if (quick) return
    const start = performance.now()
    let raf = 0
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / 1700)
      const eased = 1 - Math.pow(1 - t, 2.2)
      const cap = readyRef.current ? 100 : 92
      setPct((p) => Math.max(p, Math.min(cap, eased * 100)))
      if (t < 1 || !readyRef.current) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [quick])

  const leave = () => {
    if (done.current || !ready) return
    done.current = true
    markSeen()
    setExiting(true)
    setTimeout(
      () => {
        onDone()
        if (ready.had) useEditor.getState().flash('Bentornato — welcome back. Your last session is restored.', 'info')
      },
      reducedMotion() ? 200 : 820,
    )
  }

  // Open once the count reaches 100, after a beat.
  useEffect(() => {
    if (!ready || pct < 100) return
    const t = setTimeout(leave, quick ? 450 : 350)
    return () => clearTimeout(t)
  })

  // Any tap or key skips (once there's something to show).
  useEffect(() => {
    const skip = () => leave()
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)
    return () => {
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  })

  const cls = ['splash']
  if (quick) cls.push('is-quick')
  if (exiting) cls.push('is-exit')
  if (reducedMotion()) cls.push('is-still')

  return (
    <div className={cls.join(' ')} role="status" aria-label="Loading PJKT_GNS">
      <div className="sp-door sp-door--left">
        <Card pct={pct} />
      </div>
      <div className="sp-door sp-door--right" aria-hidden="true">
        <Card pct={pct} />
      </div>
    </div>
  )
}
