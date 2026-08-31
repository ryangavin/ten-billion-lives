import {
  CanonicalWriter,
  buildTransportGraph,
  fnv1a64,
  generateWorld,
  randomU32,
} from "@ten-billion-lives/sim";

import { createManifestationIndex } from "./person.js";

export interface CityProjectionQuery {
  readonly schema: 1;
  readonly seed: string;
  readonly settlementId: "place/brindle-bay";
}

export interface MapPoint {
  readonly eastCm: number;
  readonly northCm: number;
  readonly upCm: number;
}

export interface CityRoad {
  readonly id: string;
  readonly name: string;
  readonly centerline: readonly MapPoint[];
  readonly widthCm: number;
  readonly sidewalkIds: readonly string[];
}

export interface CitySidewalk {
  readonly id: string;
  readonly path: readonly MapPoint[];
  readonly widthCm: number;
  readonly roadIds: readonly string[];
  readonly pedestrianEdgeIds: readonly string[];
}

export interface CityCrossing {
  readonly id: string;
  readonly path: readonly MapPoint[];
  readonly widthCm: number;
  readonly roadId: string;
  readonly sidewalkIds: readonly string[];
  readonly pedestrianEdgeId: string;
}

export interface CityBuilding {
  readonly id: string;
  readonly footprint: readonly MapPoint[];
  readonly heightCm: number;
  readonly entranceNodeIds: readonly string[];
  readonly placeIds: readonly string[];
}

export interface CityPublicSpace {
  readonly id: string;
  readonly kind: "park" | "plaza" | "transit-square" | "waterfront";
  readonly boundary: readonly MapPoint[];
  readonly pedestrianNodeIds: readonly string[];
  readonly placeIds: readonly string[];
}

export type CityPlaceKind =
  | "community"
  | "festival"
  | "household"
  | "school"
  | "service"
  | "transport"
  | "workplace";

export interface CityPlace {
  /** Existing semantic destination ID; the city does not mint a replacement. */
  readonly id: string;
  readonly kind: CityPlaceKind;
  readonly name: string;
  readonly entranceNodeId: string;
}

export interface PedestrianNode {
  readonly id: string;
  readonly position: MapPoint;
  readonly adjacentEdgeIds: readonly string[];
  readonly placeIds: readonly string[];
}

export interface PedestrianEdge {
  readonly id: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly kind: "crossing" | "plaza-path" | "promenade" | "sidewalk";
  /** Route-ordered geometry including the exact from/to node positions. */
  readonly path: readonly MapPoint[];
  readonly closedInBranch: "closure" | null;
}

export interface CityProjection {
  readonly schema: 1;
  readonly seed: string;
  readonly settlementId: "place/brindle-bay";
  readonly bounds: Readonly<{ min: MapPoint; max: MapPoint }>;
  readonly roads: readonly CityRoad[];
  readonly sidewalks: readonly CitySidewalk[];
  readonly crossings: readonly CityCrossing[];
  readonly buildings: readonly CityBuilding[];
  readonly publicSpaces: readonly CityPublicSpace[];
  readonly places: readonly CityPlace[];
  readonly pedestrianNodes: readonly PedestrianNode[];
  readonly pedestrianEdges: readonly PedestrianEdge[];
  readonly cityHash: string;
}

type CityWithoutHash = Omit<CityProjection, "cityHash">;

const bounds = {
  min: { eastCm: 0, northCm: 0, upCm: 0 },
  max: { eastCm: 120_000, northCm: 100_000, upCm: 9_000 },
} as const;
const eastCoordinates = [10_000, 34_000, 46_000, 74_000, 86_000, 110_000];
const northCoordinates = [16_000, 29_000, 41_000, 59_000, 71_000, 91_000];

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

function byId<T extends { readonly id: string }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => compareText(left.id, right.id));
}

function point(eastCm: number, northCm: number, upCm = 0): MapPoint {
  return { eastCm, northCm, upCm };
}

