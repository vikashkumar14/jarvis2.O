import { IpcMain } from 'electron'
import { exec } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

const PROTECTED_PROCESSES = [
  'explorer.exe',
  'dwm.exe',
  'svchost.exe',
  'lsass.exe',
  'csrss.exe',
  'wininit.exe',
  'winlogon.exe',
  'services.exe',
  'taskmgr.exe',
  'system',
  'registry'
]

const APP_ALIASES: Record<string, string> = {
  vscode: 'code',
  code: 'code',
  'visual studio code': 'code',
  terminal: 'wt',
  cmd: 'cmd',
  notepad: 'notepad',
  calculator: 'calc',
  settings: 'ms-settings:',
  explorer: 'explorer',
  files: 'explorer',
  'task manager': 'taskmgr',
  chrome: 'chrome',
  'google chrome': 'chrome',
  edge: 'msedge',
  brave: 'brave',
  firefox: 'firefox',
  discord: 'discord',
  spotify: 'spotify',
  telegram: 'telegram',
  steam: 'steam'
}

const PROCESS_NAMES: Record<string, string> = {
  vscode: 'code.exe',
  code: 'code.exe',
  'visual studio code': 'code.exe',
  chrome: 'chrome.exe',
  'google chrome': 'chrome.exe',
  edge: 'msedge.exe',
  brave: 'brave.exe',
  firefox: 'firefox.exe',
  notepad: 'notepad.exe',
  cmd: 'cmd.exe',
  terminal: 'WindowsTerminal.exe',
  whatsapp: 'WhatsApp.exe',
  discord: 'Discord.exe',
  spotify: 'Spotify.exe',
  telegram: 'Telegram.exe',
  steam: 'steam.exe',
  calculator: 'CalculatorApp.exe',
  settings: 'SystemSettings.exe',
  'task manager': 'Taskmgr.exe',
  explorer: 'explorer.exe',
  files: 'explorer.exe'
}

export default function registerAppLauncher(ipcMain: IpcMain) {
  ipcMain.removeHandler('open-app')
  ipcMain.handle('open-app', async (_event, appName: string) => {
    if (!appName || typeof appName !== 'string' || !appName.trim()) {
      return { success: false, error: 'App name is required' }
    }

    const normalizedAppName = appName.trim()
    const lowerName = normalizedAppName.toLowerCase()

    console.log(`[App Launcher] Trying to open: ${normalizedAppName}`)

    // Special case for WhatsApp
    if (lowerName.includes('whatsapp')) {
      console.log('[App Launcher] WhatsApp special handling')
      return await launchWhatsApp()
    }

    // Try alias first
    const aliasCommand = APP_ALIASES[lowerName]
    if (aliasCommand) {
      console.log(`[App Launcher] Found alias: ${aliasCommand}`)
      const result = await launchApp(aliasCommand, normalizedAppName)
      if (result.success) return result
      console.log(`[App Launcher] Alias failed, falling back to search`)
    }

    // Search for app
    return await searchAndLaunchApp(normalizedAppName)
  })

  ipcMain.removeHandler('close-app')
  ipcMain.handle('close-app', async (_event, appName: string) => {
    if (!appName || typeof appName !== 'string' || !appName.trim()) {
      return { success: false, error: 'App name is required' }
    }

    const normalizedAppName = appName.trim()
    const lowerName = normalizedAppName.toLowerCase()
    let processName = PROCESS_NAMES[lowerName]

    if (!processName) {
      processName = appName.endsWith('.exe') ? appName : `${appName}.exe`
    }

    if (PROTECTED_PROCESSES.includes(processName.toLowerCase())) {
      return {
        success: false,
        error: `Cannot close '${appName}' - System Critical Process`
      }
    }

    return await new Promise((resolve) => {
      const cmd = `taskkill /IM "${processName}" /F /T`
      exec(cmd, (error) => {
        if (error) {
          resolve({ success: false, error: `Could not close ${appName}` })
        } else {
          resolve({ success: true, message: `Closed ${appName}` })
        }
      })
    })
  })
}

