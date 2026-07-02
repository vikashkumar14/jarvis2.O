import { useState, useEffect, useRef, useCallback, type ReactElement } from 'react'
import {
  RiAppsLine,
  RiTerminalBoxLine,
  RiChromeLine,
  RiCodeLine,
  RiSpotifyLine,
  RiDiscordLine,
  RiGamepadLine
} from 'react-icons/ri'
import { getAllApps, AppItem } from '@renderer/services/system-info'
import { openApp, closeApp } from '@renderer/functions/apps-manager-api'

const SmartIcon = ({ name }: { name: string }): ReactElement => {
  if (!name) return <div className="w-10 h-10 bg-zinc-800 rounded-lg border border-white/5" />

  const lower = name.toLowerCase()
  let icon = <RiAppsLine size={20} />
  let color = 'text-zinc-400'
  let bg = 'bg-zinc-800'

  if (lower.includes('chrome') || lower.includes('edge') || lower.includes('firefox') || lower.includes('brave')) {
    icon = <RiChromeLine size={20} />
    color = 'text-blue-400'
    bg = 'bg-blue-500/10'
  } else if (lower.includes('code') || lower.includes('dev') || lower.includes('studio') || lower.includes('visual')) {
    icon = <RiCodeLine size={20} />
    color = 'text-cyan-400'
    bg = 'bg-cyan-500/10'
  } else if (lower.includes('spotify') || lower.includes('music') || lower.includes('vlc')) {
    icon = <RiSpotifyLine size={20} />
    color = 'text-green-400'
    bg = 'bg-green-500/10'
  } else if (lower.includes('discord') || lower.includes('telegram') || lower.includes('whatsapp') || lower.includes('slack')) {
    icon = <RiDiscordLine size={20} />
    color = 'text-indigo-400'
    bg = 'bg-indigo-500/10'
  } else if (lower.includes('game') || lower.includes('launcher') || lower.includes('steam') || lower.includes('epic')) {
    icon = <RiGamepadLine size={20} />
    color = 'text-purple-400'
    bg = 'bg-purple-500/10'
  } else if (lower.includes('terminal') || lower.includes('cmd') || lower.includes('powershell')) {
    icon = <RiTerminalBoxLine size={20} />
    color = 'text-yellow-400'
    bg = 'bg-yellow-500/10'
  }

  return (
    <div
      className={`w-10 h-10 rounded-lg flex items-center justify-center border border-white/5 ${bg} ${color} shadow-sm group-hover:scale-110 transition-transform`}
    >
      {icon}
    </div>
  )
}

