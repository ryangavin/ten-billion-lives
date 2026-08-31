import { CanonicalWriter, fnv1a64 } from "@ten-billion-lives/sim";

import type { PersonItineraryPoint } from "./itinerary.js";

export const VISUAL_PHASE_PARTS = 1_000_000;

export interface VisualTime {
  readonly tick: bigint;
  readonly phasePermillion: number;
}

export interface TrajectoryMapPoint {
  readonly eastCm: number;
  readonly northCm: number;
  readonly upCm: number;
}

export interface TrajectoryCityPlace {
  readonly id: string;
  readonly entranceNodeId: string;
}

export interface TrajectoryPedestrianNode {
  readonly id: string;
  readonly position: TrajectoryMapPoint;
  readonly adjacentEdgeIds: readonly string[];
  readonly placeIds: readonly string[];
}

export interface TrajectoryPedestrianEdge {
  readonly id: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly path: readonly TrajectoryMapPoint[];
  readonly closedInBranch: "closure" | null;
}

/** Structural subset of the frozen CityProjection consumed by trajectories. */
export interface TrajectoryCityProjection {
  readonly schema: 1;
  readonly seed: string;
  readonly settlementId: "place/brindle-bay";
  readonly places: readonly TrajectoryCityPlace[];
  readonly pedestrianNodes: readonly TrajectoryPedestrianNode[];
  readonly pedestrianEdges: readonly TrajectoryPedestrianEdge[];
  readonly cityHash: string;
}

export interface PedestrianTrajectoryQuery {
  readonly schema: 1;
  readonly branch: "baseline" | "closure";
  readonly stateHash: string;
  readonly eventHash: string;
  readonly personId: string;
  readonly itinerary: readonly PersonItineraryPoint[];
  readonly city: TrajectoryCityProjection;
  readonly time: VisualTime;
}

export interface PedestrianPose {
  readonly personId: string;
  readonly time: VisualTime;
  readonly mode: "dwelling" | "walking";
  readonly position: TrajectoryMapPoint;
  readonly headingMilliTurns: number;
  readonly stridePermillion: number;
  readonly routeId: string | null;
  readonly edgeId: string | null;
  readonly activity: PersonItineraryPoint["activity"];
  readonly originPlaceId: string;
  readonly destinationPlaceId: string;
  readonly trajectoryHash: string;
}

export type PedestrianTrajectoryErrorCode =
  | "INVALID_QUERY"
  | "INVALID_TIME"
  | "INVALID_CITY"
  | "INVALID_ITINERARY"
  | "MISSING_PLACE"
  | "UNREACHABLE_ROUTE"
  | "BRANCH_MISMATCH";

export class PedestrianTrajectoryError extends Error {
  readonly code: PedestrianTrajectoryErrorCode;

  constructor(code: PedestrianTrajectoryErrorCode, message: string) {
    super(message);
    this.name = "PedestrianTrajectoryError";
    this.code = code;
  }
}

interface RouteStep {
  readonly edge: TrajectoryPedestrianEdge;
  readonly forward: boolean;
}

interface MotionAnchor {
  readonly originPlaceId: string;
  readonly destinationPlaceId: string;
  readonly progressPermillion: number;
}

interface RouteSample {
  readonly position: TrajectoryMapPoint;
  readonly headingMilliTurns: number;
  readonly edgeId: string | null;
}

const MAX_U64 = 0xffff_ffff_ffff_ffffn;

export function createVisualTime(
  tick: bigint,
  phasePermillion: number,
): VisualTime {
  if (typeof tick !== "bigint" || tick < 0n)
    throw new RangeError("visual time tick must be a nonnegative bigint");
  if (
    !Number.isSafeInteger(phasePermillion) ||
    phasePermillion < 0 ||
    phasePermillion >= VISUAL_PHASE_PARTS
  )
    throw new RangeError(
      "visual time phasePermillion must be an integer from 0 through 999999",
    );
  return Object.freeze({ tick, phasePermillion });
}

