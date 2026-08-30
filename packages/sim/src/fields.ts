import {
  CanonicalWriter,
  fnv1a64,
  largestRemainder,
  randomU32,
} from "./deterministic.js";
import { WORLD_LEVEL, neighborsOf, type FictionalWorld } from "./world.js";

export const FIELD_TICKS_PER_DAY = 24;
const U64_MAX = 0xffff_ffff_ffff_ffffn;

export interface CohortField {
  readonly young: bigint;
  readonly adult: bigint;
  readonly older: bigint;
}

export interface ActivityField {
  readonly sleep: bigint;
  readonly home: bigint;
  readonly work: bigint;
  readonly transit: bigint;
  readonly community: bigint;
}

export interface SparseInfluence {
  readonly id: string;
  readonly cellId: string;
  readonly communityBoostPermille: number;
  readonly startTick: bigint;
  readonly endTick: bigint;
}

export interface FluxRecord {
  readonly sourceCellId: string;
  readonly destinationCellId: string;
  readonly count: bigint;
  readonly remainderRule: "floor-quarter-transit";
  readonly processingOrder: number;
}

export interface FieldCellState {
  readonly cellId: string;
  readonly residents: bigint;
  readonly cohorts: CohortField;
  readonly activities: ActivityField;
  readonly capacityPermille: number;
  readonly amenityPermille: number;
  readonly flowDemand: bigint;
  readonly destinations: readonly string[];
}

export interface FieldState {
  readonly schemaVersion: 1;
  readonly seed: string;
  readonly tick: bigint;
  readonly totalPopulation: bigint;
  readonly cells: readonly FieldCellState[];
  readonly influences: readonly SparseInfluence[];
  readonly activeCellIds: readonly string[];
  readonly lastFluxes: readonly FluxRecord[];
  readonly stateHash: string;
}

export interface InvariantReport {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly residentPopulation: bigint;
  readonly presentPopulation: bigint;
}

interface CellInput {
  readonly cellId: string;
  readonly residents: bigint;
  readonly capacityPermille: number;
  readonly amenityPermille: number;
  readonly destinations: readonly string[];
}

function assertPermille(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 1_000)
    throw new RangeError(`${name} must be an integer from 0 to 1000`);
}

function sumActivities(activities: ActivityField): bigint {
  return (
    activities.sleep +
    activities.home +
    activities.work +
    activities.transit +
    activities.community
  );
}

function sumCohorts(cohorts: CohortField): bigint {
  return cohorts.young + cohorts.adult + cohorts.older;
}

function freezeActivities(allocation: readonly bigint[]): ActivityField {
  return Object.freeze({
    sleep: allocation[0] ?? 0n,
    home: allocation[1] ?? 0n,
    work: allocation[2] ?? 0n,
    transit: allocation[3] ?? 0n,
    community: allocation[4] ?? 0n,
  });
}

function createCells(inputs: readonly CellInput[]): readonly FieldCellState[] {
  return Object.freeze(
    inputs.map((input) => {
      if (input.residents < 0n || input.residents > U64_MAX)
        throw new RangeError(
          `resident population out of range: ${input.cellId}`,
        );
      assertPermille(input.capacityPermille, "capacityPermille");
      assertPermille(input.amenityPermille, "amenityPermille");
      const [young, adult, older] = largestRemainder(input.residents, [
        220n,
        620n,
        160n,
      ]);
      return Object.freeze({
        cellId: input.cellId,
        residents: input.residents,
        cohorts: Object.freeze({
          young: young ?? 0n,
          adult: adult ?? 0n,
          older: older ?? 0n,
        }),
        activities: freezeActivities([input.residents, 0n, 0n, 0n, 0n]),
        capacityPermille: input.capacityPermille,
        amenityPermille: input.amenityPermille,
        flowDemand: 0n,
        destinations: Object.freeze([...input.destinations]),
      });
    }),
  );
}

