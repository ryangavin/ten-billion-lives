import "./style.css";

import {
  createIllusionEngine,
  manifestPlaceholder,
  type AnalyticalItineraryIndex,
  type IllusionEngine,
  type IllusionProjection,
  type PersonCard,
  type PersonItineraryPoint,
} from "@ten-billion-lives/manifest";
import {
  BASELINE_WORLD_SEED,
  EVENT_FORMAT_VERSION,
  FIELD_TICKS_PER_DAY,
  FieldSimulationRunner,
  LOCAL_CHECKPOINT_VERSION,
  WORLD_LEVEL,
  WORLD_FORMAT_VERSION,
  advanceWorldKernel,
  buildTransportGraph,
  createFieldState,
  createPlaceholderSnapshot,
  createSignatureCommandLog,
  deterministicVectorHash,
  explainFlow,
  generateWorld,
  getCell,
  invariantReport,
  populationAt,
  replayPlaceholder,
  restoreWorldKernel,
  serializeWorldKernel,
  simulatePlanetaryDay,
  type FictionalWorld,
  type LocalSnapshot,
} from "@ten-billion-lives/sim";
import {
  BrowserJourneyRenderer,
  adaptRenderQuality,
  createRenderScene,
  createTracerProjection,
  drawCanvasScene,
  selectInitialRenderQuality,
  type BrowserRendererStatus,
  type RenderQuality,
  type RenderScene,
} from "@ten-billion-lives/render";

import { createSmokeModel } from "./smoke";
import {
  CLOSURE_PERSON_ID,
  EXPERIENCE_MAX_TICK,
  EXPERIENCE_LINK_SCHEMA,
  FESTIVAL_PERSON_ID,
  buildExperienceLink,
  createExperienceKernel,
  parseExperienceLink,
  type ExperienceBranch,
  type ExperienceStage,
} from "./experience";

const stages = ["Planet", "Settlement", "Street", "Person"] as const;
const canonicalSettlementName = "Brindle Bay";
const canonicalStreetName = "Harbor Street";
const nextLabels = [
  "Enter Brindle Bay",
  "Enter Harbor Street",
  "Meet a resident",
];
const snapshotA = createPlaceholderSnapshot();
const world = generateWorld(BASELINE_WORLD_SEED);
const illusionEngine = createIllusionEngine(world);
const itineraryIndex = illusionEngine.itinerary;
const manifestationIndex = itineraryIndex.manifestation;
const defaultManifestationCellId =
  world.settlements[0]?.cellId ??
  (() => {
    throw new Error("Baseline world requires a manifestation settlement");
  })();
const defaultPersonId = manifestationIndex.personIdAt(
  defaultManifestationCellId,
  42n,
);
const fieldRunner = new FieldSimulationRunner(createFieldState(world));
const transportGraph = buildTransportGraph(world);
const baselinePlanetaryDay = simulatePlanetaryDay(world, []);
const planetaryDay = simulatePlanetaryDay(
  world,
  createSignatureCommandLog(transportGraph),
);
const baselineGenesisKernel = createExperienceKernel("baseline");
const closureGenesisKernel = createExperienceKernel("closure");
const kernelStates = {
  baseline: new Map([[0, baselineGenesisKernel]]),
  closure: new Map([[0, closureGenesisKernel]]),
};
const checkpointKernel = advanceWorldKernel(closureGenesisKernel, 13);
const checkpointBytes = serializeWorldKernel(checkpointKernel);
let stageIndex = 0;
let cameraDegrees = 0;
type ManifestedPerson = PersonCard &
  Readonly<{
    itinerary: PersonItineraryPoint;
    traceHash: string;
    relationshipSummary: string;
  }>;

let personA: ManifestedPerson | null = null;
let personB: ManifestedPerson | null = null;
let observerBEngine: IllusionEngine | null = null;
let selectedPersonId = defaultPersonId;
let activeBranch: ExperienceBranch = "baseline";
let personSearchError = "";
let shareStatus = "";
let replayResult = "Not run";
let fieldsRevealed = false;
let debugVisible = false;
let debugLevel: 2 | 3 | 5 = WORLD_LEVEL;
let selectedCellId = "L5/12/0";
let selectedDayTick = 7;
let selectedPersonTick = 10;
let checkpointResult = "Not restored";
let discoveryStatus = "";
let clockPlaying = false;
let clockRate: 1 | 6 | 24 = 1;
let clockTimer: ReturnType<typeof setInterval> | null = null;
let replayVerified = false;
let journeyRenderer: BrowserJourneyRenderer | null = null;
let journeyResizeObserver: ResizeObserver | null = null;
let journeyRenderGeneration = 0;
const renderSceneCache = new Map<string, RenderScene>();
const projectionCache = new WeakMap<
  IllusionEngine,
  Map<string, IllusionProjection>
>();
const forceCanvasRenderer =
  new URLSearchParams(location.search).get("renderer") === "canvas";
const requestedRenderQuality = new URLSearchParams(location.search).get(
  "quality",
);
const forcedRenderQuality: RenderQuality | null =
  requestedRenderQuality === "fallback" ||
  requestedRenderQuality === "baseline" ||
  requestedRenderQuality === "showcase"
    ? requestedRenderQuality
    : null;
const localDeviceMemory = (
  navigator as Navigator & { readonly deviceMemory?: number }
).deviceMemory;
const initialRenderQuality = selectInitialRenderQuality({
  logicalCores: navigator.hardwareConcurrency,
  deviceMemoryGiB: localDeviceMemory ?? null,
});
let renderQuality = forcedRenderQuality ?? initialRenderQuality.quality;
let renderQualityReason =
  forcedRenderQuality === null
    ? initialRenderQuality.reason
    : `local URL forces the ${forcedRenderQuality} visual tier`;
let sustainedFrameTimesMs: number[] = [];

function stageKey(stage: (typeof stages)[number]): ExperienceStage {
  return stage.toLowerCase() as ExperienceStage;
}

function stageLocationId(stage: (typeof stages)[number]): string {
  const settlement = world.settlements[0];
  if (settlement === undefined)
    throw new Error("Baseline world requires a local journey settlement");
  if (stage === "Planet") return "world";
  if (stage === "Settlement") return `settlement/${settlement.id}`;
  if (stage === "Street") return settlement.neighborhoodIds[0] ?? settlement.id;
  return manifestationIndex.person(selectedPersonId).cellId;
}

function kernelStateAt(tick: number, branch = activeBranch) {
  const states = kernelStates[branch];
  const cached = states.get(tick);
  if (cached !== undefined) return cached;
  const state = advanceWorldKernel(
    branch === "baseline" ? baselineGenesisKernel : closureGenesisKernel,
    tick,
  );
  states.set(tick, state);
  return state;
}

