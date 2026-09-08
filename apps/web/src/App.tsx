import { Chat } from '@/chat/pages/Chat'
import { Login } from '@/auth/pages/Login'
import { useAuthStore } from '@/auth/store/authStore'
import { authService } from '@/auth/services/auth'
import type { Session } from '@/shared/types'

function App() {
  const session = useAuthStore(s => s.session)
  const login = useAuthStore(s => s.login)
  const clearSession = useAuthStore(s => s.logout)

  const handleLogout = async (): Promise<void> => {
    try {
      await authService.logout()
    } catch {
      // Always drop local metadata. Cookie/DB revoke is best-effort if the API is down.
    } finally {
      clearSession()
    }
  }

  return session
    ? <Chat session={session} onLogout={handleLogout} />
    : <Login onLogin={(s: Session) => login(s)} />
}

export default App
