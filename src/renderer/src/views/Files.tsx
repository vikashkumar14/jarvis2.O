import { useEffect, useMemo, useState } from 'react'
import {
  RiFolderLine,
  RiExternalLinkLine,
  RiArrowLeftSLine,
  RiHomeLine,
  RiFileLine
} from 'react-icons/ri'
import { getDrives } from '@renderer/services/system-info'
import { openFile, readDirectory } from '@renderer/functions/file-manager-api'

interface DirectoryItem {
  name: string
  path: string
  type: string
  info: string
  isDirectory: boolean
}

interface DirectoryResult {
  directory: string
  items_found: number
  content: DirectoryItem[]
}

const QUICK_FOLDERS = [
  { label: 'Home', value: 'home' },
  { label: 'Desktop', value: 'desktop' },
  { label: 'Documents', value: 'documents' },
  { label: 'Downloads', value: 'downloads' },
  { label: 'Pictures', value: 'pictures' },
  { label: 'Music', value: 'music' }
]

const getParentPath = (dir: string) => {
  const normalized = dir.replace(/\//g, '\\').replace(/\\+$/, '')
  if (/^[a-zA-Z]:$/.test(normalized)) {
    return `${normalized}\\`
  }

  const lastSlash = normalized.lastIndexOf('\\')
  if (lastSlash === -1) return normalized
  const parent = normalized.substring(0, lastSlash)
  if (/^[a-zA-Z]:$/.test(parent)) {
    return `${parent}\\`
  }
  return parent || normalized
}

const FilesView = () => {
  const [drives, setDrives] = useState<any[]>([])
  const [directoryResult, setDirectoryResult] = useState<DirectoryResult | null>(null)
  const [currentPath, setCurrentPath] = useState('home')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const driveResult = await getDrives()
      setDrives(Array.isArray(driveResult) ? driveResult : [])
      setLoading(false)
    }
    load()
    loadDirectory('home')
  }, [])

  const loadDirectory = async (targetPath: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await readDirectory(targetPath)
      if (!result || typeof result === 'string') {
        setDirectoryResult(null)
        setError(typeof result === 'string' ? result : 'Unable to read directory.')
      } else {
        setDirectoryResult(result)
        setCurrentPath(result.directory)
      }
    } catch (err) {
      setDirectoryResult(null)
      setError('Unable to read directory.')
    } finally {
      setLoading(false)
    }
  }

  const openEntry = async (item: DirectoryItem) => {
    if (item.isDirectory) {
      loadDirectory(item.path)
      return
    }

    const result = await openFile(item.path)
    if (typeof result === 'string' && result.toLowerCase().includes('error')) {
      setError(result)
    }
  }

  const openCurrentFolder = async () => {
    if (!directoryResult) return
    await openFile(directoryResult.directory)
  }

  const goUp = () => {
    if (!directoryResult) return
    const parent = getParentPath(directoryResult.directory)
    if (parent && parent !== directoryResult.directory) {
      loadDirectory(parent)
    }
  }

  const breadcrumb = useMemo(() => {
    if (!directoryResult) return []
    return directoryResult.directory.split(/\\|\//).filter(Boolean)
  }, [directoryResult])

  return (
    <div className="flex-1 h-full bg-[#07080A] p-8 overflow-auto animate-in fade-in duration-300">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 h-full">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-300">
            <RiFolderLine size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Files & Folders</h1>
            <p className="text-sm text-zinc-400">Browse your local filesystem, open folders, and navigate real directories.</p>
          </div>
        </div>

        <div className="grid gap-3 mb-6 md:grid-cols-3">
          {QUICK_FOLDERS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => loadDirectory(entry.value)}
              className="rounded-3xl border border-white/10 bg-[#0D1015] p-4 text-left text-sm text-zinc-200 hover:border-emerald-500/30 hover:bg-[#11151A] transition"
            >
              <div className="flex items-center gap-2 mb-2 text-emerald-300">
                <RiHomeLine size={16} />
                <span>{entry.label}</span>
              </div>
              <span className="text-[11px] text-zinc-500">Open folder</span>
            </button>
          ))}
        </div>

        {drives.length > 0 && (
          <div className="grid gap-3 mb-6 md:grid-cols-3">
            {drives.map((drive) => {
              const label = drive.Name ? `${drive.Name}:\\` : 'Drive'
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => loadDirectory(drive.Name ? `${drive.Name}:` : 'home')}
                  className="rounded-3xl border border-white/10 bg-[#0D1015] p-4 text-left text-sm text-zinc-200 hover:border-cyan-500/30 hover:bg-[#11151A] transition"
                >
                  <div className="text-white font-semibold">{label}</div>
                  <div className="text-[11px] text-zinc-500">
                    {drive.FreeGB != null ? `${drive.FreeGB} GB free` : 'Drive info unavailable'}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div className="mb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Current folder</div>
              <div className="text-sm font-semibold text-white break-all">{directoryResult?.directory || currentPath}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={goUp}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/10"
              >
                <RiArrowLeftSLine size={16} /> Up
              </button>
              <button
                type="button"
                onClick={openCurrentFolder}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/15"
              >
                Open in Explorer <RiExternalLinkLine size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
            {breadcrumb.map((segment, index) => (
              <span key={`${segment}-${index}`} className="inline-flex items-center gap-2">
                <span>{segment}</span>
                {index < breadcrumb.length - 1 && <span className="text-zinc-600">/</span>}
              </span>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4 mb-6 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-4">
          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-[#0D1015] p-6 text-zinc-400">Loading directory contents...</div>
          ) : directoryResult?.content.length ? (
            directoryResult.content.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => openEntry(item)}
                className="w-full rounded-3xl border border-white/10 bg-[#0D1015] p-5 text-left flex items-center justify-between gap-4 hover:border-emerald-500/30 transition"
              >
                <div>
                  <div className="flex items-center gap-2 text-white">
                    {item.isDirectory ? <RiFolderLine size={18} /> : <RiFileLine size={18} />}
                    <span className="font-semibold truncate">{item.name}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">{item.info}</div>
                </div>
                <div className="text-zinc-400 text-xs">{item.isDirectory ? 'Folder' : 'Open'}</div>
              </button>
            ))
          ) : (
            <div className="rounded-3xl border border-white/10 bg-[#0D1015] p-6 text-zinc-400">This directory is empty or could not be read.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FilesView
