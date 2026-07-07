import type { CSSProperties } from 'react'
import type { Day } from '../types'
import { todayIndex } from '../constants'

interface Props {
  days: Day[]
  selected: number
  onSelect: (index: number) => void
  accent: string
  /** 'ninos' usa radio 15px y padding vertical ligeramente mayor que 'padres' (14px), fiel al handoff. */
  variant: 'ninos' | 'padres'
}

export function DayTabs({ days, selected, onSelect, accent, variant }: Props) {
  const radius = variant === 'ninos' ? 15 : 14
  const today = todayIndex()

  return (
    <nav style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: variant === 'ninos' ? '16px 16px 6px' : '8px 16px 6px', flex: '0 0 auto' }}>
      {days.map((d, i) => {
        const on = i === selected
        const isToday = i === today
        const style: CSSProperties = on
          ? {
              flex: '0 0 auto',
              minWidth: 54,
              padding: '9px 12px',
              borderRadius: radius,
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 800,
              fontSize: 14,
              background: accent,
              color: '#F6F1E2',
              boxShadow: variant === 'ninos' ? '0 4px 10px rgba(58,50,40,.18)' : '0 4px 10px rgba(58,50,40,.16)',
            }
          : {
              flex: '0 0 auto',
              minWidth: 54,
              padding: '9px 12px',
              borderRadius: radius,
              border: `1px solid ${variant === 'ninos' ? '#E4DBC8' : '#DCD1B9'}`,
              cursor: 'pointer',
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 800,
              fontSize: 14,
              background: variant === 'ninos' ? '#FFFDF6' : '#FBF7EC',
              color: '#8A7C60',
            }
        return (
          <button key={d.short} onClick={() => onSelect(i)} style={style}>
            <span>{d.short}</span>
            {isToday && (
              <span
                style={{
                  display: 'block',
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: on ? '#F6F1E2' : accent,
                  margin: '4px auto 0',
                }}
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}
