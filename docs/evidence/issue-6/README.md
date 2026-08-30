# Issue #6 deterministic foundation evidence

Implementation revision: `e081498`. Profile: Node.js 24.18.0, Playwright 1.62.1 Chromium 151 and WebKit 26.5 on the committed Apple M1 Max local profile.

## Test-first and golden evidence

The first focused run failed because `deterministic.ts` did not exist. After the primitive implementation, a second falsifier caught three missing edge behaviors: unsigned input rejection, explicit uint64 high/low words, and an injected fake clock. The final suite passes 6 files / 16 tests and includes:

- uint32 modulo arithmetic, signed int32 saturation, and six-decimal signed fixed point;
- published FNV-1a 64 vectors and byte-exact little-endian canonical encoding with domain/schema tags;
- repeatable named-domain counter streams with a distinct visual domain;
- exact largest-remainder totals at zero, 10 billion, and one trillion, stable ties, nonnegative bounds, and malformed weights;
- permutation repeatability and bijection for every size from 0 through 128;
- uint64 high/low round trips at zero, one trillion, and `2^64 - 1`;
- explicit tick epochs and a fake clock that advances only by injected deltas;
- malformed domain, version, integer, tick, total, weight, and clock inputs.

The frozen canonical digest is `050e18e9f2d20dff`. Two fresh Node processes emitted byte-identical values. The production app computes the same exported function, and Playwright asserted the exact digest in both Chromium and WebKit: 4/4 browser tests passed (golden smoke and tracer journey in each engine).

## Performance and API evidence

[`deterministic-primitives.json`](../../../benchmarks/results/deterministic-primitives.json) is versioned JSON from revision `e081498`, seed `benchmark/42`, seven samples of 100,000 domain-separated `randomU32` calls. It recorded 570,253 operations/s p50 and 574,419 operations/s p95 on the local profile. This is a characterization, not an optimization target; correctness remains primary.

[`docs/DETERMINISM.md`](../../DETERMINISM.md) documents every public semantic guarantee, failure rule, canonical digest, and prohibited ambient dependency. `pnpm check` passes formatting, lint, strict types, all tests, and the production build. No runtime dependency was added.
