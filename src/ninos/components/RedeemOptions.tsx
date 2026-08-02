import { useState } from 'react'
import { isConceptVariableCost } from '../../shared/logic'
import type { RewardConcept } from '../../shared/types'

interface Props {
  concepts: RewardConcept[]
  currentPoints: number
  onRedeem: (points: number, concept: RewardConcept) => Promise<{ ok: boolean; error?: string }>
  onBack: () => void
}

/** Canjear puntos desde la interfaz del niño (MOO-38). Reutiliza `redeemChildPoints` (ya usado
 *  por el panel de padres). Antes filtraba los conceptos marcados como penalización, para que
 *  un hijo no pudiera autoaplicarse una; desde MOO2-52 ya no hace falta, porque las
 *  penalizaciones dejaron de ser conceptos de canje y solo existen en la pantalla de padres. */
export function RedeemOptions({ concepts, currentPoints, onRedeem, onBack }: Props) {
  const [conceptId, setConceptId] = useState<string | null>(concepts[0]?.id ?? null)
  const [redeemVal, setRedeemVal] = useState('')
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null)
  const selectedConcept = concepts.find((c) => c.id === conceptId)
  const pts = selectedConcept && !isConceptVariableCost(selectedConcept) ? selectedConcept.cost ?? 0 : parseInt(redeemVal, 10) || 0
  const insufficientPoints = pts > 0 && pts > currentPoints

  function selectConcept(id: string) {
    setConceptId(id)
    setRedeemVal('')
    setMsg(null)
  }

  async function confirmRedeem() {
    if (!selectedConcept || pts <= 0 || insufficientPoints) return
    const result = await onRedeem(pts, selectedConcept)
    if (!result.ok) {
      setMsg({ text: result.error!, err: true })
      return
    }
    setRedeemVal('')
    setMsg({ text: `¡Canjeados ${pts} pts por ${selectedConcept.label} ${selectedConcept.emoji}!`, err: false })
  }

  return (
    <main style={{ flex: 1, padding: '8px 16px 44px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        onClick={onBack}
        style={{
          alignSelf: 'flex-start',
          padding: '8px 14px',
          borderRadius: 12,
          border: '1px solid #EADFCB',
          background: '#FFFDF6',
          color: '#6E6045',
          fontWeight: 800,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        ← Volver a mis misiones
      </button>

      <div style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 19, padding: '4px 6px 2px' }}>Canjear mis puntos</div>

      {concepts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9A8E77' }}>
          <div style={{ fontSize: 40 }}>🛍️</div>
          <div style={{ marginTop: 10, fontWeight: 700, fontSize: 16 }}>Todavía no hay nada que puedas canjear</div>
          <div style={{ marginTop: 4, fontSize: 13.5 }}>Pide a tus padres que añadan algún premio.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {concepts.map((c) => {
              const active = c.id === conceptId
              return (
                <button
                  key={c.id}
                  onClick={() => selectConcept(c.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    textAlign: 'left',
                    background: active ? '#DDEBC9' : '#FFFDF6',
                    border: active ? '2px solid #5B8C3E' : '1px solid #EADFCB',
                    borderRadius: 18,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(58,50,40,.05)',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 13,
                      background: active ? '#CFE0B5' : '#F1ECDD',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                      flex: '0 0 auto',
                    }}
                  >
                    {c.emoji}
                  </div>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: 15, color: '#3A3228' }}>{c.label}</div>
                  <span
                    style={{
                      background: active ? '#CFE0B5' : '#F1ECDD',
                      color: '#40682A',
                      fontWeight: 800,
                      fontSize: 12,
                      padding: '5px 9px',
                      borderRadius: 999,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isConceptVariableCost(c) ? 'a elegir' : `${c.cost} pts`}
                  </span>
                </button>
              )
            })}
          </div>

          {selectedConcept && (
            <div style={{ background: '#FBF7EC', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {isConceptVariableCost(selectedConcept) ? (
                <input
                  type="number"
                  value={redeemVal}
                  onChange={(e) => {
                    setRedeemVal(e.target.value)
                    setMsg(null)
                  }}
                  placeholder="¿Cuántos puntos?"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E0D6C2', fontSize: 15, fontWeight: 700, color: '#3A3228' }}
                />
              ) : (
                <div style={{ fontWeight: 700, fontSize: 14, color: '#6E6045' }}>Coste: {pts} pts</div>
              )}
              {insufficientPoints && <div style={{ fontSize: 12.5, fontWeight: 700, color: '#A04A32' }}>Todavía no tienes suficientes puntos.</div>}
              <button
                onClick={confirmRedeem}
                disabled={pts <= 0 || insufficientPoints}
                style={{
                  padding: '11px 8px',
                  borderRadius: 13,
                  border: 'none',
                  cursor: pts <= 0 || insufficientPoints ? 'not-allowed' : 'pointer',
                  fontWeight: 800,
                  fontSize: 14,
                  background: pts <= 0 || insufficientPoints ? '#DDEBC9' : '#5B8C3E',
                  color: pts <= 0 || insufficientPoints ? '#8FAE7A' : '#F6F1E2',
                }}
              >
                🌻 Canjear
              </button>
              {msg && <div style={{ fontSize: 12.5, fontWeight: 700, color: msg.err ? '#A04A32' : '#3F6B26' }}>{msg.text}</div>}
            </div>
          )}
        </>
      )}
    </main>
  )
}
