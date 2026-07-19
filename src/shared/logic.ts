import type { Child, Day, FamilyData, Mission, MissionStatus, Redemption, RewardConcept } from './types'

/**
 * Reglas de negocio puras (ver README del handoff de diseño, sección "Reglas de negocio").
 * Cada función recibe el FamilyData actual y devuelve el patch a persistir.
 * Se mantienen puras para poder ejecutarlas dentro de una transacción de Firestore
 * (dos pantallas -hijos y padres- pueden estar abiertas a la vez).
 */

/** Reparte `total` en `n` partes enteras lo más iguales posible; el resto (positivo o
 *  negativo) se reparte de uno en uno a los primeros hijos, en orden, para no perder nada. */
export function splitAmong(total: number, n: number): number[] {
  if (n <= 0) return []
  const base = Math.trunc(total / n)
  const shares = new Array(n).fill(base)
  let remainder = total - base * n
  const step = remainder > 0 ? 1 : -1
  for (let i = 0; remainder !== 0; i = (i + 1) % n) {
    shares[i] += step
    remainder -= step
  }
  return shares
}

/** Aplica un delta de puntos a los hijos (repartido a partes iguales) si hay alguno
 *  configurado; si no, cae al contador compartido heredado (comportamiento de v1 intacto). */
function applyPointsDelta(data: FamilyData, delta: number): Pick<FamilyData, 'acumulado' | 'children'> {
  if (data.children.length === 0) return { acumulado: data.acumulado + delta, children: data.children }
  const shares = splitAmong(delta, data.children.length)
  const children = data.children.map((c, i) => ({ ...c, points: c.points + shares[i] }))
  return { acumulado: data.acumulado, children }
}

export function setMissionStatus(
  data: FamilyData,
  dayIdx: number,
  missionId: string,
  status: MissionStatus,
): Pick<FamilyData, 'days' | 'acumulado' | 'children'> {
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
  return { days, ...applyPointsDelta(data, delta) }
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
  const seriesId = `s${idSeed}`
  const days = data.days.map((day, di) => {
    if (!targets.includes(di)) return day
    const mission: Mission = { id: `m${idSeed}-${di}`, seriesId, emoji: input.emoji, title, points, status: 'pendiente', activeDays: targets }
    return { ...day, missions: [...day.missions, mission] }
  })
  return { days }
}

export interface EditMissionInput {
  emoji: string
  title: string
  points: number
  activeDays: number[]
}

/** Edita una misión por su `seriesId` (MOO-25): los campos compartidos (emoji, título,
 *  puntos, días activos) se propagan a todas sus copias, se crean copias nuevas en los
 *  días recién seleccionados (con status 'pendiente') y se eliminan las de los días que
 *  dejan de estar activos. El status de las copias que se mantienen no se toca. */
export function editMission(
  data: FamilyData,
  missionId: string,
  input: EditMissionInput,
): Pick<FamilyData, 'days' | 'acumulado' | 'children'> {
  const title = input.title.trim()
  const points = Math.max(0, Math.round(input.points) || 0)
  const activeDays = input.activeDays.length ? input.activeDays : []
  const existing = data.days.flatMap((d) => d.missions).find((mi) => mi.id === missionId)
  if (!existing) return { days: data.days, acumulado: data.acumulado, children: data.children }
  const seriesId = existing.seriesId

  let delta = 0
  const days = data.days.map((day, di) => {
    const current = day.missions.find((mi) => mi.seriesId === seriesId)
    const shouldHave = activeDays.includes(di)

    if (current && shouldHave) {
      if (current.status === 'completada') delta += points - current.points
      return {
        ...day,
        missions: day.missions.map((mi) => (mi.seriesId === seriesId ? { ...mi, emoji: input.emoji, title, points, activeDays } : mi)),
      }
    }
    if (current && !shouldHave) {
      if (current.status === 'completada') delta -= current.points
      return { ...day, missions: day.missions.filter((mi) => mi.seriesId !== seriesId) }
    }
    if (!current && shouldHave) {
      const mission: Mission = { id: `${seriesId}-${di}`, seriesId, emoji: input.emoji, title, points, status: 'pendiente', activeDays }
      return { ...day, missions: [...day.missions, mission] }
    }
    return day
  })

  return { days, ...applyPointsDelta(data, delta) }
}

/** Borra solo la copia del día indicado. Las copias hermanas (mismo `seriesId`) se
 *  quedan con `activeDays` corregido para que no sigan mostrando ese día como activo. */
