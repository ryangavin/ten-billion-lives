import { readFile } from "node:fs/promises";

import { BASELINE_WORLD_SEED } from "@ten-billion-lives/sim";
import { describe, expect, it } from "vitest";

import {
  createCityProjection,
  validateCityProjection,
  type CityProjection,
  type MapPoint,
} from "./city";

const query = Object.freeze({
  schema: 1 as const,
  seed: BASELINE_WORLD_SEED,
  settlementId: "place/brindle-bay" as const,
});

function reachable(city: CityProjection, from: string): ReadonlySet<string> {
  const outgoing = new Map<string, string[]>();
  for (const node of city.pedestrianNodes) outgoing.set(node.id, []);
  for (const edge of city.pedestrianEdges) {
    outgoing.get(edge.fromNodeId)?.push(edge.toNodeId);
    outgoing.get(edge.toNodeId)?.push(edge.fromNodeId);
  }
  const visited = new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const next of outgoing.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited;
}

function points(city: CityProjection): readonly MapPoint[] {
  return [
    city.bounds.min,
    city.bounds.max,
    ...city.roads.flatMap((road) => road.centerline),
    ...city.sidewalks.flatMap((sidewalk) => sidewalk.path),
    ...city.crossings.flatMap((crossing) => crossing.path),
    ...city.buildings.flatMap((building) => building.footprint),
    ...city.publicSpaces.flatMap((space) => space.boundary),
    ...city.pedestrianNodes.map((node) => node.position),
    ...city.pedestrianEdges.flatMap((edge) => edge.path),
  ];
}

describe("Brindle Bay city projection", () => {
  it("matches the committed canonical golden projection", async () => {
    const fixture = JSON.parse(
      await readFile(
        new URL("../fixtures/city-golden-v1.json", import.meta.url),
        "utf8",
      ),
    ) as unknown;
    expect(createCityProjection(query)).toEqual(fixture);
  });

  it("is deterministic, canonical, bounded, and camera independent", () => {
    for (let sample = 0; sample < 12; sample += 1) {
      const seed = `city-property-seed/${sample}`;
      const first = createCityProjection({ ...query, seed });
      const second = createCityProjection({ ...query, seed });
      const cameraDecorated = createCityProjection({
        ...query,
        seed,
        camera: { bearing: sample * 7, zoom: sample },
      } as typeof query);

      expect(second).toEqual(first);
      expect(cameraDecorated).toEqual(first);
      expect(first.cityHash).toMatch(/^[0-9a-f]{16}$/);
      validateCityProjection(first);

      for (const values of [
        first.roads,
        first.sidewalks,
        first.crossings,
        first.buildings,
        first.publicSpaces,
        first.places,
        first.pedestrianNodes,
        first.pedestrianEdges,
      ]) {
        const ids = values.map(({ id }) => id);
        expect(ids).toEqual([...ids].sort());
        expect(new Set(ids).size).toBe(ids.length);
      }

      expect(first.buildings.length).toBeGreaterThan(0);
      expect(first.roads.length).toBeGreaterThan(0);
      expect(first.sidewalks.length).toBeGreaterThan(0);
      expect(first.crossings.length).toBeGreaterThan(0);
      for (const point of points(first)) {
        expect(Number.isSafeInteger(point.eastCm)).toBe(true);
        expect(Number.isSafeInteger(point.northCm)).toBe(true);
        expect(Number.isSafeInteger(point.upCm)).toBe(true);
        expect(point.eastCm).toBeGreaterThanOrEqual(first.bounds.min.eastCm);
        expect(point.eastCm).toBeLessThanOrEqual(first.bounds.max.eastCm);
        expect(point.northCm).toBeGreaterThanOrEqual(first.bounds.min.northCm);
        expect(point.northCm).toBeLessThanOrEqual(first.bounds.max.northCm);
        expect(point.upCm).toBeGreaterThanOrEqual(first.bounds.min.upCm);
        expect(point.upCm).toBeLessThanOrEqual(first.bounds.max.upCm);
      }
    }
  }, 15_000);

  it("maps every required semantic destination onto one connected graph", () => {
    const city = createCityProjection(query);
    const expectedKinds = new Set([
      "household",
      "workplace",
      "school",
      "service",
      "community",
      "transport",
      "festival",
    ]);
    expect(new Set(city.places.map((place) => place.kind))).toEqual(
      expectedKinds,
    );

    const firstEntrance = city.places[0]?.entranceNodeId;
    expect(firstEntrance).toBeDefined();
    const connected = reachable(city, firstEntrance ?? "");
    expect(connected.size).toBe(city.pedestrianNodes.length);
    for (const place of city.places)
      expect(connected.has(place.entranceNodeId)).toBe(true);

    const household = city.places.find((place) => place.kind === "household");
    const festival = city.places.find((place) => place.kind === "festival");
    expect(household?.id).toMatch(/^household_/);
    expect(festival?.id).toBe("festival/lantern-confluence");
    expect(household).toBeDefined();
    expect(festival).toBeDefined();
  });

  it("is deeply immutable and rejects hash or topology corruption", () => {
    const city = createCityProjection(query);
    expect(Object.isFrozen(city)).toBe(true);
    expect(Object.isFrozen(city.bounds)).toBe(true);
    expect(Object.isFrozen(city.roads)).toBe(true);
    expect(Object.isFrozen(city.roads[0]?.centerline)).toBe(true);
    expect(Object.isFrozen(city.pedestrianEdges[0]?.path)).toBe(true);

    expect(() =>
      validateCityProjection({ ...city, cityHash: "0000000000000000" }),
    ).toThrow(/city hash mismatch/);
    expect(() =>
      validateCityProjection({
        ...city,
        pedestrianEdges: [
          ...city.pedestrianEdges,
          {
            id: "ped-edge/zz-dangling",
            fromNodeId: "ped-node/missing",
            toNodeId: city.pedestrianNodes[0]?.id ?? "",
            kind: "sidewalk",
            path: [],
            closedInBranch: null,
          },
        ],
      }),
    ).toThrow(/dangling pedestrian edge/);
  });
});
