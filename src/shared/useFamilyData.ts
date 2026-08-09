import { useCallback, useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot, runTransaction, type DocumentReference } from 'firebase/firestore'
import { FAMILY_DOC_PATH, firebaseEnabled, firestore } from './firebase'
import { localStore } from './localStore'
import { seedFamilyData } from './constants'
import type { ChangeActor, ChangeLogEntry, Child, ChildPointsDelta, FamilyData, MissionStatus } from './types'
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
 *  anteriores a MOO2-51. Los canjes guardados antes de MOO-41 no tienen `isPenalty` — se
 *  infiere de la etiqueta (contiene "penaliz") en vez de asumir `false`, para que las
 *  penalizaciones ya registradas se sigan mostrando en rojo. Esto es solo para el histórico:
 *  desde MOO2-52 las penalizaciones son su propia acción y ningún canje nuevo se marca así. */
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
  const redemptions = (raw.redemptions ?? []).map((r) => ({ ...r, isPenalty: r.isPenalty ?? looksLikePenalty(r.conceptLabel) }))
  return {
    ...raw,
    days,
    children,
    concepts: raw.concepts ?? [],
    redemptions,
    adjustments: raw.adjustments ?? [],
    globalMissionOrder: raw.globalMissionOrder ?? [],
    // Las entradas anteriores a MOO2-53 no tienen desglose por hijo/a y no se puede
    // reconstruir: quedan visibles en el historial de padres pero fuera del de los niños.
    changeLog: (raw.changeLog ?? []).map((e) => ({ ...e, deltas: e.deltas ?? [] })),
    // Documentos anteriores a MOO2-57 no tienen lista rápida todavía.
    missionTemplates: raw.missionTemplates ?? [],
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
  reasonFor?: (data: FamilyData, result: TResult) => string | undefined,
): Mutator<TResult> {
  return (data) => {
    const { patch, result } = mutator(data)
    if (!patch) return { patch, result }
    const after = { acumulado: patch.acumulado ?? data.acumulado, children: patch.children ?? data.children }
    if (totalPoints(after) === totalPoints(data)) return { patch, result }
    const description = describe(data, result)
    if (!description) return { patch, result }
    const id = nextId()
    const reason = reasonFor?.(data, result)?.trim() || undefined
    const entry: ChangeLogEntry = {
      id: `chg${id}`,
      actor,
      description,
      deltas: childDeltas(data.children, after.children),
      ...(reason ? { reason } : {}),
      timestamp: id,
    }
    return { patch: { ...patch, changeLog: [...data.changeLog, entry] }, result }
  }
}

/** Desglose por hijo/a de una acción (MOO2-53), comparando sus puntos antes y después. Se hace
 *  aquí y no en cada acción para que cualquier cosa que mueva puntos quede registrada sin tener
 *  que acordarse — igual que `withHistory` ya decide genéricamente si una acción es
 *  significativa. Un hijo/a que desaparece (`removeChild`) cuenta como perder todos sus puntos:
 *  es lo que pasó con el total, y su historial deja de existir con él de todas formas. */
function childDeltas(before: Child[], after: Child[]): ChildPointsDelta[] {
  const afterPoints = new Map(after.map((c) => [c.id, c.points]))
  const deltas: ChildPointsDelta[] = []
  for (const child of before) {
    const points = (afterPoints.get(child.id) ?? 0) - child.points
    if (points !== 0) deltas.push({ childId: child.id, points })
  }
  // Un hijo/a recién creado no aparece en `before`; hoy siempre nace con 0 puntos, pero si eso
  // cambiara su alta contaría como una ganancia y debe quedar registrada igual.
  const beforeIds = new Set(before.map((c) => c.id))
  for (const child of after) {
    if (!beforeIds.has(child.id) && child.points !== 0) deltas.push({ childId: child.id, points: child.points })
  }
  return deltas
}

/** Alta del documento la primera vez que se usa la app contra un Firestore vacío (MOO2-99).
 *  Va en una transacción y no en un `setDoc` suelto por una razón concreta: la transacción
 *  siempre lee del servidor, así que el `tx.set` solo llega a ejecutarse si el documento
 *  realmente no existe. Un `setDoc` incondicional, en cambio, sustituye lo que hubiera —
 *  que es exactamente cómo se perdieron los datos de la familia el 7/8/2026. */
async function seedIfMissing(ref: DocumentReference): Promise<void> {
  if (!firestore) return
  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(ref)
    if (snap.exists()) return
    tx.set(ref, seedFamilyData())
  })
}

/** `enabled` existe para no abrir la escucha antes de que haya sesión (MOO2-99): las reglas de
 *  Firestore exigen `request.auth != null`, y suscribirse sin usuario solo produce errores de
 *  permisos que además llegaban silenciados. Las pantallas pasan aquí su `isAuthed`. */
