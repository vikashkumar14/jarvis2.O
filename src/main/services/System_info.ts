import { exec } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

const getWindowsSystemRoot = (): string => {
  return process.env.SystemRoot || 'C:\\Windows'
}

const getPowerShellPath = (): string => {
  const root = getWindowsSystemRoot()
  const candidates = [
    path.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    path.join(root, 'Sysnative', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    path.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'pwsh.exe'),
    path.join(root, 'Sysnative', 'WindowsPowerShell', 'v1.0', 'pwsh.exe')
  ]
  const found = candidates.find((candidate) => existsSync(candidate))
  return found || 'powershell.exe'
}

const getTaskListPath = (): string => {
  const root = getWindowsSystemRoot()
  const candidate = path.join(root, 'System32', 'tasklist.exe')
  return existsSync(candidate) ? candidate : 'tasklist'
}

export interface AppItem {
  id: string
  name: string
  path?: string
  icon?: string
  category?: string
}

/**
 * MAIN FUNCTION - Sab installed apps find karo
 */
export async function getAllApps(): Promise<AppItem[]> {
  try {
    console.log('[getAllApps] Starting scan...')

    // Method 1: Registry se install kiye hue apps
    const registryApps = await scanRegistry()
    console.log(`[getAllApps] Registry found: ${registryApps.length} apps`)

    // Method 2: Start Menu shortcuts
    const startMenuApps = await scanStartMenu()
    console.log(`[getAllApps] Start Menu found: ${startMenuApps.length} apps`)

    // Method 3: Program Files directories
    const programFilesApps = await scanProgramFiles()
    console.log(`[getAllApps] Program Files found: ${programFilesApps.length} apps`)

    // Method 4: Running processes (currently open)
    const runningApps = await scanRunningProcesses()
    console.log(`[getAllApps] Running processes found: ${runningApps.length} apps`)

    // Merge all aur duplicates remove karo
    const allAppsMap = new Map<string, AppItem>()

    ;[...registryApps, ...startMenuApps, ...programFilesApps, ...runningApps].forEach((app) => {
      const key = app.name.toLowerCase()
      if (!allAppsMap.has(key)) {
        allAppsMap.set(key, app)
      }
    })

    const uniqueApps = Array.from(allAppsMap.values()).sort((a, b) => a.name.localeCompare(b.name))

    console.log(`[getAllApps] Total unique apps: ${uniqueApps.length}`)
    return uniqueApps
  } catch (error) {
    console.error('[getAllApps] Error:', error)
    return []
  }
}

/**
 * Method 1: Windows Registry se installed apps scan karo
 * HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall
 */
async function scanRegistry(): Promise<AppItem[]> {
  try {
    const powershell = getPowerShellPath()
    const psCommand = `"${powershell}" -NoProfile -Command "
      $registryPaths = @(\n
        'HKLM:\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall',
        'HKCU:\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall',
        'HKLM:\\\\Software\\\\Wow6432Node\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall'
      )

      \\$apps = @()

      foreach (\\$path in \\$registryPaths) {
        Get-ChildItem \\$path -ErrorAction SilentlyContinue | 
          ForEach-Object {
            \\$key = Get-ItemProperty \\$_.PSPath -ErrorAction SilentlyContinue
            
            if (\\$key.DisplayName) {
              \\$obj = @{
                name = \\$key.DisplayName
                path = \\$key.InstallLocation
                uninstallString = \\$key.UninstallString
              }
              \\$apps += (\\$obj | ConvertTo-Json -Compress)
            }
          }
      }

      \\$apps | ForEach-Object { Write-Output \\$_ }
    "`

    const { stdout } = await execAsync(psCommand)
    const apps: AppItem[] = []

    stdout.split('\n').forEach((line) => {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line)
          if (parsed.name && parsed.name.length > 0) {
            apps.push({
              id: parsed.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
              name: parsed.name,
              path: parsed.path || '',
              category: 'Installed'
            })
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    })

    return apps
  } catch (error) {
    console.error('[scanRegistry] Error:', error)
    return []
  }
}

/**
 * Method 2: Start Menu shortcuts (.lnk files) scan karo
 */
