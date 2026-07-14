import type { FamilyData } from '../shared/types'

/** Descarga el estado actual como JSON. Solo lectura: no modifica ni borra ningún dato. */
export function downloadBackup(data: FamilyData) {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'las-misiones-del-huerto',
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
