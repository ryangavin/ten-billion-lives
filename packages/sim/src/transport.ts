import { CanonicalWriter, fnv1a64, largestRemainder } from "./deterministic.js";
import { createFieldState, type CohortField } from "./fields.js";
import type { FictionalWorld } from "./world.js";

export const PLANETARY_DAY_TICKS = 24;

export type TransportMode = "walking" | "local" | "intercity";
export type TransportNodeKind = "neighborhood" | "settlement" | "region";
export type DailyActivity =
  "home" | "work" | "school" | "service" | "leisure" | "sleep";

export interface TransportNode {
  readonly id: string;
  readonly kind: TransportNodeKind;
  readonly population: bigint;
  readonly parentId?: string;
}

export interface TransportEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly mode: TransportMode;
  readonly capacity: bigint;
}

export interface SignatureFestival {
  readonly id: "festival/lantern-confluence";
  readonly name: "Lantern Confluence";
  readonly targetRegionNodeId: string;
  readonly arrivalTick: 17;
  readonly peakTick: 19;
  readonly dispersalEndTick: 22;
  readonly peakAttendance: bigint;
}

export interface TransportGraph {
  readonly schemaVersion: 1;
  readonly nodes: readonly TransportNode[];
  readonly edges: readonly TransportEdge[];
  readonly festival: SignatureFestival;
  readonly graphHash: string;
}

export interface TransportCommand {
  readonly id: string;
  readonly tick: number;
  readonly type: "close" | "open";
  readonly edgeId: string;
}

export interface ActivityCounts {
  readonly home: bigint;
  readonly work: bigint;
  readonly school: bigint;
  readonly service: bigint;
  readonly leisure: bigint;
  readonly sleep: bigint;
}

export interface FestivalOrigin {
  readonly regionNodeId: string;
  readonly attendance: bigint;
}

export interface EdgeFlow {
  readonly edgeId: string;
  readonly mode: TransportMode;
  readonly count: bigint;
  readonly capacity: bigint;
  readonly sourceDemand: bigint;
  readonly closed: boolean;
  readonly bottleneck: boolean;
  readonly reason:
    | "night settlement"
    | "morning commute"
    | "daytime circulation"
    | "lunch and service"
    | "evening return"
    | "festival convergence"
    | "festival dispersal"
    | "route closed";
}

export interface PlanetaryDayTick {
  readonly tick: number;
  readonly cohortActivities: Readonly<{
    young: ActivityCounts;
    adult: ActivityCounts;
    older: ActivityCounts;
  }>;
  readonly activityTotals: ActivityCounts;
  readonly edgeFlows: readonly EdgeFlow[];
  readonly edgeFlowHash: string;
  readonly festivalAttendance: bigint;
  readonly festivalOrigins: readonly FestivalOrigin[];
  readonly closedEdgeIds: readonly string[];
  readonly invariantIssues: readonly string[];
}

