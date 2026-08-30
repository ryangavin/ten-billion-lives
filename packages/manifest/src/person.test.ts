import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { BASELINE_WORLD_SEED, generateWorld } from "@ten-billion-lives/sim";

import { createManifestationIndex } from "./person";

describe("procedural people and reciprocal groups", () => {
  const world = generateWorld(BASELINE_WORLD_SEED);
  const index = createManifestationIndex(world);
  const settlementCellId = world.settlements[0]?.cellId ?? "L5/0/0";

  it("reconstructs stable opaque semantic person cards", () => {
    const personId = index.personIdAt(settlementCellId, 42n);
    const first = index.person(personId);
    const second = createManifestationIndex(world).person(personId);
    expect(personId).toMatch(/^person_[0-9a-z]{7}_[0-9a-z]{7}$/);
    expect(first).toEqual(second);
    expect(first.personId).toBe(personId);
    expect(first.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(first.semanticHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("matches the committed golden person, household, and relationship fixture", () => {
    const fixture = JSON.parse(
      readFileSync(
        new URL("../fixtures/person-golden-v1.json", import.meta.url),
        "utf8",
      ),
    ) as {
      cellId: string;
      localOrdinal: string;
      personId: string;
      card: unknown;
      householdMembers: string[];
      relationships: unknown;
    };
    const personId = index.personIdAt(
      fixture.cellId,
      BigInt(fixture.localOrdinal),
    );
    expect(personId).toBe(fixture.personId);
    expect(index.person(personId)).toEqual(fixture.card);
    expect(index.householdMembers(index.person(personId).household.id)).toEqual(
      fixture.householdMembers,
    );
    expect(index.relationships(personId)).toEqual(fixture.relationships);
  });

  it("assigns every cohort rank and place without exceeding exact quotas", () => {
    const quotas = index.cohortQuotas(settlementCellId);
    const cell = world.cells.find(
      (candidate) => candidate.id === settlementCellId,
    );
    expect(quotas.young + quotas.adult + quotas.older).toBe(cell?.population);
    for (const cohort of ["young", "adult", "older"] as const) {
      const quota = quotas[cohort];
      const first = index.person(
        index.personIdForCohortRank(settlementCellId, cohort, 0n),
      );
      const last = index.person(
        index.personIdForCohortRank(settlementCellId, cohort, quota - 1n),
      );
      expect(first.cohort).toBe(cohort);
      expect(last.cohort).toBe(cohort);
      expect(() =>
        index.personIdForCohortRank(settlementCellId, cohort, quota),
      ).toThrow(/cohort rank out of range/);
      const summary = index.placeQuota(settlementCellId, cohort);
      expect(summary.assigned).toBe(quota);
      expect(summary.groupCount).toBe(
        (quota + BigInt(summary.capacity) - 1n) / BigInt(summary.capacity),
      );
      const members = index.placeMembers(last.primaryPlace.id);
      expect(members).toContain(last.personId);
      expect(members.length).toBeLessThanOrEqual(summary.capacity);
    }
  });

  it("reconstructs reciprocal households and relationship edges by construction", () => {
    for (let ordinal = 0n; ordinal < 80n; ordinal += 1n) {
      const person = index.person(index.personIdAt(settlementCellId, ordinal));
      const household = index.householdMembers(person.household.id);
      expect(household).toContain(person.personId);
      expect(household).toHaveLength(person.household.memberCount);
      for (const relationship of index.relationships(person.personId)) {
        expect(
          index
            .relationships(relationship.personId)
            .some(
              (reverse) =>
                reverse.personId === person.personId &&
                reverse.kind === relationship.kind,
            ),
          `${relationship.kind} must be reciprocal`,
        ).toBe(true);
      }
    }
  });

  it("finds no collisions across a large deterministic local domain", () => {
    const ids = new Set<string>();
    for (let ordinal = 0n; ordinal < 100_000n; ordinal += 1n)
      ids.add(index.personIdAt(settlementCellId, ordinal));
    expect(ids.size).toBe(100_000);
  });

  it("tracks authoritative cohort quotas in a deterministic generated sample", () => {
    const quotas = index.cohortQuotas(settlementCellId);
    const population = quotas.young + quotas.adult + quotas.older;
    const counts = { young: 0, adult: 0, older: 0 };
    const sampleSize = 50_000;
    for (let ordinal = 0; ordinal < sampleSize; ordinal += 1) {
      const cohort = index.person(
        index.personIdAt(settlementCellId, BigInt(ordinal)),
      ).cohort;
      counts[cohort] += 1;
    }
    for (const cohort of ["young", "adult", "older"] as const) {
      const observed = counts[cohort] / sampleSize;
      const expected = Number(quotas[cohort]) / Number(population);
      expect(Math.abs(observed - expected), cohort).toBeLessThan(0.015);
    }
  });

  it("fails opaque invalid IDs without leaking sequential ranges", () => {
    for (const invalid of [
      "person_0000000_0000000",
      "person_zzzzzzz_zzzzzzz",
      "person_123",
      "42",
    ]) {
      try {
        index.person(invalid);
        throw new Error("invalid ID was accepted");
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        expect((error as Error).message).toBe("Invalid person ID");
        expect((error as Error).message).not.toMatch(/ordinal|range|cell/i);
      }
    }
  });

  it("keeps queries pure and retains only compact cell metadata", () => {
    const personId = index.personIdAt(settlementCellId, 7n);
    const before = index.person(personId);
    index.relationships(index.personIdAt(settlementCellId, 999n));
    index.householdMembers(before.household.id);
    expect(index.person(personId)).toEqual(before);
    expect(index.diagnostics()).toEqual({
      retainedCells: 2_048,
      representedPeople: 10_000_000_000n,
      retainedPersonRows: 0,
    });
  });
});
