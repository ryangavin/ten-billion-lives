# Issue 16 evidence — M2 complete local vertical slice

## Clean-checkout gate

The gate began from a fresh `origin/main` clone at
`c098ae652bb3c9d1fde08a74fb11aa44b1a81b60`. The checkout was clean before
validation. The exact setup and root validation commands were:

```sh
git clone --branch main --single-branch \
  https://github.com/ryangavin/ten-billion-lives.git /private/tmp/tbl-m2-gate.tbyzNx/repo
cd /private/tmp/tbl-m2-gate.tbyzNx/repo
source /Users/ryan/.nvm/nvm.sh
nvm use 24.18.0
pnpm install --frozen-lockfile
pnpm check
pnpm test:e2e
pnpm benchmark
```

The frozen install completed with pnpm 11.24.0. `pnpm check` passed formatting,
lint, all workspace type checks, contract checks, 15 unit files / 73 tests, and
the production Vite build. The production bundle was 89.80 kB JavaScript
(28.74 kB gzip) and 12.65 kB CSS (3.75 kB gzip).

## Uninterrupted acceptance journey

`pnpm gate:m2:capture` builds the production app, launches the local preview,
and executes one continuous Chromium session. It fails unless the journey:

1. starts at exactly 10,000,000,000 represented lives;
2. proves an orbit changes no state, manifestation, or event hash;
3. inspects the conserved field, reopened mobility edge, daily rhythm, and
   100,000-person Lantern Confluence peak;
4. traverses planet → settlement → street → person using only keyboard focus
   and Enter;
5. verifies Dara Grove's stable person and household IDs and follows transit,
   leisure, sleep, and work states;
6. initializes a second illusion engine and compares person, manifestation, and
   event semantics exactly;
7. leaves the region, returns to the person, and preserves the manifestation
   hash, then rewinds to `trace-5182c8d2`;
8. reveals the authoritative field/reality budget;
9. follows a festival visitor through peak and a 16-edge return; and
10. compares the immutable one-edge baseline with the 31-edge closure detour
    while the population field remains identical.

The retained uninterrupted recording is
[`m2-acceptance.webm`](m2-acceptance.webm): VP8, 1440×1000, 25 fps, 12.12 seconds,
SHA-256 `c426de25aba25b492ac22880eb7182d4bebf635004638d0a99a2ec9c6f30c826`.
The final full-page frame is retained in
[`m2-acceptance-final.png`](m2-acceptance-final.png), SHA-256
`00f3982f03f24efab8fa6898103ef634b5672814165e0007b1aa3c312402dbfd`.
The frame and recording samples at 2, 6, and 10 seconds were inspected at
original resolution: controls, focus rings, charts, truthful copy, two-observer
cards, field budget, and branch comparison were legible with no visible layout
collision or identity popping.

## Determinism and semantic hashes

`pnpm gate:m2:replay` launches each canonical vector in two independent Node
processes and compares the complete JSON output byte-for-byte. All four pairs
matched:

| Vector     |  Bytes | SHA-256                                                            |
| ---------- | -----: | ------------------------------------------------------------------ |
| World      |  1,536 | `6255989f9c23bc2ff0c5b9c30617f1b7fa396000cc142c679b908d5946a85b05` |
| Projection |  3,556 | `85e3565a45b0672e39dd778f68d4155418d5c022e87de44ee65d5ba48132122b` |
| Person     |    900 | `56622fb390119eadff050711929e057f9574577a8ae0878705b97462c49aabc3` |
| Itinerary  | 40,442 | `a10d12c3c6ef6ae9961f2a04d41f63ee80a9f9cdd6d2216f1448a8adf492fc92` |

The machine-readable result is
[`deterministic-replay.json`](deterministic-replay.json). Recorded semantic
hashes are:

- world `ed66e344fcd7e737`;
- initial field `4e04868f72dfe574`;
- baseline event log `ec998bbac0999abc`;
- initial/final kernel `f999e3b156e1c63b` / `6e190d289164581d`;
- street manifestation `b7d8ef2246775f8b` and projection events
  `b0bd84480511f52f`;
- selected-person manifestation `0b21e681edada68a`; and
- closure-person event hash `1e16e91d275330e3`.

The browser-level transcript, including camera invariance and Observer A/B
equality, is [`hash-transcript.json`](hash-transcript.json).

## Browser, accessibility, and visual checks

`pnpm gate:m2:playwright` ran the production server and retained
[`playwright-summary.json`](playwright-summary.json). All 12 journeys passed
without retries or flakes: 6/6 in Chromium 151 and 6/6 in WebKit 26.5. The
suite covers exact baseline totals, debug geography, conservative fields,
transport, checkpoint restoration, the complete person journey, two observers,
fresh deep links, invalid-link recovery, festival and branch semantics, Canvas
fallback, context loss, 390×844 layout, and reduced motion.

[`accessibility-smoke.json`](accessibility-smoke.json) records a passing
WCAG-oriented local smoke: English document language, one main landmark, one
top-level heading, no duplicate IDs, named interactive controls, labelled form
input and canvases, no horizontal overflow at 1440 px, and the keyboard-only
signature journey. Native controls and visible focus states were also inspected
in the recording. This is a scoped smoke, not a claim of formal WCAG
certification.

## Performance and memory

The clean clone ran every committed benchmark and `benchmark:check`. The full
machine-readable summary is
[`benchmark-summary.json`](benchmark-summary.json); every budget passed on the
committed Apple M1 Max / 32 GiB / Chromium profile.

| Measurement                        |          Actual |       Budget |
| ---------------------------------- | --------------: | -----------: |
| Planetary day p95                  |       146.96 ms |     ≤ 500 ms |
| Kernel replay                      | 48.55 ticks/sec | ≥ 10 ticks/s |
| Street projection p95              |       217.47 ms |     ≤ 500 ms |
| Independent observer pair          |       493.26 ms |   ≤ 1,000 ms |
| Identity retention                 |           87.5% |      ≥ 87.5% |
| Canvas fallback frame p95          |         4.43 ms |   ≤ 16.67 ms |
| Renderer browser memory            |       77.63 MiB |    ≤ 256 MiB |
| Planet-to-person journey           |     1,965.13 ms |   ≤ 5,000 ms |
| Follow transition p95              |       284.61 ms |   ≤ 1,500 ms |
| Person experience browser heap     |       82.40 MiB |    ≤ 128 MiB |
| Retained authoritative person rows |               0 |            0 |

The exact resident and present population remained 10,000,000,000 throughout
the benchmark matrix.

## Milestone audit

Issues #11, #12, #13, #14, and #15 are closed with their issue-scoped evidence.
The open `priority:p0` audit found only this gate and planned M3 local work
(#21, #22, #23, #25, #26, and #27); it found no open `type:defect` issue and no
unresolved M2 local-experience defect. No server, networking, CI, deployment,
container, cloud, or runtime LLM scope was added.
