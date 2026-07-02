import { IpcMain, app, dialog, session } from 'electron'
import fs from 'fs'
import path from 'path'

export default function registerSettingsHandlers(ipcMain: IpcMain) {
  ipcMain.removeHandler('clear-cache')
  ipcMain.handle('clear-cache', async () => {
    try {
      const currentSession = session.defaultSession
      await currentSession.clearCache()
      await currentSession.clearStorageData({
        storages: [
          'serviceworkers',
          'localstorage',
          'indexdb',
          'shadercache',
          'filesystem',
          'cachestorage'
        ],
        quotas: ['temporary']
      })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to clear cache' }
    }
  })

  ipcMain.removeHandler('export-logs')
  ipcMain.handle('export-logs', async () => {
    try {
      const defaultPath = app.getPath('desktop')
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Export IRIS Logs',
        defaultPath: path.join(defaultPath, `iris-logs-${new Date().toISOString().slice(0, 10)}.txt`),
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
      })

      if (canceled || !filePath) {
        return { success: false, canceled: true }
      }

      const logData = [
        'IRIS Log Export',
        `Generated: ${new Date().toISOString()}`,
        `App Version: ${app.getVersion()}`,
        `Platform: ${process.platform} ${process.arch}`,
        `User Data Path: ${app.getPath('userData')}`,
        '',
        '-- Process Memory --',
        JSON.stringify(process.memoryUsage(), null, 2),
        '',
        '-- Environment Variables --',
        JSON.stringify(process.env, null, 2),
        '',
        '-- Note --',
        'This export contains runtime metadata and environment details. It is not a full debug log archive.'
      ].join('\n')

      await fs.promises.writeFile(filePath, logData, 'utf-8')
      return { success: true, filePath }
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to export logs' }
    }
  })

  ipcMain.removeHandler('restart-jarvis')
  ipcMain.handle('restart-jarvis', async () => {
    try {
      app.relaunch()
      app.exit(0)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to restart JARVIS' }
    }
  })
}
