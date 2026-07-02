import { useState, useEffect, Suspense, lazy } from 'react'
import {
  RiWifiLine,
  RiShieldFlashLine,
  RiLayoutGridLine,
  RiFolderOpenLine,
  RiPhoneLine,
  RiSettings4Line,
  RiBatteryChargeLine,
  RiCameraLine,
  RiComputerLine,
  RiCloseLine,
  RiImageLine,
  RiChat3Line,
  RiFlashlightLine,
  RiAppsLine,
  RiSearchLine,
  RiCodeSLine,
  RiPlayCircleLine,
  RiCalendarLine
} from 'react-icons/ri'
import { getSystemStatus } from '@renderer/services/system-info'
import { getHistory } from '@renderer/services/iris-ai-brain'
import ViewSkeleton from '@renderer/components/ViewSkelrton'
import { openApp, performWebSearch } from '@renderer/functions/apps-manager-api'
import { takeScreenshot } from '@renderer/functions/keybaord-manager'

import DashboardView from '../views/Dashboard'
import PhoneView from '../views/Phone'
import { VisionMode } from '@renderer/IndexRoot'

const AppsView = lazy(() => import('../views/APP'))
const WorkFlowEditorView = lazy(() => import('../views/WorkFlowEditor'))
const NotesView = lazy(() => import('../views/Notes'))
const SettingsView = lazy(() => import('../views/Settings'))
const GalleryView = lazy(() => import('../views/Gallery'))
const ChatView = lazy(() => import('../views/Chat'))
const FilesView = lazy(() => import('../views/Files'))
const CameraView = lazy(() => import('../views/Camera'))
const WebSearchView = lazy(() => import('../views/WebSearch'))
const CodeAssistantView = lazy(() => import('../views/CodeAssistant'))
const MediaPlayerView = lazy(() => import('../views/MediaPlayer'))
const CalendarView = lazy(() => import('../views/Calendar'))
const SystemControlView = lazy(() => import('../views/SystemControl'))

interface IrisProps {
  isSystemActive: boolean
  toggleSystem: () => void
  isMicMuted: boolean
  toggleMic: () => void
  isVideoOn: boolean
  visionMode: VisionMode
  startVision: (mode: 'camera' | 'screen') => void
  stopVision: () => void
  activeStream: MediaStream | null
}

const glassPanel = 'bg-[#25262F]/70 backdrop-blur-xl border border-[#383947] rounded-2xl shadow-xl'

const TABS = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: RiLayoutGridLine },
  { id: 'CHAT', label: 'Chat', icon: RiChat3Line },
  { id: 'AUTOMATION', label: 'Automation', icon: RiFlashlightLine },
  { id: 'FILES', label: 'Files', icon: RiFolderOpenLine },
  { id: 'APPS', label: 'Apps', icon: RiAppsLine },
  { id: 'SYSTEM', label: 'System', icon: RiSettings4Line },
  { id: 'CAMERA', label: 'Camera', icon: RiCameraLine },
  { id: 'WEBSEARCH', label: 'Web Search', icon: RiSearchLine },
  { id: 'CODE', label: 'Code', icon: RiCodeSLine },
  { id: 'MEDIA', label: 'Media', icon: RiPlayCircleLine },
  { id: 'CALENDAR', label: 'Calendar', icon: RiCalendarLine },
  { id: 'NOTES', label: 'Notes', icon: RiFolderOpenLine },
  { id: 'GALLERY', label: 'Gallery', icon: RiImageLine }
]

const HEADER_FEATURES = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: RiLayoutGridLine },
  { id: 'PHONE', label: 'Phone', icon: RiPhoneLine },
  { id: 'NOTES', label: 'Notes', icon: RiFolderOpenLine },
  { id: 'SETTINGS', label: 'Settings', icon: RiSettings4Line },
  { id: 'GALLERY', label: 'Gallery', icon: RiImageLine }
]

