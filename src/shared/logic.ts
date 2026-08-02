import type {
  ChangeLogEntry,
  Child,
  ChildPointsDelta,
  Day,
  FamilyData,
  Mission,
  MissionStatus,
  MissionTemplate,
  PointAdjustment,
  Redemption,
  RewardConcept,
} from './types'

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

/** Delta de puntos que recibiría `childId` (o el contador compartido si es `null`) al pasar una
 *  misión de su estado actual a `newStatus`, con los participantes `participantIds` (solo
 *  relevante al completar — mismo criterio que `setMissionStatus`). Se usa tanto para aplicar el
 *  cambio real como para previsualizarlo (animación en la pantalla de hijos); mantenerlo en un
 *  único sitio evita que la previsualización y el cambio real diverjan. */
export function pointsDeltaFor(
  mission: Mission,
  newStatus: MissionStatus,
  participantIds: string[] | undefined,
  childId: string | null,
  allChildIds: string[],
): number {
  const was = mission.status === 'completada'
  const now = newStatus === 'completada'
  if (was === now) return 0
  if (!childId) return now ? mission.points : -mission.points
  if (now) {
    const participants = participantIds?.length ? participantIds : allChildIds
    return participants.includes(childId) ? mission.points : 0
  }
  const participants = mission.participants.length ? mission.participants : allChildIds
  return participants.includes(childId) ? -mission.points : 0
}

export interface NewMissionInput {
  emoji: string
  title: string
  points: number
  dayIndices: number[]
  /** IDs de los hijos asignados (MOO-27); solo relevante cuando hay hijos configurados. */
  assignedTo: string[]
  /** Fecha ISO si la misión es one-off (MOO2-56/61); ausente = recurrente. Cuando está presente,
   *  `dayIndices` debe ser el día de la semana de esa fecha (un único elemento) — lo calcula
   *  quien llama (ver `weekdayOfISODate()` en constants.ts), no esta función. */
  oneOffDate?: string
}

