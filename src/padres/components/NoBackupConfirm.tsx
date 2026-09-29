import { BTN_CANCEL, BTN_DANGER } from '../styles'

interface Props {
  /** Lo que se iba a hacer, en infinitivo y para leerlo tras "antes de": "resetear la semana". */
  action: string
  onConfirm: () => void
  onCancel: () => void
}

/** Aviso cuando no se ha podido guardar la copia de antes de una acción destructiva (MOO2-103).
 *
 *  No bloquea la acción: decisión de producto del ticket. Quien decide es el padre/madre, pero
 *  sabiendo que si se equivoca no habrá copia a la que volver. Por eso "Cancelar" es la salida por
 *  defecto (tocar fuera también cancela) y seguir exige pulsar el botón rojo. */
export function NoBackupConfirm({ action, onConfirm, onCancel }: Props) {
  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(58,50,40,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}
    >
      <div
        role="alertdialog"
        aria-labelledby="no-backup-title"
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#FFFDF6', borderRadius: 16, padding: 18, maxWidth: 380, width: '100%', boxShadow: '0 10px 28px rgba(58,50,40,.3)' }}
      >
        <div id="no-backup-title" style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 17, marginBottom: 8 }}>
          ⚠️ No se ha podido guardar una copia
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#6E6045', lineHeight: 1.5, marginBottom: 14 }}>
          Antes de {action} se guarda siempre una copia de seguridad en la nube, y esta vez ha fallado. Si sigues,{' '}
          <strong>no habrá ninguna copia a la que volver</strong> si luego te arrepientes.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onConfirm} style={BTN_DANGER}>
            Seguir sin copia
          </button>
          <button onClick={onCancel} style={BTN_CANCEL} autoFocus>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
