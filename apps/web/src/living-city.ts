import {
  queryPedestrianPose,
  type CityPlaceKind,
  type CityProjection,
  type IllusionProjection,
  type PersonItineraryPoint,
  type TrajectoryCityProjection,
  type VisualTime,
} from "@ten-billion-lives/manifest";
import type {
  LivingCityActivity,
  LivingCityActivityGroup,
  LivingCityFigure,
  LivingCityScene,
  LivingCityStory,
} from "@ten-billion-lives/render";

export type LivingCityLevel = "city" | "neighborhood" | "street" | "person";
export type LivingCityQuality = "fallback" | "baseline" | "showcase";

export interface ProductionLivingCityQuery {
  readonly projection: IllusionProjection;
  readonly city: CityProjection;
  readonly branch: "baseline" | "closure";
  readonly time: VisualTime;
  readonly selectedPersonId: string;
  readonly level: LivingCityLevel;
  readonly quality: LivingCityQuality;
  readonly festivalPeakHour: number;
  readonly itineraryAt: (
    personId: string,
    tick: bigint,
  ) => PersonItineraryPoint;
}

function storyPhase(
  selected: PersonItineraryPoint,
  projection: IllusionProjection,
  festivalPeakHour: number,
): LivingCityStory["phase"] {
  if (selected.route?.reason === "closure detour") return "closure-detour";
  if (selected.route?.reason === "festival convergence")
    return "festival-arrival";
  if (selected.route?.reason === "festival return") return "festival-departure";
  if (
    selected.route?.reason === "daily commute" ||
    selected.route?.reason === "evening return"
  )
    return "commute";
  if (
    selected.hour === festivalPeakHour &&
    projection.events.some((event) => event.kind === "festival")
  )
    return "festival-peak";
  if (projection.events.some((event) => event.kind === "meeting"))
    return "meeting";
  return "daily-life";
}

const qualityLimits: Readonly<Record<LivingCityQuality, number>> =
  Object.freeze({ fallback: 128, baseline: 256, showcase: 512 });

const levelLimits: Readonly<Record<LivingCityLevel, number>> = Object.freeze({
  city: 64,
  neighborhood: 128,
  street: 512,
  person: 512,
});

const fnvOffset = 0xcbf29ce484222325n;
const fnvPrime = 0x100000001b3n;
const u64Mask = 0xffffffffffffffffn;
export const livingCityCachePolicy = Object.freeze({
  maximumTrajectoryCities: qualityLimits.baseline,
  maximumItineraryWindows: qualityLimits.showcase,
});
const trajectoryCityCaches = new WeakMap<
  CityProjection,
  Map<string, TrajectoryCityProjection>
>();
const itineraryWindowCaches = new WeakMap<
  ProductionLivingCityQuery["itineraryAt"],
  Map<string, readonly PersonItineraryPoint[]>
>();

