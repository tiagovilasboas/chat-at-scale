// Shared domain types — single source of truth for the entire frontend

export type Session = {
  token: string
  userId: string
  username: string
}

export type Message = {
  id?: string
  sequence?: number
  sender?: string
  senderId?: string
  content: string
}

export type ServerPayload =
  | { type: 'connected'; user: string }
  | { type: 'message'; id: string; sequence: number; senderId: string; content: string }
  | { type: 'sync_result'; messages: Message[] }
