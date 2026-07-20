import type { ReactNode } from 'react'
import { EmojiPicker } from '../../shared/components/EmojiPicker'
import { EMOJI_PALETTE, WEEKDAY_INITIALS } from '../../shared/constants'
import { assignedToLabel } from '../../shared/logic'
import type { Child, Day, Mission } from '../../shared/types'
import { BTN_CANCEL, BTN_SAVE, ICON_BTN, INPUT_STYLE, NUMBER_INPUT_STYLE } from '../styles'

interface Props {
  mission: Mission
  editing: boolean
  days: Day[]
  /** Hijos de la familia; el selector de asignación (MOO-27) solo aparece si hay más de uno. */
  kids: Child[]
  accent: string
  /** Asa de arrastre para reordenar (MOO-29); `null` cuando no se puede arrastrar (editando,
   *  o solo hay una misión ese día). Se renderiza tal cual, la gestiona `MissionsList`. */
  dragHandle?: ReactNode
  draftEmoji: string
  draftTitle: string
  draftPoints: number | string
  draftDays: number[]
  draftAssignedTo: string[]
  onDraftEmojiChange: (emoji: string) => void
  onDraftTitleChange: (title: string) => void
  onDraftPointsChange: (points: string) => void
  onToggleDraftDay: (index: number) => void
  onToggleDraftChild: (childId: string) => void
  onSave: () => void
  onCancel: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export function MissionCard({
  mission,
  editing,
  days,
  kids,
  accent,
  dragHandle,
  draftEmoji,
  draftTitle,
  draftPoints,
  draftDays,
  draftAssignedTo,
  onDraftEmojiChange,
  onDraftTitleChange,
  onDraftPointsChange,
  onToggleDraftDay,
  onToggleDraftChild,
  onSave,
  onCancel,
  onEdit,
  onDuplicate,
  onDelete,
}: Props) {
  const cardStyle = { background: '#FFFDF6', border: '1px solid #EADFCB', borderRadius: 18, padding: '14px 15px', boxShadow: '0 2px 5px rgba(58,50,40,.05)' }

  if (editing) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#7C6E52', marginBottom: 8 }}>Editar misión</div>
        <div style={{ marginBottom: 10 }}>
          <EmojiPicker options={EMOJI_PALETTE} selected={draftEmoji} onSelect={onDraftEmojiChange} />
        </div>
        <input value={draftTitle} onChange={(e) => onDraftTitleChange(e.target.value)} placeholder="Título de la misión" style={INPUT_STYLE} />
        <div style={{ display: 'flex', gap: 8, marginTop: 9, alignItems: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#7C6E52' }}>Puntos</label>
          <input type="number" value={draftPoints} onChange={(e) => onDraftPointsChange(e.target.value)} style={NUMBER_INPUT_STYLE} />
        </div>

        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#7C6E52', margin: '12px 0 6px' }}>¿Qué día o días aparece?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {days.map((d, i) => {
            const on = draftDays.includes(i)
            return (
              <button
                key={d.short}
                onClick={() => onToggleDraftDay(i)}
                style={
                  on
                    ? { padding: '8px 12px', borderRadius: 11, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, background: accent, color: '#F6F1E2' }
                    : { padding: '8px 12px', borderRadius: 11, border: '1px solid #D6CBB2', cursor: 'pointer', fontWeight: 800, fontSize: 13, background: '#fff', color: '#8A7C60' }
                }
              >
                {d.short}
              </button>
            )
          })}
        </div>

        {kids.length > 1 && (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#7C6E52', margin: '12px 0 6px' }}>¿A quién está asignada?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {kids.map((kid) => {
                const on = draftAssignedTo.includes(kid.id)
                return (
                  <button
                    key={kid.id}
                    onClick={() => onToggleDraftChild(kid.id)}
                    style={
                      on
                        ? { padding: '8px 12px', borderRadius: 11, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, background: accent, color: '#F6F1E2' }
                        : { padding: '8px 12px', borderRadius: 11, border: '1px solid #D6CBB2', cursor: 'pointer', fontWeight: 800, fontSize: 13, background: '#fff', color: '#8A7C60' }
                    }
                  >
                    {kid.name}
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={onSave} style={BTN_SAVE}>
            Guardar
          </button>
          <button onClick={onCancel} style={BTN_CANCEL}>
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  const assignedLabel = assignedToLabel(mission, kids)
  const activeDaysDescription =
    mission.activeDays.length === days.length
      ? 'Todos los días'
      : mission.activeDays
          .slice()
          .sort((a, b) => a - b)
          .map((i) => days[i]?.label)
          .filter(Boolean)
          .join(', ')

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {dragHandle}
        <div style={{ flex: '0 0 auto', width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 25, background: '#F1ECDD' }}>
          {mission.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{mission.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 5 }}>
            <div role="group" aria-label={`Días activos: ${activeDaysDescription}`} style={{ display: 'flex', gap: 4 }}>
              {WEEKDAY_INITIALS.map((letter, i) => {
                const on = mission.activeDays.includes(i)
                return (
                  <span
                    key={i}
                    aria-hidden="true"
                    style={
                      on
                        ? {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            fontSize: 10,
                            fontWeight: 800,
                            lineHeight: 1,
                            background: accent,
                            color: '#F6F1E2',
                          }
                        : {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 16,
                            height: 16,
                            fontSize: 11,
                            fontWeight: 700,
                            lineHeight: 1,
                            color: '#8A7C60',
                          }
                    }
                  >
                    {letter}
                  </span>
                )
              })}
            </div>
            <span style={{ flex: '0 0 auto', background: '#F1ECDD', color: '#7C6E52', fontWeight: 800, fontSize: 12.5, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
              {mission.points} pts
            </span>
          </div>
          {assignedLabel && <div style={{ fontSize: 12, color: '#8A7E6B', fontWeight: 700, marginTop: 3 }}>{assignedLabel}</div>}
        </div>
        <button onClick={onEdit} title="Editar" style={ICON_BTN}>
          ✏️
        </button>
        <button onClick={onDuplicate} title="Duplicar" style={ICON_BTN}>
          📋
        </button>
        <button onClick={onDelete} title="Borrar" style={ICON_BTN}>
          🗑️
        </button>
      </div>
    </div>
  )
}
