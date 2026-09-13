import { useRef, useState } from 'react'
import { parseBackup, type BackupFile } from '../backup'
import { BTN_CANCEL, BTN_DANGER } from '../styles'
import type { FamilyData } from '../../shared/types'

interface Props {
  current: FamilyData
  onRestore: (data: FamilyData, exportedAt?: string) => Promise<void>
  onDone: (message: string) => void
  onBack: () => void
}

const CARD: React.CSSProperties = {
  background: '#FFFDF6',
  border: '1px solid #EADFCB',
  borderRadius: 14,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

/** Restaurar una copia de seguridad (MOO2-100). Es el único sitio de la app que sustituye los
 *  datos de la familia de golpe, así que el fichero se elige y se valida primero y solo después
 *  se pide confirmación, enseñando de cuándo es la copia y qué trae frente a lo que hay ahora.
 *  Un fichero inválido se queda en el mensaje de error sin llegar nunca a `onRestore`. */
export function RestoreBackupView({ current, onRestore, onDone, onBack }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [backup, setBackup] = useState<BackupFile | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  async function handleFile(file: File) {
    setBackup(null)
    setError(null)
    setFileName(file.name)
    let text: string
    try {
      text = await file.text()
    } catch {
      setError('No se ha podido leer el fichero.')
      return
    }
    const parsed = parseBackup(text)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setBackup(parsed.backup)
  }

  async function handleConfirm() {
    if (!backup || restoring) return
    setRestoring(true)
    try {
      await onRestore(backup.data, backup.exportedAt)
      onDone('Copia de seguridad restaurada')
    } catch (err) {
      console.error('No se pudo restaurar la copia de seguridad:', err)
      setError('No se ha podido restaurar la copia. Los datos actuales no se han tocado.')
      setRestoring(false)
    }
  }

  return (
    <main style={{ flex: 1, padding: '8px 16px 44px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        onClick={onBack}
        style={{
          alignSelf: 'flex-start',
          padding: '8px 14px',
          borderRadius: 12,
          border: '1px solid #EADFCB',
          background: '#FFFDF6',
          color: '#6E6045',
          fontWeight: 800,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        ← Volver
      </button>

      <div style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 19, padding: '4px 6px 2px' }}>Restaurar copia de seguridad</div>

      <div style={CARD}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#6E6045', lineHeight: 1.45 }}>
          Elige un fichero de copia descargado desde esta misma app. Nada cambia hasta que lo confirmes.
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            // El input se limpia siempre para que volver a elegir el mismo fichero (tras
            // corregirlo, por ejemplo) dispare otro `change`.
            e.target.value = ''
            if (file) void handleFile(file)
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={restoring}
          style={{
            padding: '11px 14px',
            borderRadius: 12,
            border: '1px solid #E0D6C2',
            background: '#FBF7EC',
            color: '#3A3228',
            fontWeight: 800,
            fontSize: 14,
            cursor: restoring ? 'default' : 'pointer',
          }}
        >
          📂 Elegir fichero…
        </button>
        {fileName && (
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#8A7B5E', wordBreak: 'break-all' }}>{fileName}</div>
        )}
      </div>

      {error && (
        <div
          style={{
            ...CARD,
            background: '#FBEFE9',
            border: '1px solid #E3BCAC',
            color: '#8C3F27',
            fontSize: 13.5,
            fontWeight: 800,
            lineHeight: 1.45,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {backup && (
        <div style={CARD}>
          <div style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 16 }}>Copia {formatExportedAt(backup.exportedAt)}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6E6045', lineHeight: 1.5 }}>
            Se reemplazarán <strong>todos</strong> los datos de la familia — hijos y sus puntos, misiones de los siete días, conceptos de
            canje, canjes, ajustes y lista rápida — por los de esta copia. El historial de cambios no se pierde: se conservan las entradas
            de la copia y las actuales.
          </div>
          <Summary label="Ahora" data={current} />
          <Summary label="En la copia" data={backup.data} />
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <button onClick={() => void handleConfirm()} disabled={restoring} style={BTN_DANGER}>
              {restoring ? 'Restaurando…' : 'Sí, restaurar'}
            </button>
            <button
              onClick={() => {
                setBackup(null)
                setFileName('')
              }}
              disabled={restoring}
              style={BTN_CANCEL}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

/** Recuento de lo que hay en un documento, para poder comparar de un vistazo lo actual con lo que
 *  trae la copia. Lee con `?? []` porque una copia antigua puede no tener los campos añadidos
 *  después — los mismos que `normalize()` rellena al restaurar. */
function Summary({ label, data }: { label: string; data: FamilyData }) {
  const missions = (data.days ?? []).reduce((sum, day) => sum + (day.missions?.length ?? 0), 0)
  const parts = [
    `${data.children?.length ?? 0} hijos`,
    `${missions} misiones`,
    `${data.concepts?.length ?? 0} conceptos`,
    `${data.redemptions?.length ?? 0} canjes`,
    `${data.adjustments?.length ?? 0} ajustes`,
    `${data.missionTemplates?.length ?? 0} en la lista rápida`,
  ]
  return (
    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#3A3228', background: '#F5EFE0', borderRadius: 10, padding: '9px 11px' }}>
      <span style={{ color: '#8A7B5E' }}>{label}: </span>
      {parts.join(' · ')}
    </div>
  )
}

function formatExportedAt(exportedAt?: string): string {
  if (!exportedAt) return 'sin fecha'
  const date = new Date(exportedAt)
  if (Number.isNaN(date.getTime())) return 'sin fecha'
  return `del ${date.toLocaleDateString('es-ES')} a las ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
}
