import { useState, useRef, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Send } from 'lucide-react'
import { useWebSocket } from '@/chat/hooks/useWebSocket'
import { useChatStore } from '@/chat/store/chatStore'
import type { Session, Message } from '@/shared/types'

// Deterministic color from username for avatar backgrounds
function avatarColor(name: string) {
  const colors = [
    'oklch(0.65 0.22 264)',  // indigo
    'oklch(0.65 0.22 300)',  // violet
    'oklch(0.65 0.22 200)',  // cyan
    'oklch(0.65 0.22 160)',  // emerald
    'oklch(0.65 0.22 30)',   // amber
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-bold select-none"
         style={{ background: avatarColor(name ?? 'U') }}>
      {(name ?? 'U')[0].toUpperCase()}
    </div>
  )
}

function formatTime(date?: Date) {
  return (date ?? new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function Chat({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const messages = useChatStore(s => s.messages)
  const connected = useChatStore(s => s.connected)
  const { send } = useWebSocket()

  // Auto-scroll to bottom on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !connected) return
    send(input)
    setInput('')
  }

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto border-x" style={{ borderColor: 'var(--border)' }}>

      {/* Header */}
      <header className="px-5 py-3 flex items-center justify-between border-b shrink-0"
              style={{ background: 'oklch(0.14 0.01 264 / 80%)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
               style={{ background: 'linear-gradient(135deg, oklch(0.65 0.22 264), oklch(0.60 0.22 300))' }}>
            C
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-none">Chat at Scale</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}># general</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full transition-colors ${connected ? 'bg-emerald-400' : 'bg-red-400'}`}
                 style={{ boxShadow: connected ? '0 0 6px oklch(0.75 0.2 145)' : '0 0 6px oklch(0.62 0.22 24)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              {session.username}
            </span>
            {!connected && <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>(offline)</span>}
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout} className="text-xs h-7 px-2"
                  style={{ color: 'var(--muted-foreground)' }}>
            Sign out
          </Button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-5 space-y-4 scroll-smooth"
            style={{ background: 'var(--background)' }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                 style={{ background: 'var(--muted)' }}>💬</div>
            <p className="text-sm font-medium">No messages yet — say hello!</p>
          </div>
        )}

        {messages.map((msg: Message, idx: number) => {
          const senderName = msg.sender ?? msg.senderId ?? 'Unknown'
          const isMe = (msg.sender ?? msg.senderId) === session.userId
          const prevSender = idx > 0 ? (messages[idx - 1].sender ?? messages[idx - 1].senderId) : null
          const grouped = prevSender === (msg.sender ?? msg.senderId)

          return (
            <div key={msg.id ?? idx} className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''} ${grouped ? 'mt-1' : 'mt-4'}`}>
              {!grouped
                ? <Avatar name={senderName} />
                : <div className="w-8 shrink-0" />}

              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[72%]`}>
                {!grouped && (
                  <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs font-semibold">{isMe ? 'You' : senderName}</span>
                    <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{formatTime()}</span>
                    {msg.sequence && <span className="text-[10px] opacity-40">#{msg.sequence}</span>}
                  </div>
                )}
                <div className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                     style={{
                       background: isMe
                         ? 'linear-gradient(135deg, oklch(0.65 0.22 264), oklch(0.60 0.22 300))'
                         : 'var(--muted)',
                       color: isMe ? 'white' : 'var(--foreground)',
                       borderRadius: isMe
                         ? '1rem 0.25rem 1rem 1rem'
                         : '0.25rem 1rem 1rem 1rem',
                     }}>
                  {msg.content}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <footer className="px-4 py-3 border-t shrink-0"
              style={{ background: 'oklch(0.14 0.01 264 / 80%)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}>
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={connected ? `Message #general…` : 'Connecting…'}
            disabled={!connected}
            className="flex-1 rounded-xl border-0 text-sm"
            style={{ background: 'var(--muted)' }}
          />
          <Button
            type="submit"
            disabled={!connected || !input.trim()}
            className="rounded-xl w-9 h-9 p-0 shrink-0"
            style={{ background: 'linear-gradient(135deg, oklch(0.65 0.22 264), oklch(0.60 0.22 300))' }}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </footer>
    </div>
  )
}
