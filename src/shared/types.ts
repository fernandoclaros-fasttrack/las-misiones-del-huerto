export type MissionStatus = 'pendiente' | 'progreso' | 'bloqueada' | 'completada'

export interface Mission {
  id: string
  /** Vincula las copias de una misma misión en distintos días (MOO-25). */
  seriesId: string
  emoji: string
  title: string
  points: number
  status: MissionStatus
  /** Días de la semana (índices, Lunes=0..Domingo=6) en los que la misión está activa (MOO-25). */
  activeDays: number[]
  /** IDs de los hijos que participaron en la completación actual (MOO-26). Solo tiene
   *  contenido mientras `status === 'completada'` y solo se usa cuando hay hijos configurados;
   *  se vacía al descompletar la misión. */
  participants: string[]
  /** IDs de los hijos a los que está asignada la misión (MOO-27); solo se usa cuando hay hijos
   *  configurados. Las misiones creadas antes de MOO-27 no tienen este campo — `normalize()` en
   *  useFamilyData.ts las trata como asignadas a todos los hijos actuales (comportamiento previo
   *  a esta funcionalidad), recalculado en cada lectura hasta que la misión se guarde de nuevo. */
  assignedTo: string[]
}

export interface Day {
  label: string
  short: string
  missions: Mission[]
  /** IDs de misión en el orden manual elegido por el padre/madre (MOO-29). Vacío = orden
   *  alfabético por título (por defecto). Los IDs que ya no existan se ignoran; las misiones
   *  no listadas aquí (recién creadas, o todas si el array está vacío) se añaden ordenadas
   *  alfabéticamente al final — ver `sortedMissions()` en logic.ts. */
  missionOrder: string[]
}

export interface RewardConcept {
  id: string
  emoji: string
  label: string
  /** Marca el concepto como penalización (MOO-41), para distinguirlo visualmente de una
   *  recompensa en el historial de canjes del hijo/a. */
  isPenalty: boolean
  /** Si el concepto pide el importe manualmente en cada canje, en vez de aplicar siempre el
   *  mismo coste (MOO-54). Ausente = concepto creado antes de MOO-54; se trata como variable o
   *  fijo según tuviera o no un `cost` configurado — ver `isConceptVariableCost()` en logic.ts,
   *  que es la única fuente de verdad para esto (no leer este campo directamente). */
  isVariableCost?: boolean
  /** Coste en puntos configurado para este concepto (MOO-52). Solo tiene valor cuando el
   *  concepto es de coste fijo — ver `isConceptVariableCost()`. */
  cost?: number
}

export interface Child {
  id: string
  name: string
  points: number
}

export interface Redemption {
  id: string
  childId: string
  points: number
  conceptEmoji: string
  conceptLabel: string
  /** Copiado de `RewardConcept.isPenalty` en el momento del canje (MOO-41), para que el
   *  historial pueda mostrar las penalizaciones en rojo aunque el concepto cambie después. */
  isPenalty: boolean
  /** epoch ms */
  timestamp: number
}

/** Ajuste manual de los puntos de un hijo/a con un motivo escrito (MOO2-51). A diferencia de
 *  `Redemption` (que siempre resta y va ligada a un concepto de canje configurado) esto es un
 *  movimiento suelto: el padre/madre escribe cuántos puntos y por qué. `points` va **con signo**
 *  — positivo al dar puntos (MOO2-51); el caso negativo (penalizaciones, MOO2-52) reutilizará
 *  esta misma estructura. Se muestran mezclados con los canjes en el historial del hijo/a. */
export interface PointAdjustment {
  id: string
  childId: string
  /** Con signo: positivo suma puntos al hijo/a, negativo los resta. Nunca 0. */
  points: number
  /** Motivo escrito por el padre/madre. Obligatorio: no se puede guardar vacío. */
  reason: string
  /** epoch ms */
  timestamp: number
}

/** Quién realizó una acción registrada en `FamilyData.changeLog` (MOO-39): la pantalla de
 *  hijos solo puede completar/descompletar misiones, todo lo demás sale de la de padres — no
 *  hay una identidad por persona (login es una única contraseña compartida, ver MOO-24). */
export type ChangeActor = 'padre' | 'hijo'

export interface ChangeLogEntry {
  id: string
  actor: ChangeActor
  /** Texto ya listo para mostrar (qué pasó), en español. */
  description: string
  /** epoch ms */
  timestamp: number
}

export interface FamilyData {
  basePoints: number
  /** Contador compartido heredado (v1). Se mantiene mientras no haya hijos configurados;
   *  en cuanto exista al menos un Child, los puntos de las misiones van a children[].points
   *  en su lugar y este campo deja de recibir cambios por misiones (ver MOO-17). */
  acumulado: number
  concepts: RewardConcept[]
  days: Day[]
  children: Child[]
  /** Histórico de canjes por hijo (MOO-22). Solo se generan al canjear puntos de un hijo
   *  concreto (MOO-21); el canje del contador compartido (MOO-11) no genera entradas aquí. */
  redemptions: Redemption[]
  /** Ajustes manuales de puntos con motivo (MOO2-51). Complementan a `redemptions` en el
   *  historial por hijo/a: ambos son movimientos del saldo, pero un canje gasta puntos en un
   *  concepto configurado y un ajuste es puntual y lleva texto libre. */
  adjustments: PointAdjustment[]
  /** Orden manual de la vista global "Todo" (MOO-30), por `seriesId` (no por `id` de misión,
   *  que es distinto por copia/día). Vacío = orden alfabético por título, igual criterio que
   *  `Day.missionOrder` — ver `sortedMissionSeries()` en logic.ts. */
  globalMissionOrder: string[]
  /** Historial de acciones que afectan a los puntos acumulados (MOO-39), sin importar si
   *  vienen de una misión, un canje, una penalización o una edición manual — a diferencia de
   *  `redemptions`, que solo cubre canjes. Se genera en `useFamilyData.ts` (no en `logic.ts`,
   *  que se mantiene puro), comparando el total de puntos antes/después de cada acción. */
  changeLog: ChangeLogEntry[]
}

export interface StatusMeta {
  label: string
  icon: string
  bg: string
  ring: string
  fg: string
}
