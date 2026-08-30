import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import {
  FIELD_TICKS_PER_DAY,
  createFieldState,
  invariantReport,
  stepFieldState,
} from "../packages/sim/dist/fields.js";
import {
  BASELINE_WORLD_SEED,
  generateWorld,
} from "../packages/sim/dist/world.js";

const world = generateWorld(BASELINE_WORLD_SEED);
const initial = createFieldState(world);
const days = 3;
const ticks = FIELD_TICKS_PER_DAY * days;
const throughputSamples = [];
for (let sample = 0; sample < 7; sample += 1) {
  const started = performance.now();
  const final = stepFieldState(initial, ticks);
  const elapsed = performance.now() - started;
  if (!invariantReport(final).valid)
    throw new Error("field benchmark invariant failed");
  throughputSamples.push((initial.cells.length * ticks * 1_000) / elapsed);
}
throughputSamples.sort((left, right) => left - right);

function dailyHashes() {
  let state = initial;
  const hashes = [];
  for (let day = 0; day < days; day += 1) {
    state = stepFieldState(state, FIELD_TICKS_PER_DAY);
    hashes.push(state.stateHash);
  }
  return { state, hashes };
}

const firstReplay = dailyHashes();
const secondReplay = dailyHashes();
if (JSON.stringify(firstReplay.hashes) !== JSON.stringify(secondReplay.hashes))
  throw new Error("field replay hashes diverged");

globalThis.gc?.();
const heapBefore = process.memoryUsage().heapUsed;
const retained = createFieldState(world);
globalThis.gc?.();
const retainedHeapMiB =
  Math.max(0, process.memoryUsage().heapUsed - heapBefore) / 1_048_576;
if (retained.stateHash !== initial.stateHash)
  throw new Error("initial field hash diverged");

const result = {
  schemaVersion: 1,
  benchmarkVersion: "field-simulation-v1",
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  seed: initial.seed,
  initialStateHash: initial.stateHash,
  dailyStateHashes: firstReplay.hashes,
  finalStateHash: firstReplay.state.stateHash,
  workload: {
    samples: throughputSamples.length,
    cells: initial.cells.length,
    ticks,
    days,
    ticksPerDay: FIELD_TICKS_PER_DAY,
    representedPopulation: initial.totalPopulation.toString(),
  },
  metrics: {
    cellTicksPerSecondP50:
      throughputSamples[Math.floor(throughputSamples.length * 0.5)],
    cellTicksPerSecondP95:
      throughputSamples[Math.floor(throughputSamples.length * 0.95)],
    retainedHeapMiB,
  },
  invariantReport: {
    valid: invariantReport(firstReplay.state).valid,
    issues: invariantReport(firstReplay.state).issues,
    residentPopulation: invariantReport(
      firstReplay.state,
    ).residentPopulation.toString(),
    presentPopulation: invariantReport(
      firstReplay.state,
    ).presentPopulation.toString(),
  },
};

await writeFile(
  "benchmarks/results/field-simulation.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result, null, 2));
