import { MANIFEST_PACKAGE } from "@ten-billion-lives/manifest";
import { RENDER_PACKAGE } from "@ten-billion-lives/render";
import { FIXED_TICK_MINUTES, SIM_PACKAGE } from "@ten-billion-lives/sim";

export const LOCAL_SMOKE_SEED = "ten-billion-lives/local-smoke/v1" as const;

export interface SmokeModel {
  readonly status: "Local foundation ready";
  readonly seed: typeof LOCAL_SMOKE_SEED;
  readonly tick: 0;
  readonly tickMinutes: typeof FIXED_TICK_MINUTES;
  readonly representedPopulation: 10_000_000_000n;
  readonly packages: readonly ["sim", "manifest", "render", "testkit"];
}

export function createSmokeModel(): SmokeModel {
  const packages = Object.freeze([
    SIM_PACKAGE,
    MANIFEST_PACKAGE,
    RENDER_PACKAGE,
    "testkit",
  ] as const);

  return Object.freeze({
    status: "Local foundation ready",
    seed: LOCAL_SMOKE_SEED,
    tick: 0,
    tickMinutes: FIXED_TICK_MINUTES,
    representedPopulation: 10_000_000_000n,
    packages,
  });
}
