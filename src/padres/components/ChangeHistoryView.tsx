import type { ChangeLogEntry } from '../../shared/types'

interface Props {
  entries: ChangeLogEntry[]
  onBack: () => void
}

const ACTOR_META: Record<ChangeLogEntry['actor'], { icon: string; label: string }> = {
  padre: { icon: '🧑‍🌾', label: 'Padre/madre' },
  hijo: { icon: '🧒', label: 'Hijo/a' },
}

export function ChangeHistoryView({ entries, onBack }: Props) {
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp)

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

      <div style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 19, padding: '4px 6px 2px' }}>Historial de cambios</div>

      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9A8E77' }}>
          <div style={{ fontSize: 40 }}>🧾</div>
          <div style={{ marginTop: 10, fontWeight: 700, fontSize: 16 }}>Todavía no hay cambios registrados</div>
        </div>
      ) : (
        sorted.map((e) => {
          const meta = ACTOR_META[e.actor]
          return (
            <div
              key={e.id}
              style={{
                background: '#FFFDF6',
                border: '1px solid #EADFCB',
                borderRadius: 18,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: '0 2px 6px rgba(58,50,40,.05)',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  background: '#F1ECDD',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  flex: '0 0 auto',
                }}
              >
                {meta.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{e.description}</div>
                <div style={{ fontSize: 12, color: '#8A7E6B', fontWeight: 600, marginTop: 2 }}>
                  {meta.label} · {new Date(e.timestamp).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            </div>
          )
        })
      )}
    </main>
  )
}
