import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import {
  advanceWorldKernel,
  createWorldKernel,
  replayKernelHashes,
  restoreWorldKernel,
  serializeWorldKernel,
} from "../packages/sim/dist/checkpoint.js";

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))
  ];
}

const genesis = createWorldKernel();
const checkpoint = advanceWorldKernel(genesis, 13);
const bytes = serializeWorldKernel(checkpoint);
const saveSamples = [];
const loadSamples = [];
for (let sample = 0; sample < 9; sample += 1) {
  let started = performance.now();
  const encoded = serializeWorldKernel(checkpoint);
  saveSamples.push(performance.now() - started);
  started = performance.now();
  const restored = restoreWorldKernel(encoded);
  loadSamples.push(performance.now() - started);
  if (restored.kernelHash !== checkpoint.kernelHash)
    throw new Error("checkpoint restore diverged");
}

const replaySamples = [];
let replayHashes;
for (let sample = 0; sample < 7; sample += 1) {
  const started = performance.now();
  replayHashes = replayKernelHashes(genesis, 24);
  replaySamples.push((24 * 1_000) / (performance.now() - started));
}
if (!replayHashes) throw new Error("replay benchmark did not run");

globalThis.gc?.();
const heapBefore = process.memoryUsage().heapUsed;
const retained = restoreWorldKernel(bytes);
globalThis.gc?.();
const retainedHeapMiB =
  Math.max(0, process.memoryUsage().heapUsed - heapBefore) / 1_048_576;
if (retained.kernelHash !== checkpoint.kernelHash)
  throw new Error("retained restore diverged");

const metrics = {
  snapshotBytes: bytes.length,
  saveP50Ms: percentile(saveSamples, 0.5),
  saveP95Ms: percentile(saveSamples, 0.95),
  loadP50Ms: percentile(loadSamples, 0.5),
  loadP95Ms: percentile(loadSamples, 0.95),
  replayTicksPerSecondP50: percentile(replaySamples, 0.5),
  replayTicksPerSecondP95: percentile(replaySamples, 0.95),
  retainedHeapMiB,
};
const budgets = {
  snapshotBytesMax: 1_048_576,
  saveP95MsMax: 100,
  loadP95MsMax: 250,
  replayTicksPerSecondMin: 10,
  retainedHeapMiBMax: 32,
};
const failures = [];
if (metrics.snapshotBytes > budgets.snapshotBytesMax)
  failures.push("snapshotBytes");
if (metrics.saveP95Ms > budgets.saveP95MsMax) failures.push("saveP95Ms");
if (metrics.loadP95Ms > budgets.loadP95MsMax) failures.push("loadP95Ms");
if (metrics.replayTicksPerSecondP50 < budgets.replayTicksPerSecondMin)
  failures.push("replayTicksPerSecond");
if (metrics.retainedHeapMiB > budgets.retainedHeapMiBMax)
  failures.push("retainedHeapMiB");
if (failures.length > 0)
  throw new Error(`kernel budgets failed: ${failures.join(", ")}`);

const result = {
  schemaVersion: 1,
  benchmarkVersion: "world-kernel-v1",
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  seed: genesis.world.seed,
  worldHash: genesis.world.worldHash,
  eventHash: genesis.eventHash,
  initialKernelHash: genesis.kernelHash,
  checkpointTick: checkpoint.field.tick.toString(),
  checkpointKernelHash: checkpoint.kernelHash,
  fullDayHashes: replayHashes,
  finalKernelHash: replayHashes.at(-1),
  metrics,
  budgets: { ...budgets, passed: true },
};

await writeFile(
  "benchmarks/results/world-kernel.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result, null, 2));
