import { describe, expect, it } from "vitest";

import {
  RenderLifecycle,
  createRenderScene,
  sceneBufferHash,
  selectRenderBackend,
} from "./renderer";

describe("multi-LOD render scene", () => {
  const authoritative = Object.freeze({
    stateHash: "6e190d289164581d",
    selectionId: "person_27yi09s_1obkbba",
    worldSeed: "ten-billion-lives/baseline/v1",
  });

  it("preserves semantic selection across four reload-free projections", () => {
    const scenes = ["planet", "region", "street", "person"].map((stage) =>
      createRenderScene({
        ...authoritative,
        stage: stage as "planet" | "region" | "street" | "person",
        quality: "baseline",
        viewport: { width: 1280, height: 720 },
        reducedMotion: false,
      }),
    );
    expect(scenes.map((scene) => scene.stage)).toEqual([
      "planet",
      "region",
      "street",
      "person",
    ]);
    expect(
      scenes.every((scene) => scene.selectionId === authoritative.selectionId),
    ).toBe(true);
    expect(new Set(scenes.map((scene) => scene.semanticKey)).size).toBe(4);
    expect(scenes.every((scene) => scene.transition.durationMs === 240)).toBe(
      true,
    );
  });

  it("generates deterministic baseline buffers and an instanced culling plan", () => {
    const input = {
      ...authoritative,
      stage: "street" as const,
      quality: "baseline" as const,
      viewport: { width: 1280, height: 720 },
      reducedMotion: false,
    };
    const first = createRenderScene(input);
    const second = createRenderScene({ ...input });
    expect(first.draw.instanceCount).toBe(250_000);
    expect(first.draw.visibleCount).toBe(250_000);
    expect(first.draw.strategy).toBe("instanced-indirect");
    expect(first.buffer.positions).toHaveLength(500_000);
    expect(first.buffer.weights).toHaveLength(250_000);
    expect(sceneBufferHash(first)).toBe(sceneBufferHash(second));
    expect(sceneBufferHash(first)).toMatch(/^[0-9a-f]{16}$/);
    expect(authoritative).toEqual({
      stateHash: "6e190d289164581d",
      selectionId: "person_27yi09s_1obkbba",
      worldSeed: "ten-billion-lives/baseline/v1",
    });
  });

  it("selects WebGPU only after every capability probe succeeds", () => {
    expect(
      selectRenderBackend({
        gpuPresent: true,
        adapterAvailable: true,
        contextAvailable: true,
      }),
    ).toBe("webgpu");
    for (const probe of [
      { gpuPresent: false, adapterAvailable: false, contextAvailable: false },
      { gpuPresent: true, adapterAvailable: false, contextAvailable: true },
      { gpuPresent: true, adapterAvailable: true, contextAvailable: false },
    ])
      expect(selectRenderBackend(probe)).toBe("canvas2d");
  });

  it("recovers resize and context loss while honoring reduced motion", () => {
    const lifecycle = new RenderLifecycle(true);
    lifecycle.initialize({
      gpuPresent: true,
      adapterAvailable: true,
      contextAvailable: true,
    });
    expect(lifecycle.snapshot()).toMatchObject({
      backend: "webgpu",
      animate: false,
      width: 1,
      height: 1,
    });
    lifecycle.resize(900, 540);
    const resized = lifecycle.snapshot();
    expect(resized).toMatchObject({ width: 900, height: 540, generation: 2 });
    lifecycle.contextLost();
    expect(lifecycle.snapshot()).toMatchObject({
      backend: "canvas2d",
      contextLosses: 1,
      generation: 3,
    });
    lifecycle.recover({
      gpuPresent: false,
      adapterAvailable: false,
      contextAvailable: true,
    });
    expect(lifecycle.snapshot()).toMatchObject({
      backend: "canvas2d",
      animate: false,
      contextLosses: 1,
      generation: 4,
    });
    expect(() => lifecycle.resize(0, 10)).toThrow(/positive/);
  });

  it("removes transition motion without changing semantic projection", () => {
    const animated = createRenderScene({
      ...authoritative,
      stage: "person",
      quality: "fallback",
      viewport: { width: 640, height: 480 },
      reducedMotion: false,
    });
    const reduced = createRenderScene({
      ...authoritative,
      stage: "person",
      quality: "fallback",
      viewport: { width: 640, height: 480 },
      reducedMotion: true,
    });
    expect(reduced.transition.durationMs).toBe(0);
    expect(reduced.semanticKey).toBe(animated.semanticKey);
    expect(sceneBufferHash(reduced)).toBe(sceneBufferHash(animated));
  });
});
