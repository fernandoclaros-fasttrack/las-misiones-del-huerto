import { useRef, useState } from 'react'
import { isConceptVariableCost } from '../../shared/logic'
import type { BalanceEntry } from '../../shared/logic'
import type { RewardConcept } from '../../shared/types'
import { BTN_CANCEL, BTN_SAVE, PANEL_INPUT_STYLE, btn } from '../styles'

type PanelName = null | 'edit' | 'award' | 'penalize' | 'redeem' | 'history'

const BTN_LIGHT = btn('#F1ECDD', '#6E6045', { flex: 1, padding: '8px 6px', fontSize: 12.5 })
const BTN_LIGHT_GREEN = btn('#DDEBC9', '#3F6B26', { flex: 1, padding: '8px 6px', fontSize: 12.5 })
const BTN_LIGHT_RED = btn('#F3DCD3', '#A04A32', { flex: 1, padding: '8px 6px', fontSize: 12.5 })

/** Dar y quitar puntos son el mismo panel en las dos direcciones (MOO2-52): mismos campos,
 *  misma validación y mismo registro, solo cambia el signo y los textos. Mantenerlos como un
 *  único panel parametrizado es lo que hace que las dos acciones se sientan iguales, que es
 *  justamente lo que pide el ticket. */
const ADJUST_META = {
  award: { sign: 1, verb: 'Dar', done: 'Dados', placeholder: 'Motivo (p. ej. ayudó a recoger la mesa)' },
  penalize: { sign: -1, verb: 'Quitar', done: 'Quitados', placeholder: 'Motivo (p. ej. no recogió su cuarto)' },
} as const

interface Props {
  currentPoints: number
  concepts: RewardConcept[]
  entries: BalanceEntry[]
  onEditPoints: (value: number) => void
  onAdjust: (points: number, reason: string) => Promise<{ ok: boolean; error?: string }>
  onRedeem: (points: number, concept: RewardConcept) => Promise<{ ok: boolean; error?: string }>
  onDeleteRedemption: (redemptionId: string) => void
  onDeleteAdjustment: (adjustmentId: string) => void
}

