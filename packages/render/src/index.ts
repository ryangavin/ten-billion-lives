export const RENDER_PACKAGE = "render" as const;

export type RenderCapability = "webgpu" | "fallback";

export { createTracerProjection } from "./tracer";
export type { TracerProjection, TracerProjectionInput } from "./tracer";
export {
  RenderLifecycle,
  adaptRenderQuality,
  createRenderScene,
  sceneBufferHash,
  selectInitialRenderQuality,
  selectRenderBackend,
} from "./renderer";
export type {
  AdaptiveRenderQualityDecision,
  LocalRenderCapability,
  RenderBackend,
  RenderCapabilityProbe,
  RenderLifecycleSnapshot,
  RenderQuality,
  RenderScene,
  RenderSceneInput,
  RenderStage,
  SustainedRenderQualityDecision,
} from "./renderer";
export { BrowserJourneyRenderer, drawCanvasScene } from "./browser";
export type { BrowserRendererElements, BrowserRendererStatus } from "./browser";
export * from "./living-city";
