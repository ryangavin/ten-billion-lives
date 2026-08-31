import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

import { createServer } from "vite";

export const TRAJECTORY_PERSON_ID = "person_0000001_0000001";

function itineraryPoint(tick, activity, semanticId, route = null) {
  return Object.freeze({
    personId: TRAJECTORY_PERSON_ID,
    tick: BigInt(tick),
    dayIndex: 0n,
    hour: tick,
    activity,
    location: Object.freeze({
      kind: activity === "transit" ? "transport" : "place",
      semanticId,
      regionId: "region-fixture",
      positionPermille: route?.progressPermille ?? 0,
    }),
    route,
    fieldMembership: Object.freeze({
      homeCellId: "cell-fixture",
      cohort: "adult",
      cohortPopulation: 10n,
      channel: activity === "transit" ? "transit" : "work",
      channelPopulation: 10n,
    }),
    encounterGroupId: `encounter/${tick}`,
    encounters: Object.freeze([]),
    viewLocationId: semanticId,
    lod: "person",
    semanticHash: `semantic-${tick}`,
  });
}

export async function trajectoryFixture() {
  const city = JSON.parse(
    await readFile(
      new URL(
        "../packages/manifest/fixtures/trajectory-city-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const outward = Object.freeze({
    edgeIds: Object.freeze([]),
    mode: "walking",
    destinationId: "place/work",
    progressPermille: 500,
    reason: "daily commute",
  });
  const returning = Object.freeze({
    edgeIds: Object.freeze([]),
    mode: "walking",
    destinationId: "household/ada",
    progressPermille: 500,
    reason: "evening return",
  });
  const itinerary = Object.freeze([
    itineraryPoint(0, "home", "household/ada"),
    itineraryPoint(1, "transit", "transport/outward", outward),
    itineraryPoint(2, "work", "place/work"),
    itineraryPoint(3, "work", "place/work"),
    itineraryPoint(4, "transit", "transport/return", returning),
    itineraryPoint(5, "home", "household/ada"),
  ]);
  return Object.freeze({ city, itinerary });
}

function summary(pose) {
  return Object.freeze({
    tick: pose.time.tick.toString(),
    phasePermillion: pose.time.phasePermillion,
    mode: pose.mode,
    position: pose.position,
    headingMilliTurns: pose.headingMilliTurns,
    stridePermillion: pose.stridePermillion,
    routeId: pose.routeId,
    edgeId: pose.edgeId,
    activity: pose.activity,
    originPlaceId: pose.originPlaceId,
    destinationPlaceId: pose.destinationPlaceId,
    trajectoryHash: pose.trajectoryHash,
  });
}

export async function computeTrajectoryVector(trajectory) {
  const { city, itinerary } = await trajectoryFixture();
  const times = [
    [0n, 0],
    [0n, 500_000],
    [1n, 0],
    [1n, 999_999],
    [2n, 0],
    [3n, 500_000],
    [4n, 0],
  ];
  const poseAt = (branch, tick, phasePermillion) =>
    trajectory.queryPedestrianPose({
      schema: 1,
      branch,
      stateHash: "state-fixture",
      eventHash: "event-fixture",
      personId: TRAJECTORY_PERSON_ID,
      itinerary,
      city,
      time: trajectory.createVisualTime(tick, phasePermillion),
    });
  const observerA = times.map(([tick, phase]) =>
    summary(poseAt("baseline", tick, phase)),
  );
  const observerB = times.map(([tick, phase]) =>
    summary(poseAt("baseline", tick, phase)),
  );
  const beforeBoundary = poseAt("baseline", 1n, 999_999);
  const boundary = poseAt("baseline", 2n, 0);
  return Object.freeze({
    schemaVersion: 1,
    vectorVersion: "pedestrian-trajectory-v1",
    seed: city.seed,
    cityHash: city.cityHash,
    stateHash: "state-fixture",
    eventHash: "event-fixture",
    personId: TRAJECTORY_PERSON_ID,
    derivedTrajectoryRowsRetained: 0,
    independentObserversMatch:
      JSON.stringify(observerA) === JSON.stringify(observerB),
    boundaryRemainderCm: Object.freeze({
      east: Math.abs(beforeBoundary.position.eastCm - boundary.position.eastCm),
      north: Math.abs(
        beforeBoundary.position.northCm - boundary.position.northCm,
      ),
      up: Math.abs(beforeBoundary.position.upCm - boundary.position.upCm),
    }),
    baseline: observerA,
    closure: times.map(([tick, phase]) =>
      summary(poseAt("closure", tick, phase)),
    ),
  });
}

async function main() {
  const vite = await createServer({
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  try {
    const trajectory = await vite.ssrLoadModule(
      "/packages/manifest/src/trajectory.ts",
    );
    console.log(
      JSON.stringify(await computeTrajectoryVector(trajectory), null, 2),
    );
  } finally {
    await vite.close();
  }
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
)
  await main();
