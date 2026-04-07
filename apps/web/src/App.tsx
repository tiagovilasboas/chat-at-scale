import { Chat } from '@/chat/pages/Chat'
import { Login } from '@/auth/pages/Login'
import { useAuthStore } from '@/auth/store/authStore'
import type { Session } from '@/shared/types'

function App() {
  const session = useAuthStore(s => s.session)
  const login = useAuthStore(s => s.login)
  const logout = useAuthStore(s => s.logout)

  return session
    ? <Chat session={session} onLogout={logout} />
    : <Login onLogin={(s: Session) => login(s)} />
}

export default App