/**
 * Launch WhatsApp using multiple methods (clean, no error popup)
 */
async function launchWhatsApp(): Promise<{ success: boolean; message?: string; error?: string }> {
  // Method 1: Try finding WhatsApp exe in LocalAppData\Packages
  const whatsappExePath = findWhatsAppExe()
  if (whatsappExePath) {
    console.log(`[WhatsApp] ✅ Launching from: ${whatsappExePath}`)
    const result = await launchApp(whatsappExePath, 'WhatsApp')
    if (result.success) return result
  }

  // Method 2: Try Windows Store AppID (DIRECT - no protocol)
  const appId = findWindowsAppPackageId('WhatsApp')
  if (appId) {
    const result = await launchViaStartCommandSilent(appId)
    if (result.success) {
      console.log('[WhatsApp] ✅ Opened via Windows Store')
      return result
    }
  }

  return {
    success: false,
    error: 'Could not find WhatsApp. Please ensure it is installed from Microsoft Store.'
  }
}

/**
 * Find WhatsApp exe in LocalAppData\Packages
 */
function findWhatsAppExe(): string | null {
  try {
    const localAppData = process.env.LOCALAPPDATA || ''
    const packagesPath = path.join(localAppData, 'Packages')

    if (!fs.existsSync(packagesPath)) {
      return null
    }

    const dirs = fs.readdirSync(packagesPath)
    const whatsappDir = dirs.find((d) => d.toLowerCase().includes('whatsapp'))

    if (!whatsappDir) {
      return null
    }

    const whatsappPath = path.join(packagesPath, whatsappDir)
    
    // Search for WhatsApp.exe recursively
    const searchForExe = (dir: string, depth = 0): string | null => {
      if (depth > 3) return null

      try {
        const files = fs.readdirSync(dir, { withFileTypes: true })

        for (const file of files) {
          const fullPath = path.join(dir, file.name)

          // Direct match
          if (file.isFile() && file.name.toLowerCase() === 'whatsapp.exe') {
            return fullPath
          }

          // Recurse into directories
          if (file.isDirectory() && !file.name.startsWith('.')) {
            const result = searchForExe(fullPath, depth + 1)
            if (result) return result
          }
        }
      } catch (e) {
        return null
      }

      return null
    }

    return searchForExe(whatsappPath)
  } catch (error) {
    return null
  }
}

/**
 * Find Windows app package ID
 */
function findWindowsAppPackageId(appName: string): string | null {
  try {
    const localAppData = process.env.LOCALAPPDATA || ''
    const packagesPath = path.join(localAppData, 'Packages')

    if (!fs.existsSync(packagesPath)) {
      return null
    }

    const directories = fs.readdirSync(packagesPath)
    const match = directories.find(
      (dir) =>
        dir.toLowerCase().includes(appName.toLowerCase()) ||
        dir.toLowerCase().includes('whatsappdesktop')
    )

    if (!match) {
      return null
    }

    return `${match}!App`
  } catch (error) {
    console.log(`[findWindowsAppPackageId] Error: ${error}`)
    return null
  }
}

/**
 * Launch via start command with AppID (SILENT - no error logs)
 */
function launchViaStartCommandSilent(appId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      // Method 1: Try with explorer.exe shell:appsFolder
      const explorerPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'explorer.exe')

      if (fs.existsSync(explorerPath)) {
        const cmd = `"${explorerPath}" "shell:appsFolder\\${appId}"`
        exec(cmd, (error) => {
          if (error) {
            // Try Method 2
            tryStartCommandSilent(appId, resolve)
          } else {
            resolve({ success: true, message: 'Opened' })
          }
        })
        return
      }

      // If explorer not found, try start command
      tryStartCommandSilent(appId, resolve)
    } catch (error: any) {
      resolve({ success: false, error: error.message })
    }
  })
}

/**
 * Try using start command with AppID (SILENT)
 */
