import { CanonicalWriter, fnv1a64 } from "./deterministic.js";
import {
  createFieldState,
  fieldStateHash,
  stepFieldState,
  type FieldCellState,
  type FieldState,
  type FluxRecord,
  type SparseInfluence,
} from "./fields.js";
import { buildTransportGraph, createSignatureCommandLog } from "./transport.js";
import {
  BASELINE_WORLD_SEED,
  generateWorld,
  type FictionalWorld,
} from "./world.js";

export const WORLD_FORMAT_VERSION = 1;
export const EVENT_FORMAT_VERSION = 1;
export const LOCAL_CHECKPOINT_VERSION = 1;
const CHECKPOINT_SCHEMA = "ten-billion-lives/local-checkpoint";

export interface KernelEvent {
  readonly version: typeof EVENT_FORMAT_VERSION;
  readonly id: string;
  readonly tick: number;
  readonly type: "route-close" | "route-open";
  readonly targetId: string;
}

export interface WorldKernel {
  readonly schemaVersion: 1;
  readonly world: FictionalWorld;
  readonly field: FieldState;
  readonly events: readonly KernelEvent[];
  readonly eventHash: string;
  readonly kernelHash: string;
}

type JsonRecord = Record<string, unknown>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertRecord(value: unknown, name: string): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new RangeError(`${name} must be an object`);
  return value as JsonRecord;
}

function stringValue(value: unknown, name: string): string {
  if (typeof value !== "string")
    throw new RangeError(`${name} must be a string`);
  return value;
}

function integerValue(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value))
    throw new RangeError(`${name} must be a safe integer`);
  return value as number;
}

function bigintValue(value: unknown, name: string): bigint {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value))
    throw new RangeError(`${name} must be a nonnegative decimal integer`);
  return BigInt(value);
}

function arrayValue(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new RangeError(`${name} must be an array`);
  return value;
}

function validateEvents(
  events: readonly KernelEvent[],
): readonly KernelEvent[] {
  const ids = new Set<string>();
  let previous: KernelEvent | undefined;
  for (const event of events) {
    if (event.version !== EVENT_FORMAT_VERSION)
      throw new RangeError(`Unsupported event version ${event.version}`);
    if (event.id.length === 0 || ids.has(event.id))
      throw new RangeError("event ids must be nonempty and unique");
    if (!Number.isSafeInteger(event.tick) || event.tick < 0)
      throw new RangeError("event tick must be a nonnegative safe integer");
    if (event.targetId.length === 0)
      throw new RangeError("event target must not be empty");
    if (
      previous !== undefined &&
      (event.tick < previous.tick ||
        (event.tick === previous.tick &&
          compareText(event.id, previous.id) < 0))
    )
      throw new RangeError("Checkpoint events must be ordered by tick and id");
    ids.add(event.id);
    previous = event;
  }
  return Object.freeze(events.map((event) => Object.freeze({ ...event })));
}

export function hashKernelEvents(events: readonly KernelEvent[]): string {
  const validated = validateEvents(events);
  const writer = new CanonicalWriter(
    "world-kernel-events",
    EVENT_FORMAT_VERSION,
  );
  for (const event of validated)
    writer
      .u32(event.version)
      .text(event.id)
      .u32(event.tick)
      .text(event.type)
      .text(event.targetId);
  return fnv1a64(writer.bytes()).toString(16).padStart(16, "0");
}

function hashKernel(
  worldHash: string,
  fieldHash: string,
  eventHash: string,
): string {
  return fnv1a64(
    new CanonicalWriter("world-kernel", 1)
      .u32(WORLD_FORMAT_VERSION)
      .u32(EVENT_FORMAT_VERSION)
      .text(worldHash)
      .text(fieldHash)
      .text(eventHash)
      .bytes(),
  )
    .toString(16)
    .padStart(16, "0");
}

function freezeKernel(
  world: FictionalWorld,
  field: FieldState,
  events: readonly KernelEvent[],
): WorldKernel {
  const validatedEvents = validateEvents(events);
  const eventHash = hashKernelEvents(validatedEvents);
  return Object.freeze({
    schemaVersion: 1,
    world,
    field,
    events: validatedEvents,
    eventHash,
    kernelHash: hashKernel(world.worldHash, field.stateHash, eventHash),
  });
}

function baselineEvents(world: FictionalWorld): readonly KernelEvent[] {
  const graph = buildTransportGraph(world);
  return createSignatureCommandLog(graph).map((command) =>
    Object.freeze({
      version: EVENT_FORMAT_VERSION,
      id: command.id,
      tick: command.tick,
      type:
        command.type === "close"
          ? ("route-close" as const)
          : ("route-open" as const),
      targetId: command.edgeId,
    }),
  );
}

export function createWorldKernel(
  seed: string = BASELINE_WORLD_SEED,
  events?: readonly KernelEvent[],
): WorldKernel {
  const world = generateWorld(seed);
  return freezeKernel(
    world,
    createFieldState(world),
    events ?? baselineEvents(world),
  );
}

