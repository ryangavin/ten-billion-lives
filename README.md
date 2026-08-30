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

## Current local check

Until issue #3 establishes the complete application workflow, validate the product-contract foundation from the repository root with:

```sh
node scripts/check-product-contract.mjs
node scripts/check-architecture-contract.mjs
```
