import { useState, useEffect, useRef } from 'react'
import { FaApple, FaAndroid, FaWindows } from 'react-icons/fa6'
import {
  RiLinkM,
  RiWifiLine,
  RiSmartphoneLine,
  RiSignalWifi3Line,
  RiBattery2ChargeLine,
  RiDatabase2Line,
  RiShutDownLine,
  RiCameraLensLine,
  RiLockPasswordLine,
  RiSunLine,
  RiTerminalBoxLine,
  RiHome5Line,
  RiHistoryLine,
  RiAddLine,
  RiTerminalLine,
  RiFileCopyLine,
  RiCheckLine,
  RiArrowRightSLine,
  RiCodeLine,
  RiUsbLine,
  RiShieldCheckLine,
  RiRocketLine,
  RiArrowLeftLine
} from 'react-icons/ri'

const PhoneView = ({ glassPanel }: { glassPanel?: string }) => {
  const [ip, setIp] = useState(() => localStorage.getItem('jarvis 2.O_adb_ip') || '')
  const [port, setPort] = useState(() => localStorage.getItem('jarvis 2.O_adb_port') || '5555')
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle')
  const [uiMode, setUiMode] = useState<'history' | 'manual'>('history')
  const [errorMsg, setErrorMsg] = useState('')
  const [deviceHistory, setDeviceHistory] = useState<any[]>([])
  const [copied, setCopied] = useState(false)
  const [connectingIp, setConnectingIp] = useState('')

  const screenRef = useRef<HTMLImageElement>(null)
  const isStreaming = useRef(false)
  const knownNotifs = useRef<string[]>([])
  const hasAutoConnected = useRef(false)

  const [telemetry, setTelemetry] = useState({
    model: 'UNKNOWN DEVICE',
    os: 'ANDROID --',
    battery: { level: 0, isCharging: false, temp: '0.0' },
    storage: { used: '0 GB', total: '0 GB TOTAL', percent: 0 }
  })

  useEffect(() => {
    window.electron.ipcRenderer.invoke('adb-get-history').then((data) => {
      setDeviceHistory(data)

      if (data.length > 0 && !hasAutoConnected.current) {
        hasAutoConnected.current = true

        const lastDevice = data[data.length - 1]

        if (lastDevice && lastDevice.ip) {
          setIp(lastDevice.ip)
          setPort(lastDevice.port)
          connectToDevice(lastDevice.ip, lastDevice.port)
        }
      }
    })
  }, [])

  const checkNotifications = async () => {
    try {
      const res = await window.electron.ipcRenderer.invoke('adb-get-notifications')
      if (res.success && res.data) {
        const currentNotifs: string[] = res.data

        if (knownNotifs.current.length === 0) {
          knownNotifs.current = currentNotifs
          return
        }

        const newNotifs = currentNotifs.filter((n) => !knownNotifs.current.includes(n))

        if (newNotifs.length > 0) {
          window.dispatchEvent(
            new CustomEvent('ai-force-speak', {
              detail: `System Alert: The user just received a new mobile notification. Announce it out loud briefly: "${newNotifs[0]}"`
            })
          )
          knownNotifs.current = currentNotifs
        }
      }
    } catch (e) {}
  }

  const connectToDevice = async (targetIp: string, targetPort: string) => {
    if (!targetIp || !targetPort) return setErrorMsg('IP and Port are required.')
    setStatus('connecting')
    setConnectingIp(targetIp)
    setErrorMsg('')

    try {
      const res = await window.electron.ipcRenderer.invoke('adb-connect', {
        ip: targetIp,
        port: targetPort
      })
      if (res.success) {
        setStatus('connected')
        isStreaming.current = true
        fetchTelemetry()
        startScreenStream()
      } else {
        setStatus('idle')
        setErrorMsg('Connection refused. Ensure TCP/IP daemon is running (adb tcpip 5555).')
      }
    } catch (e) {
      setStatus('idle')
      setErrorMsg('Electron IPC Error.')
    } finally {
      setConnectingIp('')
    }
  }

  const handleManualConnect = () => {
    localStorage.setItem('jarvis 2.O_adb_ip', ip)
    localStorage.setItem('jarvis 2.O_adb_port', port)
    connectToDevice(ip, port)
  }

  const handleDisconnect = async () => {
    isStreaming.current = false
    try {
      await window.electron.ipcRenderer.invoke('adb-disconnect')
    } catch (e) {}
    setStatus('idle')
    if (screenRef.current) screenRef.current.src = ''
  }

  const executeQuickCommand = async (action: 'camera' | 'wake' | 'lock' | 'home') => {
    try {
      await window.electron.ipcRenderer.invoke('adb-quick-action', { action })
    } catch (e) {}
  }

  const fetchTelemetry = async () => {
    try {
      const res = await window.electron.ipcRenderer.invoke('adb-telemetry')
      if (res.success) setTelemetry(res.data)
    } catch (e) {}
  }

  const startScreenStream = async () => {
    if (!isStreaming.current) return
    try {
      const res = await window.electron.ipcRenderer.invoke('adb-screenshot')
      if (res.success && res.image && screenRef.current) {
        screenRef.current.src = res.image
      }
    } catch (e) {}

    if (isStreaming.current) {
      requestAnimationFrame(startScreenStream)
    }
  }

  const handleCopyCommand = () => {
    navigator.clipboard.writeText('adb tcpip 5555')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    let interval: any
    if (status === 'connected') {
      interval = setInterval(() => {
        fetchTelemetry()
        checkNotifications()
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [status])

  // Picks a brand icon purely from the saved model/os string — cosmetic only,
  // doesn't touch any connection logic.
  const getDeviceIcon = (dev: any) => {
    const blob = `${dev?.model || ''} ${dev?.os || ''}`.toLowerCase()
    if (blob.includes('iphone') || blob.includes('ios')) return FaApple
    if (blob.includes('windows')) return FaWindows
    if (blob.includes('android') || blob.includes('samsung') || blob.includes('redmi') || blob.includes('oneplus') || blob.includes('mi ')) return FaAndroid
    return RiSmartphoneLine
  }

  const guideSteps = [
    {
      icon: RiCodeLine,
      title: 'Enable USB debugging',
      desc: 'Go to Settings > Developer Options and enable USB Debugging. (If hidden, tap "Build Number" 7 times in About Phone).'
    },
    {
      icon: RiUsbLine,
      title: 'Connect physically',
      desc: 'Connect the device to this PC via USB cable. Accept the "Allow USB debugging" prompt on your phone.'
    },
    {
      icon: RiShieldCheckLine,
      title: 'Start the daemon',
      desc: 'Open your PC terminal and run this command to open the wireless port:',
      command: true
    },
    {
      icon: RiRocketLine,
      title: 'Disconnect & connect',
      desc: 'Unplug the USB cable. Enter the phone\'s Wi-Fi IP on the left and establish the connection.'
    }
  ]

  const DeckStyles = () => (
    <style>{`
      .pv-root {
        --bg-base: #101115;
        --bg-sunken: #0B0C10;
        --panel: #1B1C23;
        --panel-raised: #202129;
        --line: #2C2D37;
        --line-soft: #24252E;
        --ink: #F5F5F2;
        --ink-dim: #9C9CA8;
        --ink-faint: #5F606B;
        --green: #00E38C;
        --green-soft: #00E38C1A;
        --amber: #FFB454;
        --amber-soft: #FFB4541A;
        --danger: #FF6B6B;
        font-family: 'Manrope', -apple-system, sans-serif;
        background:
          radial-gradient(ellipse 1000px 520px at 20% -8%, #1B1C24 0%, transparent 60%),
          var(--bg-base);
        color: var(--ink);
      }
      .pv-root .font-data { font-family: 'JetBrains Mono', ui-monospace, monospace; }

      .pv-panel {
        background: linear-gradient(180deg, var(--panel-raised) 0%, var(--panel) 100%);
        border: 1px solid var(--line);
        border-radius: 22px;
        box-shadow:
          0 1px 0 0 rgba(255,255,255,0.04) inset,
          0 16px 32px -18px rgba(0,0,0,0.55);
      }

      .pv-well {
        background: var(--bg-sunken);
        border: 1px solid var(--line-soft);
        border-radius: 14px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4) inset;
      }

      .pv-icon-badge {
        border-radius: 14px;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, #262731 0%, #1D1E26 100%);
        box-shadow: 0 1px 0 0 rgba(255,255,255,0.05) inset, 0 4px 10px -4px rgba(0,0,0,0.5);
      }

      .pv-btn-3d {
        border-radius: 12px;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, #2A2B34 0%, #212229 100%);
        box-shadow:
          0 1px 0 0 rgba(255,255,255,0.06) inset,
          0 3px 0 0 #15161C,
          0 6px 10px -4px rgba(0,0,0,0.5);
        transition: transform 0.12s ease, box-shadow 0.12s ease;
      }
      .pv-btn-3d:active { transform: translateY(2px); box-shadow: 0 1px 0 0 rgba(255,255,255,0.04) inset, 0 1px 0 0 #15161C; }

      .pv-btn-primary {
        border-radius: 12px;
        background: linear-gradient(180deg, #33FFB0 0%, var(--green) 100%);
        box-shadow: 0 1px 0 0 rgba(255,255,255,0.25) inset, 0 3px 0 0 #00B36B, 0 8px 16px -6px rgba(0,227,140,0.4);
        transition: transform 0.12s ease, box-shadow 0.12s ease;
      }
      .pv-btn-primary:active { transform: translateY(2px); box-shadow: 0 1px 0 0 rgba(255,255,255,0.15) inset, 0 1px 0 0 #00B36B; }
      .pv-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

      .pv-field-shell {
        background: var(--bg-sunken);
        border: 1px solid var(--line-soft);
        border-radius: 12px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.35) inset;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .pv-field-shell:focus-within {
        border-color: var(--green);
        box-shadow: 0 0 0 3px var(--green-soft), 0 2px 4px rgba(0,0,0,0.35) inset;
      }

      .pv-eyebrow {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-faint);
      }

      /* device grid card */
      .pv-grid-card {
        border-radius: 20px;
        background: linear-gradient(180deg, var(--panel-raised) 0%, var(--panel) 100%);
        border: 1px solid var(--line);
        transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
      }
      .pv-grid-card:hover {
        border-color: #00B36B;
        transform: translateY(-3px);
        box-shadow: 0 20px 40px -18px rgba(0,227,140,0.22);
      }
      .pv-grid-card.is-live { border-color: var(--green); }

      .pv-badge {
        border-radius: 999px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        padding: 4px 12px;
      }
      .pv-badge-live { background: var(--green-soft); color: var(--green); border: 1px solid #00E38C33; }
      .pv-badge-idle { background: var(--bg-sunken); color: var(--ink-faint); border: 1px solid var(--line-soft); }
      .pv-badge-busy { background: var(--amber-soft); color: var(--amber); border: 1px solid #FFB45433; }

      .pv-new-card {
        border-radius: 20px;
        border: 2px dashed var(--line);
        transition: all 0.25s ease;
      }
      .pv-new-card:hover { border-color: var(--green); background: var(--green-soft); }

      .pv-guide-item {
        border-radius: 16px;
        border: 1px solid var(--line-soft);
        background: var(--bg-sunken);
        transition: border-color 0.2s ease;
      }
      .pv-guide-item:hover { border-color: var(--line); }

      .pv-stat-card {
        background: linear-gradient(180deg, var(--panel-raised) 0%, var(--panel) 100%);
        border: 1px solid var(--line);
        border-radius: 18px;
        transition: border-color 0.2s ease;
      }
      .pv-stat-card:hover { border-color: #00B36B; }

      .pv-meter-track { background: var(--bg-sunken); border-radius: 999px; overflow: hidden; }

      .pv-quick-btn {
        background: var(--bg-sunken);
        border: 1px solid var(--line-soft);
        border-radius: 16px;
        transition: all 0.18s ease;
      }
      .pv-quick-btn:hover { border-color: var(--green); background: var(--green-soft); }

      .pv-phone-frame {
        border-radius: 2.8rem;
        background: var(--bg-sunken);
        border: 10px solid var(--panel-raised);
        box-shadow:
          0 1px 0 0 rgba(255,255,255,0.04) inset,
          0 30px 60px -20px rgba(0,227,140,0.15),
          0 20px 40px -18px rgba(0,0,0,0.6);
      }

      .pv-status-dot-live { box-shadow: 0 0 0 3px var(--amber-soft), 0 0 10px var(--amber); }

      /* decorative hero glow — purely visual, no logic tied to it */
      .pv-hero-ring {
        position: absolute;
        border-radius: 50%;
        border: 1px solid #00E38C33;
        animation: pv-ring-pulse 3.5s ease-in-out infinite;
      }
      @keyframes pv-ring-pulse {
        0%, 100% { opacity: 0.25; transform: scale(0.96); }
        50% { opacity: 0.6; transform: scale(1.03); }
      }
      .pv-hero-glow {
        background: radial-gradient(circle, #00E38C33 0%, transparent 70%);
        filter: blur(4px);
      }
    `}</style>
  )

  // Decorative hero used on the empty/archive state — mirrors the glowing
  // phone visual from the reference, no functional weight.
  const HeroGlow = () => (
    <div className="relative w-56 h-56 flex items-center justify-center shrink-0">
      <div className="pv-hero-glow absolute w-40 h-40 rounded-full" />
      <div className="pv-hero-ring absolute w-44 h-44" style={{ animationDelay: '0s' }} />
      <div className="pv-hero-ring absolute w-56 h-56" style={{ animationDelay: '0.6s' }} />
      <div className="pv-hero-ring absolute w-32 h-32" style={{ animationDelay: '1.2s' }} />
      <RiSmartphoneLine size={52} className="text-[#4DFFC7] relative z-10" />
    </div>
  )

  const ConnectionGuidePanel = () => (
    <div className="pv-panel p-6 md:p-7 flex flex-col w-full lg:w-80 shrink-0">
      <div className="flex items-center gap-3 mb-6">
        <div className="pv-icon-badge w-10 h-10 flex items-center justify-center">
          <RiTerminalBoxLine className="text-[#4DFFC7]" size={18} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[var(--ink)]">Connection guide</h3>
          <p className="text-[10px] text-[var(--ink-faint)] font-data">Wireless ADB setup</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {guideSteps.map((step, i) => (
          <div key={i} className="pv-guide-item p-4">
            <div className="flex items-start gap-3">
              <div className="pv-icon-badge w-9 h-9 flex items-center justify-center shrink-0">
                <step.icon className="text-[#4DFFC7]" size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-[var(--ink)] mb-1">
                  {i + 1}. {step.title}
                </h4>
                <p className="text-[11px] text-[var(--ink-dim)] leading-relaxed">{step.desc}</p>

                {step.command && (
                  <div className="relative group mt-3">
                    <code className="pv-well block w-full text-[#4DFFC7] text-xs p-3 pr-11 tracking-widest font-data">
                      adb tcpip 5555
                    </code>
                    <button
                      onClick={handleCopyCommand}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[var(--ink-faint)] hover:text-[#4DFFC7] hover:bg-[var(--green-soft)] rounded-lg transition-all cursor-pointer"
                      title="Copy command"
                    >
                      {copied ? (
                        <RiCheckLine size={15} className="text-[var(--amber)]" />
                      ) : (
                        <RiFileCopyLine size={15} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // ---------- ARCHIVE / HISTORY VIEW ----------
  if (status !== 'connected' && uiMode === 'history') {
    return (
      <div className="pv-root flex-1 min-h-screen overflow-y-auto scrollbar-small p-6 md:p-10 pb-24">
        <DeckStyles />
        <div className="w-full max-w-7xl mx-auto flex flex-col xl:flex-row gap-8">
          <div className="flex-1 min-w-0">
            <div className="pv-panel p-8 md:p-10 flex flex-col md:flex-row items-center gap-8 mb-8 overflow-hidden relative">
              <div className="flex-1 min-w-0">
                <div className="pv-icon-badge w-12 h-12 flex items-center justify-center mb-5">
                  <RiHistoryLine className="text-[#4DFFC7]" size={22} />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-[var(--ink)] tracking-tight mb-2">
                  Device Archive
                </h1>
                <p className="text-xs text-[var(--ink-faint)] font-data tracking-wide">
                  Choose a device to connect or add a new one
                </p>
              </div>
              <HeroGlow />
            </div>

            {errorMsg && (
              <div className="p-4 mb-6 bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-xs rounded-xl font-data leading-relaxed">
                {errorMsg}
              </div>
            )}

            <h3 className="pv-eyebrow mb-4">Connected devices</h3>

            {deviceHistory.length === 0 ? (
              <div className="pv-well p-8 text-center text-xs text-[var(--ink-faint)] font-data mb-6">
                No saved devices yet — add one to get started.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 mb-6">
                {deviceHistory.map((dev, i) => {
                  const Icon = getDeviceIcon(dev)
                  const isBusy = status === 'connecting' && connectingIp === dev.ip
                  return (
                    <button
                      key={i}
                      onClick={() => connectToDevice(dev.ip, dev.port)}
                      disabled={status === 'connecting'}
                      className={`pv-grid-card p-5 flex flex-col items-center text-center cursor-pointer disabled:cursor-not-allowed ${isBusy ? 'is-live' : ''}`}
                    >
                      <div className="pv-well w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
                        <Icon size={26} className="text-[var(--ink-dim)]" />
                      </div>
                      <h3 className="text-sm font-bold text-[var(--ink)] mb-1 truncate w-full">
                        {dev.model || 'Unnamed device'}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[10px] font-data text-[var(--ink-faint)] mb-4">
                        <RiWifiLine size={11} /> {dev.ip}:{dev.port}
                      </div>
                      <span className={`pv-badge ${isBusy ? 'pv-badge-busy' : 'pv-badge-idle'}`}>
                        {isBusy ? 'Connecting…' : 'Tap to connect'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            <button
              onClick={() => setUiMode('manual')}
              className="pv-new-card w-full py-8 flex flex-col items-center justify-center gap-3 cursor-pointer group"
            >
              <div className="pv-btn-3d w-12 h-12 rounded-full flex items-center justify-center text-[var(--ink-dim)] group-hover:text-[#4DFFC7] transition-colors">
                <RiAddLine size={22} />
              </div>
              <div className="text-center">
                <span className="block text-sm font-bold text-[var(--ink)]">Add New Device</span>
                <span className="block text-[10px] text-[var(--ink-faint)] font-data mt-1">
                  Connect a new phone via wireless ADB
                </span>
              </div>
            </button>
          </div>

          <ConnectionGuidePanel />
        </div>
      </div>
    )
  }

  // ---------- MANUAL CONNECT VIEW ----------
  if (status !== 'connected' && uiMode === 'manual') {
    return (
      <div className="pv-root flex-1 min-h-screen overflow-y-auto p-6 md:p-10 pb-24">
        <DeckStyles />
        <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-[380px] flex flex-col gap-6 shrink-0">
            <div className="pv-panel p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="pv-icon-badge w-11 h-11 flex items-center justify-center">
                  <FaAndroid className="text-[#4DFFC7] text-lg" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[var(--ink)]">Device Uplink</h2>
                  <p className="text-[10px] text-[var(--ink-faint)] font-data">TCP/IP configuration</p>
                </div>
              </div>

              <button
                onClick={() => setUiMode('history')}
                className="pv-btn-3d flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-[var(--ink-dim)] hover:text-[#4DFFC7] px-3 py-2 transition-colors shrink-0 cursor-pointer"
              >
                <RiArrowLeftLine size={12} /> Archive
              </button>
            </div>

            <div className="pv-panel p-7 flex flex-col gap-6">
              {errorMsg && (
                <div className="p-4 bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-xs rounded-xl font-data leading-relaxed">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="pv-eyebrow mb-3 block">Target IP address</label>
                <div className="pv-field-shell flex items-center px-5 py-4">
                  <RiWifiLine className="text-[#4DFFC7] mr-3" size={18} />
                  <input
                    type="text"
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    placeholder="192.168.1.xxx"
                    className="bg-transparent border-none outline-none text-base text-[var(--ink)] w-full font-data placeholder:text-[var(--ink-faint)]"
                  />
                </div>
              </div>

              <div>
                <label className="pv-eyebrow mb-3 block">Target port</label>
                <div className="pv-field-shell flex items-center px-5 py-4">
                  <RiLinkM className="text-[#4DFFC7] mr-3" size={18} />
                  <input
                    type="text"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="5555"
                    className="bg-transparent border-none outline-none text-base text-[var(--ink)] w-full font-data placeholder:text-[var(--ink-faint)]"
                  />
                </div>
              </div>

              <button
                onClick={handleManualConnect}
                disabled={status === 'connecting'}
                className="pv-btn-primary w-full mt-2 py-4 text-[#0B0C10] font-bold tracking-wide text-sm cursor-pointer"
              >
                {status === 'connecting' ? 'Connecting…' : 'Establish connection'}
              </button>
            </div>
          </div>

          <ConnectionGuidePanel />
        </div>
      </div>
    )
  }

  // ---------- CONNECTED / DASHBOARD VIEW ----------
  return (
    <div className="pv-root flex-1 min-h-screen overflow-y-auto p-6 md:p-10 pb-24">
      <DeckStyles />
      <div className="w-full max-w-7xl mx-auto">
        <div className="pv-panel p-6 flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="pv-icon-badge w-12 h-12 flex items-center justify-center">
              <RiSmartphoneLine className="text-[#4DFFC7]" size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">{telemetry.model}</h2>
              <p className="text-[10px] text-[var(--ink-faint)] font-data tracking-wide">{telemetry.os}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="pv-badge pv-badge-live flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] pv-status-dot-live" /> Connected
            </span>
            <span className="text-[10px] font-data text-[var(--amber)]">{telemetry.battery.temp}°C</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0">
            <h3 className="pv-eyebrow mb-1">Device telemetry</h3>

            <div className="pv-stat-card p-5">
              <div className="flex justify-between items-center mb-3">
                <span className="pv-eyebrow">Network</span>
                <RiSignalWifi3Line className="text-[#4DFFC7]" size={16} />
              </div>
              <h4 className="text-2xl font-bold text-[var(--ink)]">Active</h4>
              <span className="text-[10px] font-data text-[var(--ink-faint)]">TCP/IP bridge</span>
            </div>

            <div className="pv-stat-card p-5">
              <div className="flex justify-between items-center mb-3">
                <span className="pv-eyebrow">Battery</span>
                <RiBattery2ChargeLine className="text-[var(--amber)]" size={16} />
              </div>
              <div className="flex justify-between items-end mb-2">
                <h4 className="text-3xl font-bold text-[var(--ink)]">{telemetry.battery.level}%</h4>
                <span className="text-[10px] font-data text-[var(--amber)]">
                  {telemetry.battery.isCharging ? 'Charging' : 'Discharging'}
                </span>
              </div>
              <div className="pv-meter-track w-full h-1.5">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${telemetry.battery.level}%`,
                    background: 'linear-gradient(90deg, #FFC777, #FFB454)',
                    boxShadow: '0 0 10px rgba(255,180,84,0.6)'
                  }}
                />
              </div>
            </div>

            <div className="pv-stat-card p-5">
              <div className="flex justify-between items-center mb-3">
                <span className="pv-eyebrow">Storage</span>
                <RiDatabase2Line className="text-[#4DFFC7]" size={16} />
              </div>
              <div className="flex justify-between items-end mb-2">
                <h4 className="text-3xl font-bold text-[var(--ink)]">{telemetry.storage.used}</h4>
                <span className="text-[10px] font-data text-[var(--ink-faint)]">{telemetry.storage.total}</span>
              </div>
              <div className="pv-meter-track w-full h-1.5">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${telemetry.storage.percent}%`,
                    background: 'linear-gradient(90deg, #33FFB0, #00E38C)',
                    boxShadow: '0 0 10px rgba(0,227,140,0.6)'
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <div className="pv-phone-frame w-full max-w-[320px] h-162.5 relative overflow-hidden flex flex-col">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-7 bg-[var(--panel-raised)] rounded-full z-20 flex items-center justify-end px-3 gap-2">
                <div className="w-2 h-2 rounded-full bg-[#4DFFC7]/50" />
                <div className="w-2 h-2 rounded-full bg-[var(--amber)] animate-pulse" />
              </div>
              <img ref={screenRef} alt="" className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="w-full lg:w-80 shrink-0">
            <div className="pv-panel p-6 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[var(--line-soft)]">
                <div className="pv-icon-badge w-10 h-10 flex items-center justify-center">
                  <RiTerminalBoxLine className="text-[#4DFFC7]" size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[var(--ink)] tracking-wide">System controls</h3>
                  <span className="text-[10px] text-[var(--amber)] font-data">Connection secured</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-auto">
                <button
                  onClick={() => executeQuickCommand('camera')}
                  className="pv-quick-btn group flex flex-col items-center justify-center gap-3 p-6 cursor-pointer"
                >
                  <RiCameraLensLine size={26} className="text-[var(--ink-faint)] group-hover:text-[#4DFFC7] transition-colors" />
                  <span className="text-[10px] font-bold text-[var(--ink)] tracking-wide">Camera</span>
                </button>
                <button
                  onClick={() => executeQuickCommand('lock')}
                  className="pv-quick-btn group flex flex-col items-center justify-center gap-3 p-6 cursor-pointer"
                >
                  <RiLockPasswordLine size={26} className="text-[var(--ink-faint)] group-hover:text-[#4DFFC7] transition-colors" />
                  <span className="text-[10px] font-bold text-[var(--ink)] tracking-wide">Lock</span>
                </button>
                <button
                  onClick={() => executeQuickCommand('wake')}
                  className="pv-quick-btn group flex flex-col items-center justify-center gap-3 p-6 cursor-pointer"
                >
                  <RiSunLine size={26} className="text-[var(--ink-faint)] group-hover:text-[#4DFFC7] transition-colors" />
                  <span className="text-[10px] font-bold text-[var(--ink)] tracking-wide">Wake</span>
                </button>
                <button
                  onClick={() => executeQuickCommand('home')}
                  className="pv-quick-btn group flex flex-col items-center justify-center gap-3 p-6 cursor-pointer"
                >
                  <RiHome5Line size={26} className="text-[var(--ink-faint)] group-hover:text-[#4DFFC7] transition-colors" />
                  <span className="text-[10px] font-bold text-[var(--ink)] tracking-wide">Home</span>
                </button>
              </div>

              <div className="pv-well mb-6 p-4 mt-6">
                <p className="text-[10px] text-[var(--ink-dim)] leading-relaxed text-center">
                  jarvis 2.O is listening via the primary audio interface. Voice commands for app
                  execution are online.
                </p>
              </div>

              <button
                onClick={handleDisconnect}
                className="w-full py-4 bg-[var(--danger)]/10 hover:bg-[var(--danger)] text-[var(--danger)] hover:text-white font-bold rounded-xl tracking-wide transition-all duration-300 border border-[var(--danger)]/30 flex items-center justify-center gap-3 cursor-pointer"
              >
                <RiShutDownLine size={18} /> Disconnect
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PhoneView