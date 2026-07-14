import { useState } from 'react'
import type { Child, RewardConcept } from '../../shared/types'
import { BTN_CANCEL, BTN_SAVE, ICON_BTN, INPUT_STYLE } from '../styles'
import { ChildActionsPanel } from './ChildActionsPanel'

interface Props {
  kids: Child[]
  concepts: RewardConcept[]
  onAdd: (name: string) => void
  onRename: (childId: string, name: string) => void
  onRemove: (childId: string) => void
  onEditPoints: (childId: string, value: number) => void
  onPenalize: (childId: string, amount: number) => void
  onRedeem: (childId: string, points: number, concept: RewardConcept) => Promise<{ ok: boolean; error?: string }>
}

export function ChildrenCard({ kids, concepts, onAdd, onRename, onRemove, onEditPoints, onPenalize, onRedeem }: Props) {
  const [editingId, setEditingId] = useState<null | 'new' | string>(null)
  const [draftName, setDraftName] = useState('')

  function startAdd() {
    setEditingId('new')
    setDraftName('')
  }
  function startEdit(child: Child) {
    setEditingId(child.id)
    setDraftName(child.name)
  }
  function cancel() {
    setEditingId(null)
  }
  function save() {
    if (!draftName.trim()) return
    if (editingId === 'new') onAdd(draftName)
    else if (editingId) onRename(editingId, draftName)
    setEditingId(null)
  }

  return (
    <div style={{ background: '#FFFDF6', border: '1px solid #EADFCB', borderRadius: 18, padding: '14px 15px', marginTop: 12 }}>
      <div style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Hijos</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {kids.map((child) =>
          editingId === child.id ? (
            <div key={child.id} style={{ display: 'flex', gap: 8 }}>
              <input value={draftName} onChange={(e) => setDraftName(e.target.value)} style={{ ...INPUT_STYLE, flex: 1 }} autoFocus />
              <button onClick={save} style={BTN_SAVE}>
                Guardar
              </button>
              <button onClick={cancel} style={BTN_CANCEL}>
                Cancelar
              </button>
            </div>
          ) : (
            <div key={child.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{child.name}</span>
                <span
                  style={{
                    background: '#E5EFD6',
                    color: '#40682A',
                    fontWeight: 800,
                    fontSize: 12.5,
                    padding: '5px 10px',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {child.points} pts
                </span>
                <button onClick={() => startEdit(child)} title="Renombrar" style={ICON_BTN}>
                  ✏️
                </button>
                <button onClick={() => onRemove(child.id)} title="Quitar" style={ICON_BTN}>
                  🗑️
                </button>
              </div>
              <ChildActionsPanel
                currentPoints={child.points}
                concepts={concepts}
                onEditPoints={(value) => onEditPoints(child.id, value)}
                onPenalize={(amount) => onPenalize(child.id, amount)}
                onRedeem={(points, concept) => onRedeem(child.id, points, concept)}
              />
            </div>
          ),
        )}

        {editingId === 'new' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Nombre del hijo/a"
              style={{ ...INPUT_STYLE, flex: 1 }}
              autoFocus
            />
            <button onClick={save} style={BTN_SAVE}>
              Añadir
            </button>
            <button onClick={cancel} style={BTN_CANCEL}>
              Cancelar
            </button>
          </div>
        )}

        {editingId !== 'new' && (
          <button
            onClick={startAdd}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 13,
              border: '2px dashed #C4B896',
              background: 'transparent',
              color: '#6E6045',
              fontWeight: 800,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            ＋ Añadir hijo
          </button>
        )}
      </div>

      {kids.length === 0 && editingId === null && (
        <div style={{ marginTop: 2, fontSize: 12.5, color: '#8A7E6B' }}>
          Sin hijos configurados: los puntos se siguen acumulando en el contador compartido de arriba.
        </div>
      )}
    </div>
  )
}
