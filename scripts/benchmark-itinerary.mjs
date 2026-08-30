import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { createServer } from "vite";

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))
  ];
}

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
try {
  const { createAnalyticalItineraryIndex } = await vite.ssrLoadModule(
    "/packages/manifest/src/itinerary.ts",
  );
  const { advanceWorldKernel, createWorldKernel } = await vite.ssrLoadModule(
    "/packages/sim/src/index.ts",
  );
  const genesis = createWorldKernel();
  const state = advanceWorldKernel(genesis, 10);
  const world = state.world;
  const maxCell = world.cells.reduce((largest, cell) =>
    cell.population > largest.population ? cell : largest,
  );

  const buildSamples = [];
  for (let sample = 0; sample < 9; sample += 1) {
    const started = performance.now();
    createAnalyticalItineraryIndex(world);
    buildSamples.push(performance.now() - started);
  }
  const itinerary = createAnalyticalItineraryIndex(world);
  const queryCount = 5_000;
  const ids = Array.from({ length: queryCount }, (_value, index) =>
    itinerary.manifestation.personIdAt(maxCell.id, BigInt(index * 7)),
  );
  const querySamples = [];
  let checksum = 0;
  for (let sample = 0; sample < 5; sample += 1) {
    const started = performance.now();
    for (const personId of ids) {
      const point = itinerary.queryPerson(personId, 10n, state);
      checksum ^= Number.parseInt(point.semanticHash.slice(-8), 16);
    }
    querySamples.push((queryCount * 1_000) / (performance.now() - started));
  }
  if (!Number.isInteger(checksum)) throw new Error("itinerary checksum failed");

  const bulkCount = 10_000;
  const bulkStarted = performance.now();
  for (let index = 0; index < bulkCount; index += 1)
    itinerary.queryPerson(
      itinerary.manifestation.personIdAt(maxCell.id, BigInt(index * 11)),
      10n,
      state,
      { lod: index % 2 === 0 ? "person" : "region" },
    );
  const bulkElapsed = performance.now() - bulkStarted;

  globalThis.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const retained = createAnalyticalItineraryIndex(world);
  globalThis.gc?.();
  const retainedHeapMiB =
    Math.max(0, process.memoryUsage().heapUsed - heapBefore) / 1_048_576;
  if (retained.manifestation.diagnostics().retainedPersonRows !== 0)
    throw new Error("itinerary index retained person rows");

  const metrics = {
    indexBuildP50Ms: percentile(buildSamples, 0.5),
    indexBuildP95Ms: percentile(buildSamples, 0.95),
    fullQueriesPerSecondP50: percentile(querySamples, 0.5),
    fullQueriesPerSecondP95: percentile(querySamples, 0.95),
    tenThousandBulkQueriesMs: bulkElapsed,
    retainedIndexHeapMiB: retainedHeapMiB,
  };
  const budgets = {
    indexBuildP95MsMax: 125,
    fullQueriesPerSecondMin: 2_000,
    tenThousandBulkQueriesMsMax: 5_000,
    retainedIndexHeapMiBMax: 8,
  };
  const failures = [];
  if (metrics.indexBuildP95Ms > budgets.indexBuildP95MsMax)
    failures.push("indexBuildP95Ms");
  if (metrics.fullQueriesPerSecondP50 < budgets.fullQueriesPerSecondMin)
    failures.push("fullQueriesPerSecond");
  if (metrics.tenThousandBulkQueriesMs > budgets.tenThousandBulkQueriesMsMax)
    failures.push("tenThousandBulkQueriesMs");
  if (metrics.retainedIndexHeapMiB > budgets.retainedIndexHeapMiBMax)
    failures.push("retainedIndexHeapMiB");
  if (failures.length > 0)
    throw new Error(`itinerary budgets failed: ${failures.join(", ")}`);

  const result = {
    schemaVersion: 1,
    benchmarkVersion: "analytical-itinerary-v1",
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    seed: world.seed,
    worldHash: world.worldHash,
    eventHash: state.eventHash,
    workload: {
      representedPopulation: world.totalPopulation.toString(),
      queryTick: state.field.tick.toString(),
      queryCount,
      bulkCount,
      retainedPersonRows:
        itinerary.manifestation.diagnostics().retainedPersonRows,
    },
    metrics,
    budgets: { ...budgets, passed: true },
  };
  await writeFile(
    "benchmarks/results/analytical-itinerary.json",
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await vite.close();
}
