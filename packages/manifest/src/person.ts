import {
  CanonicalWriter,
  fnv1a64,
  largestRemainder,
  randomU32,
  type FictionalWorld,
  type WorldCell,
} from "@ten-billion-lives/sim";

export type PersonCohort = "young" | "adult" | "older";
export type PlaceKind = "school" | "workplace" | "service-circle";
export type RelationshipKind =
  | "household"
  | "classmate"
  | "coworker"
  | "recurring-group"
  | "recurring-contact";

export interface CohortQuotas {
  readonly young: bigint;
  readonly adult: bigint;
  readonly older: bigint;
}

export interface PlaceQuota {
  readonly kind: PlaceKind;
  readonly capacity: number;
  readonly groupCount: bigint;
  readonly assigned: bigint;
}

export interface PersonCard {
  readonly personId: string;
  readonly name: string;
  readonly ageYears: number;
  readonly cohort: PersonCohort;
  readonly cellId: string;
  readonly regionId: string;
  readonly home: string;
  readonly household: Readonly<{
    id: string;
    role: "household anchor" | "housemate" | "dependent" | "elder";
    memberCount: number;
  }>;
  readonly primaryPlace: Readonly<{
    id: string;
    kind: PlaceKind;
    name: string;
    capacity: number;
    memberCount: number;
  }>;
  readonly appearance: Readonly<{
    stature: "compact" | "medium" | "tall";
    hair: "dark" | "warm" | "light" | "silver";
    wardrobe: "practical" | "layered" | "bright" | "quiet";
  }>;
  readonly semanticHash: string;
}

export interface Relationship {
  readonly personId: string;
  readonly kind: RelationshipKind;
}

interface AffinePermutation {
  readonly multiplier: bigint;
  readonly offset: bigint;
  readonly inverse: bigint;
  readonly modulus: bigint;
}

interface CellMetadata {
  readonly index: number;
  readonly cell: WorldCell;
  readonly prefix: bigint;
  readonly quotas: CohortQuotas;
  readonly affine: AffinePermutation;
}

interface ResolvedPerson {
  readonly globalOrdinal: bigint;
  readonly localOrdinal: bigint;
  readonly cohortRank: bigint;
  readonly cohort: PersonCohort;
  readonly cell: CellMetadata;
}

const firstSyllables = [
  "Ari",
  "Bela",
  "Cori",
  "Dara",
  "Eli",
  "Fara",
  "Ivo",
  "Lumi",
  "Maro",
  "Neri",
  "Ola",
  "Ravi",
  "Sena",
  "Tavi",
  "Vela",
  "Zuri",
] as const;
const familySyllables = [
  "Aster",
  "Briar",
  "Cove",
  "Dale",
  "Ember",
  "Fenn",
  "Grove",
  "Hale",
  "Iris",
  "Lark",
  "Mere",
  "North",
  "Reed",
  "Vale",
  "Wren",
  "Yarrow",
] as const;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function modularInverse(value: bigint, modulus: bigint): bigint {
  let oldR = value;
  let r = modulus;
  let oldS = 1n;
  let s = 0n;
  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }
  if (oldR !== 1n) throw new Error("affine inverse invariant failed");
  return ((oldS % modulus) + modulus) % modulus;
}

function makeAffine(
  modulus: bigint,
  seed: bigint,
  domain: string,
  counter: bigint,
): AffinePermutation {
  if (modulus <= 1n)
    return Object.freeze({ multiplier: 0n, offset: 0n, inverse: 0n, modulus });
  let multiplier =
    BigInt(randomU32(`${domain}/multiplier`, seed, counter)) % modulus;
  if (multiplier === 0n) multiplier = 1n;
  while (gcd(multiplier, modulus) !== 1n)
    multiplier = multiplier + 1n === modulus ? 1n : multiplier + 1n;
  const offset = BigInt(randomU32(`${domain}/offset`, seed, counter)) % modulus;
  return Object.freeze({
    multiplier,
    offset,
    inverse: modularInverse(multiplier, modulus),
    modulus,
  });
}

function permute(value: bigint, affine: AffinePermutation): bigint {
  if (affine.modulus <= 1n) return 0n;
  return (affine.multiplier * value + affine.offset) % affine.modulus;
}

