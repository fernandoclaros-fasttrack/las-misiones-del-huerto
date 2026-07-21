import { useCallback, useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore'
import { FAMILY_DOC_PATH, firebaseEnabled, firestore } from './firebase'
import { localStore } from './localStore'
import { seedFamilyData } from './constants'
import type { FamilyData, MissionStatus } from './types'
import * as logic from './logic'

type Patch = Partial<FamilyData> | null
type Mutator<TResult> = (data: FamilyData) => { patch: Patch; result: TResult }

/** IDs únicos y monótonos para misiones/hijos/conceptos/canjes. Basados en Date.now() (se
 *  preserva su uso como timestamp de canjes), pero con un contador de respaldo para que dos
 *  acciones en el mismo milisegundo no generen el mismo ID. */
let lastId = 0
function nextId(): number {
  const now = Date.now()
  lastId = now > lastId ? now : lastId + 1
  return lastId
}

/** Documentos guardados antes de MOO-17/22 no tienen `children`/`redemptions`, antes de
 *  MOO-25 sus misiones no tienen `seriesId`/`activeDays`, antes de MOO-26 no tienen
 *  `participants`, antes de MOO-27 no tienen `assignedTo`, antes de MOO-29 sus días no
 *  tienen `missionOrder`, y antes de MOO-30 el documento no tiene `globalMissionOrder` — se
 *  normalizan al leer. Cada misión antigua se trata como su propia serie de un solo día (el
 *  día en el que ya vivía), que es exactamente como se comportaba antes de MOO-25;
 *  `participants` vacío se comporta como "todos los hijos", igual que antes de MOO-26.
 *  `assignedTo` que falta se rellena con los IDs de todos los hijos actuales (no `[]`) para
 *  reproducir exactamente el "visible para todos" de antes de MOO-27, incluyendo hijos
 *  añadidos después de que se guardara la misión por última vez. `missionOrder`/
 *  `globalMissionOrder` que faltan se rellenan con `[]` (orden alfabético por defecto), igual
 *  que el comportamiento previo a MOO-29/MOO-30. */
function normalize(raw: FamilyData): FamilyData {
  const children = raw.children ?? []
  const days = raw.days.map((day, di) => ({
    ...day,
    missionOrder: day.missionOrder ?? [],
    missions: day.missions.map((mi) => ({
      ...mi,
      seriesId: mi.seriesId ?? mi.id,
      activeDays: mi.activeDays ?? [di],
      participants: mi.participants ?? [],
      assignedTo: mi.assignedTo ?? children.map((c) => c.id),
    })),
  }))
  return { ...raw, days, children, redemptions: raw.redemptions ?? [], globalMissionOrder: raw.globalMissionOrder ?? [] }
}

export function useFamilyData() {
  const [data, setData] = useState<FamilyData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (firebaseEnabled && firestore) {
      const ref = doc(firestore, ...FAMILY_DOC_PATH)
      const unsub = onSnapshot(ref, (snap) => {
        if (!snap.exists()) {
          void setDoc(ref, seedFamilyData())
          return
        }
        setData(normalize(snap.data() as FamilyData))
        setLoading(false)
      })
      return unsub
    }
    return localStore.subscribe((d) => {
      setData(normalize(d))
      setLoading(false)
    })
  }, [])

  const run = useCallback(async <TResult,>(mutator: Mutator<TResult>): Promise<TResult> => {
    if (firebaseEnabled && firestore) {
      const ref = doc(firestore, ...FAMILY_DOC_PATH)
      let result!: TResult
      await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(ref)
        const current = normalize(snap.data() as FamilyData)
        const { patch, result: r } = mutator(current)
        result = r
        if (patch) tx.update(ref, patch)
      })
      return result
    }
    // Siempre lee de localStore, no del estado de React (dataRef): localStore.get() es
    // síncrono y queda al día en cuanto termina un run() anterior, mientras que el estado de
    // React solo se actualiza en el siguiente render — usarlo aquí podía hacer que dos
    // acciones seguidas (p. ej. doble click) operasen sobre datos ya obsoletos y una pisara
    // el efecto de la otra.
    const current = normalize(localStore.get())
    const { patch, result } = mutator(current)
    if (patch) localStore.set(patch)
    return result
  }, [])

  const actions = useMemo(
    () => ({
      setMissionStatus: (dayIdx: number, missionId: string, status: MissionStatus, participantIds?: string[]) =>
        run((d) => ({ patch: logic.setMissionStatus(d, dayIdx, missionId, status, participantIds), result: undefined })),

      addMission: (input: logic.NewMissionInput) =>
        run((d) => ({ patch: logic.addMission(d, input, nextId()), result: undefined })),

      editMission: (missionId: string, input: logic.EditMissionInput) =>
        run((d) => ({ patch: logic.editMission(d, missionId, input), result: undefined })),

      deleteMission: (dayIdx: number, missionId: string) =>
        run((d) => ({ patch: logic.deleteMission(d, dayIdx, missionId), result: undefined })),

      deleteMissionSeries: (seriesId: string) =>
        run((d) => ({ patch: logic.deleteMissionSeries(d, seriesId), result: undefined })),

      duplicateMission: (dayIdx: number, missionId: string) =>
        run((d) => {
          const { days, globalMissionOrder, newMissionId } = logic.duplicateMission(d, dayIdx, missionId, nextId())
          return { patch: newMissionId ? { days, globalMissionOrder } : null, result: newMissionId }
        }),

      reorderMissions: (dayIdx: number, missionIds: string[]) =>
        run((d) => ({ patch: logic.reorderMissions(d, dayIdx, missionIds), result: undefined })),

      resetMissionOrder: (dayIdx: number) =>
        run((d) => ({ patch: logic.resetMissionOrder(d, dayIdx), result: undefined })),

      reorderGlobalMissions: (seriesIds: string[]) =>
        run((d) => ({ patch: logic.reorderGlobalMissions(d, seriesIds), result: undefined })),

      resetGlobalMissionOrder: () => run((d) => ({ patch: logic.resetGlobalMissionOrder(d), result: undefined })),

      setCounter: (value: number) => run((d) => ({ patch: logic.setCounter(d, value), result: undefined })),

      applyPenalty: (amount: number) => run((d) => ({ patch: logic.applyPenalty(d, amount), result: undefined })),

      resetCounter: () => run((d) => ({ patch: logic.resetCounter(d), result: undefined })),

      redeemPoints: (points: number) =>
        run((d) => {
          const r = logic.redeemPoints(d, points)
          return { patch: r.ok ? { acumulado: r.acumulado } : null, result: r }
        }),

      addConcept: (concept: { emoji: string; label: string }) =>
        run((d) => {
          const { concepts, id } = logic.addConcept(d, concept, nextId())
          return { patch: id ? { concepts } : null, result: id }
        }),

      removeConcept: (conceptId: string) =>
        run((d) => ({ patch: logic.removeConcept(d, conceptId), result: undefined })),

      addChild: (name: string) => run((d) => ({ patch: logic.addChild(d, name, nextId()), result: undefined })),

      renameChild: (childId: string, name: string) =>
        run((d) => ({ patch: logic.renameChild(d, childId, name), result: undefined })),

      removeChild: (childId: string) => run((d) => ({ patch: logic.removeChild(d, childId), result: undefined })),

      editChildPoints: (childId: string, value: number) =>
        run((d) => ({ patch: logic.editChildPoints(d, childId, value), result: undefined })),

      penalizeChild: (childId: string, amount: number) =>
        run((d) => ({ patch: logic.penalizeChild(d, childId, amount), result: undefined })),

      redeemChildPoints: (childId: string, points: number, concept: { emoji: string; label: string }) =>
        run((d) => {
          const r = logic.redeemChildPoints(d, childId, points, concept, nextId())
          return { patch: r.ok ? { children: r.children, redemptions: r.redemptions } : null, result: r }
        }),
    }),
    [run],
  )

  return { data, loading, ...actions }
}
