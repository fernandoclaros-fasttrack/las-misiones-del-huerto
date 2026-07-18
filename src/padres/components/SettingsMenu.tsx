import { useEffect, useRef, useState } from 'react'

interface Props {
  onBackup: () => void
  onLogout: () => void
}

const ITEM_STYLE = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 12px',
  borderRadius: 9,
  border: 'none',
  background: 'transparent',
  color: '#3A3228',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  textAlign: 'left' as const,
}

export function SettingsMenu({ onBackup, onLogout }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onClickOutside)
    return () => document.removeEventListener('click', onClickOutside)
  }, [open])

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Ajustes"
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          border: 'none',
          background: 'rgba(255,255,255,.18)',
          color: '#F6F1E2',
          fontSize: 18,
          cursor: 'pointer',
        }}
      >
        ⚙️
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 46,
            background: '#FFFDF6',
            border: '1px solid #EADFCB',
            borderRadius: 13,
            boxShadow: '0 6px 16px rgba(58,50,40,.18)',
            padding: 6,
            minWidth: 210,
            zIndex: 30,
          }}
        >
          <button
            onClick={() => {
              onBackup()
              setOpen(false)
            }}
            style={ITEM_STYLE}
          >
            📥 Copia de seguridad
          </button>
          <button
            onClick={() => {
              onLogout()
              setOpen(false)
            }}
            style={ITEM_STYLE}
          >
            🔒 Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
