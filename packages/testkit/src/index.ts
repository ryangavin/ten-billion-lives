export const TESTKIT_PACKAGE = "testkit" as const;
export const LOCAL_SMOKE_SEED = "ten-billion-lives/local-smoke/v1" as const;

export interface SmokeFixture {
  readonly seed: typeof LOCAL_SMOKE_SEED;
  readonly tick: 0;
}

export function createSmokeFixture(): SmokeFixture {
  return Object.freeze({
    seed: LOCAL_SMOKE_SEED,
    tick: 0,
  });
}

export { evaluateBudgets } from "./regression";
export type { BudgetLimit, BudgetMap, MetricMap } from "./regression";
