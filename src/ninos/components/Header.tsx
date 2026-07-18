interface Props {
  accent: string
  points: number
  pointsKey: number
  showFloat: boolean
  floatKey: number
  floatText: string
  floatColor: string
  childName?: string
  onSwitchChild?: () => void
  onShowHistory?: () => void
  onLogout: () => void
}

export function Header({ accent, points, pointsKey, showFloat, floatKey, floatText, floatColor, childName, onSwitchChild, onShowHistory, onLogout }: Props) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: accent,
        color: '#F6F1E2',
        padding: '18px 22px 22px',
        borderRadius: '0 0 26px 26px',
        boxShadow: '0 8px 22px rgba(58,50,40,.20)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: "'Bitter', serif",
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: 0.2,
            opacity: 0.92,
          }}
        >
          <span style={{ fontSize: 17 }}>🌿</span> Las misiones del huerto
        </div>
        <button
          onClick={onLogout}
          title="Cerrar sesión"
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            border: 'none',
            background: 'rgba(255,255,255,.18)',
            color: '#F6F1E2',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          🔒
        </button>
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 9, marginTop: 12 }}>
        <span
          key={`pts-${pointsKey}`}
          style={{
            fontFamily: "'Bitter', serif",
            fontWeight: 700,
            fontSize: 60,
            lineHeight: 0.9,
            animation: 'popNum .4s ease',
          }}
        >
          {points}
        </span>
        <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 22, paddingBottom: 8, opacity: 0.9 }}>puntos</span>
        {showFloat && (
          <span
            key={`float-${floatKey}`}
            style={{
              position: 'absolute',
              left: 2,
              top: -14,
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 900,
              fontSize: 24,
              color: floatColor,
              animation: 'floatUp 1s ease forwards',
              pointerEvents: 'none',
            }}
          >
            {floatText}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13.5, opacity: 0.82, marginTop: 3, fontWeight: 600 }}>acumulados esta semana 🌻</div>

      {childName && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={onSwitchChild}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: 999,
              border: 'none',
              background: 'rgba(255,255,255,.18)',
              color: '#F6F1E2',
              fontWeight: 800,
              fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            👤 {childName}
          </button>
          {onShowHistory && (
            <button
              onClick={onShowHistory}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 999,
                border: 'none',
                background: 'rgba(255,255,255,.18)',
                color: '#F6F1E2',
                fontWeight: 800,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              🎁 Mi historial
            </button>
          )}
        </div>
      )}
    </header>
  )
}