function tryStartCommandSilent(
  appId: string,
  resolve: (value: { success: boolean; message?: string; error?: string }) => void
) {
  try {
    const cmd = `start shell:appsFolder\\${appId}`
    exec(cmd, (error) => {
      if (error) {
        // Try PowerShell as last resort
        tryPowerShellLaunchSilent(appId, resolve)
      } else {
        resolve({ success: true, message: 'Opened' })
      }
    })
  } catch (error: any) {
    resolve({ success: false, error: error.message })
  }
}

/**
 * Try PowerShell launch as last resort (SILENT)
 */
function tryPowerShellLaunchSilent(
  appId: string,
  resolve: (value: { success: boolean; message?: string; error?: string }) => void
) {
  try {
    const cmd = `powershell -Command "Start-Process 'shell:appsFolder\\${appId}'"`
    exec(cmd, (error) => {
      if (error) {
        resolve({ success: false, error: 'All launch methods failed' })
      } else {
        resolve({ success: true, message: 'Opened' })
      }
    })
  } catch (error: any) {
    resolve({ success: false, error: error.message })
  }
}

/**
 * Generic app launcher
 */
function launchApp(appPath: string, appName: string): Promise<{ success: boolean; message?: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      // If it looks like a URL or protocol
      if (appPath.includes('://') || appPath.includes(':')) {
        console.log(`[Launch] Using start with: ${appPath}`)
        const cmd = `start ${appPath}`
        exec(cmd, (error) => {
          if (error) {
            console.log(`[Launch] Error: ${error.message}`)
            resolve({ success: false, error: `Could not open ${appName}` })
          } else {
            console.log(`[Launch] Opened ${appName}`)
            resolve({ success: true, message: `Opened ${appName}` })
          }
        })
        return
      }

      // If it's a file path, check if exists
      if (fs.existsSync(appPath) || !appPath.includes('\\')) {
        const cmd = `start "" "${appPath}"`
        console.log(`[Launch] Command: ${cmd}`)
        exec(cmd, (error) => {
          if (error) {
            console.log(`[Launch] Error: ${error.message}`)
            resolve({ success: false, error: `Could not open ${appName}` })
          } else {
            console.log(`[Launch] Opened ${appName}`)
            resolve({ success: true, message: `Opened ${appName}` })
          }
        })
        return
      }

      resolve({ success: false, error: `Path not found: ${appPath}` })
    } catch (error: any) {
      console.log(`[Launch] Exception: ${error.message}`)
      resolve({ success: false, error: error.message })
    }
  })
}

/**
 * Silent app launcher (no error logging)
 */
function launchAppSilent(appPath: string, appName: string): Promise<{ success: boolean; message?: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      if (appPath.includes('://') || appPath.includes(':')) {
        const cmd = `start ${appPath}`
        exec(cmd, (error) => {
          if (error) {
            resolve({ success: false, error: `Could not open ${appName}` })
          } else {
            resolve({ success: true, message: `Opened ${appName}` })
          }
        })
        return
      }

      if (fs.existsSync(appPath) || !appPath.includes('\\')) {
        const cmd = `start "" "${appPath}"`
        exec(cmd, (error) => {
          if (error) {
            resolve({ success: false, error: `Could not open ${appName}` })
          } else {
            resolve({ success: true, message: `Opened ${appName}` })
          }
        })
        return
      }

      resolve({ success: false, error: `Path not found: ${appPath}` })
    } catch (error: any) {
      resolve({ success: false, error: error.message })
    }
  })
}

/**
 * Search for app in common locations
 */
async function searchAndLaunchApp(appName: string): Promise<{ success: boolean; message?: string; error?: string }> {
  console.log(`[Search] Looking for: ${appName}`)

  // Method 1: Start Menu
  const startMenuPath = await findInStartMenu(appName)
  if (startMenuPath) {
    console.log(`[Search] Found in Start Menu: ${startMenuPath}`)
    return await launchApp(startMenuPath, appName)
  }

  // Method 2: Program Files
  const programFilesPath = await findInProgramFiles(appName)
  if (programFilesPath) {
    console.log(`[Search] Found in Program Files: ${programFilesPath}`)
    return await launchApp(programFilesPath, appName)
  }

  // Method 3: LocalAppData
  const localPath = await findInLocalAppData(appName)
  if (localPath) {
    console.log(`[Search] Found in LocalAppData: ${localPath}`)
    return await launchApp(localPath, appName)
  }

  return {
    success: false,
    error: `Could not find '${appName}'. Is it installed?`
  }
}

