export const RENDER_PACKAGE = "render" as const;

export type RenderCapability = "webgpu" | "fallback";

export { createTracerProjection } from "./tracer";
export type { TracerProjection, TracerProjectionInput } from "./tracer";
export {
  RenderLifecycle,
  createRenderScene,
  sceneBufferHash,
  selectRenderBackend,
} from "./renderer";
export type {
  RenderBackend,
  RenderCapabilityProbe,
  RenderLifecycleSnapshot,
  RenderQuality,
  RenderScene,
  RenderSceneInput,
  RenderStage,
} from "./renderer";
export { BrowserJourneyRenderer, drawCanvasScene } from "./browser";
export type { BrowserRendererElements, BrowserRendererStatus } from "./browser";
