# Las misiones del huerto

Family chore-gamification app. Two static screens (kids / parents) sharing one Firestore
document, deployed to GitHub Pages. See [README.md](./README.md) for setup/deploy instructions
and [design_handoff_misiones_del_huerto/README.md](./design_handoff_misiones_del_huerto/README.md)
for the original design spec (tokens, business rules, data model).

## Linear workflow

- Team **Moon Personal**, ticket prefix **MOO2**, project "Las misiones del huerto". There is
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
- When implementing a story: move it to **In Progress** when starting, then to **In Review**
  (or "PR Review") once implemented and verified against production — code review only runs
  once a ticket is in that column. Once code review findings are resolved, move it straight to
  **Done** yourself; there's no separate step where Fernando has to sign off on the acceptance
  criteria before Done.
- Two labels, two different authorities: a technical-readiness label (e.g. "Specs Ready") can
  be added/removed freely. **"Needs Refinement" is never removed unilaterally** — only Fernando
  removes it, or explicitly authorizes removing it in the moment, since it encodes whether the
  product definition itself is settled, not a technical call.
- Leave a comment on the ticket summarizing what was verified and any judgment calls made
  resolving ambiguous ACs or Open Questions — review shouldn't require re-deriving that
  from the diff.
- Before building a genuinely new feature, check Linear for existing/related tickets first
  (duplicate detection) rather than assuming a clean slate.

## Merging

Once a ticket has passed code review and is Done, merge it without stopping to ask for manual
confirmation: commit on the ticket's feature branch (matching Linear's `gitBranchName`), push,
open a PR (short summary + test plan), then merge and delete the branch, then switch local back
to `main` and pull. This includes pushing to `main`, which auto-triggers a production deploy —
that's expected and fine here, not a reason to pause. This is deliberately looser than the
general default caution around production-deploying merges: Fernando has said this app is for
himself and his kids, not a business serving live customers, so asking every time is friction
without a matching risk reduction.

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
  filters by; there's no visibility gate on the parents screen, which always shows every mission.
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
