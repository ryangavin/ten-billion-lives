import { describe, expect, it } from "vitest";

import {
  BASELINE_WORLD_SEED,
  advanceWorldKernel,
  buildTransportGraph,
  createSignatureCommandLog,
  createWorldKernel,
  generateWorld,
} from "@ten-billion-lives/sim";

import { createAnalyticalItineraryIndex } from "./itinerary";

describe("analytical person itineraries", () => {
  const world = generateWorld(BASELINE_WORLD_SEED);
  const kernel = createWorldKernel();
  const itinerary = createAnalyticalItineraryIndex(world);
  const manifestation = itinerary.manifestation;
  const settlementCellId = world.settlements[0]?.cellId ?? "L5/0/0";
  const adultId = manifestation.personIdForCohortRank(
    settlementCellId,
    "adult",
    42n,
  );
  const stateAt = (tick: number) => advanceWorldKernel(kernel, tick);

  it("is pure for repeated and out-of-order time/LOD scrubbing", () => {
    const ticks = [19, 0, 10, 7, 24, 8, 16, 6];
    const first = ticks.map((tick) =>
      itinerary.queryPerson(adultId, BigInt(tick), stateAt(tick)),
    );
    const second = ticks.map((tick) =>
      itinerary.queryPerson(adultId, BigInt(tick), stateAt(tick)),
    );
    expect(first).toEqual(second);
    expect(first.every(Object.isFrozen)).toBe(true);

    const personLod = itinerary.queryPerson(adultId, 10n, stateAt(10), {
      lod: "person",
    });
    const regionLod = itinerary.queryPerson(adultId, 10n, stateAt(10), {
      lod: "region",
    });
    expect(regionLod.semanticHash).toBe(personLod.semanticHash);
    expect(regionLod.location.semanticId).toBe(personLod.location.semanticId);
    expect(regionLod.viewLocationId).not.toBe(personLod.viewLocationId);
  });

  it("reconciles identity cohorts, recurring places, and field channels", () => {
    for (const [cohort, activity] of [
      ["young", "school"],
      ["adult", "work"],
      ["older", "service"],
    ] as const) {
      const personId = manifestation.personIdForCohortRank(
        settlementCellId,
        cohort,
        42n,
      );
      const point = itinerary.queryPerson(personId, 10n, stateAt(10));
      const card = manifestation.person(personId);
      const fieldCell = stateAt(10).field.cells.find(
        (cell) => cell.cellId === card.cellId,
      );
      expect(point.activity).toBe(activity);
      expect(point.location.semanticId).toBe(card.primaryPlace.id);
      expect(point.fieldMembership).toMatchObject({
        homeCellId: card.cellId,
        cohort,
        cohortPopulation: fieldCell?.cohorts[cohort],
      });
      expect(point.fieldMembership.channelPopulation).toBeGreaterThan(0n);
    }
  });

  it("handles midnight boundaries without stepping resident state", () => {
    const before = itinerary.queryPerson(adultId, 23n, stateAt(23));
    const midnight = itinerary.queryPerson(adultId, 24n, stateAt(24));
    const origin = itinerary.queryPerson(adultId, 0n, stateAt(0));
    expect(before.activity).toBe("sleep");
    expect(midnight.activity).toBe("sleep");
    expect(midnight.dayIndex).toBe(1n);
    expect(midnight.hour).toBe(0);
    expect(midnight.location.semanticId).toBe(origin.location.semanticId);
    expect(midnight.semanticHash).not.toBe(origin.semanticHash);
  });

  it("replans a selected regional itinerary at close and reopen epochs", () => {
    const graph = buildTransportGraph(world);
    const commands = createSignatureCommandLog(graph);
    const signatureEdgeId = commands[0]?.edgeId ?? "";
    const sourceRegionId = graph.edges.find(
      (edge) => edge.id === signatureEdgeId,
    )?.from;
    const sourceCell = world.cells
      .filter((cell) => `region/${cell.regionId}` === sourceRegionId)
      .reduce<(typeof world.cells)[number] | undefined>(
        (largest, cell) =>
          largest === undefined || cell.population > largest.population
            ? cell
            : largest,
        undefined,
      );
    expect(sourceCell).toBeDefined();

    let candidateId: string | undefined;
    for (let ordinal = 0n; ordinal < 4_096n; ordinal += 1n) {
      const personId = manifestation.personIdAt(
        sourceCell?.id ?? settlementCellId,
        ordinal,
      );
      const reopened = itinerary.queryPerson(personId, 9n, stateAt(9));
      if (reopened.route?.edgeIds[0] === signatureEdgeId) {
        candidateId = personId;
        break;
      }
    }
    expect(candidateId).toBeDefined();

    const closed = itinerary.queryPerson(
      candidateId ?? adultId,
      7n,
      stateAt(7),
    );
    const stillClosed = itinerary.queryPerson(
      candidateId ?? adultId,
      8n,
      stateAt(8),
    );
    const reopened = itinerary.queryPerson(
      candidateId ?? adultId,
      9n,
      stateAt(9),
    );
    expect(closed.activity).toBe("transit");
    expect(closed.route?.edgeIds).not.toContain(signatureEdgeId);
    expect(closed.route?.replannedAtTick).toBe(7n);
    expect(stillClosed.route?.edgeIds).toEqual(closed.route?.edgeIds);
    expect(reopened.route?.edgeIds).toEqual([signatureEdgeId]);
    expect(reopened.route?.replannedAtTick).toBe(9n);
  });

  it("derives reciprocal encounters only for people at the same place and time", () => {
    const point = itinerary.queryPerson(adultId, 10n, stateAt(10));
    const coworker = point.encounters.find(
      (encounter) => encounter.relationshipKind === "coworker",
    );
    expect(coworker).toBeDefined();
    const reverse = itinerary.queryPerson(
      coworker?.personId ?? adultId,
      10n,
      stateAt(10),
    );
    expect(reverse.location.semanticId).toBe(point.location.semanticId);
    expect(reverse.encounterGroupId).toBe(point.encounterGroupId);
    expect(reverse.encounters).toContainEqual({
      personId: adultId,
      relationshipKind: "coworker",
    });
  });

  it("fails invalid IDs and mismatched authoritative time safely", () => {
    expect(() =>
      itinerary.queryPerson("person_0000000_0000000", 0n, stateAt(0)),
    ).toThrowError(new RangeError("Invalid person ID"));
    expect(() => itinerary.queryPerson(adultId, -1n, stateAt(0))).toThrow(
      /nonnegative/,
    );
    expect(() => itinerary.queryPerson(adultId, 7n, stateAt(6))).toThrow(
      /tick does not match world state/,
    );
  });
});
