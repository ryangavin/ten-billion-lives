/** Semantic fixed-point scale: six decimal places. */
export const FIXED_SCALE = 1_000_000n;
const U32_MAX = 0xffff_ffff;
const I32_MIN = -0x8000_0000;
const I32_MAX = 0x7fff_ffff;
const U64_MAX = 0xffff_ffff_ffff_ffffn;

function assertInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value))
    throw new RangeError(`${name} must be a safe integer`);
}

function assertU32(value: number, name: string): void {
  assertInteger(value, name);
  if (value < 0 || value > U32_MAX)
    throw new RangeError(`${name} must be a uint32`);
}

/** Semantic uint32 addition with explicit modulo-2^32 overflow. */
export function u32Add(left: number, right: number): number {
  assertU32(left, "left");
  assertU32(right, "right");
  return (left + right) >>> 0;
}

/** Semantic uint32 multiplication using the low 32 bits. */
export function u32Mul(left: number, right: number): number {
  assertU32(left, "left");
  assertU32(right, "right");
  return Math.imul(left, right) >>> 0;
}

export function saturatingI32Add(left: number, right: number): number {
  assertInteger(left, "left");
  assertInteger(right, "right");
  return Math.max(I32_MIN, Math.min(I32_MAX, left + right));
}

/** Multiplies two signed fixed-point values and rounds toward zero. */
export function fixedMul(left: bigint, right: bigint): bigint {
  return (left * right) / FIXED_SCALE;
}

export interface U64Words {
  readonly high: number;
  readonly low: number;
}

export function splitU64(value: bigint): U64Words {
  if (value < 0n || value > U64_MAX) throw new RangeError("u64 out of range");
  return Object.freeze({
    high: Number((value >> 32n) & 0xffff_ffffn),
    low: Number(value & 0xffff_ffffn),
  });
}

export function joinU64(high: number, low: number): bigint {
  assertU32(high, "high");
  assertU32(low, "low");
  return (BigInt(high) << 32n) | BigInt(low);
}

/** FNV-1a 64 is the frozen M1 non-cryptographic semantic checksum. */
export function fnv1a64(bytes: Uint8Array): bigint {
  let hash = 0xcbf2_9ce4_8422_2325n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x0000_0100_0000_01b3n);
  }
  return hash;
}

export class CanonicalWriter {
  readonly #bytes: number[] = [];

  constructor(domain: string, version: number) {
    if (domain.length === 0) throw new RangeError("domain must not be empty");
    if (!Number.isInteger(version) || version <= 0 || version > U32_MAX)
      throw new RangeError("version must be a positive uint32");
    this.text(domain).u32(version);
  }

  u32(value: number): this {
    assertInteger(value, "u32");
    if (value < 0 || value > U32_MAX) throw new RangeError("u32 out of range");
    for (let shift = 0; shift < 32; shift += 8)
      this.#bytes.push((value >>> shift) & 0xff);
    return this;
  }

  i32(value: number): this {
    assertInteger(value, "i32");
    if (value < I32_MIN || value > I32_MAX)
      throw new RangeError("i32 out of range");
    return this.u32(value >>> 0);
  }

  u64(value: bigint): this {
    if (value < 0n || value > U64_MAX) throw new RangeError("u64 out of range");
    for (let shift = 0n; shift < 64n; shift += 8n)
      this.#bytes.push(Number((value >> shift) & 0xffn));
    return this;
  }

  text(value: string): this {
    const bytes = new TextEncoder().encode(value);
    this.u32(bytes.length);
    this.#bytes.push(...bytes);
    return this;
  }

  bytes(): Uint8Array {
    return Uint8Array.from(this.#bytes);
  }

  hex(): string {
    return [...this.#bytes]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
}

/** Counter-based domain-separated deterministic random word. */
export function randomU32(
  domain: string,
  seed: bigint,
  counter: bigint,
): number {
  const hash = fnv1a64(
    new CanonicalWriter(domain, 1).u64(seed).u64(counter).bytes(),
  );
  return Number(hash & 0xffff_ffffn);
}

/** Exact largest-remainder apportionment; ties resolve by stable input index. */
export function largestRemainder(
  total: bigint,
  weights: readonly bigint[],
): bigint[] {
  if (total < 0n || weights.length === 0)
    throw new RangeError("invalid allocation shape");
  if (weights.some((weight) => weight < 0n))
    throw new RangeError("weights must be nonnegative");
  if (total === 0n) return weights.map(() => 0n);
  const normalized = weights.every((weight) => weight === 0n)
    ? weights.map(() => 1n)
    : [...weights];
  const weightTotal = normalized.reduce((sum, value) => sum + value, 0n);
  const allocation = normalized.map((weight) => (total * weight) / weightTotal);
  const remainders = normalized.map((weight, index) => ({
    index,
    value: (total * weight) % weightTotal,
  }));
  let remaining = total - allocation.reduce((sum, value) => sum + value, 0n);
  remainders.sort((left, right) =>
    left.value === right.value
      ? left.index - right.index
      : left.value > right.value
        ? -1
        : 1,
  );
  for (let index = 0; remaining > 0n; index += 1, remaining -= 1n) {
    const remainder = remainders[index];
    if (remainder === undefined)
      throw new Error("allocation remainder invariant failed");
    allocation[remainder.index] = (allocation[remainder.index] ?? 0n) + 1n;
  }
  return allocation;
}

/** Stable keyed permutation. Output is a bijection over [0,size). */
export function stablePermutation(
  size: number,
  domain: string,
  seed: bigint,
): number[] {
  assertInteger(size, "size");
  if (size < 0 || size > U32_MAX) throw new RangeError("size out of range");
  return Array.from({ length: size }, (_, index) => index).sort(
    (left, right) => {
      const leftKey = randomU32(domain, seed, BigInt(left));
      const rightKey = randomU32(domain, seed, BigInt(right));
      return leftKey === rightKey ? left - right : leftKey - rightKey;
    },
  );
}

export function tickToMinuteOfDay(tick: bigint, ticksPerDay: bigint): number {
  if (
    tick < 0n ||
    ticksPerDay <= 0n ||
    ticksPerDay > BigInt(Number.MAX_SAFE_INTEGER)
  )
    throw new RangeError("invalid tick epoch");
  return Number(tick % ticksPerDay);
}

export class DeterministicClock {
  #tick: bigint;

  constructor(initialTick = 0n) {
    if (initialTick < 0n)
      throw new RangeError("initial tick must be nonnegative");
    this.#tick = initialTick;
  }

  now(): bigint {
    return this.#tick;
  }

  advance(delta: bigint): bigint {
    if (delta < 0n) throw new RangeError("clock delta must be nonnegative");
    this.#tick += delta;
    return this.#tick;
  }
}

/** Canonical digest of the public primitive vectors, shared by Node and browsers. */
export function deterministicVectorHash(): string {
  const allocation = largestRemainder(1_000_000_000_000n, [1n, 1n, 1n]);
  const writer = new CanonicalWriter("deterministic-vectors", 1)
    .u32(u32Add(U32_MAX, 2))
    .u32(u32Mul(U32_MAX, 2))
    .i32(saturatingI32Add(I32_MAX, 1))
    .u64(fnv1a64(new TextEncoder().encode("hello")))
    .u32(randomU32("simulation", 42n, 7n));
  for (const value of allocation) writer.u64(value);
  return fnv1a64(writer.bytes()).toString(16).padStart(16, "0");
}