function validateInfluences(
  influences: readonly SparseInfluence[],
  cellIds: ReadonlySet<string>,
): readonly SparseInfluence[] {
  const ids = new Set<string>();
  const validated = influences.map((influence) => {
    if (influence.id.length === 0 || ids.has(influence.id))
      throw new RangeError("influence ids must be nonempty and unique");
    if (!cellIds.has(influence.cellId))
      throw new RangeError(`unknown influence cell: ${influence.cellId}`);
    assertPermille(influence.communityBoostPermille, "communityBoostPermille");
    if (influence.startTick < 0n || influence.endTick <= influence.startTick)
      throw new RangeError("invalid influence tick range");
    ids.add(influence.id);
    return Object.freeze({ ...influence });
  });
  return Object.freeze(
    validated.sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    ),
  );
}

export function fieldStateHash(state: Omit<FieldState, "stateHash">): string {
  const writer = new CanonicalWriter("population-activity-fields", 1)
    .text(state.seed)
    .u64(state.tick)
    .u64(state.totalPopulation);
  for (const cell of state.cells)
    writer
      .text(cell.cellId)
      .u64(cell.residents)
      .u64(cell.cohorts.young)
      .u64(cell.cohorts.adult)
      .u64(cell.cohorts.older)
      .u64(cell.activities.sleep)
      .u64(cell.activities.home)
      .u64(cell.activities.work)
      .u64(cell.activities.transit)
      .u64(cell.activities.community)
      .u32(cell.capacityPermille)
      .u32(cell.amenityPermille)
      .u64(cell.flowDemand);
  for (const influence of state.influences)
    writer
      .text(influence.id)
      .text(influence.cellId)
      .u32(influence.communityBoostPermille)
      .u64(influence.startTick)
      .u64(influence.endTick);
  for (const flux of state.lastFluxes)
    writer
      .text(flux.sourceCellId)
      .text(flux.destinationCellId)
      .u64(flux.count)
      .u32(flux.processingOrder);
  return fnv1a64(writer.bytes()).toString(16).padStart(16, "0");
}

function freezeState(state: Omit<FieldState, "stateHash">): FieldState {
  return Object.freeze({ ...state, stateHash: fieldStateHash(state) });
}

function initialState(
  seed: string,
  inputs: readonly CellInput[],
  influences: readonly SparseInfluence[],
): FieldState {
  if (seed.length === 0) throw new RangeError("field seed must not be empty");
  if (inputs.length === 0)
    throw new RangeError("field state needs at least one cell");
  const cells = createCells(inputs);
  const cellIds = new Set(cells.map((cell) => cell.cellId));
  if (cellIds.size !== cells.length)
    throw new RangeError("field cell ids must be unique");
  for (const cell of cells)
    if (cell.destinations.some((destination) => !cellIds.has(destination)))
      throw new RangeError(`unknown flux destination from ${cell.cellId}`);
  const totalPopulation = cells.reduce((sum, cell) => sum + cell.residents, 0n);
  return freezeState({
    schemaVersion: 1,
    seed,
    tick: 0n,
    totalPopulation,
    cells,
    influences: validateInfluences(influences, cellIds),
    activeCellIds: Object.freeze([]),
    lastFluxes: Object.freeze([]),
  });
}

export function createFieldState(
  world: FictionalWorld,
  influences: readonly SparseInfluence[] = [],
): FieldState {
  const seed = `${world.seed}/fields/v1`;
  const numericSeed = fnv1a64(new TextEncoder().encode(seed));
  return initialState(
    seed,
    world.cells.map((cell, index) => {
      const neighbors = neighborsOf(world, cell.id);
      return {
        cellId: cell.id,
        residents: cell.population,
        capacityPermille: cell.land
          ? 300 +
            (randomU32("field/capacity", numericSeed, BigInt(index)) % 701)
          : 0,
        amenityPermille: cell.land
          ? randomU32("field/amenity", numericSeed, BigInt(index)) % 1_001
          : 0,
        destinations: [
          neighbors.north,
          neighbors.east,
          neighbors.south,
          neighbors.west,
        ],
      };
    }),
    influences,
  );
}

