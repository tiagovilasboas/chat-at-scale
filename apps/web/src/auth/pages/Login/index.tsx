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
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username || !password) return setError('Please fill in all fields.')

    setLoading(true)
    try {
      if (isRegistering) {
        await authService.register(username, password)
        setIsRegistering(false)
        setError('Account created — sign in to continue.')
        setPassword('')
      } else {
        const data = await authService.login(username, password)
        onLogin({ token: data.token, userId: data.userId, username: data.username })
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
         style={{ background: 'radial-gradient(ellipse 80% 80% at 50% -20%, oklch(0.3 0.15 264 / 40%), transparent)' }}>

      {/* Ambient glow blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
             style={{ background: 'oklch(0.65 0.22 264)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-10 blur-3xl"
             style={{ background: 'oklch(0.65 0.22 300)' }} />
      </div>

      <div className="relative w-full max-w-sm mx-4">
        {/* Card */}
        <div className="rounded-2xl border p-8 shadow-2xl shadow-black/40 backdrop-blur-sm"
             style={{ background: 'oklch(0.15 0.012 264 / 90%)' }}>

          {/* Logo mark */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg"
                 style={{ background: 'linear-gradient(135deg, oklch(0.65 0.22 264), oklch(0.60 0.22 300))' }}>
              C
            </div>
          </div>

          <h1 className="text-xl font-semibold text-center mb-1">
            {isRegistering ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-sm text-center mb-6" style={{ color: 'var(--muted-foreground)' }}>
            {isRegistering ? 'Join Chat at Scale' : 'Sign in to Chat at Scale'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              disabled={loading}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              disabled={loading}
            />

            {error && (
              <p className="text-xs text-center py-2 px-3 rounded-lg"
                 style={{
                   color: error.includes('created') ? 'oklch(0.75 0.18 145)' : 'var(--destructive)',
                   background: error.includes('created') ? 'oklch(0.75 0.18 145 / 10%)' : 'oklch(0.62 0.22 24 / 10%)',
                 }}>
                {error}
              </p>
            )}

            <Button type="submit" className="w-full font-semibold" disabled={loading}
                    style={{ background: 'linear-gradient(135deg, oklch(0.65 0.22 264), oklch(0.60 0.22 300))' }}>
              {loading ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => { setIsRegistering(!isRegistering); setError('') }}
              className="text-xs transition-colors hover:underline"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {isRegistering ? 'Already have an account? Sign in →' : "Don't have an account? Sign up →"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--muted-foreground)' }}>
          Chat at Scale — Real-time messaging at its finest
        </p>
      </div>
    </div>
  )
}
