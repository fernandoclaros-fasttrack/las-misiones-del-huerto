import type { FamilyData } from '../shared/types'

/** Marca que identifica un JSON como copia de seguridad de esta app. Se escribe al descargar y
 *  se comprueba al restaurar (MOO2-100): es lo único que distingue una copia buena de cualquier
 *  otro JSON que el navegador deje seleccionar. */
const BACKUP_APP_ID = 'las-misiones-del-huerto'

/** Contenido útil de un fichero de copia. `exportedAt` es opcional a propósito: identifica de
 *  cuándo es la copia y se enseña antes de confirmar, pero una copia sin esa marca sigue siendo
 *  restaurable — el dato que importa es `data`. */
export interface BackupFile {
  exportedAt?: string
  data: FamilyData
}

/** Descarga el estado actual como JSON. Solo lectura: no modifica ni borra ningún dato. */
export function downloadBackup(data: FamilyData) {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: BACKUP_APP_ID,
    data,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `misiones-del-huerto-backup-${date}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export type ParsedBackup = { ok: true; backup: BackupFile } | { ok: false; error: string }

/** Valida un fichero antes de dejar que sustituya a los datos de la familia (MOO2-100).
 *
 *  Comprueba la marca `app` y la forma de `data`, no su contenido: rellenar los campos que le
 *  falten a una copia antigua es trabajo de `normalize()`, igual que con un documento viejo
 *  leído de Firestore, así que aquí solo se exige lo que `normalize()` da por sentado y no
 *  puede inventarse — los siete días con su lista de misiones, y el contador compartido, que
 *  entra directo en la aritmética de puntos. Lo demás (`children`, `adjustments`,
 *  `missionTemplates`…) puede faltar sin problema, que es justo el caso de una copia anterior
 *  a la funcionalidad que lo añadió.
 *
 *  Devuelve el motivo en vez de lanzar porque el mensaje se le enseña al padre/madre tal cual:
 *  "no es una copia válida" a secas no le dice si se equivocó de fichero o si la copia está
 *  rota. */
export function parseBackup(text: string): ParsedBackup {
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    return { ok: false, error: 'El fichero no es un JSON válido.' }
  }
  if (!isRecord(payload)) return { ok: false, error: 'El fichero no contiene una copia de seguridad.' }
  if (payload.app !== BACKUP_APP_ID) {
    return { ok: false, error: 'Ese fichero no es una copia de seguridad de Las misiones del huerto.' }
  }
  const data = payload.data
  if (!isRecord(data)) return { ok: false, error: 'La copia no contiene datos de la familia.' }
  if (typeof data.acumulado !== 'number' || !Number.isFinite(data.acumulado)) {
    return { ok: false, error: 'La copia está incompleta: le faltan los puntos acumulados.' }
  }
  if (!Array.isArray(data.days) || data.days.length !== 7) {
    return { ok: false, error: 'La copia está incompleta: no tiene los siete días de la semana.' }
  }
  if (!data.days.every((day) => isRecord(day) && Array.isArray(day.missions))) {
    return { ok: false, error: 'La copia está dañada: algún día no tiene su lista de misiones.' }
  }
  const exportedAt = typeof payload.exportedAt === 'string' ? payload.exportedAt : undefined
  return { ok: true, backup: { exportedAt, data: data as unknown as FamilyData } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
