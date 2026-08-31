import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { createServer } from "vite";

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))
  ];
}

const profile = JSON.parse(
  await readFile("benchmarks/profiles/apple-m1-max.json", "utf8"),
);
const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
try {
  const { createCityProjection } = await vite.ssrLoadModule(
    "/packages/manifest/src/city.ts",
  );
  const { BASELINE_WORLD_SEED } = await vite.ssrLoadModule(
    "/packages/sim/src/world.ts",
  );
  const query = {
    schema: 1,
    seed: BASELINE_WORLD_SEED,
    settlementId: "place/brindle-bay",
  };
  for (let warmup = 0; warmup < 3; warmup += 1) createCityProjection(query);
  const generationSamples = [];
  let city;
  for (let sample = 0; sample < 21; sample += 1) {
    const started = performance.now();
    city = createCityProjection(query);
    generationSamples.push(performance.now() - started);
  }
  if (!city) throw new Error("city benchmark did not generate a projection");

  globalThis.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const retainedCount = 16;
  const retained = Array.from({ length: retainedCount }, (_value, index) =>
    createCityProjection({
      ...query,
      seed: `${BASELINE_WORLD_SEED}/heap/${index}`,
    }),
  );
  globalThis.gc?.();
  const retainedBatchHeapMiB =
    Math.max(0, process.memoryUsage().heapUsed - heapBefore) / 1_048_576;
  const retainedHeapMiBPerProjection = retainedBatchHeapMiB / retained.length;
  if (new Set(retained.map(({ cityHash }) => cityHash)).size !== retainedCount)
    throw new Error("city heap workload did not retain distinct projections");

  const metrics = {
    generationP50Ms: percentile(generationSamples, 0.5),
    generationP95Ms: percentile(generationSamples, 0.95),
    retainedBatchHeapMiB,
    retainedHeapMiBPerProjection,
    serializedProjectionBytes: Buffer.byteLength(JSON.stringify(city)),
  };
  const budgets = {
    generationP95MsMax: 250,
    retainedBatchHeapMiBMax: 16,
    retainedHeapMiBPerProjectionMax: 1,
  };
  const failures = [];
  if (metrics.generationP95Ms > budgets.generationP95MsMax)
    failures.push("generationP95Ms");
  if (metrics.retainedBatchHeapMiB > budgets.retainedBatchHeapMiBMax)
    failures.push("retainedBatchHeapMiB");
  if (
    metrics.retainedHeapMiBPerProjection >
    budgets.retainedHeapMiBPerProjectionMax
  )
    failures.push("retainedHeapMiBPerProjection");
  if (failures.length > 0)
    throw new Error(`city projection budgets failed: ${failures.join(", ")}`);

  const result = {
    schemaVersion: 1,
    benchmarkVersion: "city-projection-v1",
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    profile: profile.profileId,
    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
    },
    seed: BASELINE_WORLD_SEED,
    settlementId: city.settlementId,
    cityHash: city.cityHash,
    workload: {
      warmupCount: 3,
      generationSampleCount: generationSamples.length,
      retainedProjectionCount: retainedCount,
      roads: city.roads.length,
      buildings: city.buildings.length,
      places: city.places.length,
      pedestrianNodes: city.pedestrianNodes.length,
      pedestrianEdges: city.pedestrianEdges.length,
    },
    metrics,
    budgets: { ...budgets, passed: true },
  };
  await writeFile(
    "benchmarks/results/city-projection.json",
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await vite.close();
}
