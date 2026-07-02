import { useState, useEffect, useRef } from 'react'
import Editor, { useMonaco } from '@monaco-editor/react'
import { getStoredApiKey } from '../utils/api-key-storage'
import { motion, AnimatePresence } from 'framer-motion'

// ── Typing cursor ─────────────────────────────────────────────────────────────
const Cursor = () => (
  <motion.span
    animate={{ opacity: [1, 0, 1] }}
    transition={{ duration: 0.75, repeat: Infinity }}
    className="inline-block w-2 h-4 bg-cyan-300 ml-0.5 align-middle"
    style={{ boxShadow: '0 0 6px rgba(103,232,249,0.8)' }}
  />
)

// ── Ambient hex-dot HUD backdrop ──────────────────────────────────────────────
const HudGrid = () => (
  <div
    className="absolute inset-0 pointer-events-none opacity-[0.06]"
    style={{
      backgroundImage: 'radial-gradient(rgba(56,189,248,1) 1px, transparent 1.4px)',
      backgroundSize: '26px 26px'
    }}
  />
)

// ── Rotating arc-reactor system indicator (replaces traffic lights) ──────────
const ArcReactor = ({ active }: { active: boolean }) => (
  <div className="relative w-6 h-6 flex items-center justify-center flex-shrink-0">
    <motion.div
      animate={active ? { rotate: 360 } : { rotate: 0 }}
      transition={{ duration: 3, repeat: active ? Infinity : 0, ease: 'linear' }}
      className="absolute inset-0 rounded-full"
      style={{
        border: '1.5px solid rgba(56,189,248,0.15)',
        borderTopColor: 'rgba(56,189,248,0.9)',
        borderRightColor: active ? 'rgba(56,189,248,0.9)' : 'rgba(56,189,248,0.15)',
      }}
    />
    <motion.div
      animate={active ? { scale: [1, 1.3, 1], opacity: [0.9, 0.4, 0.9] } : { scale: 1, opacity: 0.6 }}
      transition={{ duration: 1.4, repeat: Infinity }}
      className="w-1.5 h-1.5 rounded-full"
      style={{ background: '#67e8f9', boxShadow: '0 0 8px 2px rgba(103,232,249,0.9)' }}
    />
  </div>
)

