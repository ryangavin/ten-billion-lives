export const RENDER_PACKAGE = "render" as const;

export type RenderCapability = "webgpu" | "fallback";

export { createTracerProjection } from "./tracer";
export type { TracerProjection, TracerProjectionInput } from "./tracer";
