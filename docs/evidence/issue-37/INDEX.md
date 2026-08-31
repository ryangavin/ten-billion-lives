# Issue #37 — M4 living-city release gate

This directory is the retained handoff for the complete local living-city visualization. The implementation was captured from fresh remote checkout `a742dd59446d945a443cc7824161bf66e92e3839` on the committed `apple-m1-max-32gb-chromium` profile. The evidence commit only adds generated evidence and documentation.

## Verdict

All M4 release criteria pass. Issues #29–#36 are closed. At the final live audit, #37 was the only open P0 visualization issue; #28 remained the explicitly deferred P1 deployment decision. No P0 visual defect was found in independent desktop or narrow inspection.

The product represents exactly `10,000,000,000` lives with conserved integer fields, zero stored person rows, deterministic reconstructed people, and camera/quality-independent semantics. The full journey fits without document scrolling at both tested viewport sizes.

## Acceptance map

| Criterion                                                                | Result                                                                                                                                                                                                                                                                        | Primary evidence                                                                                                            |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Dependencies #29–#36 closed; no other open P0 visualization defect       | Pass. Live `gh issue list` returned only #37 at P0 and deferred #28 at P1.                                                                                                                                                                                                    | This index; issue history                                                                                                   |
| Fresh remote checkout and documented commands                            | Pass at `a742dd5`: Node `24.18.0`, pnpm `11.24.0`, frozen install, 20 files / 110 tests, production build, and `pnpm start` served app HTML on `127.0.0.1:4173`. The clone was clean before generated evidence.                                                               | Command ledger below                                                                                                        |
| Exact population, integer/fixed authority, no person table, conservation | Pass: population `10000000000`; 2,048 integer cells; zero person rows; replay checkpoints and branch fields reconcile exactly.                                                                                                                                                | [complete journey](complete-journey.json), [replay](deterministic-replay.json), [field budget](12-desktop-complete.png)     |
| Goldens and replay twice                                                 | Pass: seven canonical vectors ran twice in independent processes and matched byte-for-byte. World hash `ed66e344fcd7e737`; event hash `ec998bbac0999abc`.                                                                                                                     | [deterministic replay](deterministic-replay.json)                                                                           |
| Complete production-browser journey retained                             | Pass in one recording: planet → Brindle Bay → continuous playback → neighborhood/street → pick/follow → commute/meeting → Lantern Tide arrival/peak/departure → closure → observer B → rewind/replay → field/reality budget.                                                  | [video](complete-journey.webm), [transcript](complete-journey.json), stills `01`–`12`                                       |
| Coherent city and recognizable animated people                           | Pass by direct inspection: connected roads, sidewalks, crosswalks, buildings, route/event overlays, and head/body/two-leg figures remain legible.                                                                                                                             | [street](04-street.png), [follow](05-follow-person.png), [festival peak](09-festival-peak.png)                              |
| Smooth tick/phase and seek/play/pause/replay continuity                  | Pass: continuous playback changed the projection key; pause remained stable; direct seek and rewind/replay both restored `living-city/680810ee21e3080b`.                                                                                                                      | [transcript](complete-journey.json), [browser matrix](playwright-summary.json)                                              |
| Two independent observers with independent cameras                       | Pass: semantic and trajectory comparison matched. Orbiting observer A changed no state, manifestation, event, or city hash.                                                                                                                                                   | [transcript](complete-journey.json), [browser matrix](playwright-summary.json)                                              |
| Weights/zoom reconcile; selected weight one; renderer knobs non-semantic | Pass: selected figure weight is `1`; all quality tiers retain the same person, state, manifestation, event, trajectory, population, and picked target.                                                                                                                        | [transcript](complete-journey.json), [`living-city-hardening.json`](../../../benchmarks/results/living-city-hardening.json) |
| Performance, startup, pick, fallback, and 30-minute budgets              | Pass. Final tier startup `1.09–1.15 s`, frame p95 `0.57/0.84/1.52 ms`, pick p95 at most `0.005 ms`, tier heap `16.61–21.90 MiB`; integrated journey `7.74 s`. The unchanged runtime's real 30-minute soak reached `1.32 ms` max frame p95 and `35.91 MiB` max retained heap.  | [comparison](performance-comparison.json), [`living-city-soak.json`](../../../benchmarks/results/living-city-soak.json)     |
| Browser, mobile, lifecycle, local boundary, and accessibility matrix     | Pass: 45 serialized cases; Chromium `18/1`, WebKit `12/7`, mobile Chromium `1/6`; 31 applicable passed, 14 intentional project-specific skips, zero unexpected, flaky, or retries. Axe found zero serious/critical violations in the handoff capture.                         | [browser matrix](playwright-summary.json), [transcript](complete-journey.json)                                              |
| Desktop and narrow no-scroll inspection                                  | Pass. Desktop document/viewport `1440×900`, renderer `1418×776`; narrow document/viewport `412×839`, renderer `398×725`.                                                                                                                                                      | [desktop](12-desktop-complete.png), [narrow](13-narrow-independent.png), [transcript](complete-journey.json)                |
| Claims, dependencies, bundle, runtime, and tracked-file audit            | Pass. Bundle `170.81 KiB` / `51.21 KiB` gzip. Runtime manifests contain workspace packages only. Network/server hits are loopback development/evidence tooling. No CI, Pages, container, deployment, cloud, remote API/data, account, paid service, or runtime LLM was added. | [comparison](performance-comparison.json), `docs/DEPENDENCIES.md`, tracked-file audit below                                 |

