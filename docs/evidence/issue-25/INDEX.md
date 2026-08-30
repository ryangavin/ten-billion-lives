# Issue #25 local QA evidence index

Evidence schema: **local-mvp-qa-v1**. Product and QA revision: `551f0b008c2d83a3c0d7451c9b16b80edcc38b35`; the following revision, `ed917c4`, only adds the distinct canonical-person screenshot capture. Every command below ran locally against a production build. The index deliberately contains no server, network protocol, CI, Pages, container, deployment, or cloud acceptance.

## Gate result

| Required lane                                  | Result | Objective evidence                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean install, root check, build, and launch   | Pass   | [`clean-checkout.json`](clean-checkout.json): remote clone at `551f0b0`, frozen install, 15 files / 76 tests, production build, HTTP 200 preview, clean resulting worktree                                                                                                                            |
| Exact baseline population                      | Pass   | Clean preview reports `10,000,000,000`; [`benchmark-summary.json`](benchmark-summary.json) independently reports represented/resident/present totals of `10000000000`, conservation valid, and zero retained person rows                                                                              |
| Complete production journey                    | Pass   | Clean preview completes planet → Brindle Bay → Harbor Street → person in 1,743.10 ms; [`playwright-summary.json`](playwright-summary.json) contains the complete Chromium and WebKit journeys                                                                                                         |
| Golden hashes and independent replay           | Pass   | [`deterministic-replay.json`](deterministic-replay.json): four canonical vectors generated in separate processes twice and compared byte-for-byte; [`benchmark-summary.json`](benchmark-summary.json) retains simulation, field, kernel/snapshot, person, itinerary, manifestation, and event goldens |
| Two independent local observers                | Pass   | Clean preview reports identical person, manifestation, and event values plus `Semantic match`; [`festival-two-observers.png`](festival-two-observers.png) exposes both independently initialized panes at tick 19                                                                                     |
| Browser, fallback, and accessibility           | Pass   | [`playwright-summary.json`](playwright-summary.json): 24/24 applicable cases, 0 unexpected, 0 flaky; Chromium 13, WebKit 10, mobile Chromium 1; [`test-disposition.json`](test-disposition.json) explains all 10 project-specific skips                                                               |
| Performance and long session                   | Pass   | [`benchmark-summary.json`](benchmark-summary.json): all subsystem budgets pass on the committed M1 Max profile; [`benchmark-commands.json`](benchmark-commands.json): all 12 commands pass and links the uninterrupted 1,800,068.88 ms soak                                                           |
| Canonical visual and error states              | Pass   | [`visual-manifest.json`](visual-manifest.json) records dimensions and SHA-256 for loading, globe, region, street, person, festival/two-observer, field, branch, narrow, empty, and error states plus two inspected videos                                                                             |
| Exploratory contradictions and product framing | Pass   | [`exploratory-audit.json`](exploratory-audit.json) maps each manual challenge to an inspectable artifact and automated invariant                                                                                                                                                                      |
| Dependency and browser security                | Pass   | Clean checkout records zero audit advisories; Chromium security test records only local-origin requests, secure localhost context, restrictive CSP, and no console errors                                                                                                                             |
| Defect disposition                             | Pass   | [`defect-disposition.json`](defect-disposition.json): no unresolved local P0 defect; the one discovered QA harness defect was reproduced and fixed at `551f0b0`                                                                                                                                       |
| Failure reproduction                           | Pass   | [`reproduction.json`](reproduction.json) freezes seed, ticks, URLs, commands, browser versions, hashes, and retained-on-failure behavior                                                                                                                                                              |

## Golden contract

| Semantic value                | Golden                          |
| ----------------------------- | ------------------------------- |
| Baseline seed                 | `ten-billion-lives/baseline/v1` |
| Represented population        | `10000000000`                   |
| World hash                    | `ed66e344fcd7e737`              |
| Initial field hash            | `4e04868f72dfe574`              |
| Initial kernel/snapshot state | `f999e3b156e1c63b`              |
| Tick-13 checkpoint restore    | `74410bddf69993e9`              |
| Tick-24 replay result         | `6e190d289164581d`              |
| Canonical world event hash    | `ec998bbac0999abc`              |
| Street manifestation hash     | `b7d8ef2246775f8b`              |
| Street event hash             | `b0bd84480511f52f`              |
| Person semantic hash          | `036aeda537b40d7e`              |

The deterministic transcript SHA-256 values are `6255989f…` (world), `85e3565a…` (projection), `56622fb3…` (person), and `a10d12c3…` (itinerary); full values are in [`deterministic-replay.json`](deterministic-replay.json).

## Commands

```sh
pnpm qa:clean
pnpm qa:replay
node scripts/capture-playwright-summary.mjs docs/evidence/issue-25
pnpm qa:benchmarks
pnpm qa:visual
pnpm check
```

The clean-checkout command itself performs `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm audit --audit-level high --json`, launches `pnpm preview`, and drives the signature journey. Retained failure traces and screenshots use the Playwright configuration documented in [`reproduction.json`](reproduction.json).

## Review conclusion

A reviewer can fail this gate by finding any `passed: false`, unexpected/flaky browser result, unequal replay transcript, failed budget, external browser request, unresolved P0 defect, absent canonical visual, or unexplained skip in the linked machine-readable files. None is present in this evidence set. The complete retained result is **pass**.