const AppCard = ({ app, onSuccess }: { app: AppItem; onSuccess: () => void }): ReactElement => {
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleLaunch = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    setLoading(true)
    try {
      const result = await openApp(app.name)
      
      if (result.success) {
        setIsOpen(true)
        onSuccess()
      } else {
        alert(`Unable to launch ${app.name}\n\n${result.error}`)
      }
    } catch (error) {
      alert(`Error launching ${app.name}: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!isOpen) return

    try {
      const result = await closeApp(app.name)
      if (result.success) {
        setIsOpen(false)
      } else {
        alert(`Unable to close ${app.name}\n\n${result.error}`)
      }
    } catch (error) {
      alert(`Error closing ${app.name}: ${error}`)
    }
  }

  return (
    <div
      className={`bg-zinc-950/40 backdrop-blur-xl border transition-all cursor-pointer group active:scale-95 rounded-xl p-4 flex items-center gap-4 ${
        isOpen 
          ? 'bg-emerald-500/10 border-emerald-500/50 hover:border-emerald-500/70' 
          : 'border-white/5 hover:bg-white/10 hover:border-emerald-500/30'
      }`}
    >
      <SmartIcon name={app.name} />
      <div className="flex-1 overflow-hidden min-w-0">
        <div className="text-xs font-bold text-zinc-200 truncate group-hover:text-emerald-400 transition-colors">
          {app.name}
        </div>
        <div className={`text-[8px] truncate font-mono mt-1 opacity-70 group-hover:opacity-100 ${
          isOpen ? 'text-emerald-500' : 'text-zinc-600'
        }`}>
          {isOpen ? '● RUNNING' : 'INSTALLED'}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        {isOpen && (
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-2 py-1 rounded text-[10px] font-mono bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            Close
          </button>
        )}
        <button
          onClick={handleLaunch}
          disabled={loading}
          className="px-2 py-1 rounded text-[10px] font-mono bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : isOpen ? 'Running' : 'Open'}
        </button>
      </div>
    </div>
  )
}

const AppsView = (): ReactElement => {
  const [allApps, setAllApps] = useState<AppItem[]>([])
  const [visibleApps, setVisibleApps] = useState<AppItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const observer = useRef<IntersectionObserver | null>(null)
  const lastAppElementRef = useCallback(
    (node: HTMLDivElement) => {
      if (loading) return
      if (observer.current) observer.current.disconnect()

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && visibleApps.length < allApps.length) {
          setPage((prev) => prev + 1)
        }
      })
      if (node) observer.current.observe(node)
    },
    [loading, visibleApps.length, allApps.length]
  )

  useEffect(() => {
    setLoading(true)
    setError(null)
    
    getAllApps()
      .then((raw) => {
        console.log('getAllApps response:', raw)
        
        // Proper data validation
        let cleanData: AppItem[] = []
        
        if (Array.isArray(raw)) {
          cleanData = raw.filter(
            (item) => item && typeof item === 'object' && item.name && typeof item.name === 'string'
          )
        } else if (raw && typeof raw === 'object') {
          cleanData = Object.values(raw).filter(
            (item) => item && typeof item === 'object' && (item as any).name
          )
        }

        console.log('Cleaned apps:', cleanData.length, cleanData.slice(0, 5))

        if (cleanData.length === 0) {
          setError('No apps found. Make sure your backend is scanning the system correctly.')
        }

        setAllApps(cleanData)
        setVisibleApps(cleanData.slice(0, 15))
      })
      .catch((err) => {
        console.error('Error loading apps:', err)
        setError(`Failed to load apps: ${err.message}`)
        setAllApps([])
        setVisibleApps([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (page > 1) {
      const nextBatch = allApps.slice(0, page * 12 + 6)
      requestAnimationFrame(() => setVisibleApps(nextBatch))
    }
  }, [page, allApps])

  // Search filter
  const filtered = visibleApps.filter((app) =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex-1 bg-white/8 p-8 h-full flex flex-col animate-in fade-in zoom-in duration-300">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
            <RiAppsLine className="text-emerald-400" size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-200 tracking-widest">SYSTEM APPLICATIONS</h2>
            <p className="text-[10px] text-zinc-500 font-mono">INDEXED SOFTWARE LIBRARY</p>
          </div>
        </div>
        <div className="text-xs font-mono text-emerald-500 bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/20">
          {loading ? 'SCANNING...' : `${allApps.length} FOUND`}
        </div>
      </div>

      {/* Search Bar */}
      {!loading && allApps.length > 0 && (
        <div className="mb-4 shrink-0">
          <input
            type="text"
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-zinc-900/50 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
          ⚠️ {error}
        </div>
      )}

      {/* Apps Grid */}
      <div className="flex-1 overflow-y-auto pr-4 pb-4 scrollbar-small min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border border-emerald-500/30 border-t-emerald-500 mx-auto mb-2"></div>
              <p className="text-zinc-500 text-xs">Scanning System...</p>
            </div>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((app, index) => {
              const safeKey = `${app.id || app.name}-${index}`

              if (filtered.length === index + 1) {
                return (
                  <div ref={lastAppElementRef} key={safeKey}>
                    <AppCard app={app} onSuccess={() => {}} />
                  </div>
                )
              } else {
                return <AppCard key={safeKey} app={app} onSuccess={() => {}} />
              }
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-zinc-500">
              <RiAppsLine size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs">{searchQuery ? 'No apps match your search.' : 'No Apps Found.'}</p>
              {!searchQuery && (
                <p className="text-[10px] mt-2 opacity-70">
                  Check if your backend service is running properly.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AppsView