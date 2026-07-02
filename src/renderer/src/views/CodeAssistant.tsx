import { useState } from 'react'
import { RiCodeSLine, RiLightbulbLine, RiSendPlaneLine, RiFileCopyLine } from 'react-icons/ri'
import { buildAnimatedWebsite } from '@renderer/code/website-builder-api'

const CodeAssistantView = () => {
  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleBuild = async () => {
    const trimmed = prompt.trim()
    if (!trimmed) {
      setStatus('Please enter a website prompt before building.')
      return
    }

    setIsLoading(true)
    setCopyMessage('')
    setStatus('Synthesizing website... Please wait.')
    const result = await buildAnimatedWebsite(trimmed)
    setStatus(result)
    setIsLoading(false)
  }

  const handleCopyStatus = async () => {
    if (!status) return
    try {
      if (window.electron?.ipcRenderer?.invoke) {
        const result = await window.electron.ipcRenderer.invoke('copy-text-to-clipboard', status)
        if (result?.success) {
          setCopyMessage('Status copied to clipboard.')
        } else {
          setCopyMessage(`Unable to copy status: ${result?.error || 'unknown error'}`)
        }
      } else {
        await navigator.clipboard.writeText(status)
        setCopyMessage('Status copied to clipboard.')
      }
    } catch (error) {
      setCopyMessage('Unable to copy status.')
    }
    setTimeout(() => setCopyMessage(''), 3000)
  }

  return (
    <div className="flex-1 h-full bg-[#07080A] p-8 overflow-auto animate-in fade-in duration-300">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 h-full">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-300">
            <RiCodeSLine size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Website Builder</h1>
            <p className="text-sm text-zinc-400">Enter a prompt and JARVIS will build a website using the Live Forge backend.</p>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-3xl border border-white/10 bg-[#0D1015] p-6">
            <label className="block text-sm font-semibold text-zinc-300 mb-2">Website prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the website you want JARVIS to create..."
              rows={8}
              className="w-full resize-none rounded-3xl border border-[#2F3342] bg-[#080A10] px-4 py-4 text-sm text-white outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"
            />
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 mb-2">Live Forge</p>
              <p className="text-sm text-zinc-400 max-w-xl">
                When you click Build Website, JARVIS will invoke the website builder backend and open a live preview window while generating the page.
              </p>
            </div>
            <button
              type="button"
              onClick={handleBuild}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-3xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RiSendPlaneLine size={16} />
              {isLoading ? 'Building...' : 'Build Website'}
            </button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0B0C11] p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Status</p>
              <button
                type="button"
                onClick={handleCopyStatus}
                disabled={!status}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-zinc-300 transition hover:border-violet-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RiFileCopyLine size={14} /> Copy
              </button>
            </div>
            <p className="text-sm text-zinc-300 whitespace-pre-line min-h-[80px]">{status || 'Ready to generate your website.'}</p>
            {copyMessage ? <p className="mt-3 text-[11px] text-emerald-300">{copyMessage}</p> : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0D1015] p-5">
            <div className="flex items-center gap-3 mb-3">
              <RiLightbulbLine size={18} className="text-violet-300" />
              <span className="text-sm text-zinc-400">Tips</span>
            </div>
            <ul className="list-disc list-inside text-sm text-zinc-500 gap-2 flex flex-col">
              <li>Use a clear visual direction like “futuristic AI landing page”.</li>
              <li>Add details such as color theme, section count, and CTA style.</li>
              <li>If the API key is missing, update it in the command center settings.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CodeAssistantView