export function useFamilyData(actor: ChangeActor, enabled = true) {
  const [data, setData] = useState<FamilyData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) return
    if (firebaseEnabled && firestore) {
      const ref = doc(firestore, ...FAMILY_DOC_PATH)
      // Una sola tentativa de alta por montaje: si la transacción falla (sin red, permisos),
      // el listener seguirá emitiendo y no tiene sentido reintentarla en bucle.
      let seedAttempted = false
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            // Firestore emite primero desde su caché local, y un documento que aún no está
            // cacheado llega como "no existe" aunque esté vivo en el servidor. Tratar eso como
            // un Firestore vacío es lo que borró los datos de la familia: mientras el snapshot
            // venga de caché no se puede concluir nada, así que se espera al del servidor.
            if (snap.metadata.fromCache) return
            if (seedAttempted) return
            seedAttempted = true
            void seedIfMissing(ref).catch((err) => console.error('No se pudo crear el documento inicial:', err))
            return
          }
          setData(normalize(snap.data() as FamilyData))
          setLoading(false)
        },
        (err) => {
          // Sin este manejador, un fallo de permisos se tragaba entero. La pantalla se queda
          // igualmente en "Cargando misiones…" (se renderiza con `loading || !data`, y sin datos
          // no hay nada que enseñar), pero al menos el motivo queda en consola. Convertir esto en
          // un estado de error visible es otro ticket.
          console.error('Error leyendo los datos de la familia:', err)
        },
      )
      return unsub
    }
    return localStore.subscribe((d) => {
      setData(normalize(d))
      setLoading(false)
    })
  }, [enabled])

  const run = useCallback(async <TResult,>(mutator: Mutator<TResult>): Promise<TResult> => {
    if (firebaseEnabled && firestore) {
      const ref = doc(firestore, ...FAMILY_DOC_PATH)
      let result!: TResult
      await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(ref)
        // No debería ocurrir (para llegar aquí hay que estar viendo datos en pantalla), pero si
        // ocurre hay que abortar en vez de seguir: `normalize(undefined)` reventaba con un
        // TypeError críptico, y escribir aquí un documento nuevo sería reintroducir el borrado
        // que arregla MOO2-99.
        if (!snap.exists()) throw new Error('El documento de la familia no existe: no se aplica ningún cambio')
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
            (d) => d.days[dayIdx]?.missions.find((mi) => mi.id === missionId)?.title,
          ),
        ),

      // `fromTemplate` evita duplicar la entrada en la lista rápida (MOO2-57) cuando la misión
      // se crea eligiéndola de esa misma lista en vez de escribirla a mano.
      addMission: (input: logic.NewMissionInput, opts?: { fromTemplate?: boolean }) =>
        run((d) => {
          const { days } = logic.addMission(d, input, nextId())
          const missionTemplates = opts?.fromTemplate
            ? d.missionTemplates
            : logic.upsertMissionTemplate(d.missionTemplates, { emoji: input.emoji, title: input.title, points: input.points }, nextId())
          return { patch: { days, missionTemplates }, result: undefined }
        }),

      // Crea una misión por cada plantilla seleccionada (MOO2-58), todas con los mismos días y
      // asignación (el contexto de "Añadir misión" desde el que se abrió la lista rápida). Se
      // encadenan sobre `days` en vez de partir de `d.days` en cada vuelta para que ninguna
      // creación pise a la anterior.
      createMissionsFromTemplates: (templateIds: string[], dayIndices: number[], assignedTo: string[]) =>
        run((d) => {
          let days = d.days
          for (const templateId of templateIds) {
            const template = d.missionTemplates.find((t) => t.id === templateId)
            if (!template) continue
            const result = logic.addMission(
              { ...d, days },
              { emoji: template.emoji, title: template.title, points: template.points, dayIndices, assignedTo },
              nextId(),
            )
            days = result.days
          }
          return { patch: { days }, result: undefined }
        }),

      editMissionTemplate: (templateId: string, changes: { title: string; points: number }) =>
        run((d) => ({ patch: { missionTemplates: logic.editMissionTemplate(d.missionTemplates, templateId, changes) }, result: undefined })),

      deleteMissionTemplate: (templateId: string) =>
        run((d) => ({ patch: { missionTemplates: logic.deleteMissionTemplate(d.missionTemplates, templateId) }, result: undefined })),

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
        run(
          withHistory(
            actor,
            (d) => ({ patch: logic.resetCounter(d), result: undefined }),
            () => 'Reseteó la semana (puntos y misiones a cero)',
            () => 'Semana reseteada',
          ),
        ),

      addConcept: (concept: { emoji: string; label: string; isVariableCost: boolean; cost?: number }) =>
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

      redeemChildPoints: (childId: string, points: number, concept: { emoji: string; label: string }) =>
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
              return `Canjeó puntos de ${child.name}: ${concept.emoji} ${concept.label} (${Math.round(points) || 0} pts)`
            },
            () => `${concept.emoji} ${concept.label}`,
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
            () => reason,
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
