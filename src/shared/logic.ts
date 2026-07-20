import type { Child, Day, FamilyData, Mission, MissionStatus, Redemption, RewardConcept } from './types'

/**
 * Reglas de negocio puras (ver README del handoff de diseño, sección "Reglas de negocio").
 * Cada función recibe el FamilyData actual y devuelve el patch a persistir.
 * Se mantienen puras para poder ejecutarlas dentro de una transacción de Firestore
 * (dos pantallas -hijos y padres- pueden estar abiertas a la vez).
 */

/** Aplica un delta de puntos a un subconjunto de hijos (los participantes de la misión).
 *  Los hijos que no participaron no reciben ni pierden puntos por este cambio. */
function applyParticipantDelta(children: Child[], participantIds: string[], delta: number): Child[] {
  const ids = new Set(participantIds)
  return children.map((c) => (ids.has(c.id) ? { ...c, points: c.points + delta } : c))
}

export function setMissionStatus(
  data: FamilyData,
  dayIdx: number,
  missionId: string,
  status: MissionStatus,
  participantIds?: string[],
): Pick<FamilyData, 'days' | 'acumulado' | 'children'> {
  const hasChildren = data.children.length > 0
  let acumulado = data.acumulado
  let children = data.children
  const days = data.days.map((day, di) => {
    if (di !== dayIdx) return day
    return {
      ...day,
      missions: day.missions.map((mi) => {
        if (mi.id !== missionId || mi.status === status) return mi
        const was = mi.status === 'completada'
        const now = status === 'completada'
        if (!hasChildren) {
          if (was && !now) acumulado -= mi.points
          if (!was && now) acumulado += mi.points
          return { ...mi, status }
        }
        if (!was && now) {
          // MOO-26: todos los hijos participan por defecto; solo los seleccionados reciben la
          // recompensa completa (no se reparte).
          const participants = participantIds?.length ? participantIds : data.children.map((c) => c.id)
          children = applyParticipantDelta(children, participants, mi.points)
          return { ...mi, status, participants }
        }
        if (was && !now) {
          // Deshace usando los participantes con los que se completó, no la selección actual.
          const participants = mi.participants.length ? mi.participants : data.children.map((c) => c.id)
          children = applyParticipantDelta(children, participants, -mi.points)
          return { ...mi, status, participants: [] }
        }
        return { ...mi, status }
      }),
    }
  })
  return { days, acumulado, children }
}

export interface NewMissionInput {
  emoji: string
  title: string
  points: number
  dayIndices: number[]
  /** IDs de los hijos asignados (MOO-27); solo relevante cuando hay hijos configurados. */
  assignedTo: string[]
}

export function addMission(data: FamilyData, input: NewMissionInput, idSeed: number): Pick<FamilyData, 'days'> {
  const title = input.title.trim()
  const points = Math.max(0, Math.round(input.points) || 0)
  const targets = input.dayIndices.length ? input.dayIndices : []
  const seriesId = `s${idSeed}`
  const days = data.days.map((day, di) => {
    if (!targets.includes(di)) return day
    const mission: Mission = { id: `m${idSeed}-${di}`, seriesId, emoji: input.emoji, title, points, status: 'pendiente', activeDays: targets, participants: [], assignedTo: input.assignedTo }
    return { ...day, missions: [...day.missions, mission] }
  })
  return { days }
}

export interface EditMissionInput {
  emoji: string
  title: string
  points: number
  activeDays: number[]
  /** IDs de los hijos asignados (MOO-27); solo relevante cuando hay hijos configurados. */
  assignedTo: string[]
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
  const hasChildren = data.children.length > 0

