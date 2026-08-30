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
  createWorldKernel,
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
  createRenderScene,
  createTracerProjection,
  drawCanvasScene,
  type BrowserRendererStatus,
  type RenderScene,
} from "@ten-billion-lives/render";

import { createSmokeModel } from "./smoke";

const stages = ["Planet", "Settlement", "Street", "Person"] as const;
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
const manifestationCellId =
  world.settlements[0]?.cellId ??
  (() => {
    throw new Error("Baseline world requires a manifestation settlement");
  })();
const manifestationPersonId = manifestationIndex.personIdAt(
  manifestationCellId,
  42n,
);
const fieldRunner = new FieldSimulationRunner(createFieldState(world));
const transportGraph = buildTransportGraph(world);
const planetaryDay = simulatePlanetaryDay(
  world,
  createSignatureCommandLog(transportGraph),
);
const genesisKernel = createWorldKernel();
const kernelStates = new Map([[0, genesisKernel]]);
const checkpointKernel = advanceWorldKernel(genesisKernel, 13);
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
let replayResult = "Not run";
let fieldsRevealed = false;
let debugVisible = false;
let debugLevel: 2 | 3 | 5 = WORLD_LEVEL;
let selectedCellId = "L5/12/0";
let selectedDayTick = 7;
let selectedPersonTick = 10;
let checkpointResult = "Not restored";
let journeyRenderer: BrowserJourneyRenderer | null = null;
let journeyResizeObserver: ResizeObserver | null = null;
let journeyRenderGeneration = 0;
const renderSceneCache = new Map<string, RenderScene>();

function kernelStateAt(tick: number) {
  const cached = kernelStates.get(tick);
  if (cached !== undefined) return cached;
  const state = advanceWorldKernel(genesisKernel, tick);
  kernelStates.set(tick, state);
  return state;
}

function projectionFor(
  engine: IllusionEngine,
  stage: (typeof stages)[number],
): IllusionProjection {
  const regionId = world.cells.find(
    (cell) => cell.id === manifestationCellId,
  )?.regionId;
  if (regionId === undefined)
    throw new Error("Baseline manifestation region is unavailable");
  const scopeCellIds =
    stage === "Planet"
      ? world.cells.map((cell) => cell.id)
      : stage === "Settlement"
        ? world.cells
            .filter((cell) => cell.regionId === regionId)
            .map((cell) => cell.id)
        : [manifestationCellId];
  return engine.project(
    {
      state: kernelStateAt(selectedPersonTick),
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
      selectedPersonIds: [manifestationPersonId],
    },
    {
      observerId: engine === illusionEngine ? "observer-a" : "observer-b",
      cameraPath: `${stage.toLowerCase()}/${cameraDegrees}`,
      quality: "browser-detected",
    },
  );
}

