import { useState } from 'react'
import { Chat } from './pages/Chat'
import { Login } from './pages/Login'

function App() {
  const [session, setSession] = useState<{ token: string, userId: string, username: string } | null>(() => {
    const savedToken = localStorage.getItem('chat_token')
    const savedUserId = localStorage.getItem('chat_userId')
    const savedName = localStorage.getItem('chat_username')
    return (savedToken && savedUserId && savedName) 
      ? { token: savedToken, userId: savedUserId, username: savedName } 
      : null
  })

  const handleLogin = (token: string, userId: string, username: string) => {
    localStorage.setItem('chat_token', token)
    localStorage.setItem('chat_userId', userId)
    localStorage.setItem('chat_username', username)
    setSession({ token, userId, username })
  }

  const handleLogout = () => {
    localStorage.clear()
    setSession(null)
  }

  return session ? <Chat session={session} onLogout={handleLogout} /> : <Login onLogin={handleLogin} />
}

export default App
