import type { Day, FamilyData, MissionStatus, RewardConcept, StatusMeta } from './types'

export const ACCENT = '#47702F'
export const BASE_POINTS_DEFAULT = 40

export const STATUS_ORDER: MissionStatus[] = ['pendiente', 'progreso', 'bloqueada', 'completada']

export const STATUS_META: Record<MissionStatus, StatusMeta> = {
  pendiente: { label: 'Pendiente', icon: '🌰', bg: '#ECE3D0', ring: '#C6B592', fg: '#7C6E52' },
  progreso: { label: 'En progreso', icon: '🌱', bg: '#F6E9C4', ring: '#DBA92C', fg: '#957414' },
  bloqueada: { label: 'Bloqueada', icon: '🥀', bg: '#F1DACF', ring: '#C4664A', fg: '#A04A32' },
  completada: { label: 'Completada', icon: '🌻', bg: '#DDEBC9', ring: '#5B8C3E', fg: '#3F6B26' },
}

export const EMOJI_PALETTE = [
  '🛏️', '🍽️', '🍴', '🪴', '🧸', '🗑️', '🛋️', '🧹', '🫧', '🧺',
  '👕', '🐶', '🎒', '♻️', '🍳', '🛁', '🍂', '🛒', '🚗', '📚', '🖊️', '🌻',
]

export const DEFAULT_CONCEPTS: RewardConcept[] = [
  { id: 'c1', emoji: '🎮', label: 'Consola' },
  { id: 'c2', emoji: '📺', label: 'Tele' },
  { id: 'c3', emoji: '📱', label: 'Tablet' },
  { id: 'c4', emoji: '🍦', label: 'Postre' },
]

/** Índice de hoy en la semana, con Lunes = 0 ... Domingo = 6. */
export function todayIndex(): number {
  return (new Date().getDay() + 6) % 7
}

function seedDays(): Day[] {
  const D = (label: string, short: string, missions: Day['missions']): Day => ({ label, short, missions })
  const m = (id: string, emoji: string, title: string, points: number, status: MissionStatus = 'pendiente') => ({
    id,
    emoji,
    title,
    points,
    status,
  })
  return [
    D('Lunes', 'Lun', [
      m('lun1', '🛏️', 'Hacer la cama', 10),
      m('lun2', '🍴', 'Poner la mesa', 10),
      m('lun3', '🪴', 'Regar las plantas del huerto', 10, 'progreso'),
      m('lun4', '🧸', 'Recoger los juguetes', 10),
      m('lun5', '🗑️', 'Sacar la basura', 10),
    ]),
    D('Martes', 'Mar', [
      m('mar1', '🍽️', 'Recoger mesa del comedor', 10),
      m('mar2', '🛏️', 'Hacer las camas', 10, 'completada'),
      m('mar3', '🧸', 'Recoger el cuarto', 10, 'progreso'),
      m('mar4', '🛋️', 'Recoger el salón', 10),
      m('mar5', '🧹', 'Aspirar el sofá', 15),
      m('mar6', '🧹', 'Aspirar el salón', 15),
      m('mar7', '🫧', 'Gestionar el lavavajillas', 10, 'completada'),
      m('mar8', '🧺', 'Recoger y doblar los trapos', 10),
      m('mar9', '👕', 'Ayudar a tender la ropa', 10, 'bloqueada'),
    ]),
    D('Miércoles', 'Mié', [
      m('mie1', '🛏️', 'Hacer la cama', 10),
      m('mie2', '🐶', 'Dar de comer a la mascota', 10),
      m('mie3', '🎒', 'Ordenar la mochila', 10),
      m('mie4', '🫧', 'Poner el lavavajillas', 10),
      m('mie5', '🧹', 'Barrer la cocina', 10),
    ]),
    D('Jueves', 'Jue', [
      m('jue1', '🛏️', 'Hacer la cama', 10),
      m('jue2', '🪴', 'Regar el huerto', 10),
      m('jue3', '🧸', 'Recoger el cuarto', 10),
      m('jue4', '🍳', 'Ayudar con la cena', 10),
      m('jue5', '♻️', 'Sacar el reciclaje', 10),
    ]),
    D('Viernes', 'Vie', [
      m('vie1', '🛏️', 'Hacer la cama', 10),
      m('vie2', '🛋️', 'Recoger el salón', 10),
      m('vie3', '🖊️', 'Limpiar tu escritorio', 10),
      m('vie4', '👕', 'Doblar tu ropa', 10),
      m('vie5', '🍴', 'Poner la mesa', 10),
    ]),
    D('Sábado', 'Sáb', [
      m('sab1', '🛏️', 'Cambiar las sábanas', 15),
      m('sab2', '🛁', 'Limpiar el baño', 15),
      m('sab3', '🍂', 'Recoger el jardín', 10),
      m('sab4', '🛒', 'Ayudar con la compra', 10),
      m('sab5', '🚗', 'Lavar el coche', 20),
    ]),
    D('Domingo', 'Dom', [
      m('dom1', '🎒', 'Preparar la mochila del lunes', 10),
      m('dom2', '🪴', 'Regar las plantas', 10),
      m('dom3', '📚', 'Ordenar los libros', 10),
      m('dom4', '🍳', 'Ayudar a cocinar', 10),
    ]),
  ]
}

export function seedFamilyData(): FamilyData {
  const days = seedDays()
  const acumulado =
    BASE_POINTS_DEFAULT +
    days.reduce((sum, d) => sum + d.missions.reduce((s, mi) => s + (mi.status === 'completada' ? mi.points : 0), 0), 0)
  return {
    basePoints: BASE_POINTS_DEFAULT,
    acumulado,
    concepts: DEFAULT_CONCEPTS,
    days,
    children: [],
  }
}
