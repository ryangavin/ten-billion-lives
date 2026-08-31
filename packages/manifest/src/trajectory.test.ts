import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type {
  PersonActivity,
  PersonItineraryPoint,
  PersonRoute,
} from "./itinerary";
import {
  PedestrianTrajectoryError,
  createVisualTime,
  queryPedestrianPose,
  type PedestrianTrajectoryQuery,
  type TrajectoryCityProjection,
  type TrajectoryMapPoint,
} from "./trajectory";

const PERSON_ID = "person_0000001_0000001";

const city = JSON.parse(
  readFileSync(
    new URL("../fixtures/trajectory-city-v1.json", import.meta.url),
    "utf8",
  ),
) as TrajectoryCityProjection;

function itineraryPoint(
  tick: bigint,
  activity: PersonActivity,
  semanticId: string,
  route: PersonRoute | null = null,
): PersonItineraryPoint {
  return Object.freeze({
    personId: PERSON_ID,
    tick,
    dayIndex: 0n,
    hour: Number(tick),
    activity,
    location: Object.freeze({
      kind:
        activity === "transit" ? ("transport" as const) : ("place" as const),
      semanticId,
      regionId: "region-fixture",
      positionPermille: route?.progressPermille ?? 0,
    }),
    route,
    fieldMembership: Object.freeze({
      homeCellId: "cell-fixture",
      cohort: "adult" as const,
      cohortPopulation: 10n,
      channel:
        activity === "transit" ? ("transit" as const) : ("work" as const),
      channelPopulation: 10n,
    }),
    encounterGroupId: `encounter/${tick}`,
    encounters: Object.freeze([]),
    viewLocationId: semanticId,
    lod: "person" as const,
    semanticHash: `semantic-${tick}`,
  });
}

const outward = Object.freeze({
  edgeIds: Object.freeze([]),
  mode: "walking" as const,
  destinationId: "place/work",
  progressPermille: 500,
  reason: "daily commute" as const,
});
const returning = Object.freeze({
  edgeIds: Object.freeze([]),
  mode: "walking" as const,
  destinationId: "household/ada",
  progressPermille: 500,
  reason: "evening return" as const,
});

const itinerary = Object.freeze([
  itineraryPoint(0n, "home", "household/ada"),
  itineraryPoint(1n, "transit", "transport/outward", outward),
  itineraryPoint(2n, "work", "place/work"),
  itineraryPoint(3n, "work", "place/work"),
  itineraryPoint(4n, "transit", "transport/return", returning),
  itineraryPoint(5n, "home", "household/ada"),
]);

function query(
  tick: bigint,
  phasePermillion: number,
  overrides: Partial<PedestrianTrajectoryQuery> = {},
) {
  return queryPedestrianPose({
    schema: 1,
    branch: "baseline",
    stateHash: "state-fixture",
    eventHash: "event-fixture",
    personId: PERSON_ID,
    itinerary,
    city,
    time: createVisualTime(tick, phasePermillion),
    ...overrides,
  });
}

function onSegment(
  position: TrajectoryMapPoint,
  start: TrajectoryMapPoint,
  end: TrajectoryMapPoint,
): boolean {
  const cross =
    (position.eastCm - start.eastCm) * (end.northCm - start.northCm) -
    (position.northCm - start.northCm) * (end.eastCm - start.eastCm);
  const withinEast =
    position.eastCm >= Math.min(start.eastCm, end.eastCm) &&
    position.eastCm <= Math.max(start.eastCm, end.eastCm);
  const withinNorth =
    position.northCm >= Math.min(start.northCm, end.northCm) &&
    position.northCm <= Math.max(start.northCm, end.northCm);
  return cross === 0 && withinEast && withinNorth;
}

function onOpenTopology(
  pose: ReturnType<typeof queryPedestrianPose>,
  branch: "baseline" | "closure",
): boolean {
  return city.pedestrianEdges
    .filter((edge) => edge.closedInBranch !== branch)
    .some((edge) =>
      edge.path.slice(1).some((end, index) => {
        const start = edge.path[index];
        return start !== undefined && onSegment(pose.position, start, end);
      }),
    );
}

