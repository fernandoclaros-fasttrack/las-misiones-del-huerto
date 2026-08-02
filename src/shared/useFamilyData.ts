import { useCallback, useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore'
import { FAMILY_DOC_PATH, firebaseEnabled, firestore } from './firebase'
import { localStore } from './localStore'
import { seedFamilyData } from './constants'
import type { ChangeActor, FamilyData, MissionStatus } from './types'
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
 *  que el comportamiento previo a MOO-29/MOO-30, y lo mismo con `adjustments` para documentos
 *  anteriores a MOO2-51. Conceptos/canjes guardados antes de MOO-41 no
 *  tienen `isPenalty` — se infiere de la etiqueta (contiene "penaliz") en vez de asumir `false`,
 *  para que un concepto de penalización creado a mano antes de esta funcionalidad (y sus canjes
 *  ya registrados) se sigan mostrando en rojo sin que el padre/madre tenga que recrearlo. */
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
  const looksLikePenalty = (label: string) => /penaliz/i.test(label)
  const concepts = (raw.concepts ?? []).map((c) => ({ ...c, isPenalty: c.isPenalty ?? looksLikePenalty(c.label) }))
  const redemptions = (raw.redemptions ?? []).map((r) => ({ ...r, isPenalty: r.isPenalty ?? looksLikePenalty(r.conceptLabel) }))
  return {
    ...raw,
    days,
    children,
    concepts,
    redemptions,
    adjustments: raw.adjustments ?? [],
    globalMissionOrder: raw.globalMissionOrder ?? [],
    changeLog: raw.changeLog ?? [],
  }
}

/** Puntos totales en juego (contador compartido + puntos por hijo). Comparar este valor
 *  antes/después de una acción es cómo `withHistory` decide, de forma genérica y sin tener
 *  que enumerar casos en cada punto de llamada, si esa acción es "significativa" para el
 *  historial (MOO-39): la pregunta abierta del ticket la resolvió como "cualquier acción que
 *  afecte a los puntos acumulados", y ese total es exactamente eso. */
function totalPoints(d: Pick<FamilyData, 'acumulado' | 'children'>): number {
  return d.acumulado + d.children.reduce((sum, c) => sum + c.points, 0)
}

/** Envuelve un `Mutator` para registrar una entrada de `changeLog` (MOO-39) cuando, y solo
 *  cuando, la acción cambia el total de puntos en juego — así `logic.ts` no necesita saber
 *  nada de historial (se queda puro) y no hay que decidir caso a caso en cada acción si
 *  "cuenta" como significativa. `describe` recibe los datos *antes* de la mutación (para poder
 *  leer, por ejemplo, el título de una misión que el patch está a punto de borrar) y puede
 *  devolver `null` para no registrar nada aunque el total cambie (no debería hacer falta con
 *  las acciones actuales, pero deja la puerta abierta sin forzar un registro). */
function withHistory<TResult>(
  actor: ChangeActor,
  mutator: Mutator<TResult>,
  describe: (data: FamilyData, result: TResult) => string | null,
): Mutator<TResult> {
  return (data) => {
    const { patch, result } = mutator(data)
    if (!patch) return { patch, result }
    const after = { acumulado: patch.acumulado ?? data.acumulado, children: patch.children ?? data.children }
    if (totalPoints(after) === totalPoints(data)) return { patch, result }
    const description = describe(data, result)
    if (!description) return { patch, result }
    const id = nextId()
    const entry = { id: `chg${id}`, actor, description, timestamp: id }
    return { patch: { ...patch, changeLog: [...data.changeLog, entry] }, result }
  }
}

