# Issue #22 evidence

Revision `6dfab11` passed the local performance and adaptive-quality criteria on the committed Apple M1 Max / 32 GiB / Chromium 151 profile.

## Results

- `pnpm benchmark:soak`: 30.001 wall-clock minutes, 1,800 Canvas frames, 105.35 MiB peak heap, 49.35 MiB retained growth, and no responsiveness collapse.
- Baseline: 250,000 street manifestations at 1.87 ms p95 over the wall-clock run, below the 16.67 ms / 60 FPS budget.
- Showcase: 1,000,000 street manifestations at 5.59 ms p95 over 30 measured frames, below its 33.33 ms / 30 FPS budget. This is the largest stable tested count, not a default quality claim.
- Startup: 1.06 s fallback and 1.05 s baseline, below 5 s.
- Product journey: 1.71 s planet-to-person, 252 ms follow-query p95, 92 ms second observer, 968 ms fresh link, and 82.40 MiB heap.
- Semantic quality comparison: fallback and baseline reproduced person `person_27yi09s_1obkbba`, state `b2007dbd631d0474`, manifestation `0b21e681edada68a`, event `b0bd84480511f52f`, and the same itinerary in both independent observers.
- Automated validation: root check passed 15 files / 76 tests; Playwright passed 16/16 across Chromium and WebKit.

## Artifacts

- `before-after.json`: same-profile renderer comparison and the allocation failure that triggered optimization.
- `soak-trace.json` and `soak-graph.svg`: 30 unforced operational heap/frame samples.
- `quality-fallback.png` and `quality-baseline.png`: inspected 25,000 versus 250,000 street-tier output.
- `soak-final.png`: inspected final person surface after the uninterrupted wall-clock run.
- `playwright-summary.json`: per-browser production journey results.
- `benchmarks/results/adaptive-quality.json`: machine-readable budgets, semantic comparison, startup, showcase, and wall-clock soak result.
- `benchmarks/results/local-baseline.json`, `multi-lod-renderer.json`, and `person-experience.json`: repository regression, canonical renderer, and complete product-journey archives.

The Canvas fallback is authoritative only for presentation. Quality changes never enter world state, person identity, manifestation, or event hashes.
