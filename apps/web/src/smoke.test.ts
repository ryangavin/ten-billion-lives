import { describe, expect, it } from "vitest";

import { createSmokeFixture } from "@ten-billion-lives/testkit";

import { createSmokeModel } from "./smoke";

describe("local smoke model", () => {
  it("is seeded and independent of the ambient clock", () => {
    const first = createSmokeModel();
    const second = createSmokeModel();
    const fixture = createSmokeFixture();

    expect(first).toEqual(second);
    expect(first.seed).toBe(fixture.seed);
    expect(first.tick).toBe(fixture.tick);
    expect(first).toMatchObject({
      seed: "ten-billion-lives/local-smoke/v1",
      tick: 0,
      representedPopulation: 10_000_000_000n,
      status: "Local foundation ready",
    });
  });

  it("reports every scaffold package", () => {
    expect(createSmokeModel().packages).toEqual([
      "sim",
      "manifest",
      "render",
      "testkit",
    ]);
  });
});
