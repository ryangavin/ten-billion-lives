import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { createServer } from "vite";

import {
  TRAJECTORY_PERSON_ID,
  trajectoryFixture,
} from "./trajectory-vector.mjs";

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
  const trajectory = await vite.ssrLoadModule(
    "/packages/manifest/src/trajectory.ts",
  );
  const { city, itinerary } = await trajectoryFixture();
  const query = (index) =>
    trajectory.queryPedestrianPose({
      schema: 1,
      branch: index % 2 === 0 ? "baseline" : "closure",
      stateHash: "state-fixture",
      eventHash: "event-fixture",
      personId: TRAJECTORY_PERSON_ID,
      itinerary,
      city,
      time: trajectory.createVisualTime(
        BigInt(index % 5),
        (index * 104_729) % 1_000_000,
      ),
    });

  for (let index = 0; index < 1_000; index += 1) query(index);
  const queryCount = 5_000;
  const throughputSamples = [];
  let checksum = 0;
  for (let sample = 0; sample < 7; sample += 1) {
    const started = performance.now();
    for (let index = 0; index < queryCount; index += 1) {
      const pose = query(index);
      checksum ^= Number.parseInt(pose.trajectoryHash.slice(-8), 16);
    }
    throughputSamples.push(
      (queryCount * 1_000) / (performance.now() - started),
    );
  }
  if (!Number.isInteger(checksum))
    throw new Error("trajectory throughput checksum failed");

  globalThis.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  for (let index = 0; index < 20_000; index += 1) query(index);
  globalThis.gc?.();
  const retainedHeapMiB =
    Math.max(0, process.memoryUsage().heapUsed - heapBefore) / 1_048_576;

  const metrics = {
    queriesPerSecondP50: percentile(throughputSamples, 0.5),
    queriesPerSecondP95: percentile(throughputSamples, 0.95),
    retainedHeapMiBAfterTwentyThousandQueries: retainedHeapMiB,
  };
  const budgets = {
    queriesPerSecondP50Min: 1_000,
    retainedHeapMiBMax: 8,
  };
  const failures = [];
  if (metrics.queriesPerSecondP50 < budgets.queriesPerSecondP50Min)
    failures.push("queriesPerSecondP50");
  if (
    metrics.retainedHeapMiBAfterTwentyThousandQueries >
    budgets.retainedHeapMiBMax
  )
    failures.push("retainedHeapMiBAfterTwentyThousandQueries");
  if (failures.length > 0)
    throw new Error(`trajectory benchmark failed: ${failures.join(", ")}`);

  const result = {
    schemaVersion: 1,
    benchmarkVersion: "pedestrian-trajectories-v1",
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    profile: {
      profileId: "apple-m1-max-32gb-node",
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
    },
    seed: city.seed,
    cityHash: city.cityHash,
    stateHash: "state-fixture",
    eventHash: "event-fixture",
    workload: {
      queryCountPerSample: queryCount,
      sampleCount: throughputSamples.length,
      retentionQueryCount: 20_000,
      retainedPersonRows: 0,
      retainedTrajectoryRows: 0,
      derivation:
        "pure query from explicit itinerary, city, branch, and VisualTime",
    },
    metrics,
    budgets: { ...budgets, passed: true },
  };
  await writeFile(
    "benchmarks/results/pedestrian-trajectories.json",
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await vite.close();
}
