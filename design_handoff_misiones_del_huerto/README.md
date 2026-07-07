# Handoff: "Las misiones del huerto" — App familiar de misiones

## Overview
"Las misiones del huerto" es una app familiar de tareas del hogar gamificadas. Los hijos completan **misiones** (tareas) que valen **puntos**; los puntos se acumulan por semana. Los padres gestionan las misiones y **canjean** los puntos acumulados por recompensas del mundo real (tiempo de consola, tele, etc.), aplicando ellos el ratio puntos→minutos manualmente.

Hay **dos pantallas independientes**, cada una pensada para vivir en **una URL distinta y sin login**, en móvil o tablet:

1. **Pantalla de hijos** (`Pantalla Ninos.dc.html`) — solo consulta + cambiar estado de misiones. Sin acciones de gestión.
2. **Pantalla de padres** (`Pantalla Padres.dc.html`) — panel de control: crear/editar/borrar misiones, cambiar estados, y gestionar el contador de puntos (editar, penalizar, resetear, canjear).

## About the Design Files
Los archivos `.dc.html` de este paquete son **referencias de diseño creadas en HTML** — prototipos que muestran el aspecto y comportamiento deseados, **no** código de producción para copiar tal cual. Usan un pequeño runtime propio (`support.js`) para renderizar; ábrelos en un navegador para ver e interactuar con el diseño.

La tarea es **recrear estos diseños en el entorno del codebase objetivo** (React, Vue, SwiftUI, nativo, etc.), siguiendo sus patrones y librerías establecidos. Si aún no existe un entorno, elige el framework más apropiado (recomendado: **React** + un store ligero, dada la naturaleza de la lógica). La lógica que ves en los archivos (clase `Component extends DCLogic` con `state` + `renderVals()`) es esencialmente un componente React de clase: `state` es el estado, `renderVals()` es lo que se calcula en cada render, y los `onClick`/`onChange` son handlers. Se traduce casi 1:1.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciados, radios y estados son definitivos y están documentados abajo con valores exactos. Recrea la UI de forma fiel usando las librerías del codebase. Los **pictogramas son emoji** de forma intencionada (funcionan offline y ayudan a niños que no leen); ver nota en *Assets* sobre cómo sustituirlos por ilustraciones propias si se desea.

---

## Modelo de datos

```
Mission {
  id: string
  emoji: string           // pictograma mostrado (ver PALETTE)
  title: string
  points: number          // 10 por defecto al crear
  status: "pendiente" | "progreso" | "bloqueada" | "completada"
}

Day {
  label: string           // "Lunes"… "Domingo"
  short: string           // "Lun"… "Dom"
  missions: Mission[]
}

// La semana es un array fijo de 7 Day (índice 0 = Lunes … 6 = Domingo).
// Cada día tiene su PROPIA lista de misiones, independiente del resto.

RewardConcept {            // conceptos de canje, configurables por el padre
  id: string
  emoji: string
  label: string            // "Consola", "Tele", "Tablet", "Postre"…
}

// Contador global de la semana:
acumulado: number          // puntos disponibles. PUEDE SER NEGATIVO.
                           // acumulado = puntos ganados − penalizaciones − canjeados
```

### Reglas de negocio (críticas)
- **`acumulado` inicial** = `basePoints` (40 por defecto) + suma de puntos de todas las misiones ya `completada`.
- **Completar** una misión (`status` → `completada`): suma sus `points` a `acumulado`.
- **Descompletar** (`completada` → cualquier otro estado): resta sus `points` de `acumulado`.
- **Editar** los puntos de una misión que está `completada`: ajusta `acumulado` por la diferencia (nuevo − viejo).
- **Borrar** una misión `completada`: resta sus `points` de `acumulado`.
- **Editar contador** (padres): fija `acumulado` a un valor exacto (puede ser negativo).
- **Penalizar** (padres): `acumulado -= n` (n ≥ 0). El resultado **puede quedar negativo**.
- **Resetear** (padres): `acumulado = 0`.
- **Canjear** (padres): `acumulado -= puntos`. **Bloqueado** si `puntos <= 0` o `puntos > acumulado` (no se puede canjear más de lo disponible).
- El día seleccionado por defecto al abrir es **hoy**: `todayIdx = (new Date().getDay() + 6) % 7` (convierte domingo=0 a índice 6).

> Nota sobre negativos: penalizar, descompletar, borrar completadas y editar directamente PUEDEN dejar `acumulado` por debajo de 0. El **canje** es la única acción con guarda de saldo.

---

## Pantalla 1 — Hijos (`Pantalla Ninos.dc.html`)

