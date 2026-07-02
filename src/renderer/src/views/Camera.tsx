import { RiCameraLine, RiStopCircleLine } from 'react-icons/ri'
import { VisionMode } from '@renderer/IndexRoot'

interface CameraViewProps {
  isSystemActive: boolean
  isVideoOn: boolean
  visionMode: VisionMode
  startVision: (mode: 'camera' | 'screen') => void
  stopVision: () => void
}

const CameraView = ({ isSystemActive, isVideoOn, visionMode, startVision, stopVision }: CameraViewProps) => {
  return (
    <div className="flex-1 h-full bg-[#090A0D] p-8 overflow-auto animate-in fade-in duration-300">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 h-full">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-300">
            <RiCameraLine size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Camera Control</h1>
            <p className="text-sm text-zinc-400">Launch JARVIS vision or stop the camera feed from one place.</p>
          </div>
        </div>

        <div className="grid gap-5 max-w-lg">
          <div className="rounded-3xl border border-white/10 bg-[#0D1015] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Current status</p>
            <div className="flex items-center justify-between gap-4">
              <span className="text-lg font-semibold text-white">{isVideoOn ? `${visionMode} mode active` : 'Camera offline'}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isVideoOn ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-700/70 text-zinc-400'}`}>
                {isVideoOn ? 'ACTIVE' : 'IDLE'}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => startVision('camera')}
              disabled={!isSystemActive}
              className="rounded-2xl bg-slate-900/90 px-5 py-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Start Camera
            </button>
            <button
              type="button"
              onClick={() => startVision('screen')}
              disabled={!isSystemActive}
              className="rounded-2xl bg-slate-900/90 px-5 py-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Start Screen Share
            </button>
            <button
              type="button"
              onClick={stopVision}
              className="rounded-2xl bg-rose-500/10 border border-rose-500/20 px-5 py-4 text-sm font-semibold text-rose-300 hover:bg-rose-500/15"
            >
              <span className="inline-flex items-center gap-2">
                <RiStopCircleLine size={16} /> Stop Vision
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CameraView
