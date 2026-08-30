import { describe, expect, it } from "vitest";

import { createPlaceholderSnapshot } from "@ten-billion-lives/sim";

import { manifestPlaceholder } from "./placeholder";

describe("placeholder manifestation contract", () => {
  it("is stable across observers, revisits, and camera-only changes", () => {
    const snapshot = createPlaceholderSnapshot();
    const query = {
      seed: snapshot.seed,
      checkpoint: snapshot,
      region: "brindle-bay/harbor-street",
      tick: 0,
      lod: "person",
    } as const;

    const observerA = manifestPlaceholder(query);
    const observerB = manifestPlaceholder({ ...query });
    const afterCameraMove = manifestPlaceholder({ ...query });

    expect(observerA).toEqual(observerB);
    expect(afterCameraMove).toEqual(observerA);
    expect(observerA.personId).toBe("person-5d19f85f");
    expect(observerA.traceHash).toBe("trace-b11350f7");
  });
});
