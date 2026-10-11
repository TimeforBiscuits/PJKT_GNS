import { describe, expect, it } from 'vitest'
import { newCover, uid, type ImageLayer } from '../model/doc'
import { useAssets } from './assets'
import { useDoc } from './doc'
import { readProjectFile, writeProjectFile } from './projectFile'

describe('.gns project files', () => {
  it('round-trips covers, queue and original picture bytes', async () => {
    const original = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3, 4, 5, 0xff, 0xd9])
    const asset = {
      id: uid('as'),
      name: 'photo',
      blob: new Blob([original], { type: 'image/jpeg' }),
      width: 4000,
      height: 3000,
      hasAlpha: false,
      preview: new Blob([new Uint8Array([9, 9, 9])], { type: 'image/jpeg' }),
      previewUrl: 'blob:x',
    }
    const cover = newCover('square', 1)
    const layer: ImageLayer = {
      id: uid('ly'),
      kind: 'image',
      name: 'photo',
      hidden: false,
      locked: false,
      opacity: 1,
      x: -2,
      y: -2,
      w: 284,
      h: 144,
      rotation: 0,
      assetId: asset.id,
      content: { x: 0, y: -34, w: 284, h: 213 },
      flipX: true,
      flipY: false,
    }
    cover.layers.push(layer)
    useAssets.getState().replace([asset])
    useDoc.getState().loadProject({ covers: [cover], queue: { [cover.id]: 3 } })

    const file = await writeProjectFile('test')
    expect(file.name).toBe('test.gns')

    useAssets.getState().replace([])
    useDoc.getState().loadProject({ covers: [newCover('notebook', 1)], queue: {} })
    await readProjectFile(file)

    const { project } = useDoc.getState()
    expect(project.covers).toEqual([cover])
    expect(project.queue[cover.id]).toBe(3)
    const back = useAssets.getState().assets[asset.id]
    expect(back.width).toBe(4000)
    expect(new Uint8Array(await back.blob.arrayBuffer())).toEqual(original)
  })

  it('refuses files that are not projects', async () => {
    const junk = new File([new Uint8Array([1, 2, 3])], 'x.gns')
    await expect(readProjectFile(junk)).rejects.toThrow()
  })
})
