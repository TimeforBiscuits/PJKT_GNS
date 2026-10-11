import { describe, expect, it } from 'vitest'
import { baseName, cleanFileName } from './files'

describe('file names', () => {
  it('keeps a typed name, minus characters no file system allows', () => {
    expect(cleanFileName('Spring / Summer: "Milano" 2026?')).toBe('Spring - Summer- -Milano- 2026-')
    expect(cleanFileName('  covers.pdf ')).toBe('covers')
    expect(cleanFileName('...hidden')).toBe('hidden')
  })

  it('falls back to a dated name', () => {
    expect(baseName('', 'covers')).toMatch(/^PJKT_GNS-covers-\d{8}-\d{4}$/)
    expect(baseName('Nuova Collezione', 'project')).toBe('Nuova Collezione')
  })
})