function rectangle(
  westCm: number,
  southCm: number,
  eastCm: number,
  northCm: number,
): readonly MapPoint[] {
  return [
    point(westCm, southCm),
    point(eastCm, southCm),
    point(eastCm, northCm),
    point(westCm, northCm),
  ];
}

function coordinateToken(value: number): string {
  return value.toString().padStart(6, "0");
}

function nodeId(eastCm: number, northCm: number): string {
  return `ped-node/e${coordinateToken(eastCm)}-n${coordinateToken(northCm)}`;
}

function samePoint(left: MapPoint, right: MapPoint): boolean {
  return (
    left.eastCm === right.eastCm &&
    left.northCm === right.northCm &&
    left.upCm === right.upCm
  );
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value as Record<string, unknown>))
    deepFreeze(child);
  return Object.freeze(value);
}

function writePoint(writer: CanonicalWriter, value: MapPoint): void {
  writer.i32(value.eastCm).i32(value.northCm).i32(value.upCm);
}

function writePoints(
  writer: CanonicalWriter,
  values: readonly MapPoint[],
): void {
  writer.u32(values.length);
  for (const value of values) writePoint(writer, value);
}

function writeTexts(writer: CanonicalWriter, values: readonly string[]): void {
  writer.u32(values.length);
  for (const value of values) writer.text(value);
}

export function cityProjectionHash(city: CityWithoutHash): string {
  const writer = new CanonicalWriter("brindle-bay-city-projection", 1)
    .u32(city.schema)
    .text(city.seed)
    .text(city.settlementId)
    .text("centimeters");
  writePoint(writer, city.bounds.min);
  writePoint(writer, city.bounds.max);
  writer.u32(city.roads.length);
  for (const road of city.roads) {
    writer.text(road.id).text(road.name).u32(road.widthCm);
    writePoints(writer, road.centerline);
    writeTexts(writer, road.sidewalkIds);
  }
  writer.u32(city.sidewalks.length);
  for (const sidewalk of city.sidewalks) {
    writer.text(sidewalk.id).u32(sidewalk.widthCm);
    writePoints(writer, sidewalk.path);
    writeTexts(writer, sidewalk.roadIds);
    writeTexts(writer, sidewalk.pedestrianEdgeIds);
  }
  writer.u32(city.crossings.length);
  for (const crossing of city.crossings) {
    writer.text(crossing.id).u32(crossing.widthCm).text(crossing.roadId);
    writePoints(writer, crossing.path);
    writeTexts(writer, crossing.sidewalkIds);
    writer.text(crossing.pedestrianEdgeId);
  }
  writer.u32(city.buildings.length);
  for (const building of city.buildings) {
    writer.text(building.id).u32(building.heightCm);
    writePoints(writer, building.footprint);
    writeTexts(writer, building.entranceNodeIds);
    writeTexts(writer, building.placeIds);
  }
  writer.u32(city.publicSpaces.length);
  for (const space of city.publicSpaces) {
    writer.text(space.id).text(space.kind);
    writePoints(writer, space.boundary);
    writeTexts(writer, space.pedestrianNodeIds);
    writeTexts(writer, space.placeIds);
  }
  writer.u32(city.places.length);
  for (const place of city.places)
    writer
      .text(place.id)
      .text(place.kind)
      .text(place.name)
      .text(place.entranceNodeId);
  writer.u32(city.pedestrianNodes.length);
  for (const node of city.pedestrianNodes) {
    writer.text(node.id);
    writePoint(writer, node.position);
    writeTexts(writer, node.adjacentEdgeIds);
    writeTexts(writer, node.placeIds);
  }
  writer.u32(city.pedestrianEdges.length);
  for (const edge of city.pedestrianEdges) {
    writer
      .text(edge.id)
      .text(edge.fromNodeId)
      .text(edge.toNodeId)
      .text(edge.kind)
      .text(edge.closedInBranch ?? "");
    writePoints(writer, edge.path);
  }
  return fnv1a64(writer.bytes()).toString(16).padStart(16, "0");
}

