import { describe, expect, it } from "vitest";

import {
  PLANETARY_DAY_TICKS,
  buildTransportGraph,
  createSignatureCommandLog,
  explainFlow,
  simulatePlanetaryDay,
} from "./transport";
import { BASELINE_WORLD_SEED, generateWorld } from "./world";

describe("deterministic planetary transport day", () => {
  const world = generateWorld(BASELINE_WORLD_SEED);
  const graph = buildTransportGraph(world);

  it("builds a stable neighborhood-to-settlement-to-region hierarchy", () => {
    expect(new Set(graph.edges.map((edge) => edge.mode))).toEqual(
      new Set(["walking", "local", "intercity"]),
    );
    expect(graph.nodes.some((node) => node.kind === "neighborhood")).toBe(true);
    expect(graph.nodes.some((node) => node.kind === "settlement")).toBe(true);
    expect(graph.nodes.some((node) => node.kind === "region")).toBe(true);
    expect(graph.edges.every((edge) => edge.capacity > 0n)).toBe(true);
    expect(buildTransportGraph(world)).toEqual(graph);
  });

  it("reconciles six cohort activity classes with ten billion at every tick", () => {
    const day = simulatePlanetaryDay(world, []);
    expect(day.ticks).toHaveLength(PLANETARY_DAY_TICKS);
    for (const tick of day.ticks) {
      expect(
        Object.values(tick.activityTotals).reduce(
          (sum, count) => sum + count,
          0n,
        ),
      ).toBe(10_000_000_000n);
      expect(
        Object.values(tick.cohortActivities).every(
          (activities) =>
            Object.values(activities).reduce((sum, count) => sum + count, 0n) >
            0n,
        ),
      ).toBe(true);
      expect(tick.invariantIssues).toEqual([]);
    }
  });

  it("respects capacity and reproduces edge-flow hashes for the same command log", () => {
    const commands = createSignatureCommandLog(graph);
    const first = simulatePlanetaryDay(world, commands);
    const second = simulatePlanetaryDay(world, commands);
    expect(first.graph.graphHash).toBe("784fcc1635c75fc3");
    expect(first.dayHash).toBe("c09cdd840c68bab2");
    expect(first.dayHash).toBe(second.dayHash);
    expect(first.ticks.map((tick) => tick.edgeFlowHash)).toEqual(
      second.ticks.map((tick) => tick.edgeFlowHash),
    );
    expect(
      first.ticks.every((tick) =>
        tick.edgeFlows.every(
          (flow) =>
            flow.count >= 0n &&
            flow.count <= flow.capacity &&
            (!flow.closed || flow.count === 0n),
        ),
      ),
    ).toBe(true);
  });

  it("converges festival attendance from surrounding regions and disperses it", () => {
    const day = simulatePlanetaryDay(world, []);
    const attendance = day.ticks.map((tick) => tick.festivalAttendance);
    expect(attendance[16]).toBe(0n);
    expect(attendance[17]).toBeGreaterThan(0n);
    expect(attendance[18]).toBeGreaterThan(attendance[17] ?? 0n);
    expect(attendance[19]).toBeGreaterThan(attendance[18] ?? 0n);
    expect(attendance[20]).toBeLessThan(attendance[19] ?? 0n);
    expect(attendance[21]).toBeLessThan(attendance[20] ?? 0n);
    expect(attendance[22]).toBe(0n);
    expect(
      day.ticks[19]?.festivalOrigins.reduce(
        (sum, origin) => sum + origin.attendance,
        0n,
      ),
    ).toBe(attendance[19]);
    expect(
      day.ticks[19]?.edgeFlows.some(
        (flow) => flow.reason === "festival convergence",
      ),
    ).toBe(true);
    expect(
      day.ticks[20]?.edgeFlows.some(
        (flow) => flow.reason === "festival dispersal",
      ),
    ).toBe(true);
  });

  it("closes and reopens the signature route at defined ticks with rerouting", () => {
    const commands = createSignatureCommandLog(graph);
    const edgeId = commands[0]?.edgeId ?? "";
    const baseline = simulatePlanetaryDay(world, []);
    const intervened = simulatePlanetaryDay(world, commands);
    const flowAt = (day: typeof baseline, tick: number) =>
      day.ticks[tick]?.edgeFlows.find((flow) => flow.edgeId === edgeId);

    expect(flowAt(baseline, 7)?.count).toBeGreaterThan(0n);
    expect(flowAt(intervened, 7)).toMatchObject({ closed: true, count: 0n });
    expect(flowAt(intervened, 8)).toMatchObject({ closed: true, count: 0n });
    expect(flowAt(intervened, 9)?.closed).toBe(false);
    expect(flowAt(intervened, 9)?.count).toBe(flowAt(baseline, 9)?.count);
    expect(
      intervened.ticks.every((tick) => tick.invariantIssues.length === 0),
    ).toBe(true);
  });

  it("explains why a routed flow exists and whether it bottlenecks", () => {
    const day = simulatePlanetaryDay(world, createSignatureCommandLog(graph));
    const flow = day.ticks[8]?.edgeFlows.find(
      (candidate) => candidate.count > 0n,
    );
    expect(flow).toBeDefined();
    const explanation = explainFlow(day, 8, flow?.edgeId ?? "");
    expect(explanation).toContain(flow?.mode ?? "");
    expect(explanation).toContain("capacity");
    expect(explanation).toContain("source demand");
  });
});
