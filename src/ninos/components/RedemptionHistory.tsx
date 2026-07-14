import type { Redemption } from '../../shared/types'

interface Props {
  redemptions: Redemption[]
  onBack: () => void
}

export function RedemptionHistory({ redemptions, onBack }: Props) {
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

      <div style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 19, padding: '4px 6px 2px' }}>Mi historial de canjes</div>

      {redemptions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9A8E77' }}>
          <div style={{ fontSize: 40 }}>🎁</div>
          <div style={{ marginTop: 10, fontWeight: 700, fontSize: 16 }}>Todavía no has canjeado puntos</div>
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
              }}
            >
              {r.conceptEmoji}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{r.conceptLabel}</div>
              <div style={{ fontSize: 12.5, color: '#8A7E6B', fontWeight: 600 }}>{new Date(r.timestamp).toLocaleDateString('es-ES')}</div>
            </div>
            <div style={{ background: '#E5EFD6', color: '#40682A', fontWeight: 800, fontSize: 13, padding: '5px 10px', borderRadius: 999 }}>
              −{r.points} pts
            </div>
          </div>
        ))
      )}
    </main>
  )
}