type LocalRenderBenchmark = (
  width: number,
  height: number,
  frames: number,
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
): RenderScene {
  const renderStage: RenderScene["stage"] =
    stage === "Planet"
      ? "planet"
      : stage === "Settlement"
        ? "region"
        : stage === "Street"
          ? "street"
          : "person";
  const key = `${renderStage}/${stateHash}/${manifestationPersonId}`;
  const cached = renderSceneCache.get(key);
  if (cached !== undefined) return cached;
  const scene = createRenderScene({
    worldSeed: world.seed,
    stateHash,
    selectionId: manifestationPersonId,
    stage: renderStage,
    quality: "baseline",
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
  if (backend !== null) backend.textContent = status.backend;
  if (timing !== null) timing.textContent = `${status.frameMs.toFixed(2)} ms`;
  if (losses !== null)
    losses.textContent = status.lifecycle.contextLosses.toString();
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
  const forceCanvas =
    new URLSearchParams(location.search).get("renderer") === "canvas";
  const renderer = new BrowserJourneyRenderer(
    { fallbackCanvas, gpuCanvas },
    scene.transition.durationMs === 0,
    forceCanvas,
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
  updateRenderDiagnostics(root, status);
  journeyResizeObserver = new ResizeObserver(() => {
    const resized = resize();
    if (resized !== null) updateRenderDiagnostics(root, resized);
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
): ManifestedPerson {
  manifestPlaceholder({
    seed: snapshot.seed,
    checkpoint: snapshot,
    region: "brindle-bay/harbor-street",
    tick: snapshot.tick,
    lod: "person",
  });
  const card = source.manifestation.person(manifestationPersonId);
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
): string {
  if (person === null)
    return `<p class="observer-empty">Independent local view not yet at person LOD.</p>`;
  return `<dl class="person-facts">
    <div><dt>Person ID</dt><dd data-testid="observer-${observer}-person-id">${person.personId}</dd></div>
    <div><dt>Identity</dt><dd>${person.name} · age ${person.ageYears} · ${person.cohort}</dd></div>
    <div><dt>Now</dt><dd data-testid="observer-${observer}-itinerary">Tick ${person.itinerary.tick} · ${person.itinerary.activity}${person.itinerary.activity === "work" || person.itinerary.activity === "school" || person.itinerary.activity === "service" ? ` at ${person.primaryPlace.name}` : ""}</dd></div>
    <div><dt>Semantic location</dt><dd><code>${person.itinerary.location.semanticId}</code> · ${person.itinerary.location.positionPermille}‰</dd></div>
    <div><dt>Household</dt><dd data-testid="observer-${observer}-household-id"><code>${person.household.id}</code> · ${person.household.role} · ${person.household.memberCount} members</dd></div>
    <div><dt>Recurring place</dt><dd>${person.primaryPlace.name} · ${person.primaryPlace.memberCount}/${person.primaryPlace.capacity}</dd></div>
    <div><dt>Relationships</dt><dd>${person.relationshipSummary}</dd></div>
    <div><dt>Co-located encounters</dt><dd>${person.itinerary.encounters.length} known · <code>${person.itinerary.encounterGroupId}</code></dd></div>
    <div><dt>Field reconciliation</dt><dd>${person.itinerary.fieldMembership.channel} · ${person.itinerary.fieldMembership.channelPopulation.toLocaleString("en-US")} in home-cell channel</dd></div>
    <div><dt>Route</dt><dd>${person.itinerary.route ? `${person.itinerary.route.mode} · ${person.itinerary.route.edgeIds.length} graph edges · ${person.itinerary.route.reason}` : "stationary analytical segment"}</dd></div>
    <div><dt>Appearance</dt><dd>${person.appearance.stature} · ${person.appearance.hair} hair · ${person.appearance.wardrobe} layers</dd></div>
    <div><dt>Semantic trace</dt><dd><code>${person.traceHash}</code></dd></div>
  </dl>`;
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
  const nextLabel = nextLabels[stageIndex];
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
    stateHash: snapshotA.stateHash,
    ...(personA ? { traceHash: personA.traceHash } : {}),
  });
  const renderScene = renderSceneFor(
    stage,
    semanticProjectionA.manifestationHash,
  );
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
    <header class="tracer-header"><div><p class="eyebrow"><span aria-hidden="true"></span> Deterministic world / M2</p><h1 id="app-title">Ten Billion Lives</h1></div><div class="status" data-testid="smoke-status"><span aria-hidden="true"></span>${smoke.status}</div></header>
    <section class="tracer-world" aria-labelledby="journey-title">
      <div class="journey-renderer ${tracerProjection.cssStage}" style="--camera-shift: ${cameraShift.toFixed(2)}px" data-render-stack data-projection-key="${semanticProjectionA.manifestationHash}" data-selection-id="${renderScene.selectionId}" data-camera-degrees="${cameraDegrees}" data-transition-ms="${renderScene.transition.durationMs}" data-testid="journey-renderer"><canvas width="768" height="480" data-render-surface="canvas2d" aria-label="${stage} Canvas fallback visualization"></canvas><canvas width="768" height="480" data-render-surface="webgpu" aria-label="${stage} WebGPU visualization" hidden></canvas><div class="render-hud"><span><b data-testid="render-backend">probing</b> · <b data-testid="render-visible">${renderScene.draw.visibleCount.toLocaleString("en-US")}</b> visible · weights ${renderScene.debug.minimumTokenWeight}–${renderScene.debug.maximumTokenWeight}</span><span><b data-testid="render-frame-time">pending</b> · ${(renderScene.buffer.byteLength / 1_048_576).toFixed(2)} MiB · <code>${renderScene.debug.bufferHash.slice(0, 8)}</code> · losses <b data-testid="render-context-losses">0</b></span></div></div>
      <div class="journey-copy"><p class="kicker">Observer A · <span data-testid="observer-a-stage">${stage}</span></p><h2 id="journey-title">${stage === "Planet" ? "Seeded fictional planet" : stage === "Settlement" ? (world.settlements[0]?.name ?? "Settlement") : stage === "Street" ? (world.settlements[0]?.neighborhoodIds[0] ?? "Neighborhood") : (personA?.name ?? "Resident")}</h2><p>Camera ${cameraDegrees}° · tick <span data-testid="person-tick">${personA?.itinerary.tick ?? snapshotA.tick}</span> · <code data-testid="state-hash">${snapshotA.stateHash}</code></p>
      <div class="tracer-actions">${nextLabel ? `<button type="button" data-action="next">${nextLabel}</button>` : ""}<button type="button" class="secondary" data-action="camera">Orbit camera</button>${personA ? stages.map((candidate, index) => `<button type="button" class="secondary" data-stage-index="${index}" aria-pressed="${stage === candidate}">View ${candidate.toLowerCase()}</button>`).join("") : ""}</div></div>
    </section>
    <section class="observer-grid" aria-label="Independent observer comparison">
      <article><p class="kicker">Observer A</p><h2>${personA?.name ?? "Journey in progress"}</h2><p class="projection-hashes">Manifestation <code data-testid="manifestation-hash-a">${semanticProjectionA.manifestationHash}</code><br>Events <code data-testid="projection-event-hash-a">${semanticProjectionA.eventHash}</code></p>${personCard(personA, "a")}</article>
      <article><p class="kicker">Observer B · independent instance</p><h2>${personB?.name ?? "Not initialized"}</h2>${semanticProjectionB ? `<p class="projection-hashes">Manifestation <code data-testid="manifestation-hash-b">${semanticProjectionB.manifestationHash}</code><br>Events <code data-testid="projection-event-hash-b">${semanticProjectionB.eventHash}</code></p>` : ""}${personCard(personB, "b")}${personA && !personB ? '<button type="button" data-action="observer-b">Initialize observer B</button>' : ""}${semanticMatch ? '<p class="match" data-testid="observer-match">Semantic match</p>' : ""}</article>
    </section>
    ${
      personA
        ? `<section class="trace-controls" aria-label="Analytical person time"><p><strong>Analytical time</strong> · direct random access, no resident stepping</p>${[
            [0, "midnight"],
            [7, "commute"],
            [10, "primary activity"],
            [19, "festival hour"],
            [23, "sleep"],
          ]
            .map(
              ([tick, label]) =>
                `<button type="button" class="secondary" data-person-tick="${tick}" aria-pressed="${selectedPersonTick === tick}">Tick ${tick} · ${label}</button>`,
            )
            .join("")}</section>`
        : ""
    }
    <section class="trace-controls" aria-label="Replay and field controls"><button type="button" data-action="replay" ${personA ? "" : "disabled"}>Rewind and replay</button><p data-testid="replay-result">${replayResult}</p><button type="button" class="secondary" data-action="fields">Reveal fields</button><button type="button" class="secondary" data-action="render-loss">Simulate renderer loss</button><button type="button" class="secondary" data-action="debug" aria-expanded="${debugVisible}">${debugVisible ? "Hide debug world" : "Inspect debug world"}</button></section>
    <section class="reality-budget ${fieldsRevealed ? "revealed" : ""}" data-testid="reality-budget" aria-live="polite"><div><p class="kicker">Authoritative world budget</p><h2><span data-testid="represented-population">${world.totalPopulation.toLocaleString("en-US")}</span> represented lives</h2></div><dl><div><dt>Authority</dt><dd>${world.cells.length.toLocaleString("en-US")} integer cells</dd></div><div><dt>Stored people</dt><dd>0 person rows</dd></div><div><dt>Projected scope</dt><dd><span data-testid="projection-represented">${semanticProjectionA.realityBudget.representedPeople.toLocaleString("en-US")}</span> people → <span data-testid="projection-tokens">${semanticProjectionA.realityBudget.materializedTokens.toLocaleString("en-US")}</span> weighted tokens</dd></div><div><dt>Derived bytes</dt><dd>${semanticProjectionA.realityBudget.estimatedBytes.toLocaleString("en-US")} · epoch ${semanticProjectionA.identityEpoch} / ${semanticProjectionA.realityBudget.continuityHorizonTicks} ticks</dd></div><div><dt>Manifestation hash</dt><dd><code>${semanticProjectionA.manifestationHash}</code></dd></div><div><dt>Event hash</dt><dd><code>${semanticProjectionA.eventHash}</code> · ${semanticProjectionA.events.length} local events</dd></div><div><dt>Sampling contract</dt><dd>${semanticProjectionA.realityBudget.samplingContract}</dd></div><div><dt>Observer state</dt><dd>Camera and GPU quality excluded from hashes</dd></div></dl></section>
    ${debugVisible ? `<section class="debug-world" aria-labelledby="debug-title"><div class="debug-heading"><div><p class="kicker">Seeded semantic atlas</p><h2 id="debug-title">Debug globe · L${debugLevel}</h2><p>Fictional geography; orange edges are the wrapped seam. Cell population brightens land.</p></div><div class="debug-controls" aria-label="Debug world level"><button type="button" class="secondary" data-debug-level="2" aria-pressed="${debugLevel === 2}">L2 regions</button><button type="button" class="secondary" data-debug-level="3" aria-pressed="${debugLevel === 3}">L3</button><button type="button" class="secondary" data-debug-level="5" aria-pressed="${debugLevel === 5}">L5 cells</button></div></div><canvas width="768" height="384" data-testid="debug-globe" aria-label="Fictional world cell map" aria-describedby="debug-cell-details">A deterministic map of fictional geography and population.</canvas><div class="debug-inspector" id="debug-cell-details"><div><dt>Selected cell</dt><dd data-testid="debug-cell-id">${selectedCell.id}</dd></div><div><dt>Hierarchy</dt><dd>${selectedParent} → ${selectedCell.id}</dd></div><div><dt>Geography</dt><dd>${selectedCell.biome} · ${selectedCell.elevationMeters.toLocaleString("en-US")} m</dd></div><div><dt>Population</dt><dd>${selectedCell.population.toLocaleString("en-US")}</dd></div><div><dt>Region</dt><dd>${selectedCell.regionId}</dd></div></div><div class="debug-probes"><button type="button" data-debug-cell="L5/12/0">Inspect seam</button><button type="button" data-debug-cell="L5/0/3">Inspect north pole</button></div><article class="field-debug" aria-labelledby="field-debug-title"><div class="field-debug-heading"><div><p class="kicker">Conservative field simulation</p><h2 id="field-debug-title">Tick <span data-testid="field-tick">${fieldState.tick}</span> · <code data-testid="field-hash">${fieldState.stateHash}</code></h2></div><div class="debug-controls"><button type="button" data-action="field-step">Single-step</button><button type="button" class="secondary" data-action="field-day">Advance one day</button></div></div><dl class="field-channels"><div><dt>Resident cohorts</dt><dd>${selectedFieldCell.cohorts.young.toLocaleString("en-US")} young · ${selectedFieldCell.cohorts.adult.toLocaleString("en-US")} adult · ${selectedFieldCell.cohorts.older.toLocaleString("en-US")} older</dd></div><div><dt>Activity channels</dt><dd>sleep ${selectedFieldCell.activities.sleep.toLocaleString("en-US")} · home ${selectedFieldCell.activities.home.toLocaleString("en-US")} · work ${selectedFieldCell.activities.work.toLocaleString("en-US")} · transit ${selectedFieldCell.activities.transit.toLocaleString("en-US")} · community ${selectedFieldCell.activities.community.toLocaleString("en-US")}</dd></div><div><dt>Capacity / amenity</dt><dd>${selectedFieldCell.capacityPermille}‰ / ${selectedFieldCell.amenityPermille}‰ · demand ${selectedFieldCell.flowDemand.toLocaleString("en-US")}</dd></div><div><dt>Sparse active regions</dt><dd>${fieldState.activeCellIds.length}</dd></div><div><dt>Flux ledger</dt><dd>${fieldState.lastFluxes.length.toLocaleString("en-US")} transfers; ${selectedFluxes.length} touch this cell${selectedFluxes[0] ? ` · #${selectedFluxes[0].processingOrder} ${selectedFluxes[0].sourceCellId} → ${selectedFluxes[0].destinationCellId} (${selectedFluxes[0].count.toLocaleString("en-US")})` : ""}</dd></div><div><dt>Invariant failures</dt><dd class="${fieldInvariant.valid ? "valid" : "invalid"}" data-testid="field-invariants">${fieldInvariant.valid ? "None — exact conservation" : fieldInvariant.issues.join("; ")}</dd></div></dl></article>${transportDebugPanel()}</section>` : ""}
    <footer><span>World seed <code>${world.seed}</code> · hash <code data-testid="world-hash">${world.worldHash}</code> · vectors <code data-testid="deterministic-vector-hash">${deterministicVectorHash()}</code></span><span>Run <code>pnpm check</code> from the repository root if a diagnostic fails.</span></footer>
  </main>`;

  root.querySelector('[data-action="next"]')?.addEventListener("click", () => {
    stageIndex = Math.min(stageIndex + 1, stages.length - 1);
    if (stages[stageIndex] === "Person") personA = queryPerson(snapshotA);
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
    .querySelector('[data-action="replay"]')
    ?.addEventListener("click", () => {
      personA = queryPerson(replayPlaceholder(snapshotA, 0));
      replayResult = `${personA.traceHash} restored`;
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
      const requested = Number(control.dataset["stageIndex"]);
      if (
        Number.isSafeInteger(requested) &&
        requested >= 0 &&
        requested < stages.length
      )
        stageIndex = requested;
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
      selectedPersonTick = Number(control.dataset["personTick"]);
      personA = queryPerson(snapshotA);
      if (observerBEngine !== null)
        personB = queryPerson(
          createPlaceholderSnapshot(),
          observerBEngine.itinerary,
        );
      replayResult = "Not run";
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
).__tenBillionRenderBenchmark = (width, height, frames) => {
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
    selectionId: manifestationPersonId,
    stage: "street",
    quality: "baseline",
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
try {
  render(root);
} catch (error: unknown) {
  const reason =
    error instanceof Error ? error.message : "Unknown startup error";
  root.innerHTML = `<main class="smoke-error" role="alert"><h1>Local smoke failed</h1><p>${reason}</p><p>Run <code>pnpm check</code> from the repository root, then reload.</p></main>`;
}
