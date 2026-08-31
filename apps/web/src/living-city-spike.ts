import {
  LivingCityBrowserRenderer,
  createLivingCitySummary,
  prepareLivingCityFrame,
  type LivingCityRenderInput,
  type LivingCityRenderMetrics,
  type LivingCityScene,
  type MapPoint,
} from "../../../packages/render/src/living-city.js";

export const LIVING_CITY_SPIKE_COUNTS = Object.freeze([
  64, 128, 256, 512, 1_024,
] as const);

export const LIVING_CITY_SPIKE_PROFILE = "apple-m1-max-32gb-chromium";

const representedPeople = 10_000_000_000n;
const aggregateWeight = 1_000n;

function point(eastCm: number, northCm: number, upCm = 0): MapPoint {
  return Object.freeze({ eastCm, northCm, upCm });
}

function rectangle(
  westCm: number,
  northCm: number,
  eastCm: number,
  southCm: number,
): readonly MapPoint[] {
  return Object.freeze([
    point(westCm, northCm),
    point(eastCm, northCm),
    point(eastCm, southCm),
    point(westCm, southCm),
  ]);
}

function routePose(
  index: number,
  personId: string,
  phasePermillion: number,
  tick: bigint,
) {
  const lane = index % 4;
  const offset = Math.floor(index / 4);
  const travel = (phasePermillion + offset * 31_337) % 1_000_000;
  const across = -18_000 + Math.floor((travel / 1_000_000) * 36_000);
  const lateral = ((offset % 9) - 4) * 95;
  const eastbound = lane === 0 || lane === 2;
  const position =
    lane < 2
      ? point(eastbound ? across : -across, -1_050 + lateral)
      : point(1_050 + lateral, eastbound ? across : -across);
  return Object.freeze({
    personId,
    time: Object.freeze({ tick, phasePermillion }),
    mode: "walking" as const,
    position,
    headingMilliTurns:
      lane === 0 ? 250 : lane === 1 ? 750 : lane === 2 ? 0 : 500,
    stridePermillion: (travel * 7 + index * 13_771) % 1_000_000,
    routeId: lane < 2 ? "route/harbor-east-west" : "route/market-north-south",
    edgeId: lane < 2 ? "edge/harbor-sidewalk" : "edge/market-sidewalk",
    destinationPlaceId: lane < 2 ? "place/lantern-quay" : "place/market-hall",
    trajectoryHash: `trajectory/spike/${personId}/t${tick.toString()}-p${phasePermillion}`,
  });
}

