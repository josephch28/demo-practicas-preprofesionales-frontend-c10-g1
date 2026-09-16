import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'no se pudo iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center gap-2.5">
          <span aria-hidden="true" className="block size-[22px] rounded-md bg-stamp" />
          <span className="font-display text-17 font-bold tracking-[-0.02em] text-ink">
            prácticas.
          </span>
        </div>

        <div className="rounded-2xl bg-surface px-7 py-7">
          <h1 className="font-display text-26 font-bold tracking-[-0.02em] text-ink">
            Entrá a tu cuenta
          </h1>
          <p className="mt-1 text-14 text-inkMid">
            Con el correo institucional que te dio la unidad de vinculación.
          </p>

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Correo institucional</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? (
              <p role="alert" className="rounded-md bg-chipVoid px-3 py-2.5 text-13 text-void">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
