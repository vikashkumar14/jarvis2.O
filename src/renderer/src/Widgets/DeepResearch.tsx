import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

// ── Animated neural node canvas ───────────────────────────────────────────────
const NeuralCanvas = ({ active }: { active: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const nodesRef = useRef<{ x: number; y: number; vx: number; vy: number; r: number }[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width
    const H = canvas.height

    // Spawn nodes
    nodesRef.current = Array.from({ length: 28 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: 1.5 + Math.random() * 2
    }))

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      const nodes = nodesRef.current
      // Move nodes
      nodes.forEach((n) => {
        n.x += n.vx * (active ? 1.8 : 0.5)
        n.y += n.vy * (active ? 1.8 : 0.5)
        if (n.x < 0 || n.x > W) n.vx *= -1
        if (n.y < 0 || n.y > H) n.vy *= -1
      })
      // Draw edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 90) {
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.strokeStyle = active
              ? `rgba(99,102,241,${0.35 * (1 - dist / 90)})`
              : `rgba(99,102,241,${0.12 * (1 - dist / 90)})`
            ctx.lineWidth = 0.8
            ctx.stroke()
          }
        }
      }
      // Draw nodes
      nodes.forEach((n) => {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = active ? 'rgba(139,92,246,0.9)' : 'rgba(99,102,246,0.35)'
        ctx.fill()
      })
      animRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      width={560}
      height={300}
      className="absolute inset-0 w-full h-full opacity-60 pointer-events-none"
    />
  )
}

// ── Scanning line ─────────────────────────────────────────────────────────────
const ScanLine = ({ active }: { active: boolean }) => (
  <motion.div
    className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent pointer-events-none"
    animate={active ? { top: ['0%', '100%', '0%'] } : { top: '0%' }}
    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
    style={{ opacity: active ? 0.6 : 0 }}
  />
)

// ── Stage pill ────────────────────────────────────────────────────────────────
const stages = ['Crawl', 'Extract', 'Synthesize', 'Done']

