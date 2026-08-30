import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import {
  BASELINE_WORLD_SEED,
  WORLD_POPULATION,
  generateWorld,
} from "../packages/sim/dist/world.js";

const samples = [];
for (let sample = 0; sample < 9; sample += 1) {
  const started = performance.now();
  const world = generateWorld(BASELINE_WORLD_SEED);
  samples.push(performance.now() - started);
  if (world.totalPopulation !== WORLD_POPULATION)
    throw new Error("world population did not conserve exactly");
}
samples.sort((left, right) => left - right);

globalThis.gc?.();
const heapBefore = process.memoryUsage().heapUsed;
const retainedWorld = generateWorld(BASELINE_WORLD_SEED);
globalThis.gc?.();
const retainedHeapMiB =
  Math.max(0, process.memoryUsage().heapUsed - heapBefore) / 1_048_576;
const semanticBytes = Buffer.byteLength(
  JSON.stringify(retainedWorld, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  ),
);

const result = {
  schemaVersion: 1,
  benchmarkVersion: "world-generation-v1",
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  seed: BASELINE_WORLD_SEED,
  worldHash: retainedWorld.worldHash,
  totalPopulation: retainedWorld.totalPopulation.toString(),
  workload: {
    samples: samples.length,
    cells: retainedWorld.cells.length,
    regions: retainedWorld.regions.length,
    settlements: retainedWorld.settlements.length,
  },
  metrics: {
    generationP50Ms: samples[Math.floor(samples.length * 0.5)],
    generationP95Ms: samples[Math.floor(samples.length * 0.95)],
    retainedHeapMiB,
    semanticPayloadMiB: semanticBytes / 1_048_576,
  },
};

await writeFile(
  "benchmarks/results/world-generation.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result, null, 2));
