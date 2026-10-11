import { create } from 'zustand'

/** An imported picture. The original file is kept untouched for export. */
export interface Asset {
  id: string
  name: string
  /** The original file, exactly as imported. */
  blob: Blob
  /** Pixel size after EXIF orientation. */
  width: number
  height: number
  hasAlpha: boolean
  /** A downscaled copy for the screen… */
  preview: Blob
  /** …and its object URL. */
  previewUrl: string
}

interface AssetState {
  assets: Record<string, Asset>
  add: (a: Asset) => void
  /** Replace everything (opening a project). */
  replace: (assets: Asset[]) => void
}

export const useAssets = create<AssetState>((set) => ({
  assets: {},
  add: (a) => set((s) => ({ assets: { ...s.assets, [a.id]: a } })),
  replace: (list) =>
    set((s) => {
      for (const a of Object.values(s.assets)) URL.revokeObjectURL(a.previewUrl)
      return { assets: Object.fromEntries(list.map((a) => [a.id, a])) }
    }),
}))
