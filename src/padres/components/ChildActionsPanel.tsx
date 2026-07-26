import { useState } from 'react'
import { isConceptVariableCost } from '../../shared/logic'
import type { Redemption, RewardConcept } from '../../shared/types'
import { BTN_CANCEL, BTN_SAVE, PANEL_INPUT_STYLE, btn } from '../styles'

type PanelName = null | 'edit' | 'redeem' | 'history'

const BTN_LIGHT = btn('#F1ECDD', '#6E6045', { flex: 1, padding: '8px 6px', fontSize: 12.5 })
const BTN_LIGHT_GREEN = btn('#DDEBC9', '#3F6B26', { flex: 1, padding: '8px 6px', fontSize: 12.5 })

interface Props {
  currentPoints: number
  concepts: RewardConcept[]
  redemptions: Redemption[]
  onEditPoints: (value: number) => void
  onRedeem: (points: number, concept: RewardConcept) => Promise<{ ok: boolean; error?: string }>
  onDeleteRedemption: (redemptionId: string) => void
}

export function ChildActionsPanel({ currentPoints, concepts, redemptions, onEditPoints, onRedeem, onDeleteRedemption }: Props) {
  const [panel, setPanel] = useState<PanelName>(null)
  const [editVal, setEditVal] = useState('')
  const [redeemVal, setRedeemVal] = useState('')
  const [conceptId, setConceptId] = useState<string | null>(concepts[0]?.id ?? null)
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null)
  const selectedConcept = concepts.find((c) => c.id === conceptId)

  function open(name: Exclude<PanelName, null>) {
    setPanel((cur) => (cur === name ? null : name))
    setMsg(null)
    if (name === 'edit') setEditVal(String(currentPoints))
    if (name === 'redeem') setRedeemVal('')
  }

  function saveEdit() {
    onEditPoints(parseInt(editVal, 10) || 0)
    setPanel(null)
  }
  async function confirmRedeem() {
    const concept = selectedConcept
    if (!concept) {
      setMsg({ text: 'Añade primero un concepto de canje en el contador de arriba.', err: true })
      return
    }
    // El coste fijo configurado en el concepto (MOO-52/MOO-54) se aplica siempre, sin permitir
    // ajuste manual — el importe libre solo se pide para conceptos de coste variable.
    const pts = isConceptVariableCost(concept) ? parseInt(redeemVal, 10) || 0 : concept.cost ?? 0
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
        <button onClick={() => open('redeem')} style={BTN_LIGHT_GREEN}>
          🎁 Canjear
        </button>
        <button onClick={() => open('history')} style={BTN_LIGHT}>
          🧾 Historial
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

      {panel === 'redeem' && (
        <div style={{ marginTop: 8, background: '#FBF7EC', borderRadius: 11, padding: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {concepts.map((c) => {
              const active = c.id === conceptId
              const activeColor = c.isPenalty ? '#A04A32' : '#5B8C3E'
              return (
                <button
                  key={c.id}
                  onClick={() => setConceptId(c.id)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 10,
                    border: active ? `2px solid ${activeColor}` : c.isPenalty ? '1px solid #E3B8AA' : '1px solid #E4DBC8',
                    background: active ? (c.isPenalty ? '#F3DCD3' : '#DDEBC9') : '#FFFDF6',
                    color: '#3A3228',
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: 'pointer',
                  }}
                >
                  {c.emoji} {c.label}
                  {!isConceptVariableCost(c) ? ` · ${c.cost} pts` : ''}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {selectedConcept && !isConceptVariableCost(selectedConcept) ? (
              <div style={{ ...PANEL_INPUT_STYLE, display: 'flex', alignItems: 'center' }}>Coste: {selectedConcept.cost} pts</div>
            ) : (
              <input
                type="number"
                value={redeemVal}
                onChange={(e) => setRedeemVal(e.target.value)}
                placeholder="puntos"
                style={PANEL_INPUT_STYLE}
              />
            )}
            <button onClick={confirmRedeem} style={BTN_SAVE}>
              Confirmar
            </button>
          </div>
          {msg && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: msg.err ? '#A04A32' : '#3F6B26' }}>{msg.text}</div>}
        </div>
      )}

      {panel === 'history' && (
        <div style={{ marginTop: 8, background: '#FBF7EC', borderRadius: 11, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {redemptions.length === 0 ? (
            <div style={{ fontSize: 12.5, color: '#8A7E6B', fontWeight: 600, textAlign: 'center', padding: '4px 0' }}>Sin canjes todavía.</div>
          ) : (
            redemptions.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 17 }}>{r.conceptEmoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{r.conceptLabel}</div>
                  <div style={{ fontSize: 11.5, color: '#8A7E6B', fontWeight: 600 }}>{new Date(r.timestamp).toLocaleDateString('es-ES')}</div>
                </div>
                <span
                  style={{
                    background: r.isPenalty ? '#F6DCD3' : '#E5EFD6',
                    color: r.isPenalty ? '#A0402A' : '#40682A',
                    fontWeight: 800,
                    fontSize: 12,
                    padding: '4px 8px',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                  }}
                >
                  −{r.points} pts
                </span>
                <button onClick={() => onDeleteRedemption(r.id)} title="Eliminar canje" style={{ ...BTN_LIGHT, flex: '0 0 auto', padding: '6px 8px' }}>
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
