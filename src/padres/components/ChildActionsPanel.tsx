import { useState } from 'react'
import type { RewardConcept } from '../../shared/types'
import { BTN_CANCEL, BTN_SAVE, PANEL_INPUT_STYLE, btn } from '../styles'

type PanelName = null | 'edit' | 'penalty' | 'redeem'

const BTN_LIGHT = btn('#F1ECDD', '#6E6045', { flex: 1, padding: '8px 6px', fontSize: 12.5 })
const BTN_LIGHT_GREEN = btn('#DDEBC9', '#3F6B26', { flex: 1, padding: '8px 6px', fontSize: 12.5 })

interface Props {
  currentPoints: number
  concepts: RewardConcept[]
  onEditPoints: (value: number) => void
  onPenalize: (amount: number) => void
  onRedeem: (points: number, concept: RewardConcept) => Promise<{ ok: boolean; error?: string }>
}

export function ChildActionsPanel({ currentPoints, concepts, onEditPoints, onPenalize, onRedeem }: Props) {
  const [panel, setPanel] = useState<PanelName>(null)
  const [editVal, setEditVal] = useState('')
  const [penaltyVal, setPenaltyVal] = useState('')
  const [redeemVal, setRedeemVal] = useState('')
  const [conceptId, setConceptId] = useState<string | null>(concepts[0]?.id ?? null)
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null)

  function open(name: Exclude<PanelName, null>) {
    setPanel((cur) => (cur === name ? null : name))
    setMsg(null)
    if (name === 'edit') setEditVal(String(currentPoints))
    if (name === 'penalty') setPenaltyVal('')
    if (name === 'redeem') setRedeemVal('')
  }

  function saveEdit() {
    onEditPoints(parseInt(editVal, 10) || 0)
    setPanel(null)
  }
  function applyPenalty() {
    onPenalize(Math.max(0, parseInt(penaltyVal, 10) || 0))
    setPanel(null)
  }
  async function confirmRedeem() {
    const pts = parseInt(redeemVal, 10) || 0
    const concept = concepts.find((c) => c.id === conceptId)
    if (!concept) {
      setMsg({ text: 'Añade primero un concepto de canje en el contador de arriba.', err: true })
      return
    }
    const result = await onRedeem(pts, concept)
    if (!result.ok) {
      setMsg({ text: result.error!, err: true })
      return
    }
    setRedeemVal('')
    setMsg({ text: `Canjeados ${pts} pts por ${concept.label} ${concept.emoji}.`, err: false })
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => open('edit')} style={BTN_LIGHT}>
          ✏️ Editar
        </button>
        <button onClick={() => open('penalty')} style={BTN_LIGHT}>
          ➖ Penalizar
        </button>
        <button onClick={() => open('redeem')} style={BTN_LIGHT_GREEN}>
          🎁 Canjear
        </button>
      </div>

      {panel === 'edit' && (
        <div style={{ marginTop: 8, background: '#FBF7EC', borderRadius: 11, padding: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" value={editVal} onChange={(e) => setEditVal(e.target.value)} style={PANEL_INPUT_STYLE} />
            <button onClick={saveEdit} style={BTN_SAVE}>
              Guardar
            </button>
            <button onClick={() => setPanel(null)} style={BTN_CANCEL}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {panel === 'penalty' && (
        <div style={{ marginTop: 8, background: '#FBF7EC', borderRadius: 11, padding: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              value={penaltyVal}
              onChange={(e) => setPenaltyVal(e.target.value)}
              placeholder="p. ej. 15"
              style={PANEL_INPUT_STYLE}
            />
            <button onClick={applyPenalty} style={BTN_SAVE}>
              Aplicar
            </button>
            <button onClick={() => setPanel(null)} style={BTN_CANCEL}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {panel === 'redeem' && (
        <div style={{ marginTop: 8, background: '#FBF7EC', borderRadius: 11, padding: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {concepts.map((c) => {
              const active = c.id === conceptId
              return (
                <button
                  key={c.id}
                  onClick={() => setConceptId(c.id)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 10,
                    border: active ? '2px solid #5B8C3E' : '1px solid #E4DBC8',
                    background: active ? '#DDEBC9' : '#FFFDF6',
                    color: '#3A3228',
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: 'pointer',
                  }}
                >
                  {c.emoji} {c.label}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              value={redeemVal}
              onChange={(e) => setRedeemVal(e.target.value)}
              placeholder="puntos"
              style={PANEL_INPUT_STYLE}
            />
            <button onClick={confirmRedeem} style={BTN_SAVE}>
              Confirmar
            </button>
          </div>
          {msg && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: msg.err ? '#A04A32' : '#3F6B26' }}>{msg.text}</div>}
        </div>
      )}
    </div>
  )
}
