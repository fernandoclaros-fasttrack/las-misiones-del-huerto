export type MissionStatus = 'pendiente' | 'progreso' | 'bloqueada' | 'completada'

export interface Mission {
  id: string
  emoji: string
  title: string
  points: number
  status: MissionStatus
}

export interface Day {
  label: string
  short: string
  missions: Mission[]
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
