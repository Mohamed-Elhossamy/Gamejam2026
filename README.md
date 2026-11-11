# λRush

A 2D maths survival platformer for the browser. You play λ, running left through a broken clockwork world while Σ (Sigma) chases you. Every obstacle asks a maths question. Answer correctly to work the mechanism, win back time and repair the Great Clock piece by piece. Answer wrongly and you lose a heart. Repair the clock and it turns on Sigma.

Six levels: basic differentiation, advanced differentiation, vectors, matrices, further mathematics and trigonometric terrain. Questions are generated and marked by a small Haskell service, not in the browser.

## Controls

| Key | Action |
| --- | --- |
| A / D or ← / → | Move |
| Space, W or ↑ | Jump |
| P | Pause |
| Esc | Pause menu |
| Enter | Start / restart |

Touch buttons appear on phones and tablets.

## How the project is laid out

```
web/            The game itself (React + TypeScript + Vite, drawn on an HTML canvas)
  src/game/       Game rules, physics, levels, rendering, audio
  src/components/ Menus, HUD, question panel, death and victory screens
server/         Node/Express server: serves /api, starts the Haskell engine, streams the music
  assets/         Background music
math-engine/    Haskell service that generates questions and checks answers
api/            The contract between the game and the server
  spec/           OpenAPI description of the /api routes (source of truth)
  client/         Typed fetch functions the game uses (generated from spec/)
  schemas/        Zod validators the server uses (generated from spec/)
scripts/        dev.sh (run everything locally) and test.sh (run the tests)
```

How a question flows: the game (`web/src/game/controller.ts`) calls `POST /api/math/question` → the server validates the request and forwards it to the Haskell engine on `127.0.0.1:8091` → the engine builds a question from `Mathematics.hs` → the answer goes back the same way via `POST /api/math/answer`.

Every tunable number (timer, speeds, hearts, rewards) lives in `web/src/game/rules.ts`.

## Running it

Needs Node 22 or newer, pnpm 10 and GHC (the Haskell compiler).

```bash
pnpm install
pnpm dev
```

`pnpm dev` installs dependencies if needed, builds the Haskell engine, starts the server on port 8080 and opens the game at http://localhost:5173. It stops with a clear message if a tool is missing, a port is taken or the server fails to start.

Works on macOS, Linux and WSL. On a Mac, install the tools with `brew install node pnpm ghc`.

## Tests

```bash
pnpm test                               # deterministic game tests, no server needed
pnpm run typecheck                      # TypeScript across the project
cd math-engine && runghc -i. Test.hs    # Haskell maths and question generation
```

With `pnpm dev` running, the live tests talk to the real server:

```bash
pnpm exec tsx web/src/game/controller.test.ts
pnpm exec tsx web/src/game/levelSix.integration.test.ts
```

Set `LAMBDA_API` to point them at a server other than `http://localhost:8080`.

After editing `api/spec/openapi.yaml`, regenerate the client and validators with `pnpm --filter @lambda-rush/api-spec run codegen`.

## Credits

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the music, sound effects, lettering and fonts.
