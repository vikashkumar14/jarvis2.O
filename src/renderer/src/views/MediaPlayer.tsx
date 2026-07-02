import { useEffect, useRef, useState, ReactElement } from 'react'
import {
  RiPlayFill,
  RiPauseFill,
  RiSkipForwardFill,
  RiSkipBackFill,
  RiVolumeUpLine,
  RiVolumeMuteLine,
  RiSpotifyFill,
  RiYoutubeFill,
  RiComputerLine,
  RiMusic2Line,
  RiShuffleLine,
  RiRepeatLine,
} from 'react-icons/ri'

type MediaSource = 'spotify' | 'youtube' | 'local' | 'unknown'

interface NowPlaying {
  title: string
  artist: string
  album?: string
  artwork?: string | null
  source: MediaSource
  isPlaying: boolean
  position: number // seconds
  duration: number // seconds
  volume: number // 0-100
  shuffle?: boolean
  repeat?: boolean
}

const SOURCE_META: Record<MediaSource, { label: string; icon: ReactElement; color: string }> = {
  spotify: { label: 'Spotify', icon: <RiSpotifyFill size={14} />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  youtube: { label: 'YouTube', icon: <RiYoutubeFill size={14} />, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  local: { label: 'This Device', icon: <RiComputerLine size={14} />, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  unknown: { label: 'Media', icon: <RiMusic2Line size={14} />, color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' },
}

function formatTime(sec: number) {
  if (!isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const MediaPlayerView = () => {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const positionTickRef = useRef<number | null>(null)

  // --- Backend connection: listens for system-wide media state pushed from main process ---
  useEffect(() => {
    // Replace with your actual MYRA websocket endpoint
    const ws = new WebSocket('ws://127.0.0.1:8765/media')
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'now_playing_update') {
          setNowPlaying(data.payload as NowPlaying)
        } else if (data.type === 'media_cleared') {
          setNowPlaying(null)
        }
      } catch (err) {
        console.error('Failed to parse media event', err)
      }
    }

    return () => ws.close()
  }, [])

  // --- Local smooth ticking of progress bar between backend updates ---
  useEffect(() => {
    if (positionTickRef.current) window.clearInterval(positionTickRef.current)
    if (nowPlaying?.isPlaying) {
      positionTickRef.current = window.setInterval(() => {
        setNowPlaying((prev) =>
          prev && prev.isPlaying && prev.position < prev.duration
            ? { ...prev, position: prev.position + 1 }
            : prev
        )
      }, 1000)
    }
    return () => {
      if (positionTickRef.current) window.clearInterval(positionTickRef.current)
    }
  }, [nowPlaying?.isPlaying])

  const sendCommand = (action: string, value?: number | boolean) => {
    wsRef.current?.send(JSON.stringify({ type: 'media_command', action, value }))
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value)
    setNowPlaying((prev) => (prev ? { ...prev, position: value } : prev))
    sendCommand('seek', value)
  }

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value)
    setNowPlaying((prev) => (prev ? { ...prev, volume: value } : prev))
    sendCommand('volume', value)
  }

  const meta = SOURCE_META[nowPlaying?.source ?? 'unknown']
  const progressPct = nowPlaying && nowPlaying.duration > 0
    ? Math.min(100, (nowPlaying.position / nowPlaying.duration) * 100)
    : 0

  return (
    <div className="flex-1 h-full bg-[#07080A] p-8 overflow-auto animate-in fade-in duration-300">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-300">
              <RiMusic2Line size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Media Player</h1>
              <p className="text-sm text-zinc-400">
                Detects and controls whatever is playing on your device — Spotify, YouTube, or local apps.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-500'}`} />
            <span className="text-zinc-500">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        {/* Main card */}
        <div className="max-w-2xl w-full mx-auto flex-1 flex flex-col justify-center">
          {!nowPlaying ? (
            <div className="rounded-3xl border border-white/10 bg-[#0D1015] p-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 text-zinc-500">
                <RiMusic2Line size={28} />
              </div>
              <p className="text-sm text-zinc-400">
                Nothing is playing right now. Start a song on Spotify, YouTube, or any app on your device — it'll show up here automatically.
              </p>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-[#0D1015] p-6">
              {/* Track info */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-white/5 overflow-hidden flex items-center justify-center flex-shrink-0 border border-white/10">
                  {nowPlaying.artwork ? (
                    <img src={nowPlaying.artwork} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <RiMusic2Line size={26} className="text-zinc-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium mb-2 ${meta.color}`}>
                    {meta.icon}
                    {meta.label}
                  </div>
                  <p className="text-white font-semibold truncate">{nowPlaying.title}</p>
                  <p className="text-sm text-zinc-400 truncate">
                    {nowPlaying.artist}{nowPlaying.album ? ` · ${nowPlaying.album}` : ''}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-6">
                <input
                  type="range"
                  min={0}
                  max={nowPlaying.duration || 0}
                  value={nowPlaying.position}
                  onChange={handleSeek}
                  className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-amber-400 cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, rgb(251 191 36) ${progressPct}%, rgba(255,255,255,0.1) ${progressPct}%)`,
                  }}
                />
                <div className="flex justify-between text-[11px] text-zinc-500 mt-1.5">
                  <span>{formatTime(nowPlaying.position)}</span>
                  <span>{formatTime(nowPlaying.duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={() => sendCommand('toggleShuffle', !nowPlaying.shuffle)}
                  className={`p-2 rounded-xl transition ${nowPlaying.shuffle ? 'text-amber-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <RiShuffleLine size={18} />
                </button>
                <button
                  onClick={() => sendCommand('previous')}
                  className="p-3 rounded-2xl bg-slate-900/90 text-white hover:bg-slate-800 transition"
                >
                  <RiSkipBackFill size={18} />
                </button>
                <button
                  onClick={() => sendCommand(nowPlaying.isPlaying ? 'pause' : 'play')}
                  className="p-4 rounded-2xl bg-amber-400 text-black hover:bg-amber-300 transition shadow-lg shadow-amber-500/20"
                >
                  {nowPlaying.isPlaying ? <RiPauseFill size={22} /> : <RiPlayFill size={22} />}
                </button>
                <button
                  onClick={() => sendCommand('next')}
                  className="p-3 rounded-2xl bg-slate-900/90 text-white hover:bg-slate-800 transition"
                >
                  <RiSkipForwardFill size={18} />
                </button>
                <button
                  onClick={() => sendCommand('toggleRepeat', !nowPlaying.repeat)}
                  className={`p-2 rounded-xl transition ${nowPlaying.repeat ? 'text-amber-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <RiRepeatLine size={18} />
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => sendCommand('volume', nowPlaying.volume > 0 ? 0 : 60)}
                  className="text-zinc-400 hover:text-white transition"
                >
                  {nowPlaying.volume > 0 ? <RiVolumeUpLine size={18} /> : <RiVolumeMuteLine size={18} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={nowPlaying.volume}
                  onChange={handleVolume}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 accent-amber-400 cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, rgb(255 255 255 / 0.6) ${nowPlaying.volume}%, rgba(255,255,255,0.1) ${nowPlaying.volume}%)`,
                  }}
                />
                <span className="text-xs text-zinc-500 w-8 text-right">{nowPlaying.volume}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MediaPlayerView