import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where, type Timestamp } from 'firebase/firestore'
import { firebaseEnabled, firestore } from './firebase'
import { todayISODate } from './constants'
import type { FamilyData } from './types'

/** Copias automáticas en la nube (MOO2-103).
 *
 *  Viven en su propia colección, `backups`, fuera del documento de la familia: el documento ronda
 *  los 70 KB y Firestore corta en 1 MB, así que acumularlas dentro no cabría, y una copia que vive
 *  en el mismo documento que protege se pierde con él. Cada copia es un documento que no se
 *  reescribe nunca — las reglas (`firestore.rules`) solo dejan crearlas, leerlas y borrarlas, y el
 *  único que borra es la poda de aquí abajo.
 *
 *  Todo lo de este módulo es "mejor esfuerzo" hacia fuera: la copia diaria falla en silencio (a
 *  consola), y la de antes de una acción destructiva devuelve `false` para que la pantalla pregunte
 *  si seguir sin copia. Nunca lanza hacia la acción que protege. */

/** Por qué se hizo la copia. `daily` tiene su propio cupo; las otras tres comparten el de "antes de
 *  una acción destructiva", para que una ráfaga de reseteos no se lleve por delante el histórico
 *  diario (AC del ticket). */
export type BackupKind = 'daily' | 'reset' | 'removeChild' | 'restore'

const ACTION_KINDS: BackupKind[] = ['reset', 'removeChild', 'restore']

/** Copias que se conservan por cupo. */
export const BACKUPS_PER_QUOTA = 5

/** Misma marca que la descarga local (`padres/backup.ts`): una copia de la nube y un fichero son la
 *  misma cosa en dos sitios, y MOO2-104 las restaurará por el mismo camino. */
const BACKUP_APP_ID = 'las-misiones-del-huerto'

const COLLECTION = 'backups'

/** Lo que se guarda. `takenAt` lo pone el servidor (y las reglas exigen que sea la hora del
 *  servidor), para que el orden de las copias no dependa del reloj de la tablet. `dataHash` es lo
 *  que permite saltarse la copia diaria cuando nada ha cambiado sin tener que comparar documentos
 *  enteros. */
interface StoredBackup {
  app: string
  kind: BackupKind
  description: string
  dataHash: string
  data: FamilyData
}

interface BackupMeta {
  id: string
  kind: BackupKind
  takenAtMs: number
  dataHash: string
}

/** Serialización con las claves ordenadas. Firestore no conserva el orden de las claves de un
 *  mapa, así que el mismo documento leído dos veces puede dar dos `JSON.stringify` distintos; sin
 *  ordenar, la copia diaria se haría todos los días aunque no hubiera cambiado nada. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

async function hashData(data: FamilyData): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(data))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Dónde viven las copias. En producción, Firestore; sin Firebase configurado (desarrollo, ver
 *  `localStore.ts`), localStorage — el mismo criterio que el documento de la familia, para poder
 *  probar la poda y el aviso de fallo sin tocar datos reales. */
interface BackupStore {
  /** Crea la copia con ese id. Falla si ya existe: una copia no se reescribe. */
  create(id: string, backup: StoredBackup): Promise<void>
  exists(id: string): Promise<boolean>
  latest(): Promise<BackupMeta | null>
  listKinds(kinds: BackupKind[]): Promise<BackupMeta[]>
  remove(id: string): Promise<void>
}

const firestoreStore: BackupStore = {
  async create(id, backup) {
    if (!firestore) throw new Error('Firestore no está configurado')
    // `setDoc` sobre un id que ya existe es una actualización, y las reglas no dejan actualizar:
    // así es como "a lo sumo una copia diaria por día" se cumple aunque dos dispositivos arranquen
    // a la vez.
    await setDoc(doc(firestore, COLLECTION, id), { ...backup, takenAt: serverTimestamp() })
  },
  async exists(id) {
    if (!firestore) return false
    return (await getDoc(doc(firestore, COLLECTION, id))).exists()
  },
  async latest() {
    if (!firestore) return null
    const snap = await getDocs(query(collection(firestore, COLLECTION), orderBy('takenAt', 'desc'), limit(1)))
    return snap.docs[0] ? toMeta(snap.docs[0].id, snap.docs[0].data()) : null
  },
  async listKinds(kinds) {
    if (!firestore) return []
    // Filtro de igualdad sin `orderBy`: así basta con los índices que Firestore crea solo y no hay
    // que desplegar un índice compuesto. Son como mucho seis documentos; se ordenan aquí.
    const snap = await getDocs(query(collection(firestore, COLLECTION), where('kind', 'in', kinds)))
    return snap.docs.map((d) => toMeta(d.id, d.data()))
  },
  async remove(id) {
    if (!firestore) return
    await deleteDoc(doc(firestore, COLLECTION, id))
  },
}

