import { EmojiPicker } from '../../shared/components/EmojiPicker'
import { EMOJI_PALETTE, STATUS_META } from '../../shared/constants'
import type { Mission, MissionStatus } from '../../shared/types'
import { BTN_CANCEL, BTN_SAVE, ICON_BTN, INPUT_STYLE, NUMBER_INPUT_STYLE } from '../styles'

interface Props {
  mission: Mission
  editing: boolean
  draftEmoji: string
  draftTitle: string
  draftPoints: number | string
  onDraftEmojiChange: (emoji: string) => void
  onDraftTitleChange: (title: string) => void
  onDraftPointsChange: (points: string) => void
  onSave: () => void
  onCancel: () => void
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (status: MissionStatus) => void
}

export function MissionCard({
  mission,
  editing,
  draftEmoji,
  draftTitle,
  draftPoints,
  onDraftEmojiChange,
  onDraftTitleChange,
  onDraftPointsChange,
  onSave,
  onCancel,
  onEdit,
  onDelete,
  onStatusChange,
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

  const meta = STATUS_META[mission.status]
  const selectStyle = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 11,
    border: `1.5px solid ${meta.ring}`,
    background: meta.bg,
    color: meta.fg,
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
    WebkitAppearance: 'menulist' as const,
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: '0 0 auto', width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 25, background: '#F1ECDD' }}>
          {mission.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{mission.title}</div>
          <div style={{ fontSize: 12.5, color: '#8A7E6B', fontWeight: 700, marginTop: 2 }}>{mission.points} pts</div>
        </div>
        <button onClick={onEdit} title="Editar" style={ICON_BTN}>
          ✏️
        </button>
        <button onClick={onDelete} title="Borrar" style={ICON_BTN}>
          🗑️
        </button>
      </div>
      <div style={{ marginTop: 11 }}>
        <select value={mission.status} onChange={(e) => onStatusChange(e.target.value as MissionStatus)} style={selectStyle}>
          <option value="pendiente">🌰 Pendiente</option>
          <option value="progreso">🌱 En progreso</option>
          <option value="bloqueada">🥀 Bloqueada</option>
          <option value="completada">🌻 Completada</option>
        </select>
      </div>
    </div>
  )
}
