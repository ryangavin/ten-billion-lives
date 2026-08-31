# Issue #29 evidence

This directory retains the contract-checkpoint artifact and inspection record for the frozen M4 living-city direction. It does not claim implementation or final visual quality.

## Baseline validation

Before the contract change, local `main` at `e57e0fc` matched `origin/main`. Issue #27 was closed, issue #29 was the next unblocked M4 issue, and `pnpm check` passed formatting, documentation, lint, strict types, 15 test files / 76 tests, and the production build.

The cheapest new falsifier, `node scripts/check-living-city-contract.mjs`, first failed because `docs/LIVING_CITY.md` did not exist. The final focused and root results are recorded here after the contract is validated.

Final validation on the issue candidate:

| Command                                       | Result                                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/check-living-city-contract.mjs` | passed; all frozen sections, interfaces, rejected directions, risk ownership, and evidence artifacts present               |
| `pnpm docs:check`                             | passed; 14 maintained files, spelling, local links, shell snippets, diagram alternatives, claims, and dependency inventory |
| `pnpm test:contracts`                         | passed; product, architecture, and living-city contracts                                                                   |
| `pnpm check`                                  | passed; formatting, docs, lint, strict types, 15 test files / 76 tests, and production build                               |
| Chromium wireframe render                     | passed at 1600 × 900; native artifact inspected below                                                                      |

The change adds no dependency or runtime implementation. The package graph, lockfile, world kernel, replay fixtures, renderer, browser app, and issue #28 remain untouched.

## Original-resolution inspection

The SVG was rendered by installed local Chromium into [`living-city-wireframe.png`](living-city-wireframe.png) and inspected at its native 1600 × 900 resolution.

- **Pass — dominant map:** the tilted city occupies roughly three quarters of the usable frame; the inspector and reality budget are visibly secondary.
- **Pass — city vocabulary:** dark connected roads, pale sidewalks, four striped crossings, eight extruded buildings, a garden, festival square, waterfront, and five named destinations remain distinct.
- **Pass — literal people:** the figures have heads, colored torsos, arms, separated legs, direction, scale variation, and clear contrast rather than reading as points.
- **Pass — selection/follow:** the yellow target rings, leader, weight-one label, route destination, and follow panel identify one person without relying on color alone.
- **Pass — controls and audit:** pause, rewind, explicit `15 min/s`, observer match, zero stored rows, Canvas status, field reveal, and semantic zoom are present but subordinate.
- **Pass — geometry:** no city, panel, or bottom scale is clipped at the native viewport. Labels do not obscure required crossings or the selected silhouette.
- **Tracked responsive risk:** the long selected-person callout is appropriate in the desktop target but could collide on a narrow viewport. The contract assigns #35 a shortened on-map callout and dismissible bottom sheet; this desktop artifact is not claimed as narrow-layout evidence.

No P0 visual defect was found in the target artifact. This disposition approves the direction and information hierarchy only, not production implementation, animation quality, density, responsive layout, or renderer performance.

Artifact hashes:

| Artifact                    | SHA-256                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `living-city-wireframe.svg` | `91c3334b091992571419425d4ece59bea14a079aff24eaabe752e78bd3de791e` |
| `living-city-wireframe.png` | `fd310a6646425f934c0e46e353f1e942ce53b6a36ca5aa16600099599d395fae` |

Chromium rendered the SVG at exactly 1600 × 900 with:

```sh
pnpm exec playwright screenshot --browser chromium --viewport-size 1600,900 docs/evidence/issue-29/living-city-wireframe.svg docs/evidence/issue-29/living-city-wireframe.png
```

## Artifact meaning

The wireframe is a visual target and composition test. It deliberately uses vector geometry and labels rather than external or generated runtime assets. Later issues must replace it with real production-browser screenshots and recordings paired with semantic assertions.