## Command ledger

The final gate ran sequentially from `/private/tmp/ten-billion-lives-m4-37-release.5wPxAM/repo`:

```sh
git clone https://github.com/ryangavin/ten-billion-lives.git repo
nvm install
corepack enable
corepack install --global pnpm@11.24.0
pnpm install --frozen-lockfile
git status --short
CI=true pnpm check
pnpm start
curl --fail --silent --show-error http://127.0.0.1:4173/
node scripts/capture-playwright-summary.mjs docs/evidence/issue-37
pnpm build
node scripts/capture-m2-replay.mjs docs/evidence/issue-37
CI=true pnpm evidence:m4-handoff
CI=true pnpm benchmark:living-city-hardening
CI=true pnpm benchmark:experience
gh issue list --state open --limit 100 --json number,title,labels,milestone
git ls-files
```

`pnpm check` passed formatting, spelling and documentation contracts, ESLint, strict types, all 110 tests, and the production build. The build emitted `170.81 KiB` JavaScript (`51.21 KiB` gzip) and `23.89 KiB` CSS (`6.09 KiB` gzip). `pnpm start` served the expected production HTML and was then stopped with Ctrl-C.

The release audit encountered one WebKit lifecycle timeout during an earlier back-to-back JSON matrix at the generic 30-second ceiling. The same case had passed immediately before in 14.5 seconds and contained no assertion or browser error. Marking the multi-page/context-loss/orientation journey as slow gave it the same ceiling as other long journeys; three focused WebKit runs passed in 14.7, 14.8, and 19.5 seconds. The final fresh-clone matrix above then passed with zero retries, unexpected, or flaky cases.

## Performance comparison

The [machine-readable comparison](performance-comparison.json) keeps the distinction between workloads explicit. The pre-M4 generic renderer and M4 integrated city are not identical workloads. The complete city increases interaction latency and bundle size, but every committed integrated-scene budget passes. It improves the retained release-soak memory result from `105.35` to `35.91 MiB` and growth from `49.35` to `13.88 MiB` on the same profile; final frame p95 remains far below a 60 Hz frame.

The real 30-minute soak was captured at `743ec52`. From that commit through the final captured implementation, the diff contains only benchmark/evidence/docs outputs, the package entry and script for this capture, and a test timeout annotation—no `apps/` or `packages/` runtime source. Therefore the retained wall-clock soak applies to the final runtime without pretending a synthetic rerun is equivalent.

## Visual inspection

The desktop, narrow, and Lantern Tide peak images were opened at original resolution. The normal renderer is the dominant surface. The evidence drawer is a deliberate temporary overlay for hashes, branch comparison, and the reality budget; it does not create document scroll and closes back to the simulation. Text, roads, routes, people, selection, and event state were legible. No P0 visual defect remained.

## Reproduction and limitations

Use the commands above on the reference profile. The browser matrix validates Chromium `151.0.7922.34`, WebKit `26.5`, and Pixel 7 Chromium emulation. Firefox was not installed and is not claimed. A usable WebGPU adapter was unavailable in the headless profile; Canvas is the authoritative measured path and preserves the complete journey. Results are local-profile evidence, not universal hardware claims. The world and people are fictional analytical manifestations, not a demographic, consciousness, or scientific model.

Networking, shared remote observation, servers beyond loopback tooling, deployment, cloud services, CI/Pages, containers, and paid/runtime AI services remain explicitly outside the local MVP.
