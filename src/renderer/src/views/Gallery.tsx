import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  RiImage2Line,
  RiDeleteBinLine,
  RiFolderOpenLine,
  RiCloseLine,
  RiMagicLine,
  RiFileWarningLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiDownloadLine,
  RiGridLine,
  RiListUnordered,
  RiArrowDownSLine,
  RiUploadCloud2Line,
  RiStarLine,
  RiStarFill,
  RiVideoLine,
  RiFilePdf2Line,
  RiFileCodeLine,
  RiFileLine,
  RiPlayCircleFill,
  RiMore2Line,
  RiHardDrive2Line,
  RiTimeLine
} from 'react-icons/ri'
import { motion, AnimatePresence } from 'framer-motion'

interface GalleryImage {
  filename: string
  displayName: string
  path: string
  url: string
  createdAt: Date
  size?: number
}

type MediaType = 'image' | 'video' | 'pdf' | 'code' | 'other'
type CategoryId = 'all' | 'image' | 'video' | 'pdf' | 'other' | 'favorites' | 'recent'
type SortMode = 'latest' | 'oldest' | 'name'
type ViewMode = 'grid' | 'list'

const EXT_MAP: Record<string, MediaType> = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image',
  mp4: 'video', webm: 'video', mov: 'video', mkv: 'video',
  pdf: 'pdf',
  js: 'code', ts: 'code', tsx: 'code', jsx: 'code', py: 'code', html: 'code', css: 'code', json: 'code', md: 'code', txt: 'code'
}

const getType = (filename: string): MediaType => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return EXT_MAP[ext] || 'other'
}

const TYPE_META: Record<MediaType, { icon: typeof RiImage2Line; color: string }> = {
  image: { icon: RiImage2Line, color: '#A855F7' },
  video: { icon: RiVideoLine, color: '#F472B6' },
  pdf: { icon: RiFilePdf2Line, color: '#F87171' },
  code: { icon: RiFileCodeLine, color: '#38BDF8' },
  other: { icon: RiFileLine, color: '#A79BB5' }
}

