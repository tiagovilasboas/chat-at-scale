// Side-effect manager for the WebSocket lifecycle.
// All state mutations go through the Zustand chatStore — this hook owns zero state.

import { useEffect, useRef } from 'react'
import { useChatStore } from '@/chat/store/chatStore'
import type { Session, ServerPayload } from '@/shared/types'

const WS_URL = 'ws://localhost:8080'

export function useWebSocket(session: Session) {
  const { messages, addMessage, mergeBackfill, setConnected } = useChatStore()
  const wsRef = useRef<WebSocket | null>(null)
  // Stable ref so the onopen closure always reads the latest cursor without re-creating the socket
  const messagesRef = useRef(messages)

  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    // Guard against React StrictMode double-mount: cleanup may fire while socket is still
    // CONNECTING (readyState=0). Without this flag the WS is closed before it ever opens.
    let shouldConnect = true

    const socket = new WebSocket(`${WS_URL}/ws?token=${session.token}`)
    wsRef.current = socket

    socket.onopen = () => {
      if (!shouldConnect) return
      setConnected(true)
      const cursor = messagesRef.current.reduce((max, m) => Math.max(max, m.sequence ?? 0), 0)
      socket.send(JSON.stringify({ type: 'sync', cursor }))
    }

    socket.onmessage = (event: MessageEvent) => {
      if (!shouldConnect) return
      const data = JSON.parse(event.data as string) as ServerPayload
      if (data.type === 'message') addMessage(data)
      else if (data.type === 'sync_result') mergeBackfill(data.messages)
    }

    socket.onclose = () => { if (shouldConnect) setConnected(false) }

    return () => {
      shouldConnect = false
      // Null out handlers to prevent stale callbacks from the first mount firing
      socket.onopen = null
      socket.onmessage = null
      socket.onclose = null
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close()
      }
    }
  }, [session.token, addMessage, mergeBackfill, setConnected])

  const send = (content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', content }))
    }
  }

  return { send }
}