function projectionFor(
  engine: IllusionEngine,
  stage: (typeof stages)[number],
): IllusionProjection {
  const manifestationCellId =
    engine.manifestation.person(selectedPersonId).cellId;
  const regionId = world.cells.find(
    (cell) => cell.id === manifestationCellId,
  )?.regionId;
  if (regionId === undefined)
    throw new Error("Baseline manifestation region is unavailable");
  const state = kernelStateAt(selectedPersonTick);
  const cache = projectionCache.get(engine) ?? new Map();
  projectionCache.set(engine, cache);
  const key = `${stage}/${state.kernelHash}/${selectedPersonId}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const scopeCellIds =
    stage === "Planet"
      ? world.cells.map((cell) => cell.id)
      : stage === "Settlement"
        ? world.cells
            .filter((cell) => cell.regionId === regionId)
            .map((cell) => cell.id)
        : [manifestationCellId];
  const projection = engine.project(
    {
      state,
      tick: BigInt(selectedPersonTick),
      scopeCellIds,
      lod:
        stage === "Planet"
          ? "planet"
          : stage === "Settlement"
            ? "region"
            : stage === "Street"
              ? "street"
              : "person",
      selectedPersonIds: [selectedPersonId],
    },
    {
      observerId: engine === illusionEngine ? "observer-a" : "observer-b",
      cameraPath: `${stage.toLowerCase()}/${cameraDegrees}`,
      quality: "browser-detected",
    },
  );
  cache.set(key, projection);
  return projection;
}

type LocalRenderBenchmark = (
  width: number,
  height: number,
  frames: number,
  quality?: RenderQuality,
) => Readonly<{
  frameTimesMs: readonly number[];
  visibleCount: number;
  bufferBytes: number;
}>;

const biomeColors = {
  ocean: "#0d3441",
  tundra: "#9eb8ad",
  boreal: "#315b49",
  grassland: "#668750",
  woodland: "#326747",
  desert: "#a8864c",
  rainforest: "#176044",
} as const;

function renderSceneFor(
  stage: (typeof stages)[number],
  stateHash: string,
  selectionId: string,
  quality: RenderQuality,
): RenderScene {
  const renderStage: RenderScene["stage"] =
    stage === "Planet"
      ? "planet"
      : stage === "Settlement"
        ? "region"
        : stage === "Street"
          ? "street"
          : "person";
  const key = `${renderStage}/${stateHash}/${selectionId}/${quality}`;
  const cached = renderSceneCache.get(key);
  if (cached !== undefined) return cached;
  const scene = createRenderScene({
    worldSeed: world.seed,
    stateHash,
    selectionId,
    stage: renderStage,
    quality,
    viewport: { width: 768, height: 480 },
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
  renderSceneCache.set(key, scene);
  return scene;
}

function updateRenderDiagnostics(
  root: HTMLElement,
  status: BrowserRendererStatus,
): void {
  const backend = root.querySelector<HTMLElement>(
    "[data-testid=render-backend]",
  );
  const timing = root.querySelector<HTMLElement>(
    "[data-testid=render-frame-time]",
  );
  const losses = root.querySelector<HTMLElement>(
    "[data-testid=render-context-losses]",
  );
  const budgetTiming = root.querySelector<HTMLElement>(
    "[data-testid=budget-frame-time]",
  );
  const support = root.querySelector<HTMLElement>(
    "[data-testid=render-support]",
  );
  if (backend !== null) backend.textContent = status.backend;
  if (timing !== null) timing.textContent = `${status.frameMs.toFixed(2)} ms`;
  if (budgetTiming !== null)
    budgetTiming.textContent = `${status.frameMs.toFixed(2)} ms`;
  if (support !== null)
    support.textContent =
      status.backend === "webgpu"
        ? "WebGPU active; Canvas fallback ready"
        : "Canvas fallback active; the complete local journey remains available";
  if (losses !== null)
    losses.textContent = status.lifecycle.contextLosses.toString();
}

function applyAdaptiveRenderQuality(
  root: HTMLElement,
  status: BrowserRendererStatus,
): boolean {
  updateRenderDiagnostics(root, status);
  if (forcedRenderQuality !== null) return false;
  sustainedFrameTimesMs = [...sustainedFrameTimesMs, status.frameMs].slice(-8);
  const decision = adaptRenderQuality({
    quality: renderQuality,
    frameTimesMs: sustainedFrameTimesMs,
  });
  renderQualityReason = decision.reason;
  if (decision.quality === renderQuality) return false;
  renderQuality = decision.quality;
  sustainedFrameTimesMs = [];
  render(root);
  return true;
}

async function mountJourneyRenderer(
  root: HTMLElement,
  scene: RenderScene,
): Promise<void> {
  journeyResizeObserver?.disconnect();
  journeyRenderer?.destroy();
  const generation = ++journeyRenderGeneration;
  const fallbackCanvas = root.querySelector<HTMLCanvasElement>(
    "[data-render-surface=canvas2d]",
  );
  const gpuCanvas = root.querySelector<HTMLCanvasElement>(
    "[data-render-surface=webgpu]",
  );
  const stack = root.querySelector<HTMLElement>("[data-render-stack]");
  if (fallbackCanvas === null || gpuCanvas === null || stack === null) return;
  const renderer = new BrowserJourneyRenderer(
    { fallbackCanvas, gpuCanvas },
    scene.transition.durationMs === 0,
    forceCanvasRenderer,
  );
  journeyRenderer = renderer;
  const resize = (): BrowserRendererStatus | null => {
    const width = Math.max(320, Math.round(stack.clientWidth));
    const height = Math.max(240, Math.round(width * 0.625));
    return renderer.resize(width, height);
  };
  resize();
  const status = await renderer.initialize(scene);
  if (generation !== journeyRenderGeneration || !stack.isConnected) {
    renderer.destroy();
    return;
  }
  if (applyAdaptiveRenderQuality(root, status)) return;
  journeyResizeObserver = new ResizeObserver(() => {
    const resized = resize();
    if (resized !== null) applyAdaptiveRenderQuality(root, resized);
  });
  journeyResizeObserver.observe(stack);
}

function debugCellId(level: number, row: number, column: number): string {
  return `L${level}/${row}/${column}`;
}

function drawDebugWorld(
  canvas: HTMLCanvasElement,
  generatedWorld: FictionalWorld,
): void {
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Canvas2D debug globe unavailable");
  const rows = 2 ** debugLevel;
  const columns = 2 ** (debugLevel + 1);
  const cellWidth = canvas.width / columns;
  const cellHeight = canvas.height / rows;
  const leafScale = 2 ** (WORLD_LEVEL - debugLevel);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#071411";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const id = debugCellId(debugLevel, row, column);
      const leaf = getCell(
        generatedWorld,
        debugCellId(WORLD_LEVEL, row * leafScale, column * leafScale),
      );
      const population = populationAt(generatedWorld, id);
      const populationGlow = Math.min(
        0.58,
        Math.log10(Number(population) + 1) / 18,
      );
      context.fillStyle = biomeColors[leaf.biome];
      context.globalAlpha = leaf.land ? 0.72 + populationGlow : 0.86;
      context.fillRect(
        column * cellWidth,
        row * cellHeight,
        cellWidth + 0.5,
        cellHeight + 0.5,
      );
      context.globalAlpha = 1;
      if (debugLevel < WORLD_LEVEL || row % 4 === 0 || column % 4 === 0) {
        context.strokeStyle = "rgba(209, 241, 226, 0.18)";
        context.lineWidth = 0.7;
        context.strokeRect(
          column * cellWidth,
          row * cellHeight,
          cellWidth,
          cellHeight,
        );
      }
    }
  }

  const selected = getCell(generatedWorld, selectedCellId);
  const selectedRow = Math.floor(selected.row / leafScale);
  const selectedColumn = Math.floor(selected.column / leafScale);
  context.strokeStyle = "#fff0a8";
  context.lineWidth = 3;
  context.strokeRect(
    selectedColumn * cellWidth + 1.5,
    selectedRow * cellHeight + 1.5,
    Math.max(1, cellWidth - 3),
    Math.max(1, cellHeight - 3),
  );
  context.strokeStyle = "#e18a5d";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(1, 0);
  context.lineTo(1, canvas.height);
  context.moveTo(canvas.width - 1, 0);
  context.lineTo(canvas.width - 1, canvas.height);
  context.stroke();
}

function queryPerson(
  snapshot: LocalSnapshot,
  source: AnalyticalItineraryIndex = itineraryIndex,
  personId = selectedPersonId,
): ManifestedPerson {
  manifestPlaceholder({
    seed: snapshot.seed,
    checkpoint: snapshot,
    region: "brindle-bay/harbor-street",
    tick: snapshot.tick,
    lod: "person",
  });
  const card = source.manifestation.person(personId);
  const itinerary = source.queryPerson(
    card.personId,
    BigInt(selectedPersonTick),
    kernelStateAt(selectedPersonTick),
  );
  const relationships = source.manifestation.relationships(card.personId);
  const counts = new Map<string, number>();
  for (const relationship of relationships)
    counts.set(relationship.kind, (counts.get(relationship.kind) ?? 0) + 1);
  return Object.freeze({
    ...card,
    itinerary,
    traceHash: `trace-${itinerary.semanticHash.slice(0, 8)}`,
    relationshipSummary: Array.from(counts)
      .map(([kind, count]) => `${count} ${kind}`)
      .join(" · "),
  });
}

function personCard(
  person: ManifestedPerson | null,
  observer: "a" | "b",
  projection: IllusionProjection | null,
): string {
  if (person === null)
    return `<p class="observer-empty">Independent local view not yet at person LOD.</p>`;
  return `<dl class="person-facts">
    <div><dt>Person ID</dt><dd data-testid="observer-${observer}-person-id">${person.personId}</dd></div>
    <div><dt>Identity</dt><dd>${person.name} · age ${person.ageYears} · ${person.cohort} age band</dd></div>
    <div><dt>Now</dt><dd data-testid="observer-${observer}-itinerary">Tick ${person.itinerary.tick} · ${person.itinerary.activity}${person.itinerary.activity === "work" || person.itinerary.activity === "school" || person.itinerary.activity === "service" ? ` at ${person.primaryPlace.name}` : ""}</dd></div>
    <div><dt>Semantic location</dt><dd><code>${person.itinerary.location.semanticId}</code> · ${person.itinerary.location.positionPermille}‰</dd></div>
    <div><dt>Home / role</dt><dd data-testid="observer-${observer}-household-id">${person.home} · ${person.household.role} · <code>${person.household.id}</code> · ${person.household.memberCount} members</dd></div>
    <div><dt>Recurring place</dt><dd>${person.primaryPlace.name} · ${person.primaryPlace.memberCount}/${person.primaryPlace.capacity}</dd></div>
    <div><dt>Relationships</dt><dd>${person.relationshipSummary}</dd></div>
    <div><dt>Co-located encounters</dt><dd>${person.itinerary.encounters.length} known · <code>${person.itinerary.encounterGroupId}</code></dd></div>
    <div><dt>Field reconciliation</dt><dd>${person.itinerary.fieldMembership.channel} · ${person.itinerary.fieldMembership.channelPopulation.toLocaleString("en-US")} in home-cell channel</dd></div>
    <div><dt>Route / destination</dt><dd data-testid="observer-${observer}-route">${person.itinerary.route ? `${person.itinerary.route.mode} · ${person.itinerary.route.edgeIds.length} graph ${person.itinerary.route.edgeIds.length === 1 ? "edge" : "edges"} · ${person.itinerary.route.reason} → ${person.itinerary.route.destinationId}` : `stationary at ${person.itinerary.location.semanticId}`}</dd></div>
    <div><dt>Local semantic events</dt><dd data-testid="semantic-events-${observer}">${projection === null || projection.events.length === 0 ? "No selected local events" : projection.events.map((event) => `${event.kind} · ${event.locationId}`).join(" · ")}</dd></div>
    <div><dt>Appearance</dt><dd>${person.appearance.stature} · ${person.appearance.hair} hair · ${person.appearance.wardrobe} layers</dd></div>
    <div><dt>Semantic trace</dt><dd><code>${person.traceHash}</code></dd></div>
  </dl>`;
}

function synchronizeExperienceUrl(): void {
  const stage = stages[stageIndex] ?? "Planet";
  const href = buildExperienceLink(location.href, {
    schema: EXPERIENCE_LINK_SCHEMA,
    seed: BASELINE_WORLD_SEED,
    tick: selectedPersonTick,
    personId: selectedPersonId,
    branch: activeBranch,
    stage: stageKey(stage),
    locationId: stageLocationId(stage),
  });
  history.replaceState(null, "", href);
}

function refreshSelectedPeople(): void {
  if (personA !== null) personA = queryPerson(snapshotA);
  if (observerBEngine !== null && personB !== null)
    personB = queryPerson(
      createPlaceholderSnapshot(),
      observerBEngine.itinerary,
    );
}

function stopClock(): void {
  clockPlaying = false;
  if (clockTimer !== null) clearInterval(clockTimer);
  clockTimer = null;
}

function advanceLocalTime(root: HTMLElement, ticks: number): void {
  selectedPersonTick = (selectedPersonTick + ticks) % (EXPERIENCE_MAX_TICK + 1);
  selectedDayTick = selectedPersonTick % FIELD_TICKS_PER_DAY;
  replayVerified = false;
  replayResult = "Not run";
  refreshSelectedPeople();
  render(root);
}

function startClock(root: HTMLElement): void {
  if (clockTimer !== null) clearInterval(clockTimer);
  clockPlaying = true;
  clockTimer = setInterval(() => advanceLocalTime(root, clockRate), 1_000);
}

function discover(root: HTMLElement, requested: string): void {
  const query = requested.trim().toLocaleLowerCase("en-US");
  stopClock();
  if (query === "brindle bay" || query === "settlement") {
    stageIndex = 1;
    discoveryStatus = "Opened Brindle Bay settlement.";
  } else if (query === "harbor street" || query === "street") {
    stageIndex = 2;
    discoveryStatus = "Opened Harbor Street.";
  } else if (
    query === "lantern tide" ||
    query === "lantern confluence" ||
    query === "festival"
  ) {
    selectExperience(FESTIVAL_PERSON_ID, 19, "baseline");
    discoveryStatus = "Opened Lantern Tide at festival peak.";
  } else {
    discoveryStatus =
      "No local match. Try Brindle Bay, Harbor Street, or Lantern Tide.";
  }
  render(root);
}

function selectExperience(
  personId: string,
  tick: number,
  branch: ExperienceBranch,
): void {
  manifestationIndex.person(personId);
  selectedPersonId = personId;
  selectedPersonTick = tick;
  activeBranch = branch;
  stageIndex = stages.length - 1;
  personA = queryPerson(snapshotA);
  if (observerBEngine !== null)
    personB = queryPerson(
      createPlaceholderSnapshot(),
      observerBEngine.itinerary,
    );
  personSearchError = "";
  replayResult = "Not run";
  replayVerified = false;
}

function personTimeControls(): readonly (readonly [number, string])[] {
  if (selectedPersonId === FESTIVAL_PERSON_ID)
    return Object.freeze([
      [10, "recurring meeting"],
      [17, "festival arrival"],
      [19, "festival peak"],
      [21, "festival departure"],
      [22, "home"],
    ] as const);
  return Object.freeze([
    [0, "midnight"],
    [7, "commute"],
    [10, "primary activity"],
    [19, "festival hour"],
    [23, "sleep"],
    [24, "identity epoch"],
  ] as const);
}

function branchComparisonPanel(): string {
  const baselineState = kernelStateAt(7, "baseline");
  const closureState = kernelStateAt(7, "closure");
  const baselinePoint = itineraryIndex.queryPerson(
    CLOSURE_PERSON_ID,
    7n,
    baselineState,
  );
  const closurePoint = itineraryIndex.queryPerson(
    CLOSURE_PERSON_ID,
    7n,
    closureState,
  );
  const edgeId = planetaryDay.commands[0]?.edgeId;
  const baselineFlow = baselinePlanetaryDay.ticks[7]?.edgeFlows.find(
    (flow) => flow.edgeId === edgeId,
  );
  const closureFlow = planetaryDay.ticks[7]?.edgeFlows.find(
    (flow) => flow.edgeId === edgeId,
  );
  if (baselineFlow === undefined || closureFlow === undefined)
    throw new Error("Missing local intervention comparison");
  return `<section class="branch-comparison" aria-labelledby="branch-title"><div><p class="kicker">Reversible local scenario</p><h2 id="branch-title" data-testid="active-branch">${activeBranch === "baseline" ? "Immutable baseline" : "Closure branch"}</h2><p>The branch changes one scheduled route at tick 7. It never mutates the baseline checkpoint.</p></div><dl><div><dt>Baseline macro flow</dt><dd>${baselineFlow.count.toLocaleString("en-US")} on signature edge</dd></div><div><dt>Closure macro flow</dt><dd>${closureFlow.count.toLocaleString("en-US")} on closed edge</dd></div><div><dt>Baseline traveler route</dt><dd data-testid="baseline-route">${baselinePoint.route?.edgeIds.length ?? 0} edge</dd></div><div><dt>Closure traveler route</dt><dd data-testid="closure-route">${closurePoint.route?.edgeIds.length ?? 0} edges</dd></div><div><dt>Population fields</dt><dd class="valid" data-testid="branch-field-match">${baselineState.field.stateHash === closureState.field.stateHash ? "Identical field state" : "Unexpected field divergence"}</dd></div><div><dt>Branch event hash</dt><dd><code>${activeBranch === "baseline" ? baselineState.eventHash : closureState.eventHash}</code></dd></div></dl><div class="tracer-actions"><button type="button" data-action="closure-branch">Explore closure branch</button><button type="button" class="secondary" data-action="baseline-branch">View immutable baseline</button></div></section>`;
}

function transportDebugPanel(): string {
  const tick = planetaryDay.ticks[selectedDayTick];
  const signatureEdgeId = planetaryDay.commands[0]?.edgeId;
  const signatureFlow = tick?.edgeFlows.find(
    (flow) => flow.edgeId === signatureEdgeId,
  );
  if (tick === undefined || signatureFlow === undefined)
    throw new Error("Missing signature transport diagnostic");
  const flowTotals = planetaryDay.ticks.map((sample) =>
    sample.edgeFlows.reduce((sum, flow) => sum + flow.count, 0n),
  );
  const maximumFlow = flowTotals.reduce(
    (maximum, value) => (value > maximum ? value : maximum),
    1n,
  );
  const points = (values: readonly bigint[], maximum: bigint): string =>
    values
      .map((value, index) => {
        const x = 24 + (index * 720) / 23;
        const y = 170 - (Number(value) / Number(maximum)) * 130;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  const markerX = 24 + (selectedDayTick * 720) / 23;
  const bottlenecks = tick.edgeFlows.filter(
    (flow) => flow.bottleneck && !flow.closed,
  );
  const activities = Object.entries(tick.activityTotals)
    .map(([name, count]) => `${name} ${count.toLocaleString("en-US")}`)
    .join(" · ");
  return `<article class="transport-debug" aria-labelledby="transport-debug-title"><div class="field-debug-heading"><div><p class="kicker">Representative planetary day</p><h2 id="transport-debug-title">Tick <span data-testid="transport-tick">${tick.tick}</span> · <code data-testid="planetary-day-hash">${planetaryDay.dayHash}</code></h2></div><div class="debug-controls"><button type="button" class="secondary" data-day-tick="7">Tick 7 · closure</button><button type="button" class="secondary" data-day-tick="9">Tick 9 · reopened</button><button type="button" class="secondary" data-day-tick="19">Tick 19 · festival</button></div></div><svg class="day-chart" viewBox="0 0 768 200" role="img" aria-label="Full-day aggregate movement and festival attendance"><line x1="24" y1="170" x2="744" y2="170"></line><line x1="24" y1="105" x2="744" y2="105"></line><line x1="24" y1="40" x2="744" y2="40"></line><polyline class="movement-line" points="${points(flowTotals, maximumFlow)}"></polyline><polyline class="festival-line" points="${points(
    planetaryDay.ticks.map((sample) => sample.festivalAttendance),
    planetaryDay.graph.festival.peakAttendance,
  )}"></polyline><line class="tick-marker" x1="${markerX}" y1="28" x2="${markerX}" y2="176"></line><text x="24" y="193">00</text><text x="205" y="193">06</text><text x="393" y="193">12</text><text x="581" y="193">18</text><text x="728" y="193">23</text></svg><div class="chart-legend"><span class="movement">aggregate movement</span><span class="festival">festival attendance</span><span>vertical marker: selected tick</span></div><dl class="field-channels"><div><dt>Cohort activity reconciliation</dt><dd>${activities}</dd></div><div><dt>Festival</dt><dd>${planetaryDay.graph.festival.name} · ${tick.festivalAttendance.toLocaleString("en-US")} attending from ${tick.festivalOrigins.length} surrounding regions</dd></div><div><dt>Signature route</dt><dd data-testid="signature-route">${signatureFlow.closed ? "Closed" : "Open"} · ${signatureFlow.count.toLocaleString("en-US")} / ${signatureFlow.capacity.toLocaleString("en-US")}</dd></div><div><dt>Bottlenecks</dt><dd>${bottlenecks.length.toLocaleString("en-US")} capacity-limited edges at regional/globe LOD</dd></div><div class="flow-explanation"><dt>Why this flow?</dt><dd data-testid="flow-explanation">${explainFlow(planetaryDay, selectedDayTick, signatureFlow.edgeId)}</dd></div><div><dt>Invariant failures</dt><dd class="valid">${tick.invariantIssues.length === 0 ? "None — activities and routes valid" : tick.invariantIssues.join("; ")}</dd></div></dl></article><article class="checkpoint-debug" aria-labelledby="checkpoint-debug-title"><div><p class="kicker">Local checkpoint round-trip</p><h2 id="checkpoint-debug-title">Tick 13 · <code data-testid="kernel-hash">${checkpointKernel.kernelHash}</code></h2></div><dl class="field-channels"><div><dt>Frozen formats</dt><dd>world ${WORLD_FORMAT_VERSION} · events ${EVENT_FORMAT_VERSION} · checkpoint ${LOCAL_CHECKPOINT_VERSION}</dd></div><div><dt>Event hash</dt><dd><code data-testid="event-hash">${checkpointKernel.eventHash}</code></dd></div><div><dt>Canonical snapshot</dt><dd>${checkpointBytes.length.toLocaleString("en-US")} bytes · local UTF-8 JSON</dd></div><div><dt>Restore result</dt><dd class="${checkpointResult === "Not restored" ? "" : "valid"}" data-testid="checkpoint-result">${checkpointResult}</dd></div></dl><button type="button" data-action="checkpoint-restore">Save and restore checkpoint</button></article>`;
}

