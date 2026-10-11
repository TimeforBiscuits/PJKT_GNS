// Copies the cover-font library out of the @fontsource packages on npm into
// public/fonts and writes src/fonts/catalog.json. Run with `npm run fonts`
// after editing src/fonts/families.json; the output is committed so builds
// need no network.
//
// Only Latin subsets of the regular (upright) styles are taken — they cover
// English, Italian and the rest of Western Europe, plus typographic quotes,
// dashes and €.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const WEIGHTS = [400, 500, 700, 800, 900]
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const families = JSON.parse(fs.readFileSync(path.join(root, 'src/fonts/families.json'), 'utf8'))
const out = path.join(root, 'public/fonts')
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pjkt-fonts-'))

const catalog = []
const licenses = []
for (const f of families) {
  const pkgDir = path.join(tmp, f.id)
  fs.mkdirSync(pkgDir)
  const tgz = execFileSync('npm', ['pack', `@fontsource/${f.id}`, '--silent', '--pack-destination', pkgDir], {
    encoding: 'utf8',
  }).trim()
  execFileSync('tar', ['-xzf', path.join(pkgDir, tgz.split('\n').pop()), '-C', pkgDir])
  const meta = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package/metadata.json'), 'utf8'))
  const have = new Set(meta.weights)
  let weights = WEIGHTS.filter((w) => have.has(w))
  if (!weights.length) weights = [meta.weights.includes(400) ? 400 : meta.weights[0]]
  for (const w of weights) {
    const src = path.join(pkgDir, `package/files/${f.id}-latin-${w}-normal.woff2`)
    fs.copyFileSync(src, path.join(out, `${f.id}-${w}.woff2`))
  }
  catalog.push({ ...f, weights })
  licenses.push(`${f.family} — ${meta.license?.type ?? 'see package'} — ${meta.license?.url ?? ''} (via @fontsource/${f.id} ${meta.version ?? ''})`)
  console.log(`${f.family}: ${weights.join(', ')}`)
}

fs.writeFileSync(path.join(root, 'src/fonts/catalog.json'), JSON.stringify(catalog, null, 2) + '\n')
fs.writeFileSync(
  path.join(out, 'LICENSES.txt'),
  'Cover fonts bundled with PJKT_GNS. Each is free to use, embed and outline in printed work.\n\n' +
    licenses.join('\n') +
    '\n',
)
fs.rmSync(tmp, { recursive: true, force: true })