describe("pure pedestrian trajectories", () => {
  it("matches the canonical golden transcript and reproduces independently", () => {
    const times = [
      createVisualTime(0n, 0),
      createVisualTime(0n, 500_000),
      createVisualTime(1n, 0),
      createVisualTime(1n, 999_999),
      createVisualTime(2n, 0),
      createVisualTime(3n, 500_000),
      createVisualTime(4n, 0),
    ];
    const observer = () =>
      times.map((time) => {
        const pose = query(time.tick, time.phasePermillion);
        return [
          pose.time.tick.toString(),
          pose.time.phasePermillion,
          pose.mode,
          pose.position,
          pose.headingMilliTurns,
          pose.stridePermillion,
          pose.activity,
          pose.originPlaceId,
          pose.destinationPlaceId,
          pose.edgeId,
          pose.trajectoryHash,
        ];
      });

    expect(observer()).toEqual(observer());
    expect(observer()).toMatchInlineSnapshot(`
      [
        [
          "0",
          0,
          "dwelling",
          {
            "eastCm": 0,
            "northCm": 0,
            "upCm": 0,
          },
          0,
          0,
          "home",
          "household/ada",
          "household/ada",
          null,
          "49c05f741217d68c",
        ],
        [
          "0",
          500000,
          "walking",
          {
            "eastCm": 500,
            "northCm": 0,
            "upCm": 0,
          },
          0,
          12607,
          "home",
          "household/ada",
          "place/work",
          "edge/direct-a",
          "b01c4602f89eec7c",
        ],
        [
          "1",
          0,
          "walking",
          {
            "eastCm": 1000,
            "northCm": 0,
            "upCm": 0,
          },
          0,
          12607,
          "transit",
          "household/ada",
          "place/work",
          "edge/direct-a",
          "b50a1d2d8b2106a0",
        ],
        [
          "1",
          999999,
          "walking",
          {
            "eastCm": 1999,
            "northCm": 0,
            "upCm": 0,
          },
          0,
          12603,
          "transit",
          "household/ada",
          "place/work",
          "edge/direct-b",
          "648feb8b7bfc6f5a",
        ],
        [
          "2",
          0,
          "dwelling",
          {
            "eastCm": 2000,
            "northCm": 0,
            "upCm": 0,
          },
          0,
          0,
          "work",
          "place/work",
          "place/work",
          null,
          "5f06160cfdbfe0e3",
        ],
        [
          "3",
          500000,
          "walking",
          {
            "eastCm": 1500,
            "northCm": 0,
            "upCm": 0,
          },
          500,
          12607,
          "work",
          "place/work",
          "household/ada",
          "edge/direct-b",
          "5fed7b5cda51bc38",
        ],
        [
          "4",
          0,
          "walking",
          {
            "eastCm": 1000,
            "northCm": 0,
            "upCm": 0,
          },
          500,
          12607,
          "transit",
          "place/work",
          "household/ada",
          "edge/direct-b",
          "7a8b5b77ad5c3764",
        ],
      ]
    `);
  });

  it("stays on pedestrian paths and follows the closure detour", () => {
    for (const phase of [0, 1, 250_000, 500_000, 750_000, 999_999]) {
      const baseline = query(1n, phase);
      const closure = query(1n, phase, { branch: "closure" });
      expect(onOpenTopology(baseline, "baseline")).toBe(true);
      expect(onOpenTopology(closure, "closure")).toBe(true);
      expect(closure.routeId).not.toBe(baseline.routeId);
      expect(closure.trajectoryHash).not.toBe(baseline.trajectoryHash);
    }
    expect(query(1n, 0).position).toEqual({
      eastCm: 1000,
      northCm: 0,
      upCm: 0,
    });
    expect(query(1n, 0, { branch: "closure" }).position).toEqual({
      eastCm: 1000,
      northCm: 1000,
      upCm: 0,
    });
  });

  it("is continuous at hourly boundaries with explicit fixed-point remainder", () => {
    for (const branch of ["baseline", "closure"] as const) {
      const before = query(1n, 999_999, { branch });
      const boundary = query(2n, 0, { branch });
      expect(
        Math.abs(before.position.eastCm - boundary.position.eastCm),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(before.position.northCm - boundary.position.northCm),
      ).toBeLessThanOrEqual(1);
      expect(boundary.mode).toBe("dwelling");
      expect(boundary.stridePermillion).toBe(0);
      expect(boundary.destinationPlaceId).toBe("place/work");
    }
  });

  it("uses stable zero-stride dwelling without changing itinerary truth", () => {
    const poses = [0, 1, 500_000, 999_999].map((phase) => query(2n, phase));
    expect(poses.every((pose) => pose.mode === "dwelling")).toBe(true);
    expect(poses.every((pose) => pose.stridePermillion === 0)).toBe(true);
    expect(
      new Set(poses.map((pose) => JSON.stringify(pose.position))).size,
    ).toBe(1);
    expect(poses.every((pose) => pose.activity === "work")).toBe(true);
  });

  it.each([
    ["community/market", "leisure"],
    ["festival/lantern-tide", "festival"],
    ["transport/quay", "leisure"],
  ] as const)(
    "terminates at semantic destination %s",
    (destinationId, activity) => {
      const transit = { ...outward, destinationId };
      const destinationItinerary = [
        itineraryPoint(0n, "home", "household/ada"),
        itineraryPoint(1n, "transit", "transport/fixture", transit),
        itineraryPoint(2n, activity, destinationId),
      ];
      const before = query(1n, 999_999, { itinerary: destinationItinerary });
      const arrived = query(2n, 0, { itinerary: destinationItinerary });
      const entrance = city.pedestrianNodes.find(
        (node) =>
          node.id ===
          city.places.find((place) => place.id === destinationId)
            ?.entranceNodeId,
      )?.position;
      expect(arrived.position).toEqual(entrance);
      expect(arrived.destinationPlaceId).toBe(destinationId);
      expect(arrived.activity).toBe(activity);
      expect(
        Math.abs(before.position.eastCm - arrived.position.eastCm),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(before.position.northCm - arrived.position.northCm),
      ).toBeLessThanOrEqual(1);
    },
  );

  it("excludes camera, cadence, and query order while hashing semantic inputs", () => {
    const target = query(1n, 750_000);
    query(4n, 123_456);
    query(0n, 1);
    expect(query(1n, 750_000)).toEqual(target);
    expect(query(1n, 750_001).trajectoryHash).not.toBe(target.trajectoryHash);
    expect(
      query(1n, 750_000, { stateHash: "other-state" }).trajectoryHash,
    ).not.toBe(target.trajectoryHash);
    expect(
      query(1n, 750_000, { eventHash: "other-event" }).trajectoryHash,
    ).not.toBe(target.trajectoryHash);
  });

  it("fails closed with typed errors for invalid time, city, itinerary, and topology", () => {
    expect(() => createVisualTime(-1n, 0)).toThrow(RangeError);
    expect(() => createVisualTime(0n, -1)).toThrow(RangeError);
    expect(() => createVisualTime(0n, 1_000_000)).toThrow(RangeError);
    expect(() => createVisualTime(0n, 0.5)).toThrow(RangeError);
    expect(() =>
      queryPedestrianPose({
        schema: 1,
        branch: "baseline",
        stateHash: "state",
        eventHash: "event",
        personId: PERSON_ID,
        itinerary,
        city,
        time: { tick: 0n, phasePermillion: 1_000_000 },
      }),
    ).toThrow(PedestrianTrajectoryError);
    expect(() => query(7n, 0)).toThrow(/itinerary.*tick/i);
    expect(() => query(1n, 0, { itinerary: [] })).toThrow(/itinerary/i);
    const firstPoint = itinerary[0];
    const secondPoint = itinerary[1];
    if (firstPoint === undefined || secondPoint === undefined)
      throw new Error("trajectory test itinerary is incomplete");
    expect(() =>
      query(1n, 0, { itinerary: [secondPoint, firstPoint] }),
    ).toThrow(/canonical/i);
    expect(() =>
      query(1n, 0, {
        itinerary: itinerary.map((point) =>
          point.tick === 1n ? { ...point, personId: "person_other" } : point,
        ),
      }),
    ).toThrow(/person/i);
    expect(() =>
      query(1n, 0, {
        city: {
          ...city,
          places: city.places.filter((place) => place.id !== "place/work"),
        },
      }),
    ).toThrow(/place\/work/);
    expect(() =>
      query(1n, 0, {
        branch: "closure",
        city: {
          ...city,
          pedestrianEdges: city.pedestrianEdges.map((edge) =>
            edge.id === "edge/festival"
              ? edge
              : { ...edge, closedInBranch: "closure" as const },
          ),
        },
      }),
    ).toThrow(/unreachable/i);
    expect(() =>
      query(1n, 0, {
        itinerary: itinerary.map((point) =>
          point.tick === 1n && point.route !== null
            ? {
                ...point,
                route: { ...point.route, reason: "closure detour" as const },
              }
            : point,
        ),
      }),
    ).toThrow(/branch/i);
  });
});
