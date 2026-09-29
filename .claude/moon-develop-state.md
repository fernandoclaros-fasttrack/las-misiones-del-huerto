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
- Columnas del tablero: `Backlog` → `Todo` → `In Progress` → `In Review` → `Test AC` → `Done`,
  más `Canceled` y `Duplicate`.

**Convenciones que ya están leídas de `CLAUDE.md`** (resumen; el original manda)
- La code review va **antes** del merge; el merge no pide confirmación y el push a `main`
  despliega a producción. Es deliberado: la app es para su familia, no para clientes.
- **No hay CI en los PRs** (el único workflow corre al pushear a `main` y despliega), así que el
  `&&` del gate de merge no protege nada aquí: el gate es `npm run build` y `npm run lint` a mano
  antes de mergear, y decir que se han corrido.
- La etiqueta "Needs Refinement" **no se quita nunca por iniciativa propia**; una de preparación
  técnica ("Specs Ready") sí.
- `save_issue` de Linear ha llegado a soltar etiquetas que la edición no tocaba: pasa `labels`
  explícito en cada llamada y relee lo que devuelve.
- Verificar contra el Firestore de producción en un navegador, no solo contra el fallback local,
  y limpiar después los datos de prueba. Sin `.env.local` no hay credenciales y sólo se puede
  verificar contra el fallback local: dilo en el PR en vez de darlo por verificado.
- No hay framework de tests en el repo: las comprobaciones son `npm run build` (tsc + vite),
  `npm run lint` (oxlint) y el recorrido por navegador.

**Backlog (2026-09-29, tras MOO2-103)**
- Queda solo **MOO2-104** (lista de copias de la nube y restaurar una por fecha). Reutiliza
  `restoreBackup` (`useFamilyData.ts`) y `parseBackup` (`padres/backup.ts`); las copias viven en
  la colección `backups` (`src/shared/cloudBackup.ts`), con `kind`, `description` y `takenAt`
  (Timestamp del servidor) listos para pintar la lista. Restaurar desde ahí debe pasar por
  `withSafetyBackup` (`padres/App.tsx`), igual que desde un fichero.
- Leer las copias desde la consola del navegador en dev: importar `/src/shared/firebase.ts` y el
  módulo de Firestore **con la misma URL que usa la app** (`/node_modules/.vite/deps/firebase_firestore.js?v=<hash>`,
  se ve en el fuente servido de `cloudBackup.ts`); sin el `?v=` es otra instancia y
  `collection()` rechaza la base de datos.

**Verificación contra producción: lo que cuesta redescubrir**
- El `.env.local` **no está en los worktrees**, solo en el checkout principal: hay que copiarlo
  (`cp ../../../.env.local .env.local`) o sale la pantalla de login.
- El navegador del panel **no escribe las descargas a disco**, así que para inspeccionar una copia
  hay que interceptar `URL.createObjectURL` en la página. Sacar el JSON fuera del navegador está
  bloqueado por el clasificador; se trabaja con él dentro de la pestaña.
- Comparar dos documentos con `JSON.stringify` da **falso negativo**: Firestore no conserva el
  orden de las claves. Hace falta una comparación profunda que lo ignore.
- **`node_modules` no existe en los worktrees**: npm resuelve hacia arriba, al checkout principal
  (`D:/Git/las-misiones-del-huerto/node_modules`). `npm run build` funciona, pero un script suelto
  con `import 'esbuild'` falla; invoca los binarios por ruta absoluta desde ahí.
- **Para probar lógica pura sin framework de tests**, transpila y ejecuta con node:
  `node_modules/.bin/tsc --ignoreConfig src/shared/logic.ts src/shared/types.ts --outDir <tmp>
  --module esnext --target es2022 --moduleResolution bundler --skipLibCheck`. El `--ignoreConfig`
  es obligatorio: sin él tsc aborta porque hay `tsconfig.json` y se le pasan ficheros sueltos.
  Sirve para cubrir los casos que la UI no deja alcanzar (p. ej. un guard que el propio formulario
  ya bloquea antes).
- Para probar cosas destructivas sin arriesgar los datos de la familia, levantar una segunda
  instancia sin Firebase (`VITE_FIREBASE_API_KEY= VITE_FIREBASE_PROJECT_ID= npx vite --port 5199`),
  que cae al fallback de localStorage.