**Propósito:** el niño ve sus misiones, cambia su estado y consulta sus puntos. **No** puede crear, editar, borrar misiones ni tocar el contador.

**Layout (mobile-first, ancho máx. 500px, centrado):**
- **Header fijo (`position: sticky; top:0`)** — siempre visible sin scroll. Fondo `accent` (verde), esquinas inferiores redondeadas (`border-radius:0 0 26px 26px`), sombra `0 8px 22px rgba(58,50,40,.20)`. Contiene:
  - Línea de marca: "🌿 Las misiones del huerto" (Bitter 600, 14px, opacity .92).
  - Contador gigante: número de `puntos` (Bitter 700, **60px**) + palabra "puntos" (Nunito 800, 22px). Al cambiar, el número hace un `pop` (keyframe `popNum`, scale .7→1.14→1, .4s) **solo cuando cambia el total** (completar/descompletar), no en otros cambios de estado.
  - Badge flotante "+N" / "−N" que sube y se desvanece (keyframe `floatUp`, 1s) al completar/descompletar. Verde `#CDE7A0` para +, salmón `#F0C3A6` para −.
  - Subtítulo: "acumulados esta semana 🌻" (13.5px, opacity .82).
- **Tabs de día** (`nav`, scroll horizontal, gap 8px, padding 16px): 7 botones Lun–Dom. Seleccionado = relleno `accent`, texto `#F6F1E2`, sombra. No seleccionado = `#FFFDF6`, borde `#E4DBC8`, texto `#8A7C60`. El día de **hoy** muestra un puntito de 5px debajo del texto.
- **Cabecera de lista**: "Misiones de {Día}" (Bitter 600, 19px) + "{hechas}/{total} hechas" (13px, `#8A7E6B`, 700).
- **Lista de misiones** (flex column, gap 12px, padding 8px 16px 44px).
- **Estado vacío** (día sin misiones): centrado, 🪴 40px + "No hay misiones para este día" + "¡Disfruta del descanso!".

**Tarjeta de misión (hijos):**
- Contenedor: `background:#FFFDF6; border:1px solid #EADFCB; border-radius:20px; padding:15px 16px; box-shadow:0 2px 6px rgba(58,50,40,.05)`.
  - Si `completada`: `background:#EDF4E1; border:1.5px solid #CFE0B5` y el título en `#4A6B33`.
- Fila superior (flex, align center, gap 12): **tile de pictograma** (50×50, `border-radius:14px`, `background:#F1ECDD` — o `#DBEAC4` si completada, emoji 27px) + **título** (Nunito 700, 16.5px, line-height 1.25) + **badge de puntos** ("{n} pts", `background:#E5EFD6; color:#40682A; 800; 12.5px; padding:5px 10px; border-radius:999px`).
- **Control de estado segmentado** (fila de 4 botones, gap 7, margin-top 13): el estado **activo** se expande (`flex:1`) mostrando icono + etiqueta con los colores de su estado (ver *Estados*); los inactivos son cuadrados 46px, `background:#F4EEE1`, borde `#E7DECB`, `opacity:.7; filter:grayscale(.35)`, solo icono. Tocar un botón fija ese estado. **Altura mínima 46px** (target táctil).

## Pantalla 2 — Padres (`Pantalla Padres.dc.html`)

**Propósito:** gestión completa. Tono "panel de control", más denso.

**Layout (ancho máx. 520px, centrado):**
- **Header** (no fijo): fondo `accent`, "🌿 Panel de gestión" (Bitter 700, 16px) + "Las misiones del huerto · vista de padres" (12.5px, opacity .82).
- **Tarjeta de contador** (fondo oscuro `#3B3226`, texto `#F5EFE0`, `border-radius:18px`, padding 16px 18px):
  - Etiqueta "PUNTOS ACUMULADOS" (uppercase, 12.5px, 800, opacity .7) + número (Bitter 700, **44px**). A la derecha, nota "acumulados = ganados − canjeados" (12px, opacity .6).
  - Grid 2×2 de acciones (gap 8, margin-top 14): **✏️ Editar**, **➖ Penalizar**, **🎁 Canjear**, **↺ Resetear**. "Canjear" destaca en verde `#7FB25C` con texto `#22331A`; los demás en `#5A4E3C` con texto `#EFE7CF`.
  - Al pulsar una acción se abre un **panel inline** debajo (fondo `#4A4032`, `border-radius:12px`, padding 12px). Solo uno abierto a la vez (toggle):
    - **Editar**: input numérico (prefill = acumulado actual) + Guardar + Cancelar. Fija el valor (admite negativos).
    - **Penalizar**: input numérico (placeholder "p. ej. 15") + Aplicar + Cancelar. Resta del acumulado (puede quedar negativo).
    - **Resetear**: confirmación "¿Poner el contador a cero?" → botón rojo `#C4664A` "Sí, resetear a 0" + Cancelar.
    - **Canjear**: título + botón "+ concepto"; fila de **conceptos** (botones todos visibles, seleccionable, cada uno con "×" para eliminar); form opcional para añadir concepto (nombre + selector de pictograma); input de puntos + "Confirmar canje"; mensaje de resultado/error debajo (verde `#BFE08A` ok, salmón `#F0B49A` error).
