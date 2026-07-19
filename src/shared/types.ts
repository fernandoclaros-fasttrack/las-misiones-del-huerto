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
}

export interface StatusMeta {
  label: string
  icon: string
  bg: string
  ring: string
  fg: string
}
