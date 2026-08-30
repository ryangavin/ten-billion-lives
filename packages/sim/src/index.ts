export const SIM_PACKAGE = "sim" as const;
export const FIXED_TICK_MINUTES = 1 as const;

export {
  BASELINE_POPULATION,
  PLACEHOLDER_SEED,
  createPlaceholderSnapshot,
  replayPlaceholder,
} from "./snapshot";
export type { LocalSnapshot, PopulationCell } from "./snapshot";
