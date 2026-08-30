# Issue #3 local scaffold evidence

Validated revision: `d8de3f3` (`origin/main`) on 2026-08-30.

## Profile

- MacBook Pro (MacBookPro18,2), Apple M1 Max, 10 CPU cores, 32 GB memory
- macOS 26.5.2 (25F84), arm64
- Node.js 24.18.0 LTS, pnpm 11.24.0
- Playwright 1.62.1 bundled Chromium, desktop profile

## Test-first evidence

Before implementation, `pnpm test` failed because `apps/web/src/smoke.ts` did not exist. After the smallest smoke model and package seams were added, the focused test passed: one file, two tests. The test creates the same model twice, asserts seed/tick and exact `10_000_000_000n` fixture values, and never reads ambient time.

The first dependency install also rejected invalid `workspace:^` tool references; exact tool versions replaced them. `pnpm peers check` then reported no peer issues. Type checking initially caught both a widened package tuple and missing Node/disposable library types; the committed strict configuration resolves both without suppressions.

## Clean-checkout transcript

An isolated remote clone at revision `d8de3f3` was clean before and after validation. Commands followed `README.md` with a warm local tool/package/browser cache:

| Command                                  | Result                                                                                  | Elapsed |
| ---------------------------------------- | --------------------------------------------------------------------------------------- | ------: |
| `nvm install`                            | Node 24.18.0 selected                                                                   |  1.94 s |
| `corepack enable`                        | pass                                                                                    |  0.54 s |
| `corepack install --global pnpm@11.24.0` | pnpm 11.24.0 installed                                                                  |  0.10 s |
| `pnpm install --frozen-lockfile`         | 137 locked packages, no resolution change                                               |  0.91 s |
| `pnpm exec playwright install chromium`  | pass                                                                                    |  1.08 s |
| `pnpm check`                             | formatting, lint, five-package strict types, contract/unit tests, production build pass | 11.84 s |
| `pnpm test:e2e`                          | 1 Chromium production-preview smoke test passed                                         |  6.61 s |

Total timed setup/check/E2E work was 23.02 seconds with warm caches. The production build emitted 0.68 kB HTML, 4.33 kB CSS (1.82 kB gzip), and 3.76 kB JavaScript (1.52 kB gzip); the complete `apps/web/dist` directory occupied 16 KiB on disk.

Direct launch checks also passed from the clean clone:

- `pnpm dev --host 127.0.0.1 --port 5173` reported Vite ready in 112 ms; a loopback request returned the development HTML.
- `pnpm preview --host 127.0.0.1 --port 4173` served the hashed production assets; a loopback request returned HTTP-success HTML.
- The development and preview processes were intentionally stopped with SIGINT after successful requests.

## Browser and security evidence

- [`smoke-chromium.png`](smoke-chromium.png) is a full-page screenshot of the production preview at the desktop Chromium profile. Visual inspection confirmed readable hierarchy, exact represented-population text, seed/package diagnostics, honest M0 status, and actionable root-check guidance with no clipping.
- Playwright asserted the title, ready status, exact `10,000,000,000` text, deterministic seed, and failure guidance in the production build.
- `pnpm audit --prod --audit-level critical` reported `No known vulnerabilities found`.
- A repository scan found no server package, `.github`/CI workflow, Pages, container, or deployment directory.

The initial sandboxed browser attempt could not bind loopback (`EPERM`); the same command passed when explicitly allowed to launch the local preview and Chromium. This was an execution-sandbox restriction, not an application failure.