- **Tabs de día**: idénticos a la pantalla de hijos.
- **Cabecera de lista**: "{Día}" + "{n} misiones".
- **Lista de misiones** (gestión).
- **Botón "＋ Añadir misión"** (ancho completo, borde discontinuo `2px dashed #C4B896`, transparente, texto `#6E6045` 800). Al pulsarlo se sustituye por el **formulario de nueva misión**.

**Tarjeta de misión (padres) — modo vista:**
- Contenedor: `background:#FFFDF6; border:1px solid #EADFCB; border-radius:18px; padding:14px 15px`.
- Fila (flex, align center, gap 12): tile 46×46 (`border-radius:13px; background:#F1ECDD`, emoji 25px) + bloque título/puntos (título 700 16px; "{n} pts" 12.5px `#8A7E6B` 700) + botón **✏️** + botón **🗑️** (ambos 38×38, `border-radius:10px`, `background:#FBF7EC`, borde `#EADFCB`).
- Debajo (margin-top 11): **`<select>` de estado** a ancho completo, coloreado según el estado activo (bg/borde/texto del estado). Opciones: 🌰 Pendiente / 🌱 En progreso / 🥀 Bloqueada / 🌻 Completada.

**Formulario crear / editar misión:**
- Modo crear: contenedor con borde discontinuo `2px dashed #C9BE9F`, `background:#FBF7EC`. Modo editar: dentro de la propia tarjeta.
- Campos, en orden:
  1. **Selector de pictograma**: cuadrícula (flex-wrap, gap 5) de los 22 emoji de `PALETTE`. Botones 40×40, `border-radius:11px`; el seleccionado con borde `2px solid #5B8C3E` y `background:#DDEBC9`. **El padre elige la imagen que se mostrará en la misión.**
  2. **Selector de día(s)** (solo al crear): "¿Qué día o días aparece?" + chips Lun–Dom (multi-selección; el día actual viene premarcado). Chip activo = relleno `accent`. Al guardar, se crea una **copia de la misión en cada día marcado**.
  3. **Título** (input texto, ancho completo).
  4. **Puntos** (input numérico, ancho 84px, **valor por defecto 10**, editable).
  - Botones: **Guardar / Añadir misión** (verde `#47702F`, `flex:1`) + **Cancelar** (`#EFE7D4`, texto `#7C6E52`).

---

## Estados de misión (tokens de color)
Cada estado tiene: fondo (`bg`), borde/anillo (`ring`), texto (`fg`), icono.

| Estado | icono | bg | ring | fg |
|---|---|---|---|---|
| Pendiente | 🌰 | `#ECE3D0` | `#C6B592` | `#7C6E52` |
| En progreso | 🌱 | `#F6E9C4` | `#DBA92C` | `#957414` |
| Bloqueada | 🥀 | `#F1DACF` | `#C4664A` | `#A04A32` |
| Completada | 🌻 | `#DDEBC9` | `#5B8C3E` | `#3F6B26` |

El emoji de estado sigue una metáfora de crecimiento (semilla → brote → flor); "bloqueada" usa flor marchita.

## Design Tokens

**Colores**
- Accent (verde primario, prop `accent`): default **`#5B8C3E`**. Alternativas: `#47702F`, `#3E6B57`, `#B4633A`.
- Fondo página: hijos `#EFE7D4`, padres `#E9E0CC` (`body`), lienzo interno hijos `#EFE7D4`.
- Superficie tarjeta: `#FFFDF6`; superficie tarjeta completada: `#EDF4E1`.
- Tarjeta oscura (contador padres / paneles): `#3B3226`, panel inline `#4A4032`, botones panel `#5A4E3C`.
- Texto principal `#3A3228`; texto atenuado `#8A7E6B` / `#7C6E52`; texto sobre verde/oscuro `#F6F1E2` / `#F5EFE0`.
- Botón verde brillante (acciones positivas): `#7FB25C` sobre texto `#22331A`.
- Rojo peligro/reset: `#C4664A`.
- Badge puntos: bg `#E5EFD6`, texto `#40682A`.
- Bordes: `#EADFCB`, `#E4DBC8`, `#DCD1B9`, `#E0D6C2`, discontinuos `#C9BE9F` / `#C4B896`.

