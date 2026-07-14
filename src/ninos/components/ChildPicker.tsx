import type { Child } from '../../shared/types'

interface Props {
  accent: string
  kids: Child[]
  onSelect: (childId: string) => void
}

export function ChildPicker({ accent, kids, onSelect }: Props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#EFE7D4',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        fontFamily: "'Nunito', system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ fontSize: 44 }}>🌻</div>
      <div style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 22, color: '#3A3228' }}>¿Quién eres?</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 280 }}>
        {kids.map((child) => (
          <button
            key={child.id}
            onClick={() => onSelect(child.id)}
            style={{
              padding: '16px 20px',
              borderRadius: 18,
              border: 'none',
              background: accent,
              color: '#F6F1E2',
              fontWeight: 800,
              fontSize: 18,
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(58,50,40,.18)',
            }}
          >
            {child.name}
          </button>
        ))}
      </div>
    </div>
  )
}
