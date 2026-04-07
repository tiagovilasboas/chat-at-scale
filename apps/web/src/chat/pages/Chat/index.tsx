import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Send } from 'lucide-react'
import { useWebSocket } from '@/chat/hooks/useWebSocket'
import { useChatStore } from '@/chat/store/chatStore'
import type { Session, Message } from '@/shared/types'

export function Chat({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [input, setInput] = useState('')
  // State from Zustand — no prop drilling, globally accessible
  const messages = useChatStore(s => s.messages)
  const connected = useChatStore(s => s.connected)
  // Hook is now a pure side-effect dispatcher
  const { send } = useWebSocket(session)

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    send(input)
    setInput('')
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto border-x bg-background">
      <header className="p-4 border-b flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-tight">Chat at Scale</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium">{connected ? session.username : 'Conectando...'}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}>Sair</Button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg: Message, idx: number) => {
          const sender = msg.sender ?? msg.senderId
          const isMe = sender === session.userId
          return (
            <div key={msg.id ?? idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 max-w-[80%] rounded-lg ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <div className="flex justify-between items-baseline gap-4 mb-1 border-b border-background/20 pb-1 opacity-70">
                  <p className="text-xs font-semibold">{sender}</p>
                  {msg.sequence && <span className="text-[10px]">#{msg.sequence}</span>}
                </div>
                <p>{msg.content}</p>
              </div>
            </div>
          )
        })}
      </main>

      <footer className="p-4 border-t">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Mensagem..." disabled={!connected} className="flex-1" />
          <Button type="submit" disabled={!connected}>
            <Send className="w-4 h-4 mr-2" />
            Enviar
          </Button>
        </form>
      </footer>
    </div>
  )
}
