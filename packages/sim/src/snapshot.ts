export const PLACEHOLDER_SEED = "ten-billion-lives/m0-tracer/v1" as const;
export const BASELINE_POPULATION = 10_000_000_000n;

export interface PopulationCell {
  readonly id: string;
  readonly population: bigint;
}

export interface LocalSnapshot {
  readonly snapshotSchemaVersion: 1;
  readonly kernelVersion: "m0-tracer-v1";
  readonly seed: typeof PLACEHOLDER_SEED;
  readonly branch: "baseline";
  readonly tick: number;
  readonly representedPopulation: typeof BASELINE_POPULATION;
  readonly cells: readonly PopulationCell[];
  readonly stateHash: "state-42f76c85";
}

export function createPlaceholderSnapshot(): LocalSnapshot {
  const cells = Object.freeze([
    Object.freeze({ id: "brindle-bay", population: 3_250_000_000n }),
    Object.freeze({ id: "morrow-plains", population: 3_500_000_000n }),
    Object.freeze({ id: "selene-isles", population: 3_250_000_000n }),
  ]);

  return Object.freeze({
    snapshotSchemaVersion: 1,
    kernelVersion: "m0-tracer-v1",
    seed: PLACEHOLDER_SEED,
    branch: "baseline",
    tick: 0,
    representedPopulation: BASELINE_POPULATION,
    cells,
    stateHash: "state-42f76c85",
  });
}

export function replayPlaceholder(
  snapshot: LocalSnapshot,
  targetTick: number,
): LocalSnapshot {
  if (targetTick !== 0 || snapshot.tick !== 0) {
    throw new RangeError(
      "The M0 tracer supports only its frozen tick-0 checkpoint",
    );
  }
  return createPlaceholderSnapshot();
}
