interface Props {
  onLogout: () => void
}

/** Lo que ve un niño/a cuando la familia todavía no tiene ningún perfil creado (MOO2-102).
 *  Antes se caía al contador compartido de la v1, que enseñaba un número de puntos que no era
 *  de nadie y escondía sin explicación el selector de hijo, "Canjear" y "Mis puntos". El botón
 *  de cerrar sesión sigue estando aquí para no dejar la sesión atrapada en esta pantalla. */
export function NoChildrenState({ onLogout }: Props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#EFE7D4',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        fontFamily: "'Nunito', system-ui, sans-serif",
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 46 }}>🌱</div>
      <div style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 22, color: '#3A3228' }}>Aquí todavía no hay nadie</div>
      <div style={{ fontSize: 15, color: '#6E6045', maxWidth: 300, lineHeight: 1.45 }}>
        Pídele a papá o a mamá que te cree tu perfil. Cuando lo tengas, aquí verás tus misiones y tus puntos.
      </div>
      <button
        onClick={onLogout}
        style={{
          marginTop: 10,
          padding: '9px 16px',
          borderRadius: 999,
          border: '1px solid #C4B896',
          background: 'transparent',
          color: '#6E6045',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Cerrar sesión
      </button>
    </div>
  )
}
