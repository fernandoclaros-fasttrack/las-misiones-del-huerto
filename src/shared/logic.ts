import type { Day, FamilyData, Mission, MissionStatus, RewardConcept } from './types'

/**
 * Reglas de negocio puras (ver README del handoff de diseño, sección "Reglas de negocio").
 * Cada función recibe el FamilyData actual y devuelve el patch a persistir.
 * Se mantienen puras para poder ejecutarlas dentro de una transacción de Firestore
 * (dos pantallas -hijos y padres- pueden estar abiertas a la vez).
 */

export function setMissionStatus(
  data: FamilyData,
  dayIdx: number,
  missionId: string,
  status: MissionStatus,
): Pick<FamilyData, 'days' | 'acumulado'> {
  let delta = 0
  const days = data.days.map((day, di) => {
    if (di !== dayIdx) return day
    return {
      ...day,
      missions: day.missions.map((mi) => {
        if (mi.id !== missionId || mi.status === status) return mi
        const was = mi.status === 'completada'
        const now = status === 'completada'
        if (was && !now) delta -= mi.points
        if (!was && now) delta += mi.points
        return { ...mi, status }
      }),
    }
  })
  return { days, acumulado: data.acumulado + delta }
}

export interface NewMissionInput {
  emoji: string
  title: string
  points: number
  dayIndices: number[]
}

export function addMission(data: FamilyData, input: NewMissionInput, idSeed: number): Pick<FamilyData, 'days'> {
  const title = input.title.trim()
  const points = Math.max(0, Math.round(input.points) || 0)
  const targets = input.dayIndices.length ? input.dayIndices : []
  const days = data.days.map((day, di) => {
    if (!targets.includes(di)) return day
    const mission: Mission = { id: `m${idSeed}-${di}`, emoji: input.emoji, title, points, status: 'pendiente' }
    return { ...day, missions: [...day.missions, mission] }
  })
  return { days }
}

export interface EditMissionInput {
  emoji: string
  title: string
  points: number
}

export function editMission(
  data: FamilyData,
  dayIdx: number,
  missionId: string,
  input: EditMissionInput,
): Pick<FamilyData, 'days' | 'acumulado'> {
  const title = input.title.trim()
  const points = Math.max(0, Math.round(input.points) || 0)
  let delta = 0
  const days = data.days.map((day, di) => {
    if (di !== dayIdx) return day
    return {
      ...day,
      missions: day.missions.map((mi) => {
        if (mi.id !== missionId) return mi
        if (mi.status === 'completada') delta += points - mi.points
        return { ...mi, emoji: input.emoji, title, points }
      }),
    }
  })
  return { days, acumulado: data.acumulado + delta }
}

export function deleteMission(data: FamilyData, dayIdx: number, missionId: string): Pick<FamilyData, 'days' | 'acumulado'> {
  const day = data.days[dayIdx]
  const mission = day?.missions.find((mi) => mi.id === missionId)
  const delta = mission?.status === 'completada' ? -mission.points : 0
  const days = data.days.map((d, di) => (di !== dayIdx ? d : { ...d, missions: d.missions.filter((mi) => mi.id !== missionId) }))
  return { days, acumulado: data.acumulado + delta }
}

export function setCounter(_data: FamilyData, value: number): Pick<FamilyData, 'acumulado'> {
  return { acumulado: Math.round(value) || 0 }
}

export function applyPenalty(data: FamilyData, amount: number): Pick<FamilyData, 'acumulado'> {
  const n = Math.max(0, Math.round(amount) || 0)
  return { acumulado: data.acumulado - n }
}

export function resetCounter(): Pick<FamilyData, 'acumulado'> {
  return { acumulado: 0 }
}

export interface RedeemResult {
  ok: boolean
  error?: string
  acumulado?: number
}

export function redeemPoints(data: FamilyData, points: number): RedeemResult {
  const pts = Math.round(points) || 0
  if (pts <= 0) return { ok: false, error: 'Introduce cuántos puntos canjear.' }
  if (pts > data.acumulado) return { ok: false, error: 'No hay suficientes puntos acumulados.' }
  return { ok: true, acumulado: data.acumulado - pts }
}

export function addConcept(
  data: FamilyData,
  concept: Omit<RewardConcept, 'id'>,
  idSeed: number,
): { concepts: RewardConcept[]; id: string | null } {
  const label = concept.label.trim()
  if (!label) return { concepts: data.concepts, id: null }
  const id = `uc${idSeed}`
  return { concepts: [...data.concepts, { id, emoji: concept.emoji, label }], id }
}

export function removeConcept(data: FamilyData, conceptId: string): Pick<FamilyData, 'concepts'> {
  return { concepts: data.concepts.filter((c) => c.id !== conceptId) }
}

export function totalMissionsDone(day: Day | undefined): number {
  return day ? day.missions.filter((m) => m.status === 'completada').length : 0
}
