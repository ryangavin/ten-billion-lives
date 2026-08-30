import { describe, expect, it } from "vitest";

import {
  advanceWorldKernel,
  createWorldKernel,
  type WorldKernel,
} from "@ten-billion-lives/sim";

import {
  allocateManifestationWeights,
  createIllusionEngine,
} from "./projection";

describe("stable weighted manifestations and local events", () => {
  const genesis = createWorldKernel();
  const stateAt = (tick: number): WorldKernel =>
    advanceWorldKernel(genesis, tick);
  const engine = createIllusionEngine(genesis.world);
  const cellId = genesis.world.settlements[0]?.cellId ?? "L5/0/38";
  const selectedPersonId = engine.manifestation.personIdAt(cellId, 42n);

  it("is invariant to observer, camera path, frame rate, and visual quality", () => {
    const query = {
      state: stateAt(10),
      tick: 10n,
      scopeCellIds: [cellId],
      lod: "street" as const,
      selectedPersonIds: [selectedPersonId],
    };
    const first = engine.project(query, {
      observerId: "observer-a",
      cameraPath: "planet/region/street",
      frameRate: 30,
      quality: "fallback",
    });
    const second = engine.project(query, {
      observerId: "observer-b",
      cameraPath: "person/street/region/street",
      frameRate: 144,
      quality: "showcase",
    });
    expect(second.manifestationHash).toBe(first.manifestationHash);
    expect(second.eventHash).toBe(first.eventHash);
    expect(second.tokens).toEqual(first.tokens);
    expect(second.events).toEqual(first.events);
  });

  it("reconciles every integer weight with exact home-cell cohort fields", () => {
    const state = stateAt(10);
    const projection = engine.project({
      state,
      tick: 10n,
      scopeCellIds: [cellId],
      lod: "street",
      selectedPersonIds: [selectedPersonId],
    });
    const fieldCell = state.field.cells.find((cell) => cell.cellId === cellId);
    expect(projection.tokens).toHaveLength(25_000);
    expect(projection.realityBudget.materializedTokens).toBe(25_000);
    expect(projection.realityBudget.representedPeople).toBe(
      fieldCell?.residents,
    );
    for (const cohort of ["young", "adult", "older"] as const)
      expect(
        projection.tokens
          .filter((token) => token.cohort === cohort)
          .reduce((total, token) => total + token.weight, 0n),
      ).toBe(fieldCell?.cohorts[cohort]);
    expect(projection.tokens).toContainEqual(
      expect.objectContaining({ personId: selectedPersonId, weight: 1n }),
    );
    expect(allocateManifestationWeights(7n, 10)).toEqual([
      1n,
      1n,
      1n,
      1n,
      1n,
      1n,
      1n,
    ]);
  });

  it("keeps selected identity stable across LOD departure and re-entry", () => {
    const state = stateAt(10);
    const project = (lod: "planet" | "region" | "street" | "person") =>
      engine.project({
        state,
        tick: 10n,
        scopeCellIds: [cellId],
        lod,
        selectedPersonIds: [selectedPersonId],
      });
    const planet = project("planet");
    for (const lod of ["region", "street", "person"] as const)
      expect(
        project(lod).tokens.some(
          (token) => token.personId === selectedPersonId,
        ),
      ).toBe(true);
    expect(project("planet")).toEqual(planet);
    expect(planet.realityBudget.continuityHorizonTicks).toBe(24n);
  });

  it("changes only one eighth of the unpinned crowd at an identity epoch", () => {
    const before = engine.project({
      state: stateAt(23),
      tick: 23n,
      scopeCellIds: [cellId],
      lod: "region",
      selectedPersonIds: [selectedPersonId],
    });
    const after = engine.project({
      state: stateAt(24),
      tick: 24n,
      scopeCellIds: [cellId],
      lod: "region",
      selectedPersonIds: [selectedPersonId],
    });
    const beforeIds = new Set(before.tokens.map((token) => token.personId));
    const retained = after.tokens.filter((token) =>
      beforeIds.has(token.personId),
    ).length;
    expect(retained / after.tokens.length).toBeGreaterThanOrEqual(0.875);
    expect(
      after.tokens.some((token) => token.personId === selectedPersonId),
    ).toBe(true);
    expect(after.identityEpoch).toBe(1n);
    expect(after.manifestationHash).not.toBe(before.manifestationHash);
  });

  it("emits only itinerary- and relationship-consistent arrivals and meetings", () => {
    const state = stateAt(10);
    const projection = engine.project({
      state,
      tick: 10n,
      scopeCellIds: [cellId],
      lod: "person",
      selectedPersonIds: [selectedPersonId],
    });
    const selectedPoint = engine.itinerary.queryPerson(
      selectedPersonId,
      10n,
      state,
    );
    expect(projection.events).toContainEqual(
      expect.objectContaining({
        kind: "arrival",
        locationId: selectedPoint.location.semanticId,
        participantIds: [selectedPersonId],
      }),
    );
    const meetings = projection.events.filter(
      (event) => event.kind === "meeting",
    );
    expect(meetings.length).toBeGreaterThan(0);
    for (const meeting of meetings) {
      const [firstId, secondId] = meeting.participantIds;
      const first = engine.itinerary.queryPerson(firstId ?? "", 10n, state);
      const second = engine.itinerary.queryPerson(secondId ?? "", 10n, state);
      expect(first.location.semanticId).toBe(meeting.locationId);
      expect(second.location.semanticId).toBe(meeting.locationId);
      expect(
        first.encounters.some((entry) => entry.personId === secondId),
      ).toBe(true);
      expect(
        second.encounters.some((entry) => entry.personId === firstId),
      ).toBe(true);
    }
  });

  it("locks festival participation to the analytical itinerary", () => {
    const festivalPersonId = "person_0001wdp_1iiinqk";
    const state = stateAt(19);
    const projection = engine.project({
      state,
      tick: 19n,
      scopeCellIds: ["L5/0/3"],
      lod: "person",
      selectedPersonIds: [festivalPersonId],
    });
    expect(projection.events).toContainEqual(
      expect.objectContaining({
        kind: "festival",
        locationId: "festival/lantern-confluence",
        participantIds: [festivalPersonId],
      }),
    );
  });

  it("rejects invalid scope, time, and selected identity context", () => {
    expect(() =>
      engine.project({
        state: stateAt(9),
        tick: 10n,
        scopeCellIds: [cellId],
        lod: "street",
        selectedPersonIds: [],
      }),
    ).toThrow(/tick does not match/);
    expect(() =>
      engine.project({
        state: stateAt(0),
        tick: 0n,
        scopeCellIds: ["missing"],
        lod: "street",
        selectedPersonIds: [],
      }),
    ).toThrow(/scope cell/);
    expect(() =>
      engine.project({
        state: stateAt(0),
        tick: 0n,
        scopeCellIds: [cellId],
        lod: "street",
        selectedPersonIds: ["person_0000000_0000000"],
      }),
    ).toThrowError(new RangeError("Invalid person ID"));
  });
});
