import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RiSearchLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiRefreshLine,
  RiHome5Line,
  RiLockLine,
  RiGlobalLine,
  RiCompassDiscoverLine
} from 'react-icons/ri'

const HOME_URL = 'https://www.google.com'
const QUICK_SUGGESTIONS = ['Latest AI news', 'Weather today', 'OpenAI', 'JavaScript event loop', 'Best sci-fi movies 2026']

const isLikelyUrl = (value: string) => {
  const v = value.trim()
  if (/\s/.test(v)) return false
  return /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(:\d+)?(\/.*)?$/i.test(v)
}

const toSearchUrl = (value: string) => {
  const v = value.trim()
  if (isLikelyUrl(v)) return v.startsWith('http') ? v : `https://${v}`
  return `https://www.google.com/search?q=${encodeURIComponent(v)}`
}

const WebSearchView = () => {
  const [query, setQuery] = useState('')
  const [currentUrl, setCurrentUrl] = useState('')
  const [pageTitle, setPageTitle] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [isWebviewAvailable, setIsWebviewAvailable] = useState(false)

  const webviewRef = useRef<any>(null)

  const navigate = useCallback((target: string) => {
    const url = toSearchUrl(target)
    setHasStarted(true)
    setCurrentUrl(url)
    const wv = webviewRef.current
    if (wv) {
      if (typeof wv.loadURL === 'function') {
        wv.loadURL(url)
      } else if (wv.getWebContentsId && wv.src) {
        wv.src = url
      } else {
        wv.setAttribute('src', url)
      }
    }
  }, [])

  useEffect(() => {
    setIsWebviewAvailable(typeof window !== 'undefined' && 'electron' in window)
    const wv = webviewRef.current
    if (!wv) return

    const onStart = () => setIsLoading(true)
    const onStop = () => {
      setIsLoading(false)
      setCanGoBack(wv.canGoBack?.() ?? false)
      setCanGoForward(wv.canGoForward?.() ?? false)
    }
    const onNavigate = (e: any) => {
      setCurrentUrl(e.url)
      setQuery(e.url)
      setCanGoBack(wv.canGoBack?.() ?? false)
      setCanGoForward(wv.canGoForward?.() ?? false)
    }
    const onTitle = (e: any) => setPageTitle(e.title)
    // Keep every clicked link, including target="_blank", inside this same panel
    // instead of letting Electron spawn a separate OS browser window.
    const onNewWindow = (e: any) => {
      e.preventDefault?.()
      if (e.url) navigate(e.url)
    }

    wv.addEventListener('did-start-loading', onStart)
    wv.addEventListener('did-stop-loading', onStop)
    wv.addEventListener('did-navigate', onNavigate)
    wv.addEventListener('did-navigate-in-page', onNavigate)
    wv.addEventListener('page-title-updated', onTitle)
    wv.addEventListener('new-window', onNewWindow)

    return () => {
      wv.removeEventListener('did-start-loading', onStart)
      wv.removeEventListener('did-stop-loading', onStop)
      wv.removeEventListener('did-navigate', onNavigate)
      wv.removeEventListener('did-navigate-in-page', onNavigate)
      wv.removeEventListener('page-title-updated', onTitle)
      wv.removeEventListener('new-window', onNewWindow)
    }
  }, [hasStarted, navigate])

  const handleSubmit = () => {
    if (!query.trim()) return
    navigate(query)
  }

  const goBack = () => webviewRef.current?.goBack?.()
  const goForward = () => webviewRef.current?.goForward?.()
  const reload = () => webviewRef.current?.reload?.()
  const goHome = () => navigate(HOME_URL)

  const isSecure = currentUrl.startsWith('https://')

  return (
    <div className="ws-root flex-1 h-full flex flex-col p-6 overflow-hidden">
      <style>{`
        .ws-root {
          --bg-base: #070A10;
          --bg-sunken: #04060A;
          --panel: #0F141C;
          --panel-raised: #141A24;
          --line: #202834;
          --line-soft: #182029;
          --ink: #F1F4F8;
          --ink-dim: #9AA5B4;
          --ink-faint: #5B6674;
          --cyan: #38BDF8;
          --cyan-bright: #7DD3FC;
          --cyan-soft: #38BDF822;
          --green: #22D67A;
          --amber: #FFB454;
          --danger: #F87171;
          font-family: 'Manrope', -apple-system, sans-serif;
          background: var(--bg-base);
          color: var(--ink);
        }
        .ws-root .font-data { font-family: 'JetBrains Mono', ui-monospace, monospace; }

        .ws-panel { background: var(--panel); border: 1px solid var(--line); border-radius: 20px; box-shadow: 0 1px 0 0 rgba(255,255,255,0.03) inset, 0 20px 40px -20px rgba(0,0,0,0.6); }

        .ws-btn-3d {
          border-radius: 10px; border: 1px solid var(--line);
          background: linear-gradient(180deg, #1B222D 0%, #131922 100%);
          box-shadow: 0 1px 0 0 rgba(255,255,255,0.05) inset, 0 2px 0 0 #060A0F;
          transition: border-color 0.15s ease, opacity 0.15s ease;
        }
        .ws-btn-3d:hover:not(:disabled) { border-color: #33404F; }
        .ws-btn-3d:active:not(:disabled) { transform: translateY(1px); }
        .ws-btn-3d:disabled { opacity: 0.35; cursor: not-allowed; }

        .ws-address-shell {
          background: var(--bg-sunken); border: 1px solid var(--line-soft); border-radius: 12px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .ws-address-shell:focus-within { border-color: var(--cyan); box-shadow: 0 0 0 3px var(--cyan-soft); }

        .ws-btn-primary {
          border-radius: 10px; background: linear-gradient(180deg, #7DD3FC 0%, var(--cyan) 100%); color: #04121C;
          box-shadow: 0 1px 0 0 rgba(255,255,255,0.3) inset, 0 3px 0 0 #0284C7, 0 8px 18px -6px rgba(56,189,248,0.5);
          transition: transform 0.12s ease;
        }
        .ws-btn-primary:active { transform: translateY(2px); box-shadow: 0 1px 0 0 rgba(255,255,255,0.2) inset, 0 1px 0 0 #0284C7; }

        .ws-chip {
          border-radius: 999px; border: 1px solid var(--line); background: var(--panel-raised); color: var(--ink-dim);
          transition: all 0.15s ease;
        }
        .ws-chip:hover { border-color: var(--cyan); color: var(--cyan-bright); background: var(--cyan-soft); }

        .ws-progress { position: absolute; top: 0; left: 0; height: 2px; background: linear-gradient(90deg, var(--cyan), var(--cyan-bright)); border-radius: 2px; z-index: 20; }
      `}</style>

      {/* ---------- HEADER ---------- */}
      <div className="flex items-center gap-4 mb-5 shrink-0">
        <div className="ws-btn-3d w-11 h-11 flex items-center justify-center shrink-0">
          <RiSearchLine className="text-[var(--cyan-bright)]" size={19} />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-[var(--ink)] truncate">{hasStarted ? pageTitle || 'Web Search' : 'Web Search'}</h1>
          <p className="text-[11px] text-[var(--ink-faint)] font-data mt-0.5">
            {hasStarted ? currentUrl : 'Search and browse the web without ever leaving JARVIS'}
          </p>
        </div>
      </div>

      {/* ---------- ADDRESS BAR ---------- */}
      <div className="ws-panel p-3 flex items-center gap-2 mb-5 shrink-0">
        <button onClick={goBack} disabled={!canGoBack} className="ws-btn-3d p-2.5 text-[var(--ink-dim)] cursor-pointer">
          <RiArrowLeftLine size={16} />
        </button>
        <button onClick={goForward} disabled={!canGoForward} className="ws-btn-3d p-2.5 text-[var(--ink-dim)] cursor-pointer">
          <RiArrowRightLine size={16} />
        </button>
        <motion.button
          onClick={reload}
          disabled={!hasStarted}
          animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 0.6, repeat: isLoading ? Infinity : 0, ease: 'linear' }}
          className="ws-btn-3d p-2.5 text-[var(--ink-dim)] cursor-pointer"
        >
          <RiRefreshLine size={16} />
        </motion.button>
        <button onClick={goHome} className="ws-btn-3d p-2.5 text-[var(--ink-dim)] cursor-pointer">
          <RiHome5Line size={16} />
        </button>

        <div className="ws-address-shell flex-1 flex items-center gap-2 px-3.5 py-2.5 min-w-0">
          {hasStarted ? (
            isSecure ? (
              <RiLockLine size={13} className="text-[var(--green)] shrink-0" />
            ) : (
              <RiGlobalLine size={13} className="text-[var(--ink-faint)] shrink-0" />
            )
          ) : (
            <RiSearchLine size={13} className="text-[var(--ink-faint)] shrink-0" />
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Search Google or type a URL…"
            className="bg-transparent border-none outline-none text-sm text-[var(--ink)] placeholder-[var(--ink-faint)] w-full min-w-0"
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSubmit}
          className="ws-btn-primary px-5 py-2.5 text-xs font-bold cursor-pointer shrink-0"
        >
          Search
        </motion.button>
      </div>

      {/* ---------- BROWSER PANEL ---------- */}
      <div className="ws-panel flex-1 relative overflow-hidden min-h-0">
        <AnimatePresence>
          {isLoading && (
            <motion.div
              className="ws-progress"
              initial={{ width: '0%' }}
              animate={{ width: '85%' }}
              exit={{ width: '100%', opacity: 0 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>

        {!hasStarted ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full h-full flex flex-col items-center justify-center gap-6 p-8"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="ws-btn-3d w-16 h-16 rounded-full flex items-center justify-center"
            >
              <RiCompassDiscoverLine size={26} className="text-[var(--cyan-bright)]" />
            </motion.div>
            <div className="text-center">
              <p className="text-sm font-bold text-[var(--ink)]">Search the web without leaving JARVIS</p>
              <p className="text-xs text-[var(--ink-faint)] mt-1">Results open right here — nothing redirects outside the app.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {QUICK_SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => navigate(s)} className="ws-chip px-3.5 py-2 text-xs font-semibold cursor-pointer">
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        ) : isWebviewAvailable ? (
          // @ts-ignore - <webview> is a valid Electron renderer element (requires webviewTag: true in webPreferences)
          <webview
            ref={webviewRef}
            src={currentUrl}
            className="w-full h-full"
            style={{ display: 'inline-flex' }}
            allowpopups={true}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
            <RiGlobalLine size={34} className="text-[var(--amber)]" />
            <p className="text-sm font-semibold text-[var(--ink)]">Web search is unavailable in this build.</p>
            <p className="text-xs text-[var(--ink-faint)] max-w-xs">
              The embedded browser is disabled. Please restart the app or enable webview support in the Electron window configuration.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default WebSearchView