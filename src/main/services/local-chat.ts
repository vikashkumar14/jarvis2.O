import { IpcMain } from 'electron'
import { GoogleGenAI } from '@google/genai'

export default function registerLocalChat(ipcMain: IpcMain) {
  ipcMain.handle('send-chat-message', async (event, { message, apiKey }) => {
    try {
      // If an API key is provided, attempt to call Gemini using the same
      // SDK integration used elsewhere in the app.
      let reply: string
      const key = (apiKey || '').trim()
      if (key) {
        try {
          const ai = new GoogleGenAI({ apiKey: key })
          const response = await ai.models.generateContentStream({
            model: 'gemini-3-flash-preview',
            contents: `You are JARVIS, an assistant. Reply to the user request clearly and helpfully.\nUser prompt: ${message}`
          })

          let fullText = ''
          for await (const chunk of response) {
            if (chunk.text) {
              fullText += chunk.text
            }
          }

          reply = fullText.trim()
          if (!reply) {
            throw new Error('Gemini returned no text.')
          }
        } catch (gErr: any) {
          reply = `⚠ Gemini request failed: ${gErr?.message || String(gErr)}. Falling back to local echo.\nI heard: ${message}`
        }
      } else {
        reply = `I heard: ${message}`
      }

      const chunks: string[] = []
      for (let i = 0; i < reply.length; i += 20) {
        chunks.push(reply.slice(i, i + 20))
      }

      // Send chunks with small delays to simulate streaming
      chunks.forEach((chunk, idx) => {
        setTimeout(() => {
          try {
            event.sender.send('chat-message-chunk', chunk)
          } catch (e) {}
        }, idx * 120)
      })

      // Resolve only after all chunks have been sent so the renderer keeps
      // the streaming id active while chunks arrive.
      const totalMs = Math.max(0, chunks.length * 120 + 20)
      await new Promise((resolve) => setTimeout(resolve, totalMs))
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Local chat failed.' }
    }
  })
}
