import { useState } from 'react'
import { EmojiPicker } from '../../shared/components/EmojiPicker'
import { CONCEPT_EMOJI_PALETTE } from '../../shared/constants'
import { isConceptVariableCost } from '../../shared/logic'
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
  newConceptIsVariableCost: boolean
  onNewConceptIsVariableCostChange: (v: boolean) => void
  newConceptCost: string
  onNewConceptCostChange: (v: string) => void
  onAddConcept: () => void
  onEditConcept: (id: string, changes: { isVariableCost: boolean; cost: number | null }) => void
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
    newConceptIsVariableCost,
    onNewConceptIsVariableCostChange,
    newConceptCost,
    onNewConceptCostChange,
    onAddConcept,
    onEditConcept,
  } = props

  const [editingCostId, setEditingCostId] = useState<string | null>(null)
  const [costDraft, setCostDraft] = useState('')
  const [editIsVariableCost, setEditIsVariableCost] = useState(false)

  function startEditCost(concept: RewardConcept) {
    setEditingCostId(concept.id)
    setCostDraft(concept.cost ? String(concept.cost) : '')
    setEditIsVariableCost(isConceptVariableCost(concept))
  }
  const canSaveEdit = editIsVariableCost || (parseInt(costDraft, 10) || 0) > 0
  function saveCost(id: string) {
    if (!canSaveEdit) return
    const parsed = parseInt(costDraft, 10)
    onEditConcept(id, { isVariableCost: editIsVariableCost, cost: Number.isFinite(parsed) && parsed > 0 ? parsed : null })
    setEditingCostId(null)
  }
  const canAddConcept = newConceptLabel.trim() !== '' && (newConceptIsVariableCost || (parseInt(newConceptCost, 10) || 0) > 0)

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
              border: '1px solid #E4DBC8',
              background: '#FBF7EC',
              color: '#3A3228',
            }}
          >
            <span>{c.emoji}</span>
            <span style={{ marginLeft: 5, fontWeight: 800, fontSize: 13 }}>{c.label}</span>
            {editingCostId === c.id ? (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 7, fontSize: 11, fontWeight: 700, color: '#6E6045', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editIsVariableCost} onChange={(e) => setEditIsVariableCost(e.target.checked)} />
                  variable
                </label>
                {!editIsVariableCost && (
                  <input
                    autoFocus
                    type="number"
                    value={costDraft}
                    onChange={(e) => setCostDraft(e.target.value)}
                    placeholder="pts"
                    style={{ marginLeft: 5, width: 52, padding: '3px 5px', borderRadius: 6, border: '1px solid #E0D6C2', fontSize: 12, fontWeight: 700 }}
                  />
                )}
                <span
                  onClick={() => saveCost(c.id)}
                  style={{ marginLeft: 5, fontWeight: 900, cursor: canSaveEdit ? 'pointer' : 'default', color: '#3F6B26', opacity: canSaveEdit ? 1 : 0.4 }}
                >
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
                {isConceptVariableCost(c) ? 'variable' : `${c.cost} pts`}
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
            <EmojiPicker options={CONCEPT_EMOJI_PALETTE} selected={newConceptEmoji} onSelect={onNewConceptEmojiChange} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, fontSize: 12.5, fontWeight: 700, color: '#6E6045', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={newConceptIsVariableCost}
              onChange={(e) => onNewConceptIsVariableCostChange(e.target.checked)}
            />
            ¿Coste variable? (se pedirá el importe en cada canje)
          </label>
          {!newConceptIsVariableCost && (
            <input
              type="number"
              value={newConceptCost}
              onChange={(e) => onNewConceptCostChange(e.target.value)}
              placeholder="Coste en puntos"
              style={{ marginTop: 9, width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid #E0D6C2', fontSize: 14, fontWeight: 700, color: '#3A3228' }}
            />
          )}
          <button onClick={onAddConcept} disabled={!canAddConcept} style={{ ...BTN_GO, marginTop: 9, width: '100%', opacity: canAddConcept ? 1 : 0.5 }}>
            Añadir concepto
          </button>
        </div>
      )}
    </div>
  )
}
