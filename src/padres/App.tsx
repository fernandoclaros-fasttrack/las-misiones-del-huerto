import { useEffect, useState } from 'react'
import { useFamilyData } from '../shared/useFamilyData'
import { ACCENT, todayIndex } from '../shared/constants'
import { DayTabs } from '../shared/components/DayTabs'
import { CounterCard, type PanelName } from './components/CounterCard'
import { ChildrenCard } from './components/ChildrenCard'
import { MissionCard } from './components/MissionCard'
import { NewMissionForm } from './components/NewMissionForm'
import type { Mission } from '../shared/types'

interface Draft {
  emoji: string
  title: string
  points: number | string
  days: number[]
}

export default function App() {
  const {
    data,
    loading,
    setMissionStatus,
    addMission,
    editMission,
    deleteMission,
    setCounter,
    applyPenalty,
    resetCounter,
    redeemPoints,
    addConcept,
    removeConcept,
    addChild,
    renameChild,
    removeChild,
  } = useFamilyData()

  const [selected, setSelected] = useState(todayIndex())

  const [panel, setPanel] = useState<PanelName>(null)
  const [editVal, setEditVal] = useState('')
  const [penaltyVal, setPenaltyVal] = useState('')
  const [redeemVal, setRedeemVal] = useState('')
  const [redeemMsg, setRedeemMsg] = useState<{ text: string; err: boolean } | null>(null)

  const [redeemConceptId, setRedeemConceptId] = useState<string | null>(null)
  const [showConceptForm, setShowConceptForm] = useState(false)
  const [newConceptLabel, setNewConceptLabel] = useState('')
  const [newConceptEmoji, setNewConceptEmoji] = useState('🎯')

  const [editingId, setEditingId] = useState<null | 'new' | string>(null)
  const [draft, setDraft] = useState<Draft>({ emoji: '🌱', title: '', points: 10, days: [] })

  // Mantiene el concepto de canje seleccionado válido: por defecto el primero,
  // y si el seleccionado se borra, cae al siguiente disponible.
  useEffect(() => {
    if (!data) return
    if (!data.concepts.some((c) => c.id === redeemConceptId)) {
      setRedeemConceptId(data.concepts[0]?.id ?? null)
    }
  }, [data, redeemConceptId])

  if (loading || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#E9E0CC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Nunito', system-ui, sans-serif", color: '#8A7E6B' }}>
        Cargando panel…
      </div>
    )
  }

  const day = data.days[selected]
  const missions = day?.missions ?? []

  function selectDay(i: number) {
    setSelected(i)
    setEditingId(null)
  }

  function openPanel(name: Exclude<PanelName, null>) {
    setPanel((current) => (current === name ? null : name))
    setRedeemMsg(null)
    if (name === 'edit') setEditVal(String(data!.acumulado))
    if (name === 'penalty') setPenaltyVal('')
    if (name === 'redeem') setRedeemVal('')
  }
  function closePanel() {
    setPanel(null)
    setShowConceptForm(false)
  }

  function saveEdit() {
    void setCounter(parseInt(editVal, 10) || 0)
    setPanel(null)
  }
  function doApplyPenalty() {
    void applyPenalty(Math.max(0, parseInt(penaltyVal, 10) || 0))
    setPanel(null)
  }
  function doReset() {
    void resetCounter()
    setPanel(null)
  }
  async function confirmRedeem() {
    const pts = parseInt(redeemVal, 10) || 0
    const result = await redeemPoints(pts)
    if (!result.ok) {
      setRedeemMsg({ text: result.error!, err: true })
      return
    }
    const concept = data!.concepts.find((c) => c.id === redeemConceptId)
    setRedeemVal('')
    setRedeemMsg({ text: `Canjeados ${pts} pts${concept ? ` por ${concept.label} ${concept.emoji}` : ''}.`, err: false })
  }

  function toggleConceptForm() {
    setShowConceptForm((v) => !v)
    setNewConceptLabel('')
    setNewConceptEmoji('🎯')
  }
  async function handleAddConcept() {
    if (!newConceptLabel.trim()) return
    const id = await addConcept({ emoji: newConceptEmoji, label: newConceptLabel })
    if (id) {
      setRedeemConceptId(id)
      setShowConceptForm(false)
    }
  }

  function openAdd() {
    setEditingId('new')
    setDraft({ emoji: '🌱', title: '', points: 10, days: [selected] })
  }
  function openEditMission(mission: Mission) {
    setEditingId(mission.id)
    setDraft({ emoji: mission.emoji, title: mission.title, points: mission.points, days: [selected] })
  }
  function cancelEdit() {
    setEditingId(null)
  }
  function toggleDraftDay(i: number) {
    setDraft((d) => (d.days.includes(i) ? { ...d, days: d.days.filter((x) => x !== i) } : { ...d, days: [...d.days, i] }))
  }
  async function saveMission() {
    if (!draft.title.trim()) return
    const points = Number(draft.points) || 0
    if (editingId === 'new') {
      await addMission({ emoji: draft.emoji, title: draft.title, points, dayIndices: draft.days.length ? draft.days : [selected] })
    } else if (editingId) {
      await editMission(selected, editingId, { emoji: draft.emoji, title: draft.title, points })
    }
    setEditingId(null)
  }
  async function handleDeleteMission(mission: Mission) {
    await deleteMission(selected, mission.id)
    if (editingId === mission.id) setEditingId(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#E9E0CC', fontFamily: "'Nunito', system-ui, sans-serif", color: '#3A3228', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <header style={{ background: ACCENT, color: '#F6F1E2', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Bitter', serif", fontWeight: 700, fontSize: 16 }}>🌿 Panel de gestión</div>
            <div style={{ fontSize: 12.5, opacity: 0.82, marginTop: 2, fontWeight: 600 }}>Las misiones del huerto · vista de padres</div>
          </div>
        </header>

        <div style={{ padding: '16px 16px 8px' }}>
          <CounterCard
            acumulado={data.acumulado}
            panel={panel}
            onOpenPanel={openPanel}
            onClosePanel={closePanel}
            editVal={editVal}
            onEditValChange={setEditVal}
            onSaveEdit={saveEdit}
            penaltyVal={penaltyVal}
            onPenaltyValChange={setPenaltyVal}
            onApplyPenalty={doApplyPenalty}
            onDoReset={doReset}
            concepts={data.concepts}
            redeemConceptId={redeemConceptId}
            onSelectConcept={setRedeemConceptId}
            onRemoveConcept={(id) => void removeConcept(id)}
            showConceptForm={showConceptForm}
            onToggleConceptForm={toggleConceptForm}
            newConceptLabel={newConceptLabel}
            onNewConceptLabelChange={setNewConceptLabel}
            newConceptEmoji={newConceptEmoji}
            onNewConceptEmojiChange={setNewConceptEmoji}
            onAddConcept={handleAddConcept}
            redeemVal={redeemVal}
            onRedeemValChange={setRedeemVal}
            onConfirmRedeem={confirmRedeem}
            redeemMsg={redeemMsg}
          />

          <ChildrenCard
            kids={data.children}
            onAdd={(name) => void addChild(name)}
            onRename={(id, name) => void renameChild(id, name)}
            onRemove={(id) => void removeChild(id)}
          />
        </div>

        <DayTabs days={data.days} selected={selected} onSelect={selectDay} accent={ACCENT} variant="padres" />

        <main style={{ flex: 1, padding: '6px 16px 40px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '4px 4px 2px' }}>
            <span style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 18 }}>{day?.label}</span>
            <span style={{ fontSize: 13, color: '#8A7E6B', fontWeight: 700 }}>{missions.length} misiones</span>
          </div>

          {missions.map((m) => {
            const editing = editingId === m.id
            return (
              <MissionCard
                key={m.id}
                mission={m}
                editing={editing}
                draftEmoji={draft.emoji}
                draftTitle={draft.title}
                draftPoints={draft.points}
                onDraftEmojiChange={(emoji) => setDraft((d) => ({ ...d, emoji }))}
                onDraftTitleChange={(title) => setDraft((d) => ({ ...d, title }))}
                onDraftPointsChange={(points) => setDraft((d) => ({ ...d, points }))}
                onSave={saveMission}
                onCancel={cancelEdit}
                onEdit={() => openEditMission(m)}
                onDelete={() => void handleDeleteMission(m)}
                onStatusChange={(status) => void setMissionStatus(selected, m.id, status)}
              />
            )
          })}

          {editingId === 'new' && (
            <NewMissionForm
              days={data.days}
              accent={ACCENT}
              emoji={draft.emoji}
              onEmojiChange={(emoji) => setDraft((d) => ({ ...d, emoji }))}
              selectedDays={draft.days}
              onToggleDay={toggleDraftDay}
              title={draft.title}
              onTitleChange={(title) => setDraft((d) => ({ ...d, title }))}
              points={draft.points}
              onPointsChange={(points) => setDraft((d) => ({ ...d, points }))}
              onSave={saveMission}
              onCancel={cancelEdit}
            />
          )}

          {editingId !== 'new' && (
            <button
              onClick={openAdd}
              style={{ width: '100%', padding: 14, borderRadius: 16, border: '2px dashed #C4B896', background: 'transparent', color: '#6E6045', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}
            >
              ＋ Añadir misión
            </button>
          )}
        </main>
      </div>
    </div>
  )
}
