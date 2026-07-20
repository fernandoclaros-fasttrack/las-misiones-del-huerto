# Las misiones del huerto

Family chore-gamification app. Two static screens (kids / parents) sharing one Firestore
document, deployed to GitHub Pages. See [README.md](./README.md) for setup/deploy instructions
and [design_handoff_misiones_del_huerto/README.md](./design_handoff_misiones_del_huerto/README.md)
for the original design spec (tokens, business rules, data model).

## Linear workflow

- Team **Moon**, ticket prefix **MOO**, project "Las misiones del huerto".
- When implementing a story: move it to **In Progress** when starting, **In Review** once
  implemented and verified. **Never move a ticket to Done** — only Fernando does that, after
  personally checking the acceptance criteria. This applies even after verifying the feature
  live against production Firestore; that verification supports his review, it doesn't replace it.
- Leave a comment on the ticket summarizing what was verified and any judgment calls made
  resolving ambiguous ACs or Open Questions — his review shouldn't require re-deriving that
  from the diff.
- Before building a genuinely new feature, check Linear for existing/related tickets first
  (duplicate detection) rather than assuming a clean slate.

## Architecture decisions that aren't obvious from the code

- **Shared counter vs per-child points**: `FamilyData.acumulado` is the original v1 shared
  counter. Once at least one `Child` exists (`FamilyData.children`), mission point deltas route
  to `children[].points` instead, and `acumulado` stops being touched by missions. With zero
  children, everything behaves exactly like v1 — this fallback is deliberate
  backward-compatibility, not a bug.
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
  every mission across every day back to `pendiente`. It does NOT touch `redemptions` — that's a
  log of past events, not current state.
- **Redemption history** (`redemptions[]`) only logs per-child canjes (`redeemChildPoints`), not
  penalties, manual point edits, or the legacy shared-counter redeem.
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

## Deploying

Push to `main` auto-triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`), which
builds with the Firebase config + `VITE_AUTH_EMAIL` from GitHub Actions secrets and deploys to
Pages. Adding a new `VITE_*` env var requires: adding it to `.env.example`, `.env.local`, the
workflow's env block, and as a GitHub secret (`gh secret set`).
