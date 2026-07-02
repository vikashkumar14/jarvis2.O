import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getStoredApiKey, saveAllStoredApiKeys } from '../utils/api-key-storage'
import * as faceapi from 'face-api.js'
import { GiArtificialIntelligence } from 'react-icons/gi'
import {
  RiKey2Line,
  RiSave3Line,
  RiUserVoiceLine,
  RiUserLine,
  RiLockPasswordLine,
  RiScan2Line,
  RiAddLine,
  RiRecordCircleLine,
  RiLock2Line,
  RiSettings4Line,
  RiShieldKeyholeLine,
  RiPlugLine,
  RiBrainLine,
  RiCloudLine,
  RiCpuLine,
  RiTerminalWindowLine,
  RiRefreshLine,
  RiDownloadCloud2Line,
  RiRocketLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFingerprintLine,
  RiInformationLine,
  RiGlobalLine,
  RiTimeLine,
  RiRestartLine,
  RiDeleteBin6Line,
  RiFileTextLine,
  RiArrowDownSLine,
  RiPulseLine,
  RiSpeedUpLine,
  RiHardDriveLine
} from 'react-icons/ri'

interface SettingsProps {
  isSystemActive: boolean
}

type TabType =
  | 'system'
  | 'general'
  | 'ai-profile'
  | 'voice'
  | 'keys'
  | 'security'
  | 'integrations'
  | 'updates'
  | 'about'

const TABS: { id: TabType; label: string; icon: typeof RiSettings4Line }[] = [
  { id: 'system', label: 'System', icon: RiTerminalWindowLine },
  { id: 'general', label: 'General', icon: RiSettings4Line },
  { id: 'ai-profile', label: 'AI Profile', icon: RiUserLine },
  { id: 'voice', label: 'Voice & Audio', icon: RiUserVoiceLine },
  { id: 'keys', label: 'API Keys', icon: RiPlugLine },
  { id: 'security', label: 'Security', icon: RiShieldKeyholeLine },
  { id: 'integrations', label: 'Integrations', icon: RiCloudLine },
  { id: 'updates', label: 'Updates', icon: RiDownloadCloud2Line },
  { id: 'about', label: 'About', icon: RiInformationLine }
]

const TAB_META: Record<TabType, { title: string; subtitle: string }> = {
  system: { title: 'System Overview', subtitle: 'Monitor and control your system status and performance.' },
  general: { title: 'General Settings', subtitle: 'Customize the general behavior and appearance of JARVIS.' },
  'ai-profile': { title: 'AI Profile', subtitle: 'Customize JARVIS personality, behavior and communication style.' },
  voice: { title: 'Voice & Audio', subtitle: 'Manage microphone input, output device and voice detection.' },
  keys: { title: 'API Keys', subtitle: 'Manage API keys for different services and integrations.' },
  security: { title: 'Security', subtitle: 'Manage your master PIN and biometric identities.' },
  integrations: { title: 'Integrations', subtitle: 'Connect JARVIS with other apps and services.' },
  updates: { title: 'Firmware Updates', subtitle: 'Check for and install the latest JARVIS build.' },
  about: { title: 'About', subtitle: 'Version, credits and system information.' }
}

type VoiceMode = 'normal' | 'gf' | 'friend' | 'nutanki' | 'funny' | 'roast'
type ResponseStyle = 'concise' | 'balanced' | 'detailed' | 'creative'
type ThemeMode = 'dark' | 'darker' | 'oled'

/* ---------- tiny reusable pieces ---------- */

