export interface SystemStats {
  cpu: string
  memory: {
    total: string
    free: string
    usedPercentage: string
  }
  temperature: number
  os: {
    type: string
    uptime: string
  }
}

export interface AppItem {
  name: string
  id: string
}

export interface CalendarEvent {
  name: string
  path: string
  state: string
  author: string
  lastRun: string | null
  nextRun: string | null
  result: string
}

export interface CalendarData {
  date: string
  timezone: string
  events: CalendarEvent[]
}

export const getSystemStatus = async (): Promise<SystemStats | null> => {
  try {
    return await window.electron.ipcRenderer.invoke('get-system-stats')
  } catch (error) {
    return null
  }
}

export const getAllApps = async (): Promise<AppItem[]> => {
  try {
    const apps = await window.electron.ipcRenderer.invoke('get-installed-apps')
    return Array.isArray(apps) ? apps : []
  } catch (error) {
    return []
  }
}

export const getDrives = async (): Promise<any[]> => {
  try {
    return await window.electron.ipcRenderer.invoke('get-drives')
  } catch (error) {
    return []
  }
}

export const getCalendarEvents = async (): Promise<CalendarData | null> => {
  try {
    return await window.electron.ipcRenderer.invoke('get-calendar-events')
  } catch (error) {
    return null
  }
}
