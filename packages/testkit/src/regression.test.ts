import { describe, expect, it } from "vitest";

import { evaluateBudgets } from "./regression";

describe("benchmark regression guard", () => {
  const budgets = {
    simulationCellsPerSecond: { direction: "min", catastrophic: 100 },
    browserMemoryMiB: { direction: "max", catastrophic: 256 },
  } as const;

  it("accepts metrics inside coarse catastrophic limits", () => {
    expect(
      evaluateBudgets(
        { simulationCellsPerSecond: 120, browserMemoryMiB: 128 },
        budgets,
      ),
    ).toEqual([]);
  });

  it("reports every deliberately degraded metric", () => {
    expect(
      evaluateBudgets(
        { simulationCellsPerSecond: 1, browserMemoryMiB: 512 },
        budgets,
      ),
    ).toEqual([
      "simulationCellsPerSecond: 1 is below catastrophic minimum 100",
      "browserMemoryMiB: 512 exceeds catastrophic maximum 256",
    ]);
  });
});