function failure(code: PedestrianTrajectoryErrorCode, message: string): never {
  throw new PedestrianTrajectoryError(code, message);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function samePoint(
  left: TrajectoryMapPoint,
  right: TrajectoryMapPoint,
): boolean {
  return (
    left.eastCm === right.eastCm &&
    left.northCm === right.northCm &&
    left.upCm === right.upCm
  );
}

function assertPoint(point: TrajectoryMapPoint, description: string): void {
  for (const [axis, value] of Object.entries(point))
    if (
      !Number.isSafeInteger(value) ||
      value < -0x8000_0000 ||
      value > 0x7fff_ffff
    )
      failure(
        "INVALID_CITY",
        `${description} ${axis} must be a signed 32-bit integer centimeter coordinate`,
      );
}

function assertCanonicalIds(
  values: readonly Readonly<{ id: string }>[],
  description: string,
): void {
  for (let index = 0; index < values.length; index += 1) {
    const id = values[index]?.id ?? "";
    if (id.length === 0)
      failure("INVALID_CITY", `${description} contains an empty ID`);
    if (index > 0 && compareText(values[index - 1]?.id ?? "", id) >= 0)
      failure(
        "INVALID_CITY",
        `${description} IDs must be unique and canonically sorted`,
      );
  }
}

function segmentLength(
  start: TrajectoryMapPoint,
  end: TrajectoryMapPoint,
): number {
  const length =
    Math.abs(end.eastCm - start.eastCm) +
    Math.abs(end.northCm - start.northCm) +
    Math.abs(end.upCm - start.upCm);
  if (!Number.isSafeInteger(length) || length <= 0)
    failure(
      "INVALID_CITY",
      "pedestrian edge path segments must have a positive safe-integer length",
    );
  return length;
}

function edgeLength(edge: TrajectoryPedestrianEdge): number {
  let length = 0;
  for (let index = 1; index < edge.path.length; index += 1) {
    const start = edge.path[index - 1];
    const end = edge.path[index];
    if (start === undefined || end === undefined)
      failure("INVALID_CITY", `edge ${edge.id} has invalid path geometry`);
    length += segmentLength(start, end);
    if (!Number.isSafeInteger(length))
      failure("INVALID_CITY", `edge ${edge.id} path length is unsafe`);
  }
  return length;
}

function validateCity(city: TrajectoryCityProjection): void {
  if (
    city.schema !== 1 ||
    city.seed.length === 0 ||
    city.settlementId !== "place/brindle-bay" ||
    city.cityHash.length === 0
  )
    failure("INVALID_CITY", "trajectory city projection header is invalid");
  if (
    city.places.length === 0 ||
    city.pedestrianNodes.length === 0 ||
    city.pedestrianEdges.length === 0
  )
    failure("INVALID_CITY", "trajectory city graph must not be empty");
  assertCanonicalIds(city.places, "city places");
  assertCanonicalIds(city.pedestrianNodes, "pedestrian nodes");
  assertCanonicalIds(city.pedestrianEdges, "pedestrian edges");
  const nodes = new Map(city.pedestrianNodes.map((node) => [node.id, node]));
  const edges = new Map(city.pedestrianEdges.map((edge) => [edge.id, edge]));
  const places = new Map(city.places.map((place) => [place.id, place]));
  for (const place of city.places)
    if (!nodes.has(place.entranceNodeId))
      failure(
        "INVALID_CITY",
        `place ${place.id} references missing entrance ${place.entranceNodeId}`,
      );
  for (const node of city.pedestrianNodes) {
    assertPoint(node.position, `node ${node.id}`);
    if (
      [...node.adjacentEdgeIds].sort(compareText).join("\0") !==
      node.adjacentEdgeIds.join("\0")
    )
      failure(
        "INVALID_CITY",
        `node ${node.id} edge adjacency is not canonical`,
      );
    if (
      [...node.placeIds].sort(compareText).join("\0") !==
      node.placeIds.join("\0")
    )
      failure(
        "INVALID_CITY",
        `node ${node.id} place adjacency is not canonical`,
      );
    for (const edgeId of node.adjacentEdgeIds) {
      const edge = edges.get(edgeId);
      if (
        edge === undefined ||
        (edge.fromNodeId !== node.id && edge.toNodeId !== node.id)
      )
        failure(
          "INVALID_CITY",
          `node ${node.id} references nonadjacent edge ${edgeId}`,
        );
    }
    for (const placeId of node.placeIds)
      if (places.get(placeId)?.entranceNodeId !== node.id)
        failure(
          "INVALID_CITY",
          `node ${node.id} references nonentrance place ${placeId}`,
        );
  }
  for (const edge of city.pedestrianEdges) {
    const from = nodes.get(edge.fromNodeId);
    const to = nodes.get(edge.toNodeId);
    if (from === undefined || to === undefined)
      failure("INVALID_CITY", `edge ${edge.id} has a dangling node reference`);
    if (edge.closedInBranch !== null && edge.closedInBranch !== "closure")
      failure("INVALID_CITY", `edge ${edge.id} has an invalid branch closure`);
    if (edge.path.length < 2)
      failure("INVALID_CITY", `edge ${edge.id} path requires two points`);
    for (const point of edge.path) assertPoint(point, `edge ${edge.id}`);
    if (
      !samePoint(edge.path[0] ?? from.position, from.position) ||
      !samePoint(edge.path.at(-1) ?? to.position, to.position)
    )
      failure(
        "INVALID_CITY",
        `edge ${edge.id} path endpoints do not match its nodes`,
      );
    edgeLength(edge);
  }
}

function validateItinerary(query: PedestrianTrajectoryQuery): void {
  if (query.itinerary.length === 0)
    failure("INVALID_ITINERARY", "pedestrian itinerary must not be empty");
  let previousTick: bigint | null = null;
  for (const point of query.itinerary) {
    if (point.personId !== query.personId)
      failure(
        "INVALID_ITINERARY",
        `itinerary person ${point.personId} does not match ${query.personId}`,
      );
    if (point.tick < 0n || point.tick > MAX_U64)
      failure("INVALID_ITINERARY", "itinerary tick is outside uint64 range");
    if (previousTick !== null && point.tick <= previousTick)
      failure(
        "INVALID_ITINERARY",
        "itinerary ticks must be unique and canonically ordered",
      );
    if (
      point.route !== null &&
      (!Number.isSafeInteger(point.route.progressPermille) ||
        point.route.progressPermille < 0 ||
        point.route.progressPermille > 1_000)
    )
      failure(
        "INVALID_ITINERARY",
        `itinerary route at tick ${point.tick} has invalid progress`,
      );
    if (
      query.branch === "baseline" &&
      point.tick === query.time.tick &&
      point.route?.reason === "closure detour"
    )
      failure(
        "BRANCH_MISMATCH",
        "closure-detour itinerary cannot be queried on the baseline branch",
      );
    previousTick = point.tick;
  }
}

function placeNode(
  city: TrajectoryCityProjection,
  placeId: string,
): TrajectoryPedestrianNode {
  const place = city.places.find((candidate) => candidate.id === placeId);
  if (place === undefined)
    failure("MISSING_PLACE", `trajectory city is missing place ${placeId}`);
  const node = city.pedestrianNodes.find(
    (candidate) => candidate.id === place.entranceNodeId,
  );
  if (node === undefined)
    failure(
      "INVALID_CITY",
      `trajectory city is missing entrance node ${place.entranceNodeId}`,
    );
  return node;
}

function openRoute(
  city: TrajectoryCityProjection,
  branch: "baseline" | "closure",
  originPlaceId: string,
  destinationPlaceId: string,
): readonly RouteStep[] {
  const origin = placeNode(city, originPlaceId);
  const destination = placeNode(city, destinationPlaceId);
  if (origin.id === destination.id) return Object.freeze([]);
  const outgoing = new Map<string, RouteStep[]>();
  for (const edge of city.pedestrianEdges) {
    if (edge.closedInBranch === branch) continue;
    outgoing.set(edge.fromNodeId, [
      ...(outgoing.get(edge.fromNodeId) ?? []),
      { edge, forward: true },
    ]);
    outgoing.set(edge.toNodeId, [
      ...(outgoing.get(edge.toNodeId) ?? []),
      { edge, forward: false },
    ]);
  }
  for (const steps of outgoing.values())
    steps.sort((left, right) => compareText(left.edge.id, right.edge.id));
  const best = new Map<string, Readonly<{ distance: number; pathKey: string }>>(
    [[origin.id, { distance: 0, pathKey: "" }]],
  );
  const previous = new Map<
    string,
    Readonly<{ nodeId: string; step: RouteStep }>
  >();
  const remaining = new Set([origin.id]);
  const settled = new Set<string>();
  while (remaining.size > 0) {
    const nodeId = [...remaining].sort((left, right) => {
      const leftBest = best.get(left);
      const rightBest = best.get(right);
      if (leftBest === undefined || rightBest === undefined)
        return compareText(left, right);
      return leftBest.distance === rightBest.distance
        ? compareText(leftBest.pathKey, rightBest.pathKey)
        : leftBest.distance - rightBest.distance;
    })[0];
    if (nodeId === undefined) break;
    remaining.delete(nodeId);
    if (settled.has(nodeId)) continue;
    settled.add(nodeId);
    if (nodeId === destination.id) break;
    const current = best.get(nodeId);
    if (current === undefined) continue;
    for (const step of outgoing.get(nodeId) ?? []) {
      const nextNodeId = step.forward
        ? step.edge.toNodeId
        : step.edge.fromNodeId;
      if (settled.has(nextNodeId)) continue;
      const distance = current.distance + edgeLength(step.edge);
      if (!Number.isSafeInteger(distance))
        failure("INVALID_CITY", "pedestrian route length is unsafe");
      const pathKey = `${current.pathKey}\0${step.edge.id}${step.forward ? ">" : "<"}`;
      const known = best.get(nextNodeId);
      if (
        known === undefined ||
        distance < known.distance ||
        (distance === known.distance && compareText(pathKey, known.pathKey) < 0)
      ) {
        best.set(nextNodeId, { distance, pathKey });
        previous.set(nextNodeId, { nodeId, step });
        remaining.add(nextNodeId);
      }
    }
  }
  if (!best.has(destination.id))
    failure(
      "UNREACHABLE_ROUTE",
      `place ${destinationPlaceId} is unreachable from ${originPlaceId} on ${branch}`,
    );
  const steps: RouteStep[] = [];
  let cursor = destination.id;
  while (cursor !== origin.id) {
    const entry = previous.get(cursor);
    if (entry === undefined)
      failure("UNREACHABLE_ROUTE", "pedestrian route reconstruction failed");
    steps.push(entry.step);
    cursor = entry.nodeId;
  }
  return Object.freeze(steps.reverse());
}

function routePoints(steps: readonly RouteStep[]): readonly Readonly<{
  point: TrajectoryMapPoint;
  edgeId: string;
}>[] {
  const result: Array<Readonly<{ point: TrajectoryMapPoint; edgeId: string }>> =
    [];
  for (const step of steps) {
    const points = step.forward
      ? step.edge.path
      : [...step.edge.path].reverse();
    for (const point of points) {
      const previous = result.at(-1);
      if (previous !== undefined && samePoint(previous.point, point)) continue;
      result.push(Object.freeze({ point, edgeId: step.edge.id }));
    }
  }
  return Object.freeze(result);
}

function headingMilliTurns(
  start: TrajectoryMapPoint,
  end: TrajectoryMapPoint,
): number {
  const east = end.eastCm - start.eastCm;
  const north = end.northCm - start.northCm;
  const absEast = Math.abs(east);
  const absNorth = Math.abs(north);
  if (absEast === 0 && absNorth === 0) return end.upCm >= start.upCm ? 0 : 500;
  const firstQuadrant =
    absEast >= absNorth
      ? Math.floor((125 * absNorth) / absEast)
      : 250 - Math.floor((125 * absEast) / absNorth);
  if (east >= 0 && north >= 0) return firstQuadrant;
  if (east < 0 && north >= 0) return 500 - firstQuadrant;
  if (east < 0) return 500 + firstQuadrant;
  return (1_000 - firstQuadrant) % 1_000;
}

function sampleRoute(
  steps: readonly RouteStep[],
  progressPermillion: number,
): RouteSample {
  const points = routePoints(steps);
  const first = points[0];
  if (first === undefined)
    failure("UNREACHABLE_ROUTE", "cannot sample an empty pedestrian route");
  let totalLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (start === undefined || end === undefined) continue;
    totalLength += segmentLength(start.point, end.point);
  }
  const target =
    (BigInt(totalLength) * BigInt(progressPermillion)) /
    BigInt(VISUAL_PHASE_PARTS);
  let traversed = 0n;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (start === undefined || end === undefined) continue;
    const length = BigInt(segmentLength(start.point, end.point));
    if (target <= traversed + length) {
      const offset = target - traversed;
      const interpolate = (from: number, to: number) =>
        from + Number((BigInt(to - from) * offset) / length);
      return Object.freeze({
        position: Object.freeze({
          eastCm: interpolate(start.point.eastCm, end.point.eastCm),
          northCm: interpolate(start.point.northCm, end.point.northCm),
          upCm: interpolate(start.point.upCm, end.point.upCm),
        }),
        headingMilliTurns: headingMilliTurns(start.point, end.point),
        edgeId: end.edgeId,
      });
    }
    traversed += length;
  }
  const last = points.at(-1) ?? first;
  const before = points.at(-2) ?? first;
  return Object.freeze({
    position: last.point,
    headingMilliTurns: headingMilliTurns(before.point, last.point),
    edgeId: last.edgeId,
  });
}

