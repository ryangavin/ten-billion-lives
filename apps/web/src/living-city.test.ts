import { describe, expect, it } from "vitest";

import {
  createCityProjection,
  createIllusionEngine,
  createVisualTime,
} from "@ten-billion-lives/manifest";
import {
  BASELINE_WORLD_SEED,
  advanceWorldKernel,
  createWorldKernel,
  generateWorld,
} from "@ten-billion-lives/sim";

import {
  createProductionLivingCityScene,
  livingCityCachePolicy,
  setBoundedLivingCityCache,
} from "./living-city";

describe("production living-city scene adapter", () => {
  it("bounds derived route and itinerary caches to the visible showcase working set", () => {
    expect(livingCityCachePolicy).toEqual({
      maximumTrajectoryCities: 256,
      maximumItineraryWindows: 512,
    });

    const cache = new Map<string, number>();
    setBoundedLivingCityCache(cache, "first", 1, 2);
    setBoundedLivingCityCache(cache, "second", 2, 2);
    setBoundedLivingCityCache(cache, "third", 3, 2);

    expect([...cache]).toEqual([
      ["second", 2],
      ["third", 3],
    ]);
  });

  it("composes projection tokens, exact itineraries, and city routes without changing semantics", () => {
    const world = generateWorld(BASELINE_WORLD_SEED);
    const city = createCityProjection({
      schema: 1,
      seed: BASELINE_WORLD_SEED,
      settlementId: "place/brindle-bay",
    });
    const genesis = createWorldKernel(BASELINE_WORLD_SEED, []);
    const states = new Map([[0n, genesis]]);
    const stateAt = (tick: bigint) => {
      const cached = states.get(tick);
      if (cached !== undefined) return cached;
      const state = advanceWorldKernel(genesis, Number(tick));
      states.set(tick, state);
      return state;
    };
    const observerA = createIllusionEngine(world);
    const observerB = createIllusionEngine(world);
    const cellId = world.settlements[0]?.cellId;
    if (cellId === undefined) throw new Error("missing Brindle Bay cell");
    const selectedPersonId = observerA.manifestation.personIdAt(cellId, 42n);
    const state = stateAt(7n);
    const project = (engine: typeof observerA) =>
      engine.project({
        state,
        tick: 7n,
        scopeCellIds: [cellId],
        lod: "person",
        selectedPersonIds: [selectedPersonId],
      });
    const itineraryAt =
      (engine: typeof observerA) => (personId: string, tick: bigint) =>
        engine.itinerary.queryPerson(personId, tick, stateAt(tick));
    const query = {
      city,
      branch: "baseline" as const,
      time: createVisualTime(7n, 500_000),
      selectedPersonId,
      quality: "fallback" as const,
      festivalPeakHour: 19,
    };
    const projectionA = project(observerA);
    const projectionB = project(observerB);

    const cityScene = createProductionLivingCityScene({
      ...query,
      projection: projectionA,
      itineraryAt: itineraryAt(observerA),
      level: "city",
    });
    const neighborhoodScene = createProductionLivingCityScene({
      ...query,
      projection: projectionA,
      itineraryAt: itineraryAt(observerA),
      level: "neighborhood",
    });
    const independent = createProductionLivingCityScene({
      ...query,
      projection: projectionB,
      itineraryAt: itineraryAt(observerB),
      level: "city",
    });

    expect(cityScene.figures).toHaveLength(64);
    expect(neighborhoodScene.figures).toHaveLength(128);
    expect(
      cityScene.figures.every((figure) =>
        neighborhoodScene.figures.some(
          (candidate) => candidate.personId === figure.personId,
        ),
      ),
    ).toBe(true);
    expect(
      cityScene.figures.every((figure) =>
        projectionA.tokens.some((token) => token.personId === figure.personId),
      ),
    ).toBe(true);
    expect(
      cityScene.figures.reduce(
        (total, figure) => total + figure.representedWeight,
        cityScene.unsampledRemainder,
      ),
    ).toBe(cityScene.representedPeople);
    expect(
      cityScene.figures.find((figure) => figure.personId === selectedPersonId),
    ).toMatchObject({ representedWeight: 1n, pinned: true });
    expect(
      cityScene.figures.every(
        (figure) =>
          figure.pose.time.tick === 7n &&
          figure.pose.time.phasePermillion === 500_000 &&
          figure.pose.trajectoryHash.length === 16,
      ),
    ).toBe(true);
    expect(independent).toEqual(cityScene);
    const selectedFigure = cityScene.figures.find(
      (figure) => figure.personId === selectedPersonId,
    );
    expect(cityScene.story.phase).toBe("commute");
    expect(selectedFigure?.story).toMatchObject({
      activity: "transit",
      encounterGroupId: expect.stringMatching(/^encounter_/),
      routeReason: "daily commute",
    });
    expect(selectedFigure?.story.eventIds).toEqual(
      projectionA.events
        .filter((event) => event.participantIds.includes(selectedPersonId))
        .map((event) => event.id),
    );
    expect(
      cityScene.story.activityGroups.reduce(
        (total, group) => total + group.representedPeople,
        cityScene.unsampledRemainder,
      ),
    ).toBe(cityScene.representedPeople);
    const presentationWithoutEvents = createProductionLivingCityScene({
      ...query,
      projection: Object.freeze({
        ...projectionA,
        events: Object.freeze([]),
      }),
      itineraryAt: itineraryAt(observerA),
      level: "city",
    });
    expect(presentationWithoutEvents.semanticKey).toBe(cityScene.semanticKey);
    expect(presentationWithoutEvents.story.events).toEqual([]);

    const aliasedPersonId = "person_05iqcey_0p7mu3t";
    const aliasedState = stateAt(9n);
    const aliasedProjection = observerA.project({
      state: aliasedState,
      tick: 9n,
      scopeCellIds: [cellId],
      lod: "person",
      selectedPersonIds: [selectedPersonId],
    });
    const aliasedScene = createProductionLivingCityScene({
      ...query,
      projection: aliasedProjection,
      time: createVisualTime(9n, 999_999),
      level: "person",
      quality: "baseline",
      itineraryAt: itineraryAt(observerA),
    });
    expect(
      aliasedScene.figures.find(
        (figure) => figure.personId === aliasedPersonId,
      ),
    ).toMatchObject({
      pose: {
        mode: "walking",
        destinationPlaceId: "region/region-0-5",
      },
    });
  }, 15_000);
});
