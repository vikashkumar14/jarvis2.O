import { useEffect, useCallback, useRef, useState } from 'react'
import {
  RiMenuLine,
  RiHome5Line,
  RiChat3Line,
  RiMicLine,
  RiMicOffLine,
  RiFlashlightLine,
  RiFolderLine,
  RiAppsLine,
  RiSettings3Line,
  RiCameraLine,
  RiSearchLine,
  RiCodeSLine,
  RiPlayCircleLine,
  RiFileTextLine,
  RiCalendarLine,
  RiTerminalBoxLine,
  RiSwapBoxLine,
  RiCloseLine,
  RiNotification3Line,
  RiCloudyLine,
  RiArrowRightSLine,
  RiWhatsappLine,
  RiGoogleLine,
  RiInformationLine,
  RiDeleteBin6Line,
  RiAddLine,
  RiPhoneFill,
  RiHistoryLine
} from 'react-icons/ri'
import * as faceapi from 'face-api.js'
import { VisionMode } from '@renderer/IndexRoot'
import Sphere from '@renderer/components/Sphere'

// ── Real props coming from IRIS.tsx (SAME contract as the old DashboardView) ──
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

interface DashboardViewProps {
  props: IrisProps
  stats: any
  chatHistory: any[]
  onVisionClick: () => void
  /** Optional: wire this to actually send a typed command to Iris. If not
   * provided, the command bar still works for viewing but won't dispatch. */
  onSendCommand?: (text: string) => void
  /** Optional: wire quick-action buttons (Open WhatsApp, Screenshot, etc.)
   * to your existing IPC/command handlers. Falls back to onSendCommand. */
  onQuickAction?: (label: string) => void
  /** Optional: navigation callback used by sidebar items in the dashboard. */
  onNavigate?: (label: string) => void
}

// ── Analog clock (decorative only, uses real system time) ──────────────────
function AnalogClock({ now }: { now: Date }) {
  const s = now.getSeconds() + now.getMilliseconds() / 1000
  const m = now.getMinutes() + s / 60
  const h = (now.getHours() % 12) + m / 60
  const secDeg = s * 6
  const minDeg = m * 6
  const hrDeg = h * 30

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="46" fill="none" stroke="#1E2A24" strokeWidth="2" />
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 * Math.PI) / 180
        const x1 = 50 + Math.sin(angle) * 40
        const y1 = 50 - Math.cos(angle) * 40
        const x2 = 50 + Math.sin(angle) * 44
        const y2 = 50 - Math.cos(angle) * 44
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2A3A32" strokeWidth={i % 3 === 0 ? 2 : 1} />
        )
      })}
      <line x1="50" y1="50" x2={50 + Math.sin((hrDeg * Math.PI) / 180) * 22} y2={50 - Math.cos((hrDeg * Math.PI) / 180) * 22} stroke="#E8EDE9" strokeWidth="3" strokeLinecap="round" />
      <line x1="50" y1="50" x2={50 + Math.sin((minDeg * Math.PI) / 180) * 32} y2={50 - Math.cos((minDeg * Math.PI) / 180) * 32} stroke="#E8EDE9" strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="50" x2={50 + Math.sin((secDeg * Math.PI) / 180) * 36} y2={50 - Math.cos((secDeg * Math.PI) / 180) * 36} stroke="#00E38C" strokeWidth="1" strokeLinecap="round" />
      <circle cx="50" cy="50" r="2.4" fill="#00E38C" />
    </svg>
  )
}