  let acumulado = data.acumulado
  let children = data.children
  const days = data.days.map((day, di) => {
    const current = day.missions.find((mi) => mi.seriesId === seriesId)
    const shouldHave = activeDays.includes(di)

    if (current && shouldHave) {
      if (current.status === 'completada') {
        const delta = points - current.points
        if (hasChildren) {
          const participants = current.participants.length ? current.participants : data.children.map((c) => c.id)
          children = applyParticipantDelta(children, participants, delta)
        } else {
          acumulado += delta
        }
      }
      return {
        ...day,
        missions: day.missions.map((mi) => (mi.seriesId === seriesId ? { ...mi, emoji: input.emoji, title, points, activeDays, assignedTo: input.assignedTo } : mi)),
      }
    }
    if (current && !shouldHave) {
      if (current.status === 'completada') {
        if (hasChildren) {
          const participants = current.participants.length ? current.participants : data.children.map((c) => c.id)
          children = applyParticipantDelta(children, participants, -current.points)
        } else {
          acumulado -= current.points
        }
      }
      return { ...day, missions: day.missions.filter((mi) => mi.seriesId !== seriesId) }
    }
    if (!current && shouldHave) {
      const mission: Mission = { id: `${seriesId}-${di}`, seriesId, emoji: input.emoji, title, points, status: 'pendiente', activeDays, participants: [], assignedTo: input.assignedTo }
      return { ...day, missions: [...day.missions, mission] }
    }
    return day
  })

  return { days, acumulado, children }
}

/** Duplica una misión (MOO-28) como una serie independiente: mismo emoji, puntos, días
 *  activos e hijos asignados, con el título marcado como copia. La copia nace en estado
 *  'pendiente' y sin participantes, y no comparte `seriesId` con el original, así que
 *  editar o borrar una no afecta a la otra. `dayIdx` es el día desde el que se pulsó
 *  duplicar; como todas las copias de una serie comparten `activeDays`, ese día siempre
 *  forma parte de la nueva serie y `newMissionId` es la copia visible en ese día. En cada
 *  día la copia se inserta justo debajo de la misión original (no al final de la lista),
 *  para que quede visible sin tener que hacer scroll; si ese día tiene un orden manual
 *  (MOO-29) que incluye a la original, la copia se añade justo después en `missionOrder`
 *  también, para conservar esa misma adyacencia. Si la original no está en el orden manual
 *  (cae en el bloque alfabético), no hace falta tocar `missionOrder`: el título de la copia
 *  comparte prefijo con el original, así que el orden alfabético ya las deja juntas. */