// ── Reticle tick mark (replaces L-shaped corner brackets) ────────────────────
const ReticleTick = ({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) => {
  const isTop = pos.startsWith('t')
  const isLeft = pos.endsWith('l')
  return (
    <div
      className="absolute w-3.5 h-3.5 pointer-events-none"
      style={{
        top: isTop ? 10 : 'auto', bottom: isTop ? 'auto' : 10,
        left: isLeft ? 10 : 'auto', right: isLeft ? 'auto' : 10,
      }}
    >
      <div style={{ position: 'absolute', top: isTop ? 0 : 'auto', bottom: isTop ? 'auto' : 0, left: isLeft ? 0 : 'auto', right: isLeft ? 'auto' : 0, width: 14, height: 2, background: 'rgba(56,189,248,0.55)' }} />
      <div style={{ position: 'absolute', top: isTop ? 0 : 'auto', bottom: isTop ? 'auto' : 0, left: isLeft ? 0 : 'auto', right: isLeft ? 'auto' : 0, width: 2, height: 14, background: 'rgba(56,189,248,0.55)' }} />
    </div>
  )
}

// ── File language detector ────────────────────────────────────────────────────
const detectLang = (name: string) => {
  if (name.endsWith('.py')) return 'python'
  if (name.endsWith('.js') || name.endsWith('.jsx')) return 'javascript'
  if (name.endsWith('.tsx') || name.endsWith('.ts')) return 'typescript'
  if (name.endsWith('.css')) return 'css'
  if (name.endsWith('.json')) return 'json'
  if (name.endsWith('.html')) return 'html'
  if (name.endsWith('.sh')) return 'shell'
  return 'typescript'
}

const PANEL_CLIP = 'polygon(22px 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%, 0 22px)'

// ── Main widget ───────────────────────────────────────────────────────────────
export default function LiveCodingWidget() {
  const monaco = useMonaco()
  const [isVisible, setIsVisible] = useState(false)
  const [filename, setFilename] = useState('')
  const [filePath, setFilePath] = useState('')
  const [code, setCode] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [lineCount, setLineCount] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('jarvis-hud', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '38bdf8', fontStyle: 'italic' },
          { token: 'keyword', foreground: '22d3ee' },
          { token: 'string', foreground: 'bae6fd' },
          { token: 'number', foreground: '7dd3fc' },
          { token: 'type', foreground: '67e8f9' },
          { token: 'function', foreground: '5eead4' },
        ],
        colors: {
          'editor.background': '#00000000',
          'editor.foreground': '#dff6ff',
          'editor.lineHighlightBackground': '#04182920',
          'editorLineNumber.foreground': '#0e3a5240',
          'editorLineNumber.activeForeground': '#38bdf880',
          'editor.selectionBackground': '#0369a140',
          'editorCursor.foreground': '#22d3ee',
        }
      })
      monaco.editor.setTheme('jarvis-hud')
    }
  }, [monaco])

  useEffect(() => {
    const handleStartCoding = async (e: any) => {
      const { prompt, file_name } = e.detail
      setFilename(file_name)
      setIsVisible(true)
      setIsGenerating(true)
      setCode('')
      setLineCount(0)
      setCharCount(0)
      setElapsed(0)
      setFilePath('')

      // Start elapsed timer
      const start = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000))
      }, 1000)

      const geminiKey = getStoredApiKey('gemini')

      if (!geminiKey.trim()) {
        setCode('// ⚠ NO UPLINK KEY — configure one in Settings.')
        setIsGenerating(false)
        if (timerRef.current) clearInterval(timerRef.current)
        return
      }

      setCode('// ⚡ J.A.R.V.I.S. 2.0 — establishing uplink...\n')

      const result = await window.electron.ipcRenderer.invoke('start-live-coding', {
        prompt, filename: file_name, geminiKey
      })

      if (result.success) setFilePath(result.filePath)
      setIsGenerating(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }

    const handleOpenVSCode = () => {
      if (filePath) window.electron.ipcRenderer.invoke('open-in-vscode', filePath)
    }

    const handleCodeChunk = (_e: any, chunkText: string) => {
      setCode((prev) => {
        const next = prev + chunkText
        setLineCount(next.split('\n').length)
        setCharCount(next.length)
        return next
      })
    }

    window.addEventListener('ai-start-coding', handleStartCoding)
    window.addEventListener('ai-open-vscode', handleOpenVSCode)
    window.electron.ipcRenderer.on('live-code-chunk', handleCodeChunk)

    return () => {
      window.removeEventListener('ai-start-coding', handleStartCoding)
      window.removeEventListener('ai-open-vscode', handleOpenVSCode)
      window.electron.ipcRenderer.removeAllListeners('live-code-chunk')
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [filePath])

  if (!isVisible) return null

  const lang = detectLang(filename)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-[999] flex items-center justify-center"
        style={{ background: 'rgba(2,6,14,0.88)', backdropFilter: 'blur(6px)' }}
      >
        <motion.div
          initial={{ scale: 0.92, y: 24 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.94, y: 16 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="relative flex flex-col"
          style={{
            width: '78vw',
            height: '72vh',
            background: 'linear-gradient(165deg, #030711 0%, #04101d 55%, #030814 100%)',
            border: '1px solid rgba(56,189,248,0.22)',
            clipPath: PANEL_CLIP,
            boxShadow: '0 0 0 1px rgba(56,189,248,0.06), 0 0 90px rgba(0,0,0,0.9), 0 0 44px rgba(34,211,238,0.06)'
          }}
        >
          <HudGrid />
          <ReticleTick pos="tr" /><ReticleTick pos="bl" />

          {/* ── Ambient glow when generating ── */}
          <AnimatePresence>
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute -inset-px pointer-events-none"
                style={{
                  clipPath: PANEL_CLIP,
                  background: 'linear-gradient(135deg, rgba(34,211,238,0.09), transparent, rgba(56,189,248,0.07))',
                  filter: 'blur(1px)'
                }}
              />
            )}
          </AnimatePresence>

          {/* ── Top bar ── */}
          <div
            className="relative z-10 flex items-center justify-between px-5 h-12 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(56,189,248,0.12)' }}
          >
            {/* Left: identity */}
            <div className="flex items-center gap-4">
              <ArcReactor active={isGenerating} />
              <div style={{ width: 1, height: 16, background: 'rgba(56,189,248,0.18)' }} />
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-sky-300/60 font-mono tracking-[0.35em] uppercase">J.A.R.V.I.S. 2.0</span>
                <span className="text-[9px] text-sky-300/30 font-mono">//</span>
                <span className="text-[11px] text-cyan-200/90 font-mono">{filename || 'untitled'}</span>
                {isGenerating && <Cursor />}
              </div>
              <div
                className="ml-1 px-2.5 py-0.5 text-[9px] font-mono tracking-wide"
                style={{
                  clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
                  background: 'rgba(56,189,248,0.09)',
                  border: '1px solid rgba(56,189,248,0.18)',
                  color: 'rgba(103,232,249,0.85)'
                }}
              >
                {lang.toUpperCase()}
              </div>
            </div>

            {/* Right: stats + actions */}
            <div className="flex items-center gap-4">
              {/* Live stats */}
              <div className="flex items-center gap-3 text-[10px] font-mono" style={{ color: 'rgba(103,232,249,0.5)' }}>
                <span>{lineCount} LN</span>
                <span>/</span>
                <span>{charCount} CH</span>
                <span>/</span>
                <span>{elapsed}s</span>
              </div>
              <div style={{ width: 1, height: 14, background: 'rgba(56,189,248,0.12)' }} />

              {/* Status badge */}
              {isGenerating ? (
                <div className="flex items-center gap-1.5">
                  <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#22d3ee', boxShadow: '0 0 6px #22d3ee' }}
                  />
                  <span className="text-[10px] font-mono text-cyan-300/80 tracking-widest">UPLINK ACTIVE</span>
                </div>
              ) : filePath ? (
                <div className="flex items-center gap-1.5 text-cyan-300/70">
                  <span className="text-[10px] font-mono tracking-widest">SYNC COMPLETE</span>
                  <span className="text-cyan-300">✓</span>
                </div>
              ) : null}

              {/* VS Code button */}
              {!isGenerating && filePath && (
                <button
                  onClick={() => window.electron.ipcRenderer.invoke('open-in-vscode', filePath)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono tracking-wider transition-all cursor-pointer"
                  style={{
                    clipPath: 'polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px)',
                    background: 'rgba(56,189,248,0.09)',
                    border: '1px solid rgba(56,189,248,0.3)',
                    color: 'rgba(103,232,249,0.9)'
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(56,189,248,0.18)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(56,189,248,0.09)'
                  }}
                >
                  ↗ OPEN IN VS CODE
                </button>
              )}

              {/* Close */}
              <button
                onClick={() => {
                  setIsVisible(false)
                  if (timerRef.current) clearInterval(timerRef.current)
                }}
                className="w-7 h-7 flex items-center justify-center transition-all cursor-pointer text-xs"
                style={{
                  clipPath: 'polygon(5px 0, 100% 0, 100% 100%, 0 100%, 0 5px)',
                  color: 'rgba(103,232,249,0.5)',
                  border: '1px solid rgba(56,189,248,0.15)'
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.12)'
                  ;(e.currentTarget as HTMLElement).style.color = '#f87171'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(248,113,113,0.3)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = 'rgba(103,232,249,0.5)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,189,248,0.15)'
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── Editor area ── */}
          <div className="relative flex-1 overflow-hidden">
            {/* Left power rail */}
            <div
              className="absolute left-0 top-0 bottom-0 w-px pointer-events-none z-10"
              style={{ background: 'linear-gradient(to bottom, transparent, rgba(56,189,248,0.35) 30%, rgba(56,189,248,0.35) 70%, transparent)' }}
            />

            {/* Dual scan sweep while generating */}
            <AnimatePresence>
              {isGenerating && (
                <motion.div
                  initial={{ top: '0%' }}
                  animate={{ top: ['0%', '100%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                  exit={{ opacity: 0 }}
                  className="absolute left-0 right-0 pointer-events-none z-20"
                  style={{ height: 3 }}
                >
                  <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(103,232,249,0.5), transparent)' }} />
                  <div style={{ height: 1, marginTop: 1, background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.25), transparent)', boxShadow: '0 0 10px rgba(34,211,238,0.35)' }} />
                </motion.div>
              )}
            </AnimatePresence>

            <Editor
              height="100%"
              language={lang}
              theme="jarvis-hud"
              value={code}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontLigatures: true,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 16, bottom: 16 },
                overviewRulerBorder: false,
                hideCursorInOverviewRuler: true,
                renderLineHighlight: 'none',
                contextmenu: false,
                scrollbar: {
                  verticalScrollbarSize: 4,
                  horizontalScrollbarSize: 4,
                },
              }}
            />
          </div>

          {/* ── Bottom status bar ── */}
          <div
            className="relative z-10 flex items-center justify-between px-5 h-7 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(56,189,248,0.1)' }}
          >
            <div className="flex items-center gap-3 text-[9px] font-mono" style={{ color: 'rgba(103,232,249,0.35)' }}>
              <span>JARVIS 2.0 // FORGE</span>
              <span>/</span>
              <span>UTF-8</span>
              <span>/</span>
              <span>LF</span>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-mono" style={{ color: 'rgba(103,232,249,0.35)' }}>
              {isGenerating && (
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  ▶ compiling {filename}
                </motion.span>
              )}
              {!isGenerating && filePath && <span>✓ saved — {filePath.split('/').pop()}</span>}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}