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
