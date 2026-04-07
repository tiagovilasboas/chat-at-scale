import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { authService } from '@/auth/services/auth'
import type { Session } from '@/shared/types'

export function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username || !password) return setError('Preencha todos os campos.')

    try {
      if (isRegistering) {
        await authService.register(username, password)
        setIsRegistering(false)
        setError('Conta criada. Faça o login.')
        setPassword('')
      } else {
        const data = await authService.login(username, password)
        onLogin({ token: data.token, userId: data.userId, username: data.username })
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-lg border p-8 shadow-sm">
        <h2 className="mb-6 text-2xl font-bold text-center">Chat at Scale</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          {error && <p className="text-sm font-semibold text-center text-destructive">{error}</p>}
          <Button type="submit" className="w-full">
            {isRegistering ? 'Criar conta' : 'Entrar'}
          </Button>
        </form>
        <div className="mt-4 text-center">
          <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="text-sm text-primary hover:underline">
            {isRegistering ? 'Já tenho conta' : 'Criar nova conta'}
          </button>
        </div>
      </div>
    </div>
  )
}