export default function DashboardView({
  props,
  stats,
  chatHistory,
  onVisionClick,
  onSendCommand,
  onQuickAction,
  onNavigate
}: DashboardViewProps) {
  const {
    isSystemActive,
    isVideoOn,
    visionMode,
    startVision,
    activeStream,
    toggleMic,
    toggleSystem,
    isMicMuted
  } = props

  const scrollRef = useRef<HTMLDivElement>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const faceScanInterval = useRef<NodeJS.Timeout | null>(null)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [now, setNow] = useState(new Date())
  const [command, setCommand] = useState('')
  const [showTranscript, setShowTranscript] = useState(false)
  const [activeNav, setActiveNav] = useState('Dashboard')

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chatHistory])

  // ── same face-api pipeline as before — unchanged logic ──
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = './models'
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
        ])
        setModelsLoaded(true)
      } catch (e) {}
    }
    loadModels()
  }, [])

  useEffect(() => {
    if (isVideoOn && visionMode === 'camera' && modelsLoaded && videoElementRef.current && canvasRef.current) {
      if (faceScanInterval.current) clearInterval(faceScanInterval.current)
      faceScanInterval.current = setInterval(async () => {
        const video = videoElementRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState !== 4 || video.videoWidth === 0) return
        try {
          const vw = video.videoWidth
          const vh = video.videoHeight
          if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw
            canvas.height = vh
          }
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })
          const detection = await faceapi.detectSingleFace(video, options).withFaceExpressions().withAgeAndGender()
          ctx.clearRect(0, 0, vw, vh)
          if (detection) {
            const { x, y, width, height } = detection.detection.box
            const mirroredX = vw - x - width
            ctx.strokeStyle = '#4DFFC7'
            ctx.lineWidth = 2
            const l = 20
            ctx.beginPath()
            ctx.moveTo(mirroredX, y + l)
            ctx.lineTo(mirroredX, y)
            ctx.lineTo(mirroredX + l, y)
            ctx.moveTo(mirroredX + width - l, y)
            ctx.lineTo(mirroredX + width, y)
            ctx.lineTo(mirroredX + width, y + l)
            ctx.moveTo(mirroredX, y + height - l)
            ctx.lineTo(mirroredX, y + height)
            ctx.lineTo(mirroredX + l, y + height)
            ctx.moveTo(mirroredX + width - l, y + height)
            ctx.lineTo(mirroredX + width, y + height)
            ctx.lineTo(mirroredX + width, y + height - l)
            ctx.stroke()
            const expressions = detection.expressions
            const domExp = Object.keys(expressions).reduce((a, b) => (expressions[a] > expressions[b] ? a : b))
            const gender = detection.gender === 'male' ? 'M' : 'F'
            const age = Math.round(detection.age)
            ctx.fillStyle = 'rgba(10,11,13,0.85)'
            ctx.fillRect(mirroredX, y - 26, width, 22)
            ctx.fillStyle = '#4DFFC7'
            ctx.font = 'bold 13px "JetBrains Mono", monospace'
            ctx.fillText(` ${gender} | ${age}y | ${domExp.toUpperCase()} `, mirroredX + 4, y - 10)
          } else {
            ctx.fillStyle = 'rgba(0, 227, 140, 0.7)'
            ctx.font = 'bold 12px "JetBrains Mono", monospace'
            ctx.fillText('SCANNING…', 12, 24)
          }
        } catch (e) {}
      }, 250)
    } else {
      if (faceScanInterval.current) clearInterval(faceScanInterval.current)
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
    }
    return () => {
      if (faceScanInterval.current) clearInterval(faceScanInterval.current)
    }
  }, [isVideoOn, visionMode, modelsLoaded])

  const setVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoElementRef.current = node
      if (node && activeStream && isVideoOn) {
        node.srcObject = activeStream
        node.onloadedmetadata = () => node.play().catch(() => {})
      }
    },
    [activeStream, isVideoOn, visionMode]
  )

  const toggleSource = () => {
    if (!isSystemActive) return
    startVision(visionMode === 'camera' ? 'screen' : 'camera')
  }

  const submitCommand = () => {
    if (!command.trim()) return
    onSendCommand?.(command.trim())
    setCommand('')
  }

  // ── real metrics from the `stats` prop passed by IRIS.tsx (same as before) ──
  const metrics = [
    { label: 'CPU Usage', val: isSystemActive && stats ? stats.cpu : null },
    { label: 'RAM Usage', val: isSystemActive && stats ? stats.memory?.usedPercentage : null },
    { label: 'Disk Usage', val: isSystemActive && stats ? stats.disk?.usedPercentage : null },
    { label: 'Temp', val: isSystemActive && stats ? stats.temperature : null, unit: '°' }
  ]

  const navItems = [
    { icon: <RiHome5Line size={17} />, label: 'Dashboard' },
    { icon: <RiChat3Line size={17} />, label: 'Chat' },
    { icon: <RiFlashlightLine size={17} />, label: 'Automation' },
    { icon: <RiFolderLine size={17} />, label: 'Files & Folders' },
    { icon: <RiAppsLine size={17} />, label: 'Apps' },
    { icon: <RiSettings3Line size={17} />, label: 'System Control' },
    { icon: <RiCameraLine size={17} />, label: 'Camera' },
    { icon: <RiSearchLine size={17} />, label: 'Web Search' },
    { icon: <RiCodeSLine size={17} />, label: 'Code Assistant' },
    { icon: <RiPlayCircleLine size={17} />, label: 'Media Player' },
    { icon: <RiFileTextLine size={17} />, label: 'Notes' },
    { icon: <RiCalendarLine size={17} />, label: 'Calendar' },
    { icon: <RiSettings3Line size={17} />, label: 'Settings' }
  ]

  const quickActions = [
    { icon: <RiWhatsappLine size={15} />, label: 'Open WhatsApp' },
    { icon: <RiSwapBoxLine size={15} />, label: 'Take Screenshot' },
    { icon: <RiCameraLine size={15} />, label: 'Open Camera' },
    { icon: <RiGoogleLine size={15} />, label: 'Search on Google' },
    { icon: <RiFileTextLine size={15} />, label: 'Open Notepad' },
    { icon: <RiInformationLine size={15} />, label: 'System Information' },
    { icon: <RiDeleteBin6Line size={15} />, label: 'Clear Temp Files', danger: true }
  ]

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour12: true })
  const hourGreeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 18 ? 'Good Afternoon' : 'Good Evening'

  return (
    <div className="jd-root w-full h-full flex flex-col overflow-hidden">
      <style>{`
        .jd-root {
          --bg: #0A0B0D; --panel: #101215; --panel-2: #131619;
          --line: #1D2320; --line-soft: #171B19;
          --ink: #E9EDEA; --ink-dim: #8A948E; --ink-faint: #5A645E;
          --green: #00E38C; --green-bright: #4DFFC7; --green-soft: #00E38C1A;
          --danger: #FF5B5B;
          font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif;
          background: var(--bg); color: var(--ink);
        }
        .jd-root .font-data { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .jd-scroll::-webkit-scrollbar { width: 6px; }
        .jd-scroll::-webkit-scrollbar-thumb { background: #1E2422; border-radius: 10px; }
        .jd-panel { background: linear-gradient(180deg, var(--panel-2) 0%, var(--panel) 100%); border: 1px solid var(--line); border-radius: 16px; }
        .jd-topbar { background: var(--panel); border-bottom: 1px solid var(--line-soft); }
        .jd-icon-box { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: var(--panel-2); border: 1px solid var(--line); color: var(--ink-dim); cursor: pointer; }
        .jd-cmd-input { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; color: var(--ink); }
        .jd-cmd-input::placeholder { color: var(--ink-faint); }
        .jd-cmd-input:focus-within { border-color: #00E38C55; }
        .jd-toggle-pill { border-radius: 999px; padding: 4px 12px 4px 10px; display: flex; align-items: center; gap: 8px; background: var(--panel-2); border: 1px solid var(--line); cursor: pointer; }
        .jd-switch { width: 32px; height: 18px; border-radius: 999px; position: relative; cursor: pointer; transition: background 0.2s ease; }
        .jd-switch.on { background: var(--green); box-shadow: 0 0 10px rgba(0,227,140,0.5); }
        .jd-switch.off { background: #2A2E2C; }
        .jd-switch .knob { position: absolute; top: 2px; width: 14px; height: 14px; border-radius: 999px; background: #fff; transition: left 0.2s ease; }
        .jd-switch.on .knob { left: 16px; }
        .jd-switch.off .knob { left: 2px; }
        .jd-nav-item { display: flex; align-items: center; gap: 12px; padding: 9px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; color: var(--ink-dim); cursor: pointer; transition: all 0.15s ease; border: 1px solid transparent; }
        .jd-nav-item:hover { background: var(--panel-2); color: var(--ink); }
        .jd-nav-item.active { background: var(--green-soft); color: var(--green-bright); border-color: #00E38C33; }
        .jd-quick-btn { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; background: var(--panel-2); border: 1px solid var(--line); font-size: 12px; font-weight: 600; color: var(--ink-dim); cursor: pointer; transition: all 0.15s ease; }
        .jd-quick-btn:hover { border-color: #00E38C44; color: var(--green-bright); transform: translateX(2px); }
        .jd-quick-btn.danger:hover { border-color: #FF5B5B55; color: var(--danger); }
        .jd-quick-icon { width: 26px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center; background: var(--green-soft); color: var(--green); }
        .jd-quick-btn.danger .jd-quick-icon { background: #FF5B5B1A; color: var(--danger); }
        .jd-meter-track { height: 5px; background: #141815; border-radius: 999px; overflow: hidden; }
        .jd-meter-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #00E38C, #4DFFC7); box-shadow: 0 0 8px rgba(0,227,140,0.6); transition: width 0.6s ease; }
        .jd-pulse { animation: jd-pulse-kf 1.6s infinite; }
        @keyframes jd-pulse-kf { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
        .jd-mic-btn { width: 54px; height: 54px; border-radius: 999px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease; }
        .jd-mic-btn.on { background: radial-gradient(circle at 35% 30%, #1FFFB0, #00B36A); box-shadow: 0 0 24px rgba(0,227,140,0.55); color: #06251A; }
        .jd-mic-btn.off { background: radial-gradient(circle at 35% 30%, #FF8A8A, #E23B3B); box-shadow: 0 0 24px rgba(255,91,91,0.5); color: #2A0808; }
        .jd-stop-btn { width: 54px; height: 54px; border-radius: 999px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .jd-stop-btn.on { background: radial-gradient(circle at 35% 30%, #1FFFB0, #00B36A); box-shadow: 0 0 24px rgba(0,227,140,0.5); color: #06251A; }
        .jd-stop-btn.off { background: radial-gradient(circle at 35% 30%, #FF8A8A, #E23B3B); box-shadow: 0 0 24px rgba(255,91,91,0.5); color: #2A0808; }
        .jd-bottom-chip { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 16px; background: var(--panel-2); border: 1px solid var(--line); cursor: pointer; transition: all 0.15s ease; min-width: 92px; }
        .jd-bottom-chip:hover { transform: translateY(-2px); }
        .jd-bottom-chip .ring { width: 34px; height: 34px; border-radius: 999px; display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--line); }
        .jd-bottom-chip.on .ring { border-color: #00E38C; color: var(--green-bright); box-shadow: 0 0 12px rgba(0,227,140,0.35); }
        .jd-bottom-chip.off .ring { color: var(--ink-faint); }
        .jd-bottom-chip.danger .ring { border-color: #FF5B5B; color: var(--danger); box-shadow: 0 0 12px rgba(255,91,91,0.3); }
        .jd-bottom-chip.disabled { opacity: 0.4; pointer-events: none; }
        .jd-bottom-chip .lbl { font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-faint); }
        .jd-bottom-chip .val { font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
        .jd-video-wrap { position: relative; border-radius: 14px; overflow: hidden; background: #050606; border: 1px solid var(--line); }
      `}</style>

      {/* ── TOP BAR ── */}
      <div className="jd-topbar flex items-center gap-3 px-4 py-2.5 shrink-0">
        <button className="jd-icon-box">
          <RiMenuLine size={18} />
        </button>
        <div className="flex items-center gap-2 pr-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#00E38C,#00A968)' }}>
            <RiFlashlightLine size={16} color="#04140D" />
          </div>
          <span className="font-extrabold tracking-wide text-[15px]">JARVIS AI</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-data" style={{ background: 'var(--panel-2)', color: 'var(--ink-faint)', border: '1px solid var(--line)' }}>
            v2.0.0
          </span>
        </div>

        <div className="flex-1 flex items-center gap-2 jd-cmd-input px-3 py-2 max-w-xl">
          <RiTerminalBoxLine size={15} className="text-[var(--green)]" />
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitCommand()}
            placeholder="Type a command..."
            className="bg-transparent flex-1 text-[13px] outline-none"
          />
        </div>

        <button onClick={onVisionClick} className="jd-icon-box" title="Toggle vision">
          <RiCameraLine size={17} color={isVideoOn ? '#4DFFC7' : undefined} />
        </button>

        {/* REAL toggle — calls props.toggleSystem, same as the working button before */}
        <div className="jd-toggle-pill" onClick={toggleSystem}>
          <span className="text-[10px] font-bold tracking-wide text-[var(--ink-dim)]">ASSISTANT</span>
          <span className="text-[10px] font-bold text-[var(--green-bright)]">{isSystemActive ? 'ON' : 'OFF'}</span>
          <div className={`jd-switch ${isSystemActive ? 'on' : 'off'}`}>
            <div className="knob" />
          </div>
        </div>

        <div className="flex flex-col items-end leading-tight pl-2">
          <span className="text-[13px] font-bold font-data">{timeStr}</span>
          <span className="text-[9px] text-[var(--ink-faint)]">{dateStr}</span>
        </div>

        <button className="jd-icon-box relative">
          <RiNotification3Line size={16} />
          <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full jd-pulse" style={{ background: 'var(--green)' }} />
        </button>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT NAV */}
        <div className="hidden lg:flex flex-col justify-between w-[220px] shrink-0 border-r border-[var(--line-soft)] py-3 px-2.5">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <div
                key={item.label}
                className={`jd-nav-item ${activeNav === item.label ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav(item.label)
                  onNavigate?.(item.label)
                }}
              >
                {item.icon}
                {item.label}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* CENTER LEFT — greeting, quick actions, live camera/screen feed */}
          <div className="hidden md:flex flex-col gap-4 w-[270px] shrink-0 p-4 overflow-y-auto jd-scroll">
            <div className="jd-panel p-4">
              <span className="text-[13px] text-[var(--ink-dim)]">{hourGreeting},</span>
              <div className="text-[22px] font-extrabold text-[var(--green-bright)] leading-tight">Vikash</div>
              <div className="text-[11px] text-[var(--ink-faint)] mt-1">
                {isSystemActive ? 'How can I help you today?' : 'Assistant is offline'}
              </div>
            </div>

            {/* REAL live video/screen feed — bound to activeStream like before */}
            <div className="jd-video-wrap shrink-0" style={{ height: 160 }}>
              <div className="absolute top-2 left-3 z-20 flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isVideoOn ? 'bg-[var(--green)] jd-pulse' : 'bg-[var(--ink-faint)]'}`}
                />
                <span className="text-[9px] font-bold tracking-wide" style={{ color: isVideoOn ? 'var(--green-bright)' : 'var(--ink-faint)' }}>
                  {isVideoOn ? (visionMode === 'screen' ? 'Screen' : 'Camera') : 'Offline'}
                </span>
              </div>
              {isVideoOn && (
                <button onClick={toggleSource} className="absolute top-2 right-2 z-20 jd-icon-box" style={{ width: 26, height: 26 }}>
                  <RiSwapBoxLine size={12} />
                </button>
              )}
              <video
                key={visionMode}
                ref={setVideoRef}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: visionMode === 'camera' ? 'scaleX(-1)' : 'none', opacity: isVideoOn ? 1 : 0.15 }}
                autoPlay
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10" />
              {!isVideoOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-30">
                  <RiCameraLine size={20} className="text-[var(--green-bright)]" />
                  <span className="text-[10px] font-bold tracking-wide">No signal</span>
                </div>
              )}
            </div>

            <div className="jd-panel p-4 flex-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold tracking-[0.12em] text-[var(--ink-faint)]">QUICK ACTIONS</span>
                <RiAddLine size={14} className="text-[var(--ink-faint)]" />
              </div>
              <div className="flex flex-col gap-2">
                {quickActions.map((qa) => (
                  <div
                    key={qa.label}
                    className={`jd-quick-btn ${qa.danger ? 'danger' : ''}`}
                    onClick={() => (onQuickAction ? onQuickAction(qa.label) : onSendCommand?.(qa.label))}
                  >
                    <span className="jd-quick-icon">{qa.icon}</span>
                    {qa.label}
                  </div>
                ))}
              </div>
              {!onQuickAction && !onSendCommand && (
                <p className="text-[9px] text-[var(--ink-faint)] mt-3 leading-relaxed">
                  Pass <code className="font-data">onQuickAction</code> or <code className="font-data">onSendCommand</code> from IRIS.tsx to wire these to real commands.
                </p>
              )}
            </div>
          </div>

          {/* CENTER SPHERE */}
          <div className="flex-1 flex flex-col items-center justify-between p-4 min-w-0">
            <div className="flex items-center gap-2 text-[var(--green-bright)] mt-1">
              <div className="flex items-end gap-[2px] h-3.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="jd-pulse" style={{ width: 2, height: `${30 + (i % 3) * 25}%`, background: 'var(--green)', animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-[15px] font-semibold">
                {!isSystemActive ? 'Standby' : isMicMuted ? 'Muted' : 'Listening…'}
              </span>
            </div>

            <div className="relative flex-1 w-full flex items-center justify-center min-h-0">
              <div
                style={{
                  width: 'min(48vh, 420px)',
                  height: 'min(48vh, 420px)',
                  opacity: isSystemActive ? 1 : 0.45,
                  filter: isSystemActive ? 'none' : 'grayscale(0.7)',
                  transform: isSystemActive ? 'scale(1)' : 'scale(0.88)',
                  transition: 'opacity 0.6s ease, filter 0.6s ease, transform 0.6s ease'
                }}
              >
                <Sphere />
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 w-full max-w-xl">
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={toggleSystem}>
                <span className="w-1.5 h-1.5 rounded-full jd-pulse" style={{ background: isSystemActive ? 'var(--green)' : 'var(--ink-faint)' }} />
                <span className="text-[11px] font-bold tracking-wide" style={{ color: isSystemActive ? 'var(--green-bright)' : 'var(--ink-faint)' }}>
                  {isSystemActive ? 'ONLINE' : 'OFFLINE'}
                </span>
                <RiArrowRightSLine size={13} className="text-[var(--ink-faint)]" />
              </div>

              {/* REAL mic control — calls props.toggleMic */}
              <div className="jd-panel w-full flex items-center gap-3 px-4 py-2.5">
                <div className={`jd-mic-btn shrink-0 ${!isMicMuted ? 'on' : 'off'}`} onClick={toggleMic}>
                  {isMicMuted ? <RiMicOffLine size={20} /> : <RiMicLine size={20} />}
                </div>
                <div className="flex-1 flex items-end gap-[2px] h-8">
                  {Array.from({ length: 46 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 2,
                        height: isSystemActive && !isMicMuted ? `${8 + Math.abs(Math.sin(i * 0.7)) * 90}%` : '8%',
                        background: 'var(--green)',
                        opacity: 0.35 + (i % 4) * 0.15,
                        borderRadius: 2,
                        transition: 'height 0.2s ease'
                      }}
                    />
                  ))}
                </div>
                {/* REAL stop — calls props.toggleSystem to turn assistant off */}
                <div className={`jd-stop-btn shrink-0 ${isSystemActive ? 'off' : 'on'}`} onClick={toggleSystem} title={isSystemActive ? 'Stop assistant' : 'Start assistant'}>
                  {isSystemActive ? <RiCloseLine size={18} /> : <RiPhoneFill size={16} />}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="hidden xl:flex flex-col gap-4 w-[280px] shrink-0 p-4 overflow-y-auto jd-scroll">
            {/* REAL system stats from `stats` prop */}
            <div className="jd-panel p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold tracking-[0.12em] text-[var(--ink-faint)] flex items-center gap-1.5">
                  <RiAddLine size={12} /> SYSTEM MONITOR
                </span>
                <span className="text-[9px] font-bold text-[var(--green-bright)] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full jd-pulse" style={{ background: 'var(--green)' }} />
                  {isSystemActive ? 'Live' : 'Idle'}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {metrics.map((m) => (
                  <div key={m.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[11px] text-[var(--ink-dim)]">{m.label}</span>
                      <span className="text-[11px] font-bold font-data text-[var(--ink)]">
                        {m.val != null ? `${m.val}${m.unit || '%'}` : '--'}
                      </span>
                    </div>
                    <div className="jd-meter-track">
                      <div className="jd-meter-fill" style={{ width: `${m.val || 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {stats?.os?.type && (
                <div className="flex justify-between mt-3 pt-3 border-t border-[var(--line-soft)]">
                  <span className="text-[10px] text-[var(--ink-faint)]">OS</span>
                  <span className="text-[10px] font-bold font-data">{stats.os.type}</span>
                </div>
              )}
            </div>

            {/* Weather — decorative unless you wire a real weather source */}
            <div className="jd-panel p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold tracking-[0.12em] text-[var(--ink-faint)] flex items-center gap-1.5">
                  <RiAddLine size={12} /> WEATHER
                </span>
                <span className="text-[9px] text-[var(--ink-faint)]">Patna, IN</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[30px] font-extrabold font-data">28°C</span>
                <RiCloudyLine size={30} className="text-[var(--ink-dim)]" />
              </div>
            </div>

            <div className="jd-panel p-4">
              <span className="text-[10px] font-bold tracking-[0.12em] text-[var(--ink-faint)]">DATE &amp; TIME</span>
              <div className="flex items-center gap-4 mt-2">
                <div className="w-16 h-16 shrink-0">
                  <AnalogClock now={now} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[16px] font-extrabold font-data">{timeStr}</span>
                  <span className="text-[10px] text-[var(--ink-faint)] mt-1">{dateStr}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── REAL transcript — actual chatHistory from Iris, hidden behind a toggle button ── */}
      <div className="hidden md:block px-4 pb-3 shrink-0">
        {showTranscript ? (
          <div className="jd-panel h-full flex flex-col overflow-hidden" style={{ height: 150 }}>
            <div className="px-4 py-2.5 border-b border-[var(--line-soft)] flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold tracking-[0.12em] text-[var(--ink-faint)] flex items-center gap-1.5">
                <RiTerminalBoxLine size={11} /> TRANSCRIPT
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTranscript(false)}
                  className="text-[9px] font-bold font-data px-2 py-1 rounded-full border border-[var(--line-soft)] hover:border-[var(--green)]"
                >
                  Hide
                </button>
                <span className="text-[9px] font-bold font-data" style={{ color: isSystemActive ? 'var(--green-bright)' : 'var(--ink-faint)' }}>
                  {isSystemActive ? '● Rec' : '○ Idle'}
                </span>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1.5 jd-scroll">
              {chatHistory.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-1.5 opacity-25">
                  <RiHistoryLine size={18} />
                  <span className="text-[10px] font-bold">No data stream</span>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className="max-w-[70%] px-2.5 py-1.5 text-[11px] leading-relaxed font-data font-semibold"
                      style={{
                        borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                        background: msg.role === 'user' ? 'var(--green-soft)' : 'var(--panel-2)',
                        border: msg.role === 'user' ? '1px solid #00E38C40' : '1px solid var(--line-soft)',
                        color: msg.role === 'user' ? 'var(--green-bright)' : 'var(--ink-dim)'
                      }}
                    >
                      {msg.parts && msg.parts[0] ? msg.parts[0].text : msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              onClick={() => setShowTranscript(true)}
              className="jd-quick-btn"
              style={{ minWidth: 140 }}
            >
              Show Transcript
            </button>
          </div>
        )}
      </div>

      {/* ── BOTTOM CONTROL BAR — every chip calls a REAL handler from props ── */}
      <div className="flex items-center justify-center gap-3 px-4 pb-4 shrink-0 flex-wrap">
        <div className={`jd-bottom-chip ${isSystemActive ? 'on' : 'off'}`} onClick={toggleSystem}>
          <div className="ring">
            <RiPhoneFill size={15} />
          </div>
          <span className="lbl">Assistant</span>
          <span className="val" style={{ color: isSystemActive ? 'var(--green-bright)' : 'var(--ink-faint)' }}>
            {isSystemActive ? 'ON' : 'OFF'}
          </span>
        </div>

        <div className={`jd-bottom-chip ${!isMicMuted ? 'on' : 'off'} ${!isSystemActive ? 'disabled' : ''}`} onClick={toggleMic}>
          <div className="ring">{isMicMuted ? <RiMicOffLine size={15} /> : <RiMicLine size={15} />}</div>
          <span className="lbl">Mic</span>
          <span className="val" style={{ color: !isMicMuted ? 'var(--green-bright)' : 'var(--ink-faint)' }}>
            {isMicMuted ? 'MUTED' : 'LIVE'}
          </span>
        </div>

        <div className={`jd-bottom-chip ${isVideoOn ? 'on' : 'off'}`} onClick={onVisionClick}>
          <div className="ring">
            <RiCameraLine size={15} />
          </div>
          <span className="lbl">Vision</span>
          <span className="val" style={{ color: isVideoOn ? 'var(--green-bright)' : 'var(--ink-faint)' }}>
            {isVideoOn ? 'OPEN' : 'CLOSED'}
          </span>
        </div>

        <div className={`jd-bottom-chip on ${!isVideoOn ? 'disabled' : ''}`} onClick={toggleSource}>
          <div className="ring">
            <RiSwapBoxLine size={15} />
          </div>
          <span className="lbl">Source</span>
          <span className="val" style={{ color: 'var(--green-bright)' }}>
            {visionMode === 'screen' ? 'SCREEN' : 'CAMERA'}
          </span>
        </div>
      </div>
    </div>
  )
}