const StagePills = ({ progress }: { progress: number }) => {
  const active = progress < 35 ? 0 : progress < 70 ? 1 : progress < 100 ? 2 : 3
  return (
    <div className="flex items-center gap-2">
      {stages.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <motion.div
            animate={{
              backgroundColor: i <= active ? 'rgb(139,92,246)' : 'rgba(255,255,255,0.05)',
              boxShadow: i === active ? '0 0 10px rgba(139,92,246,0.8)' : 'none'
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 text-[10px] font-mono tracking-widest"
            style={{ color: i <= active ? '#e9d5ff' : '#4b5563' }}
          >
            {i < active && <span className="text-emerald-400">✓</span>}
            {i === active && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block"
              />
            )}
            {s.toUpperCase()}
          </motion.div>
          {i < stages.length - 1 && (
            <div className={`w-4 h-px ${i < active ? 'bg-violet-500' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────
export default function ResearchWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [statusText, setStatusText] = useState('')
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null)
  const [summary, setSummary] = useState('')
  const [progress, setProgress] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  const { contextSafe } = useGSAP({ scope: containerRef })

  const animateText = contextSafe((next: string) => {
    if (!textRef.current) return
    gsap.to(textRef.current, {
      opacity: 0, y: -8, duration: 0.18,
      onComplete: () => {
        setStatusText(next)
        gsap.to(textRef.current, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' })
      }
    })
  })

  const animateBar = contextSafe((pct: number) => {
    if (!barRef.current) return
    gsap.to(barRef.current, { width: `${pct}%`, duration: 1.4, ease: 'expo.out' })
    setProgress(pct)
  })

  const handleStart = contextSafe((e: any) => {
    setQuery(e.detail.query)
    setIsSuccess(null)
    setSummary('')
    setProgress(0)
    setIsOpen(true)
    setStatusText('Booting neural crawl agent...')
    animateBar(5)
  })

  const handleProgress = contextSafe((_: any, data: { file: string; totalFound: number }) => {
    animateText(data.file)
    const pct = data.totalFound === 1 ? 35 : data.totalFound === 2 ? 70 : 90
    animateBar(pct)
  })

  const handleDone = contextSafe((e: any) => {
    const success = e.detail.success
    setIsSuccess(success)
    if (success && e.detail.summary) setSummary(e.detail.summary)
    animateText(success ? 'Synthesis complete — knowledge locked.' : 'Pipeline error encountered.')
    animateBar(100)
    setTimeout(() => setIsOpen(false), 7000)
  })

  useEffect(() => {
    window.addEventListener('deep-research-start', handleStart)
    window.addEventListener('deep-research-done', handleDone)
    window.electron.ipcRenderer.on('oracle-progress', handleProgress)
    return () => {
      window.removeEventListener('deep-research-start', handleStart)
      window.removeEventListener('deep-research-done', handleDone)
      window.electron.ipcRenderer.removeAllListeners('oracle-progress')
    }
  }, [handleStart, handleProgress, handleDone])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, y: 32, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
          style={{ width: 580 }}
        >
          {/* Outer glow ring */}
          <motion.div
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="absolute -inset-px rounded-2xl pointer-events-none"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(99,102,241,0.15), rgba(139,92,246,0.4))', filter: 'blur(2px)' }}
          />

          <div
            className="relative rounded-2xl overflow-hidden text-white"
            style={{
              background: 'linear-gradient(160deg, rgba(10,8,20,0.97) 0%, rgba(15,10,30,0.97) 100%)',
              border: '1px solid rgba(139,92,246,0.25)',
              boxShadow: '0 0 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)'
            }}
          >
            {/* Neural canvas background */}
            <NeuralCanvas active={isSuccess === null} />
            <ScanLine active={isSuccess === null} />

            <div className="relative z-10 p-7">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  {/* Pulsing hex icon */}
                  <div className="relative w-9 h-9 flex items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-0"
                      style={{
                        background: 'conic-gradient(from 0deg, rgba(139,92,246,0.8), rgba(99,102,241,0.2), rgba(139,92,246,0.8))',
                        borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%'
                      }}
                    />
                    <span className="relative text-sm">🕸️</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-violet-400/70 tracking-[0.35em] uppercase font-mono">Deep Search</p>
                    <p className="text-xs text-violet-200 font-semibold tracking-wide">Neural RAG Agent</p>
                  </div>
                </div>

                {isSuccess === true && (
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono text-emerald-300"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}
                  >
                    <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>◉</motion.span>
                    COMPLETE
                  </motion.div>
                )}
                {isSuccess === false && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono text-red-400"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    ✕ FAILED
                  </div>
                )}
              </div>

              {/* Query block */}
              <div className="mb-5 p-4 rounded-xl" style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <p className="text-[9px] text-violet-400/60 tracking-[0.3em] uppercase mb-1.5 font-mono">Query</p>
                <p className="text-sm text-gray-100 leading-relaxed font-light">
                  {query}
                </p>
              </div>

              {/* Stage pills */}
              <div className="mb-5">
                <StagePills progress={progress} />
              </div>

              {/* Status line */}
              <div className="flex items-center gap-3 mb-4 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <motion.div
                  animate={isSuccess === null ? { opacity: [1, 0.2, 1] } : { opacity: 1 }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: isSuccess === null ? '#8b5cf6' : isSuccess ? '#10b981' : '#ef4444' }}
                />
                <div ref={textRef} className="text-xs text-gray-400 font-mono tracking-wide flex-1 truncate">
                  {statusText}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div
                  ref={barRef}
                  className="h-full rounded-full w-0"
                  style={{
                    background: isSuccess === false
                      ? '#ef4444'
                      : 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
                    boxShadow: '0 0 12px rgba(139,92,246,0.7)'
                  }}
                />
              </div>
              <div className="text-right text-[9px] text-violet-400/50 font-mono mb-4">{Math.round(progress)}%</div>

              {/* Summary */}
              <AnimatePresence>
                {summary && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-xl overflow-hidden"
                    style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}
                  >
                    <div className="p-4">
                      <p className="text-[9px] text-emerald-400/70 tracking-[0.3em] uppercase mb-2 font-mono">Extracted Intelligence</p>
                      <p className="text-xs text-gray-300 font-mono leading-relaxed line-clamp-4">
                        {summary}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}