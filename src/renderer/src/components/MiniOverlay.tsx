import { useState, useEffect, useRef } from 'react'
import {
  RiMicLine,
  RiMicOffLine,
  RiComputerLine,
  RiCameraLine,
  RiFullscreenLine,
  RiDragMove2Fill
} from 'react-icons/ri'
import { GiPowerButton } from 'react-icons/gi'
import { irisService } from '@renderer/services/Iris-voice-ai'
import { VisionMode } from '@renderer/IndexRoot'

interface OverlayProps {
  isSystemActive: boolean
  toggleSystem: () => void
  isMicMuted: boolean
  toggleMic: () => void
  isVideoOn: boolean
  visionMode: VisionMode
  startVision: (mode: 'camera' | 'screen') => void
  stopVision: () => void
}

// ── Tiny 3-bar voice-activity equalizer (replaces the single glow dot) ────────
const VoiceBars = ({ active, talking }: { active: boolean; talking: boolean }) => {
  const heights = talking ? [9, 16, 11] : active ? [4, 6, 4] : [3, 3, 3]
  const delays = [0, 90, 45]

  return (
    <div
      className={`w-9 h-9 rounded-lg flex items-center justify-center gap-[3px] border transition-all duration-300 ${
        active
          ? talking
            ? 'border-amber-400 bg-amber-500/15 shadow-[0_0_14px_#f59e0b80]'
            : 'border-amber-500/40 bg-amber-950/30'
          : 'border-zinc-700 bg-zinc-900'
      }`}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full transition-all duration-300 ${
            active ? (talking ? 'bg-amber-400' : 'bg-amber-700') : 'bg-red-900'
          }`}
          style={{ height: `${h}px`, transitionDelay: `${delays[i]}ms` }}
        />
      ))}
    </div>
  )
}

const HEX_CLIP = 'polygon(25% 6%, 75% 6%, 96% 50%, 75% 94%, 25% 94%, 4% 50%)'

const MiniOverlay = ({
  isSystemActive,
  toggleSystem,
  isMicMuted,
  toggleMic,
  isVideoOn,
  visionMode,
  startVision,
  stopVision
}: OverlayProps) => {
  const [isTalking, setIsTalking] = useState(false)
  const analyzerRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | any | null>(null)

  useEffect(() => {
    if (isSystemActive && irisService.analyser) {
      analyzerRef.current = irisService.analyser
      dataArrayRef.current = new Uint8Array(irisService.analyser.frequencyBinCount)
      const checkAudio = () => {
        if (analyzerRef.current && dataArrayRef.current) {
          analyzerRef.current.getByteFrequencyData(dataArrayRef.current)
          const avg = dataArrayRef.current.reduce((a, b) => a + b) / dataArrayRef.current.length
          setIsTalking(avg > 10)
        }
        if (isSystemActive) requestAnimationFrame(checkAudio)
      }
      checkAudio()
    } else {
      setIsTalking(false)
    }
  }, [isSystemActive])

  const handleVisionClick = (mode: 'camera' | 'screen') => {
    if (isVideoOn && visionMode === mode) {
      stopVision()
    } else {
      startVision(mode)
    }
  }

  const expand = () => {
    window.electron.ipcRenderer.send('toggle-overlay')
  }

  return (
    <div className="w-full h-full flex items-center justify-between px-3 bg-neutral-950/90 backdrop-blur-xl rounded-2xl border border-amber-500/25 drag-region overflow-hidden">
      <div className="flex items-center no-drag">
        <VoiceBars active={isSystemActive} talking={isTalking} />
      </div>

      <div className="flex items-center gap-1.5 no-drag">
        <button
          onClick={toggleMic}
          disabled={!isSystemActive}
          className={`p-2.5 rounded-lg transition-all ml-1 ${!isSystemActive ? 'opacity-30' : isMicMuted ? 'text-red-500 bg-red-500/10' : 'text-amber-300 bg-amber-500/10'}`}
        >
          {isMicMuted ? <RiMicOffLine size={18} /> : <RiMicLine size={18} />}
        </button>

        <button
          onClick={toggleSystem}
          className={`w-11 h-11 flex items-center justify-center transition-all duration-500 mx-1 ${isSystemActive ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-500 hover:text-red-400'}`}
          style={{
            clipPath: HEX_CLIP,
            border: isSystemActive ? '1px solid rgba(245,158,11,0.7)' : '1px solid rgba(82,82,91,0.7)'
          }}
        >
          <GiPowerButton size={19} className={isSystemActive ? 'animate-pulse' : ''} />
        </button>

        <button
          onClick={() => handleVisionClick('camera')}
          disabled={!isSystemActive}
          className={`p-2.5 rounded-lg transition-all ${!isSystemActive ? 'opacity-30' : isVideoOn && visionMode === 'camera' ? 'text-red-400 bg-red-500/10 animate-pulse border border-red-500/30' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
          title="Toggle Camera"
        >
          <RiCameraLine size={18} />
        </button>

        <button
          onClick={() => handleVisionClick('screen')}
          disabled={!isSystemActive}
          className={`p-2.5 rounded-lg transition-all ${!isSystemActive ? 'opacity-30' : isVideoOn && visionMode === 'screen' ? 'text-red-400 bg-red-500/10 animate-pulse border border-red-500/30' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
          title="Toggle Screen"
        >
          <RiComputerLine size={18} />
        </button>
      </div>

      <div className="pl-3 no-drag flex items-center gap-2.5">
        <div className="flex flex-col gap-1 mr-0.5">
          <span className="w-1 h-1 rounded-full bg-amber-500/30" />
          <span className="w-1 h-1 rounded-full bg-amber-500/30" />
          <span className="w-1 h-1 rounded-full bg-amber-500/30" />
        </div>
        <button
          onClick={expand}
          className="p-2 rounded-lg text-zinc-500 hover:text-amber-300 hover:bg-amber-500/10 transition-all"
        >
          <RiFullscreenLine size={16} />
        </button>
        <div className="drag-region cursor-move text-amber-500/30">
          <RiDragMove2Fill size={14} />
        </div>
      </div>
    </div>
  )
}

export default MiniOverlay