async function scanStartMenu(): Promise<AppItem[]> {
  try {
    const powershell = getPowerShellPath()
    const psCommand = `"${powershell}" -NoProfile -Command "
      $startMenuPaths = @(\n
        'C:\\\\ProgramData\\\\Microsoft\\\\Windows\\\\Start Menu\\\\Programs',
        '$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs'
      )

      $apps = @()
      $shell = New-Object -ComObject WScript.Shell

      foreach (\\$menuPath in \\$startMenuPaths) {
        if (Test-Path \\$menuPath) {
          Get-ChildItem -Path \\$menuPath -Recurse -Include '*.lnk' -ErrorAction SilentlyContinue |
            ForEach-Object {
              try {
                \\$link = \\$shell.CreateShortcut(\\$_.FullName)
                if (\\$link.TargetPath) {
                  \\$name = [System.IO.Path]::GetFileNameWithoutExtension(\\$_.Name)
                  \\$obj = @{
                    name = \\$name
                    path = \\$link.TargetPath
                  }
                  \\$apps += (\\$obj | ConvertTo-Json -Compress)
                }
              } catch { }
            }
        }
      }

      \\$apps | ForEach-Object { Write-Output \\$_ }
    "`

    const { stdout } = await execAsync(psCommand)
    const apps: AppItem[] = []

    stdout.split('\n').forEach((line) => {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line)
          if (parsed.name && parsed.name.length > 0) {
            apps.push({
              id: parsed.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
              name: parsed.name,
              path: parsed.path || '',
              category: 'StartMenu'
            })
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    })

    return apps
  } catch (error) {
    console.error('[scanStartMenu] Error:', error)
    return []
  }
}

/**
 * Method 3: Program Files mein recursively .exe files scan karo
 */
async function scanProgramFiles(): Promise<AppItem[]> {
  try {
    const powershell = getPowerShellPath()
    const psCommand = `"${powershell}" -NoProfile -Command "
      $searchPaths = @(\n
        'C:\\\\Program Files',
        'C:\\\\Program Files (x86)',
        '$env:APPDATA\\Local'
      )

      $apps = @()

      foreach (\\$basePath in \\$searchPaths) {
        if (Test-Path \\$basePath) {
          Get-ChildItem -Path \\$basePath -Recurse -Include '*.exe' -ErrorAction SilentlyContinue -Depth 3 |
            Select-Object -First 200 |
            ForEach-Object {
              \\$name = [System.IO.Path]::GetFileNameWithoutExtension(\\$_.Name)
              
              # Skip system/installer files
              if (\\$name -notmatch '(uninstall|install|setup|update|config|helper|service)' -and \\$name.Length -gt 2) {
                \\$obj = @{
                  name = \\$name
                  path = \\$_.FullName
                }
                \\$apps += (\\$obj | ConvertTo-Json -Compress)
              }
            }
        }
      }

      \\$apps | ForEach-Object { Write-Output \\$_ }
    "`

    const { stdout } = await execAsync(psCommand)
    const apps: AppItem[] = []

    stdout.split('\n').forEach((line) => {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line)
          if (parsed.name && parsed.name.length > 2) {
            apps.push({
              id: parsed.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
              name: parsed.name,
              path: parsed.path || '',
              category: 'Program'
            })
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    })

    return apps
  } catch (error) {
    console.error('[scanProgramFiles] Error:', error)
    return []
  }
}

/**
 * Method 4: Running processes scan karo
 */
async function scanRunningProcesses(): Promise<AppItem[]> {
  try {
    const tasklist = getTaskListPath()
    const { stdout } = await execAsync(`"${tasklist}"`)
    const apps: AppItem[] = []

    stdout.split('\n').forEach((line) => {
      const match = line.match(/^([A-Za-z0-9._-]+\.exe)/i)
      if (match) {
        const name = match[1].replace('.exe', '')

        // Skip system processes aur duplicate entries
        if (!['system', 'svchost', 'lsass', 'csrss', 'dwm', 'explorer'].includes(name.toLowerCase())) {
          apps.push({
            id: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
            name: name,
            category: 'Running'
          })
        }
      }
    })

    return apps
  } catch (error) {
    console.error('[scanRunningProcesses] Error:', error)
    return []
  }
}