/**
 * Find in Start Menu using fs recursion (no PowerShell)
 */
function findInStartMenu(appName: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const appEnv = process.env.APPDATA || ''
      const startMenuPaths = [
        path.join(appEnv, 'Microsoft/Windows/Start Menu/Programs'),
        'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs'
      ]

      const searchRecursive = (dir: string, maxDepth: number, currentDepth = 0): string | null => {
        if (currentDepth > maxDepth) return null

        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true })

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)

            // Check if it's a shortcut with matching name
            if (entry.isFile() && entry.name.endsWith('.lnk')) {
              if (entry.name.toLowerCase().includes(appName.toLowerCase())) {
                console.log(`[Start Menu] Found: ${fullPath}`)
                return fullPath
              }
            }

            // Recurse into directories
            if (entry.isDirectory()) {
              const result = searchRecursive(fullPath, maxDepth, currentDepth + 1)
              if (result) return result
            }
          }
        } catch (e) {
          return null
        }

        return null
      }

      for (const menuPath of startMenuPaths) {
        if (fs.existsSync(menuPath)) {
          const found = searchRecursive(menuPath, 3)
          if (found) {
            resolve(found)
            return
          }
        }
      }

      resolve(null)
    } catch (error) {
      console.log(`[Start Menu] Error: ${error}`)
      resolve(null)
    }
  })
}

/**
 * Find in Program Files using fs recursion (no PowerShell)
 */
function findInProgramFiles(appName: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const programFiles = ['C:\\Program Files', 'C:\\Program Files (x86)']

      const searchRecursive = (dir: string, maxDepth: number, currentDepth = 0): string | null => {
        if (currentDepth > maxDepth) return null

        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true })

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)

            // Check if it's an exe with matching name
            if (entry.isFile() && entry.name.endsWith('.exe')) {
              if (entry.name.toLowerCase().includes(appName.toLowerCase())) {
                console.log(`[Program Files] Found: ${fullPath}`)
                return fullPath
              }
            }

            // Recurse into directories
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
              const result = searchRecursive(fullPath, maxDepth, currentDepth + 1)
              if (result) return result
            }
          }
        } catch (e) {
          return null
        }

        return null
      }

      for (const basePath of programFiles) {
        if (fs.existsSync(basePath)) {
          const found = searchRecursive(basePath, 2)
          if (found) {
            resolve(found)
            return
          }
        }
      }

      resolve(null)
    } catch (error) {
      console.log(`[Program Files] Error: ${error}`)
      resolve(null)
    }
  })
}

/**
 * Find in LocalAppData
 */
function findInLocalAppData(appName: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const localAppData = process.env.LOCALAPPDATA || ''
      const searchPaths = [
        path.join(localAppData, 'Programs'),
        path.join(localAppData, 'Microsoft/WindowsApps')
      ]

      const searchRecursive = (dir: string, maxDepth: number, currentDepth = 0): string | null => {
        if (currentDepth > maxDepth) return null

        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true })

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)

            if (entry.isFile() && entry.name.toLowerCase().endsWith('.exe')) {
              if (entry.name.toLowerCase().includes(appName.toLowerCase())) {
                return fullPath
              }
            }

            if (entry.isDirectory() && !entry.name.startsWith('.')) {
              const result = searchRecursive(fullPath, maxDepth, currentDepth + 1)
              if (result) return result
            }
          }
        } catch (e) {
          return null
        }

        return null
      }

      for (const searchPath of searchPaths) {
        if (fs.existsSync(searchPath)) {
          const found = searchRecursive(searchPath, 2)
          if (found) {
            resolve(found)
            return
          }
        }
      }

      resolve(null)
    } catch (error) {
      console.log(`[LocalAppData] Error: ${error}`)
      resolve(null)
    }
  })
}