export function duplicateMission(
  data: FamilyData,
  dayIdx: number,
  missionId: string,
  idSeed: number,
): { days: Day[]; newMissionId: string | null } {
  const source = data.days[dayIdx]?.missions.find((mi) => mi.id === missionId)
  if (!source) return { days: data.days, newMissionId: null }
  const seriesId = `s${idSeed}`
  const title = `${source.title} (copia)`
  const newMissionId = `m${idSeed}-${dayIdx}`
  const days = data.days.map((day, di) => {
    if (!source.activeDays.includes(di)) return day
    const mission: Mission = {
      id: `m${idSeed}-${di}`,
      seriesId,
      emoji: source.emoji,
      title,
      points: source.points,
      status: 'pendiente',
      activeDays: source.activeDays,
      participants: [],
      assignedTo: source.assignedTo,
    }
    const originalIdx = day.missions.findIndex((mi) => mi.seriesId === source.seriesId)
    const missions =
      originalIdx === -1
        ? [...day.missions, mission]
        : [...day.missions.slice(0, originalIdx + 1), mission, ...day.missions.slice(originalIdx + 1)]
    const siblingId = originalIdx === -1 ? null : day.missions[originalIdx].id
    const orderPos = siblingId ? (day.missionOrder ?? []).indexOf(siblingId) : -1
    const missionOrder =
      orderPos === -1
        ? (day.missionOrder ?? [])
        : [...day.missionOrder.slice(0, orderPos + 1), mission.id, ...day.missionOrder.slice(orderPos + 1)]
    return { ...day, missions, missionOrder }
  })
  return { days, newMissionId }
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
  const hasChildren = data.children.length > 0
  let acumulado = data.acumulado
  let children = data.children
  if (mission?.status === 'completada') {
    if (hasChildren) {
      const participants = mission.participants.length ? mission.participants : data.children.map((c) => c.id)
      children = applyParticipantDelta(children, participants, -mission.points)
    } else {
      acumulado -= mission.points
    }
  }
  const seriesId = mission?.seriesId
  const days = data.days.map((d, di) => {
    if (di === dayIdx) return { ...d, missions: d.missions.filter((mi) => mi.id !== missionId) }
    if (!seriesId) return d
    return {
      ...d,
      missions: d.missions.map((mi) => (mi.seriesId === seriesId ? { ...mi, activeDays: mi.activeDays.filter((x) => x !== dayIdx) } : mi)),
    }
  })
  return { days, acumulado, children }
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
    missions: day.missions.map((mi) =>
      mi.status === 'pendiente' && mi.participants.length === 0 ? mi : { ...mi, status: 'pendiente' as const, participants: [] },
    ),
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

/** Si una misión está asignada a un hijo concreto (MOO-27). `assignedTo` vacío significa
 *  "todos los hijos" (familias sin hijos configurados, o documentos antiguos ya cubiertos por
 *  `normalize()`). Sin hijo activo (pantalla sin selector de hijo) siempre es visible. */
export function isMissionVisibleTo(mission: Mission, childId: string | null): boolean {
  if (!childId) return true
  return mission.assignedTo.length === 0 || mission.assignedTo.includes(childId)
}

export function byTitle(a: Mission, b: Mission): number {
  return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' })
}

/** Etiqueta legible de los días activos de una misión (p. ej. "Lun · Mié" o "Todos los días"). */
export function activeDaysLabel(mission: Mission, days: Day[]): string {
  if (mission.activeDays.length === days.length) return 'Todos los días'
  return mission.activeDays
    .slice()
    .sort((a, b) => a - b)
    .map((i) => days[i]?.short)
    .filter(Boolean)
    .join(' · ')
}

/** Etiqueta de a qué hijos está asignada una misión; vacía si es "todos" o hay un solo hijo. */
export function assignedToLabel(mission: Mission, kids: Child[]): string {
  if (kids.length <= 1 || mission.assignedTo.length === 0 || mission.assignedTo.length >= kids.length) return ''
  return ` · ${kids
    .filter((k) => mission.assignedTo.includes(k.id))
    .map((k) => k.name)
    .join(' · ')}`
}

/** Misiones únicas por `seriesId` (MOO-30): cada serie tiene una copia por día activo en
 *  `Day.missions`, pero los campos compartidos (título, puntos, emoji, días, asignación) son
 *  idénticos en todas sus copias, así que basta con quedarse con la primera que aparece.
 *  Ordenadas alfabéticamente, igual que el orden por defecto de una vista de día. */
export function uniqueMissionSeries(days: Day[]): Mission[] {
  const bySeriesId = new Map<string, Mission>()
  days.forEach((day) => {
    day.missions.forEach((mi) => {
      if (!bySeriesId.has(mi.seriesId)) bySeriesId.set(mi.seriesId, mi)
    })
  })
  return [...bySeriesId.values()].sort(byTitle)
}

/** Orden de visualización de las misiones de un día (MOO-29). Si `missionOrder` tiene
 *  entradas, respeta ese orden manual (ignorando IDs que ya no existan) y añade al final,
 *  ordenadas alfabéticamente, las misiones que no estén en la lista (recién creadas o
 *  documentos sin orden manual todavía). Si `missionOrder` está vacío, todo se ordena
 *  alfabéticamente — ese es el estado "resetear orden" y también el de una familia nueva. */
export function sortedMissions(day: Day): Mission[] {
  const order = day.missionOrder ?? []
  if (!order.length) return [...day.missions].sort(byTitle)
  const byId = new Map(day.missions.map((mi) => [mi.id, mi]))
  const ordered = order.map((id) => byId.get(id)).filter((mi): mi is Mission => !!mi)
  const orderedIds = new Set(ordered.map((mi) => mi.id))
  const rest = day.missions.filter((mi) => !orderedIds.has(mi.id)).sort(byTitle)
  return [...ordered, ...rest]
}

export function reorderMissions(data: FamilyData, dayIdx: number, missionIds: string[]): Pick<FamilyData, 'days'> {
  const days = data.days.map((day, di) => (di === dayIdx ? { ...day, missionOrder: missionIds } : day))
  return { days }
}

export function resetMissionOrder(data: FamilyData, dayIdx: number): Pick<FamilyData, 'days'> {
  const days = data.days.map((day, di) => (di === dayIdx ? { ...day, missionOrder: [] } : day))
  return { days }
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
