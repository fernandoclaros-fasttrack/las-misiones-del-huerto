import { useState } from 'react'
import { BTN_SAVE, ICON_BTN, INPUT_STYLE, NUMBER_INPUT_STYLE } from '../styles'
import type { MissionTemplate } from '../../shared/types'

interface Props {
  templates: MissionTemplate[]
  selectedIds: string[]
  onToggleSelect: (id: string) => void
  onCreateSelected: () => void
  onEditTemplate: (id: string, changes: { title: string; points: number }) => void
  onDeleteTemplate: (id: string) => void
}

/** Lista rápida de misiones ya creadas alguna vez (MOO2-57), bajo el botón "Añadir misión": deja
 *  elegir una o varias de golpe (MOO2-58) en vez de escribirlas de cero, y editar/borrar cada
 *  entrada (MOO2-59/60) sin tocar ninguna misión ya programada. Se oculta por completo hasta que
 *  exista al menos una plantilla (la primera misión creada a mano ya la alimenta). */
export function MissionTemplatesQuickPick({ templates, selectedIds, onToggleSelect, onCreateSelected, onEditTemplate, onDeleteTemplate }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftPoints, setDraftPoints] = useState<number | string>(0)

  if (templates.length === 0) return null

  function startEdit(t: MissionTemplate) {
    setEditingId(t.id)
    setDraftTitle(t.title)
    setDraftPoints(t.points)
  }
  function saveEdit() {
    if (!editingId) return
    onEditTemplate(editingId, { title: draftTitle, points: Number(draftPoints) || 0 })
    setEditingId(null)
  }

  return (
    <div style={{ background: '#FFFDF6', border: '1px solid #EADFCB', borderRadius: 16, padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#7C6E52', marginBottom: 8 }}>Misiones ya creadas</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
        {templates.map((t) => {
          if (editingId === t.id) {
            return (
              <div key={t.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 4px' }}>
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  style={{ ...INPUT_STYLE, padding: '7px 9px', fontSize: 13.5 }}
                />
                <input type="number" value={draftPoints} onChange={(e) => setDraftPoints(e.target.value)} style={{ ...NUMBER_INPUT_STYLE, width: 64 }} />
                <button onClick={saveEdit} title="Guardar" style={{ ...ICON_BTN, width: 34, height: 34, fontSize: 15 }}>
                  ✔️
                </button>
                <button onClick={() => setEditingId(null)} title="Cancelar" style={{ ...ICON_BTN, width: 34, height: 34, fontSize: 15 }}>
                  ✖️
                </button>
              </div>
            )
          }
          const checked = selectedIds.includes(t.id)
          return (
            <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer' }}>
              <input type="checkbox" checked={checked} onChange={() => onToggleSelect(t.id)} style={{ width: 18, height: 18, flex: '0 0 auto' }} />
              <span style={{ fontSize: 19, flex: '0 0 auto' }}>{t.emoji}</span>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
              <span style={{ flex: '0 0 auto', background: '#F1ECDD', color: '#7C6E52', fontWeight: 800, fontSize: 12, padding: '2px 8px', borderRadius: 999 }}>
                {t.points} pts
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  startEdit(t)
                }}
                title="Editar"
                style={{ ...ICON_BTN, width: 32, height: 32, fontSize: 14 }}
              >
                ✏️
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  onDeleteTemplate(t.id)
                }}
                title="Borrar"
                style={{ ...ICON_BTN, width: 32, height: 32, fontSize: 14 }}
              >
                🗑️
              </button>
            </label>
          )
        })}
      </div>
      <button
        onClick={onCreateSelected}
        disabled={selectedIds.length === 0}
        style={{ ...BTN_SAVE, width: '100%', marginTop: 10, opacity: selectedIds.length === 0 ? 0.5 : 1, cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer' }}
      >
        Crear{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
      </button>
    </div>
  )
}
