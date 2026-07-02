import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  RiStickyNoteLine,
  RiDeleteBinLine,
  RiFileTextLine,
  RiAddLine,
  RiSave3Line,
  RiCloseLine,
  RiEditLine,
  RiSearchLine,
  RiRefreshLine,
  RiStarLine,
  RiStarFill,
  RiShareLine,
  RiBold,
  RiItalic,
  RiUnderline,
  RiStrikethrough,
  RiCodeSSlashLine,
  RiListUnordered,
  RiListOrdered,
  RiListCheck2,
  RiDoubleQuotesL,
  RiLinkM,
  RiImageLine
} from 'react-icons/ri'

interface Note {
  filename: string
  title: string
  content: string
  createdAt: Date
}

const TAG_COLORS = ['#A855F7', '#38BDF8', '#2DD4BF', '#FB923C', '#F472B6', '#F87171', '#4ADE80']

const tagColorFor = (key: string) => {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return TAG_COLORS[hash % TAG_COLORS.length]
}

const timeAgo = (date: Date) => {
  const d = new Date(date)
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

const MarkdownComponents = {
  code({ node, inline, className, children, ...props }: any) {
    return !inline ? (
      <div className="bg-[var(--bg-sunken)] rounded-lg p-3 my-2 border border-[var(--line-soft)] font-data text-xs overflow-x-auto">
        <code {...props}>{children}</code>
      </div>
    ) : (
      <code className="bg-[var(--purple-soft)] px-1 py-0.5 rounded text-[var(--purple-bright)] font-data text-xs" {...props}>
        {children}
      </code>
    )
  }
}

const NotesView = ({ glassPanel }: { glassPanel?: string }) => {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [lastSync, setLastSync] = useState<Date>(new Date())
  const [isSyncing, setIsSyncing] = useState(false)

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [editOriginalFilename, setEditOriginalFilename] = useState<string | null>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  const fetchNotes = async () => {
    setIsSyncing(true)
    try {
      const data = await window.electron.ipcRenderer.invoke('get-notes')
      setNotes(data)
      setLastSync(new Date())
    } catch (e) {}
    setTimeout(() => setIsSyncing(false), 400)
  }

  useEffect(() => {
    fetchNotes()
    const interval = setInterval(fetchNotes, 3000)
    return () => clearInterval(interval)
  }, [])

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes
    const q = searchQuery.toLowerCase()
    return notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
  }, [notes, searchQuery])

  const startCreating = () => {
    setSelectedNote(null)
    setEditOriginalFilename(null)
    setNewTitle('')
    setNewContent('')
    setIsEditorOpen(true)
  }

  const startEditing = () => {
    if (!selectedNote) return
    setEditOriginalFilename(selectedNote.filename)
    setNewTitle(selectedNote.title)
    const cleanContent = selectedNote.content.replace(/^# .+\n\n/, '')
    setNewContent(cleanContent)
    setIsEditorOpen(true)
  }

  const cancelEditor = () => {
    setIsEditorOpen(false)
    setEditOriginalFilename(null)
  }

  const saveManualNote = async () => {
    if (!newTitle.trim() || !newContent.trim()) return

    await window.electron.ipcRenderer.invoke('save-note', {
      title: newTitle,
      content: newContent
    })

    setIsEditorOpen(false)
    setEditOriginalFilename(null)
    fetchNotes()

    setTimeout(() => {
      window.electron.ipcRenderer.invoke('get-notes').then((data: Note[]) => {
        const created = data.find((n) => n.title.toLowerCase().includes(newTitle.toLowerCase().replace(/ /g, '_')))
        if (created) setSelectedNote(created)
      })
    }, 500)
  }

  const deleteNote = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await window.electron.ipcRenderer.invoke('delete-note', filename)
    fetchNotes()
    if (selectedNote?.filename === filename) setSelectedNote(null)
  }

  const toggleFavorite = (filename: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFavorites((f) => ({ ...f, [filename]: !f[filename] }))
  }

  /* --- toolbar: wraps/inserts markdown syntax around the current selection --- */
  const applyFormat = (before: string, after = before, placeholder = '') => {
    if (!isEditorOpen) {
      startEditing()
      return
    }
    const el = contentRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = newContent.slice(start, end) || placeholder
    const updated = newContent.slice(0, start) + before + selected + after + newContent.slice(end)
    setNewContent(updated)
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = start + before.length
      el.selectionEnd = start + before.length + selected.length
    })
  }

  const toolbarActions = [
    { icon: RiBold, action: () => applyFormat('**', '**', 'bold text') },
    { icon: RiItalic, action: () => applyFormat('_', '_', 'italic text') },
    { icon: RiUnderline, action: () => applyFormat('<u>', '</u>', 'underline') },
    { icon: RiStrikethrough, action: () => applyFormat('~~', '~~', 'strikethrough') },
    { icon: RiCodeSSlashLine, action: () => applyFormat('`', '`', 'code') },
    { label: 'H1', action: () => applyFormat('# ', '', 'Heading 1') },
    { label: 'H2', action: () => applyFormat('## ', '', 'Heading 2') },
    { icon: RiListUnordered, action: () => applyFormat('- ', '', 'list item') },
    { icon: RiListOrdered, action: () => applyFormat('1. ', '', 'list item') },
    { icon: RiListCheck2, action: () => applyFormat('- [ ] ', '', 'task') },
    { icon: RiDoubleQuotesL, action: () => applyFormat('> ', '', 'quote') },
    { icon: RiLinkM, action: () => applyFormat('[', '](url)', 'label') },
    { icon: RiImageLine, action: () => applyFormat('![', '](url)', 'alt text') }
  ]

  const displayedContent = isEditorOpen ? newContent : selectedNote?.content || ''
  const wordCount = displayedContent.trim() ? displayedContent.trim().split(/\s+/).length : 0
  const charCount = displayedContent.length

  return (
    <div className="notes-root flex-1 h-full grid grid-cols-12 gap-6 p-6">
      <style>{`
        .notes-root {
          --bg-base: #120C1A;
          --bg-sunken: #0D0912;
          --panel: #1B1424;
          --panel-raised: #211830;
          --line: #33263F;
          --line-soft: #281D33;
          --ink: #F3F0F7;
          --ink-dim: #A79BB5;
          --ink-faint: #6C5E7C;
          --purple: #A855F7;
          --purple-bright: #C793FF;
          --purple-soft: #A855F722;
          --green: #22D67A;
          --amber: #FFB454;
          --danger: #F87171;
          font-family: 'Manrope', -apple-system, sans-serif;
          background: var(--bg-base);
          color: var(--ink);
        }
        .notes-root .font-data { font-family: 'JetBrains Mono', ui-monospace, monospace; }

        .nv-deck-panel {
          background: linear-gradient(180deg, var(--panel-raised) 0%, var(--panel) 100%);
          border: 1px solid var(--line);
          border-radius: 20px;
          box-shadow: 0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 40px -20px rgba(0,0,0,0.6);
        }
        .nv-well {
          background: var(--bg-sunken);
          border: 1px solid var(--line-soft);
          border-radius: 14px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4) inset;
        }
        .nv-btn-3d {
          border-radius: 10px;
          border: 1px solid var(--line);
          background: linear-gradient(180deg, #2C2138 0%, #221A2C 100%);
          box-shadow: 0 1px 0 0 rgba(255,255,255,0.06) inset, 0 2px 0 0 #140E1B;
          transition: transform 0.12s ease, border-color 0.15s ease;
        }
        .nv-btn-3d:hover { border-color: #4A3A5C; }
        .nv-btn-3d:active { transform: translateY(1.5px); box-shadow: 0 1px 0 0 #140E1B; }

        .nv-btn-primary {
          border-radius: 10px;
          background: linear-gradient(180deg, #C084FC 0%, var(--purple) 100%);
          box-shadow: 0 1px 0 0 rgba(255,255,255,0.25) inset, 0 3px 0 0 #7E22CE, 0 8px 18px -6px rgba(168,85,247,0.5);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .nv-btn-primary:active { transform: translateY(2px); box-shadow: 0 1px 0 0 rgba(255,255,255,0.15) inset, 0 1px 0 0 #7E22CE; }
        .nv-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .nv-note-row {
          border-radius: 14px;
          border: 1px solid var(--line-soft);
          background: var(--bg-sunken);
        }
        .nv-note-row.is-active {
          border-color: #A855F780;
          background: var(--purple-soft);
          box-shadow: 0 0 0 1px #A855F730;
        }

        .nv-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-faint); }

        .nv-search { background: var(--bg-sunken); border: 1px solid var(--line-soft); border-radius: 10px; transition: border-color 0.15s ease; }
        .nv-search:focus-within { border-color: var(--purple); box-shadow: 0 0 0 3px var(--purple-soft); }

        .nv-tool-btn {
          border-radius: 8px;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ink-dim);
          transition: background 0.15s ease, color 0.15s ease;
        }
        .nv-tool-btn:hover { background: var(--panel-raised); color: var(--purple-bright); }

        .nv-stat-chip { background: var(--bg-sunken); border: 1px solid var(--line-soft); border-radius: 12px; }

        .nv-prose h1 { color: var(--purple-bright); font-size: 1.15rem; font-weight: 800; margin: 0 0 .75rem; }
        .nv-prose h2 { color: var(--purple-bright); font-size: 1rem; font-weight: 700; margin: 1rem 0 .5rem; }
        .nv-prose strong { color: var(--ink); }
        .nv-prose ul, .nv-prose ol { margin: .35rem 0 .75rem 1.1rem; }
        .nv-prose li { margin: .2rem 0; color: var(--ink-dim); }
        .nv-prose p { color: var(--ink-dim); line-height: 1.6; }
        .nv-prose blockquote { border-left: 2px solid var(--purple); padding-left: .75rem; color: var(--ink-faint); }

        .nv-glow {
          position: absolute;
          width: 420px;
          height: 420px;
          border-radius: 50%;
          background: radial-gradient(circle, #A855F733 0%, transparent 70%);
          filter: blur(10px);
          pointer-events: none;
        }
      `}</style>

      {/* ---------- LEFT: MEMORY BANK ---------- */}
      <div className="col-span-4 flex flex-col gap-4 h-full overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line-soft)]">
          <div className="flex items-center gap-2">
            <RiStickyNoteLine className="text-[var(--purple-bright)]" size={16} />
            <span className="nv-eyebrow">Memory Bank</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--ink-faint)] font-data mr-1">{notes.length} notes</span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.06 }}
              onClick={startCreating}
              className="nv-btn-3d p-1.5 text-[var(--purple-bright)] cursor-pointer"
              title="Create note"
            >
              <RiAddLine size={14} />
            </motion.button>
          </div>
        </div>

        <div className="nv-search flex items-center gap-2 px-3 py-2.5">
          <RiSearchLine size={14} className="text-[var(--ink-faint)] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes…"
            className="bg-transparent border-none outline-none text-xs text-[var(--ink)] placeholder-[var(--ink-faint)] w-full"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-small">
          {filteredNotes.length === 0 ? (
            <div className="text-center text-[var(--ink-faint)] text-xs mt-10">
              <p>{searchQuery ? 'No notes match your search.' : 'No notes saved yet.'}</p>
              {!searchQuery && <p className="mt-2 opacity-60">Tap + or ask JARVIS to save one.</p>}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filteredNotes.map((note, i) => {
                const dot = tagColorFor(note.filename)
                const isActive = selectedNote?.filename === note.filename && !isEditorOpen
                return (
                  <motion.div
                    key={note.filename}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.16, delay: i * 0.02 }}
                    whileHover={{ x: 2 }}
                    onClick={() => {
                      setIsEditorOpen(false)
                      setSelectedNote(note)
                    }}
                    className={`nv-note-row group p-3 cursor-pointer flex items-center justify-between ${isActive ? 'is-active' : ''}`}
                  >
                    <div className="overflow-hidden flex items-start gap-2.5 min-w-0">
                      <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: dot, boxShadow: `0 0 6px ${dot}` }} />
                      <div className="min-w-0">
                        <h3 className={`text-xs font-bold truncate ${isActive ? 'text-[var(--purple-bright)]' : 'text-[var(--ink)]'}`}>
                          {note.title}
                        </h3>
                        <p className="text-[10px] text-[var(--ink-faint)] mt-0.5 truncate max-w-40">
                          {note.content.replace(/[#*_>`-]/g, '').slice(0, 46)}
                        </p>
                        <p className="text-[9px] text-[var(--ink-faint)] mt-1 font-data">{timeAgo(note.createdAt)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => toggleFavorite(note.filename, e)}
                        className="p-1.5 text-[var(--ink-faint)] hover:text-[var(--amber)] transition-colors cursor-pointer"
                      >
                        {favorites[note.filename] ? <RiStarFill size={13} className="text-[var(--amber)]" /> : <RiStarLine size={13} className="opacity-0 group-hover:opacity-100" />}
                      </button>
                      <button
                        onClick={(e) => deleteNote(note.filename, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--ink-faint)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-lg transition-all cursor-pointer"
                      >
                        <RiDeleteBinLine size={13} />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="nv-stat-chip px-3 py-2.5">
            <span className="text-[9px] text-[var(--ink-faint)] font-data block">Total Notes</span>
            <span className="text-sm font-bold font-data">{notes.length}</span>
          </div>
          <div className="nv-stat-chip px-3 py-2.5 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-[var(--ink-faint)] font-data block">Last Sync</span>
              <span className="text-sm font-bold font-data">{timeAgo(lastSync)}</span>
            </div>
            <motion.button
              onClick={fetchNotes}
              animate={isSyncing ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 0.5, ease: 'linear' }}
              className="text-[var(--ink-faint)] hover:text-[var(--purple-bright)] cursor-pointer"
            >
              <RiRefreshLine size={14} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* ---------- RIGHT: NOTE PANEL ---------- */}
      <div className="col-span-8 nv-deck-panel flex flex-col overflow-hidden relative">
        <div className="nv-glow" style={{ top: -140, right: -140 }} />

        <AnimatePresence mode="wait">
          {isEditorOpen ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col p-6 relative z-10"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    placeholder="Note title…"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="bg-transparent border-none outline-none text-lg font-bold text-[var(--ink)] placeholder-[var(--ink-faint)] w-full"
                    autoFocus
                  />
                  <p className="text-[11px] text-[var(--ink-faint)] mt-1">
                    {editOriginalFilename ? 'Editing note' : 'Created'} · {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <button onClick={cancelEditor} className="p-2 text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors cursor-pointer">
                  <RiCloseLine size={20} />
                </button>
              </div>

              <div className="flex items-center gap-0.5 flex-wrap py-3 border-y border-[var(--line-soft)] my-3">
                {toolbarActions.map((t, i) => (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.88 }}
                    onClick={t.action}
                    className="nv-tool-btn cursor-pointer"
                    title={t.label || t.icon?.name}
                  >
                    {t.icon ? <t.icon size={14} /> : <span className="text-[10px] font-bold">{t.label}</span>}
                  </motion.button>
                ))}
              </div>

              <textarea
                ref={contentRef}
                placeholder="Write your note in Markdown…"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="nv-well flex-1 outline-none resize-none text-sm font-data text-[var(--ink)] placeholder-[var(--ink-faint)] leading-relaxed p-4 scrollbar-small"
              />

              <div className="flex items-center justify-between pt-4">
                <span className="text-[10px] font-data text-[var(--ink-faint)]">
                  Words: {wordCount} &nbsp; Characters: {charCount}
                </span>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={saveManualNote}
                  disabled={!newTitle || !newContent}
                  className="nv-btn-primary flex items-center gap-2 px-6 py-2.5 text-white font-bold text-xs cursor-pointer"
                >
                  <RiSave3Line size={14} /> {editOriginalFilename ? 'Update Note' : 'Save Note'}
                </motion.button>
              </div>
            </motion.div>
          ) : selectedNote ? (
            <motion.div
              key={selectedNote.filename}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="flex-1 flex flex-col relative z-10 overflow-hidden"
            >
              <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[var(--line-soft)]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[var(--ink)] truncate">{selectedNote.title}</h2>
                    <button onClick={startEditing} className="text-[var(--ink-faint)] hover:text-[var(--purple-bright)] transition-colors cursor-pointer">
                      <RiEditLine size={14} />
                    </button>
                  </div>
                  <p className="text-[11px] text-[var(--ink-faint)] mt-1">
                    Created {new Date(selectedNote.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} · {new Date(selectedNote.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="flex items-center gap-1.5 text-[10px] font-data text-[var(--ink-faint)]">
                    <motion.span
                      className="w-1.5 h-1.5 rounded-full bg-[var(--green)]"
                      animate={{ opacity: [1, 0.35, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                    />
                    Auto-save
                  </span>
                  <button onClick={(e) => toggleFavorite(selectedNote.filename, e)} className="text-[var(--ink-faint)] hover:text-[var(--amber)] transition-colors cursor-pointer">
                    {favorites[selectedNote.filename] ? <RiStarFill size={15} className="text-[var(--amber)]" /> : <RiStarLine size={15} />}
                  </button>
                  <button className="text-[var(--ink-faint)] hover:text-[var(--purple-bright)] transition-colors cursor-pointer">
                    <RiShareLine size={15} />
                  </button>
                  <button
                    onClick={(e) => deleteNote(selectedNote.filename, e)}
                    className="text-[var(--ink-faint)] hover:text-[var(--danger)] transition-colors cursor-pointer"
                  >
                    <RiDeleteBinLine size={15} />
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={startEditing}
                    className="nv-btn-primary flex items-center gap-1.5 px-4 py-2 text-white font-bold text-[11px] cursor-pointer"
                  >
                    <RiSave3Line size={13} /> Edit Note
                  </motion.button>
                </div>
              </div>

              <div className="flex items-center gap-0.5 flex-wrap px-6 py-2.5 border-b border-[var(--line-soft)] opacity-60">
                {toolbarActions.map((t, i) => (
                  <button key={i} onClick={startEditing} className="nv-tool-btn cursor-pointer" title={t.label || 'Format'}>
                    {t.icon ? <t.icon size={14} /> : <span className="text-[10px] font-bold">{t.label}</span>}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-8 scrollbar-small">
                <div className="nv-prose prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                    {selectedNote.content}
                  </ReactMarkdown>
                </div>
              </div>

              <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--line-soft)] text-[10px] font-data text-[var(--ink-faint)]">
                <span>Words: {wordCount} &nbsp; Characters: {charCount}</span>
                <span className="flex items-center gap-1.5">
                  Last edited: {timeAgo(selectedNote.createdAt)}
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-4 relative z-10"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="nv-btn-3d w-16 h-16 flex items-center justify-center"
              >
                <RiFileTextLine size={26} className="text-[var(--ink-faint)]" />
              </motion.div>
              <span className="text-xs tracking-wide text-[var(--ink-faint)]">Select a note or create a new one</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default NotesView