export function setBoundedLivingCityCache<K, V>(
  cache: Map<K, V>,
  key: K,
  value: V,
  maximumEntries: number,
): void {
  if (!Number.isSafeInteger(maximumEntries) || maximumEntries < 1)
    throw new RangeError("living-city cache capacity must be positive");
  if (!cache.has(key) && cache.size >= maximumEntries) {
    const oldest = cache.keys().next().value as K | undefined;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

function stableHash(value: string): bigint {
  let hash = fnvOffset;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = (hash * fnvPrime) & u64Mask;
  }
  return hash;
}

function hashText(value: string): string {
  return stableHash(value).toString(16).padStart(16, "0");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sampleTokens(query: ProductionLivingCityQuery) {
  const limit = Math.min(
    qualityLimits[query.quality],
    levelLimits[query.level],
    query.projection.tokens.length,
  );
  const ranked = [...query.projection.tokens].sort((left, right) => {
    if (left.personId === query.selectedPersonId) return -1;
    if (right.personId === query.selectedPersonId) return 1;
    const leftHash = stableHash(left.personId);
    const rightHash = stableHash(right.personId);
    if (leftHash !== rightHash) return leftHash < rightHash ? -1 : 1;
    return compareText(left.personId, right.personId);
  });
  const sampled = ranked
    .slice(0, limit)
    .sort((left, right) => compareText(left.personId, right.personId));
  if (!sampled.some((token) => token.personId === query.selectedPersonId))
    throw new RangeError("selected person is absent from the city projection");
  return Object.freeze(sampled);
}

function itineraryWindow(
  personId: string,
  tick: bigint,
  itineraryAt: ProductionLivingCityQuery["itineraryAt"],
): readonly PersonItineraryPoint[] {
  const previous: PersonItineraryPoint[] = [];
  if (tick > 0n) {
    let cursor = tick - 1n;
    for (let attempts = 0; attempts < 24; attempts += 1) {
      const point = itineraryAt(personId, cursor);
      previous.push(point);
      if (point.activity !== "transit" || cursor === 0n) break;
      cursor -= 1n;
    }
  }
  return Object.freeze([
    ...previous.reverse(),
    itineraryAt(personId, tick),
    itineraryAt(personId, tick + 1n),
  ]);
}

function placeKind(
  semanticId: string,
  activity?: PersonItineraryPoint["activity"],
): CityPlaceKind {
  if (semanticId.startsWith("household_")) return "household";
  if (semanticId.startsWith("place_wrk_")) return "workplace";
  if (semanticId.startsWith("place_sch_")) return "school";
  if (semanticId.startsWith("place_svc_")) return "service";
  if (semanticId.startsWith("community/")) return "community";
  if (semanticId.startsWith("festival/")) return "festival";
  if (semanticId.startsWith("anchor-")) return "transport";
  if (semanticId.startsWith("region/")) return "transport";
  if (activity === "work") return "workplace";
  if (activity === "school") return "school";
  if (activity === "service") return "service";
  if (activity === "festival") return "festival";
  if (activity === "home" || activity === "sleep") return "household";
  if (activity === "leisure") return "community";
  throw new RangeError(`unsupported city semantic destination: ${semanticId}`);
}

function candidateNodes(city: CityProjection, kind: CityPlaceKind) {
  const anchor = city.places.find((place) => place.kind === kind);
  if (anchor === undefined)
    throw new RangeError(`city has no ${kind} semantic anchor`);
  const nodeById = new Map(city.pedestrianNodes.map((node) => [node.id, node]));
  const edgeById = new Map(city.pedestrianEdges.map((edge) => [edge.id, edge]));
  const anchorNode = nodeById.get(anchor.entranceNodeId);
  if (anchorNode === undefined)
    throw new RangeError(`city ${kind} anchor has no pedestrian node`);
  const nearby = anchorNode.adjacentEdgeIds.flatMap((edgeId) => {
    const edge = edgeById.get(edgeId);
    if (edge === undefined) return [];
    return [
      edge.fromNodeId === anchorNode.id ? edge.toNodeId : edge.fromNodeId,
    ];
  });
  return Object.freeze(
    [...new Set([anchorNode.id, ...nearby])].sort(compareText),
  );
}

function trajectoryCity(
  city: CityProjection,
  itineraries: readonly (readonly PersonItineraryPoint[])[],
): TrajectoryCityProjection {
  const itineraryKey = itineraries
    .flatMap((itinerary) =>
      itinerary.map(
        (point) =>
          `${point.activity}:${point.location.semanticId}:${point.route?.destinationId ?? ""}`,
      ),
    )
    .join("\0");
  const cache = trajectoryCityCaches.get(city) ?? new Map();
  trajectoryCityCaches.set(city, cache);
  const cached = cache.get(itineraryKey);
  if (cached !== undefined) return cached;
  const requested = new Map<string, CityPlaceKind>();
  const conflicts = new Map<string, Set<string>>();
  const aliases = new Map<string, string>();
  const derived = new Map(
    city.places.map((place) => [
      place.id,
      Object.freeze({ id: place.id, entranceNodeId: place.entranceNodeId }),
    ]),
  );
  const request = (
    semanticId: string,
    activity?: PersonItineraryPoint["activity"],
  ) => {
    if (!derived.has(semanticId))
      requested.set(semanticId, placeKind(semanticId, activity));
  };
  const conflict = (left: string, right: string) => {
    if (left === right) return;
    conflicts.set(left, new Set([...(conflicts.get(left) ?? []), right]));
    conflicts.set(right, new Set([...(conflicts.get(right) ?? []), left]));
  };
  for (const itinerary of itineraries) {
    for (const point of itinerary) {
      if (point.activity !== "transit")
        request(point.location.semanticId, point.activity);
      if (point.route !== null) request(point.route.destinationId);
    }
    for (let index = 0; index < itinerary.length; index += 1) {
      const point = itinerary[index];
      if (point === undefined) continue;
      if (point.activity === "transit" && point.route !== null) {
        const origin = itinerary
          .slice(0, index)
          .reverse()
          .find((candidate) => candidate.activity !== "transit");
        const arrival = itinerary
          .slice(index + 1)
          .find((candidate) => candidate.activity !== "transit");
        if (origin !== undefined) {
          conflict(origin.location.semanticId, point.route.destinationId);
          if (arrival !== undefined)
            conflict(origin.location.semanticId, arrival.location.semanticId);
        }
        if (
          arrival !== undefined &&
          point.route.destinationId !== arrival.location.semanticId
        )
          aliases.set(point.route.destinationId, arrival.location.semanticId);
      }
      const next = itinerary[index + 1];
      if (
        point.activity !== "transit" &&
        next !== undefined &&
        next.activity !== "transit"
      )
        conflict(point.location.semanticId, next.location.semanticId);
    }
  }
  const allNodeIds = city.pedestrianNodes.map(({ id }) => id);
  for (const [semanticId, kind] of [...requested]
    .filter(([semanticId]) => !aliases.has(semanticId))
    .sort(([left], [right]) => compareText(left, right))) {
    const forbidden = new Set(
      [...(conflicts.get(semanticId) ?? [])].flatMap((neighbor) => {
        const place = derived.get(neighbor);
        return place === undefined ? [] : [place.entranceNodeId];
      }),
    );
    const localCandidates = candidateNodes(city, kind).filter(
      (nodeId) => !forbidden.has(nodeId),
    );
    const candidates =
      localCandidates.length > 0
        ? localCandidates
        : allNodeIds.filter((nodeId) => !forbidden.has(nodeId));
    if (candidates.length === 0)
      throw new RangeError(
        `city cannot place semantic destination ${semanticId}`,
      );
    const index = Number(stableHash(semanticId) % BigInt(candidates.length));
    const entranceNodeId = candidates[index];
    if (entranceNodeId === undefined)
      throw new RangeError(
        `city cannot place semantic destination ${semanticId}`,
      );
    derived.set(semanticId, Object.freeze({ id: semanticId, entranceNodeId }));
  }
  for (const [semanticId, targetId] of [...aliases].sort(([left], [right]) =>
    compareText(left, right),
  )) {
    const target = derived.get(targetId);
    if (target === undefined)
      throw new RangeError(
        `city cannot resolve semantic destination alias ${semanticId} to ${targetId}`,
      );
    const existing = derived.get(semanticId);
    if (
      existing !== undefined &&
      existing.entranceNodeId !== target.entranceNodeId
    )
      throw new RangeError(
        `city semantic alias ${semanticId} conflicts with ${targetId}`,
      );
    derived.set(
      semanticId,
      Object.freeze({ id: semanticId, entranceNodeId: target.entranceNodeId }),
    );
  }
  const places = Object.freeze(
    [...derived.values()].sort((left, right) => compareText(left.id, right.id)),
  );
  const mappingHash = hashText(
    places.map((place) => `${place.id}\0${place.entranceNodeId}`).join("\0"),
  );
  const projection = Object.freeze({
    schema: city.schema,
    seed: city.seed,
    settlementId: city.settlementId,
    places,
    pedestrianNodes: city.pedestrianNodes,
    pedestrianEdges: city.pedestrianEdges,
    cityHash: `${city.cityHash}/${mappingHash}`,
  });
  setBoundedLivingCityCache(
    cache,
    itineraryKey,
    projection,
    livingCityCachePolicy.maximumTrajectoryCities,
  );
  return projection;
}

export function createProductionLivingCityScene(
  query: ProductionLivingCityQuery,
): LivingCityScene {
  if (query.projection.tick !== query.time.tick)
    throw new RangeError(
      "city projection tick must match explicit visual time",
    );
  const sampled = sampleTokens(query);
  const itineraryCache: Map<string, readonly PersonItineraryPoint[]> =
    itineraryWindowCaches.get(query.itineraryAt) ??
    new Map<string, readonly PersonItineraryPoint[]>();
  itineraryWindowCaches.set(query.itineraryAt, itineraryCache);
  const itineraries = sampled.map((token) => {
    const key = [
      query.branch,
      query.projection.realityBudget.stateHash,
      query.projection.eventHash,
      token.personId,
      query.time.tick.toString(),
    ].join("/");
    const cached = itineraryCache.get(key);
    if (cached !== undefined) return cached;
    const itinerary = itineraryWindow(
      token.personId,
      query.time.tick,
      query.itineraryAt,
    );
    setBoundedLivingCityCache(
      itineraryCache,
      key,
      itinerary,
      livingCityCachePolicy.maximumItineraryWindows,
    );
    return itinerary;
  });
  const figures: readonly LivingCityFigure[] = Object.freeze(
    sampled.map((token, index) => {
      const itinerary = itineraries[index];
      if (itinerary === undefined)
        throw new RangeError(`missing itinerary for ${token.personId}`);
      const routedCity = trajectoryCity(query.city, [itinerary]);
      let pose;
      try {
        pose = queryPedestrianPose({
          schema: 1,
          branch: query.branch,
          stateHash: query.projection.realityBudget.stateHash,
          eventHash: query.projection.eventHash,
          personId: token.personId,
          itinerary,
          city: routedCity,
          time: query.time,
        });
      } catch (error) {
        throw new Error(
          `living-city trajectory failed for ${token.personId} (${itinerary
            .map(
              (point) =>
                `${point.tick}:${point.location.semanticId}->${point.route?.destinationId ?? "stationary"}`,
            )
            .join(
              ", ",
            )}): ${error instanceof Error ? error.message : "unknown trajectory error"}`,
          { cause: error },
        );
      }
      const currentPoint = itinerary.find(
        (point) => point.tick === query.time.tick,
      );
      if (currentPoint === undefined)
        throw new RangeError(
          `missing current itinerary point for ${token.personId}`,
        );
      return Object.freeze({
        personId: token.personId,
        representedWeight: token.weight,
        pinned: token.pinned,
        pose,
        appearanceKey: token.visualJitterKey,
        story: Object.freeze({
          activity: currentPoint.activity as LivingCityActivity,
          locationId: currentPoint.location.semanticId,
          encounterGroupId: currentPoint.encounterGroupId,
          encounterCount: currentPoint.encounters.length,
          eventIds: Object.freeze(
            query.projection.events
              .filter((event) => event.participantIds.includes(token.personId))
              .map((event) => event.id),
          ),
          routeReason: currentPoint.route?.reason ?? null,
          routeEdgeCount: currentPoint.route?.edgeIds.length ?? 0,
        }),
      });
    }),
  );
  const sampledPeople = figures.reduce(
    (total, figure) => total + figure.representedWeight,
    0n,
  );
  const representedPeople = query.projection.realityBudget.representedPeople;
  if (sampledPeople > representedPeople)
    throw new RangeError("living-city sample exceeds represented population");
  const figureSignature = figures
    .map(
      (figure) =>
        `${figure.personId}:${figure.representedWeight}:${figure.pose.trajectoryHash}`,
    )
    .join("\0");
  const semanticKey = `living-city/${hashText(
    [
      query.branch,
      query.projection.realityBudget.stateHash,
      query.projection.eventHash,
      query.projection.manifestationHash,
      query.city.cityHash,
      query.time.tick.toString(),
      query.time.phasePermillion.toString(),
      figureSignature,
    ].join("\0"),
  )}`;
  const selectedIndex = sampled.findIndex(
    (token) => token.personId === query.selectedPersonId,
  );
  const selectedItinerary = itineraries[selectedIndex];
  const selectedPoint = selectedItinerary?.find(
    (point) => point.tick === query.time.tick,
  );
  if (selectedPoint === undefined)
    throw new RangeError("selected person lacks a current itinerary point");
  const activityGroups = new Map<
    LivingCityActivity,
    { literalFigures: number; representedPeople: bigint }
  >();
  for (const figure of figures) {
    const current = activityGroups.get(figure.story.activity) ?? {
      literalFigures: 0,
      representedPeople: 0n,
    };
    activityGroups.set(figure.story.activity, {
      literalFigures: current.literalFigures + 1,
      representedPeople: current.representedPeople + figure.representedWeight,
    });
  }
  const story = Object.freeze({
    phase: storyPhase(selectedPoint, query.projection, query.festivalPeakHour),
    events: Object.freeze(
      query.projection.events.map((event) =>
        Object.freeze({
          id: event.id,
          kind: event.kind,
          locationId: event.locationId,
          participantIds: Object.freeze([...event.participantIds]),
        }),
      ),
    ),
    activityGroups: Object.freeze(
      [...activityGroups.entries()]
        .sort(([left], [right]) => compareText(left, right))
        .map(([activity, values]): LivingCityActivityGroup =>
          Object.freeze({ activity, ...values }),
        ),
    ),
  });
  return Object.freeze({
    schema: 1,
    context: Object.freeze({
      seed: query.city.seed,
      branch: query.branch,
      stateHash: query.projection.realityBudget.stateHash,
      eventHash: query.projection.eventHash,
      manifestationHash: query.projection.manifestationHash,
      time: Object.freeze({ ...query.time }),
    }),
    city: query.city,
    figures,
    story,
    selectedPersonId: query.selectedPersonId,
    representedPeople,
    unsampledRemainder: representedPeople - sampledPeople,
    semanticKey,
  });
}
