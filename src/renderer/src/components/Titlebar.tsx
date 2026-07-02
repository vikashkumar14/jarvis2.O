import { useState, useEffect, useRef } from 'react'
import {
  RiSubtractLine,
  RiCloseLine,
  RiCheckboxBlankLine,
  RiCheckboxMultipleBlankLine,
  RiMore2Fill
} from 'react-icons/ri'

const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isMac, setIsMac] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.electron && window.electron.process) {
      setIsMac(window.electron.process.platform === 'darwin')
    } else {
      setIsMac(navigator.userAgent.toLowerCase().includes('mac'))
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen])

  const minimize = () => {
    window.electron.ipcRenderer.send('window-min')
    setIsMenuOpen(false)
  }
  const toggleMaximize = () => {
    setIsMaximized(!isMaximized)
    window.electron.ipcRenderer.send('window-max')
    setIsMenuOpen(false)
  }
  const close = () => {
    window.electron.ipcRenderer.send('window-close')
    setIsMenuOpen(false)
  }

  return (
    <div className="tb-root w-full h-10 flex items-center justify-between px-3 drag-region select-none z-1000 relative">
      <style>{`
        .tb-root {
          --bg-base: #1C1D24;
          --panel: #25262F;
          --panel-raised: #292A34;
          --line: #383947;
          --line-soft: #2F303A;
          --ink: #F2F1ED;
          --ink-dim: #A8A8B3;
          --ink-faint: #6C6D78;
          --green: #00E38C;
          --green-bright: #4DFFC7;
          --green-soft: #00E38C22;
          --amber: #FFB454;
          --danger: #FF6B6B;
          font-family: 'Manrope', -apple-system, sans-serif;
          background: var(--bg-base);
          border-bottom: 1px solid var(--line-soft);
        }
        .tb-root .font-data { font-family: 'JetBrains Mono', ui-monospace, monospace; }

        .tb-dot {
          width: 12px; height: 12px; border-radius: 999px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(0,0,0,0.25);
          box-shadow: 0 1px 0 0 rgba(255,255,255,0.25) inset;
          transition: filter 0.15s ease;
          cursor: pointer;
        }
        .tb-dot:hover { filter: brightness(1.1); }
        .tb-dot span { font-size: 8px; font-weight: 800; opacity: 0; transition: opacity 0.15s ease; }
        .tb-dot:hover span { opacity: 1; }

        .tb-icon-btn {
          width: 44px; height: 100%;
          display: flex; align-items: center; justify-content: center;
          color: var(--ink-faint);
          transition: all 0.15s ease;
          cursor: pointer;
        }
        .tb-icon-btn:hover { background: rgba(255,255,255,0.04); color: var(--ink); }
        .tb-icon-btn.is-danger:hover { background: var(--danger); color: white; }

        .tb-menu-trigger {
          width: 28px; height: 28px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          color: var(--ink-faint);
          border: 1px solid transparent;
          transition: all 0.15s ease;
          cursor: pointer;
        }
        .tb-menu-trigger:hover, .tb-menu-trigger.is-active {
          background: var(--panel-raised);
          border-color: var(--line);
          color: var(--green-bright);
        }

        .tb-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          background: linear-gradient(180deg, var(--panel-raised) 0%, var(--panel) 100%);
          border: 1px solid var(--line);
          border-radius: 14px;
          box-shadow:
            0 1px 0 0 rgba(255,255,255,0.05) inset,
            0 16px 32px -12px rgba(0,0,0,0.6);
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 168px;
          animation: tb-pop 0.14s ease;
          transform-origin: top right;
        }
        @keyframes tb-pop {
          from { opacity: 0; transform: scale(0.95) translateY(-4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .tb-menu-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 10px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-dim);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.12s ease;
          text-align: left;
          width: 100%;
        }
        .tb-menu-item:hover { background: var(--green-soft); color: var(--green-bright); }
        .tb-menu-item.is-danger:hover { background: var(--danger); color: white; }

        .tb-status-dot {
          box-shadow: 0 0 0 3px var(--amber)22, 0 0 8px var(--amber);
        }
      `}</style>

      {isMac && (
        <div className="flex items-center gap-2 no-drag z-50">
          <button
            onClick={close}
            className="tb-dot"
            style={{ background: 'linear-gradient(180deg, #FF8A8A, var(--danger))' }}
          >
            <span style={{ color: '#5A1414' }}>×</span>
          </button>
          <button
            onClick={minimize}
            className="tb-dot"
            style={{ background: 'linear-gradient(180deg, #FFC777, var(--amber))' }}
          >
            <span style={{ color: '#5A3B0F' }}>−</span>
          </button>
          <button
            onClick={toggleMaximize}
            className="tb-dot"
            style={{ background: 'linear-gradient(180deg, #33FFB0, var(--green))' }}
          >
            <span style={{ color: '#1F1A5C', fontSize: '6px' }}>↗</span>
          </button>
        </div>
      )}

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] tb-status-dot animate-pulse" />
        <div className="text-[10px] font-bold text-[var(--ink-dim)] tracking-[0.25em] font-data">
          JARVIS 2.O // {isMac ? 'MAC' : 'SYSTEM'}
        </div>
      </div>

      {/* Menu trigger — opens dropdown with all window controls */}
      <div className="no-drag z-50 relative ml-auto" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen((v) => !v)}
          className={`tb-menu-trigger ${isMenuOpen ? 'is-active' : ''}`}
          title="Window menu"
        >
          <RiMore2Fill size={16} />
        </button>

        {isMenuOpen && (
          <div className="tb-dropdown right-0">
            <button onClick={minimize} className="tb-menu-item">
              <RiSubtractLine size={15} /> Minimize
            </button>
            <button onClick={toggleMaximize} className="tb-menu-item">
              {isMaximized ? (
                <RiCheckboxMultipleBlankLine size={13} />
              ) : (
                <RiCheckboxBlankLine size={13} />
              )}
              {isMaximized ? 'Restore' : 'Maximize'}
            </button>
            <div className="h-px bg-[var(--line-soft)] my-1" />
            <button onClick={close} className="tb-menu-item is-danger">
              <RiCloseLine size={16} /> Close
            </button>
          </div>
        )}
      </div>

      {/* Direct window controls — unchanged behavior, only on non-Mac */}
      {!isMac && (
        <div className="flex h-full no-drag z-50">
          <button onClick={minimize} className="tb-icon-btn" title="Minimize">
            <RiSubtractLine size={16} />
          </button>
          <button onClick={toggleMaximize} className="tb-icon-btn" title={isMaximized ? 'Restore' : 'Maximize'}>
            {isMaximized ? (
              <RiCheckboxMultipleBlankLine size={14} />
            ) : (
              <RiCheckboxBlankLine size={14} />
            )}
          </button>
          <button onClick={close} className="tb-icon-btn is-danger" title="Close">
            <RiCloseLine size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

export default TitleBar