const formatSize = (bytes?: number) => {
  if (!bytes) return null
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const GalleryView = () => {
  const [allImages, setAllImages] = useState<GalleryImage[]>([])
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)
  const [direction, setDirection] = useState(0)
  const [category, setCategory] = useState<CategoryId>('all')
  const [sortMode, setSortMode] = useState<SortMode>('latest')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})

  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 12
  const observer = useRef<IntersectionObserver | null>(null)

  const fetchGallery = async () => {
    try {
      const data = await window.electron.ipcRenderer.invoke('get-gallery')
      if (Array.isArray(data)) setAllImages(data)
    } catch (e) {}
  }

  useEffect(() => {
    fetchGallery()
    const interval = setInterval(fetchGallery, 5000)
    return () => clearInterval(interval)
  }, [])

  /* --- category counts, always derived from what JARVIS has actually generated/saved --- */
  const counts = useMemo(() => {
    const c = { all: allImages.length, image: 0, video: 0, pdf: 0, other: 0, favorites: 0, recent: 0 }
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    allImages.forEach((img) => {
      const t = getType(img.filename)
      if (t === 'code') c.other++
      else c[t as 'image' | 'video' | 'pdf' | 'other']++
      if (favorites[img.filename]) c.favorites++
      if (new Date(img.createdAt).getTime() >= dayAgo) c.recent++
    })
    return c
  }, [allImages, favorites])

  const filteredImages = useMemo(() => {
    let list = [...allImages]
    if (category === 'favorites') list = list.filter((i) => favorites[i.filename])
    else if (category === 'recent') list = list.filter((i) => Date.now() - new Date(i.createdAt).getTime() < 24 * 60 * 60 * 1000)
    else if (category !== 'all') {
      list = list.filter((i) => {
        const t = getType(i.filename)
        return category === 'other' ? t === 'other' || t === 'code' : t === category
      })
    }
    if (sortMode === 'latest') list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    else if (sortMode === 'oldest') list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    else list.sort((a, b) => a.displayName.localeCompare(b.displayName))
    return list
  }, [allImages, category, favorites, sortMode])

  const visibleImages = filteredImages.slice(0, page * ITEMS_PER_PAGE)

  useEffect(() => setPage(1), [category, sortMode])

  const lastImageRef = useCallback(
    (node: HTMLDivElement) => {
      if (observer.current) observer.current.disconnect()
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && visibleImages.length < filteredImages.length) {
          setPage((prev) => prev + 1)
        }
      })
      if (node) observer.current.observe(node)
    },
    [visibleImages.length, filteredImages.length]
  )

  const deleteImage = async (filename: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await window.electron.ipcRenderer.invoke('delete-image', filename)
    if (selectedImage) {
      const currentIndex = filteredImages.findIndex((img) => img.filename === selectedImage.filename)
      const nextImage = filteredImages[currentIndex + 1] || filteredImages[currentIndex - 1]
      setSelectedImage(nextImage && nextImage.filename !== filename ? nextImage : null)
    }
    fetchGallery()
  }

  const openLocation = async (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await window.electron.ipcRenderer.invoke('open-image-location', path)
  }

  const saveCopy = async (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await window.electron.ipcRenderer.invoke('save-image-external', path)
  }

  const uploadMedia = async () => {
    try {
      await window.electron?.ipcRenderer?.invoke('upload-media')
      fetchGallery()
    } catch (e) {}
  }

  const toggleFavorite = (filename: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setFavorites((f) => ({ ...f, [filename]: !f[filename] }))
  }

  const navigateImage = useCallback(
    (newDirection: number) => {
      if (!selectedImage || filteredImages.length === 0) return
      setDirection(newDirection)
      const currentIndex = filteredImages.findIndex((img) => img.filename === selectedImage.filename)
      if (currentIndex === -1) return
      let newIndex = currentIndex + newDirection
      if (newIndex >= filteredImages.length) newIndex = 0
      if (newIndex < 0) newIndex = filteredImages.length - 1
      setSelectedImage(filteredImages[newIndex])
    },
    [selectedImage, filteredImages]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedImage) return
      if (e.key === 'ArrowRight') navigateImage(1)
      if (e.key === 'ArrowLeft') navigateImage(-1)
      if (e.key === 'Escape') setSelectedImage(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage, navigateImage])

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 600 : -600, opacity: 0, scale: 0.92, rotateY: dir > 0 ? 12 : -12 }),
    center: { zIndex: 1, x: 0, opacity: 1, scale: 1, rotateY: 0 },
    exit: (dir: number) => ({ zIndex: 0, x: dir < 0 ? 600 : -600, opacity: 0, scale: 0.92, rotateY: dir < 0 ? 12 : -12 })
  }

  const CATEGORIES: { id: CategoryId; label: string; icon: typeof RiImage2Line; count: number }[] = [
    { id: 'all', label: 'All Media', icon: RiGridLine, count: counts.all },
    { id: 'image', label: 'Images', icon: RiImage2Line, count: counts.image },
    { id: 'video', label: 'Videos', icon: RiVideoLine, count: counts.video },
    { id: 'pdf', label: 'Documents', icon: RiFilePdf2Line, count: counts.pdf },
    { id: 'other', label: 'Others', icon: RiFileLine, count: counts.other },
    { id: 'favorites', label: 'Favorites', icon: RiStarLine, count: counts.favorites },
    { id: 'recent', label: 'Recently Added', icon: RiTimeLine, count: counts.recent }
  ]

  const totalBytes = allImages.reduce((sum, i) => sum + (i.size || 0), 0)
  const storagePct = Math.min(100, (allImages.length / 60) * 100)

  return (
    <div className="gv-root flex-1 h-full p-6 flex gap-6 overflow-hidden">
      <style>{`
        .gv-root {
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
        .gv-root .font-data { font-family: 'JetBrains Mono', ui-monospace, monospace; }

        .gv-btn-3d {
          border-radius: 10px; border: 1px solid var(--line);
          background: linear-gradient(180deg, #2C2138 0%, #221A2C 100%);
          box-shadow: 0 1px 0 0 rgba(255,255,255,0.06) inset, 0 2px 0 0 #140E1B;
        }

        .gv-cat-item { border-radius: 10px; transition: background 0.15s ease, color 0.15s ease; }
        .gv-cat-item.is-active { background: var(--purple-soft); color: var(--purple-bright) !important; }
        .gv-cat-item:not(.is-active):hover { background: var(--panel); }

        .gv-card {
          border-radius: 16px; background: var(--bg-sunken); border: 1px solid var(--line-soft);
          overflow: hidden; transition: border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease;
        }
        .gv-card:hover { border-color: #A855F780; box-shadow: 0 20px 40px -16px rgba(168,85,247,0.28); transform: translateY(-3px); }

        .gv-pill {
          font-size: 10px; font-family: 'JetBrains Mono', ui-monospace, monospace; color: var(--purple-bright);
          background: var(--purple-soft); border: 1px solid #A855F740; border-radius: 8px; padding: 6px 12px;
          display: flex; align-items: center; gap: 6px;
        }

        .gv-icon-btn {
          padding: 8px; border-radius: 10px; background: rgba(27,20,36,0.85); backdrop-filter: blur(8px);
          border: 1px solid var(--line); color: var(--ink); transition: all 0.15s ease;
        }
        .gv-icon-btn:hover.is-info { background: var(--purple); border-color: var(--purple); color: white; }
        .gv-icon-btn:hover.is-danger { background: var(--danger); border-color: var(--danger); color: white; }

        .gv-lightbox-btn {
          border-radius: 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; padding: 10px 22px;
          display: flex; align-items: center; gap: 8px; transition: all 0.18s ease;
          border: 1px solid var(--line); background: var(--panel); color: var(--ink-dim);
        }
        .gv-lightbox-btn:hover { background: var(--panel-raised); color: var(--ink); }
        .gv-lightbox-btn.is-primary { border-color: #7E22CE; background: var(--purple-soft); color: var(--purple-bright); }
        .gv-lightbox-btn.is-primary:hover { background: var(--purple); color: white; }
        .gv-lightbox-btn.is-danger { border-color: #B23A3A40; background: rgba(248,113,113,0.08); color: var(--danger); }
        .gv-lightbox-btn.is-danger:hover { background: var(--danger); color: white; }

        .gv-nav-zone { transition: background 0.2s ease; }

        .gv-select { background: var(--bg-sunken); border: 1px solid var(--line-soft); border-radius: 10px; }
        .gv-toggle-btn { border-radius: 8px; padding: 7px; color: var(--ink-faint); transition: all 0.15s ease; }
        .gv-toggle-btn.is-on { background: var(--purple-soft); color: var(--purple-bright); }

        .gv-btn-primary {
          border-radius: 10px; background: linear-gradient(180deg, #C084FC 0%, var(--purple) 100%);
          box-shadow: 0 1px 0 0 rgba(255,255,255,0.25) inset, 0 3px 0 0 #7E22CE, 0 8px 18px -6px rgba(168,85,247,0.5);
        }

        .gv-progress-track { background: var(--bg-sunken); border: 1px solid var(--line-soft); border-radius: 999px; overflow: hidden; }
        .gv-progress-fill { background: linear-gradient(90deg, var(--purple), var(--purple-bright)); }

        .gv-list-row { border-radius: 12px; border: 1px solid var(--line-soft); background: var(--bg-sunken); transition: border-color 0.15s ease; }
        .gv-list-row:hover { border-color: #A855F760; }
      `}</style>

      {/* ---------- LEFT: SIDEBAR ---------- */}
      <div className="w-56 shrink-0 flex flex-col gap-5 h-full">
        <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--ink-faint)] px-1">Gallery</span>

        <nav className="flex flex-col gap-0.5">
          {CATEGORIES.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setCategory(id)}
              className={`gv-cat-item flex items-center justify-between px-3 py-2.5 text-xs font-semibold cursor-pointer ${
                category === id ? 'is-active' : 'text-[var(--ink-dim)]'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon size={15} />
                {label}
              </span>
              <span className="font-data text-[10px] text-[var(--ink-faint)]">{count}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto gv-btn-3d p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--ink-dim)]">
              <RiHardDrive2Line size={13} /> Storage Usage
            </span>
            <span className="font-data text-[10px] text-[var(--ink-faint)]">
              {formatSize(totalBytes) || `${allImages.length} items`}
            </span>
          </div>
          <div className="gv-progress-track h-1.5 w-full">
            <div className="gv-progress-fill h-full" style={{ width: `${storagePct}%` }} />
          </div>
        </div>
      </div>

      {/* ---------- RIGHT: CONTENT ---------- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between pb-5 mb-5 border-b border-[var(--line-soft)] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[var(--ink)]">{CATEGORIES.find((c) => c.id === category)?.label}</h2>
            <p className="text-[11px] text-[var(--ink-faint)] font-data mt-0.5">{filteredImages.length} items</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 gv-select p-1">
              <button onClick={() => setViewMode('grid')} className={`gv-toggle-btn cursor-pointer ${viewMode === 'grid' ? 'is-on' : ''}`}>
                <RiGridLine size={15} />
              </button>
              <button onClick={() => setViewMode('list')} className={`gv-toggle-btn cursor-pointer ${viewMode === 'list' ? 'is-on' : ''}`}>
                <RiListUnordered size={15} />
              </button>
            </div>

            <div className="gv-select relative flex items-center">
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="appearance-none bg-transparent border-none pl-3 pr-8 py-2 text-xs font-semibold text-[var(--ink)] outline-none cursor-pointer"
              >
                <option value="latest" className="bg-[var(--panel)]">Sort by: Latest</option>
                <option value="oldest" className="bg-[var(--panel)]">Sort by: Oldest</option>
                <option value="name" className="bg-[var(--panel)]">Sort by: Name</option>
              </select>
              <RiArrowDownSLine size={13} className="absolute right-2.5 text-[var(--ink-faint)] pointer-events-none" />
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={uploadMedia}
              className="gv-btn-primary flex items-center gap-2 px-4 py-2.5 text-white font-bold text-xs cursor-pointer"
            >
              <RiUploadCloud2Line size={15} /> Upload
            </motion.button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-small pr-2 min-h-0">
          {filteredImages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="gv-btn-3d w-20 h-20 rounded-full flex items-center justify-center">
                <RiImage2Line size={30} className="text-[var(--ink-faint)]" />
              </div>
              <p className="text-xs tracking-wide text-[var(--ink-faint)]">
                {category === 'all' ? 'No media yet — anything JARVIS generates will show up here' : 'Nothing in this category yet'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 pb-10">
              {visibleImages.map((img, index) => {
                const isLast = index === visibleImages.length - 1
                const type = getType(img.filename)
                const meta = TYPE_META[type]
                const sizeLabel = formatSize(img.size)

                return (
                  <div
                    key={`${img.filename}-${index}`}
                    ref={isLast ? lastImageRef : null}
                    onClick={() => {
                      setDirection(0)
                      setSelectedImage(img)
                    }}
                    className="gv-card group relative aspect-16/10 cursor-pointer"
                  >
                    {type === 'image' || type === 'video' ? (
                      <>
                        <img
                          src={img.url}
                          alt={img.displayName}
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="hidden absolute inset-0 items-center justify-center flex-col gap-2 bg-[var(--bg-sunken)]">
                          <RiFileWarningLine className="text-[var(--danger)]/60" size={22} />
                          <span className="text-[8px] text-[var(--ink-faint)]">Couldn't load file</span>
                        </div>
                        {type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <RiPlayCircleFill size={34} className="text-white/80 drop-shadow-lg" />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${meta.color}14` }}>
                        <meta.icon size={34} style={{ color: meta.color }} />
                      </div>
                    )}

                    {sizeLabel && (
                      <span className="absolute top-2.5 right-2.5 text-[9px] font-data px-2 py-1 rounded-md bg-[#0D0912cc] text-[var(--ink-faint)] border border-[var(--line-soft)]">
                        {sizeLabel}
                      </span>
                    )}

                    <button
                      onClick={(e) => toggleFavorite(img.filename, e)}
                      className="absolute top-2.5 left-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-[#0D0912cc] border border-[var(--line-soft)] cursor-pointer"
                    >
                      {favorites[img.filename] ? (
                        <RiStarFill size={12} className="text-[var(--amber)]" />
                      ) : (
                        <RiStarLine size={12} className="text-[var(--ink-faint)]" />
                      )}
                    </button>

                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D0912f2] via-[#0D091280] to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
                      <p className="text-[11px] text-[var(--ink)] line-clamp-1 font-bold mb-0.5 capitalize">{img.displayName}</p>
                      <p className="text-[9px] text-[var(--purple-bright)] font-data mb-3">{new Date(img.createdAt).toLocaleDateString()}</p>

                      <div className="flex gap-2 justify-end">
                        <button onClick={(e) => openLocation(img.path, e)} className="gv-icon-btn is-info cursor-pointer" title="Open file location">
                          <RiFolderOpenLine size={14} />
                        </button>
                        <button onClick={(e) => deleteImage(img.filename, e)} className="gv-icon-btn is-danger cursor-pointer" title="Delete">
                          <RiDeleteBinLine size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-2 pb-10">
              {visibleImages.map((img, index) => {
                const isLast = index === visibleImages.length - 1
                const type = getType(img.filename)
                const meta = TYPE_META[type]
                const sizeLabel = formatSize(img.size)
                return (
                  <div
                    key={`${img.filename}-${index}`}
                    ref={isLast ? lastImageRef : null}
                    onClick={() => {
                      setDirection(0)
                      setSelectedImage(img)
                    }}
                    className="gv-list-row group flex items-center gap-4 px-4 py-3 cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: `${meta.color}14` }}>
                      {type === 'image' || type === 'video' ? (
                        <img src={img.url} alt={img.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <meta.icon size={18} style={{ color: meta.color }} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate capitalize">{img.displayName}</p>
                      <p className="text-[10px] text-[var(--ink-faint)] font-data mt-0.5">{new Date(img.createdAt).toLocaleString()}</p>
                    </div>
                    {sizeLabel && <span className="text-[10px] font-data text-[var(--ink-faint)] shrink-0">{sizeLabel}</span>}
                    <button onClick={(e) => toggleFavorite(img.filename, e)} className="text-[var(--ink-faint)] hover:text-[var(--amber)] cursor-pointer shrink-0">
                      {favorites[img.filename] ? <RiStarFill size={14} className="text-[var(--amber)]" /> : <RiStarLine size={14} />}
                    </button>
                    <button
                      onClick={(e) => deleteImage(img.filename, e)}
                      className="opacity-0 group-hover:opacity-100 text-[var(--ink-faint)] hover:text-[var(--danger)] cursor-pointer shrink-0 transition-opacity"
                    >
                      <RiDeleteBinLine size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---------- LIGHTBOX ---------- */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(20px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-9999 flex items-center justify-center"
            style={{ background: 'rgba(13,9,18,0.92)' }}
          >
            <button onClick={() => setSelectedImage(null)} className="gv-icon-btn is-danger cursor-pointer absolute top-6 right-6 z-50">
              <RiCloseLine size={22} />
            </button>

            <div
              className="gv-nav-zone absolute left-0 top-0 bottom-0 w-32 z-40 flex items-center justify-start pl-6 group cursor-pointer hover:bg-gradient-to-r hover:from-[#0D091280] hover:to-transparent"
              onClick={() => navigateImage(-1)}
            >
              <div className="gv-btn-3d p-3.5 text-[var(--ink-dim)] group-hover:text-[var(--purple-bright)] transform group-hover:-translate-x-1 transition-all">
                <RiArrowLeftSLine size={28} />
              </div>
            </div>

            <div
              className="gv-nav-zone absolute right-0 top-0 bottom-0 w-32 z-40 flex items-center justify-end pr-6 group cursor-pointer hover:bg-gradient-to-l hover:from-[#0D091280] hover:to-transparent"
              onClick={() => navigateImage(1)}
            >
              <div className="gv-btn-3d p-3.5 text-[var(--ink-dim)] group-hover:text-[var(--purple-bright)] transform group-hover:translate-x-1 transition-all">
                <RiArrowRightSLine size={28} />
              </div>
            </div>

            <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
              <div className="relative w-full max-w-7xl h-[75vh] flex items-center justify-center" style={{ perspective: '1200px' }}>
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                  {getType(selectedImage.filename) === 'video' ? (
                    <motion.video
                      key={selectedImage.filename}
                      src={selectedImage.url}
                      custom={direction}
                      variants={variants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ x: { type: 'spring', stiffness: 260, damping: 28 }, opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}
                      className="absolute max-w-full max-h-full rounded-2xl border border-[var(--line)]"
                      style={{ boxShadow: '0 30px 80px -20px rgba(168,85,247,0.28), 0 20px 60px -10px rgba(0,0,0,0.6)' }}
                      controls
                      autoPlay
                    />
                  ) : getType(selectedImage.filename) === 'image' ? (
                    <motion.img
                      key={selectedImage.filename}
                      src={selectedImage.url}
                      custom={direction}
                      variants={variants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{
                        x: { type: 'spring', stiffness: 260, damping: 28 },
                        rotateY: { type: 'spring', stiffness: 260, damping: 28 },
                        opacity: { duration: 0.2 },
                        scale: { duration: 0.2 }
                      }}
                      className="absolute max-w-full max-h-full rounded-2xl border border-[var(--line)] object-contain"
                      style={{ boxShadow: '0 30px 80px -20px rgba(168,85,247,0.28), 0 20px 60px -10px rgba(0,0,0,0.6)' }}
                    />
                  ) : (
                    <motion.div
                      key={selectedImage.filename}
                      custom={direction}
                      variants={variants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="absolute w-72 h-80 rounded-2xl border border-[var(--line)] flex flex-col items-center justify-center gap-4"
                      style={{ background: 'var(--panel)' }}
                    >
                      {(() => {
                        const meta = TYPE_META[getType(selectedImage.filename)]
                        return <meta.icon size={56} style={{ color: meta.color }} />
                      })()}
                      <p className="text-sm font-bold text-[var(--ink)] px-6 text-center capitalize">{selectedImage.displayName}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="absolute bottom-10 z-50 flex flex-col items-center gap-6">
                <div className="text-center px-5 py-3 rounded-xl border border-[var(--line)]" style={{ background: 'rgba(27,20,36,0.85)', backdropFilter: 'blur(8px)' }}>
                  <h3 className="text-lg font-bold text-[var(--ink)] mb-1 capitalize">{selectedImage.displayName}</h3>
                  <p className="text-xs text-[var(--ink-faint)] font-data">
                    {new Date(selectedImage.createdAt).toLocaleString()} · Generated by JARVIS
                  </p>
                </div>

                <div className="flex gap-3">
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => openLocation(selectedImage.path)} className="gv-lightbox-btn cursor-pointer">
                    <RiFolderOpenLine size={16} /> Open folder
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => saveCopy(selectedImage.path)} className="gv-lightbox-btn is-primary cursor-pointer">
                    <RiDownloadLine size={16} /> Save copy
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => deleteImage(selectedImage.filename)} className="gv-lightbox-btn is-danger cursor-pointer">
                    <RiDeleteBinLine size={16} /> Delete
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default GalleryView