export function advanceWorldKernel(
  kernel: WorldKernel,
  steps: number,
): WorldKernel {
  return freezeKernel(
    kernel.world,
    stepFieldState(kernel.field, steps),
    kernel.events,
  );
}

export function replayKernelHashes(
  kernel: WorldKernel,
  steps: number,
): readonly string[] {
  if (!Number.isSafeInteger(steps) || steps < 0)
    throw new RangeError("replay steps must be a nonnegative safe integer");
  const hashes: string[] = [];
  let current = kernel;
  for (let step = 0; step < steps; step += 1) {
    current = advanceWorldKernel(current, 1);
    hashes.push(current.kernelHash);
  }
  return Object.freeze(hashes);
}

function serializeInfluence(influence: SparseInfluence): readonly unknown[] {
  return [
    influence.id,
    influence.cellId,
    influence.communityBoostPermille,
    influence.startTick.toString(),
    influence.endTick.toString(),
  ];
}

function serializeFlux(flux: FluxRecord): readonly unknown[] {
  return [
    flux.sourceCellId,
    flux.destinationCellId,
    flux.count.toString(),
    flux.remainderRule,
    flux.processingOrder,
  ];
}

export function serializeWorldKernel(kernel: WorldKernel): Uint8Array {
  const value = {
    schema: CHECKPOINT_SCHEMA,
    checkpointVersion: LOCAL_CHECKPOINT_VERSION,
    worldFormatVersion: WORLD_FORMAT_VERSION,
    eventFormatVersion: EVENT_FORMAT_VERSION,
    worldSeed: kernel.world.seed,
    worldHash: kernel.world.worldHash,
    fieldTick: kernel.field.tick.toString(),
    fieldStateHash: kernel.field.stateHash,
    fieldRows: kernel.field.cells.map((cell) => [
      cell.cellId,
      cell.activities.sleep.toString(),
      cell.activities.home.toString(),
      cell.activities.work.toString(),
      cell.activities.transit.toString(),
      cell.activities.community.toString(),
      cell.flowDemand.toString(),
    ]),
    influences: kernel.field.influences.map(serializeInfluence),
    activeCellIds: kernel.field.activeCellIds,
    lastFluxes: kernel.field.lastFluxes.map(serializeFlux),
    events: kernel.events.map((event) => [
      event.version,
      event.id,
      event.tick,
      event.type,
      event.targetId,
    ]),
    eventHash: kernel.eventHash,
    kernelHash: kernel.kernelHash,
  };
  return new TextEncoder().encode(JSON.stringify(value));
}

function parseInfluences(value: unknown): readonly SparseInfluence[] {
  return Object.freeze(
    arrayValue(value, "influences").map((item, index) => {
      const row = arrayValue(item, `influences[${index}]`);
      if (row.length !== 5)
        throw new RangeError(`influences[${index}] has invalid width`);
      return Object.freeze({
        id: stringValue(row[0], `influences[${index}].id`),
        cellId: stringValue(row[1], `influences[${index}].cellId`),
        communityBoostPermille: integerValue(
          row[2],
          `influences[${index}].boost`,
        ),
        startTick: bigintValue(row[3], `influences[${index}].startTick`),
        endTick: bigintValue(row[4], `influences[${index}].endTick`),
      });
    }),
  );
}

function parseEvents(value: unknown): readonly KernelEvent[] {
  const events = arrayValue(value, "events").map((item, index) => {
    const row = arrayValue(item, `events[${index}]`);
    if (row.length !== 5)
      throw new RangeError(`events[${index}] has invalid width`);
    const type = stringValue(row[3], `events[${index}].type`);
    if (type !== "route-close" && type !== "route-open")
      throw new RangeError(`events[${index}] has unsupported type ${type}`);
    return Object.freeze({
      version: integerValue(row[0], `events[${index}].version`) as 1,
      id: stringValue(row[1], `events[${index}].id`),
      tick: integerValue(row[2], `events[${index}].tick`),
      type,
      targetId: stringValue(row[4], `events[${index}].targetId`),
    });
  });
  return validateEvents(events);
}

function parseFluxes(value: unknown): readonly FluxRecord[] {
  return Object.freeze(
    arrayValue(value, "lastFluxes").map((item, index) => {
      const row = arrayValue(item, `lastFluxes[${index}]`);
      if (row.length !== 5)
        throw new RangeError(`lastFluxes[${index}] has invalid width`);
      if (row[3] !== "floor-quarter-transit")
        throw new RangeError(
          `lastFluxes[${index}] has unsupported remainder rule`,
        );
      return Object.freeze({
        sourceCellId: stringValue(row[0], `lastFluxes[${index}].source`),
        destinationCellId: stringValue(
          row[1],
          `lastFluxes[${index}].destination`,
        ),
        count: bigintValue(row[2], `lastFluxes[${index}].count`),
        remainderRule: "floor-quarter-transit" as const,
        processingOrder: integerValue(row[4], `lastFluxes[${index}].order`),
      });
    }),
  );
}

