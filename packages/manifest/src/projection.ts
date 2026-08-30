import {
  CanonicalWriter,
  fnv1a64,
  largestRemainder,
  type FictionalWorld,
  type WorldKernel,
} from "@ten-billion-lives/sim";

import {
  AnalyticalItineraryIndex,
  createAnalyticalItineraryIndex,
  type PersonActivity,
} from "./itinerary.js";
import { type ManifestationIndex, type PersonCohort } from "./person.js";

export type ProjectionLod = "planet" | "region" | "street" | "person";
export type ProjectionEventKind = "arrival" | "meeting" | "festival";

export interface ProjectionQuery {
  readonly state: WorldKernel;
  readonly tick: bigint;
  readonly scopeCellIds: readonly string[];
  readonly lod: ProjectionLod;
  readonly selectedPersonIds?: readonly string[];
}

/** Visual-only inputs are deliberately absent from semantic hashes and output. */
export interface ProjectionVisualContext {
  readonly observerId?: string;
  readonly cameraPath?: string;
  readonly frameRate?: number;
  readonly quality?: string;
}

export interface SemanticTransform {
  readonly xPermille: number;
  readonly yPermille: number;
  readonly headingMilliTurns: number;
}

export interface ManifestationToken {
  readonly personId: string;
  readonly cellId: string;
  readonly cohort: PersonCohort;
  readonly weight: bigint;
  readonly transform: SemanticTransform;
  /** A renderer may use this key for visual-only jitter; it is never authority. */
  readonly visualJitterKey: number;
  readonly pinned: boolean;
}

export interface ProjectionEvent {
  readonly id: string;
  readonly kind: ProjectionEventKind;
  readonly tick: bigint;
  readonly locationId: string;
  readonly participantIds: readonly string[];
  readonly activity: PersonActivity;
}

export interface ProjectionRealityBudget {
  readonly representedPeople: bigint;
  readonly materializedTokens: number;
  readonly estimatedBytes: number;
  readonly stateHash: string;
  readonly eventHash: string;
  readonly continuityHorizonTicks: bigint;
  readonly samplingContract: "resident-home-cell-cohort-v1";
}

export interface IllusionProjection {
  readonly tick: bigint;
  readonly lod: ProjectionLod;
  readonly scopeCellIds: readonly string[];
  readonly identityEpoch: bigint;
  readonly tokens: readonly ManifestationToken[];
  readonly events: readonly ProjectionEvent[];
  readonly manifestationHash: string;
  readonly eventHash: string;
  readonly realityBudget: ProjectionRealityBudget;
}

interface Stratum {
  readonly cellId: string;
  readonly cohort: PersonCohort;
  readonly population: bigint;
  readonly tokenCount: number;
}

interface MutableToken {
  personId: string;
  readonly cellId: string;
  readonly cohort: PersonCohort;
  weight: bigint;
  transform: SemanticTransform;
  visualJitterKey: number;
  pinned: boolean;
}

const IDENTITY_EPOCH_TICKS = 24n;
const COHORTS = ["young", "adult", "older"] as const;
const LOD_TOKEN_BUDGET: Readonly<Record<ProjectionLod, number>> = Object.freeze(
  {
    planet: 8_192,
    region: 8_000,
    street: 25_000,
    person: 4_000,
  },
);
const ESTIMATED_TOKEN_BYTES = 72;
const ESTIMATED_EVENT_BYTES = 96;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hexHash(writer: CanonicalWriter): string {
  return fnv1a64(writer.bytes()).toString(16).padStart(16, "0");
}

function hashPersonWord(personId: string): bigint {
  return fnv1a64(new TextEncoder().encode(personId));
}

function transformFor(personId: string): SemanticTransform {
  const word = hashPersonWord(personId);
  return Object.freeze({
    xPermille: Number(word & 0x3ffn) % 1_001,
    yPermille: Number((word >> 10n) & 0x3ffn) % 1_001,
    headingMilliTurns: Number((word >> 20n) & 0x3ffn) % 1_000,
  });
}

