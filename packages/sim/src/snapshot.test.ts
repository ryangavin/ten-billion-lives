import { describe, expect, it } from "vitest";

import { createPlaceholderSnapshot, replayPlaceholder } from "./snapshot";

describe("placeholder snapshot contract", () => {
  it("replays to the same immutable semantic hash", () => {
    const snapshot = createPlaceholderSnapshot();
    const first = replayPlaceholder(snapshot, 0);
    const second = replayPlaceholder(snapshot, 0);

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(first).toEqual(second);
    expect(first.stateHash).toBe("state-42f76c85");
    expect(first.representedPopulation).toBe(10_000_000_000n);
  });
});
