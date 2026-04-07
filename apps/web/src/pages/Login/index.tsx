import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function Login({ onLogin }: { onLogin: (token: string, userId: string, username: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!username || !password) {
      return setError('Preencha os campos rigidamente.')
    }

    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login'
    
    try {
      const res = await fetch(`http://localhost:8080${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Authentication failed via Server constraint')
      
      if (isRegistering) {
        setIsRegistering(false)
        setError('Conta formalizada. Execute o Login.')
        setPassword('')
      } else {
        onLogin(data.token, data.userId, data.username)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-lg border p-8 shadow-sm">
        <h2 className="mb-6 text-2xl font-bold text-center">Chat at Scale (Auth)</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
            placeholder="Secure Username" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
          />
          <Input 
            type="password"
            placeholder="Secure Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
          />
          {error && <p className="text-sm font-semibold text-center text-destructive">{error}</p>}
          <Button type="submit" className="w-full">
            {isRegistering ? 'Register Node' : 'Login Securely'}
          </Button>
        </form>
        <div className="mt-4 text-center">
          <button 
            type="button" 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-sm text-primary hover:underline"
          >
            {isRegistering ? 'Já possui chaves? Entrar' : 'Criar nova identidade'}
          </button>
        </div>
      </div>
    </div>
  )
}