export function createSmallFieldState(
  populations: readonly bigint[],
  seed: string,
  influences: readonly SparseInfluence[] = [],
): FieldState {
  return initialState(
    seed,
    populations.map((residents, index) => ({
      cellId: `small/${index}`,
      residents,
      capacityPermille: 1_000,
      amenityPermille: (index * 137) % 1_001,
      destinations: [`small/${(index + 1) % populations.length}`],
    })),
    influences,
  );
}

function activityWeights(
  tick: bigint,
  communityBoost: number,
): readonly bigint[] {
  const hour = Number(tick % BigInt(FIELD_TICKS_PER_DAY));
  const base =
    hour < 6
      ? [650, 150, 0, 100, 100]
      : hour < 10
        ? [50, 250, 350, 250, 100]
        : hour < 17
          ? [20, 130, 600, 100, 150]
          : hour < 22
            ? [40, 260, 180, 170, 350]
            : [550, 250, 0, 50, 150];
  return base.map((weight, index) =>
    BigInt(weight + (index === 4 ? communityBoost : 0)),
  );
}

function stepOnce(state: FieldState, includeHash: boolean): FieldState {
  const numericSeed = fnv1a64(new TextEncoder().encode(state.seed));
  const activeInfluences = state.influences.filter(
    (influence) =>
      state.tick >= influence.startTick && state.tick < influence.endTick,
  );
  const influenceByCell = new Map<string, number>();
  for (const influence of activeInfluences)
    influenceByCell.set(
      influence.cellId,
      (influenceByCell.get(influence.cellId) ?? 0) +
        influence.communityBoostPermille,
    );

  const reacted = state.cells.map((cell) => {
    const present = sumActivities(cell.activities);
    const boost = Math.min(1_000, influenceByCell.get(cell.cellId) ?? 0);
    const activities = freezeActivities(
      largestRemainder(present, activityWeights(state.tick, boost)),
    );
    const flowDemand =
      (activities.transit * BigInt(cell.capacityPermille)) / 4_000n;
    return { cell, activities, flowDemand };
  });
  const fluxes: FluxRecord[] = [];
  for (let index = 0; index < reacted.length; index += 1) {
    const draft = reacted[index];
    if (
      draft === undefined ||
      draft.flowDemand === 0n ||
      draft.cell.destinations.length === 0
    )
      continue;
    const destinationIndex =
      randomU32(
        "field/flux-destination",
        numericSeed,
        state.tick * BigInt(reacted.length) + BigInt(index),
      ) % draft.cell.destinations.length;
    const destinationCellId = draft.cell.destinations[destinationIndex];
    if (
      destinationCellId === undefined ||
      destinationCellId === draft.cell.cellId
    )
      continue;
    fluxes.push(
      Object.freeze({
        sourceCellId: draft.cell.cellId,
        destinationCellId,
        count: draft.flowDemand,
        remainderRule: "floor-quarter-transit" as const,
        processingOrder: fluxes.length,
      }),
    );
  }

  const delta = new Map<string, bigint>();
  for (const flux of fluxes) {
    delta.set(
      flux.sourceCellId,
      (delta.get(flux.sourceCellId) ?? 0n) - flux.count,
    );
    delta.set(
      flux.destinationCellId,
      (delta.get(flux.destinationCellId) ?? 0n) + flux.count,
    );
  }
  const cells = Object.freeze(
    reacted.map(({ cell, activities, flowDemand }) => {
      const transit = activities.transit + (delta.get(cell.cellId) ?? 0n);
      if (transit < 0n)
        throw new Error(`negative transit after flux: ${cell.cellId}`);
      return Object.freeze({
        ...cell,
        activities: Object.freeze({ ...activities, transit }),
        flowDemand,
      });
    }),
  );
  const activeCellIds = Object.freeze(
    Array.from(
      new Set(activeInfluences.map((influence) => influence.cellId)),
    ).sort(),
  );
  const nextFields = {
    schemaVersion: 1,
    seed: state.seed,
    tick: state.tick + 1n,
    totalPopulation: state.totalPopulation,
    cells,
    influences: state.influences,
    activeCellIds,
    lastFluxes: Object.freeze(fluxes),
  } as const;
  const next = includeHash
    ? freezeState(nextFields)
    : Object.freeze({ ...nextFields, stateHash: "" });
  const report = invariantReport(next);
  if (!report.valid)
    throw new Error(`field invariant failed: ${report.issues.join("; ")}`);
  return next;
}