export function useFamilyData(actor: ChangeActor) {
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
        run(
          withHistory(
            actor,
            (d) => ({ patch: logic.setMissionStatus(d, dayIdx, missionId, status, participantIds), result: undefined }),
            (d) => {
              const mission = d.days[dayIdx]?.missions.find((mi) => mi.id === missionId)
              if (!mission) return null
              return mission.status === 'completada' ? `Descompletó la misión "${mission.title}"` : `Completó la misión "${mission.title}"`
            },
          ),
        ),

      addMission: (input: logic.NewMissionInput) =>
        run((d) => ({ patch: logic.addMission(d, input, nextId()), result: undefined })),

      editMission: (missionId: string, input: logic.EditMissionInput) =>
        run(
          withHistory(
            actor,
            (d) => ({ patch: logic.editMission(d, missionId, input), result: undefined }),
            (d) => {
              const existing = d.days.flatMap((day) => day.missions).find((mi) => mi.id === missionId)
              return existing ? `Editó los puntos de la misión "${input.title.trim() || existing.title}"` : null
            },
          ),
        ),

      deleteMission: (dayIdx: number, missionId: string) =>
        run(
          withHistory(
            actor,
            (d) => ({ patch: logic.deleteMission(d, dayIdx, missionId), result: undefined }),
            (d) => {
              const mission = d.days[dayIdx]?.missions.find((mi) => mi.id === missionId)
              return mission ? `Borró la misión completada "${mission.title}"` : null
            },
          ),
        ),

      deleteMissionSeries: (seriesId: string) =>
        run(
          withHistory(
            actor,
            (d) => ({ patch: logic.deleteMissionSeries(d, seriesId), result: undefined }),
            (d) => {
              const mission = logic.uniqueMissionSeries(d.days).find((mi) => mi.seriesId === seriesId)
              return mission ? `Borró la misión completada "${mission.title}" (todos los días)` : null
            },
          ),
        ),

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

      resetCounter: () =>
        run(withHistory(actor, (d) => ({ patch: logic.resetCounter(d), result: undefined }), () => 'Reseteó la semana (puntos y misiones a cero)')),

      addConcept: (concept: { emoji: string; label: string; isPenalty?: boolean; isVariableCost: boolean; cost?: number }) =>
        run((d) => {
          const { concepts, id } = logic.addConcept(d, concept, nextId())
          return { patch: id ? { concepts } : null, result: id }
        }),

      removeConcept: (conceptId: string) =>
        run((d) => ({ patch: logic.removeConcept(d, conceptId), result: undefined })),

      editConcept: (conceptId: string, changes: { isVariableCost: boolean; cost: number | null }) =>
        run((d) => ({ patch: logic.editConcept(d, conceptId, changes), result: undefined })),

      addChild: (name: string) => run((d) => ({ patch: logic.addChild(d, name, nextId()), result: undefined })),

      renameChild: (childId: string, name: string) =>
        run((d) => ({ patch: logic.renameChild(d, childId, name), result: undefined })),

      removeChild: (childId: string) =>
        run(
          withHistory(
            actor,
            (d) => ({ patch: logic.removeChild(d, childId), result: undefined }),
            (d) => {
              const child = d.children.find((c) => c.id === childId)
              return child ? `Eliminó a ${child.name} de la familia (perdió ${child.points} pts)` : null
            },
          ),
        ),

      editChildPoints: (childId: string, value: number) =>
        run(
          withHistory(
            actor,
            (d) => ({ patch: logic.editChildPoints(d, childId, value), result: undefined }),
            (d) => {
              const child = d.children.find((c) => c.id === childId)
              return child ? `Editó los puntos de ${child.name} (${child.points} → ${Math.round(value) || 0})` : null
            },
          ),
        ),

      redeemChildPoints: (childId: string, points: number, concept: { emoji: string; label: string; isPenalty?: boolean }) =>
        run(
          withHistory(
            actor,
            (d) => {
              const r = logic.redeemChildPoints(d, childId, points, concept, nextId())
              return { patch: r.ok ? { children: r.children, redemptions: r.redemptions } : null, result: r }
            },
            (d) => {
              const child = d.children.find((c) => c.id === childId)
              if (!child) return null
              const verb = concept.isPenalty ? 'Aplicó una penalización a' : 'Canjeó puntos de'
              return `${verb} ${child.name}: ${concept.emoji} ${concept.label} (${Math.round(points) || 0} pts)`
            },
          ),
        ),

      adjustChildPoints: (childId: string, points: number, reason: string) =>
        run(
          withHistory(
            actor,
            (d) => {
              const r = logic.adjustChildPoints(d, childId, points, reason, nextId())
              return { patch: r.ok ? { children: r.children, adjustments: r.adjustments } : null, result: r }
            },
            (d) => {
              const child = d.children.find((c) => c.id === childId)
              if (!child) return null
              const pts = Math.round(points) || 0
              const verb = pts >= 0 ? 'Dio' : 'Quitó'
              return `${verb} ${Math.abs(pts)} pts a ${child.name}: ${reason.trim()}`
            },
          ),
        ),

      deleteAdjustment: (adjustmentId: string) =>
        run(
          withHistory(
            actor,
            (d) => ({ patch: logic.deleteAdjustment(d, adjustmentId), result: undefined }),
            (d) => {
              const adjustment = d.adjustments.find((a) => a.id === adjustmentId)
              if (!adjustment) return null
              const child = d.children.find((c) => c.id === adjustment.childId)
              return `Eliminó un ajuste de puntos${child ? ` de ${child.name}` : ''}: ${adjustment.reason}`
            },
          ),
        ),

      deleteRedemption: (redemptionId: string) =>
        run(
          withHistory(
            actor,
            (d) => ({ patch: logic.deleteRedemption(d, redemptionId), result: undefined }),
            (d) => {
              const redemption = d.redemptions.find((r) => r.id === redemptionId)
              if (!redemption) return null
              const child = d.children.find((c) => c.id === redemption.childId)
              return `Eliminó un canje${child ? ` de ${child.name}` : ''}: ${redemption.conceptEmoji} ${redemption.conceptLabel}`
            },
          ),
        ),
    }),
    [run, actor],
  )

  return { data, loading, ...actions }
}
