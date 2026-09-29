import { useEffect, useRef, useState } from 'react'
import { useFamilyData } from '../shared/useFamilyData'
import { useAuth } from '../shared/useAuth'
import { LoginScreen } from '../shared/components/LoginScreen'
import { ACCENT, todayIndex, todayISODate, nextDateForWeekday, weekdayOfISODate } from '../shared/constants'
import { DayTabs } from '../shared/components/DayTabs'
import { Toast } from '../shared/components/Toast'
import { ConceptsCard } from './components/ConceptsCard'
import { ChildrenCard } from './components/ChildrenCard'
import { MissionCard } from './components/MissionCard'
import { MissionsList } from './components/MissionsList'
import { NewMissionForm } from './components/NewMissionForm'
import { MissionTemplatesQuickPick } from './components/MissionTemplatesQuickPick'
import { SettingsMenu } from './components/SettingsMenu'
import { ChangeHistoryView } from './components/ChangeHistoryView'
import { RestoreBackupView } from './components/RestoreBackupView'
import { NoBackupConfirm } from './components/NoBackupConfirm'
import { GlobalMissionsView } from './components/GlobalMissionsView'
import { downloadBackup } from './backup'
import { sortedMissions, sortedMissionSeries, byTitle, isMissionCurrentForParents, oneOffDateLabel } from '../shared/logic'
import { useDayFollowingToday, useToday } from '../shared/useToday'
import type { Mission } from '../shared/types'

interface Draft {
  emoji: string
  title: string
  points: number | string
  days: number[]
  /** IDs de los hijos asignados (MOO-27); irrelevante mientras no haya hijos configurados. */
  assignedTo: string[]
  /** Si el borrador es one-off (MOO2-56/61); cuando es `true`, `oneOffDate` manda sobre `days`. */
  isOneOff: boolean
  oneOffDate: string
}

const AUTH_EMAIL = import.meta.env.VITE_AUTH_EMAIL as string

