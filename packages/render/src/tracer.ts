export interface TracerProjectionInput {
  readonly stage: "planet" | "settlement" | "street" | "person";
  readonly stateHash: string;
  readonly traceHash?: string;
}

export interface TracerProjection {
  readonly cssStage: string;
  readonly semanticKey: string;
}

export function createTracerProjection(
  input: TracerProjectionInput,
): TracerProjection {
  return Object.freeze({
    cssStage: `stage-${input.stage}`,
    semanticKey: `${input.stateHash}/${input.traceHash ?? "aggregate"}`,
  });
}
