import { describe, expect, it } from "vitest";

import {
  CanonicalWriter,
  FIXED_SCALE,
  deterministicVectorHash,
  fixedMul,
  fnv1a64,
  largestRemainder,
  randomU32,
  saturatingI32Add,
  stablePermutation,
  tickToMinuteOfDay,
  u32Add,
  u32Mul,
} from "./deterministic";

describe("deterministic primitive golden vectors", () => {
  it("defines integer overflow and fixed-point behavior", () => {
    expect(u32Add(0xffff_ffff, 2)).toBe(1);
    expect(u32Mul(0xffff_ffff, 2)).toBe(0xffff_fffe);
    expect(saturatingI32Add(0x7fff_ffff, 1)).toBe(0x7fff_ffff);
    expect(saturatingI32Add(-0x8000_0000, -1)).toBe(-0x8000_0000);
    expect(fixedMul(1_500_000n, 2_250_000n)).toBe(3_375_000n);
    expect(FIXED_SCALE).toBe(1_000_000n);
  });

  it("matches published FNV-1a 64 vectors and canonical little-endian bytes", () => {
    expect(fnv1a64(new Uint8Array())).toBe(0xcbf2_9ce4_8422_2325n);
    expect(fnv1a64(new TextEncoder().encode("hello"))).toBe(
      0xa430_d846_80aa_bd0bn,
    );
    expect(
      new CanonicalWriter("golden", 1)
        .u32(0x1234_5678)
        .i32(-2)
        .u64(1_000_000_000_000n)
        .text("A")
        .hex(),
    ).toBe(
      "06000000676f6c64656e0100000078563412feffffff0010a5d4e80000000100000041",
    );
  });

  it("separates named random domains", () => {
    const simulation = randomU32("simulation", 42n, 7n);
    expect(simulation).toBe(randomU32("simulation", 42n, 7n));
    expect(randomU32("visual", 42n, 7n)).not.toBe(simulation);
  });

  it("freezes the cross-runtime primitive vector digest", () => {
    expect(deterministicVectorHash()).toBe("050e18e9f2d20dff");
  });
});

describe("deterministic primitive properties", () => {
  it("conserves allocation totals through zero and trillion scale", () => {
    expect(largestRemainder(0n, [0n, 0n])).toEqual([0n, 0n]);
    expect(largestRemainder(10n, [1n, 1n, 1n])).toEqual([4n, 3n, 3n]);
    const trillion = largestRemainder(1_000_000_000_000n, [1n, 1n, 1n]);
    expect(trillion).toEqual([
      333_333_333_334n,
      333_333_333_333n,
      333_333_333_333n,
    ]);

    for (let size = 1; size <= 32; size += 1) {
      const weights = Array.from({ length: size }, (_, index) =>
        BigInt((index * 17) % 23),
      );
      const allocation = largestRemainder(
        10_000_000_000n + BigInt(size),
        weights,
      );
      expect(allocation.reduce((sum, value) => sum + value, 0n)).toBe(
        10_000_000_000n + BigInt(size),
      );
      expect(allocation.every((value) => value >= 0n)).toBe(true);
    }
  });

  it("produces repeatable permutation bijections", () => {
    for (let size = 0; size <= 128; size += 1) {
      const first = stablePermutation(size, "relationships", 99n);
      const second = stablePermutation(size, "relationships", 99n);
      expect(first).toEqual(second);
      expect([...first].sort((left, right) => left - right)).toEqual(
        Array.from({ length: size }, (_, index) => index),
      );
    }
  });

  it("uses explicit tick epochs and rejects malformed state", () => {
    expect(tickToMinuteOfDay(0n, 1_440n)).toBe(0);
    expect(tickToMinuteOfDay(1_441n, 1_440n)).toBe(1);
    expect(() => tickToMinuteOfDay(-1n, 1_440n)).toThrow(RangeError);
    expect(() => largestRemainder(1n, [])).toThrow(RangeError);
    expect(() => largestRemainder(1n, [-1n])).toThrow(RangeError);
    expect(() => new CanonicalWriter("", 1)).toThrow(RangeError);
    expect(() => new CanonicalWriter("x", 0)).toThrow(RangeError);
    expect(() => new CanonicalWriter("x", 1).u64(-1n)).toThrow(RangeError);
  });
});
