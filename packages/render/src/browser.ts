import {
  RenderLifecycle,
  createRenderScene,
  type RenderBackend,
  type RenderLifecycleSnapshot,
  type RenderScene,
} from "./renderer.js";

export interface BrowserRendererStatus {
  readonly backend: RenderBackend;
  readonly frameMs: number;
  readonly visibleCount: number;
  readonly instanceCount: number;
  readonly bufferBytes: number;
  readonly lifecycle: RenderLifecycleSnapshot;
}

export interface BrowserRendererElements {
  readonly fallbackCanvas: HTMLCanvasElement;
  readonly gpuCanvas: HTMLCanvasElement;
}

const GPU_BUFFER_USAGE_COPY_DST = 0x0008;
const GPU_BUFFER_USAGE_STORAGE = 0x0080;
const GPU_BUFFER_USAGE_INDIRECT = 0x0100;

function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function stagePosition(
  scene: RenderScene,
  index: number,
  width: number,
  height: number,
): readonly [number, number] {
  const xWord = scene.buffer.positions[index * 2] ?? 0;
  const yWord = scene.buffer.positions[index * 2 + 1] ?? 0;
  const normalizedX = xWord / 65_535;
  const normalizedY = yWord / 65_535;
  if (scene.stage === "planet") {
    const angle = normalizedX * Math.PI * 2;
    const radius = Math.sqrt(normalizedY) * Math.min(width, height) * 0.37;
    return Object.freeze([
      width * 0.5 + Math.cos(angle) * radius,
      height * 0.5 + Math.sin(angle) * radius * 0.72,
    ]);
  }
  if (scene.stage === "street") {
    const depth = 0.12 + normalizedY * 0.88;
    return Object.freeze([
      width * 0.5 + (normalizedX - 0.5) * width * depth,
      height * (0.33 + depth * 0.64),
    ]);
  }
  if (scene.stage === "person")
    return Object.freeze([
      width * (0.08 + normalizedX * 0.84),
      height * (0.62 + normalizedY * 0.34),
    ]);
  return Object.freeze([normalizedX * width, normalizedY * height]);
}

function tokenColor(weight: number, stage: RenderScene["stage"]): number {
  const alpha = 0xff;
  const red = stage === "street" ? 90 + (weight >> 2) : 45 + (weight >> 3);
  const green = 130 + (weight >> 2);
  const blue = stage === "planet" ? 125 + (weight >> 2) : 90 + (weight >> 3);
  return (
    (alpha << 24) |
    (Math.min(255, blue) << 16) |
    (Math.min(255, green) << 8) |
    Math.min(255, red)
  );
}