export function createLivingCitySpikeInput(
  figureCount = 256,
  phasePermillion = 250_000,
  quality: "fallback" | "baseline" | "showcase" = "baseline",
  viewport: Readonly<{ width: number; height: number }> = Object.freeze({
    width: 1_280,
    height: 720,
  }),
  reducedMotion = false,
  pixelsPerMeter = 1.45,
  tick = 17n,
): LivingCityRenderInput {
  if (
    !Number.isSafeInteger(figureCount) ||
    figureCount < 1 ||
    figureCount > 4_096
  )
    throw new RangeError(
      "spike figureCount must be an integer from 1 through 4096",
    );
  if (
    !Number.isSafeInteger(phasePermillion) ||
    phasePermillion < 0 ||
    phasePermillion > 999_999
  )
    throw new RangeError("spike phasePermillion must be in [0, 999999]");
  const figures = Array.from({ length: figureCount }, (_, index) => {
    const personId = `person/spike-${index.toString().padStart(6, "0")}`;
    return Object.freeze({
      personId,
      representedWeight: index === 0 ? 1n : aggregateWeight,
      pinned: index === 0,
      pose: routePose(index, personId, phasePermillion, tick),
      appearanceKey: (index * 2_654_435_761) >>> 0,
      story: Object.freeze({
        activity: "transit" as const,
        locationId: "route/spike-harbor",
        encounterGroupId: "encounter/spike-harbor",
        encounterCount: index === 0 ? 1 : 0,
        eventIds: Object.freeze(index === 0 ? ["event/spike-arrival"] : []),
        routeReason: "festival convergence" as const,
        routeEdgeCount: 1,
      }),
    });
  });
  const sampledPeople = figures.reduce(
    (total, figure) => total + figure.representedWeight,
    0n,
  );
  const scene: LivingCityScene = Object.freeze({
    schema: 1,
    context: Object.freeze({
      seed: "ten-billion-lives/baseline/v1",
      branch: "baseline" as const,
      stateHash: `state/spike-t${tick.toString()}`,
      eventHash: "event/lantern-tide-arrival",
      manifestationHash: "manifestation/spike-harbor-block",
      time: Object.freeze({ tick, phasePermillion }),
    }),
    city: Object.freeze({
      schema: 1,
      seed: "ten-billion-lives/baseline/v1",
      settlementId: "place/brindle-bay" as const,
      bounds: Object.freeze({
        min: point(-22_000, -22_000),
        max: point(22_000, 22_000, 2_200),
      }),
      roads: Object.freeze([
        Object.freeze({
          id: "road/harbor",
          centerline: Object.freeze([point(-22_000, 0), point(22_000, 0)]),
          widthCm: 1_400,
        }),
        Object.freeze({
          id: "road/market",
          centerline: Object.freeze([point(0, -22_000), point(0, 22_000)]),
          widthCm: 1_400,
        }),
      ]),
      sidewalks: Object.freeze([
        Object.freeze({
          id: "sidewalk/harbor-north",
          path: Object.freeze([point(-22_000, -1_250), point(22_000, -1_250)]),
          widthCm: 1_100,
        }),
        Object.freeze({
          id: "sidewalk/harbor-south",
          path: Object.freeze([point(-22_000, 1_250), point(22_000, 1_250)]),
          widthCm: 1_100,
        }),
        Object.freeze({
          id: "sidewalk/market-west",
          path: Object.freeze([point(-1_250, -22_000), point(-1_250, 22_000)]),
          widthCm: 1_100,
        }),
        Object.freeze({
          id: "sidewalk/market-east",
          path: Object.freeze([point(1_250, -22_000), point(1_250, 22_000)]),
          widthCm: 1_100,
        }),
      ]),
      crossings: Object.freeze([
        Object.freeze({
          id: "crossing/harbor",
          path: Object.freeze([point(0, -1_800), point(0, 1_800)]),
          widthCm: 1_300,
        }),
        Object.freeze({
          id: "crossing/market",
          path: Object.freeze([point(-1_800, 0), point(1_800, 0)]),
          widthCm: 1_300,
        }),
      ]),
      buildings: Object.freeze([
        Object.freeze({
          id: "building/gardens",
          footprint: rectangle(-19_500, -19_500, -4_000, -5_000),
          heightCm: 1_300,
        }),
        Object.freeze({
          id: "building/market-hall",
          footprint: rectangle(4_000, -19_500, 19_500, -5_000),
          heightCm: 2_200,
        }),
        Object.freeze({
          id: "building/school",
          footprint: rectangle(-19_500, 5_000, -4_000, 19_500),
          heightCm: 1_700,
        }),
        Object.freeze({
          id: "building/lantern-quay",
          footprint: rectangle(4_000, 5_000, 19_500, 19_500),
          heightCm: 1_100,
        }),
      ]),
      publicSpaces: Object.freeze([
        Object.freeze({
          id: "public/lantern-square",
          boundary: rectangle(4_500, 6_000, 18_500, 18_500),
        }),
      ]),
      places: Object.freeze([]),
      pedestrianNodes: Object.freeze([]),
      pedestrianEdges: Object.freeze([]),
      cityHash: "city/spike-harbor-block-v1",
    }),
    figures: Object.freeze(figures),
    story: Object.freeze({
      phase: "festival-arrival" as const,
      events: Object.freeze([
        Object.freeze({
          id: "event/spike-arrival",
          kind: "arrival" as const,
          locationId: "festival/lantern-confluence",
          participantIds: Object.freeze([figures[0]?.personId ?? ""]),
        }),
      ]),
      activityGroups: Object.freeze([
        Object.freeze({
          activity: "transit" as const,
          literalFigures: figures.length,
          representedPeople: sampledPeople,
        }),
      ]),
    }),
    selectedPersonId: figures[0]?.personId ?? null,
    representedPeople,
    unsampledRemainder: representedPeople - sampledPeople,
    semanticKey: `living-city/state-spike/event-lantern/t${tick.toString()}-p${phasePermillion}`,
  });
  return Object.freeze({
    scene,
    presentation: Object.freeze({
      camera: Object.freeze({
        centerEastCm: 0,
        centerNorthCm: 0,
        pixelsPerMeter,
      }),
      viewport: Object.freeze({ ...viewport }),
      quality,
      reducedMotion,
    }),
  });
}

export interface MountedLivingCitySpike {
  readonly renderer: LivingCityBrowserRenderer;
  readonly metrics: LivingCityRenderMetrics;
  readonly render: (
    figureCount: number,
    phasePermillion?: number,
  ) => LivingCityRenderMetrics;
  readonly contextLoss: () => LivingCityRenderMetrics | null;
  readonly resize: (
    width: number,
    height: number,
  ) => LivingCityRenderMetrics | null;
  readonly zoom: (pixelsPerMeter: number) => LivingCityRenderMetrics;
  readonly selectedPoint: () => Readonly<{ x: number; y: number }> | null;
  readonly destroy: () => void;
}