function assertCanonicalIds(
  label: string,
  values: readonly { readonly id: string }[],
): void {
  const ids = values.map(({ id }) => id);
  if (ids.some((id) => id.length === 0))
    throw new RangeError(`${label} contains an empty ID`);
  if (new Set(ids).size !== ids.length)
    throw new RangeError(`${label} contains duplicate IDs`);
  if (
    ids.some(
      (id, index) =>
        index > 0 &&
        compareText(required(ids[index - 1], "missing prior ID"), id) > 0,
    )
  )
    throw new RangeError(`${label} is not canonically ordered`);
}

function assertCanonicalTextList(
  label: string,
  values: readonly string[],
): void {
  if (new Set(values).size !== values.length)
    throw new RangeError(`${label} contains duplicate IDs`);
  if (
    values.some(
      (value, index) =>
        index > 0 &&
        compareText(
          required(values[index - 1], `missing prior ${label} ID`),
          value,
        ) > 0,
    )
  )
    throw new RangeError(`${label} is not canonically ordered`);
}

function assertPoint(
  value: MapPoint,
  cityBounds: CityProjection["bounds"],
): void {
  for (const coordinate of [value.eastCm, value.northCm, value.upCm])
    if (!Number.isSafeInteger(coordinate))
      throw new RangeError("city coordinates must be safe integers");
  if (
    value.eastCm < cityBounds.min.eastCm ||
    value.eastCm > cityBounds.max.eastCm ||
    value.northCm < cityBounds.min.northCm ||
    value.northCm > cityBounds.max.northCm ||
    value.upCm < cityBounds.min.upCm ||
    value.upCm > cityBounds.max.upCm
  )
    throw new RangeError("city coordinate exceeds projection bounds");
}