export function addMission(data: FamilyData, input: NewMissionInput, idSeed: number): Pick<FamilyData, 'days'> {
  const title = input.title.trim()
  const points = Math.max(0, Math.round(input.points) || 0)
  const targets = input.dayIndices.length ? input.dayIndices : []
  const seriesId = `s${idSeed}`
  const days = data.days.map((day, di) => {
    if (!targets.includes(di)) return day
    const mission: Mission = {
      id: `m${idSeed}-${di}`,
      seriesId,
      emoji: input.emoji,
      title,
      points,
      status: 'pendiente',
      activeDays: targets,
      participants: [],
      assignedTo: input.assignedTo,
      ...(input.oneOffDate ? { oneOffDate: input.oneOffDate } : {}),
    }
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
  /** Fecha ISO si la misión pasa a (o sigue siendo) one-off (MOO2-56/61); `undefined` la deja
   *  (o la vuelve a dejar) recurrente. Igual que en `NewMissionInput`, `activeDays` ya debe
   *  contener solo el día de la semana de esa fecha cuando esto está presente. */
  oneOffDate?: string
}

/** Edita una misión por su `seriesId` (MOO-25): los campos compartidos (emoji, título,
 *  puntos, días activos) se propagan a todas sus copias, se crean copias nuevas en los
 *  días recién seleccionados (con status 'pendiente') y se eliminan las de los días que
 *  dejan de estar activos. El status de las copias que se mantienen no se toca.
 *
 *  Cambiar entre one-off y recurrente (MOO2-61) reutiliza este mismo mecanismo: una misión
 *  one-off solo tiene un día activo (el de su fecha), así que pasar de recurrente a one-off es,
 *  para esta función, editar `activeDays` a un único día como cualquier otro cambio de días —
 *  las copias de los días que dejan de estar activos se borran igual que siempre. */
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
        missions: day.missions.map((mi) => {
          if (mi.seriesId !== seriesId) return mi
          // Firestore rechaza valores `undefined` explícitos, así que al volver a recurrente
          // hay que quitar la clave por completo en vez de ponerla a `undefined` (destructuring
          // en vez de spread simple con el nuevo valor).
          const { oneOffDate: _drop, ...rest } = mi
          return { ...rest, emoji: input.emoji, title, points, activeDays, assignedTo: input.assignedTo, ...(input.oneOffDate ? { oneOffDate: input.oneOffDate } : {}) }
        }),
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
      const mission: Mission = {
        id: `${seriesId}-${di}`,
        seriesId,
        emoji: input.emoji,
        title,
        points,
        status: 'pendiente',
        activeDays,
        participants: [],
        assignedTo: input.assignedTo,
        ...(input.oneOffDate ? { oneOffDate: input.oneOffDate } : {}),
      }
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
 *  también, para conservar esa misma adyacencia. Lo mismo aplica al orden manual de la vista
 *  global "Todo" (MOO-30): si `globalMissionOrder` incluye a la serie original, la nueva serie
 *  se añade justo después ahí también — si no, duplicar una misión en medio de una lista
 *  reordenada a mano la mandaría al final (bloque alfabético) en vez de quedar junto al
 *  original. Si la original no está en ninguno de los dos órdenes manuales (cae en el bloque
 *  alfabético), no hace falta tocarlos: el título de la copia comparte prefijo con el
 *  original, así que el orden alfabético ya las deja juntas. */
export function duplicateMission(
  data: FamilyData,
  dayIdx: number,
  missionId: string,
  idSeed: number,
): { days: Day[]; globalMissionOrder: string[]; newMissionId: string | null } {
  const source = data.days[dayIdx]?.missions.find((mi) => mi.id === missionId)
  if (!source) return { days: data.days, globalMissionOrder: data.globalMissionOrder, newMissionId: null }
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
      // Una copia de una misión one-off (MOO2-56) sigue siendo one-off para la misma fecha; si
      // no se copiara, la copia recurriría cada semana en ese día, que no es lo que "duplicar"
      // significa aquí.
      ...(source.oneOffDate ? { oneOffDate: source.oneOffDate } : {}),
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
  const globalOrderPos = (data.globalMissionOrder ?? []).indexOf(source.seriesId)
  const globalMissionOrder =
    globalOrderPos === -1
      ? data.globalMissionOrder
      : [...data.globalMissionOrder.slice(0, globalOrderPos + 1), seriesId, ...data.globalMissionOrder.slice(globalOrderPos + 1)]
  return { days, globalMissionOrder, newMissionId }
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

/** Borra una serie de misión entera (MOO-30): todas sus copias en todos los días, no solo
 *  la de un día concreto (a diferencia de `deleteMission`). Es lo que "Borrar" tiene que
 *  significar en la vista global "Todo": esa vista no tiene un día de referencia, así que un
 *  borrado parcial dejaría la fila viéndose igual (con otra copia como representante) sin dar
 *  ninguna señal de que "borrar" hizo algo. Ajusta puntos por cada copia que estuviera
 *  `completada` en su propio día — cada copia tiene su propio estado independiente. */
export function deleteMissionSeries(data: FamilyData, seriesId: string): Pick<FamilyData, 'days' | 'acumulado' | 'children'> {
  const hasChildren = data.children.length > 0
  let acumulado = data.acumulado
  let children = data.children
  data.days.forEach((day) => {
    const mission = day.missions.find((mi) => mi.seriesId === seriesId)
    if (mission?.status !== 'completada') return
    if (hasChildren) {
      const participants = mission.participants.length ? mission.participants : data.children.map((c) => c.id)
      children = applyParticipantDelta(children, participants, -mission.points)
    } else {
      acumulado -= mission.points
    }
  })
  const days = data.days.map((day) => ({ ...day, missions: day.missions.filter((mi) => mi.seriesId !== seriesId) }))
  return { days, acumulado, children }
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

/** Si un concepto de canje pide el importe manualmente en cada canje, en vez de aplicar siempre
 *  el mismo coste (MOO-54). Única fuente de verdad para esta distinción — no leer `cost` ni
 *  `isVariableCost` directamente fuera de aquí. Conceptos creados antes de MOO-54 no tienen
 *  `isVariableCost` explícito: se tratan como coste variable si nunca tuvieron un `cost`
 *  configurado (comportamiento previo a esta funcionalidad), o como coste fijo si ya lo tenían
 *  (MOO-52), sin que haga falta editarlos manualmente. */
export function isConceptVariableCost(concept: RewardConcept): boolean {
  return concept.isVariableCost ?? concept.cost === undefined
}

export function addConcept(
  data: FamilyData,
  concept: Omit<RewardConcept, 'id' | 'isVariableCost'> & { isVariableCost: boolean },
  idSeed: number,
): { concepts: RewardConcept[]; id: string | null } {
  const label = concept.label.trim()
  if (!label) return { concepts: data.concepts, id: null }
  const cost = concept.cost && concept.cost > 0 ? Math.round(concept.cost) : undefined
  // Un concepto de coste fijo necesita un coste válido para poder crearse; uno de coste
  // variable nunca guarda un coste, aunque se hubiera introducido algo en ese campo.
  if (!concept.isVariableCost && cost === undefined) return { concepts: data.concepts, id: null }
  const id = `uc${idSeed}`
  const newConcept: RewardConcept = {
    id,
    emoji: concept.emoji,
    label,
    isVariableCost: concept.isVariableCost ?? false,
    ...(concept.isVariableCost ? {} : { cost }),
  }
  return { concepts: [...data.concepts, newConcept], id }
}

export function removeConcept(data: FamilyData, conceptId: string): Pick<FamilyData, 'concepts'> {
  return { concepts: data.concepts.filter((c) => c.id !== conceptId) }
}

/** Edita el tipo de coste (fijo/variable) y, si es fijo, su valor en puntos (MOO-54). Un
 *  concepto de coste fijo necesita un coste válido (> 0) para poder guardarse — si no lo tiene,
 *  la edición se descarta y el concepto se queda como estaba, en vez de guardarse en un estado
 *  inválido. Al convertir a coste variable, el coste fijo anterior se conserva (aunque deje de
 *  aplicarse) en vez de descartarse, precisamente para que sea distinguible de "nunca tuvo uno"
 *  y se pueda recuperar sin volver a escribirlo si el concepto vuelve a convertirse en fijo —
 *  es la razón de fondo por la que este campo es explícito y no solo inferido de `cost`. */
export function editConcept(
  data: FamilyData,
  conceptId: string,
  changes: { isVariableCost: boolean; cost: number | null },
): Pick<FamilyData, 'concepts'> {
  const cost = changes.cost !== null && changes.cost > 0 ? Math.round(changes.cost) : undefined
  if (!changes.isVariableCost && cost === undefined) return { concepts: data.concepts }
  const concepts = data.concepts.map((c) =>
    c.id === conceptId ? (changes.isVariableCost ? { ...c, isVariableCost: true } : { ...c, isVariableCost: false, cost: cost! }) : c,
  )
  return { concepts }
}

/** Si una misión está asignada a un hijo concreto (MOO-27). `assignedTo` vacío significa
 *  "todos los hijos" (familias sin hijos configurados, o documentos antiguos ya cubiertos por
 *  `normalize()`). Sin hijo activo (pantalla sin selector de hijo) siempre es visible. */
export function isMissionVisibleTo(mission: Mission, childId: string | null): boolean {
  if (!childId) return true
  return mission.assignedTo.length === 0 || mission.assignedTo.includes(childId)
}

/** Si una misión one-off (MOO2-56) debe mostrarse hoy: solo cuando la fecha real de hoy
 *  coincide con `oneOffDate`, no cada vez que se repite ese día de la semana — a diferencia de
 *  una misión recurrente, que siempre está activa (`true`) independientemente del día. Es lo que
 *  hace que una misión one-off deje de aparecer para siempre en cuanto pasa su fecha, aunque
 *  siga viviendo en el `Day` de ese día de la semana hasta que alguien la borre. */
export function isMissionActiveToday(mission: Mission, todayISO: string): boolean {
  return mission.oneOffDate === undefined || mission.oneOffDate === todayISO
}

export function byTitle(a: Mission, b: Mission): number {
  return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' })
}

/** Etiqueta corta de la fecha de una misión one-off (MOO2-56), p. ej. "2 ago", para el
 *  distintivo que la diferencia de una recurrente en la tarjeta de la vista de padres. */
export function oneOffDateLabel(iso: string): string {
  const [y, m, day] = iso.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
}

/** Etiqueta de a qué hijos está asignada una misión; vacía si es "todos" o hay un solo hijo. */
export function assignedToLabel(mission: Mission, kids: Child[]): string {
  if (kids.length <= 1 || mission.assignedTo.length === 0 || mission.assignedTo.length >= kids.length) return ''
  return kids
    .filter((k) => mission.assignedTo.includes(k.id))
    .map((k) => k.name)
    .join(' · ')
}

/** Misiones únicas por `seriesId` (MOO-30): cada serie tiene una copia por día activo en
 *  `Day.missions`, pero los campos compartidos (título, puntos, emoji, días, asignación) son
 *  idénticos en todas sus copias, así que basta con quedarse con la primera que aparece. Sin
 *  ordenar — ver `sortedMissionSeries()` para el orden de visualización de la vista "Todo". */
export function uniqueMissionSeries(days: Day[]): Mission[] {
  const bySeriesId = new Map<string, Mission>()
  days.forEach((day) => {
    day.missions.forEach((mi) => {
      if (!bySeriesId.has(mi.seriesId)) bySeriesId.set(mi.seriesId, mi)
    })
  })
  return [...bySeriesId.values()]
}

/** Orden de visualización de la vista global "Todo" (MOO-30). Mismo criterio que
 *  `sortedMissions()` para un día, pero a nivel de serie (`globalMissionOrder` guarda
 *  `seriesId`, no `id` de una copia concreta, porque el `id` de la copia representante de
 *  cada serie puede cambiar si esa copia deja de estar activa). Vacío = orden alfabético. */
export function sortedMissionSeries(data: Pick<FamilyData, 'days' | 'globalMissionOrder'>): Mission[] {
  const unique = uniqueMissionSeries(data.days)
  const order = data.globalMissionOrder ?? []
  if (!order.length) return unique.sort(byTitle)
  const bySeriesId = new Map(unique.map((mi) => [mi.seriesId, mi]))
  const ordered = order.map((id) => bySeriesId.get(id)).filter((mi): mi is Mission => !!mi)
  const orderedIds = new Set(ordered.map((mi) => mi.seriesId))
  const rest = unique.filter((mi) => !orderedIds.has(mi.seriesId)).sort(byTitle)
  return [...ordered, ...rest]
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

export function reorderGlobalMissions(_data: FamilyData, seriesIds: string[]): Pick<FamilyData, 'globalMissionOrder'> {
  return { globalMissionOrder: seriesIds }
}

export function resetGlobalMissionOrder(_data: FamilyData): Pick<FamilyData, 'globalMissionOrder'> {
  return { globalMissionOrder: [] }
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
    // Desde MOO2-52 un canje nunca es una penalización — esas son su propia acción.
    isPenalty: false,
    timestamp: idSeed,
  }
  return { ok: true, children, redemptions: [...data.redemptions, redemption] }
}

export function redemptionsForChild(redemptions: Redemption[], childId: string): Redemption[] {
  return redemptions.filter((r) => r.childId === childId).sort((a, b) => b.timestamp - a.timestamp)
}

/** Una fila del historial de puntos de un hijo/a (MOO2-53). */
export interface LedgerRow {
  id: string
  /** Con signo: lo que esta acción sumó o restó a *este* hijo/a. */
  points: number
  /** Qué pasó, en corto: nombre de misión, motivo escrito, premio canjeado… */
  reason: string
  /** Puntos que le quedaron al hijo/a justo después de esta acción. */
  balanceAfter: number
  /** epoch ms */
  timestamp: number
}

/** Historial de puntos de un hijo/a (MOO2-53): todo lo que movió sus puntos, del más reciente al
 *  más antiguo, con el saldo resultante en cada fila.
 *
 *  El saldo se calcula **hacia atrás desde los puntos actuales**, restando cada movimiento, y no
 *  hacia delante desde cero: las entradas anteriores a MOO2-53 no tienen desglose por hijo/a y
 *  nunca lo tendrán, así que el historial no arranca en cero y sumar hacia delante daría un saldo
 *  que no cuadra con el número que el niño/a ve en su pantalla.
 *
 *  Las entradas sin motivo propio caen en `description`, que es texto de la pantalla de padres
 *  pero sigue explicando qué pasó. */
export function childLedger(changeLog: ChangeLogEntry[], childId: string, currentPoints: number): LedgerRow[] {
  const mine = changeLog
    .map((entry) => ({ entry, delta: entry.deltas.find((d) => d.childId === childId) }))
    .filter((x): x is { entry: ChangeLogEntry; delta: ChildPointsDelta } => x.delta !== undefined)
    .sort((a, b) => b.entry.timestamp - a.entry.timestamp)

  let balance = currentPoints
  return mine.map(({ entry, delta }) => {
    const row: LedgerRow = {
      id: entry.id,
      points: delta.points,
      reason: entry.reason ?? entry.description,
      balanceAfter: balance,
      timestamp: entry.timestamp,
    }
    balance -= delta.points
    return row
  })
}

/** Lunes 00:00 de la semana a la que pertenece un instante. La semana empieza en lunes para que
 *  coincida con las pestañas de días del resto de la app (Lunes=0 … Domingo=6). */
function startOfWeek(timestamp: number): number {
  const d = new Date(timestamp)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

export interface LedgerWeek {
  /** epoch ms del lunes de esa semana; sirve de key y de criterio de orden. */
  weekStart: number
  label: string
  rows: LedgerRow[]
}

/** Agrupa el historial en semanas (MOO2-53), de la más reciente a la más antigua, para que la
 *  lista siga siendo legible según crece — con las misiones dentro son varias entradas al día. */
export function groupLedgerByWeek(rows: LedgerRow[], now: number): LedgerWeek[] {
  const thisWeek = startOfWeek(now)
  const weeks = new Map<number, LedgerRow[]>()
  for (const row of rows) {
    const key = startOfWeek(row.timestamp)
    const bucket = weeks.get(key)
    if (bucket) bucket.push(row)
    else weeks.set(key, [row])
  }
  return [...weeks.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([weekStart, weekRows]) => ({
      weekStart,
      label:
        weekStart === thisWeek
          ? 'Esta semana'
          : `Semana del ${new Date(weekStart).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`,
      rows: weekRows,
    }))
}

/** Una fila del "Historial de cambios" de padres (MOO2-55). */
export interface ChangeHistoryRow {
  entry: ChangeLogEntry
  /** Puntos que la acción movió para el hijo/a filtrado. Ausente cuando no hay filtro: sin
   *  hijo/a de referencia una sola cifra no significaría nada (la acción pudo mover a varios). */
  points?: number
}

/** Filas del historial de padres, de la más reciente a la más antigua (MOO2-55). Con `childId`
 *  se queda solo con las acciones que movieron los puntos de ese hijo/a, y añade cuántos.
 *
 *  Una misma acción que movió a varios hijos aparece bajo el filtro de cada uno con su cifra
 *  correspondiente. Sin filtro se devuelve todo tal cual, para que la vista siga comportándose
 *  exactamente como la dejó MOO2-18. */
export function changeHistoryRows(changeLog: ChangeLogEntry[], childId: string | null): ChangeHistoryRow[] {
  const sorted = [...changeLog].sort((a, b) => b.timestamp - a.timestamp)
  if (!childId) return sorted.map((entry) => ({ entry }))
  return sorted.flatMap((entry) => {
    const delta = entry.deltas.find((d) => d.childId === childId)
    return delta ? [{ entry, points: delta.points }] : []
  })
}

/** Entradas sin desglose por hijo/a: las guardadas antes de MOO2-53, que no se puede reconstruir
 *  a quién afectaron. Quedan fuera de cualquier filtro por hijo/a, así que la vista lo avisa en
 *  vez de dejar al padre/madre con una lista corta sin explicación. */
export function entriesWithoutChildBreakdown(changeLog: ChangeLogEntry[]): number {
  return changeLog.filter((e) => e.deltas.length === 0).length
}

/** Canjes de un hijo/a entendidos como "en qué me he gastado los puntos" (MOO2-54), que es lo
 *  que muestra su "Historial de canjeos". Deja fuera los canjes marcados como penalización:
 *  son registros de antes de MOO2-52, cuando penalizar era canjear un concepto especial, y una
 *  penalización no es algo que el niño/a haya elegido comprar. Siguen contando en su saldo y
 *  aparecen en el historial de padres, que sí es el registro completo. */
export function spentRedemptionsForChild(redemptions: Redemption[], childId: string): Redemption[] {
  return redemptionsForChild(redemptions, childId).filter((r) => !r.isPenalty)
}

export interface ChildAdjustResult {
  ok: boolean
  error?: string
  children?: Child[]
  adjustments?: PointAdjustment[]
}

/** Ajusta los puntos de un hijo/a con un motivo obligatorio: darlos (MOO2-51) o quitarlos
 *  (MOO2-52). `points` llega con signo, así que las dos direcciones comparten validación en vez
 *  de duplicarla; lo único que no se acepta es 0, que no movería el saldo pero sí dejaría una
 *  entrada en el historial. Los mensajes de error son neutros por eso mismo: los ve tanto quien
 *  está dando puntos como quien los está quitando. No se comprueba que haya saldo suficiente a propósito: a diferencia de un canje,
 *  el saldo puede quedar negativo (decisión de producto, MOO2-52). */
export function adjustChildPoints(
  data: FamilyData,
  childId: string,
  points: number,
  reason: string,
  idSeed: number,
): ChildAdjustResult {
  const pts = Math.round(points) || 0
  const trimmed = reason.trim()
  const child = data.children.find((c) => c.id === childId)
  if (!child) return { ok: false, error: 'No se encuentra a ese hijo/a.' }
  if (pts === 0) return { ok: false, error: 'Introduce cuántos puntos.' }
  if (!trimmed) return { ok: false, error: 'Escribe el motivo.' }
  const children = data.children.map((c) => (c.id === childId ? { ...c, points: c.points + pts } : c))
  const adjustment: PointAdjustment = { id: `adj${idSeed}`, childId, points: pts, reason: trimmed, timestamp: idSeed }
  return { ok: true, children, adjustments: [...data.adjustments, adjustment] }
}

/** Deshace un ajuste manual devolviendo (o retirando) sus puntos, igual que `deleteRedemption`
 *  hace con un canje — el historial del hijo/a mezcla ambos, así que las dos clases de entrada
 *  tienen que poder corregirse de la misma forma. */
export function deleteAdjustment(data: FamilyData, adjustmentId: string): Pick<FamilyData, 'children' | 'adjustments'> {
  const adjustment = data.adjustments.find((a) => a.id === adjustmentId)
  if (!adjustment) return { children: data.children, adjustments: data.adjustments }
  const children = data.children.map((c) => (c.id === adjustment.childId ? { ...c, points: c.points - adjustment.points } : c))
  return { children, adjustments: data.adjustments.filter((a) => a.id !== adjustmentId) }
}

/** Una fila del historial de saldo de un hijo/a: un canje (siempre resta, ligado a un concepto)
 *  o un ajuste manual con motivo (MOO2-51). Se unifican aquí para que el historial pueda
 *  ordenarlos entre sí por fecha en vez de mostrar dos listas separadas. */
export type BalanceEntry =
  | { kind: 'redemption'; redemption: Redemption; timestamp: number }
  | { kind: 'adjustment'; adjustment: PointAdjustment; timestamp: number }

/** Historial de saldo de un hijo/a: canjes y ajustes manuales mezclados, del más reciente al
 *  más antiguo (mismo criterio que ya usaba `redemptionsForChild`). */
export function balanceEntriesForChild(
  redemptions: Redemption[],
  adjustments: PointAdjustment[],
  childId: string,
): BalanceEntry[] {
  const entries: BalanceEntry[] = [
    ...redemptions.filter((r) => r.childId === childId).map((r): BalanceEntry => ({ kind: 'redemption', redemption: r, timestamp: r.timestamp })),
    ...adjustments.filter((a) => a.childId === childId).map((a): BalanceEntry => ({ kind: 'adjustment', adjustment: a, timestamp: a.timestamp })),
  ]
  return entries.sort((a, b) => b.timestamp - a.timestamp)
}

/** Borra una entrada del historial de canjes (MOO-44) y devuelve sus puntos al hijo, para
 *  poder corregir un canje registrado por error sin afectar al resto del historial. */
export function deleteRedemption(data: FamilyData, redemptionId: string): Pick<FamilyData, 'children' | 'redemptions'> {
  const redemption = data.redemptions.find((r) => r.id === redemptionId)
  if (!redemption) return { children: data.children, redemptions: data.redemptions }
  const children = data.children.map((c) => (c.id === redemption.childId ? { ...c, points: c.points + redemption.points } : c))
  const redemptions = data.redemptions.filter((r) => r.id !== redemptionId)
  return { children, redemptions }
}

/** Añade o refresca una entrada de la lista rápida de misiones (MOO2-57) a partir de una misión
 *  recién creada a mano. Se identifica por título (sin distinguir mayúsculas ni espacios de
 *  sobra) porque es el único campo con el que la familia reconocería "es la misma misión de
 *  siempre": si ya existe, se refresca su emoji/puntos a los últimos usados en vez de duplicarla.
 *  Solo se llama desde `addMission` cuando la misión se escribe a mano (nunca al editarla, ni al
 *  crearla eligiéndola de esta misma lista) — ver `useFamilyData.ts`. */
export function upsertMissionTemplate(templates: MissionTemplate[], mission: { emoji: string; title: string; points: number }, idSeed: number): MissionTemplate[] {
  const title = mission.title.trim()
  if (!title) return templates
  const points = Math.max(0, Math.round(mission.points) || 0)
  const existing = templates.find((t) => t.title.trim().toLowerCase() === title.toLowerCase())
  if (existing) return templates.map((t) => (t.id === existing.id ? { ...t, emoji: mission.emoji, title, points } : t))
  return [...templates, { id: `tpl${idSeed}`, emoji: mission.emoji, title, points }]
}

/** Edita el título y/o los puntos de una entrada de la lista rápida (MOO2-59). No toca ninguna
 *  misión ya programada: una plantilla es solo el punto de partida para crear una futura. */
export function editMissionTemplate(templates: MissionTemplate[], templateId: string, changes: { title: string; points: number }): MissionTemplate[] {
  const title = changes.title.trim()
  if (!title) return templates
  const points = Math.max(0, Math.round(changes.points) || 0)
  return templates.map((t) => (t.id === templateId ? { ...t, title, points } : t))
}

/** Quita una entrada de la lista rápida (MOO2-60): deja de sugerirse para futuras misiones, sin
 *  afectar a ninguna misión ya programada en un día (esas viven en `Day.missions`, no aquí). */
export function deleteMissionTemplate(templates: MissionTemplate[], templateId: string): MissionTemplate[] {
  return templates.filter((t) => t.id !== templateId)
}