export interface PlanetaryDay {
  readonly schemaVersion: 1;
  readonly seed: string;
  readonly graph: TransportGraph;
  readonly commands: readonly TransportCommand[];
  readonly ticks: readonly PlanetaryDayTick[];
  readonly dayHash: string;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function positiveCapacity(population: bigint, divisor: bigint): bigint {
  return population / divisor > 0n ? population / divisor : 1n;
}

function hashGraph(
  nodes: readonly TransportNode[],
  edges: readonly TransportEdge[],
): string {
  const writer = new CanonicalWriter("transport-graph", 1);
  for (const node of nodes)
    writer
      .text(node.id)
      .text(node.kind)
      .u64(node.population)
      .text(node.parentId ?? "");
  for (const edge of edges)
    writer
      .text(edge.id)
      .text(edge.from)
      .text(edge.to)
      .text(edge.mode)
      .u64(edge.capacity);
  return fnv1a64(writer.bytes()).toString(16).padStart(16, "0");
}

export function buildTransportGraph(world: FictionalWorld): TransportGraph {
  const nodes: TransportNode[] = [];
  const edges: TransportEdge[] = [];
  const addEdge = (
    from: string,
    to: string,
    mode: TransportMode,
    capacity: bigint,
  ): void => {
    edges.push(
      Object.freeze({
        id: `${mode}:${from}>${to}`,
        from,
        to,
        mode,
        capacity,
      }),
    );
  };

  for (const region of world.regions)
    nodes.push(
      Object.freeze({
        id: `region/${region.id}`,
        kind: "region" as const,
        population: region.population,
      }),
    );
  for (const settlement of world.settlements) {
    const cell =
      world.cells[settlement.row * world.columns + settlement.column];
    if (cell === undefined)
      throw new Error(`missing settlement cell: ${settlement.id}`);
    const settlementNodeId = `settlement/${settlement.id}`;
    const regionNodeId = `region/${cell.regionId}`;
    nodes.push(
      Object.freeze({
        id: settlementNodeId,
        kind: "settlement" as const,
        population: settlement.population,
        parentId: regionNodeId,
      }),
    );
    const neighborhoodPopulations = largestRemainder(
      settlement.population,
      settlement.neighborhoodIds.map(() => 1n),
    );
    settlement.neighborhoodIds.forEach((neighborhoodId, index) => {
      const nodeId = `neighborhood/${neighborhoodId}`;
      const population = neighborhoodPopulations[index] ?? 0n;
      nodes.push(
        Object.freeze({
          id: nodeId,
          kind: "neighborhood" as const,
          population,
          parentId: settlementNodeId,
        }),
      );
      const capacity = positiveCapacity(population, 8n);
      addEdge(nodeId, settlementNodeId, "walking", capacity);
      addEdge(settlementNodeId, nodeId, "walking", capacity);
    });
    const localCapacity = positiveCapacity(settlement.population, 12n);
    addEdge(settlementNodeId, regionNodeId, "local", localCapacity);
    addEdge(regionNodeId, settlementNodeId, "local", localCapacity);
  }

  const regionNodes = nodes
    .filter((node) => node.kind === "region")
    .sort((left, right) => compareText(left.id, right.id));
  regionNodes.forEach((node, index) => {
    const previous =
      regionNodes[(index - 1 + regionNodes.length) % regionNodes.length];
    const next = regionNodes[(index + 1) % regionNodes.length];
    for (const destination of [previous, next])
      if (destination !== undefined && destination.id !== node.id)
        addEdge(
          node.id,
          destination.id,
          "intercity",
          positiveCapacity(node.population, 20n),
        );
  });
  nodes.sort((left, right) => compareText(left.id, right.id));
  edges.sort((left, right) => compareText(left.id, right.id));
  const target = regionNodes[Math.floor(regionNodes.length / 2)];
  if (target === undefined)
    throw new Error("transport graph requires a region");
  const festival = Object.freeze({
    id: "festival/lantern-confluence" as const,
    name: "Lantern Confluence" as const,
    targetRegionNodeId: target.id,
    arrivalTick: 17 as const,
    peakTick: 19 as const,
    dispersalEndTick: 22 as const,
    peakAttendance: world.totalPopulation / 100_000n,
  });
  return Object.freeze({
    schemaVersion: 1,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    festival,
    graphHash: hashGraph(nodes, edges),
  });
}

export function createSignatureCommandLog(
  graph: TransportGraph,
): readonly TransportCommand[] {
  const edge = graph.edges.find((candidate) => candidate.mode === "intercity");
  if (edge === undefined)
    throw new Error("signature closure requires an intercity edge");
  return Object.freeze([
    Object.freeze({
      id: "intervention/close",
      tick: 7,
      type: "close" as const,
      edgeId: edge.id,
    }),
    Object.freeze({
      id: "intervention/reopen",
      tick: 9,
      type: "open" as const,
      edgeId: edge.id,
    }),
  ]);
}

const activityOrder = [
  "home",
  "work",
  "school",
  "service",
  "leisure",
  "sleep",
] as const;

function freezeActivityCounts(allocation: readonly bigint[]): ActivityCounts {
  return Object.freeze({
    home: allocation[0] ?? 0n,
    work: allocation[1] ?? 0n,
    school: allocation[2] ?? 0n,
    service: allocation[3] ?? 0n,
    leisure: allocation[4] ?? 0n,
    sleep: allocation[5] ?? 0n,
  });
}

function activityWeights(
  cohort: keyof CohortField,
  tick: number,
): readonly bigint[] {
  if (tick < 6)
    return cohort === "young"
      ? [100n, 0n, 0n, 0n, 20n, 880n]
      : [120n, 0n, 0n, 10n, 20n, 850n];
  if (tick < 10)
    return cohort === "young"
      ? [180n, 0n, 620n, 20n, 80n, 100n]
      : cohort === "adult"
        ? [160n, 620n, 0n, 80n, 80n, 60n]
        : [400n, 30n, 0n, 180n, 300n, 90n];
  if (tick < 17)
    return cohort === "young"
      ? [80n, 0n, 720n, 20n, 160n, 20n]
      : cohort === "adult"
        ? [100n, 650n, 0n, 100n, 130n, 20n]
        : [300n, 20n, 0n, 260n, 400n, 20n];
  if (tick < 22)
    return cohort === "young"
      ? [350n, 0n, 80n, 20n, 500n, 50n]
      : cohort === "adult"
        ? [330n, 130n, 0n, 80n, 410n, 50n]
        : [420n, 10n, 0n, 170n, 350n, 50n];
  return cohort === "young"
    ? [200n, 0n, 0n, 0n, 50n, 750n]
    : [240n, 0n, 0n, 20n, 60n, 680n];
}

function totalActivities(
  cohortActivities: PlanetaryDayTick["cohortActivities"],
): ActivityCounts {
  return freezeActivityCounts(
    activityOrder.map((activity) =>
      Object.values(cohortActivities).reduce(
        (sum, counts) => sum + counts[activity],
        0n,
      ),
    ),
  );
}

function festivalAttendance(festival: SignatureFestival, tick: number): bigint {
  if (tick < festival.arrivalTick || tick >= festival.dispersalEndTick)
    return 0n;
  if (tick === 17) return festival.peakAttendance / 4n;
  if (tick === 18) return festival.peakAttendance / 2n;
  if (tick === festival.peakTick) return festival.peakAttendance;
  if (tick === 20) return (festival.peakAttendance * 3n) / 4n;
  return festival.peakAttendance / 3n;
}

function travelFactor(mode: TransportMode, tick: number): bigint {
  if (tick < 6 || tick >= 22)
    return mode === "walking" ? 40n : mode === "local" ? 15n : 5n;
  if (tick < 10)
    return mode === "walking" ? 320n : mode === "local" ? 180n : 80n;
  if (tick < 14)
    return mode === "walking" ? 160n : mode === "local" ? 80n : 30n;
  if (tick < 17)
    return mode === "walking" ? 120n : mode === "local" ? 60n : 20n;
  return mode === "walking" ? 280n : mode === "local" ? 160n : 70n;
}

function standardReason(tick: number): EdgeFlow["reason"] {
  if (tick < 6 || tick >= 22) return "night settlement";
  if (tick < 10) return "morning commute";
  if (tick < 14) return "lunch and service";
  if (tick < 17) return "daytime circulation";
  return "evening return";
}

function allocateCapped(
  total: bigint,
  capacities: readonly bigint[],
  weights: readonly bigint[],
): bigint[] {
  const allocation = capacities.map(() => 0n);
  let remaining =
    total < capacities.reduce((sum, value) => sum + value, 0n)
      ? total
      : capacities.reduce((sum, value) => sum + value, 0n);
  let active = capacities
    .map((_capacity, index) => index)
    .filter((index) => (capacities[index] ?? 0n) > 0n);
  while (remaining > 0n && active.length > 0) {
    const shares = largestRemainder(
      remaining,
      active.map((index) => weights[index] ?? 0n),
    );
    let consumed = 0n;
    for (let offset = 0; offset < active.length; offset += 1) {
      const index = active[offset];
      if (index === undefined) continue;
      const available = (capacities[index] ?? 0n) - (allocation[index] ?? 0n);
      const amount =
        (shares[offset] ?? 0n) < available ? (shares[offset] ?? 0n) : available;
      allocation[index] = (allocation[index] ?? 0n) + amount;
      consumed += amount;
    }
    remaining -= consumed;
    active = active.filter(
      (index) => (allocation[index] ?? 0n) < (capacities[index] ?? 0n),
    );
    if (consumed === 0n) break;
  }
  return allocation;
}

function festivalOriginsForTick(
  graph: TransportGraph,
  nodes: ReadonlyMap<string, TransportNode>,
  attendance: bigint,
): readonly FestivalOrigin[] {
  const incoming = graph.edges.filter(
    (edge) =>
      edge.mode === "intercity" &&
      edge.to === graph.festival.targetRegionNodeId,
  );
  const allocation = largestRemainder(
    attendance,
    incoming.map((edge) => nodes.get(edge.from)?.population ?? 0n),
  );
  return Object.freeze(
    incoming.map((edge, index) =>
      Object.freeze({
        regionNodeId: edge.from,
        attendance: allocation[index] ?? 0n,
      }),
    ),
  );
}

function hashFlows(tick: number, flows: readonly EdgeFlow[]): string {
  const writer = new CanonicalWriter("transport-edge-flows", 1).u32(tick);
  for (const flow of flows)
    writer
      .text(flow.edgeId)
      .text(flow.mode)
      .u64(flow.count)
      .u64(flow.capacity)
      .u64(flow.sourceDemand)
      .u32(flow.closed ? 1 : 0)
      .text(flow.reason);
  return fnv1a64(writer.bytes()).toString(16).padStart(16, "0");
}

function validateCommands(
  graph: TransportGraph,
  commands: readonly TransportCommand[],
): readonly TransportCommand[] {
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));
  const ids = new Set<string>();
  const validated = commands.map((command) => {
    if (command.id.length === 0 || ids.has(command.id))
      throw new RangeError("command ids must be nonempty and unique");
    if (
      !Number.isInteger(command.tick) ||
      command.tick < 0 ||
      command.tick >= PLANETARY_DAY_TICKS
    )
      throw new RangeError("command tick outside planetary day");
    if (!edgeIds.has(command.edgeId))
      throw new RangeError(`unknown command edge: ${command.edgeId}`);
    ids.add(command.id);
    return Object.freeze({ ...command });
  });
  return Object.freeze(
    validated.sort(
      (left, right) => left.tick - right.tick || compareText(left.id, right.id),
    ),
  );
}

