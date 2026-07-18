import { useState, type CSSProperties, type FormEvent } from 'react'

interface Props {
  accent: string
  background: string
  email: string
  onLogin: (email: string, password: string) => Promise<void>
  onForgotPassword: (email: string) => Promise<void>
}

const INPUT_STYLE: CSSProperties = {
  padding: '13px 14px',
  borderRadius: 12,
  border: '1px solid #E0D6C2',
  fontSize: 15,
  fontWeight: 700,
  fontFamily: "'Nunito', sans-serif",
}

export function LoginScreen({ accent, background, email, onLogin, onForgotPassword }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetMsg, setResetMsg] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setResetMsg('')
    setBusy(true)
    try {
      await onLogin(email, password)
    } catch {
      setError('Contraseña incorrecta.')
    } finally {
      setBusy(false)
    }
  }

  async function handleForgot() {
    setError('')
    setResetMsg('')
    setBusy(true)
    try {
      await onForgotPassword(email)
      setResetMsg('Te hemos enviado un enlace por email para fijar una nueva contraseña.')
    } catch {
      setResetMsg('No se ha podido enviar el enlace. Inténtalo de nuevo más tarde.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        fontFamily: "'Nunito', system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ fontSize: 40 }}>🌿</div>
      <div style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 20, color: '#3A3228' }}>Las misiones del huerto</div>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          autoFocus
          style={INPUT_STYLE}
        />

        {error && <div style={{ color: '#A04A32', fontWeight: 700, fontSize: 13 }}>{error}</div>}

        <button
          type="submit"
          disabled={busy}
          style={{
            padding: 13,
            borderRadius: 14,
            border: 'none',
            background: accent,
            color: '#F6F1E2',
            fontWeight: 800,
            fontSize: 15,
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          Entrar
        </button>

        <button
          type="button"
          onClick={handleForgot}
          disabled={busy}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6E6045',
            fontWeight: 700,
            fontSize: 12.5,
            cursor: busy ? 'default' : 'pointer',
            textDecoration: 'underline',
            padding: 4,
          }}
        >
          ¿Olvidaste la contraseña?
        </button>

        {resetMsg && <div style={{ fontSize: 12.5, color: '#3F6B26', fontWeight: 700, textAlign: 'center' }}>{resetMsg}</div>}
      </form>
    </div>
  )
}
