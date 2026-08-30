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
  FIXED_SCALE,
  fixedMul,
  fnv1a64,
  largestRemainder,
  randomU32,
  saturatingI32Add,
  stablePermutation,
  tickToMinuteOfDay,
  u32Add,
  u32Mul,
} from "./deterministic";
