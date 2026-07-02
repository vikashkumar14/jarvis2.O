import { getStoredApiKey } from '../utils/api-key-storage'

const getErrorMessage = (error: any) => {
  if (!error) return 'Unknown error during synthesis.'
  if (typeof error === 'string') return error
  if (error.message) return String(error.message)
  if (error.error?.message) return String(error.error.message)
  if (error?.statusText) return `${error.statusText} (${error.status})`
  return JSON.stringify(error, null, 2)
}

const parseErrorMessage = (error: any) => {
  if (!error) return 'Unknown error during synthesis.'
  if (typeof error === 'string') {
    const trimmed = error.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        return parseErrorMessage(parsed)
      } catch {
        return trimmed
      }
    }
    const embeddedJsonMatch = trimmed.match(/\{[\s\S]*\}$/)
    if (embeddedJsonMatch) {
      try {
        const parsed = JSON.parse(embeddedJsonMatch[0])
        return parseErrorMessage(parsed)
      } catch {
        return trimmed
      }
    }
    return trimmed
  }
  if (error.message) return parseErrorMessage(error.message)
  if (error.error?.message) return parseErrorMessage(error.error.message)
  if (error.statusText) return `${error.statusText} (${error.status})`
  return String(error)
}

export const buildAnimatedWebsite = async (prompt: string) => {
  try {
    const geminiKey = getStoredApiKey('gemini')

    if (!geminiKey.trim()) {
      return `❌ System Error: Missing Gemini API Key. Please update it in the Command Center Vault.`
    }

    const res = await window.electron.ipcRenderer.invoke('build-animated-website', {
      prompt,
      geminiKey
    })

    if (res?.success) {
      return `✅ Website generated successfully and saved to ${res.filePath}.`
    }

    const errorMessage = parseErrorMessage(res?.error ?? res)
    return `❌ System Error during synthesis: ${errorMessage}`
  } catch (error) {
    return `System Error: Unable to establish connection to the Live Forge.`
  }
}