const IRIS = (props: IrisProps) => {
  const [activeTab, setActiveTab] = useState('DASHBOARD')
  const [stats, setStats] = useState<any>(null)
  const [time, setTime] = useState<Date>(new Date())
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [showSourceModal, setShowSourceModal] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
      getSystemStatus().then(setStats)
    }, 500)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchHistory = async () => {
      const history = await getHistory()
      if (Array.isArray(history)) setChatHistory(history.slice(-15))
    }
    fetchHistory()
    const interval = setInterval(fetchHistory, 500)
    return () => clearInterval(interval)
  }, [])

  const handleVisionClick = () => {
    if (props.isVideoOn) {
      props.stopVision()
    } else {
      setShowSourceModal(true)
    }
  }

  const handleDashboardQuickAction = async (label: string) => {
    try {
      switch (label) {
        case 'Open WhatsApp':
          await openApp('whatsapp')
          break
        case 'Take Screenshot': {
          const result = await takeScreenshot()
          alert(result)
          break
        }
        case 'Open Camera':
          if (!props.isSystemActive) {
            await props.toggleSystem()
          }
          await props.startVision('camera')
          break
        case 'Search on Google':
          await performWebSearch('')
          break
        case 'Open Notepad':
          await openApp('notepad')
          break
        case 'System Information': {
          const status = await getSystemStatus()
          if (status) {
            alert(
              `CPU: ${status.cpu}\nRAM: ${status.memory.usedPercentage} used\nTemp: ${status.temperature}°C\nOS: ${status.os?.type ?? 'Unknown'}`
            )
          } else {
            alert('Unable to fetch system information.')
          }
          break
        }
        case 'Clear Temp Files': {
          const result = await window.electron?.ipcRenderer?.invoke('clear-cache')
          if (result?.success) {
            alert('Temp files cleared successfully.')
          } else {
            alert(`Failed to clear temp files: ${result?.error ?? 'Unknown error'}`)
          }
          break
        }
        default:
          console.warn(`Unknown quick action: ${label}`)
      }
    } catch (error: any) {
      alert(`Action failed: ${error?.message || 'Unknown error'}`)
    }
  }

  const handleSidebarNavigation = (label: string) => {
    switch (label) {
      case 'Dashboard':
        setActiveTab('DASHBOARD')
        break
      case 'Chat':
        setActiveTab('CHAT')
        break
      case 'Automation':
        setActiveTab('AUTOMATION')
        break
      case 'Files & Folders':
        setActiveTab('FILES')
        break
      case 'Apps':
        setActiveTab('APPS')
        break
      case 'System Control':
        setActiveTab('SYSTEM')
        break
      case 'Camera':
        setActiveTab('CAMERA')
        break
      case 'Web Search':
        setActiveTab('WEBSEARCH')
        break
      case 'Code Assistant':
        setActiveTab('CODE')
        break
      case 'Media Player':
        setActiveTab('MEDIA')
        break
      case 'Calendar':
        setActiveTab('CALENDAR')
        break
      case 'Notes':
        setActiveTab('NOTES')
        break
      case 'Settings':
        setActiveTab('SETTINGS')
        break
      default:
        console.warn(`Unhandled sidebar navigation: ${label}`)
    }
  }

  return (
    <div className="iris-root h-screen w-full font-sans overflow-hidden select-none flex flex-col relative pb-5">
      <style>{`
        .iris-root {
          --bg-base: #1C1D24;
          --bg-sunken: #16171C;
          --panel: #25262F;
          --panel-raised: #292A34;
          --line: #383947;
          --line-soft: #2F303A;
          --ink: #F2F1ED;
          --ink-dim: #A8A8B3;
          --ink-faint: #6C6D78;
          --indigo: #6C63FF;
          --indigo-bright: #9B93FF;
          --indigo-soft: #6C63FF22;
          --amber: #FFB454;
          --amber-soft: #FFB45422;
          --danger: #FF6B6B;
          font-family: 'Manrope', -apple-system, sans-serif;
          background: var(--bg-base);
          color: var(--ink);
        }
        .iris-root .font-data { font-family: 'JetBrains Mono', ui-monospace, monospace; }

        .iris-header {
          background: linear-gradient(180deg, var(--panel-raised) 0%, var(--panel) 100%);
          border-bottom: 1px solid var(--line);
          box-shadow: 0 8px 20px -12px rgba(0,0,0,0.5);
        }

        .iris-brand-icon {
          width: 34px; height: 34px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid var(--line);
          background: linear-gradient(180deg, #34353F 0%, #2A2B34 100%);
          box-shadow: 0 1px 0 0 rgba(255,255,255,0.06) inset, 0 2px 0 0 #1A1B22;
        }


        .iris-status-pill {
          display: flex; align-items: center; gap: 6px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.05em;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
        }

        .iris-feature-bar {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .iris-feature-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid transparent;
          font-size: 12px;
          font-weight: 700;
          color: var(--ink-dim);
          background: rgba(255,255,255,0.03);
          transition: all 0.15s ease;
          cursor: pointer;
        }

        .iris-feature-btn:hover {
          color: var(--ink);
          border-color: rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.06);
        }

        .iris-feature-btn.active {
          color: var(--indigo-bright);
          border-color: var(--line);
          background: rgba(108,99,255,0.12);
        }

        .iris-clock {
          background: var(--bg-sunken);
          border: 1px solid var(--line-soft);
          border-radius: 8px;
          padding: 5px 10px;
          color: var(--ink-dim);
        }

        .iris-status-dot { box-shadow: 0 0 0 3px var(--amber-soft), 0 0 8px var(--amber); }

        .iris-modal-panel {
          border-radius: 20px;
          overflow: hidden;
        }

        .iris-source-btn {
          border-radius: 16px;
          background: var(--bg-sunken);
          border: 1px solid var(--line-soft);
          transition: all 0.2s ease;
        }
        .iris-source-btn:hover {
          border-color: #4B44C2;
          background: var(--indigo-soft);
        }
        .iris-source-icon {
          width: 56px; height: 56px; border-radius: 999px;
          display: flex; align-items: center; justify-content: center;
          background: var(--panel-raised);
          border: 1px solid var(--line);
          color: var(--ink-faint);
          transition: all 0.2s ease;
        }
        .iris-source-btn:hover .iris-source-icon {
          background: var(--indigo);
          border-color: var(--indigo);
          color: white;
        }
      `}</style>

      <div className="iris-header h-14 w-full flex items-center justify-between px-6 z-50">
        <div className="hidden lg:flex items-center gap-3">
          <div className="iris-brand-icon">
            <RiShieldFlashLine className="text-[var(--indigo-bright)]" size={17} />
          </div>
          <span className="font-bold tracking-[0.18em] text-sm text-[var(--ink)]">JARVIS 2.O</span>
        </div>

        <div className="hidden md:flex items-center gap-3 iris-feature-bar">
          {HEADER_FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <button
                key={feature.id}
                type="button"
                onClick={() => setActiveTab(feature.id)}
                className={`iris-feature-btn ${activeTab === feature.id ? 'active' : ''}`}
              >
                <Icon size={14} /> {feature.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-5">
          <div className="iris-status-pill text-[var(--amber)]">
            <RiWifiLine size={13} /> <span>Linked</span>
          </div>
          <div className="hidden sm:flex iris-status-pill text-[var(--ink-dim)]">
            <RiBatteryChargeLine size={13} /> <span>100%</span>
          </div>
          <div className="iris-clock text-[11px] font-data">{time.toLocaleTimeString()}</div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <Suspense fallback={<ViewSkeleton />}>
          {activeTab === 'DASHBOARD' && (
            <DashboardView
              props={props}
              stats={stats}
              chatHistory={chatHistory}
              onVisionClick={handleVisionClick}
              onQuickAction={handleDashboardQuickAction}
              onNavigate={handleSidebarNavigation}
            />
          )}
          {activeTab === 'CHAT' && <ChatView />}
          {activeTab === 'PHONE' && <PhoneView glassPanel={glassPanel} />}
          {activeTab === 'AUTOMATION' && <WorkFlowEditorView />}
          {activeTab === 'FILES' && <FilesView />}
          {activeTab === 'APPS' && <AppsView />}
          {activeTab === 'SYSTEM' && <SystemControlView isSystemActive={props.isSystemActive} />}
          {activeTab === 'CAMERA' && (
            <CameraView
              isSystemActive={props.isSystemActive}
              isVideoOn={props.isVideoOn}
              visionMode={props.visionMode}
              startVision={props.startVision}
              stopVision={props.stopVision}
            />
          )}
          {activeTab === 'WEBSEARCH' && <WebSearchView />}
          {activeTab === 'CODE' && <CodeAssistantView />}
          {activeTab === 'MEDIA' && <MediaPlayerView />}
          {activeTab === 'CALENDAR' && <CalendarView />}
          {activeTab === 'NOTES' && <NotesView glassPanel={glassPanel} />}
          {activeTab === 'SETTINGS' && <SettingsView isSystemActive={props.isSystemActive} />}
          {activeTab === 'GALLERY' && <GalleryView />}
        </Suspense>
      </div>

      {showSourceModal && (
        <div className="absolute inset-0 z-100 flex items-center justify-center bg-[#16171C]/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`${glassPanel} iris-modal-panel w-96 flex flex-col`}>
            <div className="flex items-center justify-between p-4 border-b border-[var(--line-soft)] bg-[var(--bg-sunken)]/40">
              <span className="text-xs font-bold tracking-wide text-[var(--indigo-bright)]">
                Choose input source
              </span>
              <button
                onClick={() => setShowSourceModal(false)}
                className="cursor-pointer text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
              >
                <RiCloseLine size={18} />
              </button>
            </div>

            <div className="p-5 grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  props.startVision('camera')
                  setShowSourceModal(false)
                }}
                className="iris-source-btn cursor-pointer flex flex-col items-center justify-center gap-3 p-6"
              >
                <div className="iris-source-icon">
                  <RiCameraLine size={24} />
                </div>
                <span className="text-[10px] font-bold tracking-wide text-[var(--ink-dim)]">
                  Camera feed
                </span>
              </button>

              <button
                onClick={() => {
                  props.startVision('screen')
                  setShowSourceModal(false)
                }}
                className="iris-source-btn cursor-pointer flex flex-col items-center justify-center gap-3 p-6"
              >
                <div className="iris-source-icon">
                  <RiComputerLine size={24} />
                </div>
                <span className="text-[10px] font-bold tracking-wide text-[var(--ink-dim)]">
                  Screen share
                </span>
              </button>
            </div>

            <div className="p-3 bg-[var(--bg-sunken)]/40 text-center border-t border-[var(--line-soft)]">
              <p className="text-[9px] text-[var(--ink-faint)] font-data">
                Select what jarvis 2.O should see
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default IRIS