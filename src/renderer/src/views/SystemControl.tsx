import { useState, useEffect, useCallback, useRef } from 'react'
import {
  RiCpuLine,
  RiShieldCheckLine,
  RiRestartLine,
  RiShutDownLine,
  RiMoonLine,
  RiLockLine,
  RiVolumeMuteLine,
  RiVolumeUpLine,
  RiWifiLine,
  RiWifiOffLine,
  RiCameraLine,
  RiTaskLine,
  RiDeleteBinLine,
  RiHardDrive2Line,
  RiBattery2ChargeLine,
  RiTimeLine,
  RiCloseLine,
  RiCheckLine,
  RiLoader4Line,
  RiAlertLine,
  RiPulseLine,
  RiHeadphoneLine,
} from 'react-icons/ri'

interface SystemControlProps {
  isSystemActive: boolean
}

interface SystemStats {
  cpu: number
  ram: number
  battery: number | null
  disk: number
  uptimeSeconds: number
}

interface ToggleStates {
  alwaysListening: boolean
  muted: boolean
  wifiEnabled: boolean
}

type Feedback = 'idle' | 'running' | 'success' | 'error'

const safeInvoke = async (channel: string, payload?: any) => {
  try {
    if (!window.electron?.ipcRenderer?.invoke) return { success: false, error: 'No bridge' }
    return await window.electron.ipcRenderer.invoke(channel, payload)
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

const formatUptime = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

// ── Small circular-ish progress bar for a stat card ───────────────────────────
const StatBar = ({ value }: { value: number }) => (
  <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden mt-3">
    <div
      className={`h-full rounded-full transition-all duration-700 ${
        value > 85 ? 'bg-rose-400' : value > 60 ? 'bg-amber-400' : 'bg-emerald-400'
      }`}
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
)

const StatCard = ({
  icon,
  label,
  value,
  display,
}: {
  icon: React.ReactNode
  label: string
  value: number | null
  display: string
}) => (
  <div className="rounded-2xl border border-white/10 bg-[#0D1015] p-4">
    <div className="flex items-center justify-between text-zinc-400">
      <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      <span className="text-emerald-300/70">{icon}</span>
    </div>
    <p className="text-2xl font-bold text-white mt-1">{display}</p>
    {value !== null && <StatBar value={value} />}
  </div>
)

// ── Generic action button — handles its own running/success/error feedback ──
const ActionButton = ({
  icon,
  label,
  onRun,
  variant = 'default',
  disabled,
}: {
  icon: React.ReactNode
  label: string
  onRun: () => Promise<{ success: boolean; error?: string } | void>
  variant?: 'default' | 'danger'
  disabled?: boolean
}) => {
  const [state, setState] = useState<Feedback>('idle')

  const handleClick = async () => {
    if (state === 'running' || disabled) return
    setState('running')
    const result = await onRun()
    if (result && result.success === false) {
      setState('error')
    } else {
      setState('success')
    }
    setTimeout(() => setState('idle'), 1600)
  }

  const base = variant === 'danger'
    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-200 border border-rose-500/20'
    : 'bg-slate-900/90 hover:bg-slate-800 text-white border border-white/5'

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`rounded-2xl px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${base}`}
    >
      {state === 'running' ? (
        <RiLoader4Line size={16} className="animate-spin" />
      ) : state === 'success' ? (
        <RiCheckLine size={16} className="text-emerald-300" />
      ) : state === 'error' ? (
        <RiAlertLine size={16} className="text-rose-300" />
      ) : (
        icon
      )}
      {label}
    </button>
  )
}

// ── Toggle switch row ──────────────────────────────────────────────────────────
const ToggleRow = ({
  icon,
  label,
  description,
  checked,
  onToggle,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  description: string
  checked: boolean
  onToggle: () => void
  disabled?: boolean
}) => (
  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0D1015] px-4 py-3.5">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-300 flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
    </div>
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors cursor-pointer disabled:opacity-40 ${
        checked ? 'bg-emerald-500/70' : 'bg-white/10'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  </div>
)

