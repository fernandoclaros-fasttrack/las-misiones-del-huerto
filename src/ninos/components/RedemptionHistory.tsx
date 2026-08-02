import type { Redemption } from '../../shared/types'

interface Props {
  redemptions: Redemption[]
}

/** "Historial de canjeos" (MOO2-54): en qué se ha gastado el niño/a sus puntos. Va como sección
 *  al final de la pantalla de canjear, no como pantalla aparte, porque es donde el niño/a ya está
 *  pensando en premios. Deliberadamente **solo** lista canjes: el desglose de todo lo que ha
 *  movido sus puntos (misiones, puntos dados, penalizaciones) es "Mi historial de puntos"
 *  (MOO2-53), una vista distinta que responde a otra pregunta. Los canjes salen en las dos a
 *  propósito. */
export function RedemptionHistory({ redemptions }: Props) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
      <div style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 19, padding: '4px 6px 2px' }}>Historial de canjeos</div>

      {redemptions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 20px', color: '#9A8E77' }}>
          <div style={{ fontSize: 34 }}>🎁</div>
          <div style={{ marginTop: 8, fontWeight: 700, fontSize: 15 }}>Todavía no has canjeado puntos</div>
        </div>
      ) : (
        redemptions.map((r) => (
          <div
            key={r.id}
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
              {r.conceptEmoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{r.conceptLabel}</div>
              <div style={{ fontSize: 12.5, color: '#8A7E6B', fontWeight: 600 }}>{new Date(r.timestamp).toLocaleDateString('es-ES')}</div>
            </div>
            <div
              style={{
                background: '#E5EFD6',
                color: '#40682A',
                fontWeight: 800,
                fontSize: 13,
                padding: '5px 10px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
              }}
            >
              −{r.points} pts
            </div>
          </div>
        ))
      )}
    </section>
  )
}