const Toggle = ({
  checked,
  onChange,
  disabled
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`toggle-track relative w-11 h-6 rounded-full cursor-pointer shrink-0 ${checked ? 'is-on' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    <span className="toggle-thumb absolute top-0.5 left-0.5 w-5 h-5 rounded-full" />
  </button>
)

const SettingRow = ({
  icon: Icon,
  label,
  description,
  children
}: {
  icon: typeof RiSettings4Line
  label: string
  description: string
  children: React.ReactNode
}) => (
  <div className="setting-row flex items-center justify-between gap-6 px-5 py-4">
    <div className="flex items-center gap-3 min-w-0">
      <div className="icon-chip w-9 h-9 shrink-0 bg-[var(--well)] border border-[var(--line)]">
        <Icon size={16} className="text-[var(--ink-dim)]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--ink)] truncate">{label}</p>
        <p className="text-[11px] text-[var(--ink-faint)] mt-0.5">{description}</p>
      </div>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
)

const Select = ({
  value,
  onChange,
  options
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
}) => (
  <div className="select-shell relative flex items-center">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none bg-transparent border border-[var(--line)] rounded-lg pl-3 pr-8 py-2 text-xs font-semibold text-[var(--ink)] outline-none cursor-pointer min-w-36"
    >
      {options.map((o) => (
        <option key={o} value={o} className="bg-[var(--panel)]">
          {o}
        </option>
      ))}
    </select>
    <RiArrowDownSLine size={14} className="absolute right-2.5 text-[var(--ink-faint)] pointer-events-none" />
  </div>
)

const SegGroup = ({
  value,
  onChange,
  options,
  disabled
}: {
  value: string
  onChange: (v: string) => void
  options: { id: string; label: string }[]
  disabled?: boolean
}) => (
  <div className={`grid gap-2 ${disabled ? 'opacity-40' : ''}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
    {options.map((o) => (
      <button
        key={o.id}
        onClick={() => !disabled && onChange(o.id)}
        disabled={disabled}
        className={`seg-btn py-2.5 text-[12px] font-bold tracking-wide cursor-pointer ${value === o.id ? 'is-on' : 'text-[var(--ink-dim)]'}`}
      >
        {o.label}
      </button>
    ))}
  </div>
)

/* ---------- main component ---------- */

const SettingsView = ({ isSystemActive }: SettingsProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('system')

  const getStoredVoiceProfile = () =>
    (localStorage.getItem('jarvis 2.O_voice_profile') as 'MALE' | 'FEMALE') ||
    (localStorage.getItem('iris_voice_profile') as 'MALE' | 'FEMALE') ||
    'FEMALE'

  const getStoredVoiceMode = () => {
    const storedMode = (localStorage.getItem('jarvis 2.O_voice_mode') || localStorage.getItem('iris_voice_mode') || 'normal').toString()
    return ['normal', 'gf', 'friend', 'nutanki', 'funny', 'roast'].includes(storedMode)
      ? (storedMode as VoiceMode)
      : 'normal'
  }

  const [voice, setVoice] = useState<'MALE' | 'FEMALE'>(getStoredVoiceProfile())
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(getStoredVoiceMode())
  const [personality, setPersonality] = useState(
    'You are JARVIS, a highly intelligent AI assistant. You are helpful, precise, calm and always ready to assist the user.'
  )
  const [userName, setUserName] = useState(
    localStorage.getItem('jarvis 2.O_user_name') || localStorage.getItem('iris_user_name') || 'Vikash'
  )
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>(
    (localStorage.getItem('jarvis 2.O_response_style') as ResponseStyle) || 'balanced'
  )

  const getStoredGeminiKey = () => getStoredApiKey('gemini')

  const [geminiKey, setGeminiKey] = useState(getStoredGeminiKey())
  const [groqKey, setGroqKey] = useState(getStoredApiKey('groq'))
  const [hfKey, setHfKey] = useState(getStoredApiKey('hf'))
  const [tailvyKey, setTailvyKey] = useState(getStoredApiKey('tavily'))

  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const toggleReveal = (key: string) => setRevealed((r) => ({ ...r, [key]: !r[key] }))

  const [isSecurityUnlocked, setIsSecurityUnlocked] = useState(false)
  const [authPin, setAuthPin] = useState('')
  const [authError, setAuthError] = useState(false)

  const [newPin, setNewPin] = useState('')
  const [faceCount, setFaceCount] = useState(0)

  const [isScanningFace, setIsScanningFace] = useState(false)
  const [enrollStatus, setEnrollStatus] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)

  const [appVersion, setAppVersion] = useState('2.0.0')
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
  >('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateNotes, setUpdateNotes] = useState('No new updates detected.')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [uptime, setUptime] = useState('7d 14h 22m')

  /* --- general settings state --- */
  const [language, setLanguage] = useState(localStorage.getItem('jarvis 2.O_language') || 'English')
  const [theme, setTheme] = useState<ThemeMode>((localStorage.getItem('jarvis 2.O_theme') as ThemeMode) || 'dark')
  const [dateFormat, setDateFormat] = useState(localStorage.getItem('jarvis 2.O_date_format') || '12 Hour')
  const [startWithWindows, setStartWithWindows] = useState(localStorage.getItem('jarvis 2.O_start_windows') !== 'false')
  const [minimizeToTray, setMinimizeToTray] = useState(localStorage.getItem('jarvis 2.O_min_tray') !== 'false')
  const [animationsOn, setAnimationsOn] = useState(localStorage.getItem('jarvis 2.O_animations') !== 'false')
  const [soundEffects, setSoundEffects] = useState(localStorage.getItem('jarvis 2.O_sound_fx') === 'true')

  useEffect(() => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.invoke('get-personality').then((res) => {
        if (res) setPersonality(res)
      })
      window.electron.ipcRenderer
        .invoke('check-vault-status')
        .then((res) => setFaceCount(res?.faceCount || 0))

      window.electron.ipcRenderer.invoke('get-app-version').then((v) => v && setAppVersion(v))

      window.electron.ipcRenderer.on('updater-event', (_e, { status, data, error }) => {
        if (status === 'checking') setUpdateStatus('checking')
        if (status === 'available') {
          setUpdateStatus('available')
          setUpdateVersion(data.version)
          setUpdateNotes(data.releaseNotes || 'Bug fixes and performance improvements.')
        }
        if (status === 'not-available') {
          setUpdateStatus('idle')
          setUpdateNotes('System is up to date.')
        }
        if (status === 'downloading') {
          setUpdateStatus('downloading')
          setDownloadProgress(Math.round(data.percent))
        }
        if (status === 'downloaded') setUpdateStatus('ready')
        if (status === 'error') {
          setUpdateStatus('error')
          setUpdateNotes(`Error: ${error}`)
        }
      })
    }
    return () => {
      if (window.electron?.ipcRenderer)
        window.electron.ipcRenderer.removeAllListeners('updater-event')
    }
  }, [])

  const checkForUpdates = () => window.electron.ipcRenderer.invoke('check-for-updates')
  const downloadUpdate = () => window.electron.ipcRenderer.invoke('download-update')
  const installUpdate = () => window.electron.ipcRenderer.invoke('install-update')
  const restartJarvis = () => window.electron?.ipcRenderer?.invoke('restart-jarvis')
  const clearCache = () => window.electron?.ipcRenderer?.invoke('clear-cache')
  const exportLogs = () => window.electron?.ipcRenderer?.invoke('export-logs')

  const handleVoiceChange = (v: 'MALE' | 'FEMALE') => {
    if (isSystemActive) return
    setVoice(v)
    localStorage.setItem('jarvis 2.O_voice_profile', v)
    localStorage.setItem('iris_voice_profile', v)

    if (v === 'MALE' && voiceMode !== 'normal') {
      setVoiceMode('normal')
      localStorage.setItem('jarvis 2.O_voice_mode', 'normal')
      localStorage.setItem('iris_voice_mode', 'normal')
    }
  }

  const handleVoiceModeChange = (mode: VoiceMode) => {
    if (isSystemActive) return
    setVoiceMode(mode)
    localStorage.setItem('jarvis 2.O_voice_mode', mode)
    localStorage.setItem('iris_voice_mode', mode)
  }

  const handleResponseStyleChange = (style: string) => {
    setResponseStyle(style as ResponseStyle)
    localStorage.setItem('jarvis 2.O_response_style', style)
  }

  const handlePersonalityChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    const words = text.trim().split(/\s+/).filter((w) => w.length > 0)
    if (words.length <= 150) setPersonality(text)
  }

  const savePersonality = async () => {
    if (window.electron?.ipcRenderer) {
      await window.electron.ipcRenderer.invoke('set-personality', personality)
      alert('Personality matrix saved to your device.')
    }
  }

  const saveUserName = () => {
    localStorage.setItem('jarvis 2.O_user_name', userName)
    localStorage.setItem('iris_user_name', userName)
    alert('User designation saved.')
  }

  const saveApiKeys = async () => {
    saveAllStoredApiKeys({
      gemini: geminiKey,
      groq: groqKey,
      hf: hfKey,
      tavily: tailvyKey
    })

    if (window.electron?.ipcRenderer) {
      try {
        await window.electron.ipcRenderer.invoke('secure-save-keys', { groqKey, geminiKey })
      } catch {
        // Keep local storage as the primary persistence path.
      }
    }
    alert('All API keys saved locally. Restart AI modules to apply changes.')
  }

  const currentWordCount = personality.trim().split(/\s+/).filter((w) => w.length > 0).length

  const unlockSecurityModule = async () => {
    if (!window.electron?.ipcRenderer) return
    const isValid = await window.electron.ipcRenderer.invoke('verify-vault-pin', authPin)
    if (isValid) {
      setIsSecurityUnlocked(true)
      setAuthPin('')
    } else {
      setAuthError(true)
      setTimeout(() => setAuthError(false), 1000)
    }
  }

  const updateMasterPin = async () => {
    if (newPin.length !== 4 || !window.electron?.ipcRenderer) return
    await window.electron.ipcRenderer.invoke('setup-vault-pin', newPin)
    setNewPin('')
    alert('Master PIN updated successfully.')
  }

  const startFaceEnrollment = async () => {
    setIsScanningFace(true)
    setEnrollStatus('Initializing camera…')
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('./models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('./models')
      ])

      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setEnrollStatus('Position your face in frame')

        const scanInterval = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState !== 4) return
          const detection = await faceapi
            .detectSingleFace(videoRef.current)
            .withFaceLandmarks()
            .withFaceDescriptor()

          if (detection) {
            clearInterval(scanInterval)
            setEnrollStatus('Face captured — encrypting…')
            const descriptorArray = Array.from(detection.descriptor)

            if (window.electron?.ipcRenderer) {
              await window.electron.ipcRenderer.invoke('setup-vault-face', descriptorArray)
            }

            stream.getTracks().forEach((t) => t.stop())
            setIsScanningFace(false)
            setFaceCount((prev) => prev + 1)
            alert('New biometric identity saved.')
          }
        }, 1000)
      }
    } catch (e) {
      setEnrollStatus('Camera error')
      setTimeout(() => setIsScanningFace(false), 2000)
    }
  }

  const apiKeyRows: {
    key: string
    label: string
    icon: typeof RiBrainLine
    color: string
    value: string
    setValue: (v: string) => void
    placeholder: string
  }[] = [
    { key: 'gemini', label: 'Google Gemini API', icon: RiBrainLine, color: '#4285F4', value: geminiKey, setValue: setGeminiKey, placeholder: 'AIzaSy_...' },
    { key: 'groq', label: 'Groq API', icon: RiCpuLine, color: '#F97316', value: groqKey, setValue: setGroqKey, placeholder: 'gsk_...' },
    { key: 'hf', label: 'Hugging Face API', icon: RiCloudLine, color: '#FACC15', value: hfKey, setValue: setHfKey, placeholder: 'hf_...' },
    { key: 'tailvy', label: 'Tailvy Builder API', icon: RiPlugLine, color: '#2DD4BF', value: tailvyKey, setValue: setTailvyKey, placeholder: 'tlv_...' }
  ]

  return (
    <div className="settings-root flex-1 min-h-screen overflow-y-auto scrollbar-small">
      <style>{`
        .settings-root {
          --bg-base: #0A0A0D;
          --panel: #131318;
          --well: #0D0D11;
          --line: #212228;
          --ink: #F5F5F7;
          --ink-dim: #8B8C97;
          --ink-faint: #55565F;
          --green: #22D67A;
          --green-strong: #1AB868;
          --green-soft: rgba(34,214,122,0.12);
          --amber: #FBBF24;
          --amber-soft: rgba(251,191,36,0.12);
          --danger: #F04949;
          --danger-soft: rgba(240,73,73,0.1);
          font-family: 'Manrope', -apple-system, sans-serif;
          background: var(--bg-base);
          color: var(--ink);
        }
        .settings-root .font-data { font-family: 'JetBrains Mono', ui-monospace, monospace; }

        .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; }
        .well { background: var(--well); border: 1px solid var(--line); border-radius: 12px; }

        .btn-flat {
          border-radius: 10px; border: 1px solid var(--line); background: #191A20;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .btn-flat:hover { background: #1E1F26; border-color: #2C2D36; }
        .btn-flat:active { background: #17181D; }

        .btn-primary {
          border-radius: 10px; background: var(--green); color: #06110B;
          transition: background 0.15s ease, transform 0.1s ease;
        }
        .btn-primary:hover { background: #33E38A; }
        .btn-primary:active { transform: translateY(1px); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-amber {
          border-radius: 10px; background: var(--amber); color: #241A02;
          transition: background 0.15s ease, transform 0.1s ease;
        }
        .btn-amber:hover { background: #FCC94D; }
        .btn-amber:active { transform: translateY(1px); }

        .tab-item { border-radius: 9px; transition: background 0.15s ease, color 0.15s ease; border-left: 2px solid transparent; }
        .tab-item.is-active { background: var(--green-soft); color: var(--green) !important; border-left: 2px solid var(--green); }
        .tab-item:not(.is-active):hover { background: #17181D; }

        .field-shell { background: var(--well); border: 1px solid var(--line); border-radius: 10px; transition: border-color 0.15s ease; }
        .field-shell:focus-within { border-color: var(--green); }

        .seg-btn { border-radius: 9px; border: 1px solid var(--line); background: var(--well); transition: all 0.15s ease; }
        .seg-btn.is-on { background: var(--green); border-color: var(--green); color: #06110B !important; }

        .status-dot-live { box-shadow: 0 0 0 3px var(--amber-soft), 0 0 8px var(--amber); }

        .progress-track { background: var(--well); border: 1px solid var(--line); border-radius: 999px; overflow: hidden; }
        .progress-fill { background: var(--green); }

        .eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }

        .stat-chip { background: var(--well); border: 1px solid var(--line); border-radius: 12px; }

        .key-row { background: var(--well); border: 1px solid var(--line); border-radius: 12px; transition: border-color 0.15s ease; }
        .key-row:focus-within { border-color: var(--green); }

        .icon-chip { border-radius: 9px; display: flex; align-items: center; justify-content: center; }

        .setting-row { border-bottom: 1px solid var(--line); }
        .setting-row:last-child { border-bottom: none; }

        .toggle-track { background: #26272E; border: 1px solid var(--line); transition: background 0.15s ease; }
        .toggle-track.is-on { background: var(--green); border-color: var(--green); }
        .toggle-thumb { background: #F5F5F7; transition: transform 0.15s ease; }
        .toggle-track.is-on .toggle-thumb { transform: translateX(20px); }

        .quick-action { border-radius: 12px; border: 1px solid var(--line); background: var(--well); transition: background 0.15s ease, border-color 0.15s ease; }
        .quick-action:hover { background: #17181D; border-color: #2C2D36; }
      `}</style>

      <div className="flex flex-col lg:flex-row max-w-6xl mx-auto px-6 md:px-10 py-10 gap-8">
        {/* ---------- LEFT: TAB RAIL ---------- */}
        <div className="lg:w-52 shrink-0 flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <span className="eyebrow">Settings</span>
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isSystemActive ? 'bg-[var(--amber)] status-dot-live' : 'bg-[#3A3B44]'}`} />
              <span className="text-[10px] font-data text-[var(--ink-faint)]">{isSystemActive ? 'Online' : 'Offline'}</span>
            </span>
          </div>

          <nav className="flex lg:flex-col gap-0.5 overflow-x-auto lg:overflow-visible">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`tab-item shrink-0 flex items-center gap-3 px-3 py-2.5 text-sm font-semibold cursor-pointer ${
                  activeTab === id ? 'is-active' : 'text-[var(--ink-dim)]'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* ---------- RIGHT: CONTENT ---------- */}
        <div className="flex-1 relative min-h-150">
          <AnimatePresence mode="wait">
            {/* --- SYSTEM --- */}
            {activeTab === 'system' && (
              <motion.div
                key="system"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="w-full flex flex-col gap-6"
              >
                <div>
                  <h1 className="text-xl font-bold text-[var(--ink)]">{TAB_META.system.title}</h1>
                  <p className="text-xs text-[var(--ink-faint)] mt-1">{TAB_META.system.subtitle}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="stat-chip px-5 py-4 flex items-center gap-3">
                    <RiPulseLine className="text-[var(--green)]" size={18} />
                    <div>
                      <span className="text-[10px] text-[var(--ink-faint)] font-data block">System</span>
                      <span className="text-sm font-bold text-[var(--green)]">All systems operational</span>
                    </div>
                  </div>
                  <div className="stat-chip px-5 py-4 flex items-center gap-3">
                    <RiTerminalWindowLine className="text-[var(--ink-dim)]" size={18} />
                    <div>
                      <span className="text-[10px] text-[var(--ink-faint)] font-data block">Version</span>
                      <span className="text-sm font-bold font-data">JARVIS {appVersion}</span>
                    </div>
                  </div>
                  <div className="stat-chip px-5 py-4 flex items-center gap-3">
                    <RiTimeLine className="text-[var(--ink-dim)]" size={18} />
                    <div>
                      <span className="text-[10px] text-[var(--ink-faint)] font-data block">Uptime</span>
                      <span className="text-sm font-bold font-data">{uptime}</span>
                    </div>
                  </div>
                  <div className="stat-chip px-5 py-4 flex items-center gap-3">
                    <RiSpeedUpLine className="text-[var(--ink-dim)]" size={18} />
                    <div>
                      <span className="text-[10px] text-[var(--ink-faint)] font-data block">Performance</span>
                      <span className="text-sm font-bold">Optimal</span>
                    </div>
                  </div>
                </div>

                <div className="panel p-6 flex flex-col gap-4">
                  <span className="text-sm font-bold">Quick Actions</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button onClick={checkForUpdates} className="quick-action flex flex-col items-center gap-2 py-5 cursor-pointer">
                      <RiRefreshLine size={18} className="text-[var(--green)]" />
                      <span className="text-[11px] font-semibold text-[var(--ink-dim)]">Check for Updates</span>
                    </button>
                    <button onClick={restartJarvis} className="quick-action flex flex-col items-center gap-2 py-5 cursor-pointer">
                      <RiRestartLine size={18} className="text-[var(--ink-dim)]" />
                      <span className="text-[11px] font-semibold text-[var(--ink-dim)]">Restart JARVIS</span>
                    </button>
                    <button onClick={clearCache} className="quick-action flex flex-col items-center gap-2 py-5 cursor-pointer">
                      <RiDeleteBin6Line size={18} className="text-[var(--ink-dim)]" />
                      <span className="text-[11px] font-semibold text-[var(--ink-dim)]">Clear Cache</span>
                    </button>
                    <button onClick={exportLogs} className="quick-action flex flex-col items-center gap-2 py-5 cursor-pointer">
                      <RiFileTextLine size={18} className="text-[var(--ink-dim)]" />
                      <span className="text-[11px] font-semibold text-[var(--ink-dim)]">Export Logs</span>
                    </button>
                  </div>
                </div>

                <div className="panel p-8 flex items-center justify-center">
                  <div className="relative w-48 h-48 flex items-center justify-center">
                    {[96, 76, 56, 36].map((r, i) => (
                      <span
                        key={r}
                        className="absolute rounded-full border"
                        style={{
                          width: r * 2,
                          height: r * 2,
                          borderColor: `rgba(34,214,122,${0.35 - i * 0.07})`
                        }}
                      />
                    ))}
                    <div className="relative w-14 h-14 rounded-full bg-[var(--green-soft)] border border-[var(--green)] flex items-center justify-center">
                      <RiHardDriveLine size={20} className="text-[var(--green)]" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- GENERAL --- */}
            {activeTab === 'general' && (
              <motion.div
                key="general"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="w-full flex flex-col gap-6"
              >
                <div>
                  <h1 className="text-xl font-bold text-[var(--ink)]">{TAB_META.general.title}</h1>
                  <p className="text-xs text-[var(--ink-faint)] mt-1">{TAB_META.general.subtitle}</p>
                </div>

                <div className="panel flex flex-col">
                  <SettingRow icon={RiGlobalLine} label="Language" description="Choose your preferred language">
                    <Select
                      value={language}
                      onChange={(v) => {
                        setLanguage(v)
                        localStorage.setItem('jarvis 2.O_language', v)
                      }}
                      options={['English', 'Hindi', 'Hinglish']}
                    />
                  </SettingRow>

                  <SettingRow icon={RiSettings4Line} label="Theme" description="Select application theme">
                    <div className="w-52">
                      <SegGroup
                        value={theme}
                        onChange={(v) => {
                          setTheme(v as ThemeMode)
                          localStorage.setItem('jarvis 2.O_theme', v)
                        }}
                        options={[
                          { id: 'dark', label: 'Dark' },
                          { id: 'darker', label: 'Darker' },
                          { id: 'oled', label: 'OLED' }
                        ]}
                      />
                    </div>
                  </SettingRow>

                  <SettingRow icon={RiRocketLine} label="Start with Windows" description="Launch JARVIS when Windows starts">
                    <Toggle
                      checked={startWithWindows}
                      onChange={(v) => {
                        setStartWithWindows(v)
                        localStorage.setItem('jarvis 2.O_start_windows', String(v))
                      }}
                    />
                  </SettingRow>

                  <SettingRow icon={RiRecordCircleLine} label="Minimize to Tray" description="Minimize application to system tray">
                    <Toggle
                      checked={minimizeToTray}
                      onChange={(v) => {
                        setMinimizeToTray(v)
                        localStorage.setItem('jarvis 2.O_min_tray', String(v))
                      }}
                    />
                  </SettingRow>

                  <SettingRow icon={RiPulseLine} label="Animations" description="Enable smooth animations and transitions">
                    <Toggle
                      checked={animationsOn}
                      onChange={(v) => {
                        setAnimationsOn(v)
                        localStorage.setItem('jarvis 2.O_animations', String(v))
                      }}
                    />
                  </SettingRow>

                  <SettingRow icon={RiUserVoiceLine} label="Sound Effects" description="Play sound feedback for actions">
                    <Toggle
                      checked={soundEffects}
                      onChange={(v) => {
                        setSoundEffects(v)
                        localStorage.setItem('jarvis 2.O_sound_fx', String(v))
                      }}
                    />
                  </SettingRow>

                  <SettingRow icon={RiTimeLine} label="Date & Time Format" description="Choose your preferred format">
                    <Select
                      value={dateFormat}
                      onChange={(v) => {
                        setDateFormat(v)
                        localStorage.setItem('jarvis 2.O_date_format', v)
                      }}
                      options={['12 Hour', '24 Hour']}
                    />
                  </SettingRow>
                </div>
              </motion.div>
            )}

            {/* --- AI PROFILE --- */}
            {activeTab === 'ai-profile' && (
              <motion.div
                key="ai-profile"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="w-full flex flex-col gap-6"
              >
                <div>
                  <h1 className="text-xl font-bold text-[var(--ink)]">{TAB_META['ai-profile'].title}</h1>
                  <p className="text-xs text-[var(--ink-faint)] mt-1">{TAB_META['ai-profile'].subtitle}</p>
                </div>

                <div className="panel p-6 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <GiArtificialIntelligence className="text-[var(--ink-dim)]" size={17} /> Personality Matrix
                    </span>
                    <div className="flex items-center gap-3">
                      <span className={`font-data text-[10px] font-semibold ${currentWordCount >= 150 ? 'text-[var(--danger)]' : 'text-[var(--ink-faint)]'}`}>
                        {currentWordCount} / 150
                      </span>
                      <button onClick={savePersonality} className="btn-flat text-[var(--ink-dim)] hover:text-white p-2 cursor-pointer">
                        <RiSave3Line size={15} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--ink-faint)] -mt-2">Define how JARVIS should behave and respond.</p>
                  <textarea
                    value={personality}
                    onChange={handlePersonalityChange}
                    placeholder="Define who JARVIS is. Example: 'You are a calm, highly technical assistant…'"
                    className="well p-4 text-sm text-[var(--ink)] h-24 resize-none outline-none transition-all scrollbar-small placeholder:text-[var(--ink-faint)]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="panel p-6 flex flex-col gap-4">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <RiUserLine className="text-[var(--ink-dim)]" size={17} /> Operator Name
                    </span>
                    <p className="text-[11px] text-[var(--ink-faint)] -mt-2">What should JARVIS call you?</p>
                    <div className="field-shell flex items-center px-4 py-3">
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="Enter your name…"
                        className="bg-transparent border-none outline-none text-sm text-[var(--ink)] w-full placeholder:text-[var(--ink-faint)] font-medium"
                      />
                      <button onClick={saveUserName} className="text-[var(--ink-faint)] hover:text-[var(--green)] transition-colors ml-2 cursor-pointer">
                        <RiSave3Line size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="panel p-6 flex flex-col gap-4 relative">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-2 text-sm font-bold">
                        <RiUserVoiceLine className="text-[var(--ink-dim)]" size={17} /> Voice Profile
                      </span>
                      {isSystemActive && (
                        <span className="text-[10px] text-[var(--danger)] font-semibold flex items-center gap-1 bg-[var(--danger-soft)] px-2 py-1 rounded-md">
                          <RiLock2Line size={10} /> Locked
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--ink-faint)] -mt-2">Select JARVIS voice</p>
                    <div className={isSystemActive ? 'opacity-40' : ''}>
                      <Select
                        value={voice === 'FEMALE' ? 'Female (Neural)' : 'Male (Neural)'}
                        onChange={(v) => handleVoiceChange(v.startsWith('Female') ? 'FEMALE' : 'MALE')}
                        options={['Female (Neural)', 'Male (Neural)']}
                      />
                    </div>
                    {isSystemActive && <div className="absolute inset-0 z-10 cursor-not-allowed" />}
                  </div>
                </div>

                <div className="panel p-6 flex flex-col gap-4">
                  <span className="text-sm font-bold">Response Style</span>
                  <p className="text-[11px] text-[var(--ink-faint)] -mt-2">How should JARVIS respond?</p>
                  <SegGroup
                    value={responseStyle}
                    onChange={handleResponseStyleChange}
                    options={[
                      { id: 'concise', label: 'Concise' },
                      { id: 'balanced', label: 'Balanced' },
                      { id: 'detailed', label: 'Detailed' },
                      { id: 'creative', label: 'Creative' }
                    ]}
                  />
                </div>

                <div className="panel p-6 flex flex-col gap-4 relative">
                  <span className="text-sm font-bold">Voice Tone</span>
                  <p className="text-[11px] text-[var(--ink-faint)] -mt-2">Select the female tone style. Male voice stays in clear, professional mode.</p>
                  <SegGroup
                    value={voiceMode}
                    onChange={(v) => handleVoiceModeChange(v as VoiceMode)}
                    disabled={isSystemActive || voice !== 'FEMALE'}
                    options={[
                      { id: 'normal', label: 'Normal' },
                      { id: 'gf', label: 'Girlfriend' },
                      { id: 'friend', label: 'Friend' },
                      { id: 'nutanki', label: 'Nutanki' },
                      { id: 'funny', label: 'Funny' },
                      { id: 'roast', label: 'Roast' }
                    ]}
                  />
                  {isSystemActive && <div className="absolute inset-0 z-10 cursor-not-allowed" />}
                </div>
              </motion.div>
            )}

            {/* --- VOICE & AUDIO --- */}
            {activeTab === 'voice' && (
              <motion.div
                key="voice"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="w-full flex flex-col gap-6"
              >
                <div>
                  <h1 className="text-xl font-bold text-[var(--ink)]">{TAB_META.voice.title}</h1>
                  <p className="text-xs text-[var(--ink-faint)] mt-1">{TAB_META.voice.subtitle}</p>
                </div>
                <div className="panel flex flex-col">
                  <SettingRow icon={RiUserVoiceLine} label="Microphone" description="Default system microphone">
                    <Select value="Default" onChange={() => {}} options={['Default', 'External Mic']} />
                  </SettingRow>
                  <SettingRow icon={RiRecordCircleLine} label="Wake Word Detection" description="Listen for 'Hey JARVIS' passively">
                    <Toggle checked={true} onChange={() => {}} />
                  </SettingRow>
                  <SettingRow icon={RiUserVoiceLine} label="Noise Suppression" description="Reduce background noise while listening">
                    <Toggle checked={true} onChange={() => {}} />
                  </SettingRow>
                </div>
              </motion.div>
            )}

            {/* --- API KEYS --- */}
            {activeTab === 'keys' && (
              <motion.div
                key="keys"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="w-full flex flex-col gap-6"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-bold text-[var(--ink)]">{TAB_META.keys.title}</h1>
                    <p className="text-xs text-[var(--ink-faint)] mt-1">{TAB_META.keys.subtitle}</p>
                  </div>
                  <button onClick={saveApiKeys} className="btn-primary px-5 py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shrink-0">
                    <RiSave3Line size={14} /> Save all keys
                  </button>
                </div>

                <div className="flex flex-col gap-2.5">
                  {apiKeyRows.map((row) => (
                    <div key={row.key} className="key-row flex items-center gap-4 px-4 py-3.5">
                      <div className="icon-chip w-9 h-9 shrink-0" style={{ background: `${row.color}22`, border: `1px solid ${row.color}40` }}>
                        <row.icon size={16} style={{ color: row.color }} />
                      </div>
                      <span className="text-xs font-semibold text-[var(--ink)] w-36 shrink-0 truncate">{row.label}</span>
                      <input
                        type={revealed[row.key] ? 'text' : 'password'}
                        value={row.value}
                        onChange={(e) => row.setValue(e.target.value)}
                        placeholder={row.placeholder}
                        className="bg-transparent border-none outline-none text-sm font-data text-[var(--ink)] flex-1 min-w-0 placeholder:text-[var(--ink-faint)] tracking-widest"
                      />
                      <button onClick={() => toggleReveal(row.key)} className="text-[var(--ink-faint)] hover:text-[var(--green)] transition-colors cursor-pointer shrink-0" title={revealed[row.key] ? 'Hide key' : 'Show key'}>
                        {revealed[row.key] ? <RiEyeOffLine size={16} /> : <RiEyeLine size={16} />}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="well p-4 flex items-start gap-3">
                  <RiShieldKeyholeLine className="text-[var(--green)] shrink-0 mt-0.5" size={15} />
                  <p className="text-[11px] text-[var(--ink-dim)] leading-relaxed">
                    All API keys stay encrypted on your device. JARVIS never sends them to a central server — you keep full ownership and billing control over each provider.
                  </p>
                </div>
              </motion.div>
            )}

            {/* --- SECURITY --- */}
            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="w-full flex flex-col gap-6"
              >
                <div>
                  <h1 className="text-xl font-bold text-[var(--ink)]">{TAB_META.security.title}</h1>
                  <p className="text-xs text-[var(--ink-faint)] mt-1">{TAB_META.security.subtitle}</p>
                </div>

                <div className="relative rounded-[16px] overflow-hidden">
                  <AnimatePresence>
                    {!isSecurityUnlocked && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 backdrop-blur-2xl bg-[#0A0A0Dcc] border border-[var(--line)] rounded-[16px] flex flex-col items-center justify-center p-8"
                      >
                        <div className="btn-flat w-14 h-14 flex items-center justify-center mb-6">
                          <RiLockPasswordLine size={24} className="text-[var(--green)]" />
                        </div>
                        <p className="text-sm text-[var(--ink)] font-semibold mb-6 text-center">Enter your PIN to access security settings</p>
                        <div className="flex gap-3 items-center h-11">
                          <input
                            type="password"
                            maxLength={4}
                            pattern="\d*"
                            value={authPin}
                            onChange={(e) => setAuthPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="PIN"
                            className={`font-data h-full bg-[var(--well)] border w-32 rounded-lg text-center text-xl tracking-[0.5em] text-white outline-none transition-colors ${authError ? 'border-[var(--danger)] text-[var(--danger)] bg-[var(--danger-soft)]' : 'border-[var(--line)] focus:border-[var(--green)]'}`}
                          />
                          <button onClick={unlockSecurityModule} className="btn-primary h-full px-7 text-xs font-bold cursor-pointer">
                            Unlock
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 panel p-6">
                    <div className="well p-6 flex flex-col gap-5">
                      <span className="flex items-center gap-2 text-sm font-bold">
                        <RiLockPasswordLine className="text-[var(--ink-dim)]" size={17} /> Master PIN
                      </span>
                      <div className="field-shell flex items-center px-4 py-3">
                        <input
                          type="password"
                          maxLength={4}
                          pattern="\d*"
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="New 4-digit PIN…"
                          className="bg-transparent border-none outline-none text-sm font-data text-[var(--ink)] w-full tracking-[0.3em] placeholder:tracking-normal placeholder:text-[var(--ink-faint)]"
                        />
                        <button onClick={updateMasterPin} className="text-[var(--ink-faint)] hover:text-[var(--green)] transition-colors ml-2 cursor-pointer">
                          <RiSave3Line size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="well p-6 flex flex-col gap-5">
                      <div className="flex justify-between items-center pb-4 border-b border-[var(--line)]">
                        <span className="flex items-center gap-2 text-sm font-bold">
                          <RiScan2Line className="text-[var(--ink-dim)]" size={17} /> Biometrics
                        </span>
                        <span className="font-data text-[10px] font-bold px-2.5 py-1.5 rounded-md bg-[var(--green-soft)] text-[var(--green)] flex items-center gap-1.5">
                          <RiFingerprintLine size={11} /> {faceCount} enrolled
                        </span>
                      </div>

                      {isScanningFace ? (
                        <div className="flex items-center gap-4 panel p-3">
                          <video ref={videoRef} autoPlay muted playsInline className="w-16 h-16 rounded-xl object-cover -scale-x-100 border border-[var(--line)]" />
                          <div className="flex flex-col gap-1">
                            <span className="text-[12px] text-[var(--ink)] font-semibold animate-pulse">{enrollStatus}</span>
                            <span className="text-xs text-[var(--ink-faint)]">Keep your head steady…</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4 h-full justify-between">
                          <p className="text-xs text-[var(--ink-dim)] leading-relaxed">Enroll another face. Data is encrypted and stays on this device only.</p>
                          <button onClick={startFaceEnrollment} className="btn-primary w-full py-3 font-bold text-[12px] flex items-center justify-center gap-2 cursor-pointer mt-auto">
                            <RiAddLine size={15} /> Enroll new face
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- INTEGRATIONS --- */}
            {activeTab === 'integrations' && (
              <motion.div
                key="integrations"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="w-full flex flex-col gap-6"
              >
                <div>
                  <h1 className="text-xl font-bold text-[var(--ink)]">{TAB_META.integrations.title}</h1>
                  <p className="text-xs text-[var(--ink-faint)] mt-1">{TAB_META.integrations.subtitle}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { name: 'WebForge', desc: 'Website builder pipeline', color: '#2DD4BF' },
                    { name: 'GitHub', desc: 'Repository deployment', color: '#8B8C97' },
                    { name: 'Vercel', desc: 'Hosting & deployment', color: '#F5F5F7' },
                    { name: 'Camera Vision', desc: 'Live scene understanding', color: '#4285F4' }
                  ].map((it) => (
                    <div key={it.name} className="panel p-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="icon-chip w-9 h-9" style={{ background: `${it.color}22`, border: `1px solid ${it.color}40` }}>
                          <RiPlugLine size={16} style={{ color: it.color }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{it.name}</p>
                          <p className="text-[11px] text-[var(--ink-faint)]">{it.desc}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1.5 rounded-md bg-[var(--green-soft)] text-[var(--green)]">Connected</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* --- UPDATES --- */}
            {activeTab === 'updates' && (
              <motion.div
                key="updates"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="absolute w-full flex flex-col gap-6"
              >
                <div>
                  <h1 className="text-xl font-bold text-[var(--ink)]">{TAB_META.updates.title}</h1>
                  <p className="text-xs text-[var(--ink-faint)] mt-1">{TAB_META.updates.subtitle}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="panel p-6 flex flex-col gap-5">
                    <div className="flex justify-between items-center pb-4 border-b border-[var(--line)]">
                      <span className="flex items-center gap-2 text-sm font-bold">
                        <RiRocketLine className="text-[var(--green)]" size={17} /> Firmware
                      </span>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-4 flex-1 py-6 text-center">
                      {updateStatus === 'idle' || updateStatus === 'error' ? (
                        <>
                          <div className="well w-14 h-14 flex items-center justify-center">
                            <RiTerminalWindowLine size={24} className="text-[var(--ink-faint)]" />
                          </div>
                          <p className="text-xs text-[var(--ink-dim)]">Current build is stable.</p>
                          <button onClick={checkForUpdates} className="btn-flat mt-2 w-full py-3 text-[var(--ink)] font-bold text-[12px] flex items-center justify-center gap-2 cursor-pointer">
                            <RiRefreshLine size={15} /> Check for updates
                          </button>
                        </>
                      ) : updateStatus === 'checking' ? (
                        <>
                          <RiRefreshLine size={32} className="text-[var(--green)] animate-spin" />
                          <p className="text-xs text-[var(--green)] font-medium">Checking for updates…</p>
                        </>
                      ) : updateStatus === 'available' ? (
                        <>
                          <div className="well w-14 h-14 flex items-center justify-center">
                            <RiDownloadCloud2Line size={24} className="text-[var(--amber)]" />
                          </div>
                          <p className="text-xs text-[var(--amber)] font-semibold">New version found: v{updateVersion}</p>
                          <button onClick={downloadUpdate} className="btn-primary mt-2 w-full py-3 font-bold text-[12px] flex items-center justify-center gap-2 cursor-pointer">
                            <RiDownloadCloud2Line size={15} /> Download update
                          </button>
                        </>
                      ) : updateStatus === 'downloading' ? (
                        <div className="w-full flex flex-col gap-3">
                          <div className="flex justify-between text-[11px] font-data text-[var(--ink-dim)]">
                            <span>Downloading…</span>
                            <span>{downloadProgress}%</span>
                          </div>
                          <div className="progress-track h-2 w-full">
                            <div className="progress-fill h-full transition-all duration-300" style={{ width: `${downloadProgress}%` }} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="well w-14 h-14 flex items-center justify-center">
                            <RiRecordCircleLine size={24} className="text-[var(--amber)]" />
                          </div>
                          <p className="text-xs text-[var(--amber)] font-semibold">Update ready to install</p>
                          <button onClick={installUpdate} className="btn-amber mt-2 w-full py-3 font-bold text-[12px] flex items-center justify-center gap-2 cursor-pointer">
                            <RiRocketLine size={15} /> Restart & install
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="panel p-6 flex flex-col gap-4">
                    <div className="flex justify-between items-center pb-4 border-b border-[var(--line)]">
                      <span className="flex items-center gap-2 text-sm font-bold">
                        <RiTerminalWindowLine className="text-[var(--ink-dim)]" size={17} /> Release notes
                      </span>
                    </div>
                    <div className="well flex-1 p-4 overflow-y-auto max-h-60 scrollbar-small">
                      <pre className="font-data text-[11px] text-[var(--ink-dim)] whitespace-pre-wrap leading-relaxed">{updateNotes}</pre>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- ABOUT --- */}
            {activeTab === 'about' && (
              <motion.div
                key="about"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="w-full flex flex-col gap-6"
              >
                <div>
                  <h1 className="text-xl font-bold text-[var(--ink)]">{TAB_META.about.title}</h1>
                  <p className="text-xs text-[var(--ink-faint)] mt-1">{TAB_META.about.subtitle}</p>
                </div>
                <div className="panel p-8 flex flex-col items-center text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--green-soft)] border border-[var(--green)] flex items-center justify-center">
                    <GiArtificialIntelligence size={24} className="text-[var(--green)]" />
                  </div>
                  <p className="text-lg font-bold">JARVIS {appVersion}</p>
                  <p className="text-xs text-[var(--ink-faint)] max-w-sm">
                    A locally-run, privacy-first AI assistant with camera vision, voice interaction and an integrated website builder.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default SettingsView