export function restoreWorldKernel(bytes: Uint8Array): WorldKernel {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "unreadable input";
    throw new RangeError(`Invalid checkpoint JSON: ${reason}`, {
      cause: error,
    });
  }
  const value = assertRecord(parsed, "checkpoint");
  if (value["schema"] !== CHECKPOINT_SCHEMA)
    throw new RangeError(
      `Unsupported checkpoint schema ${String(value["schema"])}`,
    );
  const checkpointVersion = integerValue(
    value["checkpointVersion"],
    "checkpointVersion",
  );
  if (checkpointVersion !== LOCAL_CHECKPOINT_VERSION)
    throw new RangeError(`Unsupported checkpoint version ${checkpointVersion}`);
  const worldVersion = integerValue(
    value["worldFormatVersion"],
    "worldFormatVersion",
  );
  if (worldVersion !== WORLD_FORMAT_VERSION)
    throw new RangeError(`Unsupported world format version ${worldVersion}`);
  const eventVersion = integerValue(
    value["eventFormatVersion"],
    "eventFormatVersion",
  );
  if (eventVersion !== EVENT_FORMAT_VERSION)
    throw new RangeError(`Unsupported event format version ${eventVersion}`);

  const world = generateWorld(stringValue(value["worldSeed"], "worldSeed"));
  const storedWorldHash = stringValue(value["worldHash"], "worldHash");
  if (storedWorldHash !== world.worldHash)
    throw new RangeError(
      `Checkpoint world hash mismatch: expected ${world.worldHash}, received ${storedWorldHash}`,
    );
  const influences = parseInfluences(value["influences"]);
  const base = createFieldState(world, influences);
  const rows = arrayValue(value["fieldRows"], "fieldRows");
  if (rows.length !== base.cells.length)
    throw new RangeError(
      `Checkpoint field row count mismatch: expected ${base.cells.length}`,
    );
  const cells: FieldCellState[] = rows.map((item, index) => {
    const row = arrayValue(item, `fieldRows[${index}]`);
    if (row.length !== 7)
      throw new RangeError(`fieldRows[${index}] has invalid width`);
    const staticCell = base.cells[index];
    if (staticCell === undefined)
      throw new RangeError(`fieldRows[${index}] has no static cell`);
    const cellId = stringValue(row[0], `fieldRows[${index}].cellId`);
    if (cellId !== staticCell.cellId)
      throw new RangeError(
        `Checkpoint field order mismatch at ${index}: expected ${staticCell.cellId}, received ${cellId}`,
      );
    return Object.freeze({
      ...staticCell,
      activities: Object.freeze({
        sleep: bigintValue(row[1], `fieldRows[${index}].sleep`),
        home: bigintValue(row[2], `fieldRows[${index}].home`),
        work: bigintValue(row[3], `fieldRows[${index}].work`),
        transit: bigintValue(row[4], `fieldRows[${index}].transit`),
        community: bigintValue(row[5], `fieldRows[${index}].community`),
      }),
      flowDemand: bigintValue(row[6], `fieldRows[${index}].flowDemand`),
    });
  });
  const activeCellIds = Object.freeze(
    arrayValue(value["activeCellIds"], "activeCellIds").map((item, index) =>
      stringValue(item, `activeCellIds[${index}]`),
    ),
  );
  const fieldWithoutHash = {
    schemaVersion: 1 as const,
    seed: base.seed,
    tick: bigintValue(value["fieldTick"], "fieldTick"),
    totalPopulation: base.totalPopulation,
    cells: Object.freeze(cells),
    influences,
    activeCellIds,
    lastFluxes: parseFluxes(value["lastFluxes"]),
  };
  const computedFieldHash = fieldStateHash(fieldWithoutHash);
  const storedFieldHash = stringValue(
    value["fieldStateHash"],
    "fieldStateHash",
  );
  if (computedFieldHash !== storedFieldHash)
    throw new RangeError(
      `Checkpoint field hash mismatch: expected ${computedFieldHash}, received ${storedFieldHash}`,
    );
  const field = Object.freeze({
    ...fieldWithoutHash,
    stateHash: computedFieldHash,
  });
  const events = parseEvents(value["events"]);
  const computedEventHash = hashKernelEvents(events);
  const storedEventHash = stringValue(value["eventHash"], "eventHash");
  if (computedEventHash !== storedEventHash)
    throw new RangeError(
      `Checkpoint event hash mismatch: expected ${computedEventHash}, received ${storedEventHash}`,
    );
  const kernel = freezeKernel(world, field, events);
  const storedKernelHash = stringValue(value["kernelHash"], "kernelHash");
  if (kernel.kernelHash !== storedKernelHash)
    throw new RangeError(
      `Checkpoint kernel hash mismatch: expected ${kernel.kernelHash}, received ${storedKernelHash}`,
    );
  return kernel;
}
