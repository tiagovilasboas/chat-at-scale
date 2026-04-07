import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send } from 'lucide-react'

type Message = {
  id?: string
  sequence?: number
  sender?: string
  senderId?: string
  content: string
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [userId, setUserId] = useState<string>('')
  
  const ws = useRef<WebSocket | null>(null)
  const messagesRef = useRef(messages)
  
  // Track messages in ref for the scope of the socket onopen closure
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages])
  
  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080/ws')
    ws.current = socket

    socket.onopen = () => {
      setConnected(true)
      
      // Hydration sync requesting missed messages on reconnection
      const currentMsgs = messagesRef.current;
      const cursor = currentMsgs.reduce((max, msg) => Math.max(max, msg.sequence || 0), 0);
      socket.send(JSON.stringify({ type: 'sync', cursor }));
    }

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'connected') {
        setUserId(data.user)
      } else if (data.type === 'message') {
        setMessages((prev) => {
          // Prevent duplicates if network is messy
          if (data.id && prev.some(m => m.id === data.id)) return prev;
          return [...prev, data]
        })
      } else if (data.type === 'sync_result' && data.messages) {
        setMessages((prev) => {
          const received = data.messages.map((m: Message) => ({
            id: m.id,
            sequence: m.sequence,
            sender: m.senderId || m.sender,
            content: m.content
          }));
          
          const deduplicated = received.filter((newMsg: Message) => !prev.some(p => p.id === newMsg.id));
          const combined = [...prev, ...deduplicated].sort((a: Message, b: Message) => (a.sequence || 0) - (b.sequence || 0));
          return combined;
        });
      }
    }

    socket.onclose = () => setConnected(false)

    return () => socket.close()
  }, [])

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !ws.current) return
    ws.current.send(JSON.stringify({ type: 'message', content: input }))
    setInput('')
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto border-x bg-background">
      <header className="p-4 border-b flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-tight">Chat at Scale</h1>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium">{connected ? userId : 'Conectando/Sincronizando...'}</span>
        </div>
      </header>
      
      <main className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg, idx) => {
          // Normalizing sender fields between message output and sync output
          const senderName = msg.sender || msg.senderId
          const isMe = senderName === userId

          return (
            <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 max-w-[80%] rounded-lg ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <div className="flex justify-between items-baseline gap-4 mb-1 border-b border-background/20 pb-1 opacity-70">
                  <p className="text-xs font-semibold">{senderName}</p>
                  {msg.sequence && <span className="text-[10px]">Seq: {msg.sequence}</span>}
                </div>
                <p>{msg.content}</p>
              </div>
            </div>
          )
        })}
      </main>

      <footer className="p-4 border-t">
        <form onSubmit={sendMessage} className="flex gap-2">
          <Input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Digite sua mensagem (JSON será gerado implicitamente)..." 
            disabled={!connected}
            className="flex-1"
          />
          <Button type="submit" disabled={!connected}>
            <Send className="w-4 h-4 mr-2" />
            Enviar
          </Button>
        </form>
      </footer>
    </div>
  )
}
