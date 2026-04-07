// Side-effect manager for the WebSocket lifecycle.
// All state mutations go through the Zustand chatStore — this hook owns zero state.

import { useEffect, useRef } from 'react'
import { useChatStore } from '@/chat/store/chatStore'
import type { ServerPayload } from '@/shared/types'

// Rely on window.location to strictly use the Vite Dev Server Proxy (or production ingress)
// This guarantees that HttpOnly cookies are attached seamlessly by the browser.
export function useWebSocket() {
  const { messages, addMessage, mergeBackfill, setConnected } = useChatStore()
  const wsRef = useRef<WebSocket | null>(null)
  // Stable ref so the onopen closure always reads the latest cursor without re-creating the socket
  const messagesRef = useRef(messages)

  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    // Guard against React StrictMode double-mount: cleanup may fire while socket is still
    // CONNECTING (readyState=0). Without this flag the WS is closed before it ever opens.
    let shouldConnect = true

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${wsProtocol}//${window.location.host}/ws`)
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
  }, [addMessage, mergeBackfill, setConnected])

  const send = (content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', content }))
    }
  }

  return { send }
}