function stationaryPlace(point: PersonItineraryPoint): string | null {
  return point.activity === "transit" ? null : point.location.semanticId;
}

function neighboringStationaryPlace(
  itinerary: readonly PersonItineraryPoint[],
  index: number,
  direction: -1 | 1,
): string | null {
  for (
    let cursor = index + direction;
    cursor >= 0 && cursor < itinerary.length;
    cursor += direction
  ) {
    const point = itinerary[cursor];
    if (point === undefined) break;
    const placeId = stationaryPlace(point);
    if (placeId !== null) return placeId;
  }
  return null;
}

function anchorFor(
  itinerary: readonly PersonItineraryPoint[],
  index: number,
): MotionAnchor {
  const point = itinerary[index];
  if (point === undefined)
    failure("INVALID_ITINERARY", "missing itinerary anchor");
  if (point.activity === "transit") {
    const originPlaceId = neighboringStationaryPlace(itinerary, index, -1);
    const destinationPlaceId =
      point.route?.destinationId ??
      neighboringStationaryPlace(itinerary, index, 1);
    if (originPlaceId === null || destinationPlaceId === null)
      failure(
        "INVALID_ITINERARY",
        `transit itinerary at tick ${point.tick} lacks an origin or destination`,
      );
    return Object.freeze({
      originPlaceId,
      destinationPlaceId,
      progressPermillion: (point.route?.progressPermille ?? 0) * 1_000,
    });
  }
  const placeId = stationaryPlace(point);
  if (placeId === null)
    failure("INVALID_ITINERARY", `tick ${point.tick} lacks a semantic place`);
  const previous = itinerary[index - 1];
  if (previous?.activity === "transit") {
    const originPlaceId = neighboringStationaryPlace(itinerary, index - 1, -1);
    if (originPlaceId === null)
      failure("INVALID_ITINERARY", "arrival itinerary lacks an origin place");
    return Object.freeze({
      originPlaceId,
      destinationPlaceId: placeId,
      progressPermillion: VISUAL_PHASE_PARTS,
    });
  }
  const next = itinerary[index + 1];
  if (next?.activity === "transit") {
    const destinationPlaceId =
      next.route?.destinationId ??
      neighboringStationaryPlace(itinerary, index + 1, 1);
    if (destinationPlaceId === null)
      failure(
        "INVALID_ITINERARY",
        "departure itinerary lacks a destination place",
      );
    return Object.freeze({
      originPlaceId: placeId,
      destinationPlaceId,
      progressPermillion: 0,
    });
  }
  return Object.freeze({
    originPlaceId: placeId,
    destinationPlaceId: placeId,
    progressPermillion: 0,
  });
}