function drawStageOverlay(
  context: CanvasRenderingContext2D,
  scene: RenderScene,
  width: number,
  height: number,
): void {
  context.save();
  if (scene.stage === "planet") {
    const radius = Math.min(width, height) * 0.39;
    const atmosphere = context.createRadialGradient(
      width * 0.42,
      height * 0.36,
      radius * 0.08,
      width * 0.5,
      height * 0.5,
      radius,
    );
    atmosphere.addColorStop(0, "rgba(177, 242, 209, 0.12)");
    atmosphere.addColorStop(0.68, "rgba(13, 74, 57, 0.08)");
    atmosphere.addColorStop(1, "rgba(1, 8, 12, 0.7)");
    context.fillStyle = atmosphere;
    context.beginPath();
    context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(151, 235, 197, 0.62)";
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = "rgba(118, 208, 170, 0.18)";
    for (const scale of [0.35, 0.62]) {
      context.beginPath();
      context.ellipse(
        width / 2,
        height / 2,
        radius,
        radius * scale,
        0,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
  } else if (scene.stage === "region") {
    context.strokeStyle = "rgba(142, 226, 187, 0.17)";
    context.lineWidth = 1;
    for (let index = 1; index < 8; index += 1) {
      context.beginPath();
      context.moveTo((width * index) / 8, 0);
      context.lineTo((width * index) / 8, height);
      context.moveTo(0, (height * index) / 8);
      context.lineTo(width, (height * index) / 8);
      context.stroke();
    }
    context.strokeStyle = "rgba(255, 224, 142, 0.5)";
    context.beginPath();
    context.moveTo(width * 0.08, height * 0.76);
    context.bezierCurveTo(
      width * 0.34,
      height * 0.2,
      width * 0.64,
      height * 0.86,
      width * 0.92,
      height * 0.3,
    );
    context.stroke();
  } else if (scene.stage === "street") {
    const horizon = height * 0.33;
    const sky = context.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "rgba(20, 67, 57, 0.72)");
    sky.addColorStop(1, "rgba(12, 34, 29, 0.12)");
    context.fillStyle = sky;
    context.fillRect(0, 0, width, horizon);
    context.strokeStyle = "rgba(170, 226, 201, 0.18)";
    for (let lane = -4; lane <= 4; lane += 1) {
      context.beginPath();
      context.moveTo(width / 2, horizon);
      context.lineTo(width / 2 + lane * width * 0.16, height);
      context.stroke();
    }
    for (let row = 1; row <= 6; row += 1) {
      const depth = row / 6;
      context.beginPath();
      context.moveTo(0, horizon + depth * depth * (height - horizon));
      context.lineTo(width, horizon + depth * depth * (height - horizon));
      context.stroke();
    }
  } else {
    const glow = context.createRadialGradient(
      width / 2,
      height * 0.36,
      4,
      width / 2,
      height * 0.42,
      height * 0.34,
    );
    glow.addColorStop(0, "rgba(150, 235, 195, 0.3)");
    glow.addColorStop(1, "rgba(50, 120, 91, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
    context.fillStyle = "rgba(214, 245, 230, 0.9)";
    context.beginPath();
    context.arc(width / 2, height * 0.26, height * 0.07, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(87, 174, 134, 0.88)";
    context.beginPath();
    context.roundRect(
      width * 0.44,
      height * 0.34,
      width * 0.12,
      height * 0.35,
      18,
    );
    context.fill();
  }
  const selectionWord = fnv1a32(scene.selectionId);
  const markerX = width * (0.28 + ((selectionWord & 0xff) / 255) * 0.44);
  const markerY =
    height * (0.25 + (((selectionWord >>> 8) & 0xff) / 255) * 0.45);
  context.strokeStyle = "#fff0a8";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(markerX, markerY, 8, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = "#dcefe5";
  context.font = "600 12px ui-monospace, monospace";
  context.fillText(
    `${scene.stage.toUpperCase()} · ${scene.draw.visibleCount.toLocaleString("en-US")} visible`,
    18,
    26,
  );
  context.restore();
}

interface CanvasFrameBuffer {
  readonly width: number;
  readonly height: number;
  readonly image: ImageData;
  readonly pixels: Uint32Array;
}

const canvasFrameBuffers = new WeakMap<HTMLCanvasElement, CanvasFrameBuffer>();

function frameBuffer(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): CanvasFrameBuffer {
  const cached = canvasFrameBuffers.get(canvas);
  if (
    cached !== undefined &&
    cached.width === canvas.width &&
    cached.height === canvas.height
  )
    return cached;
  const image = context.createImageData(canvas.width, canvas.height);
  const created = {
    width: canvas.width,
    height: canvas.height,
    image,
    pixels: new Uint32Array(image.data.buffer),
  };
  canvasFrameBuffers.set(canvas, created);
  return created;
}

export function drawCanvasScene(
  canvas: HTMLCanvasElement,
  scene: RenderScene,
): number {
  const context = canvas.getContext("2d", { alpha: false });
  if (context === null) throw new Error("Canvas2D fallback unavailable");
  const started = performance.now();
  const width = canvas.width;
  const height = canvas.height;
  const { image, pixels } = frameBuffer(canvas, context);
  pixels.fill(0xff101a15);
  const inverseWord = 1 / 65_535;
  if (scene.stage === "street") {
    for (let index = 0; index < scene.draw.visibleCount; index += 1) {
      const normalizedX =
        (scene.buffer.positions[index * 2] ?? 0) * inverseWord;
      const depth =
        0.12 +
        (scene.buffer.positions[index * 2 + 1] ?? 0) * inverseWord * 0.88;
      const rawX = Math.floor(
        width * 0.5 + (normalizedX - 0.5) * width * depth,
      );
      const pixelX = rawX >= width ? width - 1 : rawX < 0 ? 0 : rawX;
      const pixelY = Math.floor(height * (0.33 + depth * 0.64));
      pixels[pixelY * width + pixelX] = tokenColor(
        scene.buffer.weights[index] ?? 1,
        scene.stage,
      );
    }
  } else if (scene.stage === "planet") {
    const radiusScale = Math.min(width, height) * 0.37;
    for (let index = 0; index < scene.draw.visibleCount; index += 1) {
      const angle =
        (scene.buffer.positions[index * 2] ?? 0) * inverseWord * Math.PI * 2;
      const radius =
        Math.sqrt((scene.buffer.positions[index * 2 + 1] ?? 0) * inverseWord) *
        radiusScale;
      const pixelX = Math.floor(width * 0.5 + Math.cos(angle) * radius);
      const pixelY = Math.floor(height * 0.5 + Math.sin(angle) * radius * 0.72);
      pixels[pixelY * width + pixelX] = tokenColor(
        scene.buffer.weights[index] ?? 1,
        scene.stage,
      );
    }
  } else {
    const personStage = scene.stage === "person";
    for (let index = 0; index < scene.draw.visibleCount; index += 1) {
      const normalizedX =
        (scene.buffer.positions[index * 2] ?? 0) * inverseWord;
      const normalizedY =
        (scene.buffer.positions[index * 2 + 1] ?? 0) * inverseWord;
      const pixelX = Math.floor(
        personStage
          ? width * (0.08 + normalizedX * 0.84)
          : normalizedX * (width - 1),
      );
      const pixelY = Math.floor(
        personStage
          ? height * (0.62 + normalizedY * 0.34)
          : normalizedY * (height - 1),
      );
      pixels[pixelY * width + pixelX] = tokenColor(
        scene.buffer.weights[index] ?? 1,
        scene.stage,
      );
    }
  }
  context.putImageData(image, 0, 0);
  drawStageOverlay(context, scene, width, height);
  return performance.now() - started;
}

function gpuPositions(scene: RenderScene): Float32Array {
  const positions = new Float32Array(scene.draw.visibleCount * 2);
  for (let index = 0; index < scene.draw.visibleCount; index += 1) {
    const [x, y] = stagePosition(scene, index, 2, 2);
    positions[index * 2] = x - 1;
    positions[index * 2 + 1] = 1 - y;
  }
  return positions;
}

function stageClearColor(stage: RenderScene["stage"]): Readonly<{
  r: number;
  g: number;
  b: number;
  a: number;
}> {
  if (stage === "planet") return { r: 0.015, g: 0.055, b: 0.07, a: 1 };
  if (stage === "street") return { r: 0.035, g: 0.075, b: 0.06, a: 1 };
  return { r: 0.02, g: 0.065, b: 0.05, a: 1 };
}

export class BrowserJourneyRenderer {
  readonly #elements: BrowserRendererElements;
  readonly #lifecycle: RenderLifecycle;
  #device: GPUDevice | null = null;
  #context: GPUCanvasContext | null = null;
  #pipeline: GPURenderPipeline | null = null;
  #destroyed = false;
  readonly #forceCanvas: boolean;
  #scene: RenderScene | null = null;
  #status: BrowserRendererStatus | null = null;

  constructor(
    elements: BrowserRendererElements,
    reducedMotion: boolean,
    forceCanvas = false,
  ) {
    this.#elements = elements;
    this.#lifecycle = new RenderLifecycle(reducedMotion);
    this.#forceCanvas = forceCanvas;
  }

  async initialize(scene: RenderScene): Promise<BrowserRendererStatus> {
    this.#scene = scene;
    const fallbackMs = drawCanvasScene(this.#elements.fallbackCanvas, scene);
    const gpu = this.#forceCanvas ? undefined : navigator.gpu;
    let adapter: GPUAdapter | null = null;
    let context: GPUCanvasContext | null = null;
    if (gpu !== undefined) {
      try {
        adapter = await gpu.requestAdapter();
        context = this.#elements.gpuCanvas.getContext(
          "webgpu",
        ) as unknown as GPUCanvasContext | null;
      } catch {
        adapter = null;
        context = null;
      }
    }
    this.#lifecycle.initialize({
      gpuPresent: gpu !== undefined,
      adapterAvailable: adapter !== null,
      contextAvailable: context !== null,
    });
    if (adapter !== null && context !== null && gpu !== undefined) {
      try {
        this.#device = await adapter.requestDevice();
        this.#context = context;
        const format = gpu.getPreferredCanvasFormat();
        context.configure({
          device: this.#device,
          format,
          alphaMode: "opaque",
        });
        const module = this.#device.createShaderModule({
          code: `
struct Positions { values: array<vec2f> };
@group(0) @binding(0) var<storage, read> positions: Positions;
struct Output { @builtin(position) position: vec4f };
@vertex fn vertex_main(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> Output {
  let corners = array<vec2f, 6>(vec2f(-1.0,-1.0), vec2f(1.0,-1.0), vec2f(-1.0,1.0), vec2f(-1.0,1.0), vec2f(1.0,-1.0), vec2f(1.0,1.0));
  var output: Output;
  output.position = vec4f(positions.values[instance] + corners[vertex] * 0.0028, 0.0, 1.0);
  return output;
}
@fragment fn fragment_main() -> @location(0) vec4f { return vec4f(0.48, 0.9, 0.69, 0.58); }`,
        });
        this.#pipeline = this.#device.createRenderPipeline({
          layout: "auto",
          vertex: { module, entryPoint: "vertex_main" },
          fragment: {
            module,
            entryPoint: "fragment_main",
            targets: [
              {
                format,
                blend: {
                  color: {
                    srcFactor: "src-alpha",
                    dstFactor: "one-minus-src-alpha",
                    operation: "add",
                  },
                  alpha: {
                    srcFactor: "one",
                    dstFactor: "one-minus-src-alpha",
                    operation: "add",
                  },
                },
              },
            ],
          },
          primitive: { topology: "triangle-list" },
        });
        void this.#device.lost.then(() => {
          if (!this.#destroyed) this.simulateContextLoss();
        });
      } catch {
        this.#device = null;
        this.#context = null;
        this.#pipeline = null;
        this.#lifecycle.contextLost();
      }
    }
    if (
      this.#device !== null &&
      this.#context !== null &&
      this.#pipeline !== null
    )
      return this.render(scene);
    this.#showBackend("canvas2d");
    this.#status = Object.freeze({
      backend: "canvas2d" as const,
      frameMs: fallbackMs,
      visibleCount: scene.draw.visibleCount,
      instanceCount: scene.draw.instanceCount,
      bufferBytes: scene.buffer.byteLength,
      lifecycle: this.#lifecycle.snapshot(),
    });
    return this.#status;
  }

  #showBackend(backend: RenderBackend): void {
    this.#elements.gpuCanvas.hidden = backend !== "webgpu";
    this.#elements.fallbackCanvas.hidden = backend !== "canvas2d";
  }

  #drawWebGpu(scene: RenderScene): number {
    if (
      this.#device === null ||
      this.#context === null ||
      this.#pipeline === null
    )
      throw new Error("WebGPU renderer is not initialized");
    const started = performance.now();
    const positions = gpuPositions(scene);
    const storage = this.#device.createBuffer({
      size: positions.byteLength,
      usage: GPU_BUFFER_USAGE_STORAGE | GPU_BUFFER_USAGE_COPY_DST,
    });
    this.#device.queue.writeBuffer(
      storage,
      0,
      positions.buffer as ArrayBuffer,
      positions.byteOffset,
      positions.byteLength,
    );
    const indirectData = new Uint32Array([6, scene.draw.visibleCount, 0, 0]);
    const indirect = this.#device.createBuffer({
      size: indirectData.byteLength,
      usage: GPU_BUFFER_USAGE_INDIRECT | GPU_BUFFER_USAGE_COPY_DST,
    });
    this.#device.queue.writeBuffer(
      indirect,
      0,
      indirectData.buffer as ArrayBuffer,
      indirectData.byteOffset,
      indirectData.byteLength,
    );
    const bindGroup = this.#device.createBindGroup({
      layout: this.#pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: storage } }],
    });
    const encoder = this.#device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.#context.getCurrentTexture().createView(),
          clearValue: stageClearColor(scene.stage),
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(this.#pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.drawIndirect(indirect, 0);
    pass.end();
    this.#device.queue.submit([encoder.finish()]);
    return performance.now() - started;
  }

  render(scene: RenderScene): BrowserRendererStatus {
    this.#scene = scene;
    const canUseGpu =
      this.#device !== null &&
      this.#context !== null &&
      this.#pipeline !== null;
    const backend: RenderBackend = canUseGpu ? "webgpu" : "canvas2d";
    const frameMs = canUseGpu
      ? this.#drawWebGpu(scene)
      : drawCanvasScene(this.#elements.fallbackCanvas, scene);
    this.#showBackend(backend);
    this.#status = Object.freeze({
      backend,
      frameMs,
      visibleCount: scene.draw.visibleCount,
      instanceCount: scene.draw.instanceCount,
      bufferBytes: scene.buffer.byteLength,
      lifecycle: this.#lifecycle.snapshot(),
    });
    return this.#status;
  }

  resize(width: number, height: number): BrowserRendererStatus | null {
    this.#lifecycle.resize(width, height);
    for (const canvas of [
      this.#elements.fallbackCanvas,
      this.#elements.gpuCanvas,
    ]) {
      canvas.width = width;
      canvas.height = height;
    }
    return this.#scene === null ? null : this.render(this.#scene);
  }

  simulateContextLoss(): BrowserRendererStatus | null {
    this.#context?.unconfigure();
    this.#device = null;
    this.#context = null;
    this.#pipeline = null;
    this.#lifecycle.contextLost();
    if (this.#scene === null) return null;
    const frameMs = drawCanvasScene(this.#elements.fallbackCanvas, this.#scene);
    this.#showBackend("canvas2d");
    this.#status = Object.freeze({
      backend: "canvas2d" as const,
      frameMs,
      visibleCount: this.#scene.draw.visibleCount,
      instanceCount: this.#scene.draw.instanceCount,
      bufferBytes: this.#scene.buffer.byteLength,
      lifecycle: this.#lifecycle.snapshot(),
    });
    return this.#status;
  }

  status(): BrowserRendererStatus | null {
    return this.#status;
  }

  destroy(): void {
    this.#destroyed = true;
    this.#context?.unconfigure();
    this.#device?.destroy();
    this.#device = null;
    this.#context = null;
    this.#pipeline = null;
  }
}

export { createRenderScene };
