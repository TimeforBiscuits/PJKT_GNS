import { useEffect, useState } from 'react'
import { addImages } from './interact'

const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files')

/** Drop pictures anywhere on the window to lay them full-bleed on the open cover. */
export function DropZone() {
  const [over, setOver] = useState(false)
  useEffect(() => {
    let depth = 0
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth++
      setOver(true)
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (!depth) setOver(false)
    }
    const overH = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setOver(false)
      void addImages([...(e.dataTransfer?.files ?? [])])
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', overH)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', overH)
      window.removeEventListener('drop', drop)
    }
  }, [])
  if (!over) return null
  return (
    <div className="dropzone">
      <span>Drop to place full-bleed</span>
    </div>
  )
}
