import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import {
  buildTransportGraph,
  createSignatureCommandLog,
  simulatePlanetaryDay,
} from "../packages/sim/dist/transport.js";
import {
  BASELINE_WORLD_SEED,
  generateWorld,
} from "../packages/sim/dist/world.js";

const world = generateWorld(BASELINE_WORLD_SEED);
const graph = buildTransportGraph(world);
const commands = createSignatureCommandLog(graph);
const samples = [];
let measuredDay;
for (let sample = 0; sample < 9; sample += 1) {
  const started = performance.now();
  measuredDay = simulatePlanetaryDay(world, commands);
  samples.push(performance.now() - started);
}
samples.sort((left, right) => left - right);
if (!measuredDay) throw new Error("planetary day benchmark did not run");
const repeatedDay = simulatePlanetaryDay(world, commands);
if (repeatedDay.dayHash !== measuredDay.dayHash)
  throw new Error("planetary day replay diverged");

const baselineDay = simulatePlanetaryDay(world, []);
const signatureEdgeId = commands[0]?.edgeId;
if (!signatureEdgeId) throw new Error("missing signature closure edge");
const signatureFlow = (day, tick) =>
  day.ticks[tick]?.edgeFlows
    .find((flow) => flow.edgeId === signatureEdgeId)
    ?.count.toString();

globalThis.gc?.();
const heapBefore = process.memoryUsage().heapUsed;
const retainedDay = simulatePlanetaryDay(world, commands);
globalThis.gc?.();
const retainedHeapMiB =
  Math.max(0, process.memoryUsage().heapUsed - heapBefore) / 1_048_576;
const p95 = samples[Math.floor(samples.length * 0.95)];
const representativeDayBudgetMs = 500;
if (p95 > representativeDayBudgetMs)
  throw new Error(
    `representative day exceeded ${representativeDayBudgetMs} ms: ${p95}`,
  );

const result = {
  schemaVersion: 1,
  benchmarkVersion: "planetary-day-v1",
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  seed: measuredDay.seed,
  graphHash: graph.graphHash,
  dayHash: measuredDay.dayHash,
  edgeFlowHashes: measuredDay.ticks.map((tick) => tick.edgeFlowHash),
  workload: {
    samples: samples.length,
    ticks: measuredDay.ticks.length,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    representedPopulation: world.totalPopulation.toString(),
  },
  budget: {
    representativeDayP95Ms: representativeDayBudgetMs,
    passed: true,
  },
  metrics: {
    representativeDayP50Ms: samples[Math.floor(samples.length * 0.5)],
    representativeDayP95Ms: p95,
    ticksPerSecondP50:
      (measuredDay.ticks.length * 1_000) /
      samples[Math.floor(samples.length * 0.5)],
    retainedHeapMiB,
  },
  festivalAttendance: measuredDay.ticks.map((tick) =>
    tick.festivalAttendance.toString(),
  ),
  intervention: {
    edgeId: signatureEdgeId,
    baselineTick7: signatureFlow(baselineDay, 7),
    closedTick7: signatureFlow(measuredDay, 7),
    closedTick8: signatureFlow(measuredDay, 8),
    reopenedTick9: signatureFlow(measuredDay, 9),
    baselineTick9: signatureFlow(baselineDay, 9),
  },
  invariantFailures: retainedDay.ticks.flatMap((tick) => tick.invariantIssues),
};

await writeFile(
  "benchmarks/results/planetary-day.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result, null, 2));
