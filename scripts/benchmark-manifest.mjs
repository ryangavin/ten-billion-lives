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
  const { createManifestationIndex } = await vite.ssrLoadModule(
    "/packages/manifest/src/person.ts",
  );
  const { generateWorld, BASELINE_WORLD_SEED } = await vite.ssrLoadModule(
    "/packages/sim/src/world.ts",
  );
  const world = generateWorld(BASELINE_WORLD_SEED);
  const maxCell = world.cells.reduce((maximum, cell) =>
    cell.population > maximum.population ? cell : maximum,
  );
  if (maxCell.population < 1_000_000n)
    throw new Error("collision benchmark requires a one-million-person cell");

  const buildSamples = [];
  for (let sample = 0; sample < 9; sample += 1) {
    const started = performance.now();
    createManifestationIndex(world);
    buildSamples.push(performance.now() - started);
  }
  const index = createManifestationIndex(world);

  const queryCount = 10_000;
  const querySamples = [];
  let checksum = 0;
  for (let sample = 0; sample < 7; sample += 1) {
    const started = performance.now();
    for (let item = 0; item < queryCount; item += 1) {
      const ordinal = BigInt(
        (item * 2_654_435_761 + sample * 97) % Number(maxCell.population),
      );
      const card = index.person(index.personIdAt(maxCell.id, ordinal));
      checksum ^= Number.parseInt(card.semanticHash.slice(-8), 16);
    }
    querySamples.push((queryCount * 1_000) / (performance.now() - started));
  }
  if (!Number.isInteger(checksum))
    throw new Error("manifest query checksum failed");

  const relationshipCount = 1_000;
  const relationshipSamples = [];
  for (let sample = 0; sample < 7; sample += 1) {
    const started = performance.now();
    for (let item = 0; item < relationshipCount; item += 1)
      index.relationships(index.personIdAt(maxCell.id, BigInt(item + sample)));
    relationshipSamples.push(
      (relationshipCount * 1_000) / (performance.now() - started),
    );
  }

  const collisionScale = 1_000_000;
  const ids = new Set();
  const collisionStarted = performance.now();
  for (let ordinal = 0; ordinal < collisionScale; ordinal += 1)
    ids.add(index.personIdAt(maxCell.id, BigInt(ordinal)));
  const collisionElapsed = performance.now() - collisionStarted;
  const collisionCount = collisionScale - ids.size;
  ids.clear();
  globalThis.gc?.();

  const heapBefore = process.memoryUsage().heapUsed;
  const retainedIndex = createManifestationIndex(world);
  globalThis.gc?.();
  const retainedHeapMiB =
    Math.max(0, process.memoryUsage().heapUsed - heapBefore) / 1_048_576;
  if (retainedIndex.diagnostics().retainedPersonRows !== 0)
    throw new Error("manifestation index retained person rows");

  const quotas = index.cohortQuotas(maxCell.id);
  const distributionSampleSize = 100_000;
  const distributionCounts = { young: 0, adult: 0, older: 0 };
  for (let ordinal = 0; ordinal < distributionSampleSize; ordinal += 1) {
    const cohort = index.person(
      index.personIdAt(maxCell.id, BigInt(ordinal)),
    ).cohort;
    distributionCounts[cohort] += 1;
  }
  const goldenCellId = world.settlements[0]?.cellId;
  const goldenCell = world.cells.find((cell) => cell.id === goldenCellId);
  if (!goldenCell) throw new Error("golden manifestation cell is unavailable");
  const goldenPersonId = index.personIdAt(goldenCell.id, 42n);
  const goldenCard = index.person(goldenPersonId);
  const golden = {
    cellId: goldenCell.id,
    localOrdinal: "42",
    personId: goldenPersonId,
    card: goldenCard,
    householdMembers: index.householdMembers(goldenCard.household.id),
    relationships: index.relationships(goldenPersonId),
  };

  const metrics = {
    indexBuildP50Ms: percentile(buildSamples, 0.5),
    indexBuildP95Ms: percentile(buildSamples, 0.95),
    personQueriesPerSecondP50: percentile(querySamples, 0.5),
    personQueriesPerSecondP95: percentile(querySamples, 0.95),
    relationshipQueriesPerSecondP50: percentile(relationshipSamples, 0.5),
    millionIdGenerationMs: collisionElapsed,
    retainedIndexHeapMiB: retainedHeapMiB,
  };
  const budgets = {
    indexBuildP95MsMax: 100,
    personQueriesPerSecondMin: 20_000,
    relationshipQueriesPerSecondMin: 2_000,
    millionIdGenerationMsMax: 5_000,
    retainedIndexHeapMiBMax: 8,
  };
  const failures = [];
  if (metrics.indexBuildP95Ms > budgets.indexBuildP95MsMax)
    failures.push("indexBuildP95Ms");
  if (metrics.personQueriesPerSecondP50 < budgets.personQueriesPerSecondMin)
    failures.push("personQueriesPerSecond");
  if (
    metrics.relationshipQueriesPerSecondP50 <
    budgets.relationshipQueriesPerSecondMin
  )
    failures.push("relationshipQueriesPerSecond");
  if (metrics.millionIdGenerationMs > budgets.millionIdGenerationMsMax)
    failures.push("millionIdGenerationMs");
  if (metrics.retainedIndexHeapMiB > budgets.retainedIndexHeapMiBMax)
    failures.push("retainedIndexHeapMiB");
  if (collisionCount !== 0) failures.push("personIdCollisions");
  if (failures.length > 0)
    throw new Error(`manifestation budgets failed: ${failures.join(", ")}`);

  const result = {
    schemaVersion: 1,
    benchmarkVersion: "manifestation-v1",
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    seed: world.seed,
    worldHash: world.worldHash,
    workload: {
      representedPopulation: world.totalPopulation.toString(),
      retainedCells: index.diagnostics().retainedCells,
      retainedPersonRows: index.diagnostics().retainedPersonRows,
      queryCount,
      relationshipCount,
      collisionScale,
      collisionCount,
    },
    metrics,
    budgets: { ...budgets, passed: true },
    distribution: {
      cellId: maxCell.id,
      cellPopulation: maxCell.population.toString(),
      authoritativeQuotas: {
        young: quotas.young.toString(),
        adult: quotas.adult.toString(),
        older: quotas.older.toString(),
      },
      sampleSize: distributionSampleSize,
      sampleCounts: distributionCounts,
    },
    golden,
  };
  await writeFile(
    "benchmarks/results/manifestation.json",
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await vite.close();
}
