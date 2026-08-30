import {
  CanonicalWriter,
  PLANETARY_DAY_TICKS,
  buildTransportGraph,
  fnv1a64,
  type ActivityField,
  type FictionalWorld,
  type KernelEvent,
  type TransportEdge,
  type TransportGraph,
  type TransportMode,
  type WorldKernel,
} from "@ten-billion-lives/sim";

import {
  createManifestationIndex,
  type ManifestationIndex,
  type PersonCard,
  type PersonCohort,
  type RelationshipKind,
} from "./person.js";

export type PersonActivity =
  | "sleep"
  | "home"
  | "transit"
  | "work"
  | "school"
  | "service"
  | "leisure"
  | "festival";
export type PersonQueryLod = "region" | "settlement" | "street" | "person";

export interface PersonRoute {
  readonly edgeIds: readonly string[];
  readonly mode: TransportMode;
  readonly destinationId: string;
  readonly progressPermille: number;
  readonly replannedAtTick?: bigint;
  readonly reason:
    | "daily commute"
    | "closure detour"
    | "evening return"
    | "festival convergence"
    | "festival return";
}

export interface PersonSemanticLocation {
  readonly kind: "home" | "place" | "transport" | "community" | "festival";
  readonly semanticId: string;
  readonly regionId: string;
  readonly positionPermille: number;
}

export interface PersonEncounter {
  readonly personId: string;
  readonly relationshipKind: RelationshipKind;
}

export interface PersonItineraryPoint {
  readonly personId: string;
  readonly tick: bigint;
  readonly dayIndex: bigint;
  readonly hour: number;
  readonly activity: PersonActivity;
  readonly location: PersonSemanticLocation;
  readonly route: PersonRoute | null;
  readonly fieldMembership: Readonly<{
    homeCellId: string;
    cohort: PersonCohort;
    cohortPopulation: bigint;
    channel: keyof ActivityField;
    channelPopulation: bigint;
  }>;
  readonly encounterGroupId: string;
  readonly encounters: readonly PersonEncounter[];
  readonly viewLocationId: string;
  readonly lod: PersonQueryLod;
  readonly semanticHash: string;
}

export interface PersonQueryOptions {
  readonly lod?: PersonQueryLod;
}

interface CorePoint {
  readonly card: PersonCard;
  readonly tick: bigint;
  readonly dayIndex: bigint;
  readonly hour: number;
  readonly activity: PersonActivity;
  readonly location: PersonSemanticLocation;
  readonly route: PersonRoute | null;
  readonly semanticHash: string;
}

const personLods = new Set<PersonQueryLod>([
  "region",
  "settlement",
  "street",
  "person",
]);

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseBase36(value: string): bigint {
  let result = 0n;
  for (const character of value) {
    const digit = Number.parseInt(character, 36);
    if (!Number.isInteger(digit) || digit < 0 || digit >= 36)
      throw new RangeError("Invalid person ID");
    result = result * 36n + BigInt(digit);
  }
  return result;
}

function opaquePersonValue(personId: string): bigint {
  const match = /^person_([0-9a-z]{7})_[0-9a-z]{7}$/.exec(personId);
  if (!match) throw new RangeError("Invalid person ID");
  return parseBase36(match[1] ?? "");
}

function hashText(domain: string, values: readonly string[]): string {
  const writer = new CanonicalWriter(domain, 1);
  for (const value of values) writer.text(value);
  return fnv1a64(writer.bytes()).toString(16).padStart(16, "0");
}

function festivalAttendance(graph: TransportGraph, hour: number): bigint {
  if (
    hour < graph.festival.arrivalTick ||
    hour >= graph.festival.dispersalEndTick
  )
    return 0n;
  if (hour === 17) return graph.festival.peakAttendance / 4n;
  if (hour === 18) return graph.festival.peakAttendance / 2n;
  if (hour === graph.festival.peakTick) return graph.festival.peakAttendance;
  if (hour === 20) return (graph.festival.peakAttendance * 3n) / 4n;
  return graph.festival.peakAttendance / 3n;
}

