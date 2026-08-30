# Progress

- Current issue: #13 — WebGPU globe-to-street renderer with graceful fallback.
- Last green commit: `c726897` (#12 production time scrubbing, two-observer visuals, and evidence; #12 closed).
- Evidence produced: #13's focused render suite now proves stable semantic selection across planet/region/street/person projections, deterministic owned buffers, a 250,000-visible baseline instanced/culling plan, immutable semantic inputs, strict WebGPU capability selection, resize/context-loss recovery, and zero-duration reduced-motion transitions.
- Next action: commit the green scene/lifecycle contract, then wire the production tracer to a real WebGPU attempt plus an optimized Canvas pixel-buffer fallback, capability/debug overlays, and resize/loss controls.
- Decisions: keep simulation authority outside rendering; render-owned typed arrays are derived only from semantic hashes and selection; select WebGPU only after successful navigator/adapter/context checks; keep a separate Canvas surface ready for recovery; treat 250k as the measured baseline and 1M as optional only if profiling supports it.
- Blockers: none. Server deployment is outside the local-MVP goal.
