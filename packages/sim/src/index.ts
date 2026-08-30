export const SIM_PACKAGE = "sim" as const;
export const FIXED_TICK_MINUTES = 1 as const;

export {
  BASELINE_POPULATION,
  PLACEHOLDER_SEED,
  createPlaceholderSnapshot,
  replayPlaceholder,
} from "./snapshot";
export type { LocalSnapshot, PopulationCell } from "./snapshot";
export {
  CanonicalWriter,
  DeterministicClock,
  FIXED_SCALE,
  deterministicVectorHash,
  fixedMul,
  fnv1a64,
  largestRemainder,
  joinU64,
  randomU32,
  saturatingI32Add,
  stablePermutation,
  splitU64,
  tickToMinuteOfDay,
  u32Add,
  u32Mul,
} from "./deterministic";
export type { U64Words } from "./deterministic";
export {
  BASELINE_WORLD_SEED,
  WORLD_LEVEL,
  WORLD_POPULATION,
  childrenOf,
  generateWorld,
  getCell,
  neighborsOf,
  parentOf,
  populationAt,
} from "./world";
export type {
  Biome,
  CellBounds,
  FictionalWorld,
  Region,
  Settlement,
  WorldCell,
} from "./world";
export {
  FIELD_TICKS_PER_DAY,
  FieldSimulationRunner,
  createFieldState,
  createSmallFieldState,
  fieldStateHash,
  fieldPopulationAt,
  invariantReport,
  stepFieldState,
} from "./fields";
export {
  PLANETARY_DAY_TICKS,
  buildTransportGraph,
  createSignatureCommandLog,
  explainFlow,
  simulatePlanetaryDay,
} from "./transport";
export {
  EVENT_FORMAT_VERSION,
  LOCAL_CHECKPOINT_VERSION,
  WORLD_FORMAT_VERSION,
  advanceWorldKernel,
  createWorldKernel,
  hashKernelEvents,
  replayKernelHashes,
  restoreWorldKernel,
  serializeWorldKernel,
} from "./checkpoint";
export type { KernelEvent, WorldKernel } from "./checkpoint";
export type {
  ActivityCounts,
  DailyActivity,
  EdgeFlow,
  FestivalOrigin,
  PlanetaryDay,
  PlanetaryDayTick,
  SignatureFestival,
  TransportCommand,
  TransportEdge,
  TransportGraph,
  TransportMode,
  TransportNode,
  TransportNodeKind,
} from "./transport";
export type {
  ActivityField,
  CohortField,
  FieldCellState,
  FieldState,
  FluxRecord,
  InvariantReport,
  SparseInfluence,
} from "./fields";