function primaryActivity(cohort: PersonCohort): PersonActivity {
  return cohort === "young"
    ? "school"
    : cohort === "adult"
      ? "work"
      : "service";
}

function fieldChannel(activity: PersonActivity): keyof ActivityField {
  if (activity === "sleep") return "sleep";
  if (activity === "home") return "home";
  if (activity === "transit") return "transit";
  if (activity === "work" || activity === "school") return "work";
  return "community";
}

function closedEdgeIds(
  events: readonly KernelEvent[],
  tick: bigint,
): ReadonlySet<string> {
  const closed = new Set<string>();
  for (const event of events) {
    if (BigInt(event.tick) > tick) break;
    if (event.type === "route-close") closed.add(event.targetId);
    else closed.delete(event.targetId);
  }
  return closed;
}

function latestRouteEvent(
  events: readonly KernelEvent[],
  edgeId: string,
  tick: bigint,
): bigint | undefined {
  let latest: bigint | undefined;
  for (const event of events)
    if (event.targetId === edgeId && BigInt(event.tick) <= tick)
      latest = BigInt(event.tick);
  return latest;
}

function shortestIntercityPath(
  graph: TransportGraph,
  from: string,
  to: string,
  closed: ReadonlySet<string>,
): readonly TransportEdge[] {
  if (from === to) return Object.freeze([]);
  const outgoing = new Map<string, TransportEdge[]>();
  for (const edge of graph.edges)
    if (edge.mode === "intercity" && !closed.has(edge.id))
      outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  for (const edges of outgoing.values())
    edges.sort((left, right) => compareText(left.id, right.id));
  const queue = [from];
  const previous = new Map<string, TransportEdge>();
  const visited = new Set([from]);
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === undefined) break;
    for (const edge of outgoing.get(node) ?? []) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      previous.set(edge.to, edge);
      if (edge.to === to) {
        const path: TransportEdge[] = [];
        let cursor = to;
        while (cursor !== from) {
          const step = previous.get(cursor);
          if (step === undefined)
            throw new Error("transport path reconstruction failed");
          path.push(step);
          cursor = step.from;
        }
        return Object.freeze(path.reverse());
      }
      queue.push(edge.to);
    }
  }
  throw new Error(`No open intercity route from ${from} to ${to}`);
}

function progressFor(hour: number): number {
  if (hour === 7) return 250;
  if (hour === 8) return 500;
  if (hour === 9) return 750;
  return 500;
}

export class AnalyticalItineraryIndex {
  readonly #world: FictionalWorld;
  readonly #graph: TransportGraph;
  readonly #settlementByCell: ReadonlyMap<
    string,
    FictionalWorld["settlements"][number]
  >;
  readonly manifestation: ManifestationIndex;