export function deleteMission(
  data: FamilyData,
  dayIdx: number,
  missionId: string,
): Pick<FamilyData, 'days' | 'acumulado' | 'children'> {
  const day = data.days[dayIdx]
  const mission = day?.missions.find((mi) => mi.id === missionId)
  const delta = mission?.status === 'completada' ? -mission.points : 0
  const seriesId = mission?.seriesId
  const days = data.days.map((d, di) => {
    if (di === dayIdx) return { ...d, missions: d.missions.filter((mi) => mi.id !== missionId) }
    if (!seriesId) return d
    return {
      ...d,
      missions: d.missions.map((mi) => (mi.seriesId === seriesId ? { ...mi, activeDays: mi.activeDays.filter((x) => x !== dayIdx) } : mi)),
    }
  })
  return { days, ...applyPointsDelta(data, delta) }
}

export function setCounter(_data: FamilyData, value: number): Pick<FamilyData, 'acumulado'> {
  return { acumulado: Math.round(value) || 0 }
}

export function applyPenalty(data: FamilyData, amount: number): Pick<FamilyData, 'acumulado'> {
  const n = Math.max(0, Math.round(amount) || 0)
  return { acumulado: data.acumulado - n }
}

/** Resetea la semana entera: contador compartido, puntos por hijo, y el estado de
 *  todas las misiones (todos los días) vuelven a "pendiente". El histórico de
 *  canjes no se toca: es un registro de eventos pasados, no del estado actual. */
export function resetCounter(data: FamilyData): Pick<FamilyData, 'acumulado' | 'children' | 'days'> {
  const days = data.days.map((day) => ({
    ...day,
    missions: day.missions.map((mi) => (mi.status === 'pendiente' ? mi : { ...mi, status: 'pendiente' as const })),
  }))
  const children = data.children.map((c) => (c.points === 0 ? c : { ...c, points: 0 }))
  return { acumulado: 0, children, days }
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

export function addChild(data: FamilyData, name: string, idSeed: number): Pick<FamilyData, 'children'> {
  const trimmed = name.trim()
  if (!trimmed) return { children: data.children }
  const child: Child = { id: `child${idSeed}`, name: trimmed, points: 0 }
  return { children: [...data.children, child] }
}

export function renameChild(data: FamilyData, childId: string, name: string): Pick<FamilyData, 'children'> {
  const trimmed = name.trim()
  if (!trimmed) return { children: data.children }
  return { children: data.children.map((c) => (c.id === childId ? { ...c, name: trimmed } : c)) }
}

export function removeChild(data: FamilyData, childId: string): Pick<FamilyData, 'children'> {
  return { children: data.children.filter((c) => c.id !== childId) }
}

export function editChildPoints(data: FamilyData, childId: string, value: number): Pick<FamilyData, 'children'> {
  const points = Math.round(value) || 0
  return { children: data.children.map((c) => (c.id === childId ? { ...c, points } : c)) }
}

export function penalizeChild(data: FamilyData, childId: string, amount: number): Pick<FamilyData, 'children'> {
  const n = Math.max(0, Math.round(amount) || 0)
  return { children: data.children.map((c) => (c.id === childId ? { ...c, points: c.points - n } : c)) }
}

export interface ChildRedeemResult {
  ok: boolean
  error?: string
  children?: Child[]
  redemptions?: Redemption[]
}

export function redeemChildPoints(
  data: FamilyData,
  childId: string,
  points: number,
  concept: { emoji: string; label: string },
  idSeed: number,
): ChildRedeemResult {
  const pts = Math.round(points) || 0
  const child = data.children.find((c) => c.id === childId)
  if (!child) return { ok: false, error: 'No se encuentra a ese hijo/a.' }
  if (pts <= 0) return { ok: false, error: 'Introduce cuántos puntos canjear.' }
  if (pts > child.points) return { ok: false, error: 'No hay suficientes puntos acumulados.' }
  const children = data.children.map((c) => (c.id === childId ? { ...c, points: c.points - pts } : c))
  const redemption: Redemption = {
    id: `rd${idSeed}`,
    childId,
    points: pts,
    conceptEmoji: concept.emoji,
    conceptLabel: concept.label,
    timestamp: idSeed,
  }
  return { ok: true, children, redemptions: [...data.redemptions, redemption] }
}

export function redemptionsForChild(data: FamilyData, childId: string): Redemption[] {
  return data.redemptions.filter((r) => r.childId === childId).sort((a, b) => b.timestamp - a.timestamp)
}
