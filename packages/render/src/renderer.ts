export type RenderStage = "planet" | "region" | "street" | "person";
export type RenderQuality = "fallback" | "baseline" | "showcase";
export type RenderBackend = "webgpu" | "canvas2d";

export interface RenderCapabilityProbe {
  readonly gpuPresent: boolean;
  readonly adapterAvailable: boolean;
  readonly contextAvailable: boolean;
}

export interface RenderSceneInput {
  readonly worldSeed: string;
  readonly stateHash: string;
  readonly selectionId: string;
  readonly stage: RenderStage;
  readonly quality: RenderQuality;
  readonly viewport: Readonly<{ width: number; height: number }>;
  readonly reducedMotion: boolean;
}

export interface RenderScene {
  readonly stage: RenderStage;
  readonly quality: RenderQuality;
  readonly selectionId: string;
  readonly semanticKey: string;
  readonly viewport: Readonly<{ width: number; height: number }>;
  readonly buffer: Readonly<{
    positions: Uint16Array;
    weights: Uint8Array;
    byteLength: number;
  }>;
  readonly draw: Readonly<{
    strategy: "instanced-indirect";
    instanceCount: number;
    visibleCount: number;
    firstInstance: 0;
    workgroupCount: number;
  }>;
  readonly transition: Readonly<{
    durationMs: number;
    preservesSelection: true;
  }>;
  readonly debug: Readonly<{
    minimumTokenWeight: number;
    maximumTokenWeight: number;
    bufferHash: string;
  }>;
}

export interface RenderLifecycleSnapshot {
  readonly backend: RenderBackend;
  readonly animate: boolean;
  readonly width: number;
  readonly height: number;
  readonly generation: number;
  readonly contextLosses: number;
}

const qualityCounts: Readonly<Record<RenderQuality, number>> = Object.freeze({
  fallback: 25_000,
  baseline: 250_000,
  showcase: 1_000_000,
});

function assertDimension(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 16_384)
    throw new RangeError(`${name} must be a positive safe pixel dimension`);
}

function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function nextWord(state: number): number {
  let word = state >>> 0;
  word ^= word << 13;
  word ^= word >>> 17;
  word ^= word << 5;
  return word >>> 0;
}

function bufferHash(positions: Uint16Array, weights: Uint8Array): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < weights.length; index += 1) {
    const offset = index * 2;
    hash ^= BigInt(positions[offset] ?? 0);
    hash = (hash * prime) & mask;
    hash ^= BigInt(positions[offset + 1] ?? 0);
    hash = (hash * prime) & mask;
    hash ^= BigInt(weights[index] ?? 0);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

function visibleCount(stage: RenderStage, instanceCount: number): number {
  if (stage === "planet") return Math.min(instanceCount, 65_536);
  if (stage === "region") return Math.min(instanceCount, 125_000);
  if (stage === "person") return Math.min(instanceCount, 50_000);
  return instanceCount;
}

export function selectRenderBackend(
  probe: RenderCapabilityProbe,
): RenderBackend {
  return probe.gpuPresent && probe.adapterAvailable && probe.contextAvailable
    ? "webgpu"
    : "canvas2d";
}

export function createRenderScene(input: RenderSceneInput): RenderScene {
  assertDimension(input.viewport.width, "viewport width");
  assertDimension(input.viewport.height, "viewport height");
  if (input.worldSeed.length === 0 || input.stateHash.length === 0)
    throw new RangeError("render semantic inputs must not be empty");
  if (input.selectionId.length === 0)
    throw new RangeError("render selection must not be empty");
  const instanceCount = qualityCounts[input.quality];
  const positions = new Uint16Array(instanceCount * 2);
  const weights = new Uint8Array(instanceCount);
  let word = fnv1a32(
    `${input.worldSeed}/${input.stateHash}/${input.selectionId}/render-buffer/v1`,
  );
  let minimumTokenWeight = 255;
  let maximumTokenWeight = 0;
  for (let index = 0; index < instanceCount; index += 1) {
    word = nextWord(word + index + 1);
    positions[index * 2] = word & 0xffff;
    word = nextWord(word ^ 0x9e3779b9);
    positions[index * 2 + 1] = word & 0xffff;
    const weight = (word >>> 24) + 1;
    weights[index] = weight;
    minimumTokenWeight = Math.min(minimumTokenWeight, weight);
    maximumTokenWeight = Math.max(maximumTokenWeight, weight);
  }
  const hash = bufferHash(positions, weights);
  const visible = visibleCount(input.stage, instanceCount);
  return Object.freeze({
    stage: input.stage,
    quality: input.quality,
    selectionId: input.selectionId,
    semanticKey: `${input.stateHash}/${input.selectionId}/${input.stage}`,
    viewport: Object.freeze({ ...input.viewport }),
    buffer: Object.freeze({
      positions,
      weights,
      byteLength: positions.byteLength + weights.byteLength,
    }),
    draw: Object.freeze({
      strategy: "instanced-indirect" as const,
      instanceCount,
      visibleCount: visible,
      firstInstance: 0 as const,
      workgroupCount: Math.ceil(visible / 64),
    }),
    transition: Object.freeze({
      durationMs: input.reducedMotion ? 0 : 240,
      preservesSelection: true as const,
    }),
    debug: Object.freeze({
      minimumTokenWeight,
      maximumTokenWeight,
      bufferHash: hash,
    }),
  });
}

export function sceneBufferHash(scene: RenderScene): string {
  return scene.debug.bufferHash;
}

export class RenderLifecycle {
  readonly #reducedMotion: boolean;
  #backend: RenderBackend = "canvas2d";
  #width = 1;
  #height = 1;
  #generation = 0;
  #contextLosses = 0;

  constructor(reducedMotion: boolean) {
    this.#reducedMotion = reducedMotion;
  }

  initialize(probe: RenderCapabilityProbe): RenderLifecycleSnapshot {
    this.#backend = selectRenderBackend(probe);
    this.#generation += 1;
    return this.snapshot();
  }

  resize(width: number, height: number): RenderLifecycleSnapshot {
    assertDimension(width, "render width");
    assertDimension(height, "render height");
    this.#width = width;
    this.#height = height;
    this.#generation += 1;
    return this.snapshot();
  }

  contextLost(): RenderLifecycleSnapshot {
    this.#backend = "canvas2d";
    this.#contextLosses += 1;
    this.#generation += 1;
    return this.snapshot();
  }

  recover(probe: RenderCapabilityProbe): RenderLifecycleSnapshot {
    this.#backend = selectRenderBackend(probe);
    this.#generation += 1;
    return this.snapshot();
  }

  snapshot(): RenderLifecycleSnapshot {
    return Object.freeze({
      backend: this.#backend,
      animate: !this.#reducedMotion,
      width: this.#width,
      height: this.#height,
      generation: this.#generation,
      contextLosses: this.#contextLosses,
    });
  }
}