function spikeMarkup(root: HTMLElement, width: number, height: number): void {
  root.innerHTML = `
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; background: #10171c; color: #edf6ef; font: 14px/1.45 system-ui, sans-serif; }
      #living-city-spike { min-height: 100vh; display: grid; grid-template-rows: auto 1fr auto; }
      .spike-head, .spike-foot { display: flex; gap: 18px; align-items: center; justify-content: space-between; padding: 10px 16px; background: #132127; }
      .spike-head h1 { margin: 0; font-size: 18px; }
      .spike-stage { position: relative; display: grid; place-items: center; overflow: hidden; background: #091116; }
      .spike-stage canvas { width: min(100%, ${width}px); height: auto; max-height: calc(100vh - 112px); object-fit: contain; }
      .spike-badge { position: absolute; left: 16px; top: 16px; padding: 8px 10px; border: 1px solid #b8d4c5; background: rgba(9, 17, 22, .82); }
      .spike-pick { color: #ffe66d; min-width: 220px; text-align: right; }
      button { min-height: 36px; border: 1px solid #d2e5da; border-radius: 4px; color: inherit; background: #21353b; padding: 6px 10px; }
    </style>
    <section id="living-city-spike" data-testid="living-city-spike" aria-labelledby="spike-title">
      <header class="spike-head">
        <h1 id="spike-title">Literal-person city-block proof</h1>
        <span data-testid="spike-fixed-time">Tick 17 + 25.0000%</span>
      </header>
      <div class="spike-stage" data-testid="spike-stage">
        <canvas data-spike-backend="canvas2d" width="${width}" height="${height}" aria-label="Canvas living-city view"></canvas>
        <canvas data-spike-backend="webgpu" width="${width}" height="${height}" aria-label="WebGPU living-city view" hidden></canvas>
        <div class="spike-badge"><strong>Harbor Street × Market Way</strong><br>Selected walker is pinned at weight one</div>
      </div>
      <footer class="spike-foot">
        <span><strong data-testid="spike-backend">initializing</strong> · <span data-testid="spike-count">0</span> literal figures · <span data-testid="spike-frame">0</span> ms</span>
        <button type="button" data-testid="spike-context-loss">Simulate context loss</button>
        <span class="spike-pick" data-testid="spike-pick">Pick a visible figure</span>
        <span class="spike-summary" data-testid="spike-summary" aria-live="polite"></span>
      </footer>
    </section>`;
}

function updateDiagnostics(
  root: HTMLElement,
  metrics: LivingCityRenderMetrics,
): void {
  const text = (selector: string, value: string) => {
    const element = root.querySelector<HTMLElement>(selector);
    if (element !== null) element.textContent = value;
  };
  text("[data-testid=spike-backend]", metrics.backend);
  text(
    "[data-testid=spike-count]",
    metrics.figureCount.toLocaleString("en-US"),
  );
  text("[data-testid=spike-frame]", metrics.frameMs.toFixed(2));
}

