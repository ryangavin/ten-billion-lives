# Testing and evidence guide

Tests protect semantic truth; retained evidence shows the actual local product. A green screenshot cannot replace an invariant test, and a unit test cannot replace browser inspection.

## Local validation

Use the cheapest falsifier first, then expand:

```sh
pnpm docs:check
pnpm test
pnpm check
pnpm test:e2e
pnpm qa:replay
pnpm qa:benchmarks
pnpm benchmark:living-city-hardening
pnpm benchmark:living-city-soak
```

- `pnpm docs:check` spell-checks the maintained documentation and validates local links, heading fragments, shell snippets, diagram text alternatives, claim language, and the direct dependency inventory.
- `pnpm test` runs product/architecture contracts plus deterministic unit and property-style tests.
- `pnpm check` adds formatting, docs, lint, strict types, and the production build.
- `pnpm test:e2e` builds/launches the production preview and runs Chromium, WebKit, and the dedicated mobile Chromium cases.
- `pnpm qa:replay` generates each canonical vector twice in independent processes and compares the transcripts byte-for-byte.
- `pnpm qa:benchmarks` reruns the same-profile subsystem budgets and verifies the retained literal soak.
- `pnpm benchmark:living-city-hardening` measures the integrated production scene at 128/256/512 figures, including prepare, draw, pick, resize, semantics, and retained heap.
- `pnpm benchmark:living-city-soak` runs the literal 30-minute production interaction soak. Development diagnostics may shorten the per-minute interval explicitly, but only the default 60,000 ms interval satisfies the release criterion.

Focused tests live beside their implementation in `packages/*/src/*.test.ts` and `apps/web/src/*.test.ts`. Product browser tests live in [`tests/e2e`](../tests/e2e). Deterministic fixtures live under `packages/sim/fixtures` and `packages/manifest/fixtures`.

## Evidence workflow

GitHub issues and milestones are the source of truth. For one primary issue:

1. Post a concise start comment and state the smallest behavior under test.
2. Add the cheapest failing test or checker.
3. Implement the smallest coherent change.
4. Run focused checks, then `pnpm check`, then affected production-browser/benchmark checks.
5. Inspect user-facing output rather than trusting capture success alone.
6. Commit and push only a green, issue-scoped increment.
7. Retain compact machine-readable results plus only the screenshots, recordings, traces, or profiles needed to audit the acceptance criteria.
8. Close the issue with the commit, exact commands, results, and artifact links.

Evidence directories use `docs/evidence/issue-N`. Each gate index should distinguish automated facts, manual visual observations, expected skips, limitations, and failures. Never edit an output to hide a failure; rerun the producing command after fixing the cause.

## Reproducing failures

Record enough semantic context that another contributor can reproduce the failure:

- commit, Node/pnpm/browser versions, and hardware profile when performance matters;
- seed, schema, branch, tick, person/location ID, quality tier, and complete local URL;
- exact command and focused test title/project;
- expected and actual state, manifestation, event, checkpoint, or replay hashes;
- console output, retained Playwright trace/screenshot, and benchmark JSON when applicable.

Playwright retains traces and screenshots on failure. Browser tests use `reuseExistingServer: false` so a stale preview cannot be silently accepted. Browser and GPU pixels are diagnostic; semantic hashes are authoritative.

## Milestone gates

Issues #5, #10, #16, #27, #36, and #37 add the outer loop: clean checkout, full root suite, two independent replay runs, real-browser signature journey, same-profile performance/memory comparison, retained visual inspection, and local P0 defect review. The final #37 audit reruns the matrix independently rather than trusting earlier closures.

No local test requires a remote service. CI, deployment, server, networking, Pages, containers, and cloud operations are outside this guide.
