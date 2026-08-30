# Deterministic primitive contract

Issue #6 freezes the public semantic behavior exported by `packages/sim/src/deterministic.ts`.

- `u32Add` and `u32Mul` return the low unsigned 32 bits. Inputs must be safe integers.
- `saturatingI32Add` clamps to signed 32-bit bounds rather than wrapping.
- Fixed-point values are signed `bigint` with `FIXED_SCALE = 1_000_000n`; multiplication rounds toward zero.
- `CanonicalWriter` prefixes a non-empty UTF-8 domain and positive uint32 schema version, then writes explicitly requested signed/unsigned integers little-endian. Text is UTF-8 with a uint32 byte length. Out-of-range values throw `RangeError`.
- `fnv1a64` is the non-cryptographic semantic checksum. It is not a security primitive.
- `randomU32(domain, seed, counter)` is counter-based. Domains are required semantic inputs, so visual calls cannot advance or perturb simulation streams.
- `largestRemainder` conserves a nonnegative `bigint` total exactly. Equal remainders resolve by input index; an all-zero weight vector is treated as equal weights. Empty, negative-total, and negative-weight inputs throw.
- `stablePermutation` returns a deterministic bijection over `[0, size)` by domain-separated priorities and index tie-breaking. It favors clarity over asymptotic performance and is intended for bounded local assignment sets.
- `tickToMinuteOfDay` uses nonnegative integer ticks and an explicit positive epoch length; it never reads a wall clock.

The canonical cross-runtime digest is `050e18e9f2d20dff`. `pnpm vector:hash` emits it in a fresh Node process, and the production browser surface computes the same exported function. Chromium and WebKit Playwright projects assert this exact value. Changing it requires an intentional schema/version decision, new golden fixtures, and migration evidence rather than an incidental refactor.

Authoritative code must not replace these operations with locale formatting, ambient randomness, wall-clock time, unordered iteration, platform trigonometry, or GPU results. Performance artifacts are retained under `benchmarks/results`; correctness takes precedence over throughput.
