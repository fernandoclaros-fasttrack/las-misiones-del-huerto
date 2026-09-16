import { useEffect, useRef, useState } from 'react'
import { todayISODate } from './constants'

/** Qué día es hoy, manteniéndose al día solo (MOO2-167/169).
 *
 *  Esta app vive en la tablet de la cocina: se abre una vez y se queda abierta días. Cualquier
 *  fecha calculada en un render se queda congelada en el día en que se montó la pantalla, y por
 *  la mañana la familia se encuentra la lista de ayer. Como la app es estática (GitHub Pages +
 *  Firestore) no hay backend que dispare nada a medianoche: el cambio de día hay que detectarlo
 *  en el cliente, y esto es el único sitio que lo hace.
 *
 *  Se refresca al volver a la pestaña y con una comprobación por minuto, y solo provoca un
 *  repintado cuando la fecha cambia de verdad (el `setState` devuelve el mismo string en los
 *  otros 1439 minutos del día, así que React corta ahí).
 *
 *  Devuelve también un `sync` manual para el hueco entre la medianoche y el siguiente tic del
 *  minuto: una acción del usuario dentro de ese hueco (guardar una misión puntual) mide contra
 *  el día real y necesita poder poner al día lo que se está pintando, para que nada de lo que
 *  salga a continuación contradiga lo que se ve. */
export function useToday(): readonly [string, () => void] {
  const [today, setToday] = useState(todayISODate)
  const sync = useRef(() => setToday((prev) => (todayISODate() === prev ? prev : todayISODate()))).current
  useEffect(() => {
    const timer = window.setInterval(sync, 60_000)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [sync])
  return [today, sync]
}

/** Día de la semana seleccionado en las pestañas, que sigue al día real mientras nadie lo haya
 *  movido a mano (MOO2-169).
 *
 *  El `useState(todayIdx)` de toda la vida elige bien el día al abrir la pantalla y ya no se
 *  entera de nada más: cruzada la medianoche, la pestaña seleccionada y el punto de "hoy" acaban
 *  señalando días distintos, y la lista que se ve es la de ayer.
 *
 *  Lo que decide si hay que mover la selección no es si el usuario ha tocado algo, sino **si
 *  seguía mirando el día que era hoy hasta hace un momento**: si es así, lo que quería ver era
 *  "hoy" y se le lleva al nuevo. Si se había ido a otro día (un padre preparando el sábado), se
 *  le deja donde está — arrastrarle a otra pestaña por un cambio de fecha le movería la lista
 *  bajo las manos. El único caso indistinguible es haber elegido a mano el día que ya era hoy,
 *  donde mover es igualmente lo razonable. */
export function useDayFollowingToday(todayIdx: number) {
  const [selected, setSelected] = useState(todayIdx)
  const anteriorRef = useRef(todayIdx)
  useEffect(() => {
    const previo = anteriorRef.current
    anteriorRef.current = todayIdx
    if (previo === todayIdx) return
    setSelected((s) => (s === previo ? todayIdx : s))
  }, [todayIdx])
  return [selected, setSelected] as const
}
