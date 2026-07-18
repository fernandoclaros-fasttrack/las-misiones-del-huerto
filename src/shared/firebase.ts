import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getAuth, type Auth } from 'firebase/auth'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** false hasta que se configuren las variables VITE_FIREBASE_* (ver .env.example). */
export const firebaseEnabled = Boolean(config.apiKey && config.projectId)

let app: FirebaseApp | undefined
let firestore: Firestore | undefined
let auth: Auth | undefined

if (firebaseEnabled) {
  app = initializeApp(config)
  firestore = getFirestore(app)
  auth = getAuth(app)
}

export { app, firestore, auth }

export const FAMILY_DOC_PATH = ['families', 'default'] as const