export function validateCityProjection(city: CityProjection): void {
  if (city.schema !== 1) throw new RangeError("unsupported city schema");
  if (city.seed.length === 0)
    throw new RangeError("city seed must not be empty");
  if (city.settlementId !== "place/brindle-bay")
    throw new RangeError("unsupported city settlement");
  for (const values of [
    city.roads,
    city.sidewalks,
    city.crossings,
    city.buildings,
    city.publicSpaces,
    city.places,
    city.pedestrianNodes,
    city.pedestrianEdges,
  ])
    assertCanonicalIds("city collection", values);
  if (
    city.roads.length === 0 ||
    city.sidewalks.length === 0 ||
    city.crossings.length === 0 ||
    city.buildings.length === 0 ||
    city.publicSpaces.length === 0 ||
    city.places.length === 0 ||
    city.pedestrianNodes.length === 0 ||
    city.pedestrianEdges.length === 0
  )
    throw new RangeError("city projection collections must not be empty");

  const allPoints = [
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
  for (const value of allPoints) assertPoint(value, city.bounds);
  for (const road of city.roads) {
    if (
      road.centerline.length < 2 ||
      !Number.isSafeInteger(road.widthCm) ||
      road.widthCm <= 0
    )
      throw new RangeError(`invalid road geometry: ${road.id}`);
    assertCanonicalTextList(`${road.id} sidewalks`, road.sidewalkIds);
  }
  for (const sidewalk of city.sidewalks) {
    if (
      sidewalk.path.length < 2 ||
      !Number.isSafeInteger(sidewalk.widthCm) ||
      sidewalk.widthCm <= 0
    )
      throw new RangeError(`invalid sidewalk geometry: ${sidewalk.id}`);
    assertCanonicalTextList(`${sidewalk.id} roads`, sidewalk.roadIds);
    assertCanonicalTextList(
      `${sidewalk.id} pedestrian edges`,
      sidewalk.pedestrianEdgeIds,
    );
  }
  for (const crossing of city.crossings) {
    if (
      crossing.path.length < 2 ||
      !Number.isSafeInteger(crossing.widthCm) ||
      crossing.widthCm <= 0
    )
      throw new RangeError(`invalid crossing geometry: ${crossing.id}`);
    assertCanonicalTextList(`${crossing.id} sidewalks`, crossing.sidewalkIds);
  }
  for (const building of city.buildings) {
    if (
      building.footprint.length < 3 ||
      !Number.isSafeInteger(building.heightCm) ||
      building.heightCm <= 0 ||
      building.heightCm > city.bounds.max.upCm
    )
      throw new RangeError(`invalid building geometry: ${building.id}`);
    assertCanonicalTextList(
      `${building.id} entrances`,
      building.entranceNodeIds,
    );
    assertCanonicalTextList(`${building.id} places`, building.placeIds);
  }
  for (const space of city.publicSpaces) {
    if (space.boundary.length < 3)
      throw new RangeError(`invalid public-space geometry: ${space.id}`);
    assertCanonicalTextList(
      `${space.id} pedestrian nodes`,
      space.pedestrianNodeIds,
    );
    assertCanonicalTextList(`${space.id} places`, space.placeIds);
  }
  for (const node of city.pedestrianNodes) {
    assertCanonicalTextList(`${node.id} adjacent edges`, node.adjacentEdgeIds);
    assertCanonicalTextList(`${node.id} places`, node.placeIds);
  }

  const requiredPlaceKinds: readonly CityPlaceKind[] = [
    "community",
    "festival",
    "household",
    "school",
    "service",
    "transport",
    "workplace",
  ];
  const actualPlaceKinds = city.places
    .map(({ kind }) => kind)
    .sort(compareText);
  if (
    actualPlaceKinds.length !== requiredPlaceKinds.length ||
    actualPlaceKinds.some((kind, index) => kind !== requiredPlaceKinds[index])
  )
    throw new RangeError(
      "city projection lacks a required semantic place kind",
    );

  const roadIds = new Set(city.roads.map(({ id }) => id));
  const sidewalkIds = new Set(city.sidewalks.map(({ id }) => id));
  const edgeIds = new Set(city.pedestrianEdges.map(({ id }) => id));
  const nodeById = new Map(city.pedestrianNodes.map((node) => [node.id, node]));
  const placeIds = new Set(city.places.map(({ id }) => id));
  for (const road of city.roads)
    if (road.sidewalkIds.some((id) => !sidewalkIds.has(id)))
      throw new RangeError(`dangling road sidewalk: ${road.id}`);
  for (const sidewalk of city.sidewalks) {
    if (sidewalk.roadIds.some((id) => !roadIds.has(id)))
      throw new RangeError(`dangling sidewalk road: ${sidewalk.id}`);
    if (sidewalk.pedestrianEdgeIds.some((id) => !edgeIds.has(id)))
      throw new RangeError(`dangling sidewalk edge: ${sidewalk.id}`);
  }
  for (const crossing of city.crossings) {
    if (
      !roadIds.has(crossing.roadId) ||
      crossing.sidewalkIds.some((id) => !sidewalkIds.has(id))
    )
      throw new RangeError(`dangling crossing reference: ${crossing.id}`);
    if (!edgeIds.has(crossing.pedestrianEdgeId))
      throw new RangeError(`dangling crossing edge: ${crossing.id}`);
  }
  for (const owner of [...city.buildings, ...city.publicSpaces]) {
    if (owner.placeIds.some((id) => !placeIds.has(id)))
      throw new RangeError(`dangling place reference: ${owner.id}`);
  }
  for (const building of city.buildings)
    if (building.entranceNodeIds.some((id) => !nodeById.has(id)))
      throw new RangeError(`dangling building entrance: ${building.id}`);
  for (const space of city.publicSpaces)
    if (space.pedestrianNodeIds.some((id) => !nodeById.has(id)))
      throw new RangeError(`dangling public-space node: ${space.id}`);
  for (const place of city.places)
    if (!nodeById.has(place.entranceNodeId))
      throw new RangeError(`dangling place entrance: ${place.id}`);
  for (const node of city.pedestrianNodes) {
    if (node.adjacentEdgeIds.some((id) => !edgeIds.has(id)))
      throw new RangeError(`dangling node edge: ${node.id}`);
    if (node.placeIds.some((id) => !placeIds.has(id)))
      throw new RangeError(`dangling node place: ${node.id}`);
  }
  for (const edge of city.pedestrianEdges) {
    const from = nodeById.get(edge.fromNodeId);
    const to = nodeById.get(edge.toNodeId);
    if (from === undefined || to === undefined)
      throw new RangeError(`dangling pedestrian edge: ${edge.id}`);
    const firstPathPoint = edge.path[0];
    const lastPathPoint = edge.path.at(-1);
    if (
      firstPathPoint === undefined ||
      lastPathPoint === undefined ||
      edge.path.length < 2 ||
      !samePoint(firstPathPoint, from.position) ||
      !samePoint(lastPathPoint, to.position)
    )
      throw new RangeError(
        `pedestrian edge endpoints do not match: ${edge.id}`,
      );
  }

  const firstNode = city.pedestrianNodes[0];
  if (firstNode === undefined) throw new RangeError("city graph is empty");
  const visited = new Set([firstNode.id]);
  const queue = [firstNode.id];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const edgeId of nodeById.get(current)?.adjacentEdgeIds ?? []) {
      const edge = city.pedestrianEdges.find(({ id }) => id === edgeId);
      if (edge === undefined) continue;
      const next =
        edge.fromNodeId === current ? edge.toNodeId : edge.fromNodeId;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  if (visited.size !== city.pedestrianNodes.length)
    throw new RangeError("disconnected baseline pedestrian topology");
  if (cityProjectionHash(city) !== city.cityHash)
    throw new RangeError("city hash mismatch");
}

function semanticPlaces(seed: string): readonly CityPlace[] {
  const world = generateWorld(seed);
  const settlement = world.settlements[0];
  if (settlement === undefined)
    throw new RangeError("Brindle Bay settlement is unavailable for seed");
  const index = createManifestationIndex(world);
  const card = (cohort: "adult" | "older" | "young") =>
    index.person(index.personIdForCohortRank(settlement.cellId, cohort, 42n));
  const adult = card("adult");
  const older = card("older");
  const young = card("young");
  const festival = buildTransportGraph(world).festival;
  return byId([
    {
      id: `community/${settlement.cellId}`,
      kind: "community" as const,
      name: "Market Hall Commons",
      entranceNodeId: nodeId(46_000, 59_000),
    },
    {
      id: festival.id,
      kind: "festival" as const,
      name: "Lantern Tide Plaza",
      entranceNodeId: nodeId(86_000, 59_000),
    },
    {
      id: adult.household.id,
      kind: "household" as const,
      name: "Harbor Row Homes",
      entranceNodeId: nodeId(34_000, 41_000),
    },
    {
      id: young.primaryPlace.id,
      kind: "school" as const,
      name: young.primaryPlace.name,
      entranceNodeId: nodeId(86_000, 71_000),
    },
    {
      id: older.primaryPlace.id,
      kind: "service" as const,
      name: older.primaryPlace.name,
      entranceNodeId: nodeId(34_000, 59_000),
    },
    {
      id: settlement.transportAnchorId,
      kind: "transport" as const,
      name: "Brindle Bay Transit",
      entranceNodeId: nodeId(46_000, 29_000),
    },
    {
      id: adult.primaryPlace.id,
      kind: "workplace" as const,
      name: adult.primaryPlace.name,
      entranceNodeId: nodeId(74_000, 71_000),
    },
  ]);
}

function makeEdges(): readonly PedestrianEdge[] {
  const edges: PedestrianEdge[] = [];
  const add = (from: MapPoint, to: MapPoint): void => {
    const fromNodeId = nodeId(from.eastCm, from.northCm);
    const toNodeId = nodeId(to.eastCm, to.northCm);
    const horizontalCrossing =
      from.northCm === to.northCm &&
      ((from.eastCm === 34_000 && to.eastCm === 46_000) ||
        (from.eastCm === 74_000 && to.eastCm === 86_000));
    const verticalCrossing =
      from.eastCm === to.eastCm &&
      ((from.northCm === 29_000 && to.northCm === 41_000) ||
        (from.northCm === 59_000 && to.northCm === 71_000));
    const kind: PedestrianEdge["kind"] =
      horizontalCrossing || verticalCrossing
        ? "crossing"
        : from.northCm === 16_000
          ? "promenade"
          : from.eastCm >= 86_000 && from.northCm === 59_000
            ? "plaza-path"
            : "sidewalk";
    edges.push({
      id: `ped-edge/${fromNodeId.slice(9)}>${toNodeId.slice(9)}`,
      fromNodeId,
      toNodeId,
      kind,
      path: [from, to],
      closedInBranch:
        from.eastCm === 74_000 &&
        to.eastCm === 86_000 &&
        from.northCm === 59_000
          ? "closure"
          : null,
    });
  };
  for (const northCm of northCoordinates)
    for (let index = 0; index < eastCoordinates.length - 1; index += 1)
      add(
        point(
          required(eastCoordinates[index], "missing east coordinate"),
          northCm,
        ),
        point(
          required(eastCoordinates[index + 1], "missing next east coordinate"),
          northCm,
        ),
      );
  for (const eastCm of eastCoordinates)
    for (let index = 0; index < northCoordinates.length - 1; index += 1)
      add(
        point(
          eastCm,
          required(northCoordinates[index], "missing north coordinate"),
        ),
        point(
          eastCm,
          required(
            northCoordinates[index + 1],
            "missing next north coordinate",
          ),
        ),
      );
  return byId(edges);
}

function lineEdgeIds(
  edges: readonly PedestrianEdge[],
  axis: "east" | "north",
  coordinate: number,
): readonly string[] {
  return edges
    .filter((edge) => {
      const first = required(edge.path[0], `missing path start: ${edge.id}`);
      const last = required(edge.path.at(-1), `missing path end: ${edge.id}`);
      return axis === "east"
        ? first.eastCm === coordinate && last.eastCm === coordinate
        : first.northCm === coordinate && last.northCm === coordinate;
    })
    .map(({ id }) => id)
    .sort(compareText);
}

function createDraft(seed: string): CityWithoutHash {
  const seedWord = fnv1a64(new TextEncoder().encode(`${seed}/city/v1`));
  const places = semanticPlaces(seed);
  const placeByKind = new Map(places.map((place) => [place.kind, place]));
  const placeId = (kind: CityPlaceKind): string => {
    const id = placeByKind.get(kind)?.id;
    if (id === undefined) throw new Error(`missing city place kind: ${kind}`);
    return id;
  };
  const edges = makeEdges();
  const sidewalks: CitySidewalk[] = [
    ["sidewalk/garden-east", "east", 86_000, ["road/garden"]],
    ["sidewalk/garden-west", "east", 74_000, ["road/garden"]],
    ["sidewalk/harbor-north", "north", 41_000, ["road/harbor"]],
    ["sidewalk/harbor-south", "north", 29_000, ["road/harbor"]],
    ["sidewalk/market-north", "north", 71_000, ["road/market"]],
    ["sidewalk/market-south", "north", 59_000, ["road/market"]],
    ["sidewalk/north-promenade", "north", 91_000, []],
    ["sidewalk/quay-east", "east", 46_000, ["road/quay"]],
    ["sidewalk/quay-west", "east", 34_000, ["road/quay"]],
    ["sidewalk/waterfront-promenade", "north", 16_000, []],
  ].map(([id, axis, coordinate, roadIds]) => {
    const vertical = axis === "east";
    return {
      id: id as string,
      path: vertical
        ? [
            point(coordinate as number, 16_000),
            point(coordinate as number, 91_000),
          ]
        : [
            point(10_000, coordinate as number),
            point(110_000, coordinate as number),
          ],
      widthCm: 450,
      roadIds: roadIds as string[],
      pedestrianEdgeIds: lineEdgeIds(
        edges,
        axis as "east" | "north",
        coordinate as number,
      ),
    };
  });
  const roads: CityRoad[] = [
    {
      id: "road/garden",
      name: "Garden Road",
      centerline: [point(80_000, 12_000), point(80_000, 95_000)],
      widthCm: 8_000,
      sidewalkIds: ["sidewalk/garden-east", "sidewalk/garden-west"],
    },
    {
      id: "road/harbor",
      name: "Harbor Street",
      centerline: [point(6_000, 35_000), point(114_000, 35_000)],
      widthCm: 8_000,
      sidewalkIds: ["sidewalk/harbor-north", "sidewalk/harbor-south"],
    },
    {
      id: "road/market",
      name: "Market Way",
      centerline: [point(6_000, 65_000), point(114_000, 65_000)],
      widthCm: 8_000,
      sidewalkIds: ["sidewalk/market-north", "sidewalk/market-south"],
    },
    {
      id: "road/quay",
      name: "Lantern Quay",
      centerline: [point(40_000, 12_000), point(40_000, 95_000)],
      widthCm: 8_000,
      sidewalkIds: ["sidewalk/quay-east", "sidewalk/quay-west"],
    },
  ];
  const crossingRoad = (
    edge: PedestrianEdge,
  ): { roadId: string; sidewalks: string[]; id: string } => {
    const from = required(edge.path[0], `missing crossing start: ${edge.id}`);
    const to = required(edge.path.at(-1), `missing crossing end: ${edge.id}`);
    if (from.eastCm !== to.eastCm) {
      const garden = from.eastCm === 74_000;
      return garden
        ? {
            roadId: "road/garden",
            sidewalks: ["sidewalk/garden-east", "sidewalk/garden-west"],
            id: `crossing/garden-n${coordinateToken(from.northCm)}`,
          }
        : {
            roadId: "road/quay",
            sidewalks: ["sidewalk/quay-east", "sidewalk/quay-west"],
            id: `crossing/quay-n${coordinateToken(from.northCm)}`,
          };
    }
    const market = from.northCm === 59_000;
    return market
      ? {
          roadId: "road/market",
          sidewalks: ["sidewalk/market-north", "sidewalk/market-south"],
          id: `crossing/market-e${coordinateToken(from.eastCm)}`,
        }
      : {
          roadId: "road/harbor",
          sidewalks: ["sidewalk/harbor-north", "sidewalk/harbor-south"],
          id: `crossing/harbor-e${coordinateToken(from.eastCm)}`,
        };
  };
  const crossings = edges
    .filter(({ kind }) => kind === "crossing")
    .map((edge) => {
      const reference = crossingRoad(edge);
      return {
        id: reference.id,
        path: edge.path,
        widthCm: 600,
        roadId: reference.roadId,
        sidewalkIds: reference.sidewalks,
        pedestrianEdgeId: edge.id,
      };
    });
  const height = (index: number): number =>
    3_200 +
    (randomU32("city/building-height", seedWord, BigInt(index)) % 4_801);
  const buildings: CityBuilding[] = [
    {
      id: "building/academy",
      footprint: rectangle(88_000, 73_000, 108_000, 89_000),
      heightCm: height(0),
      entranceNodeIds: [nodeId(86_000, 71_000)],
      placeIds: [placeId("school")],
    },
    {
      id: "building/harbor-homes",
      footprint: rectangle(12_000, 43_000, 20_000, 57_000),
      heightCm: height(1),
      entranceNodeIds: [nodeId(34_000, 41_000)],
      placeIds: [placeId("household")],
    },
    {
      id: "building/market-hall",
      footprint: rectangle(48_000, 43_000, 72_000, 57_000),
      heightCm: height(2),
      entranceNodeIds: [nodeId(46_000, 59_000)],
      placeIds: [placeId("community")],
    },
    {
      id: "building/north-works",
      footprint: rectangle(48_000, 73_000, 72_000, 89_000),
      heightCm: height(3),
      entranceNodeIds: [nodeId(74_000, 71_000)],
      placeIds: [placeId("workplace")],
    },
    {
      id: "building/quay-atelier",
      footprint: rectangle(88_000, 18_000, 108_000, 27_000),
      heightCm: height(4),
      entranceNodeIds: [nodeId(86_000, 29_000)],
      placeIds: [],
    },
    {
      id: "building/service-house",
      footprint: rectangle(22_000, 43_000, 30_000, 57_000),
      heightCm: height(5),
      entranceNodeIds: [nodeId(34_000, 59_000)],
      placeIds: [placeId("service")],
    },
    {
      id: "building/waterfront-store",
      footprint: rectangle(12_000, 18_000, 30_000, 27_000),
      heightCm: height(6),
      entranceNodeIds: [nodeId(34_000, 29_000)],
      placeIds: [],
    },
  ];
  const publicSpaces: CityPublicSpace[] = [
    {
      id: "public-space/lantern-tide-plaza",
      kind: "plaza",
      boundary: rectangle(86_000, 41_000, 112_000, 59_000),
      pedestrianNodeIds: [
        nodeId(86_000, 41_000),
        nodeId(86_000, 59_000),
        nodeId(110_000, 41_000),
        nodeId(110_000, 59_000),
      ].sort(compareText),
      placeIds: [placeId("festival")],
    },
    {
      id: "public-space/mariners-garden",
      kind: "park",
      boundary: rectangle(8_000, 71_000, 34_000, 94_000),
      pedestrianNodeIds: [
        nodeId(10_000, 71_000),
        nodeId(10_000, 91_000),
        nodeId(34_000, 71_000),
        nodeId(34_000, 91_000),
      ].sort(compareText),
      placeIds: [],
    },
    {
      id: "public-space/transit-square",
      kind: "transit-square",
      boundary: rectangle(46_000, 16_000, 74_000, 29_000),
      pedestrianNodeIds: [
        nodeId(46_000, 16_000),
        nodeId(46_000, 29_000),
        nodeId(74_000, 16_000),
        nodeId(74_000, 29_000),
      ].sort(compareText),
      placeIds: [placeId("transport")],
    },
    {
      id: "public-space/waterfront",
      kind: "waterfront",
      boundary: rectangle(0, 0, 120_000, 16_000),
      pedestrianNodeIds: eastCoordinates
        .map((eastCm) => nodeId(eastCm, 16_000))
        .sort(compareText),
      placeIds: [],
    },
  ];
  const adjacentByNode = new Map<string, string[]>();
  for (const edge of edges) {
    adjacentByNode.set(edge.fromNodeId, [
      ...(adjacentByNode.get(edge.fromNodeId) ?? []),
      edge.id,
    ]);
    adjacentByNode.set(edge.toNodeId, [
      ...(adjacentByNode.get(edge.toNodeId) ?? []),
      edge.id,
    ]);
  }
  const placesByNode = new Map<string, string[]>();
  for (const place of places)
    placesByNode.set(place.entranceNodeId, [
      ...(placesByNode.get(place.entranceNodeId) ?? []),
      place.id,
    ]);
  const pedestrianNodes: PedestrianNode[] = [];
  for (const northCm of northCoordinates)
    for (const eastCm of eastCoordinates) {
      const id = nodeId(eastCm, northCm);
      pedestrianNodes.push({
        id,
        position: point(eastCm, northCm),
        adjacentEdgeIds: (adjacentByNode.get(id) ?? []).sort(compareText),
        placeIds: (placesByNode.get(id) ?? []).sort(compareText),
      });
    }
  return {
    schema: 1,
    seed,
    settlementId: "place/brindle-bay",
    bounds,
    roads: byId(roads),
    sidewalks: byId(sidewalks),
    crossings: byId(crossings),
    buildings: byId(buildings),
    publicSpaces: byId(publicSpaces),
    places,
    pedestrianNodes: byId(pedestrianNodes),
    pedestrianEdges: edges,
  };
}

/**
 * Builds derived, non-authoritative local geometry. Pixels, cameras, clocks, and
 * simulation state are intentionally absent from both the query and city hash.
 */
export function createCityProjection(
  query: CityProjectionQuery,
): CityProjection {
  if (query.schema !== 1) throw new RangeError("unsupported city query schema");
  if (typeof query.seed !== "string" || query.seed.length === 0)
    throw new RangeError("city query seed must not be empty");
  if (query.settlementId !== "place/brindle-bay")
    throw new RangeError("unsupported city settlement");
  const draft = createDraft(query.seed);
  const city = deepFreeze({ ...draft, cityHash: cityProjectionHash(draft) });
  validateCityProjection(city);
  return city;
}
