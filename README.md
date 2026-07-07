# Las misiones del huerto 🌿

App familiar de misiones domésticas gamificadas. Los hijos completan misiones que dan puntos;
los padres gestionan las misiones y canjean los puntos acumulados por recompensas (tiempo de
consola, tele, etc.).

Dos pantallas independientes, sin login:

- **Hijos** (`/`) — ver misiones del día, cambiar su estado, consultar puntos.
- **Padres** (`/padres/`) — crear/editar/borrar misiones, gestionar el contador de puntos
  (editar, penalizar, canjear, resetear).

Ver [design_handoff_misiones_del_huerto/README.md](./design_handoff_misiones_del_huerto/README.md)
para la especificación de diseño completa (tokens, modelo de datos, reglas de negocio).

## Stack

- React + TypeScript + Vite (build multi-página: dos HTML de entrada, uno por pantalla)
- Firebase Firestore como base de datos (sin backend propio, se conecta desde el navegador)
- GitHub Pages para el despliegue

## Desarrollo local

```bash
npm install
npm run dev
```

Sin configurar Firebase, la app funciona igualmente: usa un almacenamiento local de
desarrollo (`localStorage`, ver `src/shared/localStore.ts`) sembrado con los mismos datos de
ejemplo del prototipo de diseño. Útil para desarrollar la UI sin depender de una base de datos
real, pero **no persiste entre dispositivos** — solo para desarrollo.

## Configurar Firebase (persistencia real)

1. Ve a [console.firebase.google.com](https://console.firebase.google.com) y crea un proyecto
   nuevo (puede ser gratuito, plan Spark).
2. En el proyecto, entra en **Firestore Database** → **Crear base de datos** → modo
   **producción** → elige una región cercana.
3. Ve a **Configuración del proyecto** (⚙️) → pestaña **Tus apps** → **Añadir app** → icono
   **Web** (`</>`) → dale un nombre (p. ej. "misiones-del-huerto") → no hace falta Firebase
   Hosting.
4. Copia los valores del objeto `firebaseConfig` que te muestra.
5. Copia `.env.example` a `.env.local` y rellena las variables con esos valores:
   ```bash
   cp .env.example .env.local
   ```
6. En Firestore → pestaña **Reglas**, pega el contenido de [`firestore.rules`](./firestore.rules)
   de este repo y publica.
7. Reinicia `npm run dev`. La primera vez que se abra la pantalla de hijos o de padres, la app
   creará automáticamente el documento `families/default` con los datos de ejemplo.

> ⚠️ **Nota de seguridad**: como la app no tiene login (v1, un solo dispositivo/familia), las
> reglas de Firestore permiten leer/escribir el documento `families/default` sin autenticación.
> Cualquiera con la URL de la app y la configuración de Firebase (que queda visible en el
> código del sitio publicado) podría modificar los datos. Es una limitación aceptada para este
> proyecto familiar; no uses este patrón para datos sensibles o multi-familia.

## Despliegue a GitHub Pages

El repo incluye un workflow de GitHub Actions (`.github/workflows/deploy.yml`) que construye y
publica la app en cada push a `main`. Para que el build tenga acceso a Firebase, añade estos
secrets en **Settings → Secrets and variables → Actions** del repo (mismos valores que tu
`.env.local`):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Luego activa GitHub Pages en **Settings → Pages → Source: GitHub Actions**.

Una vez desplegado, las dos pantallas quedan en:

- Hijos: `https://<usuario>.github.io/las-misiones-del-huerto/`
- Padres: `https://<usuario>.github.io/las-misiones-del-huerto/padres/`

## Estructura

```
src/
  ninos/          pantalla de hijos (entry: index.html)
  padres/         pantalla de padres (entry: padres/index.html)
  shared/         tipos, constantes, lógica de negocio pura, hook de datos Firestore
firestore.rules   reglas de seguridad de Firestore
```

La lógica de negocio (sumar/restar puntos al completar, penalizar, canjear, etc.) vive en
funciones puras en `src/shared/logic.ts`, ejecutadas dentro de transacciones de Firestore
(`src/shared/useFamilyData.ts`) para que las pantallas de hijos y de padres puedan estar
abiertas a la vez sin pisarse los cambios.
