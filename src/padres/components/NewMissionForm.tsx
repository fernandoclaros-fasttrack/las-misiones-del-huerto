import { EmojiPicker } from '../../shared/components/EmojiPicker'
import { EMOJI_PALETTE } from '../../shared/constants'
import type { Child, Day } from '../../shared/types'
import { BTN_CANCEL, BTN_SAVE, INPUT_STYLE, NUMBER_INPUT_STYLE } from '../styles'

interface Props {
  days: Day[]
  /** Hijos de la familia; el selector de asignación (MOO-27) solo aparece si hay más de uno. */
  kids: Child[]
  accent: string
  emoji: string
  onEmojiChange: (emoji: string) => void
  selectedDays: number[]
  onToggleDay: (index: number) => void
  /** Si la misión es one-off (MOO2-56/61): sustituye el selector de días por una fecha única. */
  isOneOff: boolean
  onToggleOneOff: () => void
  oneOffDate: string
  onOneOffDateChange: (date: string) => void
  assignedTo: string[]
  onToggleChild: (childId: string) => void
  title: string
  onTitleChange: (title: string) => void
  points: number | string
  onPointsChange: (points: string) => void
  onSave: () => void
  onCancel: () => void
}

function chipStyle(on: boolean, accent: string) {
  return on
    ? { padding: '8px 12px', borderRadius: 11, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, background: accent, color: '#F6F1E2' }
    : { padding: '8px 12px', borderRadius: 11, border: '1px solid #D6CBB2', cursor: 'pointer', fontWeight: 800, fontSize: 13, background: '#fff', color: '#8A7C60' }
}

export function NewMissionForm({
  days,
  kids,
  accent,
  emoji,
  onEmojiChange,
  selectedDays,
  onToggleDay,
  isOneOff,
  onToggleOneOff,
  oneOffDate,
  onOneOffDateChange,
  assignedTo,
  onToggleChild,
  title,
  onTitleChange,
  points,
  onPointsChange,
  onSave,
  onCancel,
}: Props) {
  return (
    <div style={{ background: '#FBF7EC', border: '2px dashed #C9BE9F', borderRadius: 18, padding: '15px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#7C6E52', marginBottom: 8 }}>Nueva misión</div>
      <div style={{ marginBottom: 12 }}>
        <EmojiPicker options={EMOJI_PALETTE} selected={emoji} onSelect={onEmojiChange} />
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#7C6E52', marginBottom: 6 }}>¿Se repite cada semana?</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button onClick={() => (isOneOff ? onToggleOneOff() : undefined)} style={chipStyle(!isOneOff, accent)}>
          Recurrente
        </button>
        <button onClick={() => (isOneOff ? undefined : onToggleOneOff())} style={chipStyle(isOneOff, accent)}>
          Un solo día
        </button>
      </div>

      {isOneOff ? (
        <>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#7C6E52', marginBottom: 6 }}>¿Qué día?</div>
          <input type="date" value={oneOffDate} onChange={(e) => onOneOffDateChange(e.target.value)} style={{ ...INPUT_STYLE, marginBottom: 12 }} />
        </>
      ) : (
        <>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#7C6E52', marginBottom: 6 }}>¿Qué día o días aparece?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {days.map((d, i) => (
              <button key={d.short} onClick={() => onToggleDay(i)} style={chipStyle(selectedDays.includes(i), accent)}>
                {d.short}
              </button>
            ))}
          </div>
        </>
      )}

      {kids.length > 1 && (
        <>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#7C6E52', marginBottom: 6 }}>¿A quién está asignada?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {kids.map((kid) => {
              const on = assignedTo.includes(kid.id)
              return (
                <button
                  key={kid.id}
                  onClick={() => onToggleChild(kid.id)}
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
