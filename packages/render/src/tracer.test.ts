import { describe, expect, it } from "vitest";

import { createTracerProjection } from "./tracer";

describe("tracer render projection", () => {
  it("depends on semantic inputs and excludes camera state", () => {
    const input = {
      stage: "person",
      stateHash: "state-42f76c85",
      traceHash: "trace-b11350f7",
    } as const;
    expect(createTracerProjection(input)).toEqual(
      createTracerProjection({ ...input }),
    );
  });
});
