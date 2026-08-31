# Autonomous living-city visualization goal

Copy the block below into a fresh Codex session. It is one durable objective with one verifiable local stopping condition. GitHub milestone **M4 — Living City** and issues #29–#37 are the source of truth; do not recreate or broaden them.

```text
/goal Build and validate the complete local Living City visualization for Ten Billion Lives in https://github.com/ryangavin/ten-billion-lives. Complete GitHub milestone “M4 — Living City” in dependency order, starting with issue #29 and ending with gate #37. Favor safe parallel execution only in the two explicitly independent waves below. Do not work on issue #28 or anything labeled phase:deferred. Do not add a server, networking, remote maps or tiles, remote runtime data, CI, GitHub Pages, containers, deployment, cloud services, production operations, a runtime LLM, or a paid API.

Do not stop until issue #37 is closed with objective evidence and its local stopping condition is demonstrably satisfied: a clean checkout installs and launches the production app with documented commands; Brindle Bay appears as a coherent, visually dominant 2.5D city/map with roads, sidewalks, crossings, buildings, public space, semantic destinations, and recognizable people walking continuously; presentation interpolates deterministically between the existing authoritative hourly ticks; a user can zoom, pick, and follow a person through commuting, meetings, Lantern Tide, and the closure comparison; two independent local observers reproduce the same semantic and trajectory values at the same explicit context; the exact ten-billion field model, replay, and camera-independent authority remain intact; visual, performance, memory, long-session, fallback, accessibility, touch, local-browser, and clean-checkout gates pass; and every release-blocking phase:visualization issue is closed with evidence.

Start by cloning or opening the repository. Read AGENTS.md completely, then README.md, docs/PROGRESS.md, issue #37, issue #29, and only the direct dependencies needed for the current issue. Inspect git status, current branch, remote main, milestone state, and open issue state before changing anything. GitHub issues and their acceptance criteria are authoritative; this goal supplies execution order and stopping discipline, not replacement scope.

Dependency and parallel work order:

1. Complete #29 first and serially. It freezes the living-city product, time, architecture, package, evidence, and benchmark contracts.
2. After #29 closes, execute the first independent wave with up to three parallel lanes:
   - #30: deterministic Brindle Bay geometry and pedestrian topology;
   - #31: deterministic sub-tick presentation time and pedestrian trajectories;
   - #32: literal-person renderer spike and measured density budgets.
3. Do not start #33 until #30, #31, and #32 are closed and locally revalidated together. #33 is the serial integration point for the city, walkers, semantic zoom, picking, and observers.
4. After #33 closes, execute the second independent wave with up to two parallel lanes:
   - #34: visible commuting, meetings, Lantern Tide, and closure storytelling;
   - #35: full-screen city UX, following, time controls, responsive interaction, and accessibility.
5. Do not start #36 until #34 and #35 are closed and integrated. Complete #36 serially for performance, adaptive quality, fallback, compatibility, accessibility, and the real 30-minute soak.
6. Complete #37 serially as an independent outer-loop audit. Prior issue closures are inputs, not substitutes for rerunning the full gate.

Parallel execution contract:

- This goal explicitly authorizes bounded parallel work only for waves #30/#31/#32 and #34/#35 after their prerequisite issue closes.
- Give each parallel worker exactly one issue and a clear deliverable. Use isolated worktree directories and issue branches; never let parallel workers edit the same checkout. Keep the root/main checkout as the integration authority.
- Before parallel work starts, record the frozen shared interfaces and likely touched paths in docs/PROGRESS.md and the relevant issues. If two lanes require the same implementation file, serialize that portion or assign ownership explicitly.
- Parallel workers must read AGENTS.md, their issue, and its direct dependency. They may not expand scope, close issues, push to main, or modify shared contracts independently.
- Integrate issue branches one at a time in dependency order. After each integration, run focused and affected checks in the root checkout, inspect visual output where applicable, then commit/push the green issue-scoped increment and close only that issue with evidence.
- If isolated worktree directories or safe merge boundaries are unavailable, fall back to sequential issue execution rather than risking shared-worktree corruption.

Execution contract:

1. Maintain docs/PROGRESS.md as a compact recovery and coordination log: active integration issue, parallel lanes and owners, worktree and branch, frozen interfaces, last green commit, evidence produced, next merge/action, decisions, and genuine blockers. At continuation start, read this file and the active issue rather than rereading the backlog.
2. Post a concise start comment before implementing each issue. Close an issue only when every checkbox has objective evidence. The closing comment must include commit(s), commands run, test results, benchmark values where relevant, and links to retained screenshots, recordings, traces, hashes, or audit artifacts.
3. Use the AGENTS.md inner loop for every coherent change: state the smallest falsifiable behavior; add/update the cheapest falsifying test; implement the smallest coherent change; run focused tests; run formatting/lint/types and affected integration/browser checks; inspect actual browser output for UI work; then commit a green, reviewable increment.
4. Preserve main as buildable. Push small issue-scoped commits without rewriting history. Never delete or overwrite user work. Resolve merge conflicts by preserving the frozen #29 interfaces and both issues’ tested behavior, then rerun affected checks.
5. Treat #29 as the contract gate, #33 as the integration gate, #36 as the hardening gate, and #37 as the final release gate. At each gate, post a compact status containing issues closed, objective evidence, measured budgets, open risks, and the next issue; then continue automatically.
6. Limit an unvalidated technical direction to 30 minutes or two failed attempts. Reduce to a minimal reproduction and consult primary documentation. After three failures with the same cause, record evidence, choose the simplest viable fallback, and continue other unblocked work. Do not loop on flaky tests or speculative optimization.
7. Profile before optimizing. #32 must measure literal-figure density, frame time, memory, upload/draw cost, picking, and resize behavior before freezing M4 budgets. Do not preserve the old 250,000-point showcase count if fewer recognizable figures communicate the city better. A new runtime dependency requires measured code/risk reduction and explicit issue evidence.
8. Keep tool output and context economical: targeted searches, relevant files only, focused tests before suites, capped logs, terminated hung processes, and bounded artifacts. Use subagents only for the explicitly parallel issue lanes or a separate bounded investigation, and validate all output locally before acceptance.
9. Make safe product and engineering decisions autonomously within issue criteria. Do not ask for ordinary implementation guidance. Never weaken tests, hide failures, mark an image that was not inspected as visually approved, or claim a browser/backend that was not executed.

Architecture and truth contract:

1. Keep the proven 24 analytical hourly ticks authoritative. Do not rewrite the kernel to 1,440 ticks during M4.
2. Represent continuous visual time as an explicit authoritative tick plus bounded presentation phase. A pure query derives route position, heading, and walking pose from seed/state/person/tick/phase/city inputs. Equal explicit inputs must produce equal outputs and a comparable trajectory hash.
3. A playback controller may translate an injected monotonic clock into explicit tick commands and presentation phase. Wall clock, frame timing, camera, renderer, interpolation, and animation never enter kernel state, snapshots, command/event hashes, manifestation hashes, or replay authority.
4. City geometry is a compact, seeded, readonly semantic projection using integer/fixed-point coordinates. Canonical place IDs map to visible destinations and connected pedestrian topology. It is not a real map, remote tile set, or new authoritative geography database.
5. The renderer consumes immutable city geometry, manifested tokens, and trajectory poses. It does not create identities, itineraries, encounters, events, destinations, or world commands.
6. Preserve authoritative integer/fixed-point fields, exact `10000000000` baseline total, pure camera-independent manifestation, deterministic replay, semantic equality between local observers, GPU non-authority, and zero ten-billion-person table.
7. Weighted crowd figures remain honest. Distant figures may represent multiple people; deterministic nested samples refine with zoom; a selected/pinned identity has weight one. Quality adaptation may reduce density/effects, never represented population or semantics.
8. Two local observers use independently initialized app instances with the same seed/snapshot/branch/tick/phase. Do not build a network protocol or remote synchronization service for the proof.
9. Canvas remains the guaranteed complete fallback. WebGPU may improve density and effects but cannot own required semantics or the only usable journey.

Visual and product target:

- Make the city/map the dominant experience rather than a small diagnostic panel.
- Use a 2.5D orthographic/tilted view that keeps city form and many walkers legible. Do not begin with photorealistic 3D, a first-person engine, or remote map technology.
- Figures at street scale must read as people through body silhouette, direction, stride, depth/scale, visual variation, and selection treatment—not single pixels or anonymous particles.
- Smoothly connect planet → city → neighborhood → street → person. Preserve selection and semantic identity across zoom/quality changes.
- Make existing truth visible: ordinary commuting, shared-place meetings, Lantern Tide convergence/peak/departure, closure detour versus baseline, exact population/reality budget, and deterministic rewind.
- Use explicit playback labels based on simulated minutes per real second, plus pause, seek/scrub, rewind/replay, and named signature moments. Reduced-motion mode retains complete control and textual understanding without continuous animation.
- Retain auditability, deep links, second-observer comparison, fallback status, error recovery, and field reveal, but keep diagnostics subordinate to first-time exploration.

Validation contract:

1. Determinism: golden city and trajectory hashes, property tests, direct-seek/playback convergence, sub-tick boundary continuity, two-process replay twice, camera/order independence, and two-observer equality at explicit tick/phase.
2. Conservation and honesty: exact represented/resident/present totals, weighted projection reconciliation at every LOD/quality, selected weight one, zero retained ten-billion-person table, and no renderer-authored semantics.
3. Visual evidence: inspect real production-browser screenshots and recordings for city overview, neighborhood, street walkers, selected/followed person, commute, meeting, festival arrival/peak/departure, closure comparison, second observer, field reveal, Canvas fallback, desktop, and narrow/touch layouts. Retain artifact hashes and disposition all visual defects.
4. Performance: same-profile before/after results, measured M4 budgets, production startup, frame percentiles, memory, upload/draw cost, picking, resize, zoom transition, observer initialization, and a real 30-minute interactive soak. Lower visual quality when needed, never semantic fidelity.
5. Browser/accessibility: applicable Chromium, WebKit, mobile emulation, Canvas fallback, context loss, background/resume, keyboard, touch, reduced motion, forced colors, 200% text, automated accessibility, structured textual alternative, deep-link/failure recovery, loopback-only requests, and zero unexpected console errors. Firefox is claimed only if installed and executed.
6. Documentation and scope: keep README, product/architecture/determinism/compatibility/benchmark/testing/limitations docs consistent; audit direct/runtime dependencies and tracked files; add no prohibited remote/deployment scope.
7. Run focused commands first and the documented root `pnpm check` before every issue closure. At #37, run the complete current local matrix from a fresh remote checkout and launch the production browser build with `pnpm start`.

Before declaring success, independently audit #37 rather than trusting prior issue evidence. Verify #29–#36 are closed, #37 is the only remaining open `priority:p0` + `phase:visualization` issue, and #28 remains untouched and deferred. From a fresh checkout, rerun install/check/build/launch, deterministic city and trajectory vectors, replay twice, the complete applicable browser/accessibility/fallback matrix, current benchmarks, and the committed real 30-minute soak. Launch the production app and record the exact living-city signature journey. Inspect the recording and canonical screenshots, resolve every P0 visual defect, audit scope/dependencies/claims, publish `docs/evidence/issue-37/INDEX.md`, close #37 with the evidence commit and exact commands/results, then verify zero open `priority:p0` + `phase:visualization` issues. Report the launch commands, visual outcome, deterministic hashes, benchmark/soak summary, browser/accessibility matrix, artifact paths, and honest non-blocking limitations.
```
