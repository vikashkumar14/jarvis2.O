export const readGalleryImages = async () => {
  try {
    const images: any[] = await window.electron.ipcRenderer.invoke('get-gallery')
    if (!images || images.length === 0) return 'Visual Vault is empty. No images found.'

    return images
      .slice(0, 25)
      .map((img) => `🖼️ Name: "${img.displayName}" | Path: ${img.path}`)
      .join('\n')
  } catch (e) {
    return 'System Error: Could not access Visual Vault.'
  }
}

export const analyzeDirectPhoto = async (filePath: string, socket: WebSocket | null) => {
  try {
    let base64data: string | null = null

    // Prefer main-process binary read (reliable on Windows and with spaces)
    try {
      if (window.electron?.ipcRenderer?.invoke) {
        const b64 = await window.electron.ipcRenderer.invoke('read-file-base64', filePath)
        if (b64) base64data = b64
      }
    } catch (err) {
      base64data = null
    }

    // Fallback to file:// fetch if ipc read failed
    if (!base64data) {
      const url = `file:///${filePath.replace(/\\/g, '/')}`
      const res = await fetch(url)
      if (!res.ok) return '❌ Error loading direct photo.'
      const blob = await res.blob()
      const reader = new FileReader()
      base64data = await new Promise((resolve) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1])
        reader.readAsDataURL(blob)
      })
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          realtimeInput: { mediaChunks: [{ mimeType: 'image/png', data: base64data }] }
        })
      )
      return '✅ Photo successfully injected into your vision. You can now see it. Describe what you see to vikash.'
    } else {
      return '❌ Failed: Connection not open.'
    }
  } catch (e) {
    return '❌ Error loading direct photo.'
  }
}