**Tipografía** (Google Fonts)
- Display / números / cabeceras: **Bitter** (serif), pesos 500/600/700.
- UI / cuerpo: **Nunito** (sans), pesos 400/600/700/800/900.
- Tamaños clave: contador hijos 60px, contador padres 44px, cabecera de día 18–19px, título de misión 16–16.5px, cuerpo 13–14px.

**Radios**: tarjetas 18–20px, tiles 13–14px, botones/paneles 11–14px, píldoras 999px, header hijos inferior 26px.

**Sombras**: tarjeta `0 2px 6px rgba(58,50,40,.05)`; header hijos `0 8px 22px rgba(58,50,40,.20)`; contador padres `0 6px 16px rgba(58,50,40,.18)`.

**Espaciado**: contenedor padding lateral 16px; gap entre tarjetas 11–12px; ancho máx. 500–520px, centrado.

**Animaciones** (solo pantalla de hijos):
- `popNum`: `0%{scale(.7)} 55%{scale(1.14)} 100%{scale(1)}`, 0.4s ease. Se dispara solo al cambiar el total.
- `floatUp`: badge +N/−N sube ~40px y se desvanece, 1s ease.

## PALETTE de pictogramas (22)
`🛏️ 🍽️ 🍴 🪴 🧸 🗑️ 🛋️ 🧹 🫧 🧺 👕 🐶 🎒 ♻️ 🍳 🛁 🍂 🛒 🚗 📚 🖊️ 🌻`

## Interacciones & comportamiento
- **Cambiar estado**: hijos con control segmentado, padres con `<select>`. Ambos disparan la lógica de puntos descrita arriba.
- **Navegación de día**: tabs; ambos roles pueden navegar entre los 7 días. Cambiar de día en padres cierra cualquier edición abierta.
- **Crear misión**: elegir pictograma + día(s) + título + puntos → crea una copia por día seleccionado. Sin título no guarda.
- **Editar / borrar misión**: por tarjeta, en pocos clics.
- **Contador (padres)**: paneles inline mutuamente excluyentes; canje con validación de saldo y feedback textual.
- **Persistencia**: en el prototipo es estado en memoria. **En producción debe persistir en una base de datos online** (ver *Historias de Linear*, MOO-15): las misiones, puntos y conceptos deben sobrevivir a recarga/dispositivo.

## State Management
Estado necesario (por sesión/familia, idealmente en backend):
- `days: Day[]` (7) con sus misiones.
- `acumulado: number`.
- `concepts: RewardConcept[]` (configurables).
- `selectedDay: number` (UI).
- Estado efímero de UI: panel abierto, misión en edición, borradores de formulario, valores de inputs.

## Assets
- **Sin imágenes externas.** Todos los pictogramas son **emoji Unicode** (lista `PALETTE` arriba). Elección intencionada: funcionan offline y ayudan a pre-lectores.
- Si se quieren **ilustraciones propias** en lugar de emoji: sustituir el "tile" de la misión por un `<img>`/componente de imagen y ampliar el selector de la pantalla de padres para elegir de un set de ilustraciones (o subir). El modelo ya contempla un campo por misión (`emoji`) que pasaría a ser una referencia de imagen.
- Fuentes: Bitter y Nunito desde Google Fonts.

## Historias de usuario (Linear — equipo MOO, proyecto "Las misiones del huerto")
Estos diseños implementan:
- **MOO-6** Ver misiones del día + navegar entre días (hijos).
- **MOO-7** Cambiar estado (4 estados); puntos suman/restan al total.
- **MOO-8** Crear/editar/borrar misiones (10 pts por defecto).
- **MOO-9** Cada día con lista independiente.
- **MOO-10** Contador de puntos siempre visible (hijos).
- **MOO-11** Canjear puntos por recompensas configurables (padres); no exceder saldo.
- **MOO-12** Penalizar (restar puntos).
- **MOO-13** Editar el contador directamente.
- **MOO-14** Resetear a cero (manual).

Fuera del alcance visual (backend), a implementar en producción:
- **MOO-15** Persistencia en la nube.
- **MOO-16** Dos interfaces separadas en URLs distintas, sin login (los diseños ya son dos pantallas independientes; falta el enrutado/servido por separado).

## Files
- `Pantalla Ninos.dc.html` — prototipo pantalla de hijos.
- `Pantalla Padres.dc.html` — prototipo pantalla de padres.
- `support.js` — runtime del prototipo (necesario solo para abrir los HTML; **no** portar a producción).
- Abrir cualquiera de los dos `.dc.html` en un navegador para ver e interactuar.
