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
  to `children[].points` instead (split evenly, remainder to the first children in array order —
  see `splitAmong` in `src/shared/logic.ts`), and `acumulado` stops being touched by missions.
  With zero children, everything behaves exactly like v1 — this fallback is deliberate
  backward-compatibility, not a bug.
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