function tokenFor(
  personId: string,
  cellId: string,
  cohort: PersonCohort,
  weight: bigint,
  pinned = false,
): MutableToken {
  const word = hashPersonWord(personId);
  return {
    personId,
    cellId,
    cohort,
    weight,
    transform: transformFor(personId),
    visualJitterKey: Number((word >> 32n) & 0xffff_ffffn),
    pinned,
  };
}

/** Splits a population into ordered exact integer weights. */
export function allocateManifestationWeights(
  population: bigint,
  requestedTokens: number,
): readonly bigint[] {
  if (population < 0n)
    throw new RangeError("manifestation population must be nonnegative");
  if (!Number.isSafeInteger(requestedTokens) || requestedTokens < 0)
    throw new RangeError("manifestation token budget must be nonnegative");
  if (population === 0n || requestedTokens === 0) return Object.freeze([]);
  const count = Number(
    population < BigInt(requestedTokens) ? population : BigInt(requestedTokens),
  );
  const divisor = BigInt(count);
  const quotient = population / divisor;
  const remainder = Number(population % divisor);
  return Object.freeze(
    Array.from({ length: count }, (_value, index) =>
      index < remainder ? quotient + 1n : quotient,
    ),
  );
}

function tokenCounts(
  populations: readonly bigint[],
  budget: number,
): readonly number[] {
  const total = populations.reduce((sum, population) => sum + population, 0n);
  if (total <= BigInt(budget)) return populations.map(Number);
  const positive = populations.filter((population) => population > 0n).length;
  if (positive > budget)
    throw new RangeError(
      "token budget cannot represent every nonempty stratum",
    );
  const remaining = BigInt(budget - positive);
  const capacities = populations.map((population) =>
    population > 0n ? population - 1n : 0n,
  );
  const extras = largestRemainder(remaining, capacities);
  return populations.map((population, index) =>
    population === 0n ? 0 : 1 + Number(extras[index] ?? 0n),
  );
}

function slotRevision(identityEpoch: bigint, slot: number): bigint {
  const phase = BigInt(slot % 8);
  if (phase === 0n) return identityEpoch / 8n;
  return identityEpoch < phase ? 0n : (identityEpoch - phase) / 8n + 1n;
}

function representativeRank(
  start: bigint,
  weight: bigint,
  identityEpoch: bigint,
  slot: number,
): bigint {
  const revision = slotRevision(identityEpoch, slot);
  return start + ((weight / 2n + revision) % weight);
}

function freezeToken(token: MutableToken): ManifestationToken {
  return Object.freeze({
    ...token,
    transform: Object.freeze({ ...token.transform }),
  });
}

function hashTokens(
  tick: bigint,
  lod: ProjectionLod,
  identityEpoch: bigint,
  scopeCellIds: readonly string[],
  tokens: readonly ManifestationToken[],
): string {
  const writer = new CanonicalWriter("illusion-projection", 1)
    .u64(tick)
    .text(lod)
    .u64(identityEpoch)
    .u32(scopeCellIds.length);
  for (const cellId of scopeCellIds) writer.text(cellId);
  writer.u32(tokens.length);
  for (const token of tokens)
    writer
      .text(token.personId)
      .text(token.cellId)
      .text(token.cohort)
      .u64(token.weight)
      .u32(token.transform.xPermille)
      .u32(token.transform.yPermille)
      .u32(token.transform.headingMilliTurns)
      .u32(token.visualJitterKey)
      .u32(token.pinned ? 1 : 0);
  return hexHash(writer);
}

function hashEvents(events: readonly ProjectionEvent[]): string {
  const writer = new CanonicalWriter("illusion-events", 1).u32(events.length);
  for (const event of events) {
    writer
      .text(event.id)
      .text(event.kind)
      .u64(event.tick)
      .text(event.locationId)
      .text(event.activity)
      .u32(event.participantIds.length);
    for (const personId of event.participantIds) writer.text(personId);
  }
  return hexHash(writer);
}

