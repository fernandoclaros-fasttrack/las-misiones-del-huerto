# moon-develop — estado cacheado

Análisis que la skill `/moon-develop` produce en cada vuelta y que cuesta rehacer desde cero en
una conversación nueva. **El tracker manda sobre este fichero**: antes de reutilizar nada de aquí,
comprueba en Linear la columna y la fecha de última actualización del ticket en vuelo. Si no
cuadran, tira este análisis y rehazlo, no lo parchees.

Aquí no van decisiones humanas (esas van a `CLAUDE.md`) ni el relato de las sesiones (eso ya lo
cuentan el PR y el comentario del ticket). Las entradas de tickets que llegan a Done se borran.

## Las misiones del huerto (Linear)

**Identificadores**
- Workspace `fasttrack-solutions`, equipo **Moon 2** (`2e245287-f9d4-4136-ab10-5155b9d5c6c3`),
  prefijo de ticket `MOO2`, proyecto *Las misiones del huerto*
  (`cff74647-819f-429b-997b-240fb76afe37`).
- Ojo: `CLAUDE.md` llama al equipo "Moon Personal", pero lo que devuelve la API es **Moon 2**.
  Existe además un equipo distinto llamado "Moon" con prefijo `MOO` que no es este.
- Columnas reales del tablero: `Backlog` → `Todo` → `In Progress` → `In Review` → `Done`, más
  `Canceled`. **No hay columna de prueba de aceptación** (ningún "Test AC"), y `CLAUDE.md` lo dice
  explícitamente: tras resolver la code review el ticket va directo a `Done` sin que Fernando
  tenga que firmar los criterios de aceptación. Esa regla del proyecto gana sobre el gate por
  defecto de la skill.

**Convenciones que ya están leídas de `CLAUDE.md`** (resumen; el original manda)
- Merge sin preguntar una vez pasada la code review, incluido el push a `main`, que despliega a
  producción. Es deliberado: la app es para su familia, no para clientes.
- La etiqueta "Needs Refinement" **no se quita nunca por iniciativa propia**; una de preparación
  técnica ("Specs Ready") sí.
- `save_issue` de Linear ha llegado a soltar etiquetas que la edición no tocaba: pasa `labels`
  explícito en cada llamada y relee lo que devuelve.
- Verificar contra el Firestore de producción en un navegador, no solo contra el fallback local,
  y limpiar después los datos de prueba. Sin `.env.local` no hay credenciales y sólo se puede
  verificar contra el fallback local: dilo en el PR en vez de darlo por verificado.
- No hay framework de tests en el repo: las comprobaciones son `npm run build` (tsc + vite),
  `npm run lint` (oxlint) y el recorrido por navegador.

**Análisis del backlog (actualizado 2026-09-13)**
- Orden natural de la tanda de copias de seguridad: **MOO2-100 → MOO2-103 → MOO2-104**. El 100
  (restaurar desde fichero) es el mecanismo que el 104 (restaurar una copia de la nube por fecha)
  reutiliza; hacerlos al revés es escribir dos veces la parte delicada.
- **MOO2-100 hecho el 2026-09-13** (PR #28). Sus dos preguntas abiertas las cerró Fernando:
  restaurar reemplaza el **documento entero**, y el `changeLog` se **fusiona por id** con el de la
  copia. Eso deja a **MOO2-103 → MOO2-104** como la continuación natural de la tanda de copias de
  seguridad: el mecanismo de restaurar desde un fichero ya existe y el 104 lo reutiliza.
- Aviso para el 103/104: la restauración vive en `restoreBackup` (`useFamilyData.ts`) y la
  validación en `parseBackup` (`padres/backup.ts`); ambas son reutilizables tal cual desde una
  copia traída de la nube — lo único específico del fichero local es el `<input type=file>` de
  `RestoreBackupView`.
- **MOO2-101 cerrado como duplicado** de MOO2-103 + MOO2-104 (autorizado por Fernando el
  2026-09-12): pedía lo mismo repartido peor.
- **MOO2-168** (reutilizar una puntual desde la lista rápida) es el hermano de MOO2-167 y queda
  en Backlog. Toca el formulario de creación y `createMissionsFromTemplates`, que hoy crea
  siempre misiones recurrentes en el día que se está viendo.
- **MOO2-169** (que las dos pantallas se enteren del cambio de día) queda en Backlog con "Needs
  Refinement" y **tres preguntas abiertas de producto** sin responder, la de más peso si un niño/a
  puede seguir marcando una puntual de ayer. Es continuación de MOO2-167, que ya dejó `today` como
  estado en el panel de padres; falta `selected` en las dos pantallas y el `todayISODate()` que
  `ninos/App.tsx` calcula en cada render.

**Verificación contra producción: lo que cuesta redescubrir**
- El `.env.local` **no está en los worktrees**, solo en el checkout principal: hay que copiarlo
  (`cp ../../../.env.local .env.local`) o sale la pantalla de login.
- El navegador del panel **no escribe las descargas a disco**, así que para inspeccionar una copia
  hay que interceptar `URL.createObjectURL` en la página. Sacar el JSON fuera del navegador está
  bloqueado por el clasificador; se trabaja con él dentro de la pestaña.
- Comparar dos documentos con `JSON.stringify` da **falso negativo**: Firestore no conserva el
  orden de las claves. Hace falta una comparación profunda que lo ignore.
- Para probar cosas destructivas sin arriesgar los datos de la familia, levantar una segunda
  instancia sin Firebase (`VITE_FIREBASE_API_KEY= VITE_FIREBASE_PROJECT_ID= npx vite --port 5199`),
  que cae al fallback de localStorage.