function unpermute(value: bigint, affine: AffinePermutation): bigint {
  if (affine.modulus <= 1n) return 0n;
  return (
    (affine.inverse *
      ((value - affine.offset + affine.modulus) % affine.modulus)) %
    affine.modulus
  );
}

function parseBase36(value: string): bigint {
  let result = 0n;
  for (const character of value) {
    const digit = parseInt(character, 36);
    if (!Number.isInteger(digit) || digit < 0 || digit >= 36)
      throw new RangeError("invalid base36 token");
    result = result * 36n + BigInt(digit);
  }
  return result;
}

function quotasFor(population: bigint): CohortQuotas {
  const [young, adult, older] = largestRemainder(population, [
    220n,
    620n,
    160n,
  ]);
  return Object.freeze({
    young: young ?? 0n,
    adult: adult ?? 0n,
    older: older ?? 0n,
  });
}

function placeKind(cohort: PersonCohort): PlaceKind {
  return cohort === "young"
    ? "school"
    : cohort === "adult"
      ? "workplace"
      : "service-circle";
}

function placeCapacity(cohort: PersonCohort): number {
  return cohort === "young" ? 256 : cohort === "adult" ? 512 : 128;
}

function placeCode(kind: PlaceKind): "sch" | "wrk" | "svc" {
  return kind === "school" ? "sch" : kind === "workplace" ? "wrk" : "svc";
}

export class ManifestationIndex {
  readonly #world: FictionalWorld;
  readonly #seedWord: bigint;
  readonly #cells: readonly CellMetadata[];
  readonly #cellById: ReadonlyMap<string, CellMetadata>;
  readonly #globalAffine: AffinePermutation;
  readonly #tupleMasks: Readonly<
    Record<"household" | "school" | "workplace" | "service-circle", bigint>
  >;

