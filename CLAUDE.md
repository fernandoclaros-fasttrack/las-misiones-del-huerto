# Las misiones del huerto

<!-- moon-develop: ciclo configurado (2026-09-15) -->

Family chore-gamification app. Two static screens (kids / parents) sharing one Firestore
document, deployed to GitHub Pages. See [README.md](./README.md) for setup/deploy instructions
and [design_handoff_misiones_del_huerto/README.md](./design_handoff_misiones_del_huerto/README.md)
for the original design spec (tokens, business rules, data model).

## Linear workflow

- Team **Moon 2**, ticket prefix **MOO2**, project "Las misiones del huerto". There is
  *also* a separate team called "Moon" with prefix MOO — don't confuse them; querying statuses
  against "Moon" returns IDs that won't apply to these tickets.
- **Ticket numbers were renumbered when the project moved to MOO2, and the comments were not.**
  A `MOO-XX` reference in the source (or further down this file) is the *old* numbering and
  generally does **not** correspond to today's `MOO2-XX`. Example: `types.ts` credits the
  per-concept cost to "MOO-52", but MOO2-52 is "Penalize a child with a recorded reason" — the
  cost ticket is now MOO2-22. Never resolve an old reference by swapping the prefix; look the
  title up in Linear instead.
- Linear's `save_issue` has silently dropped a label and an acceptance-criteria line that the
  edit never touched. Pass `labels` explicitly on every call and re-read the returned issue to
  check nothing else changed.
- **El ciclo de un ticket, entero** (el mismo que en `tasks-board`; la skill `/moon-develop` lo
  describe fase a fase):
  1. **In Progress** al empezar.
  2. Implementar y **verificarlo el agente** (build, lint, y probarlo en el navegador como un
     usuario, contra el Firestore de producción cuando haya credenciales).
  3. PR **en draft** y ticket a **In Review**: code review sobre el diff de la rama, arreglos en
     la misma rama y re-verificación. Aquí no se le pregunta nada a Fernando.
  4. Sin hallazgos abiertos: PR a *ready* y mergear. El push a `main` despliega solo.
  5. Ticket a **Test AC** y **avisar a Fernando de que ya lo puede probar**, con el bloque de
     cierre (`references/aviso-final.md` de la skill). **Aquí se para.**
  6. Cuando él dice «probado y bien» → **Done** y limpiar.
     **Test AC → Done es la única transición que no decide el agente.** Y puede cerrarlo él por su
     cuenta desde el enlace del aviso: un ticket que aparezca en `Done` sin que se lo hayamos
     movido **es un ok suyo**, se le hace la limpieza en silencio y no se le pregunta nada.
  7. Si en vez del ok trae un hallazgo, vuelve a **In Progress**, se arregla, se revisa **el
     arreglo** y vuelve a Test AC.
- **Esto deroga lo que este fichero decía antes** («tras la code review el ticket va directo a
  Done sin que Fernando firme los criterios de aceptación»). Lo cambió él el 2026-09-15: el merge
  sigue sin pedirle permiso, pero **enterarse de lo que ha caído y probarlo antes de cerrarlo sí
  lo quiere**, igual que en su otro proyecto.
- **La code review va ANTES de mergear**, no después de que él lo pruebe. Lo que entra en `main`
  es la base del ticket siguiente, la haya probado él o no.
- **Ojo: hoy este repo no tiene CI en los PRs.** El único workflow corre en el push a `main` y
  despliega, así que un PR aquí no tiene ningún check y `gh pr checks` sale con 0 diciendo «no
  checks reported» — el `&&` del gate de merge **no protege nada aquí**. Mientras siga así, el
  gate es haber corrido `npm run build` y `npm run lint` a mano antes de mergear, y decirlo.
- Two labels, two different authorities: a technical-readiness label (e.g. "Specs Ready") can
  be added/removed freely. **"Needs Refinement" is never removed unilaterally** — only Fernando
  removes it, or explicitly authorizes removing it in the moment, since it encodes whether the
  product definition itself is settled, not a technical call.
- Leave a comment on the ticket summarizing what was verified and any judgment calls made
  resolving ambiguous ACs or Open Questions — review shouldn't require re-deriving that
  from the diff.
- Before building a genuinely new feature, check Linear for existing/related tickets first
  (duplicate detection) rather than assuming a clean slate.
- See `.claude/moon-develop-state.md` for moon-develop's cached run state (team/project IDs, the
  real column names, and the backlog analysis behind what to pick next). The tracker always wins
  over that file.

