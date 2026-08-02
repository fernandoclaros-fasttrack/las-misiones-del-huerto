import { useState } from 'react'
import { changeHistoryRows, entriesWithoutChildBreakdown } from '../../shared/logic'
import type { ChangeLogEntry, Child } from '../../shared/types'

interface Props {
  entries: ChangeLogEntry[]
  kids: Child[]
  onBack: () => void
}

const ACTOR_META: Record<ChangeLogEntry['actor'], { icon: string; label: string }> = {
  padre: { icon: '🧑‍🌾', label: 'Padre/madre' },
  hijo: { icon: '🧒', label: 'Hijo/a' },
}

export function ChangeHistoryView({ entries, kids, onBack }: Props) {
  /** null = sin filtro, la vista se comporta igual que antes de MOO2-55. */
  const [childId, setChildId] = useState<string | null>(null)
  const rows = changeHistoryRows(entries, childId)
  const legacyCount = entriesWithoutChildBreakdown(entries)

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

      {/* El filtro solo aparece si hay hijos: sin ellos ninguna entrada tiene desglose y todos
          los chips darían una lista vacía. */}
      {kids.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 4px' }}>
          {[{ id: null as string | null, name: 'Todos' }, ...kids].map((option) => {
            const active = option.id === childId
            return (
              <button
                key={option.id ?? 'all'}
                onClick={() => setChildId(option.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: active ? '2px solid #5B8C3E' : '1px solid #E4DBC8',
                  background: active ? '#DDEBC9' : '#FFFDF6',
                  color: '#3A3228',
                  fontWeight: 800,
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                {option.name}
              </button>
            )
          })}
        </div>
      )}

      {childId && legacyCount > 0 && (
        <div style={{ fontSize: 12, color: '#8A7E6B', fontWeight: 600, padding: '0 6px', lineHeight: 1.4 }}>
          {legacyCount} {legacyCount === 1 ? 'cambio antiguo no aparece' : 'cambios antiguos no aparecen'} al filtrar: se
          registraron antes de que la app guardara a qué hijo/a afectaba cada uno. Se siguen viendo en "Todos".
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9A8E77' }}>
          <div style={{ fontSize: 40 }}>🧾</div>
          <div style={{ marginTop: 10, fontWeight: 700, fontSize: 16 }}>
            {childId ? 'Sin cambios registrados para este hijo/a' : 'Todavía no hay cambios registrados'}
          </div>
        </div>
      ) : (
        rows.map(({ entry, points }) => {
          const meta = ACTOR_META[entry.actor]
          const negative = (points ?? 0) < 0
          return (
            <div
              key={entry.id}
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
                <div style={{ fontWeight: 700, fontSize: 14 }}>{entry.description}</div>
                <div style={{ fontSize: 12, color: '#8A7E6B', fontWeight: 600, marginTop: 2 }}>
                  {meta.label} · {new Date(entry.timestamp).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
              {points !== undefined && (
                <span
                  style={{
                    background: negative ? '#F6DCD3' : '#E5EFD6',
                    color: negative ? '#A0402A' : '#40682A',
                    fontWeight: 800,
                    fontSize: 12,
                    padding: '4px 8px',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                    flex: '0 0 auto',
                  }}
                >
                  {negative ? '−' : '+'}
                  {Math.abs(points)} pts
                </span>
              )}
            </div>
          )
        })
      )}
    </main>
  )
}
