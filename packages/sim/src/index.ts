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
