import { useEffect, useRef, useState } from 'react'
import { useFamilyData } from '../shared/useFamilyData'
import { useAuth } from '../shared/useAuth'
import { LoginScreen } from '../shared/components/LoginScreen'
import { ACCENT, todayIndex } from '../shared/constants'
import { DayTabs } from '../shared/components/DayTabs'
import { Header } from './components/Header'
import { MissionCard } from './components/MissionCard'
import { EmptyState } from './components/EmptyState'
import { ChildPicker } from './components/ChildPicker'
import { RedemptionHistory } from './components/RedemptionHistory'
import { isMissionVisibleTo, pointsDeltaFor, redemptionsForChild, sortedMissions } from '../shared/logic'
import type { Mission, MissionStatus } from '../shared/types'

const ACTIVE_CHILD_KEY = 'misiones-del-huerto:active-child'
const AUTH_EMAIL = import.meta.env.VITE_AUTH_EMAIL as string

export default function App() {
  const { ready, isAuthed, login, logout, resetPassword } = useAuth()
  const { data, loading, setMissionStatus } = useFamilyData()
  const [selected, setSelected] = useState(todayIndex())
  const [activeChildId, setActiveChildId] = useState<string | null>(() => localStorage.getItem(ACTIVE_CHILD_KEY))
  const [showHistory, setShowHistory] = useState(false)

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

  function selectChild(id: string) {
    localStorage.setItem(ACTIVE_CHILD_KEY, id)
    setActiveChildId(id)
  }
  function switchChild() {
    localStorage.removeItem(ACTIVE_CHILD_KEY)
    setActiveChildId(null)
    setShowHistory(false)
  }

  function handleSetStatus(mission: Mission, status: MissionStatus, participantIds: string[] | undefined, myChildId: string | null, allChildIds: string[]) {
    const myDelta = pointsDeltaFor(mission, status, participantIds, myChildId, allChildIds)
    if (myDelta !== 0) {
      flash(myDelta)
      setPointsKey((k) => k + 1)
    }
    void setMissionStatus(selected, mission.id, status, participantIds)
  }

  if (!ready) {
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
        Cargando…
      </div>
    )
  }

  if (!isAuthed) {
    return (
      <LoginScreen
        accent={ACCENT}
        background="#EFE7D4"
        email={AUTH_EMAIL}
        onLogin={login}
        onForgotPassword={resetPassword}
      />
    )
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

  const hasChildren = data.children.length > 0
  const activeChildIndex = hasChildren ? data.children.findIndex((c) => c.id === activeChildId) : -1
  const activeChild = activeChildIndex >= 0 ? data.children[activeChildIndex] : null

  if (hasChildren && !activeChild) {
    return <ChildPicker accent={ACCENT} kids={data.children} onSelect={selectChild} />
  }

  const day = data.days[selected]
  const missions = (day ? sortedMissions(day) : []).filter((m) => isMissionVisibleTo(m, activeChild?.id ?? null))
  const doneCount = missions.filter((m) => m.status === 'completada').length
  const points = hasChildren ? (activeChild?.points ?? 0) : data.acumulado

  return (
    <div style={{ minHeight: '100vh', background: '#EFE7D4', fontFamily: "'Nunito', system-ui, sans-serif", color: '#3A3228', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#EFE7D4' }}>
        <Header
          accent={ACCENT}
          points={points}
          pointsKey={pointsKey}
          showFloat={showFloat}
          floatKey={floatKey}
          floatText={floatText}
          floatColor={floatColor}
          childName={activeChild?.name}
          onSwitchChild={switchChild}
          onShowHistory={hasChildren ? () => setShowHistory(true) : undefined}
          onLogout={() => void logout()}
        />

        {hasChildren && showHistory && activeChild ? (
          <RedemptionHistory redemptions={redemptionsForChild(data, activeChild.id)} onBack={() => setShowHistory(false)} />
        ) : (
          <>
            <DayTabs days={data.days} selected={selected} onSelect={setSelected} accent={ACCENT} variant="ninos" />

            <main style={{ flex: 1, padding: '8px 16px 44px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '4px 6px 2px' }}>
                <span style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 19 }}>Misiones de {day?.label}</span>
                <span style={{ fontSize: 13, color: '#8A7E6B', fontWeight: 700 }}>
                  {doneCount}/{missions.length} hechas
                </span>
              </div>

              {missions.map((m) => (
                <MissionCard
                  key={m.id}
                  mission={m}
                  kids={data.children}
                  onSetStatus={(status, participantIds) =>
                    handleSetStatus(m, status, participantIds, activeChild?.id ?? null, data.children.map((c) => c.id))
                  }
                />
              ))}

              {missions.length === 0 && <EmptyState />}
            </main>
          </>
        )}
      </div>
    </div>
  )
}