export function ChildActionsPanel({
  currentPoints,
  concepts,
  entries,
  onEditPoints,
  onAdjust,
  onRedeem,
  onDeleteRedemption,
  onDeleteAdjustment,
}: Props) {
  const [panel, setPanel] = useState<PanelName>(null)
  const [editVal, setEditVal] = useState('')
  const [adjustVal, setAdjustVal] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [redeemVal, setRedeemVal] = useState('')
  const [conceptId, setConceptId] = useState<string | null>(concepts[0]?.id ?? null)
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null)
  /** Evita que un doble click aplique el ajuste dos veces: la transacción de Firestore tarda un
   *  momento y el panel no se cierra al confirmar (a propósito, para poder hacer varios ajustes
   *  seguidos), así que sin esto el segundo click entra antes de que el primero termine.
   *  Tiene que ser un ref y no solo el estado: dos clicks en el mismo tick leen el mismo valor
   *  de `adjusting` (React no ha vuelto a renderizar todavía) y los dos pasarían el guard. El
   *  estado se mantiene solo para poder deshabilitar el botón visualmente. */
  const adjustingRef = useRef(false)
  const [adjusting, setAdjusting] = useState(false)
  const selectedConcept = concepts.find((c) => c.id === conceptId)
  const adjustMeta = panel === 'award' || panel === 'penalize' ? ADJUST_META[panel] : null

  function open(name: Exclude<PanelName, null>) {
    setPanel((cur) => (cur === name ? null : name))
    setMsg(null)
    if (name === 'edit') setEditVal(String(currentPoints))
    if (name === 'award' || name === 'penalize') {
      setAdjustVal('')
      setAdjustReason('')
    }
    if (name === 'redeem') setRedeemVal('')
  }

  function saveEdit() {
    onEditPoints(parseInt(editVal, 10) || 0)
    setPanel(null)
  }

  async function confirmAdjust() {
    if (adjustingRef.current || !adjustMeta) return
    const magnitude = parseInt(adjustVal, 10) || 0
    // La dirección la decide el panel, no el signo que escriba el padre/madre: un negativo en
    // "Quitar" significaría sumar, que es lo contrario de lo que dice el botón.
    if (magnitude < 0) {
      setMsg({ text: 'Introduce un número positivo.', err: true })
      return
    }
    adjustingRef.current = true
    setAdjusting(true)
    try {
      const result = await onAdjust(magnitude * adjustMeta.sign, adjustReason)
      if (!result.ok) {
        setMsg({ text: result.error!, err: true })
        return
      }
      setAdjustVal('')
      setAdjustReason('')
      setMsg({ text: `${adjustMeta.done} ${magnitude} pts.`, err: false })
    } finally {
      adjustingRef.current = false
      setAdjusting(false)
    }
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button onClick={() => open('edit')} style={BTN_LIGHT}>
          ✏️ Editar
        </button>
        <button onClick={() => open('award')} style={BTN_LIGHT_GREEN}>
          ➕ Dar
        </button>
        <button onClick={() => open('penalize')} style={BTN_LIGHT_RED}>
          ➖ Quitar
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

      {adjustMeta && (
        <div style={{ marginTop: 8, background: '#FBF7EC', borderRadius: 11, padding: 10 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              type="number"
              value={adjustVal}
              onChange={(e) => setAdjustVal(e.target.value)}
              placeholder="puntos"
              style={PANEL_INPUT_STYLE}
            />
            <button onClick={confirmAdjust} disabled={adjusting} style={{ ...BTN_SAVE, opacity: adjusting ? 0.6 : 1 }}>
              {adjustMeta.verb}
            </button>
            <button onClick={() => setPanel(null)} style={BTN_CANCEL}>
              Cancelar
            </button>
          </div>
          <input
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
            placeholder={adjustMeta.placeholder}
            // `PANEL_INPUT_STYLE` trae `flex: 1` porque el resto de campos van en una fila
            // flex; este va suelto en el panel, así que necesita ancho propio.
            style={{ ...PANEL_INPUT_STYLE, flex: undefined, width: '100%', boxSizing: 'border-box' }}
          />
          {msg && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: msg.err ? '#A04A32' : '#3F6B26' }}>{msg.text}</div>}
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
          {entries.length === 0 ? (
            <div style={{ fontSize: 12.5, color: '#8A7E6B', fontWeight: 600, textAlign: 'center', padding: '4px 0' }}>Sin movimientos todavía.</div>
          ) : (
            entries.map((entry) => {
              // Un canje siempre resta puntos y se identifica por su concepto; un ajuste manual
              // (MOO2-51) lleva signo propio y un motivo escrito a mano. Se pintan con la misma
              // fila para que el historial se lea como una sola lista ordenada por fecha.
              const isRedemption = entry.kind === 'redemption'
              const { id, emoji, text, delta, timestamp } = isRedemption
                ? {
                    id: entry.redemption.id,
                    emoji: entry.redemption.conceptEmoji,
                    text: entry.redemption.conceptLabel,
                    delta: -entry.redemption.points,
                    timestamp: entry.redemption.timestamp,
                  }
                : {
                    id: entry.adjustment.id,
                    emoji: entry.adjustment.points >= 0 ? '➕' : '➖',
                    text: entry.adjustment.reason,
                    delta: entry.adjustment.points,
                    timestamp: entry.adjustment.timestamp,
                  }
              const negative = delta < 0
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 17 }}>{emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{text}</div>
                    <div style={{ fontSize: 11.5, color: '#8A7E6B', fontWeight: 600 }}>{new Date(timestamp).toLocaleDateString('es-ES')}</div>
                  </div>
                  <span
                    style={{
                      background: negative ? '#F6DCD3' : '#E5EFD6',
                      color: negative ? '#A0402A' : '#40682A',
                      fontWeight: 800,
                      fontSize: 12,
                      padding: '4px 8px',
                      borderRadius: 999,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {negative ? '−' : '+'}
                    {Math.abs(delta)} pts
                  </span>
                  <button
                    onClick={() => (isRedemption ? onDeleteRedemption(id) : onDeleteAdjustment(id))}
                    title={isRedemption ? 'Eliminar canje' : 'Eliminar ajuste'}
                    style={{ ...BTN_LIGHT, flex: '0 0 auto', padding: '6px 8px' }}
                  >
                    🗑️
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