// ── Confirmation modal for destructive power actions ──────────────────────────
const ConfirmModal = ({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div className="rounded-3xl border border-white/10 bg-[#0D1015] p-6 max-w-sm w-full shadow-2xl">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-300">
          <RiAlertLine size={19} />
        </div>
        <h3 className="text-base font-bold text-white">{title}</h3>
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed mb-6">{description}</p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-rose-500/80 hover:bg-rose-500 transition-colors cursor-pointer"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
)

const SystemControlView = ({ isSystemActive }: SystemControlProps) => {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [toggles, setToggles] = useState<ToggleStates>({ alwaysListening: true, muted: false, wifiEnabled: true })
  const [pendingConfirm, setPendingConfirm] = useState<null | 'shutdown' | 'restart' | 'sleep'>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Poll live system stats ──
  useEffect(() => {
    const fetchStats = async () => {
      const result = await safeInvoke('get-system-stats')
      if (result && result.success !== false) {
        setStats({
          cpu: result.cpu ?? 0,
          ram: result.ram ?? 0,
          battery: result.battery ?? null,
          disk: result.disk ?? 0,
          uptimeSeconds: result.uptimeSeconds ?? 0,
        })
      }
    }
    fetchStats()
    pollRef.current = setInterval(fetchStats, 4000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // ── Fetch initial toggle states ──
  useEffect(() => {
    safeInvoke('get-toggle-states').then((result) => {
      if (result && result.success !== false) {
        setToggles({
          alwaysListening: result.alwaysListening ?? true,
          muted: result.muted ?? false,
          wifiEnabled: result.wifiEnabled ?? true,
        })
      }
    })
  }, [])

  const runPowerAction = useCallback(async (action: 'shutdown' | 'restart' | 'sleep') => {
    setPendingConfirm(null)
    await safeInvoke(`system-${action}`)
  }, [])

  const handleToggle = async (key: keyof ToggleStates, channel: string) => {
    const next = !toggles[key]
    setToggles((prev) => ({ ...prev, [key]: next }))
    const result = await safeInvoke(channel, { enabled: next })
    if (result && result.success === false) {
      setToggles((prev) => ({ ...prev, [key]: !next })) // revert on failure
    }
  }

  return (
    <div className="flex-1 h-full bg-[#07080A] p-8 overflow-auto animate-in fade-in duration-300">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 h-full">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-300">
            <RiCpuLine size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">System Control</h1>
            <p className="text-sm text-zinc-400">Access system utilities and process-level controls from JARVIS.</p>
          </div>
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <span
              className={`w-2 h-2 rounded-full ${isSystemActive ? 'bg-emerald-400' : 'bg-zinc-600'}`}
              style={isSystemActive ? { boxShadow: '0 0 6px #34d399' } : undefined}
            />
            <span className="text-xs font-mono text-zinc-400">JARVIS {isSystemActive ? 'online' : 'offline'}</span>
          </div>
        </div>

        <div className="grid gap-6 max-w-3xl">
          {/* ── Live status ── */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Live Status</h2>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <StatCard
                icon={<RiPulseLine size={16} />}
                label="CPU"
                value={stats?.cpu ?? null}
                display={stats ? `${Math.round(stats.cpu)}%` : '—'}
              />
              <StatCard
                icon={<RiCpuLine size={16} />}
                label="RAM"
                value={stats?.ram ?? null}
                display={stats ? `${Math.round(stats.ram)}%` : '—'}
              />
              <StatCard
                icon={<RiBattery2ChargeLine size={16} />}
                label="Battery"
                value={stats?.battery ?? null}
                display={stats?.battery != null ? `${Math.round(stats.battery)}%` : 'N/A'}
              />
              <StatCard
                icon={<RiHardDrive2Line size={16} />}
                label="Disk"
                value={stats?.disk ?? null}
                display={stats ? `${Math.round(stats.disk)}%` : '—'}
              />
            </div>
            <div className="flex items-center gap-2 mt-3 text-xs text-zinc-500 font-mono">
              <RiTimeLine size={13} />
              <span>Uptime: {stats ? formatUptime(stats.uptimeSeconds) : '—'}</span>
            </div>
          </div>

          {/* ── Power ── */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Power</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <ActionButton
                icon={<RiRestartLine size={16} />}
                label="Restart PC"
                variant="danger"
                onRun={async () => {
                  setPendingConfirm('restart')
                  return { success: true }
                }}
              />
              <ActionButton
                icon={<RiShutDownLine size={16} />}
                label="Shut Down"
                variant="danger"
                onRun={async () => {
                  setPendingConfirm('shutdown')
                  return { success: true }
                }}
              />
              <ActionButton
                icon={<RiMoonLine size={16} />}
                label="Sleep"
                variant="danger"
                onRun={async () => {
                  setPendingConfirm('sleep')
                  return { success: true }
                }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3 mt-3">
              <ActionButton
                icon={<RiLockLine size={16} />}
                label="Lock Screen"
                onRun={() => safeInvoke('system-lock')}
              />
            </div>
          </div>

          {/* ── Assistant ── */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Assistant</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <ActionButton
                icon={<RiShieldCheckLine size={16} />}
                label="System Scan"
                onRun={() => safeInvoke('run-system-scan')}
              />
              <ActionButton
                icon={<RiRestartLine size={16} />}
                label="Restart Assistant"
                onRun={() => safeInvoke('restart-assistant')}
              />
              <ActionButton
                icon={<RiDeleteBinLine size={16} />}
                label="Clear Cache & Memory"
                onRun={() => safeInvoke('clear-assistant-cache')}
              />
              <ActionButton
                icon={<RiTaskLine size={16} />}
                label="Open Task Manager"
                onRun={() => safeInvoke('open-task-manager')}
              />
            </div>
          </div>

          {/* ── Quick toggles ── */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Quick Controls</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleRow
                icon={<RiHeadphoneLine size={16} />}
                label="Always Listening"
                description="JARVIS reacts to the wake word continuously"
                checked={toggles.alwaysListening}
                onToggle={() => handleToggle('alwaysListening', 'toggle-always-listening')}
              />
              <ToggleRow
                icon={toggles.muted ? <RiVolumeMuteLine size={16} /> : <RiVolumeUpLine size={16} />}
                label="System Volume"
                description={toggles.muted ? 'Currently muted' : 'Sound is on'}
                checked={!toggles.muted}
                onToggle={() => handleToggle('muted', 'toggle-mute')}
              />
              <ToggleRow
                icon={toggles.wifiEnabled ? <RiWifiLine size={16} /> : <RiWifiOffLine size={16} />}
                label="Wi-Fi"
                description={toggles.wifiEnabled ? 'Connected' : 'Disabled'}
                checked={toggles.wifiEnabled}
                onToggle={() => handleToggle('wifiEnabled', 'toggle-wifi')}
              />
              <div className="flex items-center">
                <ActionButton
                  icon={<RiCameraLine size={16} />}
                  label="Take Screenshot"
                  onRun={() => safeInvoke('take-screenshot')}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {pendingConfirm && (
        <ConfirmModal
          title={
            pendingConfirm === 'shutdown'
              ? 'Shut down this PC?'
              : pendingConfirm === 'restart'
              ? 'Restart this PC?'
              : 'Put this PC to sleep?'
          }
          description="Any unsaved work in other applications will be affected. JARVIS will resume once the system is back."
          confirmLabel={
            pendingConfirm === 'shutdown' ? 'Shut Down' : pendingConfirm === 'restart' ? 'Restart' : 'Sleep'
          }
          onConfirm={() => runPowerAction(pendingConfirm)}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </div>
  )
}

export default SystemControlView