function anchorPosition(
  city: TrajectoryCityProjection,
  branch: "baseline" | "closure",
  anchor: MotionAnchor,
): TrajectoryMapPoint {
  if (anchor.originPlaceId === anchor.destinationPlaceId)
    return placeNode(city, anchor.originPlaceId).position;
  return sampleRoute(
    openRoute(city, branch, anchor.originPlaceId, anchor.destinationPlaceId),
    anchor.progressPermillion,
  ).position;
}

function routeId(
  steps: readonly RouteStep[],
  branch: "baseline" | "closure",
  originPlaceId: string,
  destinationPlaceId: string,
): string {
  const writer = new CanonicalWriter("pedestrian-route", 1)
    .text(branch)
    .text(originPlaceId)
    .text(destinationPlaceId);
  for (const step of steps) writer.text(step.edge.id).u32(step.forward ? 1 : 0);
  return `route/${fnv1a64(writer.bytes()).toString(16).padStart(16, "0")}`;
}

function trajectoryHash(
  query: PedestrianTrajectoryQuery,
  pose: Omit<PedestrianPose, "trajectoryHash">,
): string {
  const writer = new CanonicalWriter("pedestrian-trajectory", 1)
    .u32(query.schema)
    .text(query.branch)
    .text(query.stateHash)
    .text(query.eventHash)
    .text(query.personId)
    .text(query.city.cityHash)
    .u64(query.time.tick)
    .u32(query.time.phasePermillion);
  for (const point of query.itinerary) {
    writer
      .u64(point.tick)
      .text(point.activity)
      .text(point.location.semanticId)
      .text(point.semanticHash)
      .text(point.route?.destinationId ?? "")
      .u32(point.route?.progressPermille ?? 0)
      .text(point.route?.reason ?? "");
    for (const edgeId of point.route?.edgeIds ?? []) writer.text(edgeId);
  }
  writer
    .text(pose.mode)
    .i32(pose.position.eastCm)
    .i32(pose.position.northCm)
    .i32(pose.position.upCm)
    .u32(pose.headingMilliTurns)
    .u32(pose.stridePermillion)
    .text(pose.routeId ?? "")
    .text(pose.edgeId ?? "")
    .text(pose.activity)
    .text(pose.originPlaceId)
    .text(pose.destinationPlaceId);
  return fnv1a64(writer.bytes()).toString(16).padStart(16, "0");
}

