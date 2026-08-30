# Ten Billion Lives

One compact planetary field. Ten billion represented lives. Any observer can zoom from the whole planet to a street, select a person, and witness the same deterministic identity, itinerary, relationships, and events as every other observer—without storing ten billion agent records.

This repository will first deliver a local browser-based interactive observatory for a fictional Earth-like planet. The authoritative simulation operates on conserved population, place, and mobility fields. The browser procedurally manifests stable local people from that shared state. Networked sharing and deployment are explicitly deferred until the local concept is compelling and validated.

## Product promise

- Exactly 10,000,000,000 represented people in the baseline world.
- Continuous planet-to-person exploration.
- Stable, camera-independent manifested identities.
- Shared semantic events across two independent local observers.
- Peaceful daily-life systems: homes, work, school, transit, leisure, and festivals.
- Deterministic replay and a visible “reality budget” explaining how little state is required.

The project does **not** claim to simulate ten billion independent minds. Its subject is the emergence of consistent apparent individuality from a compact shared field.

The frozen [local MVP product contract](docs/PRODUCT.md) defines the honest claim and non-claim, five-minute journey, continuity rules, success metrics, evidence owners, and explicit non-goals. The [local architecture contract](docs/ARCHITECTURE.md) records authoritative state, deterministic manifestation/replay, package boundaries, and the exact two-observer semantic guarantee.

## Status

Local-first MVP planning complete. The executable work plan is tracked in GitHub milestones and issues; server deployment is a separate future phase.

- [Milestones](https://github.com/ryangavin/ten-billion-lives/milestones)
- [Final local-MVP gate and master checklist](https://github.com/ryangavin/ten-billion-lives/issues/27)
- [Autonomous Codex goal prompt](GOAL.md)

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). The project is available under the [MIT License](LICENSE).

## Local development

The supported toolchain is Node.js 24.18.0 LTS and pnpm 11.24.0, pinned in `.node-version`, `.nvmrc`, `package.json`, and the lockfile. From a clean checkout:

```sh
nvm install
corepack enable
corepack install --global pnpm@11.24.0
pnpm install --frozen-lockfile
pnpm exec playwright install chromium webkit
pnpm check
pnpm test:e2e
```

The root commands are:

| Command                 | Purpose                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `pnpm dev`              | Launch the local Vite development app at the printed loopback URL                       |
| `pnpm build`            | Type-check packages and create the production browser build                             |
| `pnpm benchmark`        | Build, measure local CPU/browser workloads, write JSON/report, and check coarse budgets |
| `pnpm benchmark:kernel` | Measure checkpoint size/save/load/replay/memory and enforce M1 kernel budgets           |
| `pnpm benchmark:check`  | Check the committed baseline against catastrophic regression limits                     |
| `pnpm preview`          | Serve the production build locally at `http://localhost:4173`                           |
| `pnpm replay:world`     | Print deterministic full-day and three-checkpoint replay hashes                         |
| `pnpm test`             | Run deterministic unit and contract tests once                                          |
| `pnpm test:e2e`         | Build, preview, and run the Chromium browser smoke journey                              |
| `pnpm lint`             | Run ESLint across the workspace                                                         |
| `pnpm typecheck`        | Run strict TypeScript checks in every package                                           |
| `pnpm check`            | Run formatting, lint, type, unit/contract, and production build checks                  |

`pnpm format` updates supported text files. The smoke fixture is seed- and tick-driven and does not consult ambient time. If the browser surface fails to render, its fallback message points back to `pnpm check`; terminal failures retain the failing command and package.

The workspace contains the local Vite app in `apps/web` and deterministic seams in `packages/sim`, `packages/manifest`, `packages/render`, and `packages/testkit`. There is no server package or remote runtime dependency.

The [deterministic primitive contract](docs/DETERMINISM.md) documents authoritative arithmetic, encoding, hashing, domain separation, allocation, permutation, tick, failure, and cross-runtime golden guarantees. The [local format contract](docs/FORMATS.md) freezes world, event, and checkpoint version 1 plus its fail-closed migration policy.
