import { describe, expect, it } from "vitest";

import { createIllusionEngine } from "@ten-billion-lives/manifest";
import {
  BASELINE_WORLD_SEED,
  advanceWorldKernel,
  createWorldKernel,
} from "@ten-billion-lives/sim";

import {
  CLOSURE_PERSON_ID,
  FESTIVAL_PERSON_ID,
  buildExperienceLink,
  createExperienceKernel,
  parseExperienceLink,
} from "./experience";

describe("local person experience contract", () => {
  const engine = createIllusionEngine(createWorldKernel().world);
  const personId = engine.manifestation.personIdAt(
    engine.manifestation.person(FESTIVAL_PERSON_ID).cellId,
    42n,
  );

  it("round-trips a versioned person/tick/branch deep link", () => {
    const href = buildExperienceLink("http://127.0.0.1:4173/observatory", {
      schema: 1,
      seed: BASELINE_WORLD_SEED,
      tick: 10,
      personId,
      branch: "baseline",
    });
    const url = new URL(href);
    expect(url.pathname).toBe("/observatory");
    expect(parseExperienceLink(url.search, engine.manifestation)).toEqual({
      ok: true,
      value: {
        schema: 1,
        seed: BASELINE_WORLD_SEED,
        tick: 10,
        personId,
        branch: "baseline",
      },
    });
  });

  it("returns an actionable error for incompatible deep links", () => {
    for (const [query, message] of [
      [
        `?schema=2&seed=${encodeURIComponent(BASELINE_WORLD_SEED)}&tick=10&person=${personId}&branch=baseline`,
        "schema",
      ],
      [
        `?schema=1&seed=another-world&tick=10&person=${personId}&branch=baseline`,
        "seed",
      ],
      [
        `?schema=1&seed=${encodeURIComponent(BASELINE_WORLD_SEED)}&tick=-1&person=${personId}&branch=baseline`,
        "tick",
      ],
      [
        `?schema=1&seed=${encodeURIComponent(BASELINE_WORLD_SEED)}&tick=10&person=person_0000000_0000000&branch=baseline`,
        "person",
      ],
      [
        `?schema=1&seed=${encodeURIComponent(BASELINE_WORLD_SEED)}&tick=10&person=${personId}&branch=remote`,
        "branch",
      ],
    ] as const) {
      const result = parseExperienceLink(query, engine.manifestation);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(new RegExp(message, "i"));
    }
    expect(parseExperienceLink("", engine.manifestation)).toEqual({
      ok: true,
      value: null,
    });
  });

  it("keeps baseline immutable while a local closure branch changes macro and micro routes", () => {
    const baselineGenesis = createExperienceKernel("baseline");
    const closureGenesis = createExperienceKernel("closure");
    const baseline = advanceWorldKernel(baselineGenesis, 7);
    const closure = advanceWorldKernel(closureGenesis, 7);
    const baselinePoint = engine.itinerary.queryPerson(
      CLOSURE_PERSON_ID,
      7n,
      baseline,
    );
    const closurePoint = engine.itinerary.queryPerson(
      CLOSURE_PERSON_ID,
      7n,
      closure,
    );
    expect(baselineGenesis.events).toEqual([]);
    expect(closureGenesis.events.map((event) => event.type)).toEqual([
      "route-close",
      "route-open",
    ]);
    expect(baseline.field.stateHash).toBe(closure.field.stateHash);
    expect(baselinePoint.route?.edgeIds).toHaveLength(1);
    expect(closurePoint.route?.edgeIds).toHaveLength(31);
    expect(closurePoint.route?.replannedAtTick).toBe(7n);
    expect(createExperienceKernel("baseline")).toEqual(baselineGenesis);
  });

  it("shows one procedural traveler at stable meetings, festival peak, and departure", () => {
    const baseline = createExperienceKernel("baseline");
    const workState = advanceWorldKernel(baseline, 10);
    const festivalState = advanceWorldKernel(baseline, 19);
    const departureState = advanceWorldKernel(baseline, 21);
    const meeting = engine.project({
      state: workState,
      tick: 10n,
      scopeCellIds: [engine.manifestation.person(FESTIVAL_PERSON_ID).cellId],
      lod: "person",
      selectedPersonIds: [FESTIVAL_PERSON_ID],
    });
    const festival = engine.itinerary.queryPerson(
      FESTIVAL_PERSON_ID,
      19n,
      festivalState,
    );
    const departure = engine.itinerary.queryPerson(
      FESTIVAL_PERSON_ID,
      21n,
      departureState,
    );
    expect(meeting.events.some((event) => event.kind === "meeting")).toBe(true);
    expect(festival.activity).toBe("festival");
    expect(festival.location.semanticId).toBe("festival/lantern-confluence");
    expect(departure.activity).toBe("transit");
    expect(departure.route?.reason).toBe("festival return");
  });
});
