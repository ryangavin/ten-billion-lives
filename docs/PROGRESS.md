# Progress

- Current issue: #13 — WebGPU globe-to-street renderer with graceful fallback.
- Last green commit: `3000af5` (#13 deterministic multi-LOD buffers, culling plan, capability selection, and lifecycle tests).
- Evidence produced: #13's production renderer passes 8/8 Chromium/WebKit journeys across planet/region/street/person; forced Canvas, resize, reduced-motion, and simulated loss recovery stay navigable with stable selection. The enforced 1280×720 baseline draws 250,000 visible manifestations at 2.31 ms p50 / 4.78 ms p95 with 73.05 MiB heap; five inspected LOD/recovery screenshots and the benchmark scene are retained. Headless Chromium exposes WebGPU but no adapter, so the measured backend is Canvas; the compiled WebGPU storage-buffer/indirect-draw path is capability gated.
- Next action: commit/push the root-green renderer/browser/benchmark evidence, then audit every live #13 criterion before closure.
- Decisions: keep simulation authority outside rendering; render-owned typed arrays are derived only from semantic hashes and selection; select WebGPU only after successful navigator/adapter/context checks; keep a separate Canvas surface ready for recovery; treat 250k as the measured baseline and 1M as optional only if profiling supports it.
- Blockers: none. Server deployment is outside the local-MVP goal.