## Merging

Una vez resuelta la code review (paso 3 del ciclo de arriba) el merge no pide confirmación:
commit en la rama del ticket (la de `gitBranchName` de Linear), push, PR con resumen y plan de
prueba, mergear, borrar la rama, y volver local a `main` con `pull`. El push a `main` dispara el
deploy a producción, y eso es lo esperado aquí, no un motivo para parar: es deliberadamente más
suelto que la precaución habitual porque esta app es para él y sus hijos, no un negocio con
clientes vivos, así que preguntar cada vez es fricción sin riesgo que la justifique.

**Lo que sí se para es lo de después**: mergeado y desplegado, el ticket va a `Test AC` con el
bloque de aviso, y ahí espera. `Done` lo decide él (o lo cierra él mismo por el enlace).

## Architecture decisions that aren't obvious from the code

- **Shared counter vs per-child points**: `FamilyData.acumulado` is the original v1 shared
  counter. Once at least one `Child` exists (`FamilyData.children`), mission point deltas route
  to `children[].points` instead, and `acumulado` stops being touched by missions. With zero
  children, everything behaves exactly like v1 — this fallback is deliberate
  backward-compatibility, not a bug.
- **Two point-movement records, and they are not the same thing.** `redemptions[]` is what a child
  *spent* points on (always a deduction, tied to a configured reward concept). `adjustments[]`
  (`PointAdjustment`, MOO2-51/52) is a one-off movement a parent made by hand, with a mandatory
  written reason. `PointAdjustment.points` is **signed** — positive when giving points, negative
  when taking them away — so both directions share one structure, one validation path and one
  panel. `adjustChildPoints()` deliberately does **not** check for sufficient balance: unlike a
  canje, a penalty may leave a child negative (product decision).
- **Penalties are no longer reward concepts** (MOO2-52). `RewardConcept.isPenalty` and the "Es una
  penalización" checkbox are gone; penalties are their own action. But `Redemption.isPenalty` is
  **kept deliberately** and must not be removed: canjes recorded before MOO2-52 were genuinely
  penalties, and rewriting them would falsify the family's history. It is live business data, not
  just styling — `spentRedemptionsForChild()` uses it to keep old penalties out of the child's
  "Historial de canjeos". New canjes always write `false`.
- **`changeLog` is the single event stream for anything that moves points**, and it feeds three
  screens. `withHistory()` in `useFamilyData.ts` wraps every points-changing mutator, fires only
  when the total actually changes, and computes `ChangeLogEntry.deltas` — the per-child breakdown
  (MOO2-53) — **generically**, by diffing each child's points before and after. That is why
  missions, canjes, adjustments, manual edits and reset are all covered without any per-action
  work, and why a new points-changing action needs to do nothing to appear in the histories.
  `deltas` is a *list* because one action can move several children at once (a mission with two
  participants, or a week reset). `reason` is a short child-facing string (mission name, written
  motivo, redeemed reward) because `description` is written for the parent screen — third person
  about the child, and it repeats the amount.
- **Entries saved before MOO2-53 have `deltas: []`** and it cannot be reconstructed. They stay
  visible in the parents' unfiltered history but appear in **no** child's ledger and under **no**
  per-child filter. The parents' filter view says so explicitly rather than showing a
  short list with no explanation. Don't try to back-fill this; the data was never recorded.
- **Three history views, three different questions.** Parents' "Historial de cambios" (global
  audit, filterable per child — MOO2-18/55). The child's "Mi historial de puntos" (MOO2-53: every
  movement, with the balance it left, computed **backwards from current points** — never forwards
  from zero, because the log doesn't start at zero and forwards would disagree with the number on
  the child's own screen). And the child's "Historial de canjeos" (MOO2-54: only what they spent
  points on, living at the bottom of the redeem screen). **Canjes appear in both child views on
  purpose** — one explains the balance, the other records rewards obtained. Don't "fix" it.
- **Mission participants** (`Mission.participants`, MOO-26): when a family has children, completing
  a mission asks which children participated (all selected by default) — each selected child gets
  the mission's **full** `points` (not split). `participants` records who was credited so
  un-completing reverses the exact same set, even if the child roster changes afterward. It's
  cleared back to `[]` when the mission isn't `completada`. Docs written before MOO-26 (or a
  mission whose `participants` is empty while completed) are treated as "all children" — see
  `normalize()` in `src/shared/useFamilyData.ts` and the fallbacks in `src/shared/logic.ts`.
  `editMission`/`deleteMission` on an already-completed mission adjust only its recorded
  participants' points, not the whole roster.
