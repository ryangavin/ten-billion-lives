import { describe, expect, it } from "vitest";

import {
  BASELINE_WORLD_SEED,
  childrenOf,
  generateWorld,
  getCell,
  neighborsOf,
  parentOf,
  populationAt,
} from "./world";

describe("seeded fictional world", () => {
  it("reproduces byte-identical metadata and exactly ten billion people", () => {
    const first = generateWorld(BASELINE_WORLD_SEED);
    const second = generateWorld(BASELINE_WORLD_SEED);
    expect(first).toEqual(second);
    expect(first.worldHash).toBe(second.worldHash);
    expect(first.totalPopulation).toBe(10_000_000_000n);
    expect(first.cells.reduce((sum, cell) => sum + cell.population, 0n)).toBe(
      10_000_000_000n,
    );
    expect(
      first.cells.every(
        (cell) =>
          cell.population >= 0n && cell.population <= 0xffff_ffff_ffff_ffffn,
      ),
    ).toBe(true);
  });

  it("covers seam wrapping and reflected pole traversal", () => {
    const world = generateWorld(BASELINE_WORLD_SEED);
    const seam = getCell(world, "L5/12/0");
    const seamNeighbors = neighborsOf(world, seam.id);
    expect(seamNeighbors.west).toBe("L5/12/63");
    expect(neighborsOf(world, "L5/12/63").east).toBe("L5/12/0");
    expect(neighborsOf(world, "L5/0/3").north).toBe("L5/0/35");
    expect(neighborsOf(world, "L5/31/3").south).toBe("L5/31/35");
  });

  it("conserves parent/child population at every LOD", () => {
    const world = generateWorld(BASELINE_WORLD_SEED);
    for (const id of ["L0/0/0", "L1/1/2", "L3/4/7", "L4/10/14"]) {
      const children = childrenOf(id);
      expect(
        children.reduce((sum, child) => sum + populationAt(world, child), 0n),
      ).toBe(populationAt(world, id));
      for (const child of children) expect(parentOf(child)).toBe(id);
    }
  });

  it("places named settlements only on land without grid-line collapse", () => {
    const world = generateWorld(BASELINE_WORLD_SEED);
    expect(world.settlements.length).toBeGreaterThanOrEqual(48);
    expect(
      world.settlements.every(
        (settlement) => getCell(world, settlement.cellId).land,
      ),
    ).toBe(true);
    expect(
      new Set(world.settlements.map((settlement) => settlement.cellId)).size,
    ).toBe(world.settlements.length);
    expect(
      new Set(world.settlements.map((settlement) => settlement.name)).size,
    ).toBe(world.settlements.length);
    expect(
      new Set(world.settlements.map((settlement) => settlement.row)).size,
    ).toBeGreaterThan(10);
    expect(
      new Set(world.settlements.map((settlement) => settlement.column)).size,
    ).toBeGreaterThan(20);
    expect(
      world.cells
        .filter((cell) => !cell.land)
        .every((cell) => cell.population === 0n),
    ).toBe(true);
  });

  it("exposes stable integer bounds and hierarchy metadata", () => {
    const world = generateWorld(BASELINE_WORLD_SEED);
    const cell = getCell(world, "L5/16/32");
    expect(cell.bounds).toEqual({
      northMicrodegrees: 0,
      southMicrodegrees: -5_625_000,
      westMicrodegrees: 0,
      eastMicrodegrees: 5_625_000,
    });
    expect(cell.regionId).toMatch(/^region-/);
    expect(cell.biome).toMatch(
      /^(ocean|tundra|boreal|grassland|woodland|desert|rainforest)$/,
    );
  });
});
