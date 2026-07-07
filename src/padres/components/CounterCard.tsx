import { EmojiPicker } from '../../shared/components/EmojiPicker'
import { EMOJI_PALETTE } from '../../shared/constants'
import type { RewardConcept } from '../../shared/types'
import {
  BTN_CONFIRM,
  BTN_DANGER,
  BTN_EDIT,
  BTN_GHOST,
  BTN_GO,
  BTN_MINI,
  BTN_PENALTY,
  BTN_REDEEM,
  BTN_RESET,
  PANEL_INPUT_STYLE,
} from '../styles'

export type PanelName = 'edit' | 'penalty' | 'reset' | 'redeem' | null

interface Props {
  acumulado: number
  panel: PanelName
  onOpenPanel: (name: Exclude<PanelName, null>) => void
  onClosePanel: () => void

  editVal: string
  onEditValChange: (v: string) => void
  onSaveEdit: () => void

  penaltyVal: string
  onPenaltyValChange: (v: string) => void
  onApplyPenalty: () => void

  onDoReset: () => void

  concepts: RewardConcept[]
  redeemConceptId: string | null
  onSelectConcept: (id: string) => void
  onRemoveConcept: (id: string) => void
  showConceptForm: boolean
  onToggleConceptForm: () => void
  newConceptLabel: string
  onNewConceptLabelChange: (v: string) => void
  newConceptEmoji: string
  onNewConceptEmojiChange: (v: string) => void
  onAddConcept: () => void
  redeemVal: string
  onRedeemValChange: (v: string) => void
  onConfirmRedeem: () => void
  redeemMsg: { text: string; err: boolean } | null
}

export function CounterCard(props: Props) {
  const {
    acumulado,
    panel,
    onOpenPanel,
    onClosePanel,
    editVal,
    onEditValChange,
    onSaveEdit,
    penaltyVal,
    onPenaltyValChange,
    onApplyPenalty,
    onDoReset,
    concepts,
    redeemConceptId,
    onSelectConcept,
    onRemoveConcept,
    showConceptForm,
    onToggleConceptForm,
    newConceptLabel,
    onNewConceptLabelChange,
    newConceptEmoji,
    onNewConceptEmojiChange,
    onAddConcept,
    redeemVal,
    onRedeemValChange,
    onConfirmRedeem,
    redeemMsg,
  } = props

  return (
    <div style={{ background: '#3B3226', color: '#F5EFE0', borderRadius: 18, padding: '16px 18px', boxShadow: '0 6px 16px rgba(58,50,40,.18)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12.5, letterSpacing: 0.4, textTransform: 'uppercase', opacity: 0.7, fontWeight: 800 }}>Puntos acumulados</div>
          <div style={{ fontFamily: "'Bitter', serif", fontWeight: 700, fontSize: 44, lineHeight: 1, marginTop: 4 }}>{acumulado}</div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.6, textAlign: 'right', lineHeight: 1.4 }}>
          acumulados =<br />
          ganados − canjeados
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
        <button onClick={() => onOpenPanel('edit')} style={BTN_EDIT}>
          ✏️ Editar
        </button>
        <button onClick={() => onOpenPanel('penalty')} style={BTN_PENALTY}>
          ➖ Penalizar
        </button>
        <button onClick={() => onOpenPanel('redeem')} style={BTN_REDEEM}>
          🎁 Canjear
        </button>
        <button onClick={() => onOpenPanel('reset')} style={BTN_RESET}>
          ↺ Resetear
        </button>
      </div>

      {panel === 'edit' && (
        <div style={{ marginTop: 14, background: '#4A4032', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Fijar puntos acumulados</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" value={editVal} onChange={(e) => onEditValChange(e.target.value)} style={PANEL_INPUT_STYLE} />
            <button onClick={onSaveEdit} style={BTN_GO}>
              Guardar
            </button>
            <button onClick={onClosePanel} style={BTN_GHOST}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {panel === 'penalty' && (
        <div style={{ marginTop: 14, background: '#4A4032', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Restar puntos (penalización)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              value={penaltyVal}
              onChange={(e) => onPenaltyValChange(e.target.value)}
              placeholder="p. ej. 15"
              style={PANEL_INPUT_STYLE}
            />
            <button onClick={onApplyPenalty} style={BTN_GO}>
              Aplicar
            </button>
            <button onClick={onClosePanel} style={BTN_GHOST}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {panel === 'reset' && (
        <div style={{ marginTop: 14, background: '#4A4032', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>¿Poner el contador a cero?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDoReset} style={BTN_DANGER}>
              Sí, resetear a 0
            </button>
            <button onClick={onClosePanel} style={BTN_GHOST}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {panel === 'redeem' && (
        <div style={{ marginTop: 14, background: '#4A4032', borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Canjear por una recompensa</span>
            <button onClick={onToggleConceptForm} style={BTN_MINI}>
              + concepto
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {concepts.map((c) => {
              const active = c.id === redeemConceptId
              return (
                <button
                  key={c.id}
                  onClick={() => onSelectConcept(c.id)}
                  style={
                    active
                      ? { display: 'flex', alignItems: 'center', padding: '8px 11px', borderRadius: 11, border: '2px solid #7FB25C', background: '#3B3226', color: '#EFE7CF', cursor: 'pointer' }
                      : { display: 'flex', alignItems: 'center', padding: '8px 11px', borderRadius: 11, border: '1px solid #6A5E48', background: '#5A4E3C', color: '#D8CDB4', cursor: 'pointer' }
                  }
                >
                  <span>{c.emoji}</span>
                  <span style={{ marginLeft: 5, fontWeight: 800, fontSize: 13 }}>{c.label}</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveConcept(c.id)
                    }}
                    style={{ marginLeft: 7, opacity: 0.55, fontWeight: 900 }}
                  >
                    ×
                  </span>
                </button>
              )
            })}
          </div>

          {showConceptForm && (
            <div style={{ marginTop: 10, background: '#3B3226', borderRadius: 10, padding: 10 }}>
              <input
                value={newConceptLabel}
                onChange={(e) => onNewConceptLabelChange(e.target.value)}
                placeholder="Nombre (p. ej. Cine)"
                style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: 'none', fontSize: 14, fontWeight: 700, color: '#3A3228' }}
              />
              <div style={{ marginTop: 9 }}>
                <EmojiPicker options={EMOJI_PALETTE} selected={newConceptEmoji} onSelect={onNewConceptEmojiChange} />
              </div>
              <button onClick={onAddConcept} style={{ ...BTN_GO, marginTop: 9, width: '100%' }}>
                Añadir concepto
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <input
              type="number"
              value={redeemVal}
              onChange={(e) => onRedeemValChange(e.target.value)}
              placeholder="puntos"
              style={PANEL_INPUT_STYLE}
            />
            <button onClick={onConfirmRedeem} style={BTN_CONFIRM}>
              Confirmar canje
            </button>
          </div>
          {redeemMsg && (
            <div style={{ marginTop: 9, fontSize: 13, color: redeemMsg.err ? '#F0B49A' : '#BFE08A', fontWeight: 700 }}>{redeemMsg.text}</div>
          )}
        </div>
      )}
    </div>
  )
}