  constructor(world: FictionalWorld) {
    this.#world = world;
    this.#seedWord = fnv1a64(
      new TextEncoder().encode(`${world.seed}/manifestation/v1`),
    );
    let prefix = 0n;
    const cells = world.cells.map((cell, index) => {
      const metadata = Object.freeze({
        index,
        cell,
        prefix,
        quotas: quotasFor(cell.population),
        affine: makeAffine(
          cell.population,
          this.#seedWord,
          "manifest/cell-slot",
          BigInt(index),
        ),
      });
      prefix += cell.population;
      return metadata;
    });
    if (prefix !== world.totalPopulation)
      throw new Error("manifestation prefix conservation failed");
    this.#cells = Object.freeze(cells);
    this.#cellById = new Map(cells.map((cell) => [cell.cell.id, cell]));
    this.#globalAffine = makeAffine(
      world.totalPopulation,
      this.#seedWord,
      "manifest/person-id",
      0n,
    );
    const tupleMask = (kind: "household" | PlaceKind): bigint =>
      fnv1a64(
        new CanonicalWriter("manifest-tuple-mask", 1)
          .u64(this.#seedWord)
          .text(kind)
          .bytes(),
      );
    this.#tupleMasks = Object.freeze({
      household: tupleMask("household"),
      school: tupleMask("school"),
      workplace: tupleMask("workplace"),
      "service-circle": tupleMask("service-circle"),
    });
  }

  #checksum(domain: string, value: bigint): string {
    return randomU32(domain, this.#seedWord, BigInt.asUintN(64, value))
      .toString(36)
      .padStart(7, "0");
  }

  #personIdFromGlobal(globalOrdinal: bigint): string {
    const encoded = permute(globalOrdinal, this.#globalAffine);
    const token = encoded.toString(36).padStart(7, "0");
    return `person_${token}_${this.#checksum("manifest/person/checksum", encoded)}`;
  }

  #globalFromPersonId(personId: string): bigint {
    const match = /^person_([0-9a-z]{7})_([0-9a-z]{7})$/.exec(personId);
    if (!match) throw new RangeError("Invalid person ID");
    try {
      const encoded = parseBase36(match[1] ?? "");
      if (
        encoded >= this.#world.totalPopulation ||
        match[2] !== this.#checksum("manifest/person/checksum", encoded)
      )
        throw new RangeError("Invalid person ID");
      return unpermute(encoded, this.#globalAffine);
    } catch {
      throw new RangeError("Invalid person ID");
    }
  }

  #cellForGlobal(globalOrdinal: bigint): CellMetadata {
    let low = 0;
    let high = this.#cells.length - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const cell = this.#cells[middle];
      if (cell === undefined) break;
      if (globalOrdinal < cell.prefix) high = middle - 1;
      else if (globalOrdinal >= cell.prefix + cell.cell.population)
        low = middle + 1;
      else return cell;
    }
    throw new RangeError("Invalid person ID");
  }

  #resolve(personId: string): ResolvedPerson {
    const globalOrdinal = this.#globalFromPersonId(personId);
    const cell = this.#cellForGlobal(globalOrdinal);
    const localOrdinal = globalOrdinal - cell.prefix;
    const slot = permute(localOrdinal, cell.affine);
    if (slot < cell.quotas.young)
      return {
        globalOrdinal,
        localOrdinal,
        cohortRank: slot,
        cohort: "young",
        cell,
      };
    if (slot < cell.quotas.young + cell.quotas.adult)
      return {
        globalOrdinal,
        localOrdinal,
        cohortRank: slot - cell.quotas.young,
        cohort: "adult",
        cell,
      };
    return {
      globalOrdinal,
      localOrdinal,
      cohortRank: slot - cell.quotas.young - cell.quotas.adult,
      cohort: "older",
      cell,
    };
  }

  #tupleId(
    kind: "household" | PlaceKind,
    cellIndex: number,
    group: bigint,
  ): string {
    if (group < 0n || group > 0xffff_ffffn)
      throw new RangeError("opaque group out of range");
    const value = (BigInt(cellIndex) << 32n) | group;
    const encoded = BigInt.asUintN(64, value ^ this.#tupleMasks[kind]);
    const prefix =
      kind === "household" ? "household" : `place_${placeCode(kind)}`;
    return `${prefix}_${encoded.toString(36).padStart(13, "0")}_${this.#checksum(
      `manifest/${kind}/checksum`,
      encoded,
    )}`;
  }

  #decodeTuple(
    id: string,
    kind: "household" | PlaceKind,
  ): { cell: CellMetadata; group: bigint } {
    const prefix =
      kind === "household" ? "household" : `place_${placeCode(kind)}`;
    const match = new RegExp(`^${prefix}_([0-9a-z]{13})_([0-9a-z]{7})$`).exec(
      id,
    );
    if (!match) throw new RangeError(`Invalid ${kind} ID`);
    try {
      const encoded = parseBase36(match[1] ?? "");
      if (match[2] !== this.#checksum(`manifest/${kind}/checksum`, encoded))
        throw new Error("checksum");
      const value = BigInt.asUintN(64, encoded ^ this.#tupleMasks[kind]);
      const cellIndex = Number(value >> 32n);
      const group = value & 0xffff_ffffn;
      const cell = this.#cells[cellIndex];
      if (cell === undefined) throw new Error("cell");
      return { cell, group };
    } catch {
      throw new RangeError(`Invalid ${kind} ID`);
    }
  }

  #personIdForRank(
    cell: CellMetadata,
    cohort: PersonCohort,
    rank: bigint,
  ): string {
    const quota = cell.quotas[cohort];
    if (rank < 0n || rank >= quota)
      throw new RangeError("cohort rank out of range");
    const start =
      cohort === "young"
        ? 0n
        : cohort === "adult"
          ? cell.quotas.young
          : cell.quotas.young + cell.quotas.adult;
    const localOrdinal = unpermute(start + rank, cell.affine);
    return this.#personIdFromGlobal(cell.prefix + localOrdinal);
  }

  personIdAt(cellId: string, localOrdinal: bigint): string {
    const cell = this.#cellById.get(cellId);
    if (
      cell === undefined ||
      localOrdinal < 0n ||
      localOrdinal >= cell.cell.population
    )
      throw new RangeError("person location out of range");
    return this.#personIdFromGlobal(cell.prefix + localOrdinal);
  }

  personIdForCohortRank(
    cellId: string,
    cohort: PersonCohort,
    rank: bigint,
  ): string {
    const cell = this.#cellById.get(cellId);
    if (cell === undefined) throw new RangeError("unknown manifestation cell");
    return this.#personIdForRank(cell, cohort, rank);
  }

  cohortQuotas(cellId: string): CohortQuotas {
    const cell = this.#cellById.get(cellId);
    if (cell === undefined) throw new RangeError("unknown manifestation cell");
    return cell.quotas;
  }

  placeQuota(cellId: string, cohort: PersonCohort): PlaceQuota {
    const cell = this.#cellById.get(cellId);
    if (cell === undefined) throw new RangeError("unknown manifestation cell");
    const capacity = placeCapacity(cohort);
    const assigned = cell.quotas[cohort];
    return Object.freeze({
      kind: placeKind(cohort),
      capacity,
      groupCount: (assigned + BigInt(capacity) - 1n) / BigInt(capacity),
      assigned,
    });
  }

  person(personId: string): PersonCard {
    const resolved = this.#resolve(personId);
    const nameWord = randomU32(
      "manifest/person/name",
      this.#seedWord,
      resolved.globalOrdinal,
    );
    const familyWord = randomU32(
      "manifest/person/family",
      this.#seedWord,
      resolved.globalOrdinal,
    );
    const firstName = firstSyllables[nameWord % firstSyllables.length] ?? "Ari";
    const familyName =
      familySyllables[familyWord % familySyllables.length] ?? "Vale";
    const ageWord = randomU32(
      "manifest/person/age",
      this.#seedWord,
      resolved.globalOrdinal,
    );
    const ageYears =
      resolved.cohort === "young"
        ? 5 + (ageWord % 17)
        : resolved.cohort === "adult"
          ? 22 + (ageWord % 43)
          : 65 + (ageWord % 31);
    const householdGroup = resolved.localOrdinal / 4n;
    const householdStart = householdGroup * 4n;
    const householdMemberCount = Number(
      resolved.cell.cell.population - householdStart < 4n
        ? resolved.cell.cell.population - householdStart
        : 4n,
    );
    const householdOffset = Number(resolved.localOrdinal % 4n);
    const role =
      householdOffset === 0
        ? "household anchor"
        : resolved.cohort === "young"
          ? "dependent"
          : resolved.cohort === "older"
            ? "elder"
            : "housemate";
    const kind = placeKind(resolved.cohort);
    const capacity = placeCapacity(resolved.cohort);
    const group = resolved.cohortRank / BigInt(capacity);
    const groupStart = group * BigInt(capacity);
    const quota = resolved.cell.quotas[resolved.cohort];
    const memberCount = Number(
      quota - groupStart < BigInt(capacity)
        ? quota - groupStart
        : BigInt(capacity),
    );
    const householdId = this.#tupleId(
      "household",
      resolved.cell.index,
      householdGroup,
    );
    const primaryPlaceId = this.#tupleId(kind, resolved.cell.index, group);
    const descriptorWord = randomU32(
      "manifest/person/appearance",
      this.#seedWord,
      resolved.globalOrdinal,
    );
    const appearance = Object.freeze({
      stature:
        (["compact", "medium", "tall"] as const)[descriptorWord % 3] ??
        "medium",
      hair:
        (["dark", "warm", "light", "silver"] as const)[
          (descriptorWord >>> 5) % 4
        ] ?? "dark",
      wardrobe:
        (["practical", "layered", "bright", "quiet"] as const)[
          (descriptorWord >>> 10) % 4
        ] ?? "practical",
    });
    const placeNameWord = randomU32(
      `manifest/${kind}/name`,
      this.#seedWord,
      (BigInt(resolved.cell.index) << 32n) | group,
    );
    const placeName = `${familySyllables[placeNameWord % familySyllables.length] ?? "Aster"} ${
      kind === "school"
        ? "Learning House"
        : kind === "workplace"
          ? "Works"
          : "Circle"
    }`;
    const semanticHash = fnv1a64(
      new CanonicalWriter("manifest-person-card", 1)
        .text(personId)
        .text(`${firstName} ${familyName}`)
        .u32(ageYears)
        .text(resolved.cohort)
        .text(resolved.cell.cell.id)
        .text(householdId)
        .text(primaryPlaceId)
        .text(appearance.stature)
        .text(appearance.hair)
        .text(appearance.wardrobe)
        .bytes(),
    )
      .toString(16)
      .padStart(16, "0");
    return Object.freeze({
      personId,
      name: `${firstName} ${familyName}`,
      ageYears,
      cohort: resolved.cohort,
      cellId: resolved.cell.cell.id,
      regionId: resolved.cell.cell.regionId,
      home: resolved.cell.cell.displayName,
      household: Object.freeze({
        id: householdId,
        role,
        memberCount: householdMemberCount,
      }),
      primaryPlace: Object.freeze({
        id: primaryPlaceId,
        kind,
        name: placeName,
        capacity,
        memberCount,
      }),
      appearance,
      semanticHash,
    });
  }

  householdMembers(householdId: string): readonly string[] {
    const { cell, group } = this.#decodeTuple(householdId, "household");
    const start = group * 4n;
    if (start >= cell.cell.population)
      throw new RangeError("Invalid household ID");
    const count =
      cell.cell.population - start < 4n ? cell.cell.population - start : 4n;
    return Object.freeze(
      Array.from({ length: Number(count) }, (_value, index) =>
        this.#personIdFromGlobal(cell.prefix + start + BigInt(index)),
      ),
    );
  }

  placeMembers(placeId: string): readonly string[] {
    const match = /^place_(sch|wrk|svc)_/.exec(placeId);
    const kind: PlaceKind =
      match?.[1] === "sch"
        ? "school"
        : match?.[1] === "wrk"
          ? "workplace"
          : match?.[1] === "svc"
            ? "service-circle"
            : (() => {
                throw new RangeError("Invalid place ID");
              })();
    const { cell, group } = this.#decodeTuple(placeId, kind);
    const cohort: PersonCohort =
      kind === "school" ? "young" : kind === "workplace" ? "adult" : "older";
    const capacity = placeCapacity(cohort);
    const start = group * BigInt(capacity);
    const quota = cell.quotas[cohort];
    if (start >= quota) throw new RangeError(`Invalid ${kind} ID`);
    const count =
      quota - start < BigInt(capacity) ? quota - start : BigInt(capacity);
    return Object.freeze(
      Array.from({ length: Number(count) }, (_value, index) =>
        this.#personIdForRank(cell, cohort, start + BigInt(index)),
      ),
    );
  }

  relationships(personId: string): readonly Relationship[] {
    const resolved = this.#resolve(personId);
    const card = this.person(personId);
    const relationships: Relationship[] = [];
    for (const member of this.householdMembers(card.household.id))
      if (member !== personId)
        relationships.push({ personId: member, kind: "household" });
    const capacity = placeCapacity(resolved.cohort);
    const groupStart =
      (resolved.cohortRank / BigInt(capacity)) * BigInt(capacity);
    const quota = resolved.cell.quotas[resolved.cohort];
    const size =
      quota - groupStart < BigInt(capacity)
        ? quota - groupStart
        : BigInt(capacity);
    if (size > 1n) {
      const offset = resolved.cohortRank - groupStart;
      const neighborRanks = [(offset - 1n + size) % size, (offset + 1n) % size];
      const kind: RelationshipKind =
        resolved.cohort === "young"
          ? "classmate"
          : resolved.cohort === "adult"
            ? "coworker"
            : "recurring-group";
      for (const neighbor of neighborRanks)
        relationships.push({
          personId: this.#personIdForRank(
            resolved.cell,
            resolved.cohort,
            groupStart + neighbor,
          ),
          kind,
        });
    }
    const contactOrdinal =
      resolved.globalOrdinal % 2n === 0n
        ? resolved.globalOrdinal + 1n
        : resolved.globalOrdinal - 1n;
    relationships.push({
      personId: this.#personIdFromGlobal(contactOrdinal),
      kind: "recurring-contact",
    });
    const unique = new Map<string, Relationship>();
    for (const relationship of relationships)
      unique.set(
        `${relationship.kind}/${relationship.personId}`,
        Object.freeze(relationship),
      );
    return Object.freeze(
      Array.from(unique.values()).sort(
        (left, right) =>
          compareText(left.kind, right.kind) ||
          compareText(left.personId, right.personId),
      ),
    );
  }

  diagnostics(): Readonly<{
    retainedCells: number;
    representedPeople: bigint;
    retainedPersonRows: 0;
  }> {
    return Object.freeze({
      retainedCells: this.#cells.length,
      representedPeople: this.#world.totalPopulation,
      retainedPersonRows: 0,
    });
  }
}

export function createManifestationIndex(
  world: FictionalWorld,
): ManifestationIndex {
  return new ManifestationIndex(world);
}
