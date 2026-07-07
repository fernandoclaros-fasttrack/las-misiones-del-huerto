import { useEffect, useRef, useState } from 'react'
import { useFamilyData } from '../shared/useFamilyData'
import { ACCENT, todayIndex } from '../shared/constants'
import { DayTabs } from '../shared/components/DayTabs'
import { Header } from './components/Header'
import { MissionCard } from './components/MissionCard'
import { EmptyState } from './components/EmptyState'
import type { MissionStatus } from '../shared/types'

export default function App() {
  const { data, loading, setMissionStatus } = useFamilyData()
  const [selected, setSelected] = useState(todayIndex())

  const [pointsKey, setPointsKey] = useState(0)
  const [floatKey, setFloatKey] = useState(0)
  const [floatText, setFloatText] = useState('')
  const [floatColor, setFloatColor] = useState('#CDE7A0')
  const [showFloat, setShowFloat] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
  }, [])

  function flash(delta: number) {
    setFloatText((delta > 0 ? '+' : '−') + Math.abs(delta))
    setFloatColor(delta > 0 ? '#CDE7A0' : '#F0C3A6')
    setShowFloat(true)
    setFloatKey((k) => k + 1)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setShowFloat(false), 1000)
  }

  function handleSetStatus(missionId: string, currentStatus: MissionStatus, points: number, status: MissionStatus) {
    const wasDone = currentStatus === 'completada'
    const nowDone = status === 'completada'
    if (wasDone !== nowDone) {
      flash(nowDone ? points : -points)
      setPointsKey((k) => k + 1)
    }
    void setMissionStatus(selected, missionId, status)
  }

  if (loading || !data) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#EFE7D4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Nunito', system-ui, sans-serif",
          color: '#8A7E6B',
        }}
      >
        Cargando misiones…
      </div>
    )
  }

  const day = data.days[selected]
  const missions = day?.missions ?? []
  const doneCount = missions.filter((m) => m.status === 'completada').length

  return (
    <div style={{ minHeight: '100vh', background: '#EFE7D4', fontFamily: "'Nunito', system-ui, sans-serif", color: '#3A3228', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#EFE7D4' }}>
        <Header
          accent={ACCENT}
          points={data.acumulado}
          pointsKey={pointsKey}
          showFloat={showFloat}
          floatKey={floatKey}
          floatText={floatText}
          floatColor={floatColor}
        />

        <DayTabs days={data.days} selected={selected} onSelect={setSelected} accent={ACCENT} variant="ninos" />

        <main style={{ flex: 1, padding: '8px 16px 44px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '4px 6px 2px' }}>
            <span style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 19 }}>Misiones de {day?.label}</span>
            <span style={{ fontSize: 13, color: '#8A7E6B', fontWeight: 700 }}>
              {doneCount}/{missions.length} hechas
            </span>
          </div>

          {missions.map((m) => (
            <MissionCard key={m.id} mission={m} onSetStatus={(status) => handleSetStatus(m.id, m.status, m.points, status)} />
          ))}

          {missions.length === 0 && <EmptyState />}
        </main>
      </div>
    </div>
  )
}
