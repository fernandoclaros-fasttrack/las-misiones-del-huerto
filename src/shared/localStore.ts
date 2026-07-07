import type { FamilyData } from './types'
import { seedFamilyData } from './constants'

/**
 * Fallback usado en desarrollo cuando no hay configuración de Firebase (ver .env.example).
 * Persiste en localStorage y se sincroniza entre pestañas para poder previsualizar
 * la pantalla de hijos y la de padres a la vez sin necesitar un proyecto Firebase real.
 * No se usa en producción: allí siempre hay que configurar Firestore.
 */
const STORAGE_KEY = 'misiones-del-huerto:dev-data'

function loadInitial(): FamilyData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as FamilyData
  } catch {
    // ignore corrupt storage and reseed
  }
  return seedFamilyData()
}

class LocalStore {
  private data: FamilyData
  private listeners = new Set<(data: FamilyData) => void>()

  constructor() {
    this.data = loadInitial()
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      this.data = JSON.parse(e.newValue) as FamilyData
      this.listeners.forEach((l) => l(this.data))
    })
  }

  subscribe(cb: (data: FamilyData) => void): () => void {
    this.listeners.add(cb)
    cb(this.data)
    return () => this.listeners.delete(cb)
  }

  get(): FamilyData {
    return this.data
  }

  set(patch: Partial<FamilyData>): void {
    this.data = { ...this.data, ...patch }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data))
    this.listeners.forEach((l) => l(this.data))
  }
}

export const localStore = new LocalStore()
