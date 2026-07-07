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

export interface FamilyData {
  basePoints: number
  acumulado: number
  concepts: RewardConcept[]
  days: Day[]
}

export interface StatusMeta {
  label: string
  icon: string
  bg: string
  ring: string
  fg: string
}
