import { useEffect, useState } from 'react'
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { auth, firebaseEnabled } from './firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(!firebaseEnabled)

  useEffect(() => {
    if (!firebaseEnabled || !auth) return
    return onAuthStateChanged(auth, (u) => {
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
