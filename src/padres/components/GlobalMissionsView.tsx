import { MissionCard } from './MissionCard'
import { MissionsList } from './MissionsList'
import { NewMissionForm } from './NewMissionForm'
import type { Child, Day, Mission } from '../../shared/types'

interface Props {
  missions: Mission[]
  days: Day[]
  kids: Child[]
  accent: string
  hasCustomOrder: boolean
  onReorder: (missionIds: string[]) => void
  onResetOrder: () => void
  editingId: string | null
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
  onEdit: (mission: Mission) => void
  onAdd: () => void
  onDuplicate: (mission: Mission) => void
  /** Borra la serie entera (todas sus copias), no solo una — ver `deleteMissionSeries` en
   *  logic.ts. A diferencia de la vista por día, aquí no hay un día de referencia para "borrar
   *  solo esta copia". */
  onDelete: (mission: Mission) => void
}

/** Vista global de todas las misiones configuradas (MOO-30): una fila por serie de misión
 *  (deduplicadas por `seriesId` en `sortedMissionSeries`), con edición, duplicado, borrado y
 *  reordenamiento por arrastre — reutiliza `MissionCard`/`MissionsList` tal cual. Duplicar
 *  respeta los mismos días activos que el original (igual que desde un día concreto). Borrar
 *  aquí elimina la serie de todos los días a la vez: no hay un día de referencia para borrar
 *  solo una copia, y dejar la fila viéndose igual (con otra copia como representante) daría la
 *  sensación de que "borrar" no hizo nada. */
export function GlobalMissionsView({
  missions,
  days,
  kids,
  accent,
  hasCustomOrder,
  onReorder,
  onResetOrder,
  editingId,
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
  onAdd,
  onDuplicate,
  onDelete,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '4px 4px 2px' }}>
        <span style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 18 }}>Todas las misiones</span>
        <span style={{ fontSize: 13, color: '#8A7E6B', fontWeight: 700 }}>{missions.length} misiones</span>
      </div>

      {hasCustomOrder && (
        <button
          onClick={onResetOrder}
          style={{ alignSelf: 'flex-end', margin: '-5px 4px 2px 0', border: 'none', background: 'transparent', color: '#7C6E52', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', padding: 0 }}
        >
          ↺ Orden alfabético
        </button>
      )}

      {missions.length === 0 ? (
        <div style={{ padding: '24px 4px', textAlign: 'center', color: '#8A7E6B', fontWeight: 700, fontSize: 14 }}>
          Todavía no hay misiones configuradas.
        </div>
      ) : (
        <MissionsList
          missions={missions}
          disabled={editingId !== null}
          onReorder={onReorder}
          renderItem={(m, dragHandle) => (
            <MissionCard
              mission={m}
              editing={editingId === m.id}
              days={days}
              kids={kids}
              accent={accent}
              dragHandle={dragHandle}
              draftEmoji={draftEmoji}
              draftTitle={draftTitle}
              draftPoints={draftPoints}
              draftDays={draftDays}
              draftAssignedTo={draftAssignedTo}
              onDraftEmojiChange={onDraftEmojiChange}
              onDraftTitleChange={onDraftTitleChange}
              onDraftPointsChange={onDraftPointsChange}
              onToggleDraftDay={onToggleDraftDay}
              onToggleDraftChild={onToggleDraftChild}
              onSave={onSave}
              onCancel={onCancel}
              onEdit={() => onEdit(m)}
              onDuplicate={() => onDuplicate(m)}
              onDelete={() => onDelete(m)}
            />
          )}
        />
      )}

      {editingId === 'new' && (
        <NewMissionForm
          days={days}
          kids={kids}
          accent={accent}
          emoji={draftEmoji}
          onEmojiChange={onDraftEmojiChange}
          selectedDays={draftDays}
          onToggleDay={onToggleDraftDay}
          assignedTo={draftAssignedTo}
          onToggleChild={onToggleDraftChild}
          title={draftTitle}
          onTitleChange={onDraftTitleChange}
          points={draftPoints}
          onPointsChange={onDraftPointsChange}
          onSave={onSave}
          onCancel={onCancel}
        />
      )}

      {editingId !== 'new' && (
        <button
          onClick={onAdd}
          style={{ width: '100%', padding: 14, borderRadius: 16, border: '2px dashed #C4B896', background: 'transparent', color: '#6E6045', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}
        >
          ＋ Añadir misión
        </button>
      )}
    </div>
  )
}