  constructor(world: FictionalWorld) {
    this.#world = world;
    this.#graph = buildTransportGraph(world);
    this.manifestation = createManifestationIndex(world);
    this.#settlementByCell = new Map(
      world.settlements.map((settlement) => [settlement.cellId, settlement]),
    );
  }

  #activity(
    personId: string,
    cohort: PersonCohort,
    hour: number,
  ): PersonActivity {
    if (hour < 6 || hour === 23) return "sleep";
    if (hour === 6 || hour === 22) return "home";
    if (hour >= 7 && hour <= 9) return "transit";
    if (hour >= 10 && hour <= 15) return primaryActivity(cohort);
    if (hour === 16) return "transit";
    const attendance = festivalAttendance(this.#graph, hour);
    const attendsFestival = opaquePersonValue(personId) < attendance;
    if (attendsFestival && (hour === 17 || hour === 21)) return "transit";
    if (attendsFestival && hour >= 18 && hour <= 20) return "festival";
    if (hour >= 17 && hour <= 20) return "leisure";
    return "home";
  }

  #regionalRoute(
    card: PersonCard,
    tick: bigint,
    state: WorldKernel,
    returning: boolean,
  ): PersonRoute | null {
    const personWord = BigInt(`0x${card.semanticHash}`);
    const homeRegionNode = `region/${card.regionId}`;
    const outgoing = this.#graph.edges.filter(
      (edge) => edge.mode === "intercity" && edge.from === homeRegionNode,
    );
    if (personWord % 8n !== 0n || outgoing.length === 0) return null;
    const preferred =
      outgoing[Number((personWord / 8n) % BigInt(outgoing.length))];
    if (preferred === undefined) return null;
    const closed = closedEdgeIds(state.events, tick);
    const from = returning ? preferred.to : homeRegionNode;
    const to = returning ? homeRegionNode : preferred.to;
    const path = shortestIntercityPath(this.#graph, from, to, closed);
    const replannedAtTick = latestRouteEvent(state.events, preferred.id, tick);
    return Object.freeze({
      edgeIds: Object.freeze(path.map((edge) => edge.id)),
      mode: "intercity" as const,
      destinationId: to,
      progressPermille: progressFor(Number(tick % 24n)),
      ...(replannedAtTick === undefined ? {} : { replannedAtTick }),
      reason:
        closed.has(preferred.id) && !returning
          ? ("closure detour" as const)
          : returning
            ? ("evening return" as const)
            : ("daily commute" as const),
    });
  }

  #festivalRoute(
    card: PersonCard,
    tick: bigint,
    state: WorldKernel,
    returning: boolean,
  ): PersonRoute {
    const home = `region/${card.regionId}`;
    const target = this.#graph.festival.targetRegionNodeId;
    const path = shortestIntercityPath(
      this.#graph,
      returning ? target : home,
      returning ? home : target,
      closedEdgeIds(state.events, tick),
    );
    return Object.freeze({
      edgeIds: Object.freeze(path.map((edge) => edge.id)),
      mode: "intercity" as const,
      destinationId: returning ? home : target,
      progressPermille: 500,
      reason: returning
        ? ("festival return" as const)
        : ("festival convergence" as const),
    });
  }

  #route(
    card: PersonCard,
    activity: PersonActivity,
    hour: number,
    tick: bigint,
    state: WorldKernel,
  ): PersonRoute | null {
    if (activity !== "transit") return null;
    const attendance = festivalAttendance(this.#graph, hour);
    const attendsFestival = opaquePersonValue(card.personId) < attendance;
    if (attendsFestival && hour === 17)
      return this.#festivalRoute(card, tick, state, false);
    if (attendsFestival && hour === 21)
      return this.#festivalRoute(card, tick, state, true);
    const regional = this.#regionalRoute(card, tick, state, hour === 16);
    if (regional !== null) return regional;
    return Object.freeze({
      edgeIds: Object.freeze([]),
      mode: "walking" as const,
      destinationId: hour === 16 ? card.household.id : card.primaryPlace.id,
      progressPermille: progressFor(hour),
      reason:
        hour === 16 ? ("evening return" as const) : ("daily commute" as const),
    });
  }

  #core(personId: string, tick: bigint, state: WorldKernel): CorePoint {
    const card = this.manifestation.person(personId);
    const dayIndex = tick / BigInt(PLANETARY_DAY_TICKS);
    const hour = Number(tick % BigInt(PLANETARY_DAY_TICKS));
    const activity = this.#activity(personId, card.cohort, hour);
    const route = this.#route(card, activity, hour, tick, state);
    let kind: PersonSemanticLocation["kind"];
    let semanticId: string;
    let regionId = card.regionId;
    if (activity === "sleep" || activity === "home") {
      kind = "home";
      semanticId = card.household.id;
    } else if (
      activity === "work" ||
      activity === "school" ||
      activity === "service"
    ) {
      kind = "place";
      semanticId = card.primaryPlace.id;
    } else if (activity === "transit") {
      kind = "transport";
      semanticId = `route_${hashText("person-route-location", [
        ...(route?.edgeIds ?? []),
        route?.destinationId ?? "",
        String(route?.progressPermille ?? 0),
      ])}`;
    } else if (activity === "festival") {
      kind = "festival";
      semanticId = this.#graph.festival.id;
      regionId = this.#graph.festival.targetRegionNodeId.replace(
        /^region\//,
        "",
      );
    } else {
      kind = "community";
      semanticId = `community/${card.cellId}`;
    }
    const location = Object.freeze({
      kind,
      semanticId,
      regionId,
      positionPermille: route?.progressPermille ?? 0,
    });
    const semanticHash = fnv1a64(
      new CanonicalWriter("analytical-person-itinerary", 1)
        .text(personId)
        .u64(tick)
        .text(state.eventHash)
        .text(activity)
        .text(location.semanticId)
        .text(location.regionId)
        .u32(location.positionPermille)
        .text(route?.reason ?? "")
        .bytes(),
    )
      .toString(16)
      .padStart(16, "0");
    return Object.freeze({
      card,
      tick,
      dayIndex,
      hour,
      activity,
      location,
      route,
      semanticHash,
    });
  }

  #viewLocation(core: CorePoint, lod: PersonQueryLod): string {
    if (lod === "person") return core.location.semanticId;
    if (lod === "region") return `region/${core.location.regionId}`;
    const settlement = this.#settlementByCell.get(core.card.cellId);
    if (lod === "settlement")
      return settlement === undefined
        ? `region/${core.location.regionId}`
        : `settlement/${settlement.id}`;
    return settlement?.neighborhoodIds[0] ?? core.card.cellId;
  }

  queryPerson(
    personId: string,
    tick: bigint,
    state: WorldKernel,
    options: PersonQueryOptions = {},
  ): PersonItineraryPoint {
    if (tick < 0n)
      throw new RangeError("person query tick must be nonnegative");
    if (state.world.worldHash !== this.#world.worldHash)
      throw new RangeError("person query world does not match itinerary index");
    if (state.field.tick !== tick)
      throw new RangeError("person query tick does not match world state");
    const lod = options.lod ?? "person";
    if (!personLods.has(lod)) throw new RangeError("Invalid person query LOD");
    const core = this.#core(personId, tick, state);
    const fieldCell = state.field.cells.find(
      (cell) => cell.cellId === core.card.cellId,
    );
    if (fieldCell === undefined)
      throw new Error(`missing field cell for person: ${core.card.cellId}`);
    const channel = fieldChannel(core.activity);
    const encounterGroupId = `encounter_${hashText("person-encounter-group", [
      core.location.semanticId,
      core.dayIndex.toString(),
      String(core.hour),
    ])}`;
    const encounters = this.manifestation
      .relationships(personId)
      .flatMap((relationship) => {
        const candidate = this.#core(relationship.personId, tick, state);
        return candidate.location.semanticId === core.location.semanticId
          ? [
              Object.freeze({
                personId: relationship.personId,
                relationshipKind: relationship.kind,
              }),
            ]
          : [];
      });
    return Object.freeze({
      personId,
      tick,
      dayIndex: core.dayIndex,
      hour: core.hour,
      activity: core.activity,
      location: core.location,
      route: core.route,
      fieldMembership: Object.freeze({
        homeCellId: core.card.cellId,
        cohort: core.card.cohort,
        cohortPopulation: fieldCell.cohorts[core.card.cohort],
        channel,
        channelPopulation: fieldCell.activities[channel],
      }),
      encounterGroupId,
      encounters: Object.freeze(encounters),
      viewLocationId: this.#viewLocation(core, lod),
      lod,
      semanticHash: core.semanticHash,
    });
  }
}

export function createAnalyticalItineraryIndex(
  world: FictionalWorld,
): AnalyticalItineraryIndex {
  return new AnalyticalItineraryIndex(world);
}