function render(root: HTMLElement): void {
  const smoke = createSmokeModel();
  const stage = stages[stageIndex] ?? "Planet";
  synchronizeExperienceUrl();
  const nextLabel = nextLabels[stageIndex];
  const currentKernel = kernelStateAt(selectedPersonTick);
  const authorityBytes = serializeWorldKernel(currentKernel).length;
  const localHour = selectedPersonTick % FIELD_TICKS_PER_DAY;
  const localDay = Math.floor(selectedPersonTick / FIELD_TICKS_PER_DAY);
  const experienceMode =
    activeBranch === "closure"
      ? "Local closure branch"
      : replayVerified
        ? "Immutable baseline · replay verified"
        : "Immutable baseline";
  const semanticProjectionA = projectionFor(illusionEngine, stage);
  const semanticProjectionB =
    observerBEngine === null ? null : projectionFor(observerBEngine, stage);
  const semanticMatch =
    personA !== null &&
    personB !== null &&
    personA.personId === personB.personId &&
    personA.traceHash === personB.traceHash &&
    semanticProjectionB !== null &&
    semanticProjectionA.manifestationHash ===
      semanticProjectionB.manifestationHash &&
    semanticProjectionA.eventHash === semanticProjectionB.eventHash;
  const tracerProjection = createTracerProjection({
    stage: stage.toLowerCase() as "planet" | "settlement" | "street" | "person",
    stateHash: currentKernel.kernelHash,
    ...(personA ? { traceHash: personA.traceHash } : {}),
  });
  const renderScene = renderSceneFor(
    stage,
    semanticProjectionA.manifestationHash,
    selectedPersonId,
    renderQuality,
  );
  const personLink = buildExperienceLink(location.href, {
    schema: EXPERIENCE_LINK_SCHEMA,
    seed: BASELINE_WORLD_SEED,
    tick: selectedPersonTick,
    personId: selectedPersonId,
    branch: activeBranch,
    stage: "person",
    locationId: manifestationIndex.person(selectedPersonId).cellId,
  }).replaceAll("&", "&amp;");
  const cameraShift = Math.sin((cameraDegrees * Math.PI) / 180) * 8;
  const selectedCell = getCell(world, selectedCellId);
  const fieldState = fieldRunner.state;
  const selectedFieldCell = fieldState.cells.find(
    (cell) => cell.cellId === selectedCellId,
  );
  if (selectedFieldCell === undefined)
    throw new Error(`Missing field cell ${selectedCellId}`);
  const fieldInvariant = invariantReport(fieldState);
  const selectedFluxes = fieldState.lastFluxes.filter(
    (flux) =>
      flux.sourceCellId === selectedCellId ||
      flux.destinationCellId === selectedCellId,
  );
  const selectedParent = selectedCellId.replace(
    /^L5\/(\d+)\/(\d+)$/,
    (_match, row: string, column: string) =>
      `L4/${Math.floor(Number(row) / 2)}/${Math.floor(Number(column) / 2)}`,
  );

  root.innerHTML = `<main class="observatory" aria-labelledby="app-title">
    <header class="tracer-header"><div><p class="eyebrow"><span aria-hidden="true"></span> Local deterministic observatory</p><h1 id="app-title">Ten Billion Lives</h1><p class="first-run-claim" data-testid="first-run-claim">One fictional planet, exactly <strong>${world.totalPopulation.toLocaleString("en-US")} represented lives</strong>, and no table of people. Zoom in to reconstruct one coherent life from compact fields.</p></div><div class="header-status"><div class="status" data-testid="smoke-status"><span aria-hidden="true"></span>${smoke.status}</div><p data-testid="render-support" role="status">Checking WebGPU; Canvas fallback is ready</p></div></header>
    <section class="command-deck" aria-label="Local observatory controls"><article class="time-console"><div><p class="kicker">Local world time</p><h2 data-testid="time-status">${clockPlaying ? `Playing · ${clockRate}×` : "Paused"} · day ${localDay} · ${localHour.toString().padStart(2, "0")}:00</h2><p>Analytical time queries change semantic tick; camera motion never does.</p></div><div class="time-actions"><button type="button" data-action="clock-toggle">${clockPlaying ? "Pause local time" : "Play local time"}</button><button type="button" class="secondary" data-action="clock-step">Advance one tick</button>${([1, 6, 24] as const).map((rate) => `<button type="button" class="secondary" data-clock-rate="${rate}" aria-label="Set speed ${rate}×" aria-pressed="${clockRate === rate}">${rate}×</button>`).join("")}</div></article><article class="discovery-console"><div><p class="kicker">Find a place or event</p><h2>Go somewhere meaningful</h2><p>Search the small canonical guide; no remote index or network request is used.</p></div><form role="search" aria-label="Place and event discovery" data-discovery-search><label for="discovery-search">Find a place or event</label><div class="search-row"><input id="discovery-search" type="search" name="discovery" autocomplete="off"><button type="submit">Open</button></div><p class="discovery-status" data-testid="discovery-status" role="status">${discoveryStatus}</p></form><div class="discovery-shortcuts" aria-label="Suggested destinations"><button type="button" class="secondary" data-discover="Brindle Bay">Brindle Bay</button><button type="button" class="secondary" data-discover="Harbor Street">Harbor Street</button><button type="button" class="secondary" data-discover="Lantern Tide">Lantern Tide festival</button></div></article></section>
    <section class="tracer-world" aria-labelledby="journey-title">
      <div class="journey-renderer ${tracerProjection.cssStage}" style="--camera-shift: ${cameraShift.toFixed(2)}px" data-render-stack data-projection-key="${semanticProjectionA.manifestationHash}" data-selection-id="${renderScene.selectionId}" data-camera-degrees="${cameraDegrees}" data-transition-ms="${renderScene.transition.durationMs}" data-testid="journey-renderer" ${stage === "Street" ? 'role="button" tabindex="0" aria-label="Inspect highlighted resident"' : ""}><canvas width="768" height="480" data-render-surface="canvas2d" aria-label="${stage} Canvas fallback visualization"></canvas><canvas width="768" height="480" data-render-surface="webgpu" aria-label="${stage} WebGPU visualization" hidden></canvas><div class="render-hud"><span><b data-testid="render-backend">probing</b> · <b data-testid="render-quality">${renderQuality}</b> quality · <b data-testid="render-visible">${renderScene.draw.visibleCount.toLocaleString("en-US")}</b> visible · weights ${renderScene.debug.minimumTokenWeight}–${renderScene.debug.maximumTokenWeight}</span><span><b data-testid="render-frame-time">pending</b> · ${(renderScene.buffer.byteLength / 1_048_576).toFixed(2)} MiB · <code>${renderScene.debug.bufferHash.slice(0, 8)}</code> · losses <b data-testid="render-context-losses">0</b></span></div></div>
      <div class="journey-copy"><p class="kicker">Observer A · <span data-testid="observer-a-stage">${stage}</span></p><p class="journey-progress" data-testid="journey-progress">${stage} · step ${stageIndex + 1} of ${stages.length}</p><h2 id="journey-title">${stage === "Planet" ? "Seeded fictional planet" : stage === "Settlement" ? canonicalSettlementName : stage === "Street" ? canonicalStreetName : (personA?.name ?? "Resident")}</h2><p>${stage === "Planet" ? "Start at the whole field; each closer view is a deterministic query, not another simulation." : stage === "Settlement" ? "One conserved region becomes legible without changing the world beneath it." : stage === "Street" ? "Weighted manifestations resolve locally; choose the highlighted resident to continue." : "This identity, household, itinerary, and events are reconstructed on demand."}</p><p>Camera ${cameraDegrees}° · tick <span data-testid="person-tick">${selectedPersonTick}</span> · <code data-testid="state-hash">${currentKernel.kernelHash}</code></p>
      <p class="branch-label">Viewing <strong data-testid="experience-mode">${experienceMode}</strong></p><div class="tracer-actions">${nextLabel ? `<button type="button" data-action="next">${nextLabel}</button>` : ""}<button type="button" data-action="festival">Visit Lantern Tide</button><button type="button" class="secondary" data-action="camera">Orbit camera</button>${personA ? stages.map((candidate, index) => `<button type="button" class="secondary" data-stage-index="${index}" aria-pressed="${stage === candidate}">View ${candidate.toLowerCase()}</button>`).join("") : ""}</div></div>
    </section>
    <section class="observer-grid" aria-label="Independent observer comparison">
      <article><p class="kicker">Observer A</p><h2>${personA?.name ?? "Journey in progress"}</h2><p class="projection-hashes">Manifestation <code data-testid="manifestation-hash-a">${semanticProjectionA.manifestationHash}</code><br>Events <code data-testid="projection-event-hash-a">${semanticProjectionA.eventHash}</code></p>${personCard(personA, "a", semanticProjectionA)}</article>
      <article><p class="kicker">Observer B · independent instance</p><h2>${personB?.name ?? "Not initialized"}</h2>${semanticProjectionB ? `<p class="projection-hashes">Manifestation <code data-testid="manifestation-hash-b">${semanticProjectionB.manifestationHash}</code><br>Events <code data-testid="projection-event-hash-b">${semanticProjectionB.eventHash}</code></p>` : ""}${personCard(personB, "b", semanticProjectionB)}${personA && !personB ? '<button type="button" data-action="observer-b">Initialize observer B</button>' : ""}${semanticMatch ? '<p class="match" data-testid="observer-match">Semantic match</p>' : ""}</article>
    </section>
    <section class="person-tools" aria-labelledby="person-tools-title"><div><p class="kicker">Find and share a represented life</p><h2 id="person-tools-title">Procedural identity, not a stored agent</h2><p id="experience-claim" data-testid="experience-claim">Each selected life is represented from compact fields—not an independently simulated mind. Facts are reconstructed from the same seed, snapshot, tick, and branch.</p></div><form role="search" aria-label="Procedural person search" data-person-search><label for="person-search">Procedural person ID</label><div class="search-row"><input id="person-search" name="person" type="search" value="${selectedPersonId}" aria-describedby="person-search-error"><button type="submit">Inspect person</button></div><p id="person-search-error" class="form-error" role="alert">${personSearchError}</p></form>${personA ? `<div class="share-row"><a data-testid="person-deep-link" href="${personLink}">Open this person at tick ${selectedPersonTick}</a><button type="button" class="secondary" data-action="copy-link">Copy local link</button><span role="status">${shareStatus}</span></div>` : ""}</section>
    ${
      personA
        ? `<section class="trace-controls" aria-label="Analytical person time"><p><strong>Follow through the day</strong> · direct random access, no resident stepping or promoted agent</p>${personTimeControls()
            .map(
              ([tick, label]) =>
                `<button type="button" class="secondary" data-person-tick="${tick}" aria-pressed="${selectedPersonTick === tick}">Tick ${tick} · ${label}</button>`,
            )
            .join("")}</section>`
        : ""
    }
    ${branchComparisonPanel()}
    <section class="trace-controls" aria-label="Replay and field controls"><button type="button" data-action="replay" ${personA ? "" : "disabled"}>Rewind and replay</button><p data-testid="replay-result">${replayResult}</p><button type="button" class="secondary" data-action="fields">Reveal fields</button><button type="button" class="secondary" data-action="render-loss">Simulate renderer loss</button><button type="button" class="secondary" data-action="debug" aria-expanded="${debugVisible}">${debugVisible ? "Hide debug world" : "Inspect debug world"}</button></section>
    <section class="reality-budget ${fieldsRevealed ? "revealed" : ""}" data-testid="reality-budget" aria-live="polite"><div><p class="kicker">Reality budget · ${fieldsRevealed ? "field revealed" : "reveal available"}</p><h2><span data-testid="represented-population">${world.totalPopulation.toLocaleString("en-US")}</span> represented lives</h2><p>Authoritative integers stay compact; visible people are weighted, disposable projections.</p></div><dl><div><dt>Authority</dt><dd data-testid="authority-bytes">${world.cells.length.toLocaleString("en-US")} integer cells · ${authorityBytes.toLocaleString("en-US")} checkpoint bytes</dd></div><div><dt>Stored people</dt><dd>0 person rows</dd></div><div><dt>Visible / represented</dt><dd data-testid="budget-visible">${renderScene.draw.visibleCount.toLocaleString("en-US")} tokens · weights ${renderScene.debug.minimumTokenWeight}–${renderScene.debug.maximumTokenWeight} · <span data-testid="projection-represented">${semanticProjectionA.realityBudget.representedPeople.toLocaleString("en-US")}</span> people → <span data-testid="projection-tokens">${semanticProjectionA.realityBudget.materializedTokens.toLocaleString("en-US")}</span> projected tokens</dd></div><div><dt>Derived projection</dt><dd>${semanticProjectionA.realityBudget.estimatedBytes.toLocaleString("en-US")} bytes · epoch ${semanticProjectionA.identityEpoch} / ${semanticProjectionA.realityBudget.continuityHorizonTicks} ticks</dd></div><div><dt>Tick / state hash</dt><dd><span data-testid="budget-tick">${selectedPersonTick}</span> · <code data-testid="budget-state-hash">${currentKernel.kernelHash}</code></dd></div><div><dt>Event hash</dt><dd><code data-testid="budget-event-hash">${semanticProjectionA.eventHash}</code> · ${semanticProjectionA.events.length} local events</dd></div><div><dt>Frame / backend</dt><dd><span data-testid="budget-frame-time">pending</span> · ${forceCanvasRenderer ? "Canvas forced" : "automatic backend"} · ${renderQualityReason}</dd></div><div><dt>Observer contract</dt><dd>${semanticProjectionA.realityBudget.samplingContract}; camera and GPU quality excluded from hashes</dd></div></dl></section>
    ${debugVisible ? `<section class="debug-world" aria-labelledby="debug-title"><div class="debug-heading"><div><p class="kicker">Seeded semantic atlas</p><h2 id="debug-title">Debug globe · L${debugLevel}</h2><p>Fictional geography; orange edges are the wrapped seam. Cell population brightens land.</p></div><div class="debug-controls" aria-label="Debug world level"><button type="button" class="secondary" data-debug-level="2" aria-pressed="${debugLevel === 2}">L2 regions</button><button type="button" class="secondary" data-debug-level="3" aria-pressed="${debugLevel === 3}">L3</button><button type="button" class="secondary" data-debug-level="5" aria-pressed="${debugLevel === 5}">L5 cells</button></div></div><canvas width="768" height="384" data-testid="debug-globe" aria-label="Fictional world cell map" aria-describedby="debug-cell-details">A deterministic map of fictional geography and population.</canvas><div class="debug-inspector" id="debug-cell-details"><div><dt>Selected cell</dt><dd data-testid="debug-cell-id">${selectedCell.id}</dd></div><div><dt>Hierarchy</dt><dd>${selectedParent} → ${selectedCell.id}</dd></div><div><dt>Geography</dt><dd>${selectedCell.biome} · ${selectedCell.elevationMeters.toLocaleString("en-US")} m</dd></div><div><dt>Population</dt><dd>${selectedCell.population.toLocaleString("en-US")}</dd></div><div><dt>Region</dt><dd>${selectedCell.regionId}</dd></div></div><div class="debug-probes"><button type="button" data-debug-cell="L5/12/0">Inspect seam</button><button type="button" data-debug-cell="L5/0/3">Inspect north pole</button></div><article class="field-debug" aria-labelledby="field-debug-title"><div class="field-debug-heading"><div><p class="kicker">Conservative field simulation</p><h2 id="field-debug-title">Tick <span data-testid="field-tick">${fieldState.tick}</span> · <code data-testid="field-hash">${fieldState.stateHash}</code></h2></div><div class="debug-controls"><button type="button" data-action="field-step">Single-step</button><button type="button" class="secondary" data-action="field-day">Advance one day</button></div></div><dl class="field-channels"><div><dt>Resident cohorts</dt><dd>${selectedFieldCell.cohorts.young.toLocaleString("en-US")} young · ${selectedFieldCell.cohorts.adult.toLocaleString("en-US")} adult · ${selectedFieldCell.cohorts.older.toLocaleString("en-US")} older</dd></div><div><dt>Activity channels</dt><dd>sleep ${selectedFieldCell.activities.sleep.toLocaleString("en-US")} · home ${selectedFieldCell.activities.home.toLocaleString("en-US")} · work ${selectedFieldCell.activities.work.toLocaleString("en-US")} · transit ${selectedFieldCell.activities.transit.toLocaleString("en-US")} · community ${selectedFieldCell.activities.community.toLocaleString("en-US")}</dd></div><div><dt>Capacity / amenity</dt><dd>${selectedFieldCell.capacityPermille}‰ / ${selectedFieldCell.amenityPermille}‰ · demand ${selectedFieldCell.flowDemand.toLocaleString("en-US")}</dd></div><div><dt>Sparse active regions</dt><dd>${fieldState.activeCellIds.length}</dd></div><div><dt>Flux ledger</dt><dd>${fieldState.lastFluxes.length.toLocaleString("en-US")} transfers; ${selectedFluxes.length} touch this cell${selectedFluxes[0] ? ` · #${selectedFluxes[0].processingOrder} ${selectedFluxes[0].sourceCellId} → ${selectedFluxes[0].destinationCellId} (${selectedFluxes[0].count.toLocaleString("en-US")})` : ""}</dd></div><div><dt>Invariant failures</dt><dd class="${fieldInvariant.valid ? "valid" : "invalid"}" data-testid="field-invariants">${fieldInvariant.valid ? "None — exact conservation" : fieldInvariant.issues.join("; ")}</dd></div></dl></article>${transportDebugPanel()}</section>` : ""}
    <footer><span>World seed <code>${world.seed}</code> · hash <code data-testid="world-hash">${world.worldHash}</code> · vectors <code data-testid="deterministic-vector-hash">${deterministicVectorHash()}</code></span><span>Run <code>pnpm check</code> from the repository root if a diagnostic fails.</span></footer>
  </main>`;

  root.querySelector('[data-action="next"]')?.addEventListener("click", () => {
    stopClock();
    stageIndex = Math.min(stageIndex + 1, stages.length - 1);
    if (stages[stageIndex] === "Person") personA = queryPerson(snapshotA);
    render(root);
  });
  const journeySurface = root.querySelector<HTMLElement>(
    "[data-testid=journey-renderer][role=button]",
  );
  const inspectHighlighted = (): void => {
    selectExperience(selectedPersonId, selectedPersonTick, activeBranch);
    render(root);
  };
  journeySurface?.addEventListener("click", inspectHighlighted);
  journeySurface?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inspectHighlighted();
    }
  });
  root
    .querySelector('[data-action="festival"]')
    ?.addEventListener("click", () => {
      stopClock();
      selectExperience(FESTIVAL_PERSON_ID, 19, "baseline");
      render(root);
    });
  root
    .querySelector('[data-action="camera"]')
    ?.addEventListener("click", () => {
      cameraDegrees = (cameraDegrees + 45) % 360;
      render(root);
    });
  root
    .querySelector('[data-action="observer-b"]')
    ?.addEventListener("click", () => {
      observerBEngine = createIllusionEngine(world);
      personB = queryPerson(
        createPlaceholderSnapshot(),
        observerBEngine.itinerary,
      );
      render(root);
    });
  root
    .querySelector('[data-action="clock-toggle"]')
    ?.addEventListener("click", () => {
      if (clockPlaying) stopClock();
      else startClock(root);
      render(root);
    });
  root
    .querySelector('[data-action="clock-step"]')
    ?.addEventListener("click", () => {
      stopClock();
      advanceLocalTime(root, 1);
    });
  for (const control of root.querySelectorAll<HTMLButtonElement>(
    "[data-clock-rate]",
  )) {
    control.addEventListener("click", () => {
      const requested = Number(control.dataset["clockRate"]);
      if (requested !== 1 && requested !== 6 && requested !== 24) return;
      clockRate = requested;
      if (clockPlaying) startClock(root);
      render(root);
    });
  }
  root
    .querySelector<HTMLFormElement>("[data-discovery-search]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!(form instanceof HTMLFormElement)) return;
      discover(root, String(new FormData(form).get("discovery") ?? ""));
    });
  for (const control of root.querySelectorAll<HTMLButtonElement>(
    "[data-discover]",
  )) {
    control.addEventListener("click", () =>
      discover(root, control.dataset["discover"] ?? ""),
    );
  }
  root
    .querySelector<HTMLFormElement>("[data-person-search]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!(form instanceof HTMLFormElement)) return;
      const data = new FormData(form);
      const requested = String(data.get("person") ?? "").trim();
      try {
        manifestationIndex.person(requested);
        selectExperience(requested, selectedPersonTick, activeBranch);
      } catch {
        personSearchError =
          "That person ID is not valid for this baseline seed. No state changed.";
      }
      render(root);
    });
  root
    .querySelector('[data-action="copy-link"]')
    ?.addEventListener("click", () => {
      const href = buildExperienceLink(location.href, {
        schema: EXPERIENCE_LINK_SCHEMA,
        seed: BASELINE_WORLD_SEED,
        tick: selectedPersonTick,
        personId: selectedPersonId,
        branch: activeBranch,
        stage: "person",
        locationId: manifestationIndex.person(selectedPersonId).cellId,
      });
      void navigator.clipboard
        .writeText(href)
        .then(() => {
          shareStatus = "Link copied";
          render(root);
        })
        .catch(() => {
          shareStatus = "Copy unavailable; open the link directly";
          render(root);
        });
    });
  root
    .querySelector('[data-action="closure-branch"]')
    ?.addEventListener("click", () => {
      stopClock();
      selectExperience(CLOSURE_PERSON_ID, 7, "closure");
      render(root);
    });
  root
    .querySelector('[data-action="baseline-branch"]')
    ?.addEventListener("click", () => {
      stopClock();
      selectExperience(CLOSURE_PERSON_ID, 7, "baseline");
      render(root);
    });
  root
    .querySelector('[data-action="replay"]')
    ?.addEventListener("click", () => {
      stopClock();
      personA = queryPerson(replayPlaceholder(snapshotA, 0));
      replayResult = `${personA.traceHash} restored`;
      replayVerified = true;
      render(root);
    });
  root
    .querySelector('[data-action="fields"]')
    ?.addEventListener("click", () => {
      fieldsRevealed = true;
      render(root);
    });
  root.querySelector('[data-action="debug"]')?.addEventListener("click", () => {
    debugVisible = !debugVisible;
    render(root);
  });
  root
    .querySelector('[data-action="render-loss"]')
    ?.addEventListener("click", () => {
      const status = journeyRenderer?.simulateContextLoss();
      if (status !== null && status !== undefined)
        updateRenderDiagnostics(root, status);
    });
  root
    .querySelector('[data-action="field-step"]')
    ?.addEventListener("click", () => {
      fieldRunner.singleStep();
      render(root);
    });
  root
    .querySelector('[data-action="field-day"]')
    ?.addEventListener("click", () => {
      fieldRunner.setRate(FIELD_TICKS_PER_DAY);
      fieldRunner.play();
      fieldRunner.advanceFakeTicks(1);
      fieldRunner.pause();
      render(root);
    });
  root
    .querySelector('[data-action="checkpoint-restore"]')
    ?.addEventListener("click", () => {
      const restored = restoreWorldKernel(checkpointBytes);
      checkpointResult = `${restored.kernelHash} restored from ${checkpointBytes.length.toLocaleString("en-US")} bytes`;
      render(root);
    });
  for (const control of root.querySelectorAll<HTMLButtonElement>(
    "[data-stage-index]",
  )) {
    control.addEventListener("click", () => {
      stopClock();
      const requested = Number(control.dataset["stageIndex"]);
      if (
        Number.isSafeInteger(requested) &&
        requested >= 0 &&
        requested < stages.length
      )
        stageIndex = requested;
      if (stages[stageIndex] === "Person" && personA === null)
        personA = queryPerson(snapshotA);
      render(root);
    });
  }
  for (const control of root.querySelectorAll<HTMLButtonElement>(
    "[data-debug-level]",
  )) {
    control.addEventListener("click", () => {
      const requested = Number(control.dataset["debugLevel"]);
      if (requested === 2 || requested === 3 || requested === 5)
        debugLevel = requested;
      render(root);
    });
  }
  for (const control of root.querySelectorAll<HTMLButtonElement>(
    "[data-debug-cell]",
  )) {
    control.addEventListener("click", () => {
      selectedCellId = control.dataset["debugCell"] ?? selectedCellId;
      render(root);
    });
  }
  for (const control of root.querySelectorAll<HTMLButtonElement>(
    "[data-day-tick]",
  )) {
    control.addEventListener("click", () => {
      selectedDayTick = Number(control.dataset["dayTick"]);
      render(root);
    });
  }
  for (const control of root.querySelectorAll<HTMLButtonElement>(
    "[data-person-tick]",
  )) {
    control.addEventListener("click", () => {
      stopClock();
      selectedPersonTick = Number(control.dataset["personTick"]);
      personA = queryPerson(snapshotA);
      if (observerBEngine !== null)
        personB = queryPerson(
          createPlaceholderSnapshot(),
          observerBEngine.itinerary,
        );
      replayResult = "Not run";
      replayVerified = false;
      render(root);
    });
  }
  const canvas = root.querySelector<HTMLCanvasElement>(
    "[data-testid=debug-globe]",
  );
  if (canvas !== null) {
    drawDebugWorld(canvas, world);
    canvas.addEventListener("click", (event) => {
      const bounds = canvas.getBoundingClientRect();
      const row = Math.min(
        world.rows - 1,
        Math.floor(((event.clientY - bounds.top) / bounds.height) * world.rows),
      );
      const column = Math.min(
        world.columns - 1,
        Math.floor(
          ((event.clientX - bounds.left) / bounds.width) * world.columns,
        ),
      );
      selectedCellId = debugCellId(WORLD_LEVEL, row, column);
      render(root);
    });
  }
  void mountJourneyRenderer(root, renderScene);
}