export default function App() {
  const { ready, isAuthed, login, logout, resetPassword } = useAuth()
  // `isAuthed` gatea la escucha de Firestore (MOO2-99): los hooks corren siempre, también en los
  // renders en los que más abajo se devuelve la pantalla de login, así que sin esto la
  // suscripción se abría sin sesión.
  const {
    data,
    loading,
    addMission,
    editMission,
    deleteMission,
    deleteMissionSeries,
    duplicateMission,
    reorderMissions,
    resetMissionOrder,
    reorderGlobalMissions,
    resetGlobalMissionOrder,
    resetCounter,
    addConcept,
    removeConcept,
    editConcept,
    addChild,
    renameChild,
    removeChild,
    editChildPoints,
    adjustChildPoints,
    redeemChildPoints,
    deleteRedemption,
    deleteAdjustment,
    createMissionsFromTemplates,
    editMissionTemplate,
    deleteMissionTemplate,
    restoreBackup,
    backupBeforeAction,
  } = useFamilyData('padre', isAuthed)

  const [showHistory, setShowHistory] = useState(false)
  /** Pantalla de restaurar copia (MOO2-100), al mismo nivel que el historial: sustituye el área
   *  de misiones en vez de abrirse encima, porque es un flujo de varios pasos (elegir fichero,
   *  revisarlo, confirmar) y no una confirmación de una línea como la del reseteo. */
  const [showRestore, setShowRestore] = useState(false)
  /** Vista global de misiones (MOO-30): activada desde la pestaña extra "Todo" en `DayTabs`,
   *  junto a los días de la semana. Alterna el área de misiones entre la vista por día (con
   *  edición, arrastre, etc.) y una vista de solo lectura con todas las series de misión
   *  configuradas, independiente del día seleccionado. Es la pestaña seleccionada por defecto
   *  al abrir el panel de padres. */
  const [globalView, setGlobalView] = useState(true)

  const [showConceptForm, setShowConceptForm] = useState(false)
  const [newConceptLabel, setNewConceptLabel] = useState('')
  const [newConceptEmoji, setNewConceptEmoji] = useState('🎯')
  const [newConceptIsVariableCost, setNewConceptIsVariableCost] = useState(false)
  const [newConceptCost, setNewConceptCost] = useState('')

  const [editingId, setEditingId] = useState<null | 'new' | string>(null)
  const [draft, setDraft] = useState<Draft>({ emoji: '🌱', title: '', points: 10, days: [], assignedTo: [], isOneOff: false, oneOffDate: todayISODate() })
  /** Misiones de la lista rápida (MOO2-58) marcadas para crear de golpe; se vacía al abrir o
   *  cerrar el formulario de alta. */
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])

  /** Orden optimista tras arrastrar/resetear (MOO-29): la transacción de Firestore tarda un
   *  poco en reflejarse en `data`, así que mientras se resuelve mostramos el orden elegido
   *  localmente para no dar sensación de que el arrastre "no ha hecho nada". Se descarta en
   *  cuanto la operación se resuelve, momento en el que `data` ya trae el mismo orden. */
  const [pendingOrder, setPendingOrder] = useState<{ dayIdx: number; ids: string[] } | null>(null)
  /** Igual que `pendingOrder` pero para el orden manual de la vista global "Todo" (MOO-30):
   *  guarda `seriesId`, no `id` de misión. */
  const [pendingGlobalOrder, setPendingGlobalOrder] = useState<string[] | null>(null)

  /** Qué día es hoy, para el filtro de las misiones puntuales (MOO2-167) y para el día que se
   *  enseña seleccionado (MOO2-169). No puede calcularse en cada render y quedarse ahí: esta app
   *  vive en la tablet de la cocina, así que el panel cruza la medianoche abierto y sin
   *  repintarse. Con la fecha congelada, la lista seguiría enseñando una puntual de ayer y
   *  `saveMission`, que sí mira el día real, la rechazaría con un "esa fecha ya ha pasado" sobre
   *  una tarjeta que se ve perfectamente al día. Todo lo que depende del día cuelga de aquí — el
   *  filtro, la pestaña seleccionada y el punto de "hoy" — así que nada puede discrepar. */
  const [today, syncToday] = useToday()
  const [selected, setSelected] = useDayFollowingToday(weekdayOfISODate(today))

  /** Y si el día cambia con el formulario de alta abierto, la fecha que ese formulario traía
   *  puesta sola (hoy, al abrirlo) se queda en el pasado sin que nadie la haya elegido, y al
   *  guardar saltaría un "esa fecha ya ha pasado" sobre algo que el usuario no tecleó. Se
   *  adelanta al nuevo día. Lo que decide no es si es un alta, sino **de quién es esa fecha**:
   *
   *  - Si es la que puso el formulario (el "hoy" de antes), se adelanta. Pasa en el alta y
   *    también al convertir una misión recurrente en puntual, que rellena la fecha igual.
   *  - Si es la fecha que la misión ya tenía guardada, no se toca jamás. Reescribirla haría que
   *    al guardar la misión se mudara sola de día de la semana, y si estaba completada
   *    `editMission` borra la copia del día viejo y **descuenta los puntos ya dados a los
   *    niños**. Dejarse una ficha abierta por la noche no puede despagar una tarea hecha.
   *  - Y sobre una misión **ya completada** no se adelanta nada, venga la fecha de donde venga:
   *    ahí el adelanto es justo lo que la mudaría de día. Se prefiere el aviso de `saveMission`
   *    y que la fecha nueva la elija una persona.
   *
   *  Una fecha pasada tecleada a mano no la alcanza esto, salvo que sea exactamente el día de
   *  ayer, que es indistinguible de la que puso el formulario; cualquier otra sigue su camino
   *  hasta el aviso de `saveMission`. */
  const ayerRef = useRef(today)
  useEffect(() => {
    const previo = ayerRef.current
    ayerRef.current = today
    if (previo === today) return
    const suya = editingId && editingId !== 'new'
      ? data?.days.flatMap((d) => d.missions).find((mi) => mi.id === editingId)
      : undefined
    const intocable = suya?.oneOffDate === previo || suya?.status === 'completada'
    setDraft((d) => (d.oneOffDate === previo && !intocable ? { ...d, oneOffDate: today } : d))
  }, [today, editingId, data])

  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
  }, [])
  function showToast(message: string) {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200)
  }

  /** Pregunta pendiente de "¿seguir sin copia?" (MOO2-103). Guarda el `resolve` de la promesa que
   *  espera la respuesta, para que la acción protegida pueda simplemente `await` la decisión. */
  const [noBackup, setNoBackup] = useState<{ action: string; resolve: (go: boolean) => void } | null>(null)

  /** Ejecuta una acción destructiva con su copia previa en la nube (MOO2-103): resetear la semana,
   *  eliminar a un hijo/a y restaurar otra copia. Si la copia no se puede guardar, la acción no se
   *  bloquea sin más ni sigue a ciegas: se avisa y decide el padre/madre. Devuelve si la acción
   *  llegó a ejecutarse, para que quien llama sepa si se abandonó. */
  async function withSafetyBackup(kind: 'reset' | 'removeChild' | 'restore', action: string, description: string, run: () => Promise<unknown>): Promise<boolean> {
    const saved = await backupBeforeAction(kind, description)
    if (!saved) {
      const go = await new Promise<boolean>((resolve) => setNoBackup({ action, resolve }))
      setNoBackup(null)
      if (!go) return false
    }
    await run()
    return true
  }

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', background: '#E9E0CC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Nunito', system-ui, sans-serif", color: '#8A7E6B' }}>
        Cargando…
      </div>
    )
  }

  if (!isAuthed) {
    return (
      <LoginScreen accent={ACCENT} background="#E9E0CC" email={AUTH_EMAIL} onLogin={login} onForgotPassword={resetPassword} />
    )
  }

  if (loading || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#E9E0CC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Nunito', system-ui, sans-serif", color: '#8A7E6B' }}>
        Cargando panel…
      </div>
    )
  }

  const day = data.days[selected]
  // Las one-off pasadas dejan de listarse aquí (MOO2-167): siguen guardadas en su `Day`, pero ya
  // no son accionables y mezcladas con las recurrentes impedían ver de un vistazo qué se repite.
  // Excepción: la tarjeta que se está editando no se filtra nunca. Si la puntual abierta dejara
  // de pasar el filtro al cambiar el día, el formulario se desmontaría con lo tecleado dentro y
  // sin decir nada. Salva la edición en curso y deja reprogramar la misión a una fecha futura;
  // al cerrar el formulario vuelve a esconderse, como cualquier otra puntual pasada.
  const seListaEnPadres = (m: Mission) => isMissionCurrentForParents(m, today) || m.id === editingId
  const rawMissions = (day ? sortedMissions(day) : []).filter(seListaEnPadres)
  const missionsById = new Map(rawMissions.map((m) => [m.id, m]))
  const missions =
    pendingOrder && pendingOrder.dayIdx === selected
      ? pendingOrder.ids.map((id) => missionsById.get(id)).filter((m): m is Mission => !!m)
      : rawMissions
  const hasCustomOrder = (day?.missionOrder.length ?? 0) > 0

  const rawGlobalMissions = sortedMissionSeries(data).filter(seListaEnPadres)
  const globalMissionsBySeriesId = new Map(rawGlobalMissions.map((m) => [m.seriesId, m]))
  const globalMissions = pendingGlobalOrder
    ? pendingGlobalOrder.map((id) => globalMissionsBySeriesId.get(id)).filter((m): m is Mission => !!m)
    : rawGlobalMissions
  const hasCustomGlobalOrder = data.globalMissionOrder.length > 0

  function selectDay(i: number) {
    setGlobalView(false)
    setSelected(i)
    setEditingId(null)
  }
  function selectGlobalView() {
    setGlobalView(true)
    setEditingId(null)
  }

  function toggleConceptForm() {
    setShowConceptForm((v) => !v)
    setNewConceptLabel('')
    setNewConceptEmoji('🎯')
    setNewConceptIsVariableCost(false)
    setNewConceptCost('')
  }
  async function handleAddConcept() {
    if (!newConceptLabel.trim()) return
    const cost = parseInt(newConceptCost, 10)
    const id = await addConcept({
      emoji: newConceptEmoji,
      label: newConceptLabel,
      isVariableCost: newConceptIsVariableCost,
      cost: Number.isFinite(cost) && cost > 0 ? cost : undefined,
    })
    if (id) setShowConceptForm(false)
  }

  function openAdd() {
    setEditingId('new')
    setSelectedTemplateIds([])
    // Desde la vista por día se preselecciona el día que se está viendo (`selected`); desde
    // "Todo" ese valor no tiene relación con nada que el usuario haya elegido ahí, así que se
    // preselecciona el día de hoy en su lugar — sigue siendo un punto de partida editable.
    const dayIdx = globalView ? todayIndex() : selected
    setDraft({ emoji: '🌱', title: '', points: 10, days: [dayIdx], assignedTo: data!.children.map((c) => c.id), isOneOff: false, oneOffDate: nextDateForWeekday(dayIdx) })
  }
  function openEditMission(mission: Mission) {
    setEditingId(mission.id)
    const dayIdx = mission.activeDays[0] ?? todayIndex()
    setDraft({
      emoji: mission.emoji,
      title: mission.title,
      points: mission.points,
      days: mission.activeDays,
      assignedTo: mission.assignedTo.length ? mission.assignedTo : data!.children.map((c) => c.id),
      isOneOff: mission.oneOffDate !== undefined,
      oneOffDate: mission.oneOffDate ?? nextDateForWeekday(dayIdx),
    })
  }
  function cancelEdit() {
    setEditingId(null)
    setSelectedTemplateIds([])
  }
  function toggleDraftDay(i: number) {
    setDraft((d) => (d.days.includes(i) ? { ...d, days: d.days.filter((x) => x !== i) } : { ...d, days: [...d.days, i] }))
  }
  function toggleDraftChild(childId: string) {
    setDraft((d) => (d.assignedTo.includes(childId) ? { ...d, assignedTo: d.assignedTo.filter((x) => x !== childId) } : { ...d, assignedTo: [...d.assignedTo, childId] }))
  }
  function toggleDraftOneOff() {
    setDraft((d) => ({ ...d, isOneOff: !d.isOneOff }))
  }
  function setDraftOneOffDate(date: string) {
    setDraft((d) => ({ ...d, oneOffDate: date }))
  }
  /** Resuelve la fecha con la que se va a guardar una misión puntual, o `null` si no se puede
   *  guardar (y en ese caso ya ha avisado). Lo usan el alta/edición del formulario y la creación
   *  desde la lista rápida (MOO2-168), que tienen exactamente las mismas trampas:
   *
   *  - Se mide contra el día real y no contra el `today` pintado: el panel puede llevar abierto
   *    desde ayer y el minuto del reloj que lo refresca puede no haber saltado todavía. De paso
   *    pone la lista al día, para que nada de lo que salga después contradiga lo que se ve.
   *  - Una fecha puesta por el formulario que se ha quedado en ayer se adelanta: entre la
   *    medianoche y el minuto siguiente hay un hueco, y guardar dentro de él devolvía un aviso
   *    sobre una fecha que nadie eligió. Nunca sobre una misión ya completada: adelantarla la
   *    mudaría de día de la semana, y a una completada eso le borra la copia y **le quita a los
   *    niños los puntos ya dados**. Ahí es mejor el aviso, y que la fecha la elija una persona.
   *  - La fecha que la misión ya tenía guardada (`suFechaDeAntes`) se deja volver a guardar tal
   *    cual aunque ya haya pasado: rechazarla obligaría a reprogramarla solo para corregirle el
   *    título, con el descuento de puntos que eso arrastra. Lo que sí se rechaza es una fecha
   *    pasada elegida a mano, que dejaría una misión que no se puede ni ver ni corregir. El `min`
   *    de los selectores guía el gesto; esto cierra lo que se teclea, que el `min` no bloquea. */
  function resolverFechaPuntual(suFechaDeAntes: string | undefined, yaCompletada: boolean): string | null {
    // El input de fecha nativo se puede dejar vacío (borrando todos los dígitos); sin esta
    // comprobación, weekdayOfISODate('') da NaN y la misión no encaja en ningún día real — al
    // editar, eso borraría la única copia existente sin crear una de repuesto. Avisa en vez de
    // no hacer nada porque el botón "Crear" de la lista rápida está *encima* del campo de fecha:
    // desde ahí, un botón que no responde no tiene ninguna explicación a la vista.
    if (!draft.oneOffDate) {
      showToast('Elige el día de la misión')
      return null
    }
    const realToday = todayISODate()
    if (realToday !== today) syncToday()
    const fecha = draft.oneOffDate === today && draft.oneOffDate !== suFechaDeAntes && !yaCompletada ? realToday : draft.oneOffDate
    if (fecha < realToday && fecha !== suFechaDeAntes) {
      showToast('Esa fecha ya ha pasado: elige hoy o un día futuro')
      return null
    }
    return fecha
  }
  /** Día de la semana y fecha de una puntual, p. ej. "sábado 20 sep", para los avisos. */
  function etiquetaDeFecha(iso: string): string {
    return `${data!.days[weekdayOfISODate(iso)]?.label.toLowerCase() ?? ''} ${oneOffDateLabel(iso)}`.trim()
  }
  /** Una misión puntual se guarda en el `Day` de su fecha, que no tiene por qué ser el día que el
   *  padre está viendo: sin esto el formulario se cerraba sobre una lista idéntica y parecía que
   *  no había pasado nada (MOO2-169), así que se creaba otra vez. Se le lleva al día donde ha
   *  caído y se le dice cuál es. En la vista "Todo" no hay a dónde llevarle — la misión ya sale en
   *  esa lista — así que solo se avisa. */
  function avisarDelDiaPuntual(dayIdx: number, mensaje: string) {
    if (!globalView && dayIdx === selected) return
    if (!globalView) setSelected(dayIdx)
    showToast(mensaje)
  }
  async function saveMission() {
    if (!draft.title.trim()) return
    const points = Number(draft.points) || 0
    if (draft.isOneOff) {
      // La misión que se está editando, si la hay. Su fecha guardada es lo que distingue "esta
      // fecha la eligió el usuario" de "la rellenó el formulario".
      const misionEditada = editingId && editingId !== 'new'
        ? data!.days.flatMap((d) => d.missions).find((mi) => mi.id === editingId)
        : undefined
      const fecha = resolverFechaPuntual(misionEditada?.oneOffDate, misionEditada?.status === 'completada')
      if (fecha === null) return
      const dayIdx = weekdayOfISODate(fecha)
      if (editingId === 'new') {
        await addMission({ emoji: draft.emoji, title: draft.title, points, dayIndices: [dayIdx], assignedTo: draft.assignedTo, oneOffDate: fecha })
        setEditingId(null)
        avisarDelDiaPuntual(dayIdx, `Creada para el ${etiquetaDeFecha(fecha)}`)
        return
      }
      if (editingId) {
        // Editar también puede mudar la misión de día: cambiándole la fecha a otro día de la
        // semana, o convirtiendo una recurrente en puntual (MOO2-61), que la deja viviendo solo
        // en el día de su fecha. Ahí la tarjeta desaparece de la lista que el padre tiene
        // delante, así que decirle dónde ha ido importa aún más que al crearla. La pregunta es
        // si la misión sigue viviendo exactamente donde vivía, y por eso no vale con
        // `activeDays.includes(dayIdx)`: una recurrente de lunes a domingo ya "incluye" el
        // sábado, y convertirla en puntual del sábado se quedaba sin aviso justo ahí.
        const vivíaSoloAhí = misionEditada?.activeDays.length === 1 && misionEditada.activeDays[0] === dayIdx
        const seMuda = !!misionEditada && !vivíaSoloAhí
        await editMission(editingId, { emoji: draft.emoji, title: draft.title, points, activeDays: [dayIdx], assignedTo: draft.assignedTo, oneOffDate: fecha })
        setEditingId(null)
        if (seMuda) avisarDelDiaPuntual(dayIdx, `Movida al ${etiquetaDeFecha(fecha)}`)
        return
      }
      setEditingId(null)
      return
    }
    // Si se desmarcan todos los días, hay que decidir un día de respaldo: en la vista por día
    // se usa el día que se está viendo (`selected`), pero ese mismo valor no tiene relación con
    // lo que el usuario ve en la vista global "Todo" (puede ser el de hoy, o el último día
    // visitado) — ahí el respaldo correcto es no tocar los días que ya tenía la misión (o, si es
    // una misión nueva y por tanto no tiene días previos, el día de hoy).
    const fallbackDays = globalView
      ? (data!.days.flatMap((d) => d.missions).find((mi) => mi.id === editingId)?.activeDays ?? [todayIndex()])
      : [selected]
    const activeDays = draft.days.length ? draft.days : fallbackDays
    if (editingId === 'new') {
      await addMission({ emoji: draft.emoji, title: draft.title, points, dayIndices: activeDays, assignedTo: draft.assignedTo })
    } else if (editingId) {
      await editMission(editingId, { emoji: draft.emoji, title: draft.title, points, activeDays, assignedTo: draft.assignedTo, oneOffDate: undefined })
    }
    setEditingId(null)
  }
  function toggleTemplateSelection(id: string) {
    setSelectedTemplateIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }
  /** Crea de golpe las misiones marcadas en la lista rápida (MOO2-58). Que sean recurrentes o
   *  puntuales, y con qué fecha, sale del formulario de "Nueva misión" que hay justo debajo de la
   *  lista (MOO2-168): es el mismo borrador, así que no hay dos controles de recurrencia que
   *  puedan decir cosas distintas, y el botón "Crear" enseña la fecha elegida para que se vea sin
   *  bajar la vista qué va a pasar. Varias seleccionadas se crean todas en la misma fecha —
   *  decisión del ticket: una puntual se crea para algo que hace falta ya, y una fecha por misión
   *  sería coste sin caso detrás. */
  async function handleCreateFromTemplates() {
    if (!selectedTemplateIds.length) return
    const count = selectedTemplateIds.length
    const kids = data!.children.map((c) => c.id)
    const hechas = `${count} ${count === 1 ? 'misión creada' : 'misiones creadas'}`
    if (draft.isOneOff) {
      // Aquí siempre son misiones nuevas: no hay fecha guardada que respetar ni misión completada
      // que proteger, así que las dos excepciones de `resolverFechaPuntual` no llegan a aplicar.
      const fecha = resolverFechaPuntual(undefined, false)
      if (fecha === null) return
      const dayIdx = weekdayOfISODate(fecha)
      await createMissionsFromTemplates(selectedTemplateIds, [dayIdx], kids, fecha)
      setSelectedTemplateIds([])
      setEditingId(null)
      if (!globalView && dayIdx !== selected) setSelected(dayIdx)
      showToast(`${hechas} para el ${etiquetaDeFecha(fecha)}`)
      return
    }
    const dayIdx = globalView ? todayIndex() : selected
    await createMissionsFromTemplates(selectedTemplateIds, [dayIdx], kids)
    setSelectedTemplateIds([])
    setEditingId(null)
    showToast(hechas)
  }
  async function handleDeleteMission(mission: Mission) {
    await deleteMission(selected, mission.id)
    if (editingId === mission.id) setEditingId(null)
  }
  async function handleDuplicateMission(mission: Mission) {
    const newId = await duplicateMission(selected, mission.id)
    if (!newId) return
    setEditingId(newId)
    setDraft({
      emoji: mission.emoji,
      title: `${mission.title} (copia)`,
      points: mission.points,
      days: mission.activeDays,
      assignedTo: mission.assignedTo,
      isOneOff: mission.oneOffDate !== undefined,
      oneOffDate: mission.oneOffDate ?? nextDateForWeekday(mission.activeDays[0] ?? todayIndex()),
    })
    showToast(`Misión "${mission.title}" duplicada`)
  }
  async function handleGlobalDeleteMission(mission: Mission) {
    await deleteMissionSeries(mission.seriesId)
    if (editingId === mission.id) setEditingId(null)
  }
  async function handleGlobalDuplicateMission(mission: Mission) {
    // Cualquier copia de la serie sirve como referencia para duplicateMission (usa
    // internamente los días activos de la serie, no solo los del día pasado); el primer día
    // activo es donde vive exactamente el `id` de esta misión representante — ver
    // `uniqueMissionSeries()` en logic.ts.
    const dayIdx = Math.min(...mission.activeDays)
    const newId = await duplicateMission(dayIdx, mission.id)
    if (!newId) return
    setEditingId(newId)
    setDraft({
      emoji: mission.emoji,
      title: `${mission.title} (copia)`,
      points: mission.points,
      days: mission.activeDays,
      assignedTo: mission.assignedTo,
      isOneOff: mission.oneOffDate !== undefined,
      oneOffDate: mission.oneOffDate ?? nextDateForWeekday(mission.activeDays[0] ?? todayIndex()),
    })
    showToast(`Misión "${mission.title}" duplicada`)
  }
  async function handleReorder(missionIds: string[]) {
    // Compara por identidad de referencia (no por dayIdx) al limpiar, igual que
    // handleGlobalReorder: si un segundo arrastre empieza en el mismo día antes de que este
    // termine, la resolución de este no debe borrar el estado optimista del segundo.
    const pending = { dayIdx: selected, ids: missionIds }
    setPendingOrder(pending)
    await reorderMissions(selected, missionIds)
    setPendingOrder((p) => (p === pending ? null : p))
  }
  async function handleResetOrder() {
    const alphaIds = [...missions].sort(byTitle).map((m) => m.id)
    const pending = { dayIdx: selected, ids: alphaIds }
    setPendingOrder(pending)
    await resetMissionOrder(selected)
    setPendingOrder((p) => (p === pending ? null : p))
  }
  async function handleGlobalReorder(missionIds: string[]) {
    const idToSeriesId = new Map(globalMissions.map((m) => [m.id, m.seriesId]))
    const seriesIds = missionIds.map((id) => idToSeriesId.get(id)).filter((id): id is string => !!id)
    setPendingGlobalOrder(seriesIds)
    await reorderGlobalMissions(seriesIds)
    setPendingGlobalOrder((p) => (p === seriesIds ? null : p))
  }
  async function handleResetGlobalOrder() {
    const alphaIds = [...globalMissions].sort(byTitle).map((m) => m.seriesId)
    setPendingGlobalOrder(alphaIds)
    await resetGlobalMissionOrder()
    setPendingGlobalOrder((p) => (p === alphaIds ? null : p))
  }

  return (
    <div style={{ minHeight: '100vh', background: '#E9E0CC', fontFamily: "'Nunito', system-ui, sans-serif", color: '#3A3228', display: 'flex', justifyContent: 'center' }}>
      <Toast message={toast} />
      {noBackup && <NoBackupConfirm action={noBackup.action} onConfirm={() => noBackup.resolve(true)} onCancel={() => noBackup.resolve(false)} />}
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <header style={{ background: ACCENT, color: '#F6F1E2', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Bitter', serif", fontWeight: 700, fontSize: 16 }}>🌿 Panel de gestión</div>
            <div style={{ fontSize: 12.5, opacity: 0.82, marginTop: 2, fontWeight: 600 }}>Las misiones del huerto · vista de padres</div>
          </div>
          <SettingsMenu
            onBackup={() => downloadBackup(data)}
            onRestore={() => setShowRestore(true)}
            onHistory={() => setShowHistory(true)}
            onReset={() => void withSafetyBackup('reset', 'resetear la semana', 'Antes de resetear la semana', resetCounter)}
            onLogout={() => void logout()}
          />
        </header>

        {showRestore ? (
          <RestoreBackupView
            current={data}
            onRestore={(backup, exportedAt) =>
              withSafetyBackup('restore', 'restaurar otra copia', 'Antes de restaurar una copia', () => restoreBackup(backup, exportedAt))
            }
            onDone={(message) => {
              setShowRestore(false)
              showToast(message)
            }}
            onBack={() => setShowRestore(false)}
          />
        ) : showHistory ? (
          <ChangeHistoryView entries={data.changeLog} kids={data.children} onBack={() => setShowHistory(false)} />
        ) : (
          <>
            <div style={{ padding: '16px 16px 8px' }}>
              <ConceptsCard
                concepts={data.concepts}
                onRemoveConcept={(id) => void removeConcept(id)}
                showConceptForm={showConceptForm}
                onToggleConceptForm={toggleConceptForm}
                newConceptLabel={newConceptLabel}
                onNewConceptLabelChange={setNewConceptLabel}
                newConceptEmoji={newConceptEmoji}
                onNewConceptEmojiChange={setNewConceptEmoji}
                newConceptIsVariableCost={newConceptIsVariableCost}
                onNewConceptIsVariableCostChange={setNewConceptIsVariableCost}
                newConceptCost={newConceptCost}
                onNewConceptCostChange={setNewConceptCost}
                onAddConcept={handleAddConcept}
                onEditConcept={(id, changes) => void editConcept(id, changes)}
              />

              <ChildrenCard
                kids={data.children}
                concepts={data.concepts}
                redemptions={data.redemptions}
                adjustments={data.adjustments}
                onAdd={(name) => void addChild(name)}
                onRename={(id, name) => void renameChild(id, name)}
                onRemove={(id) => {
                  const name = data.children.find((c) => c.id === id)?.name ?? 'un hijo/a'
                  void withSafetyBackup('removeChild', `eliminar a ${name}`, `Antes de eliminar a ${name}`, () => removeChild(id))
                }}
                onEditPoints={(id, value) => void editChildPoints(id, value)}
                onAdjust={(id, points, reason) => adjustChildPoints(id, points, reason)}
                onRedeem={(id, points, concept) => redeemChildPoints(id, points, concept)}
                onDeleteRedemption={(id) => void deleteRedemption(id)}
                onDeleteAdjustment={(id) => void deleteAdjustment(id)}
              />
            </div>

            <DayTabs
              days={data.days}
              selected={selected}
              onSelect={selectDay}
              accent={ACCENT}
              todayIdx={weekdayOfISODate(today)}
              variant="padres"
              extraTab={{ label: 'Todo', selected: globalView, onSelect: selectGlobalView }}
            />

            <main style={{ flex: 1, padding: '6px 16px 40px', display: 'flex', flexDirection: 'column', gap: 11 }}>
              {globalView ? (
                <GlobalMissionsView
                  missions={globalMissions}
                  days={data.days}
                  kids={data.children}
                  accent={ACCENT}
                  hasCustomOrder={hasCustomGlobalOrder}
                  onReorder={(ids) => void handleGlobalReorder(ids)}
                  onResetOrder={() => void handleResetGlobalOrder()}
                  editingId={editingId}
                  draftEmoji={draft.emoji}
                  draftTitle={draft.title}
                  draftPoints={draft.points}
                  draftDays={draft.days}
                  draftIsOneOff={draft.isOneOff}
                  onToggleDraftOneOff={toggleDraftOneOff}
                  draftOneOffDate={draft.oneOffDate}
                  onDraftOneOffDateChange={setDraftOneOffDate}
                  draftAssignedTo={draft.assignedTo}
                  onDraftEmojiChange={(emoji) => setDraft((d) => ({ ...d, emoji }))}
                  onDraftTitleChange={(title) => setDraft((d) => ({ ...d, title }))}
                  onDraftPointsChange={(points) => setDraft((d) => ({ ...d, points }))}
                  onToggleDraftDay={toggleDraftDay}
                  onToggleDraftChild={toggleDraftChild}
                  onSave={saveMission}
                  onCancel={cancelEdit}
                  onEdit={openEditMission}
                  onAdd={openAdd}
                  onDuplicate={(m) => void handleGlobalDuplicateMission(m)}
                  onDelete={(m) => void handleGlobalDeleteMission(m)}
                  templates={data.missionTemplates}
                  selectedTemplateIds={selectedTemplateIds}
                  templateOneOffLabel={draft.isOneOff && draft.oneOffDate ? etiquetaDeFecha(draft.oneOffDate) : undefined}
                  onToggleTemplateSelect={toggleTemplateSelection}
                  onCreateFromTemplates={() => void handleCreateFromTemplates()}
                  onEditTemplate={(id, changes) => void editMissionTemplate(id, changes)}
                  onDeleteTemplate={(id) => void deleteMissionTemplate(id)}
                />
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '4px 4px 2px' }}>
                    <span style={{ fontFamily: "'Bitter', serif", fontWeight: 600, fontSize: 18 }}>{day?.label}</span>
                    <span style={{ fontSize: 13, color: '#8A7E6B', fontWeight: 700 }}>{missions.length} misiones</span>
                  </div>

                  {editingId === 'new' ? (
                    <>
                      <MissionTemplatesQuickPick
                        templates={data.missionTemplates}
                        selectedIds={selectedTemplateIds}
                        oneOffLabel={draft.isOneOff && draft.oneOffDate ? etiquetaDeFecha(draft.oneOffDate) : undefined}
                        onToggleSelect={toggleTemplateSelection}
                        onCreateSelected={() => void handleCreateFromTemplates()}
                        onEditTemplate={(id, changes) => void editMissionTemplate(id, changes)}
                        onDeleteTemplate={(id) => void deleteMissionTemplate(id)}
                      />
                      <NewMissionForm
                        days={data.days}
                        kids={data.children}
                        accent={ACCENT}
                        emoji={draft.emoji}
                        onEmojiChange={(emoji) => setDraft((d) => ({ ...d, emoji }))}
                        selectedDays={draft.days}
                        onToggleDay={toggleDraftDay}
                        isOneOff={draft.isOneOff}
                        onToggleOneOff={toggleDraftOneOff}
                        oneOffDate={draft.oneOffDate}
                        onOneOffDateChange={setDraftOneOffDate}
                        assignedTo={draft.assignedTo}
                        onToggleChild={toggleDraftChild}
                        title={draft.title}
                        onTitleChange={(title) => setDraft((d) => ({ ...d, title }))}
                        points={draft.points}
                        onPointsChange={(points) => setDraft((d) => ({ ...d, points }))}
                        onSave={saveMission}
                        onCancel={cancelEdit}
                      />
                    </>
                  ) : (
                    <button
                      onClick={openAdd}
                      style={{ width: '100%', padding: 14, borderRadius: 16, border: '2px dashed #C4B896', background: 'transparent', color: '#6E6045', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}
                    >
                      ＋ Añadir misión
                    </button>
                  )}

                  {hasCustomOrder && (
                    <button
                      onClick={() => void handleResetOrder()}
                      style={{ alignSelf: 'flex-end', margin: '-5px 4px 2px 0', border: 'none', background: 'transparent', color: '#7C6E52', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', padding: 0 }}
                    >
                      ↺ Orden alfabético
                    </button>
                  )}

                  <MissionsList
                    missions={missions}
                    disabled={editingId !== null}
                    onReorder={(ids) => void handleReorder(ids)}
                    renderItem={(m, dragHandle) => {
                      const editing = editingId === m.id
                      return (
                        <MissionCard
                          mission={m}
                          editing={editing}
                          days={data.days}
                          kids={data.children}
                          accent={ACCENT}
                          dragHandle={dragHandle}
                          draftEmoji={draft.emoji}
                          draftTitle={draft.title}
                          draftPoints={draft.points}
                          draftDays={draft.days}
                          draftIsOneOff={draft.isOneOff}
                          onToggleDraftOneOff={toggleDraftOneOff}
                          draftOneOffDate={draft.oneOffDate}
                          onDraftOneOffDateChange={setDraftOneOffDate}
                          draftAssignedTo={draft.assignedTo}
                          onDraftEmojiChange={(emoji) => setDraft((d) => ({ ...d, emoji }))}
                          onDraftTitleChange={(title) => setDraft((d) => ({ ...d, title }))}
                          onDraftPointsChange={(points) => setDraft((d) => ({ ...d, points }))}
                          onToggleDraftDay={toggleDraftDay}
                          onToggleDraftChild={toggleDraftChild}
                          onSave={saveMission}
                          onCancel={cancelEdit}
                          onEdit={() => openEditMission(m)}
                          onDuplicate={() => void handleDuplicateMission(m)}
                          onDelete={() => void handleDeleteMission(m)}
                        />
                      )
                    }}
                  />
                </>
              )}
            </main>
          </>
        )}
      </div>
    </div>
  )
}
