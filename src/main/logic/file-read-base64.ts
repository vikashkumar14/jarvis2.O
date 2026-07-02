import { IpcMain } from 'electron'
import fs from 'fs'

export default function registerFileReadBase64(ipcMain: IpcMain) {
  ipcMain.handle('read-file-base64', async (_event, filePath: string) => {
    try {
      const buffer = await fs.promises.readFile(filePath)
      return buffer.toString('base64')
    } catch (err) {
      return null
    }
  })
}
