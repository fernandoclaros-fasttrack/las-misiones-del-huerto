import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { Mission } from '../../shared/types'

interface Props {
  missions: Mission[]
  /** Sin arrastre mientras se edita una misión (MOO-29): evita que el índice de una tarjeta
   *  cambie bajo un formulario abierto. */
  disabled: boolean
  onReorder: (missionIds: string[]) => void
  renderItem: (mission: Mission, dragHandle: ReactNode) => ReactNode
}

const ACCENT = '#47702F'

/** Lista reordenable por arrastre (MOO-29). La tarjeta arrastrada sigue al puntero con un
 *  `translateY` relativo a su posición inicial; el resto no se mueve hasta soltar, y el
 *  hueco donde caería se marca con un borde superior (o una barra al final de la lista).
 *  Al soltar, el índice final se calcula contando cuántas tarjetas quedan con el centro por
 *  encima del centro actual de la arrastrada, y se persiste el orden completo resultante. */
export function MissionsList({ missions, disabled, onReorder, renderItem }: Props) {
  const itemRefs = useRef(new Map<string, HTMLDivElement>())
  const dragStart = useRef<{ id: string; clientY: number; centerY: number } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragY, setDragY] = useState(0)
  const [dropIndex, setDropIndex] = useState(0)

  function registerRef(id: string, el: HTMLDivElement | null) {
    if (el) itemRefs.current.set(id, el)
    else itemRefs.current.delete(id)
  }

  function startDrag(id: string, e: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled) return
    const el = itemRefs.current.get(id)
    if (!el) return
    e.preventDefault()
    const rect = el.getBoundingClientRect()
    dragStart.current = { id, clientY: e.clientY, centerY: rect.top + rect.height / 2 }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Sin puntero activo que capturar (p. ej. eventos sintéticos en tests); el arrastre real
      // sigue funcionando mientras el dedo/cursor permanezca sobre el asa.
    }
    setDragId(id)
    setDragY(0)
    setDropIndex(missions.findIndex((m) => m.id === id))
  }

  function onMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const start = dragStart.current
    if (!start) return
    const dy = e.clientY - start.clientY
    setDragY(dy)
    const currentCenter = start.centerY + dy
    let index = 0
    missions.forEach((m) => {
      if (m.id === start.id) return
      const el = itemRefs.current.get(m.id)
      if (!el) return
      const center = el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2
      if (center < currentCenter) index++
    })
    setDropIndex(index)
  }

  function endDrag() {
    const start = dragStart.current
    if (start) {
      const ids = missions.map((m) => m.id)
      const from = ids.indexOf(start.id)
      if (from !== -1) {
        ids.splice(from, 1)
        ids.splice(dropIndex, 0, start.id)
        onReorder(ids)
      }
    }
    dragStart.current = null
    setDragId(null)
    setDragY(0)
  }

  let otherIdx = 0
  return (
    <>
      {missions.map((m) => {
        const isDragging = dragId === m.id
        const showIndicatorBefore = dragId !== null && !isDragging && otherIdx === dropIndex
        if (!isDragging) otherIdx++

        const dragHandle =
          !disabled && missions.length > 1 ? (
            <button
              onPointerDown={(e) => startDrag(m.id, e)}
              onPointerMove={isDragging ? onMove : undefined}
              onPointerUp={isDragging ? endDrag : undefined}
              onPointerCancel={isDragging ? endDrag : undefined}
              title="Arrastrar para reordenar"
              style={{
                cursor: isDragging ? 'grabbing' : 'grab',
                border: 'none',
                background: 'transparent',
                fontSize: 18,
                lineHeight: 1,
                color: '#B7AA8A',
                padding: '4px 6px',
                touchAction: 'none',
              }}
            >
              ⠿
            </button>
          ) : null

        return (
          <div
            key={m.id}
            ref={(el) => registerRef(m.id, el)}
            style={{
              position: isDragging ? 'relative' : undefined,
              zIndex: isDragging ? 20 : undefined,
              transform: isDragging ? `translateY(${dragY}px)` : undefined,
              boxShadow: isDragging ? '0 8px 20px rgba(58,50,40,.25)' : undefined,
              borderTop: showIndicatorBefore ? `3px solid ${ACCENT}` : undefined,
              borderRadius: showIndicatorBefore ? '3px 3px 0 0' : undefined,
            }}
          >
            {renderItem(m, dragHandle)}
          </div>
        )
      })}
      {dragId !== null && dropIndex === missions.length - 1 && (
        <div style={{ height: 3, background: ACCENT, borderRadius: 2, margin: '-6px 4px 3px' }} />
      )}
    </>
  )
}
