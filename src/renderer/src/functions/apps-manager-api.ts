/**
 * Apps Manager API - Frontend interface to communicate with Electron IPC
 * Ye file renderer process mein chlta hai
 */

interface AppResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * App ko open karo
 */
export async function openApp(appName: string): Promise<AppResult> {
  try {
    if (!appName || !appName.trim()) {
      return {
        success: false,
        error: 'App name is required'
      }
    }

    // IPC se backend ko call karo
    const result = await window.electron?.ipcRenderer?.invoke('open-app', appName.trim())

    if (!result) {
      return {
        success: false,
        error: 'No response from system'
      }
    }

    console.log(`[openApp] ${appName}:`, result)
    return result
  } catch (error: any) {
    console.error(`[openApp] Error opening ${appName}:`, error)
    return {
      success: false,
      error: error?.message || 'Unknown error occurred'
    }
  }
}

/**
 * App ko close karo
 */
export async function closeApp(appName: string): Promise<AppResult> {
  try {
    if (!appName || !appName.trim()) {
      return {
        success: false,
        error: 'App name is required'
      }
    }

    const result = await window.electron?.ipcRenderer?.invoke('close-app', appName.trim())

    if (!result) {
      return {
        success: false,
        error: 'No response from system'
      }
    }

    console.log(`[closeApp] ${appName}:`, result)
    return result
  } catch (error: any) {
    console.error(`[closeApp] Error closing ${appName}:`, error)
    return {
      success: false,
      error: error?.message || 'Unknown error occurred'
    }
  }
}

/**
 * Check karo app running hai ya nahi
 */
export async function isAppRunning(appName: string): Promise<boolean> {
  try {
    const result = await window.electron?.ipcRenderer?.invoke('check-app-running', appName.trim())
    return result?.running || false
  } catch (error) {
    console.error(`[isAppRunning] Error checking ${appName}:`, error)
    return false
  }
}

/**
 * Multiple apps ko open karo
 */
export async function openApps(appNames: string[]): Promise<AppResult[]> {
  return Promise.all(appNames.map((name) => openApp(name)))
}

/**
 * Multiple apps ko close karo
 */
export async function closeApps(appNames: string[]): Promise<AppResult[]> {
  return Promise.all(appNames.map((name) => closeApp(name)))
}

/**
 * Web search karo Google par
 */
export async function performWebSearch(query: string = 'google.com'): Promise<string> {
  try {
    const trimmed = query?.trim()
    const searchTerm = trimmed && trimmed.length > 0 ? trimmed : 'google.com'
    await window.electron?.ipcRenderer?.invoke('google-search', searchTerm)
    return `Opening browser for: ${searchTerm}`
  } catch (error: any) {
    console.error(`[performWebSearch] Error:`, error)
    return `Error: ${error?.message || 'Search failed'}`
  }
}
