import { useEffect, useState } from 'react'
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { auth, firebaseEnabled } from './firebase'

const AUTH_EMAIL = import.meta.env.VITE_AUTH_EMAIL as string
/** Solo para desarrollo local (ver .env.example): si está presente, se hace login automático
 *  contra el Firestore de producción real al arrancar, para poder verificar cambios en el
 *  navegador sin pedirle a Fernando que teclee la contraseña en cada sesión. Vive únicamente en
 *  `.env.local` (gitignored) y `import.meta.env.DEV` asegura que nunca se incluye en el build de
 *  producción que se despliega a GitHub Pages. */
const DEV_AUTH_PASSWORD = import.meta.env.DEV ? (import.meta.env.VITE_DEV_AUTH_PASSWORD as string | undefined) : undefined

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(!firebaseEnabled)

  useEffect(() => {
    if (!firebaseEnabled || !auth) return
    return onAuthStateChanged(auth, (u) => {
      if (!u && DEV_AUTH_PASSWORD) {
        // Si VITE_DEV_AUTH_PASSWORD es incorrecta esto falla y no vuelve a disparar
        // onAuthStateChanged — sin el catch, ready se quedaría en false para siempre y la app no
        // saldría nunca de "Cargando…". Al fallar, se cae a la pantalla de login normal.
        signInWithEmailAndPassword(auth, AUTH_EMAIL, DEV_AUTH_PASSWORD).catch(() => {
          setUser(null)
          setReady(true)
        })
        return
      }
      setUser(u)
      setReady(true)
    })
  }, [])

  async function login(email: string, password: string) {
    if (!auth) return
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    if (auth) await signOut(auth)
  }

  async function resetPassword(email: string) {
    if (auth) await sendPasswordResetEmail(auth, email)
  }

  return { ready, isAuthed: !firebaseEnabled || !!user, login, logout, resetPassword }
}
