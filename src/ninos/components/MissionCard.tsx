import type { Mission, MissionStatus } from '../../shared/types'
import { STATUS_META, STATUS_ORDER } from '../../shared/constants'

interface Props {
  mission: Mission
  onSetStatus: (status: MissionStatus) => void
}

export function MissionCard({ mission, onSetStatus }: Props) {
  const done = mission.status === 'completada'

  const cardStyle = done
    ? { background: '#EDF4E1', border: '1.5px solid #CFE0B5', borderRadius: 20, padding: '15px 16px', boxShadow: '0 2px 5px rgba(58,50,40,.05)', transition: 'background .2s' }
    : { background: '#FFFDF6', border: '1px solid #EADFCB', borderRadius: 20, padding: '15px 16px', boxShadow: '0 2px 6px rgba(58,50,40,.05)', transition: 'background .2s' }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            flex: '0 0 auto',
            width: 50,
            height: 50,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 27,
            background: done ? '#DBEAC4' : '#F1ECDD',
          }}
        >
          {mission.emoji}
        </div>
        <span
          style={{
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 700,
            fontSize: 16.5,
            lineHeight: 1.25,
            color: done ? '#4A6B33' : '#3A3228',
            flex: 1,
            minWidth: 0,
          }}
        >
          {mission.title}
        </span>
        <span
          style={{
            flex: '0 0 auto',
            background: '#E5EFD6',
            color: '#40682A',
            fontWeight: 800,
            fontSize: 12.5,
            padding: '5px 10px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
          {mission.points} pts
        </span>
      </div>
      <div style={{ display: 'flex', gap: 7, marginTop: 13 }}>
        {STATUS_ORDER.map((key) => {
          const meta = STATUS_META[key]
          const active = key === mission.status
          return (
            <button
              key={key}
              title={meta.label}
              onClick={() => onSetStatus(key)}
              style={
                active
                  ? {
                      flex: '1 1 auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px 8px',
                      borderRadius: 13,
                      cursor: 'pointer',
                      minHeight: 46,
                      background: meta.bg,
                      border: `2px solid ${meta.ring}`,
                      color: meta.fg,
                    }
                  : {
                      flex: '0 0 auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 46,
                      padding: 0,
                      borderRadius: 13,
                      cursor: 'pointer',
                      minHeight: 46,
                      background: '#F4EEE1',
                      border: '1px solid #E7DECB',
                      opacity: 0.7,
                      filter: 'grayscale(.35)',
                    }
              }
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{meta.icon}</span>
              {active && <span style={{ marginLeft: 7, fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }}>{meta.label}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