export function stepFieldState(state: FieldState, steps = 1): FieldState {
  if (!Number.isSafeInteger(steps) || steps < 0 || steps > 100_000)
    throw new RangeError("steps must be a safe integer from 0 to 100000");
  let current = state;
  for (let step = 0; step < steps; step += 1)
    current = stepOnce(current, step === steps - 1);
  return current;
}

export function invariantReport(state: FieldState): InvariantReport {
  const issues: string[] = [];
  let residentPopulation = 0n;
  let presentPopulation = 0n;
  for (const cell of state.cells) {
    const cohorts = Object.values(cell.cohorts);
    const activities = Object.values(cell.activities);
    if (cell.residents < 0n || cell.residents > U64_MAX)
      issues.push(`${cell.cellId}: residents out of u64 range`);
    if (
      cohorts.some((count) => count < 0n) ||
      sumCohorts(cell.cohorts) !== cell.residents
    )
      issues.push(`${cell.cellId}: cohort conservation`);
    if (activities.some((count) => count < 0n))
      issues.push(`${cell.cellId}: negative activity`);
    residentPopulation += cell.residents;
    presentPopulation += sumActivities(cell.activities);
  }
  if (residentPopulation !== state.totalPopulation)
    issues.push("resident total conservation");
  if (presentPopulation !== state.totalPopulation)
    issues.push("present total conservation");
  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues),
    residentPopulation,
    presentPopulation,
  });
}

export function fieldPopulationAt(
  world: FictionalWorld,
  state: FieldState,
  id: string,
): bigint {
  const match = /^L(\d+)\/(\d+)\/(\d+)$/.exec(id);
  if (!match) throw new RangeError(`malformed cell id: ${id}`);
  const level = Number(match[1]);
  const row = Number(match[2]);
  const column = Number(match[3]);
  if (!Number.isInteger(level) || level < 0 || level > WORLD_LEVEL)
    throw new RangeError(`cell level out of range: ${id}`);
  const scale = 2 ** (WORLD_LEVEL - level);
  let population = 0n;
  for (let leafRow = row * scale; leafRow < (row + 1) * scale; leafRow += 1)
    for (
      let leafColumn = column * scale;
      leafColumn < (column + 1) * scale;
      leafColumn += 1
    ) {
      const cell = state.cells[leafRow * world.columns + leafColumn];
      if (cell !== undefined) population += sumActivities(cell.activities);
    }
  return population;
}

export class FieldSimulationRunner {
  #state: FieldState;
  #paused = true;
  #rate = 1;

  constructor(initialState: FieldState) {
    this.#state = initialState;
  }

  get state(): FieldState {
    return this.#state;
  }

  pause(): void {
    this.#paused = true;
  }

  play(): void {
    this.#paused = false;
  }

  setRate(rate: number): void {
    if (!Number.isSafeInteger(rate) || rate < 1 || rate > 1_024)
      throw new RangeError("simulation rate must be an integer from 1 to 1024");
    this.#rate = rate;
  }

  singleStep(): FieldState {
    this.#state = stepFieldState(this.#state);
    return this.#state;
  }

  advanceFakeTicks(ticks: number): FieldState {
    if (!Number.isSafeInteger(ticks) || ticks < 0)
      throw new RangeError("fake ticks must be a nonnegative safe integer");
    if (!this.#paused)
      this.#state = stepFieldState(this.#state, ticks * this.#rate);
    return this.#state;
  }
}
