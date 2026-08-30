# Local quickstart and troubleshooting

This is the supported clean-checkout path for the local production MVP. It uses only loopback HTTP and local files. No account, API key, remote service, database, or server protocol is required.

## Clean checkout

Install Node.js 24.18.0 with `nvm`, activate the pinned pnpm 11.24.0 release, and install exactly the lockfile contents:

```sh
git clone https://github.com/ryangavin/ten-billion-lives.git
cd ten-billion-lives
nvm install
corepack enable
corepack install --global pnpm@11.24.0
pnpm install --frozen-lockfile
pnpm check
```

Install the locally tested browser engines if you intend to run browser checks:

```sh
pnpm exec playwright install chromium webkit
```

Launch the production build with one command:

```sh
pnpm start
```

Open the loopback URL printed by Vite, normally `http://127.0.0.1:4173`. If that port is occupied, Vite prints the next available local port. Stop the preview with Ctrl-C.

`pnpm start` is intentionally a production-build path. Use `pnpm dev` only for edit-time hot reload; passing development mode is not release evidence.

## Guided local demo

The signature journey takes about five minutes when read at a human pace:

1. On Planet, confirm the exact `10,000,000,000` represented total, baseline mode, paused time, and active render backend.
2. Try **Orbit camera** and observe that the tick and state hash do not change.
3. Enter **Brindle Bay**, then **Harbor Street**, then inspect the highlighted resident.
4. Read the person card: stable ID, household, recurring place, relationships, itinerary, field reconciliation, events, appearance, and semantic trace.
5. Select **Initialize observer B** and verify both panes report **Semantic match**.
6. Select **Visit Lantern Tide** and follow the festival arrival and departure.
7. Open the closure branch and compare its detoured route with the immutable baseline; population fields remain identical.
8. Select **Rewind and replay**, then **Reveal fields**. Confirm the replay result, exact population, zero stored person rows, checkpoint size, weighted token count, state/event hashes, and camera/GPU exclusion.
9. Copy or open the local person link. A fresh local view reconstructs the same person from the URL seed, tick, branch, person ID, stage, and location.

The experience is complete on Canvas. A successful WebGPU probe may improve projection performance but changes no semantics.

## Local checks

```sh
pnpm docs:check
pnpm check
pnpm test:e2e
pnpm replay:world
pnpm benchmark
```

See [Testing and evidence](TESTING.md) before regenerating retained artifacts, and [Benchmark methodology](BENCHMARKS.md) before comparing performance numbers.

## Troubleshooting

### Node, pnpm, install, or build failure

- Confirm `node --version` is `v24.18.0` and `pnpm --version` is `11.24.0`; the repository pins both versions.
- Run `pnpm install --frozen-lockfile`. A lockfile mismatch is a repository state problem; do not bypass it with an unpinned install.
- Run `pnpm check` and use the first failing phase: formatting/docs, lint, types, deterministic tests, or production build.
- If browser binaries are absent, run the documented Playwright install command above. Do not count a skipped browser as a pass.

### Local preview failure

- Wait for `pnpm start` to finish the package builds and print the preview URL.
- Open the exact printed `127.0.0.1` URL. The CSP intentionally permits only local assets and requests.
- If 4173 is occupied, use the alternate port Vite prints; do not assume the default URL.
- A blank or error screen should be paired with the terminal output from `pnpm check`. The production app also presents a visible recovery state for an incompatible local link.

### WebGPU or renderer failure

- WebGPU is optional. The header should say Canvas fallback is active when the adapter, device, or context is unavailable.
- Add `?renderer=canvas&quality=fallback` to the loopback URL to force the bounded 25,000-token path.
- Use **Simulate renderer loss** to verify recovery. Selection, person identity, state hash, manifestation hash, event hash, and observer agreement must remain unchanged.
- Reduced motion, forced colors, keyboard, touch, resize, and fallback expectations are documented in [Compatibility](COMPATIBILITY.md).

### Snapshot or replay failure

- Run `pnpm replay:world` twice. Both canonical transcripts must match the committed world, event, checkpoint, and tick-24 hashes.
- The reader rejects corrupt JSON, unsupported versions, malformed integers, wrong ordering, and hash mismatches. That is intentional fail-closed behavior.
- Full snapshots are generated locally rather than committed. The format and migration policy live in [Local world and replay formats](FORMATS.md).

### Browser test failure

- Reinstall the pinned Chromium/WebKit binaries with the Playwright command above.
- Ensure no unrelated process owns `127.0.0.1:4173`; the Playwright configuration deliberately refuses to reuse an existing server.
- The test configuration retains a trace and screenshot on failure. Record the project, test title, seed/tick URL, console output, trace, and screenshot before changing code.
- Firefox was unavailable on the validation machine and is not part of the passing matrix. The documented cross-engine proof is Chromium plus WebKit.

## Deferred boundary

Do not troubleshoot this local MVP by adding a remote host, WebSocket, database, container, cloud service, deployment configuration, or CI job. Networking and deployment remain separate deferred work after local validation.