function toMeta(id: string, raw: Record<string, unknown>): BackupMeta {
  const takenAt = raw.takenAt as Timestamp | null | undefined
  return {
    id,
    kind: raw.kind as BackupKind,
    // Una escritura con `serverTimestamp()` aún pendiente se lee como `null`; se trata como "ahora"
    // para que la copia recién hecha nunca sea la primera en podarse.
    takenAtMs: takenAt ? takenAt.toMillis() : Date.now(),
    dataHash: String(raw.dataHash ?? ''),
  }
}

const LOCAL_KEY = 'misiones-del-huerto:dev-backups'
type LocalRecord = StoredBackup & { id: string; takenAtMs: number }

function readLocal(): LocalRecord[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as LocalRecord[]
  } catch {
    return []
  }
}

const localBackupStore: BackupStore = {
  async create(id, backup) {
    const all = readLocal()
    if (all.some((b) => b.id === id)) throw new Error(`La copia ${id} ya existe`)
    localStorage.setItem(LOCAL_KEY, JSON.stringify([...all, { ...backup, id, takenAtMs: Date.now() }]))
  },
  async exists(id) {
    return readLocal().some((b) => b.id === id)
  },
  async latest() {
    const newest = readLocal().sort((a, b) => b.takenAtMs - a.takenAtMs)[0]
    return newest ? { id: newest.id, kind: newest.kind, takenAtMs: newest.takenAtMs, dataHash: newest.dataHash } : null
  },
  async listKinds(kinds) {
    return readLocal()
      .filter((b) => kinds.includes(b.kind))
      .map((b) => ({ id: b.id, kind: b.kind, takenAtMs: b.takenAtMs, dataHash: b.dataHash }))
  },
  async remove(id) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(readLocal().filter((b) => b.id !== id)))
  },
}

const store: BackupStore = firebaseEnabled ? firestoreStore : localBackupStore

/** Borra lo que sobra del cupo de `kind`, de la más antigua hacia atrás. Si falla no pasa nada: se
 *  queda alguna copia de más hasta la próxima poda, que es el fallo bueno. */
async function prune(kind: BackupKind): Promise<void> {
  const kinds = kind === 'daily' ? (['daily'] as BackupKind[]) : ACTION_KINDS
  const copies = (await store.listKinds(kinds)).sort((a, b) => b.takenAtMs - a.takenAtMs)
  for (const old of copies.slice(BACKUPS_PER_QUOTA)) await store.remove(old.id)
}

async function write(id: string, kind: BackupKind, description: string, data: FamilyData, dataHash: string): Promise<void> {
  await store.create(id, { app: BACKUP_APP_ID, kind, description, dataHash, data })
  await prune(kind).catch((err) => console.warn('No se pudieron podar las copias antiguas:', err))
}

/** Recuerda en este dispositivo que la copia de hoy ya está resuelta, para no volver a consultar
 *  la nube en cada recarga de la pestaña (la tablet de los niños se recarga mucho). */
const DAILY_CHECK_KEY = 'misiones-del-huerto:daily-backup-checked'

/** Copia diaria, al arrancar la app (MOO2-103). A lo sumo una por día natural — su id lleva la
 *  fecha — y ninguna si los datos son idénticos a los de la copia más reciente, sea del tipo que
 *  sea: en el plan gratuito cada escritura cuenta. */
export async function dailyBackup(data: FamilyData): Promise<void> {
  const today = todayISODate()
  try {
    if (localStorage.getItem(DAILY_CHECK_KEY) === today) return
  } catch {
    // Sin localStorage (modo privado estricto) simplemente se consulta la nube cada vez.
  }
  const markChecked = () => {
    try {
      localStorage.setItem(DAILY_CHECK_KEY, today)
    } catch {
      // ídem
    }
  }
  try {
    const dataHash = await hashData(data)
    const latest = await store.latest()
    if (latest?.dataHash === dataHash) return markChecked()
    const id = `daily-${today}`
    try {
      await write(id, 'daily', 'Copia diaria', data, dataHash)
    } catch (err) {
      // Otro dispositivo se ha adelantado: la de hoy ya existe y las reglas no dejan reescribirla.
      if (await store.exists(id)) return markChecked()
      throw err
    }
    markChecked()
  } catch (err) {
    console.warn('No se pudo hacer la copia diaria en la nube:', err)
  }
}

/** Copia justo antes de una acción destructiva (resetear la semana, eliminar a un hijo/a,
 *  restaurar otra copia). Devuelve si se pudo guardar: cuando no, la pantalla avisa de que no
 *  habrá copia a la que volver y es la respuesta del padre/madre la que decide si se sigue. */
export async function backupBeforeAction(kind: Exclude<BackupKind, 'daily'>, description: string, data: FamilyData): Promise<boolean> {
  try {
    const dataHash = await hashData(data)
    // El id solo tiene que ser único; el orden lo da `takenAt`.
    await write(`${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, kind, description, data, dataHash)
    return true
  } catch (err) {
    console.error('No se pudo guardar la copia antes de la acción:', err)
    return false
  }
}
