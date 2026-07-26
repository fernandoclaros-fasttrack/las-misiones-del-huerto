import { useState } from 'react'
import { EmojiPicker } from '../../shared/components/EmojiPicker'
import { EMOJI_PALETTE } from '../../shared/constants'
import type { RewardConcept } from '../../shared/types'
import { BTN_GO, BTN_MINI } from '../styles'

interface Props {
  concepts: RewardConcept[]
  onRemoveConcept: (id: string) => void
  showConceptForm: boolean
  onToggleConceptForm: () => void
  newConceptLabel: string
  onNewConceptLabelChange: (v: string) => void
  newConceptEmoji: string
  onNewConceptEmojiChange: (v: string) => void
  newConceptIsPenalty: boolean
  onNewConceptIsPenaltyChange: (v: boolean) => void
  newConceptCost: string
  onNewConceptCostChange: (v: string) => void
  onAddConcept: () => void
  onEditConceptCost: (id: string, cost: number | null) => void
}

export function ConceptsCard(props: Props) {
  const {
    concepts,
    onRemoveConcept,
    showConceptForm,
    onToggleConceptForm,
    newConceptLabel,
    onNewConceptLabelChange,
    newConceptEmoji,
    onNewConceptEmojiChange,
    newConceptIsPenalty,
    onNewConceptIsPenaltyChange,
    newConceptCost,
    onNewConceptCostChange,
    onAddConcept,
    onEditConceptCost,
  } = props

  const [editingCostId, setEditingCostId] = useState<string | null>(null)
  const [costDraft, setCostDraft] = useState('')

  function startEditCost(concept: RewardConcept) {
    setEditingCostId(concept.id)
    setCostDraft(concept.cost ? String(concept.cost) : '')
  }
  function saveCost(id: string) {
    const parsed = parseInt(costDraft, 10)
    onEditConceptCost(id, Number.isFinite(parsed) && parsed > 0 ? parsed : null)
    setEditingCostId(null)
  }

  return (
    <div style={{ background: '#FFFDF6', border: '1px solid #EADFCB', borderRadius: 18, padding: '14px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 15 }}>Conceptos de canje</span>
        <button onClick={onToggleConceptForm} style={BTN_MINI}>
          + concepto
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {concepts.map((c) => (
          <span
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 11px',
              borderRadius: 11,
              border: c.isPenalty ? '1px solid #E3B8AA' : '1px solid #E4DBC8',
              background: c.isPenalty ? '#F8ECE6' : '#FBF7EC',
              color: '#3A3228',
            }}
          >
            <span>{c.emoji}</span>
            <span style={{ marginLeft: 5, fontWeight: 800, fontSize: 13 }}>{c.label}</span>
            {editingCostId === c.id ? (
              <>
                <input
                  autoFocus
                  type="number"
                  value={costDraft}
                  onChange={(e) => setCostDraft(e.target.value)}
                  placeholder="pts"
                  style={{ marginLeft: 7, width: 52, padding: '3px 5px', borderRadius: 6, border: '1px solid #E0D6C2', fontSize: 12, fontWeight: 700 }}
                />
                <span onClick={() => saveCost(c.id)} style={{ marginLeft: 5, fontWeight: 900, cursor: 'pointer', color: '#3F6B26' }}>
                  ✓
                </span>
                <span onClick={() => setEditingCostId(null)} style={{ marginLeft: 3, opacity: 0.55, fontWeight: 900, cursor: 'pointer' }}>
                  ×
                </span>
              </>
            ) : (
              <span
                onClick={() => startEditCost(c)}
                title="Editar coste"
                style={{ marginLeft: 7, fontSize: 11.5, fontWeight: 700, color: '#8A7E6B', cursor: 'pointer', textDecoration: 'underline dotted' }}
              >
                {c.cost ? `${c.cost} pts` : 'sin coste'}
              </span>
            )}
            {editingCostId !== c.id && (
              <span onClick={() => onRemoveConcept(c.id)} style={{ marginLeft: 7, opacity: 0.55, fontWeight: 900, cursor: 'pointer' }}>
                ×
              </span>
            )}
          </span>
        ))}
        {concepts.length === 0 && <span style={{ fontSize: 12.5, color: '#8A7E6B' }}>Sin conceptos todavía.</span>}
      </div>

      {showConceptForm && (
        <div style={{ marginTop: 10, background: '#FBF7EC', borderRadius: 10, padding: 10 }}>
          <input
            value={newConceptLabel}
            onChange={(e) => onNewConceptLabelChange(e.target.value)}
            placeholder="Nombre (p. ej. Cine)"
            style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid #E0D6C2', fontSize: 14, fontWeight: 700, color: '#3A3228' }}
          />
          <div style={{ marginTop: 9 }}>
            <EmojiPicker options={EMOJI_PALETTE} selected={newConceptEmoji} onSelect={onNewConceptEmojiChange} />
          </div>
          <input
            type="number"
            value={newConceptCost}
            onChange={(e) => onNewConceptCostChange(e.target.value)}
            placeholder="Coste en puntos (opcional)"
            style={{ marginTop: 9, width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid #E0D6C2', fontSize: 14, fontWeight: 700, color: '#3A3228' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, fontSize: 12.5, fontWeight: 700, color: '#6E6045', cursor: 'pointer' }}>
            <input type="checkbox" checked={newConceptIsPenalty} onChange={(e) => onNewConceptIsPenaltyChange(e.target.checked)} />
            Es una penalización
          </label>
          <button onClick={onAddConcept} style={{ ...BTN_GO, marginTop: 9, width: '100%' }}>
            Añadir concepto
          </button>
        </div>
      )}
    </div>
  )
}
