import type { LedgerWeek } from '../../shared/logic'

interface Props {
  weeks: LedgerWeek[]
  onBack: () => void
}

/** "Mi historial de puntos" (MOO2-53): el desglose de todo lo que ha movido los puntos del
 *  niño/a — misiones, puntos dados, penalizaciones y canjes — con su motivo y el saldo que le
 *  quedó después de cada uno. Distinto del "Historial de canjeos" (MOO2-54), que solo cuenta en
 *  qué se los ha gastado; los canjes salen en los dos a propósito. */
export function PointsHistory({ weeks, onBack }: Props) {
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
        ← Volver a mis misiones
      </button>

      <div style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 19, padding: '4px 6px 2px' }}>Mi historial de puntos</div>

      {weeks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9A8E77' }}>
          <div style={{ fontSize: 40 }}>🌱</div>
          <div style={{ marginTop: 10, fontWeight: 700, fontSize: 16 }}>Todavía no hay movimientos</div>
          <div style={{ marginTop: 4, fontSize: 13.5 }}>Completa una misión y aparecerá aquí.</div>
        </div>
      ) : (
        weeks.map((week) => (
          <section key={week.weekStart} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                position: 'sticky',
                top: 0,
                background: '#EFE7D4',
                padding: '6px 6px 4px',
                fontWeight: 800,
                fontSize: 13,
                color: '#8A7E6B',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {week.label}
            </div>

            {week.rows.map((row) => {
              const negative = row.points < 0
              return (
                <div
                  key={row.id}
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
                      background: negative ? '#F6DCD3' : '#E5EFD6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                      flex: '0 0 auto',
                    }}
                  >
                    {negative ? '➖' : '➕'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{row.reason}</div>
                    <div style={{ fontSize: 12.5, color: '#8A7E6B', fontWeight: 600 }}>
                      {new Date(row.timestamp).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
                      {' · '}
                      {/* Signo tipográfico, no el guión de `toString()`: el resto de la app usa − */}
                      te quedaron {row.balanceAfter < 0 ? '−' : ''}
                      {Math.abs(row.balanceAfter)} pts
                    </div>
                  </div>
                  <div
                    style={{
                      background: negative ? '#F6DCD3' : '#E5EFD6',
                      color: negative ? '#A0402A' : '#40682A',
                      fontWeight: 800,
                      fontSize: 13,
                      padding: '5px 10px',
                      borderRadius: 999,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {negative ? '−' : '+'}
                    {Math.abs(row.points)} pts
                  </div>
                </div>
              )
            })}
          </section>
        ))
      )}
    </main>
  )
}