export function simulatePlanetaryDay(
  world: FictionalWorld,
  commandLog: readonly TransportCommand[] = createSignatureCommandLog(
    buildTransportGraph(world),
  ),
): PlanetaryDay {
  const graph = buildTransportGraph(world);
  const commands = validateCommands(graph, commandLog);
  const field = createFieldState(world);
  const cohorts = field.cells.reduce<CohortField>(
    (total, cell) => ({
      young: total.young + cell.cohorts.young,
      adult: total.adult + cell.cohorts.adult,
      older: total.older + cell.cohorts.older,
    }),
    { young: 0n, adult: 0n, older: 0n },
  );
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const groupedEdges = new Map<string, TransportEdge[]>();
  for (const edge of graph.edges) {
    const key = `${edge.from}|${edge.mode}`;
    groupedEdges.set(key, [...(groupedEdges.get(key) ?? []), edge]);
  }
  const closed = new Set<string>();
  const ticks: PlanetaryDayTick[] = [];
  for (let tick = 0; tick < PLANETARY_DAY_TICKS; tick += 1) {
    for (const command of commands.filter(
      (candidate) => candidate.tick === tick,
    )) {
      if (command.type === "close") closed.add(command.edgeId);
      else closed.delete(command.edgeId);
    }
    const cohortActivities = Object.freeze({
      young: freezeActivityCounts(
        largestRemainder(cohorts.young, activityWeights("young", tick)),
      ),
      adult: freezeActivityCounts(
        largestRemainder(cohorts.adult, activityWeights("adult", tick)),
      ),
      older: freezeActivityCounts(
        largestRemainder(cohorts.older, activityWeights("older", tick)),
      ),
    });
    const activityTotals = totalActivities(cohortActivities);
    const attendance = festivalAttendance(graph.festival, tick);
    const origins = festivalOriginsForTick(graph, nodes, attendance);
    const originAttendance = new Map(
      origins.map((origin) => [origin.regionNodeId, origin.attendance]),
    );
    const flowsById = new Map<string, EdgeFlow>();
    for (const edges of groupedEdges.values()) {
      const first = edges[0];
      if (first === undefined) continue;
      const sourcePopulation = nodes.get(first.from)?.population ?? 0n;
      let sourceDemand =
        (sourcePopulation * travelFactor(first.mode, tick)) / 1_000n;
      const convergence =
        tick >= 17 && tick <= 19 && originAttendance.has(first.from);
      const dispersal =
        tick >= 20 &&
        tick < 22 &&
        first.from === graph.festival.targetRegionNodeId;
      if (convergence) sourceDemand += originAttendance.get(first.from) ?? 0n;
      if (dispersal) sourceDemand += attendance;
      const openCapacities = edges.map((edge) =>
        closed.has(edge.id) ? 0n : edge.capacity,
      );
      const weights = edges.map((edge, index) => {
        const capacity = openCapacities[index] ?? 0n;
        const preferred =
          (convergence && edge.to === graph.festival.targetRegionNodeId) ||
          (dispersal && edge.from === graph.festival.targetRegionNodeId);
        return preferred ? capacity * 4n : capacity;
      });
      const allocation = allocateCapped(sourceDemand, openCapacities, weights);
      const totalCapacity = openCapacities.reduce(
        (sum, value) => sum + value,
        0n,
      );
      edges.forEach((edge, index) => {
        const isClosed = closed.has(edge.id);
        const festivalConvergence =
          convergence && edge.to === graph.festival.targetRegionNodeId;
        const festivalDispersal =
          dispersal && edge.from === graph.festival.targetRegionNodeId;
        flowsById.set(
          edge.id,
          Object.freeze({
            edgeId: edge.id,
            mode: edge.mode,
            count: allocation[index] ?? 0n,
            capacity: edge.capacity,
            sourceDemand,
            closed: isClosed,
            bottleneck: sourceDemand > totalCapacity,
            reason: isClosed
              ? "route closed"
              : festivalConvergence
                ? "festival convergence"
                : festivalDispersal
                  ? "festival dispersal"
                  : standardReason(tick),
          }),
        );
      });
    }
    const edgeFlows = Object.freeze(
      graph.edges.map((edge) => {
        const flow = flowsById.get(edge.id);
        if (flow === undefined)
          throw new Error(`missing edge flow: ${edge.id}`);
        return flow;
      }),
    );
    const issues: string[] = [];
    const activityPopulation = Object.values(activityTotals).reduce(
      (sum, count) => sum + count,
      0n,
    );
    if (activityPopulation !== world.totalPopulation)
      issues.push("activity population conservation");
    for (const flow of edgeFlows) {
      if (flow.count < 0n || flow.count > flow.capacity)
        issues.push(`${flow.edgeId}: capacity`);
      if (flow.closed && flow.count !== 0n)
        issues.push(`${flow.edgeId}: closed flow`);
    }
    ticks.push(
      Object.freeze({
        tick,
        cohortActivities,
        activityTotals,
        edgeFlows,
        edgeFlowHash: hashFlows(tick, edgeFlows),
        festivalAttendance: attendance,
        festivalOrigins: origins,
        closedEdgeIds: Object.freeze(Array.from(closed).sort(compareText)),
        invariantIssues: Object.freeze(issues),
      }),
    );
  }
  const writer = new CanonicalWriter("planetary-day", 1)
    .text(world.seed)
    .text(graph.graphHash);
  for (const command of commands)
    writer
      .text(command.id)
      .u32(command.tick)
      .text(command.type)
      .text(command.edgeId);
  for (const tick of ticks) {
    writer.u32(tick.tick).text(tick.edgeFlowHash).u64(tick.festivalAttendance);
    for (const activity of activityOrder)
      writer.u64(tick.activityTotals[activity]);
  }
  return Object.freeze({
    schemaVersion: 1,
    seed: `${world.seed}/planetary-day/v1`,
    graph,
    commands,
    ticks: Object.freeze(ticks),
    dayHash: fnv1a64(writer.bytes()).toString(16).padStart(16, "0"),
  });
}

export function explainFlow(
  day: PlanetaryDay,
  tick: number,
  edgeId: string,
): string {
  const flow = day.ticks[tick]?.edgeFlows.find(
    (candidate) => candidate.edgeId === edgeId,
  );
  if (flow === undefined)
    throw new RangeError(`unknown flow at tick ${tick}: ${edgeId}`);
  return `${flow.mode} flow exists for ${flow.reason}: ${flow.count.toString()} routed, capacity ${flow.capacity.toString()}, source demand ${flow.sourceDemand.toString()}, ${flow.closed ? "closed" : flow.bottleneck ? "bottlenecked" : "within capacity"}.`;
}
