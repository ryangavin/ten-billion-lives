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
  const { createIllusionEngine } = await vite.ssrLoadModule(
    "/packages/manifest/src/projection.ts",
  );
  const { advanceWorldKernel, createWorldKernel } = await vite.ssrLoadModule(
    "/packages/sim/src/index.ts",
  );
  const genesis = createWorldKernel();
  const state = advanceWorldKernel(genesis, 10);
  const cellId = genesis.world.settlements[0]?.cellId;
  if (!cellId) throw new Error("missing benchmark projection cell");
  const engine = createIllusionEngine(genesis.world);
  const selectedPersonId = engine.manifestation.personIdAt(cellId, 42n);
  const streetQuery = {
    state,
    tick: 10n,
    scopeCellIds: [cellId],
    lod: "street",
    selectedPersonIds: [selectedPersonId],
  };
  const planetQuery = {
    ...streetQuery,
    scopeCellIds: state.field.cells.map((cell) => cell.cellId),
    lod: "planet",
  };

  engine.project(streetQuery);
  engine.project(planetQuery);
  const streetSamples = [];
  const planetSamples = [];
  for (let sample = 0; sample < 7; sample += 1) {
    let started = performance.now();
    engine.project(streetQuery, {
      observerId: `street-${sample}`,
      frameRate: 30 + sample,
      quality: sample % 2 === 0 ? "fallback" : "showcase",
    });
    streetSamples.push(performance.now() - started);
    started = performance.now();
    engine.project(planetQuery);
    planetSamples.push(performance.now() - started);
  }

  const pairStarted = performance.now();
  const observerA = createIllusionEngine(genesis.world).project(streetQuery);
  const observerB = createIllusionEngine(genesis.world).project(streetQuery);
  const observerPairMs = performance.now() - pairStarted;
  if (
    observerA.manifestationHash !== observerB.manifestationHash ||
    observerA.eventHash !== observerB.eventHash
  )
    throw new Error("benchmark observer hashes diverged");

  const before = engine.project({
    ...streetQuery,
    state: advanceWorldKernel(genesis, 23),
    tick: 23n,
    lod: "region",
  });
  globalThis.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const after = engine.project({
    ...streetQuery,
    state: advanceWorldKernel(genesis, 24),
    tick: 24n,
    lod: "region",
  });
  globalThis.gc?.();
  const retainedProjectionHeapMiB =
    Math.max(0, process.memoryUsage().heapUsed - heapBefore) / 1_048_576;
  const beforeIds = new Set(before.tokens.map((token) => token.personId));
  const retained = after.tokens.filter((token) =>
    beforeIds.has(token.personId),
  ).length;
  const identityRetentionRatio = retained / after.tokens.length;
  const fieldCell = state.field.cells.find((cell) => cell.cellId === cellId);
  if (!fieldCell) throw new Error("missing benchmark field cell");
  const reconciliation = Object.fromEntries(
    ["young", "adult", "older"].map((cohort) => {
      const manifested = observerA.tokens
        .filter((token) => token.cohort === cohort)
        .reduce((sum, token) => sum + token.weight, 0n);
      return [
        cohort,
        {
          field: fieldCell.cohorts[cohort].toString(),
          manifested: manifested.toString(),
          exact: manifested === fieldCell.cohorts[cohort],
        },
      ];
    }),
  );
  const lodSequence = ["planet", "region", "street", "person", "planet"].map(
    (lod) => {
      const projection = engine.project({ ...streetQuery, lod });
      return {
        lod,
        manifestationHash: projection.manifestationHash,
        selectedPresent: projection.tokens.some(
          (token) => token.personId === selectedPersonId,
        ),
      };
    },
  );

  const metrics = {
    streetProjectionP50Ms: percentile(streetSamples, 0.5),
    streetProjectionP95Ms: percentile(streetSamples, 0.95),
    planetProjectionP50Ms: percentile(planetSamples, 0.5),
    planetProjectionP95Ms: percentile(planetSamples, 0.95),
    independentObserverPairMs: observerPairMs,
    retainedProjectionHeapMiB,
    identityRetentionRatio,
    estimatedStreetProjectionMiB:
      observerA.realityBudget.estimatedBytes / 1_048_576,
  };
  const budgets = {
    streetProjectionP95MsMax: 500,
    planetProjectionP95MsMax: 500,
    independentObserverPairMsMax: 1_000,
    retainedProjectionHeapMiBMax: 32,
    identityRetentionRatioMin: 0.875,
    estimatedStreetProjectionMiBMax: 2,
  };
  const failures = [];
  if (metrics.streetProjectionP95Ms > budgets.streetProjectionP95MsMax)
    failures.push("streetProjectionP95Ms");
  if (metrics.planetProjectionP95Ms > budgets.planetProjectionP95MsMax)
    failures.push("planetProjectionP95Ms");
  if (metrics.independentObserverPairMs > budgets.independentObserverPairMsMax)
    failures.push("independentObserverPairMs");
  if (metrics.retainedProjectionHeapMiB > budgets.retainedProjectionHeapMiBMax)
    failures.push("retainedProjectionHeapMiB");
  if (metrics.identityRetentionRatio < budgets.identityRetentionRatioMin)
    failures.push("identityRetentionRatio");
  if (
    metrics.estimatedStreetProjectionMiB >
    budgets.estimatedStreetProjectionMiBMax
  )
    failures.push("estimatedStreetProjectionMiB");
  if (failures.length > 0)
    throw new Error(`projection budgets failed: ${failures.join(", ")}`);

  const result = {
    schemaVersion: 1,
    benchmarkVersion: "illusion-projection-v1",
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    seed: genesis.world.seed,
    worldHash: genesis.world.worldHash,
    eventHash: state.eventHash,
    workload: {
      representedPlanetPopulation: state.field.totalPopulation.toString(),
      streetRepresentedPeople:
        observerA.realityBudget.representedPeople.toString(),
      streetTokens: observerA.tokens.length,
      planetTokens: engine.project(planetQuery).tokens.length,
      queryTick: state.field.tick.toString(),
      samplesPerLod: streetSamples.length,
      independentlyInitializedObservers: 2,
    },
    metrics,
    semanticEvidence: {
      independentObservers: {
        manifestationHash: observerA.manifestationHash,
        eventHash: observerA.eventHash,
        hashesMatch: true,
      },
      reconciliation,
      lodSequence,
      epochTransition: {
        beforeEpoch: before.identityEpoch.toString(),
        afterEpoch: after.identityEpoch.toString(),
        beforeHash: before.manifestationHash,
        afterHash: after.manifestationHash,
        retained,
        total: after.tokens.length,
        retainedPermille: Math.floor(identityRetentionRatio * 1_000),
        selectedPresent: after.tokens.some(
          (token) => token.personId === selectedPersonId,
        ),
      },
    },
    budgets: { ...budgets, passed: true },
  };
  await writeFile(
    "benchmarks/results/illusion-projection.json",
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await vite.close();
}