- **Mission assignment** (`Mission.assignedTo`, MOO-27): distinct from `participants` above —
  this controls *visibility* (which children see the mission at all), not completion credit.
  Parents pick assigned children when creating/editing a mission (all children checked by
  default); the picker only appears once a family has more than one child. Missions saved before
  MOO-27 don't have this field — `normalize()` in `src/shared/useFamilyData.ts` backfills it with
  every *current* child's ID (not `[]`) each time the doc is read, so pre-MOO-27 "visible to
  everyone" missions keep including children added later, until the mission is next saved with an
  explicit selection. `isMissionVisibleTo()` in `src/shared/logic.ts` is what the kids screen
  filters by; the parents screen never filters by assignment and shows every mission whoever it
  is for (its only gate is the one-off date rule below, MOO2-167).
- **Resetear** (parents' reset button) zeroes `acumulado`, zeroes every child's points, AND sets
  every mission across every day back to `pendiente`. It does NOT touch `redemptions`,
  `adjustments` or `changeLog` — those are logs of past events, not current state. It *does*
  produce a `changeLog` entry whose `deltas` are each child's points going to zero, which is
  exactly what keeps the child's ledger arithmetic consistent across a reset without any special
  casing. A reset is a manual action and needn't land on a Sunday, so it can split a week group in
  the child's history; that's accepted, since the reset row itself explains the jump.
- **`redemptions[]` only ever records canjes** (`redeemChildPoints`) — never manual point edits or
  the legacy shared-counter redeem. Manual movements live in `adjustments[]` instead, and
  everything that touches points is additionally logged in `changeLog` (see above).
- **Auth**: a single Firebase Auth account (one shared password, email in `VITE_AUTH_EMAIL`)
  gates both screens — not one account per screen. Logging in on one screen authenticates the
  other automatically (same origin, same Firebase Auth session persisted in localStorage).
- **Firestore rules** (`firestore.rules`) requiring `request.auth != null` are the actual data
  protection — the login screen alone doesn't protect anything if someone calls the Firestore
  API directly with the (necessarily public) Firebase client config.
- **Dev fallback**: without Firebase env vars configured, the app runs against
  `src/shared/localStore.ts` (localStorage, seeded with demo data) instead of Firestore — lets
  the UI be verified without touching real production data. `firebaseEnabled` in
  `src/shared/firebase.ts` is the switch.
- **`vite.config.ts` `base`** differs between dev (`/`) and build (`/las-misiones-del-huerto/`).
  Don't hardcode the production base for dev — preview tooling polls the server root for
  readiness and hangs forever if dev doesn't resolve at `/`.
- Repo is **public** (required for free GitHub Pages) but contains no user data — that all lives
  in Firestore, gated by the rules above.
- **"Todo" tab** (MOO-30): a global, read/write view of all mission series (deduplicated by
  `seriesId`) alongside the day tabs in the parents screen. **"Borrar" means something different
  there than in a day tab**: `deleteMission` (day view) removes only that day's copy, leaving
  siblings on other days untouched; `deleteMissionSeries` ("Todo") removes every copy across
  every day — there's no day of reference in that view, so a partial delete would leave the row
  looking unchanged (just represented by a different day's copy) with no sign anything happened.
  Duplicating from "Todo" reuses `duplicateMission` unmodified (it already copies across the
  source's full `activeDays`, not just one day) — the only wrinkle is computing a valid `dayIdx`
  argument from a mission with no explicit day context, done via `Math.min(...mission.activeDays)`,
  which is guaranteed to be the day the representative copy's `id` actually lives on (see
  `uniqueMissionSeries()` in `src/shared/logic.ts`).
- **One-off missions** (`Mission.oneOffDate`, MOO2-56/61) bolt a real calendar date onto a data
  model that otherwise only knows "day of the week, repeating forever" (`Day` is one of 7 fixed
  weekday slots, not a specific week). A one-off mission still lives in the `Day` bucket matching
  its date's weekday (reuses `activeDays`/`editMission`'s existing per-day-copy machinery
  unchanged — it's just always a single-element array for a one-off), but `isMissionActiveToday()`
  in `logic.ts` is what actually hides it from the kids screen except on the exact date, so it
  doesn't come back every time that weekday recurs. Parents see it while its date is today or in
  the future, badged with its date instead of the weekday dots — **two different rules for the
  same field, on purpose** (MOO2-167): the kid only wants today's list, but the parent still has
  to be able to edit or delete the one they scheduled for next Saturday. `isMissionCurrentForParents()`
  is the parents' half, applied in `padres/App.tsx` to both the day tab and the "Todo" view.
  A past one-off is only *hidden*, never deleted: it stays in its `Day` so the points history and
  its recorded `participants` stay intact, which also means those missions accumulate in the
  document with no way to purge them from the UI. **That is also why a one-off can no longer be
  saved with a date in the past**: it would be born invisible to both screens, unfixable and
  undeletable. Both date inputs carry `min={todayISODate()}` and `saveMission` re-checks it,
  because a native date input still accepts a typed value below its `min`.
  Switching a mission between one-off and recurring (MOO2-61) is *not* special-cased in
  `editMission` — it's just an edit to `activeDays` down to one day, same as any other day-selection
  change; only the `oneOffDate` field itself needs explicit handling. Firestore rejects `undefined`
  field values even nested inside an array, so clearing `oneOffDate` back to recurring has to drop
  the key via destructuring, not set it to `undefined`.
- **Mission templates** (`FamilyData.missionTemplates`, MOO2-57/58/59/60): the "quick pick" list
  under "Añadir misión" is a completely separate record from any scheduled `Mission` — matched by
  title (case/whitespace-insensitive) so re-saving the same mission refreshes its template instead
  of duplicating it. It's only written to from `addMission` when the mission is typed by hand
  (`useFamilyData.ts`'s `fromTemplate` opt skips it when creating from the quick-pick list itself,
  so picking a template doesn't re-add itself). `editMission` never touches it: editing a scheduled
  mission's points doesn't change what the quick-pick entry offers next time, and editing/deleting
  a template (MOO2-59/60) never touches any already-scheduled mission — they're independent from
  the moment a mission is first created. `createMissionsFromTemplates` always creates *recurring*
  missions on the day currently being viewed (same default as a normal "Añadir misión"); one-off
  creation from the quick-pick list was out of scope.
- **Cloud backups** (`backups` collection, MOO2-103): one document per copy, never updated
  (the rules have no `update`), pruned by the client to 5 daily + 5 "before a destructive
  action". The daily copy is re-attempted whenever `useToday()` changes, not only on mount,
  because the kitchen tablet stays open for days.

## Verifying changes

Always verify against the real production Firestore in a browser preview (not just the local
dev fallback) before shipping — add whatever test data is needed (children, missions, etc.),
exercise the change, then **clean up the test data afterward** so production stays in the state
a real user left it in.

In dev, `VITE_DEV_AUTH_PASSWORD` in `.env.local` makes the app auto-sign-in on load, so no one
has to type the shared password to verify. It is gated by `import.meta.env.DEV` and never reaches
a production build. If a login screen appears unexpectedly, that var is missing or wrong — ask,
don't try to work around it.

This app is in daily use by a real family while you work on it, so:

- **Read the current state before clicking anything that changes it.** Clicking a mission status
  that is already active is a silent no-op (`if (status === mission.status) return`), which makes
  it easy to think a click did nothing and "undo" it — actually undoing a real action. Points
  deltas are the fastest way to detect that if it happens.
- **Prefer a throwaway child** (`ZZ …`) over touching a real one, and prefer read-only checks
  where the change allows it. When a real child is unavoidable (e.g. verifying mission credit),
  complete then immediately un-complete — un-completing reverses exactly the recorded
  `participants`, so it nets to zero.
- **Check whether the family is mid-session first**: look at the newest `changeLog` timestamps and
  actors. If entries are appearing as you work, stay read-only.
- `changeLog` entries **cannot be deleted from the UI** by design. Test data that generates them
  leaves a permanent trace, so keep test names obviously fake and expect the residue.

## Deploying

Push to `main` auto-triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`), which
builds with the Firebase config + `VITE_AUTH_EMAIL` from GitHub Actions secrets and deploys to
Pages. Adding a new `VITE_*` env var requires: adding it to `.env.example`, `.env.local`, the
workflow's env block, and as a GitHub secret (`gh secret set`).

**`firestore.rules` does not deploy with the push.** There is no Firebase CLI and no rules step
in the workflow: Fernando pastes the file into the Firebase console by hand (README step 6). A
change that needs new rules (a new collection, like `backups` in MOO2-103) therefore cannot be
verified against production nor merged until he has published them — the app code ships in
minutes, the rules only when he pastes them, and in between the new feature hits
`permission-denied`. Publishing the rules is his step, not the agent's: ask for it as early as
the rules are final, not at the end.