export async function mountLivingCitySpike(
  root: HTMLElement,
  options: Readonly<{
    figureCount?: number;
    phasePermillion?: number;
    forceCanvas?: boolean;
    animate?: boolean;
    width?: number;
    height?: number;
    tick?: bigint;
  }> = {},
): Promise<MountedLivingCitySpike> {
  const width = options.width ?? 1_280;
  const height = options.height ?? 720;
  const figureCount = options.figureCount ?? 256;
  let phasePermillion = options.phasePermillion ?? 250_000;
  const tick = options.tick ?? 17n;
  spikeMarkup(root, width, height);
  const fallbackCanvas = root.querySelector<HTMLCanvasElement>(
    "[data-spike-backend=canvas2d]",
  );
  const gpuCanvas = root.querySelector<HTMLCanvasElement>(
    "[data-spike-backend=webgpu]",
  );
  if (fallbackCanvas === null || gpuCanvas === null)
    throw new Error("living-city spike canvases are unavailable");
  const renderer = new LivingCityBrowserRenderer(
    { fallbackCanvas, gpuCanvas },
    options.forceCanvas ?? false,
  );
  let currentCount = figureCount;
  let currentInput = createLivingCitySpikeInput(
    currentCount,
    phasePermillion,
    "baseline",
    { width, height },
    false,
    1.45,
    tick,
  );
  let metrics = await renderer.initialize(currentInput);
  updateDiagnostics(root, metrics);
  const initialFixedTime = root.querySelector<HTMLElement>(
    "[data-testid=spike-fixed-time]",
  );
  if (initialFixedTime !== null)
    initialFixedTime.textContent = `Tick ${tick.toString()} + ${(phasePermillion / 10_000).toFixed(4)}%`;
  const summary = root.querySelector<HTMLElement>(
    "[data-testid=spike-summary]",
  );
  if (summary !== null)
    summary.textContent =
      createLivingCitySummary(currentInput.scene).selectionSummary ?? "";

  const render = (count: number, phase = phasePermillion) => {
    currentCount = count;
    phasePermillion = phase;
    currentInput = createLivingCitySpikeInput(
      currentCount,
      phasePermillion,
      "baseline",
      {
        width: fallbackCanvas.width,
        height: fallbackCanvas.height,
      },
      false,
      1.45,
      tick,
    );
    metrics = renderer.render(currentInput);
    updateDiagnostics(root, metrics);
    const fixedTime = root.querySelector<HTMLElement>(
      "[data-testid=spike-fixed-time]",
    );
    if (fixedTime !== null)
      fixedTime.textContent = `Tick ${tick.toString()} + ${(phasePermillion / 10_000).toFixed(4)}%`;
    return metrics;
  };

  const click = (event: PointerEvent) => {
    const visibleCanvas =
      metrics.backend === "webgpu" ? gpuCanvas : fallbackCanvas;
    const bounds = visibleCanvas.getBoundingClientRect();
    const x =
      ((event.clientX - bounds.left) / bounds.width) * visibleCanvas.width;
    const y =
      ((event.clientY - bounds.top) / bounds.height) * visibleCanvas.height;
    const picked = renderer.pick(x, y, currentInput.scene.semanticKey);
    const output = root.querySelector<HTMLElement>("[data-testid=spike-pick]");
    if (output !== null)
      output.textContent =
        picked === null
          ? "No figure at that point"
          : `${picked.personId} · render key ${picked.renderKey} · weight ${picked.representedWeight.toString()}`;
  };
  fallbackCanvas.addEventListener("pointerdown", click);
  gpuCanvas.addEventListener("pointerdown", click);

  const lossButton = root.querySelector<HTMLButtonElement>(
    "[data-testid=spike-context-loss]",
  );
  const contextLoss = () => {
    const fallback = renderer.simulateContextLoss();
    if (fallback !== null) {
      metrics = fallback;
      updateDiagnostics(root, metrics);
    }
    return fallback;
  };
  lossButton?.addEventListener("click", contextLoss);

  let animationFrame = 0;
  let lastStep = performance.now();
  const animate = (sample: number) => {
    if (options.animate !== true || !root.isConnected) return;
    if (sample - lastStep >= 1000 / 24) {
      phasePermillion = (phasePermillion + 12_500) % 1_000_000;
      render(currentCount, phasePermillion);
      lastStep = sample;
    }
    animationFrame = requestAnimationFrame(animate);
  };
  if (options.animate === true) animationFrame = requestAnimationFrame(animate);

  const mounted: MountedLivingCitySpike = Object.freeze({
    renderer,
    metrics,
    render,
    contextLoss,
    resize: (nextWidth: number, nextHeight: number) => {
      const resized = renderer.resize(nextWidth, nextHeight);
      if (resized !== null) {
        metrics = resized;
        updateDiagnostics(root, metrics);
      }
      return resized;
    },
    zoom: (pixelsPerMeter: number) => {
      currentInput = createLivingCitySpikeInput(
        currentCount,
        phasePermillion,
        "baseline",
        {
          width: fallbackCanvas.width,
          height: fallbackCanvas.height,
        },
        false,
        pixelsPerMeter,
        tick,
      );
      metrics = renderer.render(currentInput);
      updateDiagnostics(root, metrics);
      return metrics;
    },
    selectedPoint: () => {
      const selected = prepareLivingCityFrame(currentInput).figures.find(
        (figure) => figure.selected,
      );
      return selected === undefined ? null : selected.screen;
    },
    destroy: () => {
      cancelAnimationFrame(animationFrame);
      fallbackCanvas.removeEventListener("pointerdown", click);
      gpuCanvas.removeEventListener("pointerdown", click);
      renderer.destroy();
    },
  });
  return mounted;
}

declare global {
  // Dedicated spike scripts install this hook; the production observer does not.
  var __livingCitySpike: MountedLivingCitySpike | undefined;
}

const automaticRoot = document.querySelector<HTMLElement>(
  "[data-living-city-spike-root]",
);
if (automaticRoot !== null) {
  const parameters = new URLSearchParams(location.search);
  const count = Number.parseInt(parameters.get("count") ?? "256", 10);
  const phase = Number.parseInt(parameters.get("phase") ?? "250000", 10);
  void mountLivingCitySpike(automaticRoot, {
    figureCount: count,
    phasePermillion: phase,
    forceCanvas: parameters.get("backend") === "canvas",
    animate: parameters.get("animate") === "1",
    tick: BigInt(parameters.get("tick") ?? "17"),
  }).then((mounted) => {
    globalThis.__livingCitySpike = mounted;
  });
}

export { prepareLivingCityFrame };
