/** Open the system file picker for images (Files/Photos sheet on iPad). */
export function pickImages(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*,.heic,.heif,.tif,.tiff'
    input.multiple = true
    input.style.display = 'none'
    document.body.appendChild(input)
    let done = false
    const finish = (files: File[]) => {
      if (done) return
      done = true
      input.remove()
      resolve(files)
    }
    input.addEventListener('change', () => finish([...(input.files ?? [])]))
    input.addEventListener('cancel', () => finish([]))
    input.click()
  })
}
