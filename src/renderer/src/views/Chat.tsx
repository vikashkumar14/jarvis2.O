import { useState, useEffect, useRef, useCallback } from 'react'
import { getStoredApiKey } from '../utils/api-key-storage'
import {
  RiChat3Line,
  RiSendPlaneFill,
  RiMicLine,
  RiMicOffLine,
  RiFileCopyLine,
  RiCheckLine,
  RiRobot2Line,
  RiUser3Line,
} from 'react-icons/ri'

// ── Types ──────────────────────────────────────────────────────────────────────
type Role = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: Role
  content: string
  timestamp: number
  isStreaming?: boolean
}

interface ContentSegment {
  type: 'text' | 'code'
  content: string
  lang?: string
}

// ── Parse ```lang\ncode\n``` fences out of a message so code can render inline ──
const parseSegments = (raw: string): ContentSegment[] => {
  const segments: ContentSegment[] = []
  const fenceRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = fenceRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: raw.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'code', content: match[2].replace(/\n$/, ''), lang: match[1] || 'text' })
    lastIndex = fenceRegex.lastIndex
  }
  if (lastIndex < raw.length) {
    segments.push({ type: 'text', content: raw.slice(lastIndex) })
  }
  return segments.length ? segments : [{ type: 'text', content: raw }]
}

// ── Inline code block with copy button ────────────────────────────────────────
const CodeBlock = ({ content, lang }: { content: string; lang?: string }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable, ignore */
    }
  }

  return (
    <div className="my-2 rounded-xl overflow-hidden border border-white/10 bg-[#0B0D12]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border-b border-white/10">
        <span className="text-[10px] font-mono tracking-wide text-emerald-300/70 uppercase">{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 hover:text-emerald-300 transition-colors cursor-pointer"
        >
          {copied ? <RiCheckLine size={12} /> : <RiFileCopyLine size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[12.5px] leading-relaxed font-mono text-zinc-200">
        <code>{content}</code>
      </pre>
    </div>
  )
}

// ── One chat bubble ────────────────────────────────────────────────────────────
const Bubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === 'user'
  const segments = parseSegments(message.content)

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-white/10 text-zinc-300' : 'bg-emerald-500/10 text-emerald-300'
        }`}
      >
        {isUser ? <RiUser3Line size={16} /> : <RiRobot2Line size={16} />}
      </div>
      <div className={`flex flex-col max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-white/10 border border-white/10 text-zinc-100 rounded-tr-sm'
              : 'bg-[#0F1218] border border-white/10 text-zinc-200 rounded-tl-sm'
          }`}
        >
          {segments.map((seg, i) =>
            seg.type === 'code' ? (
              <CodeBlock key={i} content={seg.content} lang={seg.lang} />
            ) : (
              seg.content.trim() && (
                <p key={i} className="whitespace-pre-wrap">
                  {seg.content.trim()}
                </p>
              )
            )
          )}
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-3.5 bg-emerald-300 ml-0.5 align-middle animate-pulse" />
          )}
        </div>
        <span className="text-[10px] text-zinc-600 mt-1 px-1 font-mono">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

// ── Main chat view ─────────────────────────────────────────────────────────────
const ChatView = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const streamingIdRef = useRef<string | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send a message to JARVIS and stream the reply into the chat ──
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isSending) return

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    }
    const assistantId = `a-${Date.now()}`
    streamingIdRef.current = assistantId

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true },
    ])
    setInput('')
    setIsSending(true)

    const apiKey = getStoredApiKey('gemini')

    // Allow sending even when no API key is configured so a local fallback
    // handler (registered in the main process) can respond. The handler may
    // choose to require a key or act as an echo fallback.

    try {
      const result = await window.electron.ipcRenderer.invoke('send-chat-message', {
        message: trimmed,
        apiKey,
      })
      if (!result?.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: result?.error || '⚠ Something went wrong reaching JARVIS.', isStreaming: false }
              : m
          )
        )
      } else {
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m)))
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: '⚠ Connection to JARVIS failed.', isStreaming: false } : m
        )
      )
    } finally {
      setIsSending(false)
      streamingIdRef.current = null
    }
  }, [isSending])

  // ── Listen for streamed reply chunks from the main process ──
  useEffect(() => {
    const handleChunk = (_e: any, chunkText: string) => {
      const id = streamingIdRef.current
      if (!id) return
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: m.content + chunkText } : m)))
    }
    window.electron.ipcRenderer.on('chat-message-chunk', handleChunk)
    return () => window.electron.ipcRenderer.removeAllListeners('chat-message-chunk')
  }, [])

  // ── Allow the dashboard / voice command bar to route messages in here ──
  useEffect(() => {
    const handleExternalMessage = (e: any) => {
      const { prompt } = e.detail || {}
      if (prompt) sendMessage(prompt)
    }
    window.addEventListener('ai-chat-message', handleExternalMessage)
    return () => window.removeEventListener('ai-chat-message', handleExternalMessage)
  }, [sendMessage])

  // ── Voice input via browser speech recognition ──
  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('')
      setInput(transcript)
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex-1 bg-[#090A0D] p-8 h-full overflow-hidden animate-in fade-in duration-300">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 h-full flex flex-col">
        <div className="flex items-center gap-3 mb-6 flex-shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-300">
            <RiChat3Line size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Chat Assistant</h1>
            <p className="text-sm text-zinc-400">Use voice or text to continue conversations with JARVIS.</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0F1218] flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Message list */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center">
                <p className="text-sm leading-relaxed text-zinc-400 max-w-sm">
                  This workspace is reserved for your chat session. Speak to JARVIS or type below — JARVIS can
                  write code right here in the chat, no separate editor needed.
                </p>
              </div>
            ) : (
              messages.map((m) => <Bubble key={m.id} message={m} />)
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="border-t border-white/10 p-4 flex-shrink-0">
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 focus-within:border-emerald-400/40 transition-colors">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message JARVIS..."
                rows={1}
                disabled={isSending}
                className="flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none py-1.5 max-h-32 disabled:opacity-50"
              />
              <button
                onClick={toggleMic}
                title={isListening ? 'Stop listening' : 'Speak to JARVIS'}
                className={`w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors cursor-pointer ${
                  isListening
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-white/5 text-zinc-400 hover:text-emerald-300 hover:bg-white/10'
                }`}
              >
                {isListening ? <RiMicOffLine size={17} /> : <RiMicLine size={17} />}
              </button>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isSending}
                title="Send"
                className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <RiSendPlaneFill size={15} />
              </button>
            </div>
            {isListening && (
              <p className="text-[10px] text-rose-300/70 font-mono mt-2 px-1 animate-pulse">● listening…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatView