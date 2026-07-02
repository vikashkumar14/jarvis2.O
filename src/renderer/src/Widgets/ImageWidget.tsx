import { useState, useEffect, useRef } from 'react'

// ── Radar-style loading sweep (replaces the spinner ring) ─────────────────────
const RadarSweep = () => (
  <div className="relative w-20 h-20">
    <div
      className="absolute inset-0 rounded-full animate-spin"
      style={{
        background: 'conic-gradient(from 0deg, transparent 0%, rgba(217,70,239,0.6) 100%)',
        animationDuration: '1.6s'
      }}
    />
    <div className="absolute inset-[3px] rounded-full bg-black" />
    <div className="absolute inset-0 rounded-full border border-fuchsia-500/25" />
    <div className="absolute inset-3 rounded-full border border-fuchsia-500/15" />
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" style={{ boxShadow: '0 0 10px #e879f9' }} />
    </div>
  </div>
)

// ── Viewfinder corner tick (camera-style bracket) ──────────────────────────────
const ViewfinderTick = ({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) => {
  const isTop = pos.startsWith('t')
  const isLeft = pos.endsWith('l')
  return (
    <div
      className="absolute w-6 h-6 pointer-events-none z-20"
      style={{
        top: isTop ? 12 : 'auto', bottom: isTop ? 'auto' : 12,
        left: isLeft ? 12 : 'auto', right: isLeft ? 'auto' : 12,
        borderTop: isTop ? '2px solid rgba(217,70,239,0.7)' : 'none',
        borderBottom: isTop ? 'none' : '2px solid rgba(217,70,239,0.7)',
        borderLeft: isLeft ? '2px solid rgba(217,70,239,0.7)' : 'none',
        borderRight: isLeft ? 'none' : '2px solid rgba(217,70,239,0.7)',
      }}
    />
  )
}

export default function ImageWidget() {
  const [isVisible, setIsVisible] = useState(false)
  const [imageSrc, setImageSrc] = useState('')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [debugMsg, setDebugMsg] = useState('')

  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const handleEvent = (event: any) => {
      const { url, prompt, loading, error, errorMessage } = event.detail

      setPrompt(prompt)

      if (loading) {
        setIsVisible(true)
        setLoading(true)
        setHasError(false)
        setImageSrc('')
        setStatusText('JARVIS IS CRAFTING YOUR IMAGE...')
        return
      }

      if (error) {
        setHasError(true)
        setLoading(false)
        setDebugMsg(errorMessage || 'API Error')
        return
      }

      if (url) {
        downloadAndAutoSave(url, prompt)
      }
    }

    window.addEventListener('image-gen', handleEvent)
    return () => window.removeEventListener('image-gen', handleEvent)
  }, [])

  const downloadAndAutoSave = async (url: string, currentPrompt: string) => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      setStatusText('DOWNLOADING & SAVING...')

      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`Download Error: ${response.status}`)

      const blob = await response.blob()

      const objectUrl = URL.createObjectURL(blob)
      setImageSrc(objectUrl)
      setLoading(false)
      setHasError(false)

      const reader = new FileReader()
      reader.readAsDataURL(blob)
      reader.onloadend = async () => {
        const base64data = reader.result

        await window.electron.ipcRenderer.invoke('save-image-to-gallery', {
          title: currentPrompt,
          base64Data: base64data
        })

        setStatusText('SAVED TO GALLERY ✔️')
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setHasError(true)
      setDebugMsg('Failed to download/save image.')
      setLoading(false)
    }
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-9050 flex items-center justify-center bg-black/90 backdrop-blur-md p-10 animate-in fade-in zoom-in duration-300">
      <div
        className="relative max-w-5xl max-h-[85vh] border border-fuchsia-500/30 overflow-hidden bg-black"
        style={{ boxShadow: '0 0 0 1px rgba(217,70,239,0.08), 0 0 120px rgba(168,85,247,0.14)' }}
      >
        <ViewfinderTick pos="tl" />
        <ViewfinderTick pos="tr" />
        <ViewfinderTick pos="bl" />
        <ViewfinderTick pos="br" />

        {/* ── Top strip ── */}
        <div className="absolute top-0 left-0 w-full z-10 flex items-center justify-between px-5 py-3 bg-gradient-to-b from-black/90 to-transparent pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <span
              className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-fuchsia-400 animate-pulse' : 'bg-fuchsia-600'}`}
              style={{ boxShadow: '0 0 6px #e879f9' }}
            />
            <h2 className="text-fuchsia-300/90 font-bold tracking-[0.2em] text-[10px] uppercase font-mono">
              JARVIS // Image Synthesis
            </h2>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/70 border border-fuchsia-500/30 text-fuchsia-300/70 hover:text-white hover:bg-rose-500/70 hover:border-rose-400 pointer-events-auto transition-all text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Prompt caption strip */}
        {prompt && (
          <div className="absolute top-11 left-5 z-10 max-w-md pointer-events-none">
            <p className="text-[10px] font-mono text-fuchsia-400/50 truncate">“{prompt}”</p>
          </div>
        )}

        <div className="relative w-full h-full flex items-center justify-center min-w-200 min-h-125">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-5">
              <RadarSweep />
              <p className="text-fuchsia-300/80 font-mono text-[11px] tracking-[0.25em] animate-pulse">
                {statusText}
              </p>
            </div>
          )}

          {hasError && (
            <div className="flex items-center gap-4 text-left px-10 max-w-xl border border-dashed border-rose-500/40 rounded-lg py-6 bg-rose-950/10">
              <div className="text-4xl flex-shrink-0">⚠️</div>
              <div>
                <h3 className="text-base font-bold font-mono text-rose-400 tracking-widest">GENERATION PAUSED</h3>
                <p className="text-xs opacity-90 mt-1.5 font-mono text-rose-300/80">{debugMsg}</p>
              </div>
            </div>
          )}

          {!loading && !hasError && imageSrc && (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={imageSrc}
                alt="Generated"
                className="w-full h-auto max-h-full object-contain animate-in fade-in duration-1000"
              />
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/80 text-fuchsia-300 border border-fuchsia-500/40 pl-2 pr-3 py-1 rounded-full text-[10px] font-bold font-mono tracking-wide animate-in slide-in-from-top-2 fade-in duration-700 delay-500">
                <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" style={{ boxShadow: '0 0 6px #e879f9' }} />
                SAVED TO GALLERY
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}