function eventId(
  kind: ProjectionEventKind,
  tick: bigint,
  locationId: string,
  participantIds: readonly string[],
): string {
  const writer = new CanonicalWriter("illusion-event-id", 1)
    .text(kind)
    .u64(tick)
    .text(locationId);
  for (const personId of participantIds) writer.text(personId);
  return `event_${hexHash(writer)}`;
}

export class IllusionEngine {
  readonly #world: FictionalWorld;
  readonly itinerary: AnalyticalItineraryIndex;
  readonly manifestation: ManifestationIndex;

  constructor(world: FictionalWorld) {
    this.#world = world;
    this.itinerary = createAnalyticalItineraryIndex(world);
    this.manifestation = this.itinerary.manifestation;
  }

  #validate(query: ProjectionQuery): {
    scopeCellIds: readonly string[];
    selectedPersonIds: readonly string[];
  } {
    if (query.state.world.worldHash !== this.#world.worldHash)
      throw new RangeError("projection world does not match illusion engine");
    if (query.tick < 0n || query.state.field.tick !== query.tick)
      throw new RangeError("projection tick does not match world state");
    if (!(query.lod in LOD_TOKEN_BUDGET))
      throw new RangeError("invalid projection LOD");
    const knownCells = new Set(
      query.state.field.cells.map((cell) => cell.cellId),
    );
    const scopeCellIds = Object.freeze(
      [...new Set(query.scopeCellIds)].sort(compareText),
    );
    if (
      scopeCellIds.length === 0 ||
      scopeCellIds.some((id) => !knownCells.has(id))
    )
      throw new RangeError("projection scope cell is missing from world state");
    const selectedPersonIds = Object.freeze(
      [...new Set(query.selectedPersonIds ?? [])].sort(compareText),
    );
    for (const personId of selectedPersonIds) {
      const card = this.manifestation.person(personId);
      if (!scopeCellIds.includes(card.cellId))
        throw new RangeError("selected person is outside projection scope");
    }
    return { scopeCellIds, selectedPersonIds };
  }

  #strata(
    state: WorldKernel,
    scopeCellIds: readonly string[],
    lod: ProjectionLod,
  ): readonly Stratum[] {
    const byId = new Map(state.field.cells.map((cell) => [cell.cellId, cell]));
    const inputs = scopeCellIds.flatMap((cellId) => {
      const cell = byId.get(cellId);
      if (cell === undefined)
        throw new RangeError(
          "projection scope cell is missing from world state",
        );
      return COHORTS.map((cohort) => ({
        cellId,
        cohort,
        population: cell.cohorts[cohort],
      }));
    });
    const counts = tokenCounts(
      inputs.map((input) => input.population),
      LOD_TOKEN_BUDGET[lod],
    );
    return Object.freeze(
      inputs.map((input, index) =>
        Object.freeze({ ...input, tokenCount: counts[index] ?? 0 }),
      ),
    );
  }

  #tokens(strata: readonly Stratum[], identityEpoch: bigint): MutableToken[] {
    const tokens: MutableToken[] = [];
    for (const stratum of strata) {
      const weights = allocateManifestationWeights(
        stratum.population,
        stratum.tokenCount,
      );
      let start = 0n;
      for (let slot = 0; slot < weights.length; slot += 1) {
        const weight = weights[slot] ?? 0n;
        const rank = representativeRank(start, weight, identityEpoch, slot);
        const personId = this.manifestation.personIdForCohortRank(
          stratum.cellId,
          stratum.cohort,
          rank,
        );
        tokens.push(tokenFor(personId, stratum.cellId, stratum.cohort, weight));
        start += weight;
      }
    }
    return tokens;
  }

  #pin(tokens: MutableToken[], selectedPersonIds: readonly string[]): void {
    for (const personId of selectedPersonIds) {
      const existing = tokens.find((token) => token.personId === personId);
      if (existing !== undefined) {
        existing.pinned = true;
        continue;
      }
      const card = this.manifestation.person(personId);
      const candidates = tokens.filter(
        (token) =>
          token.cellId === card.cellId &&
          token.cohort === card.cohort &&
          !token.pinned,
      );
      const target =
        candidates.find((token) => token.weight > 1n) ?? candidates[0];
      if (target === undefined)
        throw new Error("selected identity has no manifestation stratum");
      const donor = candidates.find((token) => token !== target);
      if (target.weight > 1n) {
        if (donor === undefined)
          throw new Error(
            "selected identity cannot be isolated in token budget",
          );
        donor.weight += target.weight - 1n;
        target.weight = 1n;
      }
      const pinned = tokenFor(personId, card.cellId, card.cohort, 1n, true);
      target.personId = pinned.personId;
      target.transform = pinned.transform;
      target.visualJitterKey = pinned.visualJitterKey;
      target.pinned = true;
    }
  }

  #events(
    selectedPersonIds: readonly string[],
    tick: bigint,
    state: WorldKernel,
  ): readonly ProjectionEvent[] {
    const events = new Map<string, ProjectionEvent>();
    for (const personId of selectedPersonIds) {
      const point = this.itinerary.queryPerson(personId, tick, state);
      const arrivalParticipants = Object.freeze([personId]);
      const arrival: ProjectionEvent = Object.freeze({
        id: eventId(
          "arrival",
          tick,
          point.location.semanticId,
          arrivalParticipants,
        ),
        kind: "arrival",
        tick,
        locationId: point.location.semanticId,
        participantIds: arrivalParticipants,
        activity: point.activity,
      });
      events.set(arrival.id, arrival);
      if (point.activity === "festival") {
        const festival: ProjectionEvent = Object.freeze({
          id: eventId(
            "festival",
            tick,
            point.location.semanticId,
            arrivalParticipants,
          ),
          kind: "festival",
          tick,
          locationId: point.location.semanticId,
          participantIds: arrivalParticipants,
          activity: point.activity,
        });
        events.set(festival.id, festival);
      }
      for (const encounter of point.encounters) {
        const participantIds = Object.freeze(
          [personId, encounter.personId].sort(compareText),
        );
        const id = eventId(
          "meeting",
          tick,
          point.location.semanticId,
          participantIds,
        );
        events.set(
          id,
          Object.freeze({
            id,
            kind: "meeting",
            tick,
            locationId: point.location.semanticId,
            participantIds,
            activity: point.activity,
          }),
        );
      }
    }
    return Object.freeze(
      [...events.values()].sort((left, right) =>
        compareText(left.id, right.id),
      ),
    );
  }

  project(
    query: ProjectionQuery,
    visualContext: ProjectionVisualContext = {},
  ): IllusionProjection {
    void visualContext;
    const { scopeCellIds, selectedPersonIds } = this.#validate(query);
    const identityEpoch = query.tick / IDENTITY_EPOCH_TICKS;
    const strata = this.#strata(query.state, scopeCellIds, query.lod);
    const mutableTokens = this.#tokens(strata, identityEpoch);
    this.#pin(mutableTokens, selectedPersonIds);
    const tokens = Object.freeze(mutableTokens.map(freezeToken));
    const events = this.#events(selectedPersonIds, query.tick, query.state);
    const manifestationHash = hashTokens(
      query.tick,
      query.lod,
      identityEpoch,
      scopeCellIds,
      tokens,
    );
    const eventHash = hashEvents(events);
    const representedPeople = strata.reduce(
      (sum, stratum) => sum + stratum.population,
      0n,
    );
    return Object.freeze({
      tick: query.tick,
      lod: query.lod,
      scopeCellIds,
      identityEpoch,
      tokens,
      events,
      manifestationHash,
      eventHash,
      realityBudget: Object.freeze({
        representedPeople,
        materializedTokens: tokens.length,
        estimatedBytes:
          tokens.length * ESTIMATED_TOKEN_BYTES +
          events.length * ESTIMATED_EVENT_BYTES,
        stateHash: query.state.kernelHash,
        eventHash,
        continuityHorizonTicks: IDENTITY_EPOCH_TICKS,
        samplingContract: "resident-home-cell-cohort-v1",
      }),
    });
  }
}

export function createIllusionEngine(world: FictionalWorld): IllusionEngine {
  return new IllusionEngine(world);
}