const root = document.querySelector<HTMLElement>("#app");
if (root === null) throw new Error("Missing #app mount point");
(
  window as Window & { __tenBillionRenderBenchmark?: LocalRenderBenchmark }
).__tenBillionRenderBenchmark = (
  width,
  height,
  frames,
  quality = renderQuality,
) => {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    !Number.isSafeInteger(frames) ||
    width <= 0 ||
    height <= 0 ||
    frames <= 0 ||
    frames > 120
  )
    throw new RangeError("invalid local render benchmark workload");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const scene = createRenderScene({
    worldSeed: world.seed,
    stateHash: snapshotA.stateHash,
    selectionId: selectedPersonId,
    stage: "street",
    quality,
    viewport: { width, height },
    reducedMotion: true,
  });
  const frameTimesMs = Array.from({ length: frames }, () =>
    drawCanvasScene(canvas, scene),
  );
  return Object.freeze({
    frameTimesMs: Object.freeze(frameTimesMs),
    visibleCount: scene.draw.visibleCount,
    bufferBytes: scene.buffer.byteLength,
  });
};
const deepLink = parseExperienceLink(location.search, manifestationIndex);
if (!deepLink.ok) {
  root.innerHTML = `<main class="smoke-error"><p class="kicker">Local link recovery</p><h1>Incompatible local link</h1><p role="alert">${deepLink.message}</p><p><a class="button-link" href="${location.pathname}">Return to baseline</a></p></main>`;
} else {
  try {
    if (deepLink.value !== null) {
      selectExperience(
        deepLink.value.personId,
        deepLink.value.tick,
        deepLink.value.branch,
      );
      const requestedStage = stages.findIndex(
        (stage) => stageKey(stage) === deepLink.value?.stage,
      );
      if (requestedStage < 0) throw new Error("Unknown local journey stage");
      stageIndex = requestedStage;
      const stage = stages[stageIndex] ?? "Planet";
      if (deepLink.value.locationId !== stageLocationId(stage))
        throw new Error(
          "Local link location does not match this baseline view",
        );
      if (stage !== "Person") personA = null;
    }
    render(root);
  } catch (error: unknown) {
    const reason =
      error instanceof Error ? error.message : "Unknown startup error";
    root.innerHTML = `<main class="smoke-error" role="alert"><h1>Local smoke failed</h1><p>${reason}</p><p>Run <code>pnpm check</code> from the repository root, then reload.</p></main>`;
  }
}
