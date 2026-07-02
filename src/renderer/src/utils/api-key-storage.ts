const GEMINI_KEYS = ['iris_custom_api_key', 'jarvis 2.O_custom_api_key']
const GROQ_KEYS = ['iris_groq_api_key', 'jarvis 2.O_groq_api_key']
const HUGGINGFACE_KEYS = ['iris_hf_api_key', 'jarvis 2.O_hf_api_key']
const TAVILY_KEYS = [
  'iris_tavily_api_key',
  'iris_tailvy_api_key',
  'jarvis 2.O_tavily_api_key',
  'jarvis 2.O_tailvy_api_key'
]

export type ApiProvider = 'gemini' | 'groq' | 'hf' | 'tavily'

const providerKeyMap: Record<ApiProvider, string[]> = {
  gemini: GEMINI_KEYS,
  groq: GROQ_KEYS,
  hf: HUGGINGFACE_KEYS,
  tavily: TAVILY_KEYS
}

export const getStoredApiKey = (provider: ApiProvider): string => {
  if (typeof window === 'undefined' || !window.localStorage) return ''

  const keys = providerKeyMap[provider] || []
  for (const key of keys) {
    const value = window.localStorage.getItem(key)
    if (value && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

export const getStoredApiKeyWithSecureFallback = async (provider: ApiProvider): Promise<string> => {
  const localValue = getStoredApiKey(provider)
  if (localValue) return localValue

  if (typeof window === 'undefined' || !window.electron?.ipcRenderer) return ''

  try {
    const secureKeys = await window.electron.ipcRenderer.invoke('secure-get-keys')
    if (!secureKeys) return ''

    if (provider === 'gemini') return secureKeys.geminiKey || ''
    if (provider === 'groq') return secureKeys.groqKey || ''
    if (provider === 'hf') return secureKeys.hfKey || ''
    if (provider === 'tavily') return secureKeys.tavilyKey || ''
  } catch {
    // Ignore secure-vault lookup errors and fall back to empty string.
  }

  return ''
}

export const setStoredApiKey = (provider: ApiProvider, value: string): string => {
  const normalizedValue = (value || '').trim()

  if (typeof window === 'undefined' || !window.localStorage) return normalizedValue

  const keys = providerKeyMap[provider] || []
  for (const key of keys) {
    window.localStorage.setItem(key, normalizedValue)
  }

  return normalizedValue
}

export const saveAllStoredApiKeys = ({
  gemini,
  groq,
  hf,
  tavily
}: {
  gemini?: string
  groq?: string
  hf?: string
  tavily?: string
}) => {
  return {
    gemini: setStoredApiKey('gemini', gemini || ''),
    groq: setStoredApiKey('groq', groq || ''),
    hf: setStoredApiKey('hf', hf || ''),
    tavily: setStoredApiKey('tavily', tavily || '')
  }
}

export const getAllStoredApiKeys = () => ({
  gemini: getStoredApiKey('gemini'),
  groq: getStoredApiKey('groq'),
  hf: getStoredApiKey('hf'),
  tavily: getStoredApiKey('tavily')
})
