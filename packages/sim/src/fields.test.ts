import { describe, expect, it } from "vitest";

import { randomU32 } from "./deterministic";
import {
  FIELD_TICKS_PER_DAY,
  FieldSimulationRunner,
  createFieldState,
  createSmallFieldState,
  fieldPopulationAt,
  invariantReport,
  stepFieldState,
} from "./fields";
import { BASELINE_WORLD_SEED, generateWorld } from "./world";

describe("conservative activity fields", () => {
  it("conserves exactly ten billion residents and current presence across days and LODs", () => {
    const world = generateWorld(BASELINE_WORLD_SEED);
    const initial = createFieldState(world);
    const advanced = stepFieldState(initial, FIELD_TICKS_PER_DAY * 3);

    expect(initial.totalPopulation).toBe(10_000_000_000n);
    expect(advanced.totalPopulation).toBe(initial.totalPopulation);
    expect(invariantReport(advanced)).toEqual({
      valid: true,
      issues: [],
      residentPopulation: 10_000_000_000n,
      presentPopulation: 10_000_000_000n,
    });
    expect(
      fieldPopulationAt(world, advanced, "L0/0/0") +
        fieldPopulationAt(world, advanced, "L0/0/1"),
    ).toBe(10_000_000_000n);
    expect(
      advanced.cells.every(
        (cell) =>
          Object.values(cell.activities).every((count) => count >= 0n) &&
          Object.values(cell.cohorts).every((count) => count >= 0n),
      ),
    ).toBe(true);
  });

  it("records simultaneous fluxes in deterministic source order", () => {
    const initial = createSmallFieldState([101n, 7n, 0n, 13n], "small/flux/v1");
    const first = stepFieldState(initial);
    const second = stepFieldState(
      createSmallFieldState([101n, 7n, 0n, 13n], "small/flux/v1"),
    );

    expect(first).toEqual(second);
    expect(first.lastFluxes.map((flux) => flux.processingOrder)).toEqual(
      first.lastFluxes.map((_flux, index) => index),
    );
    expect(first.lastFluxes.every((flux) => flux.count > 0n)).toBe(true);
    expect(
      first.lastFluxes.every(
        (flux) => flux.remainderRule === "floor-quarter-transit",
      ),
    ).toBe(true);
    expect(invariantReport(first).valid).toBe(true);
  });

  it("makes accelerated batches identical to repeated observable single steps", () => {
    const initial = createSmallFieldState(
      [81n, 55n, 34n, 21n],
      "small/batch/v1",
    );
    const batched = stepFieldState(initial, 17);
    let repeated = initial;
    for (let step = 0; step < 17; step += 1)
      repeated = stepFieldState(repeated);
    expect(batched).toEqual(repeated);
  });

  it("applies sparse explicit influences without camera state", () => {
    const influence = {
      id: "festival/one",
      cellId: "small/1",
      communityBoostPermille: 400,
      startTick: 0n,
      endTick: 4n,
    } as const;
    const influenced = stepFieldState(
      createSmallFieldState([100n, 100n, 100n], "small/event/v1", [influence]),
    );
    const repeated = stepFieldState(
      createSmallFieldState([100n, 100n, 100n], "small/event/v1", [influence]),
    );
    const quiet = stepFieldState(
      createSmallFieldState([100n, 100n, 100n], "small/event/v1"),
    );

    expect(influenced.stateHash).toBe(repeated.stateHash);
    expect(influenced.activeCellIds).toEqual(["small/1"]);
    expect(influenced.cells[1]?.activities.community).toBeGreaterThan(
      quiet.cells[1]?.activities.community ?? 0n,
    );
  });

  it("pauses, single-steps, and accelerates only from a fake clock", () => {
    const runner = new FieldSimulationRunner(
      createSmallFieldState([10n, 20n], "small/clock/v1"),
    );
    runner.advanceFakeTicks(10);
    expect(runner.state.tick).toBe(0n);
    runner.singleStep();
    expect(runner.state.tick).toBe(1n);
    runner.setRate(4);
    runner.play();
    runner.advanceFakeTicks(3);
    expect(runner.state.tick).toBe(13n);
    runner.pause();
    runner.advanceFakeTicks(10);
    expect(runner.state.tick).toBe(13n);
  });

  it("holds conservation properties across deterministic randomized small worlds", () => {
    for (let sample = 0; sample < 64; sample += 1) {
      const populations = Array.from(
        { length: 2 + (sample % 11) },
        (_value, index) =>
          BigInt(
            randomU32("field-property", BigInt(sample + 1), BigInt(index)) %
              10_000,
          ),
      );
      const initial = createSmallFieldState(populations, `property/${sample}`);
      const advanced = stepFieldState(initial, 3 + (sample % 29));
      const report = invariantReport(advanced);
      expect(
        report.valid,
        `sample ${sample}: ${report.issues.join(", ")}`,
      ).toBe(true);
      expect(report.presentPopulation).toBe(
        populations.reduce((sum, value) => sum + value, 0n),
      );
    }
  });

  it("replays a stable multi-day baseline state-hash sequence", () => {
    const world = generateWorld(BASELINE_WORLD_SEED);
    let first = createFieldState(world);
    let second = createFieldState(world);
    const hashes: string[] = [];
    for (let day = 0; day < 3; day += 1) {
      first = stepFieldState(first, FIELD_TICKS_PER_DAY);
      second = stepFieldState(second, FIELD_TICKS_PER_DAY);
      hashes.push(first.stateHash);
      expect(second.stateHash).toBe(first.stateHash);
    }
    expect(hashes).toEqual([
      "8b66001d55773395",
      "e599987da2aabdca",
      "9af788b45cf049a6",
    ]);
  });
});
