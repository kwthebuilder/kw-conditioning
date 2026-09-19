# Acro Base S&C training app

Phone-first, offline web app that prescribes and logs a two-day-a-week strength programme. The rules live in `spec/` (read-only); the code lives in `src/`. See `CLAUDE.md` for the standing rules and `spec/app_build_plan_v1.md` for the phases.

## Run

```sh
npm install
npm test          # vitest, single run
npm run dev       # vite dev server on the LAN (--host); open the printed URL on the phone
npm run typecheck # tsc --noEmit
npm run build     # typecheck + static build to dist/
npm run preview   # serve dist/ on the LAN
```

## Layout

```
spec/            read-only contracts: engine spec, vectors, config, initial state, golden log
src/
  engine/        pure module: no DOM, storage, clock, randomness or network
    barbell.ts   class A: prescribeLift / updateLift (phase 1)
    rounding.ts  nearest 2.5 kg, ties down
    calendar.ts  mesocycle and programme week by date
  config/        types derived from spec/*.json, validators, and the bundled loader
  storage/       device store, export, import. Phase 4.
  ui/            screens. Phase 5. Phase 0 holds the placeholder page.
  version.ts     app version (from package.json) and spec name
tests/           vitest suites
```

Imports flow one way: `ui` → `storage` → `engine` → `config/types`. `src/config/types.ts` has no imports so any layer can use it without pulling in another.