export function queryPedestrianPose(
  query: PedestrianTrajectoryQuery,
): PedestrianPose {
  if (
    query.schema !== 1 ||
    query.personId.length === 0 ||
    query.stateHash.length === 0 ||
    query.eventHash.length === 0 ||
    (query.branch !== "baseline" && query.branch !== "closure")
  )
    failure("INVALID_QUERY", "pedestrian trajectory query header is invalid");
  let time: VisualTime;
  try {
    time = createVisualTime(query.time.tick, query.time.phasePermillion);
  } catch (error) {
    failure(
      "INVALID_TIME",
      error instanceof Error ? error.message : "visual time is invalid",
    );
  }
  if (time.tick > MAX_U64)
    failure("INVALID_TIME", "visual time tick is outside uint64 range");
  validateCity(query.city);
  validateItinerary(query);
  const index = query.itinerary.findIndex((point) => point.tick === time.tick);
  if (index < 0)
    failure(
      "INVALID_ITINERARY",
      `itinerary does not contain visual tick ${time.tick}`,
    );
  const current = query.itinerary[index];
  if (current === undefined)
    failure("INVALID_ITINERARY", "current itinerary point is missing");
  const currentAnchor = anchorFor(query.itinerary, index);
  const next = query.itinerary[index + 1];
  const nextAnchor =
    next?.tick === time.tick + 1n
      ? anchorFor(query.itinerary, index + 1)
      : null;
  if (time.phasePermillion > 0 && nextAnchor === null)
    failure(
      "INVALID_ITINERARY",
      `itinerary does not contain the tick after ${time.tick}`,
    );
  const currentPosition = anchorPosition(
    query.city,
    query.branch,
    currentAnchor,
  );
  const nextPosition =
    nextAnchor === null
      ? currentPosition
      : anchorPosition(query.city, query.branch, nextAnchor);

  let mode: PedestrianPose["mode"] = "dwelling";
  let position = currentPosition;
  let heading = 0;
  let edgeId: string | null = null;
  let resolvedRouteId: string | null = null;
  let originPlaceId = stationaryPlace(current) ?? currentAnchor.originPlaceId;
  let destinationPlaceId = originPlaceId;

  if (nextAnchor !== null && !samePoint(currentPosition, nextPosition)) {
    let origin: string;
    let destination: string;
    let progress: number;
    if (
      currentAnchor.originPlaceId === nextAnchor.originPlaceId &&
      currentAnchor.destinationPlaceId === nextAnchor.destinationPlaceId
    ) {
      origin = currentAnchor.originPlaceId;
      destination = currentAnchor.destinationPlaceId;
      const difference =
        nextAnchor.progressPermillion - currentAnchor.progressPermillion;
      progress =
        currentAnchor.progressPermillion +
        Number(
          (BigInt(difference) * BigInt(time.phasePermillion)) /
            BigInt(VISUAL_PHASE_PARTS),
        );
    } else if (
      currentAnchor.originPlaceId === currentAnchor.destinationPlaceId &&
      nextAnchor.originPlaceId === nextAnchor.destinationPlaceId
    ) {
      origin = currentAnchor.destinationPlaceId;
      destination = nextAnchor.destinationPlaceId;
      progress = time.phasePermillion;
    } else {
      failure(
        "INVALID_ITINERARY",
        `incompatible trajectory anchors at tick ${time.tick}`,
      );
    }
    const steps = openRoute(query.city, query.branch, origin, destination);
    const sample = sampleRoute(steps, progress);
    position = sample.position;
    heading = sample.headingMilliTurns;
    edgeId = sample.edgeId;
    resolvedRouteId = routeId(steps, query.branch, origin, destination);
    originPlaceId = origin;
    destinationPlaceId = destination;
    if (current.activity === "transit" || time.phasePermillion > 0)
      mode = "walking";
  }

  if (mode === "dwelling") {
    position = currentPosition;
    heading = 0;
    edgeId = null;
    resolvedRouteId = null;
    originPlaceId = stationaryPlace(current) ?? currentAnchor.originPlaceId;
    destinationPlaceId = originPlaceId;
  }

  const stridePermillion =
    mode === "walking"
      ? Number(
          (time.tick * BigInt(VISUAL_PHASE_PARTS) * 4n +
            BigInt(time.phasePermillion) * 4n +
            (fnv1a64(
              new CanonicalWriter("pedestrian-stride", 1)
                .text(query.personId)
                .bytes(),
            ) %
              BigInt(VISUAL_PHASE_PARTS))) %
            BigInt(VISUAL_PHASE_PARTS),
        )
      : 0;
  const withoutHash = Object.freeze({
    personId: query.personId,
    time,
    mode,
    position: Object.freeze({ ...position }),
    headingMilliTurns: heading,
    stridePermillion,
    routeId: resolvedRouteId,
    edgeId,
    activity: current.activity,
    originPlaceId,
    destinationPlaceId,
  });
  return Object.freeze({
    ...withoutHash,
    trajectoryHash: trajectoryHash(query, withoutHash),
  });
}
