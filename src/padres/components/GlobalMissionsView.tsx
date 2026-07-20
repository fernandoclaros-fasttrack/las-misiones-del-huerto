import { activeDaysLabel, assignedToLabel } from '../../shared/logic'
import type { Child, Day, Mission } from '../../shared/types'

interface Props {
  missions: Mission[]
  days: Day[]
  kids: Child[]
}

/** Vista global de todas las misiones configuradas (MOO-30), de solo lectura: una fila por
 *  serie de misión (deduplicadas por `seriesId` en `uniqueMissionSeries`), ordenadas
 *  alfabéticamente, mostrando en qué día o días aparece cada una. Deliberadamente separada de
 *  la organización día a día (arrastre, edición): para eso se usa la vista por día. */
export function GlobalMissionsView({ missions, days, kids }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '4px 4px 2px' }}>
        <span style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 18 }}>Vista global</span>
        <span style={{ fontSize: 13, color: '#8A7E6B', fontWeight: 700 }}>{missions.length} misiones</span>
      </div>

      {missions.length === 0 ? (
        <div style={{ padding: '24px 4px', textAlign: 'center', color: '#8A7E6B', fontWeight: 700, fontSize: 14 }}>
          Todavía no hay misiones configuradas.
        </div>
      ) : (
        missions.map((mission) => (
          <div
            key={mission.seriesId}
            style={{ background: '#FFFDF6', border: '1px solid #EADFCB', borderRadius: 18, padding: '14px 15px', boxShadow: '0 2px 5px rgba(58,50,40,.05)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: '0 0 auto', width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 25, background: '#F1ECDD' }}>
                {mission.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{mission.title}</div>
                <div style={{ fontSize: 12.5, color: '#8A7E6B', fontWeight: 700, marginTop: 2 }}>
                  {mission.points} pts · {activeDaysLabel(mission, days)}
                  {assignedToLabel(mission, kids)}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
