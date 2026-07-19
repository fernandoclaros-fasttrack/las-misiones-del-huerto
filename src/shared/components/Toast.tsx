interface Props {
  message: string | null
}

/** Aviso flotante y temporal (MOO-28) para confirmar acciones que no tienen otro
 *  feedback visible en pantalla, como duplicar una misión. */
export function Toast({ message }: Props) {
  if (!message) return null
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 28,
        transform: 'translateX(-50%)',
        background: '#3A3228',
        color: '#F6F1E2',
        padding: '11px 20px',
        borderRadius: 13,
        fontWeight: 800,
        fontSize: 13.5,
        boxShadow: '0 8px 20px rgba(0,0,0,.22)',
        zIndex: 1000,
        pointerEvents: 'none',
        maxWidth: '85%',
        textAlign: 'center',
      }}
    >
      {message}
    </div>
  )
}
