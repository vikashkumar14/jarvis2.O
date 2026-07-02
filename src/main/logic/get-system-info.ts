import { IpcMain } from 'electron'
import os from 'os'
import { exec } from 'child_process'
import { getAllApps } from '../services/System_info'

const runCommand = (cmd: string): Promise<string> => {
  return new Promise((resolve) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (_error, stdout) => {
      resolve(stdout ? stdout.trim() : '')
    })
  })
}

let cpuLastSnapshot = os.cpus()

type RawScheduledTask = {
  TaskName?: string
  TaskPath?: string
  State?: string
  Author?: string
  LastRunTime?: string
  NextRunTime?: string
  LastTaskResult?: unknown
}

function getSystemCpuUsage(): string {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  for (let i = 0; i < cpus.length; i++) {
    const cpu = cpus[i]
    const prevCpu = cpuLastSnapshot[i]
    let currentTotal = 0
    for (const type in cpu.times) currentTotal += cpu.times[type]
    let prevTotal = 0
    for (const type in prevCpu.times) prevTotal += prevCpu.times[type]
    idle += cpu.times.idle - prevCpu.times.idle
    total += currentTotal - prevTotal
  }
  cpuLastSnapshot = cpus
  return total === 0 ? '0.0' : (((total - idle) / total) * 100).toFixed(1)
}

export default function registerSystemHandlers(ipcMain: IpcMain) {

  ipcMain.removeHandler('get-installed-apps')
  ipcMain.handle('get-installed-apps', async () => {
    try {
      if (os.platform() !== 'win32') return []
      const apps = await getAllApps()
      return apps.map((app) => ({ name: app.name || '', id: app.id || app.name || '' }))
    } catch (_e) {
      return []
    }
  })

  ipcMain.removeHandler('get-system-stats')
  ipcMain.handle('get-system-stats', async () => {
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    return {
      cpu: getSystemCpuUsage(),
      memory: {
        total: (totalMem / 1024 ** 3).toFixed(1) + ' GB',
        free: (freeMem / 1024 ** 3).toFixed(1) + ' GB',
        usedPercentage: (((totalMem - freeMem) / totalMem) * 100).toFixed(1)
      },
      temperature: 50,
      os: {
        type: 'Windows 11',
        uptime: (os.uptime() / 3600).toFixed(1) + 'h'
      }
    }
  })

  ipcMain.removeHandler('get-drives')
  ipcMain.handle('get-drives', async () => {
    try {
      const cmd = `powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='FreeGB';E={[math]::round($_.Free/1GB, 2)}}, @{N='TotalGB';E={[math]::round(($_.Used + $_.Free)/1GB, 2)}} | ConvertTo-Json -Depth 2"`
      const output = await runCommand(cmd)
      return output ? JSON.parse(output) : []
    } catch (e) {
      return []
    }
  })

  ipcMain.removeHandler('get-calendar-events')
  ipcMain.handle('get-calendar-events', async () => {
    try {
      if (os.platform() !== 'win32') {
        return {
          date: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          events: []
        }
      }

      const cmd = `powershell -NoProfile -Command "$tasks = Get-ScheduledTask | ForEach-Object { $info = $_ | Get-ScheduledTaskInfo; [PSCustomObject]@{ TaskName = $_.TaskName; TaskPath = $_.TaskPath; State = $_.State; Author = $_.Author; LastRunTime = $info.LastRunTime; NextRunTime = $info.NextRunTime; LastTaskResult = $info.LastTaskResult } }; $tasks | Sort-Object NextRunTime | ConvertTo-Json -Depth 3"`
      const output = await runCommand(cmd)
      const rawData = output ? JSON.parse(output) : []
      const events = Array.isArray(rawData) ? rawData : [rawData]
      return {
        date: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        events: events.map((event: RawScheduledTask) => ({
          name: event.TaskName || event.TaskPath || 'Scheduled task',
          path: event.TaskPath || '',
          state: event.State || 'Unknown',
          author: event.Author || '',
          lastRun: event.LastRunTime ? new Date(event.LastRunTime).toISOString() : null,
          nextRun: event.NextRunTime ? new Date(event.NextRunTime).toISOString() : null,
          result: event.LastTaskResult != null ? String(event.LastTaskResult) : 'Unknown'
        }))
      }
    } catch (e) {
      return {
        date: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        events: []
      }
    }
  })
}
