import { EmojiPicker } from '../../shared/components/EmojiPicker'
import { EMOJI_PALETTE } from '../../shared/constants'
import type { Day } from '../../shared/types'
import { BTN_CANCEL, BTN_SAVE, INPUT_STYLE, NUMBER_INPUT_STYLE } from '../styles'

interface Props {
  days: Day[]
  accent: string
  emoji: string
  onEmojiChange: (emoji: string) => void
  selectedDays: number[]
  onToggleDay: (index: number) => void
  title: string
  onTitleChange: (title: string) => void
  points: number | string
  onPointsChange: (points: string) => void
  onSave: () => void
  onCancel: () => void
}

export function NewMissionForm({ days, accent, emoji, onEmojiChange, selectedDays, onToggleDay, title, onTitleChange, points, onPointsChange, onSave, onCancel }: Props) {
  return (
    <div style={{ background: '#FBF7EC', border: '2px dashed #C9BE9F', borderRadius: 18, padding: '15px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#7C6E52', marginBottom: 8 }}>Nueva misión</div>
      <div style={{ marginBottom: 12 }}>
        <EmojiPicker options={EMOJI_PALETTE} selected={emoji} onSelect={onEmojiChange} />
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#7C6E52', marginBottom: 6 }}>¿Qué día o días aparece?</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {days.map((d, i) => {
          const on = selectedDays.includes(i)
          return (
            <button
              key={d.short}
              onClick={() => onToggleDay(i)}
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

      <input value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Título de la misión" style={INPUT_STYLE} />
      <div style={{ display: 'flex', gap: 8, marginTop: 9, alignItems: 'center' }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: '#7C6E52' }}>Puntos</label>
        <input type="number" value={points} onChange={(e) => onPointsChange(e.target.value)} style={NUMBER_INPUT_STYLE} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={onSave} style={BTN_SAVE}>
          Añadir misión
        </button>
        <button onClick={onCancel} style={BTN_CANCEL}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
