import "./style.css";

import {
  manifestPlaceholder,
  type PlaceholderManifestation,
} from "@ten-billion-lives/manifest";
import {
  BASELINE_WORLD_SEED,
  FIELD_TICKS_PER_DAY,
  FieldSimulationRunner,
  WORLD_LEVEL,
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
  simulatePlanetaryDay,
  type FictionalWorld,
  type LocalSnapshot,
} from "@ten-billion-lives/sim";
import { createTracerProjection } from "@ten-billion-lives/render";

import { createSmokeModel } from "./smoke";

const stages = ["Planet", "Settlement", "Street", "Person"] as const;
const nextLabels = [
  "Enter Brindle Bay",
  "Enter Harbor Street",
  "Meet Ari Vale",
];
const snapshotA = createPlaceholderSnapshot();
const world = generateWorld(BASELINE_WORLD_SEED);
const fieldRunner = new FieldSimulationRunner(createFieldState(world));
const transportGraph = buildTransportGraph(world);
const planetaryDay = simulatePlanetaryDay(
  world,
  createSignatureCommandLog(transportGraph),
);
let stageIndex = 0;
let cameraDegrees = 0;
let personA: PlaceholderManifestation | null = null;
let personB: PlaceholderManifestation | null = null;
let replayResult = "Not run";
let fieldsRevealed = false;
let debugVisible = false;
let debugLevel: 2 | 3 | 5 = WORLD_LEVEL;
let selectedCellId = "L5/12/0";
let selectedDayTick = 7;

const biomeColors = {
  ocean: "#0d3441",
  tundra: "#9eb8ad",
  boreal: "#315b49",
  grassland: "#668750",
  woodland: "#326747",
  desert: "#a8864c",
  rainforest: "#176044",
} as const;

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

function queryPerson(snapshot: LocalSnapshot): PlaceholderManifestation {
  return manifestPlaceholder({
    seed: snapshot.seed,
    checkpoint: snapshot,
    region: "brindle-bay/harbor-street",
    tick: snapshot.tick,
    lod: "person",
  });
}

function personCard(
  person: PlaceholderManifestation | null,
  observer: "a" | "b",
): string {
  if (person === null)
    return `<p class="observer-empty">Independent local view not yet at person LOD.</p>`;
  return `<dl class="person-facts">
    <div><dt>Person ID</dt><dd data-testid="observer-${observer}-person-id">${person.personId}</dd></div>
    <div><dt>Identity</dt><dd>${person.name} · ${person.role}</dd></div>
    <div><dt>Now</dt><dd>${person.activity}</dd></div>
    <div><dt>Trace</dt><dd><code>${person.traceHash}</code></dd></div>
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
  )}"></polyline><line class="tick-marker" x1="${markerX}" y1="28" x2="${markerX}" y2="176"></line><text x="24" y="193">00</text><text x="205" y="193">06</text><text x="393" y="193">12</text><text x="581" y="193">18</text><text x="728" y="193">23</text></svg><div class="chart-legend"><span class="movement">aggregate movement</span><span class="festival">festival attendance</span><span>vertical marker: selected tick</span></div><dl class="field-channels"><div><dt>Cohort activity reconciliation</dt><dd>${activities}</dd></div><div><dt>Festival</dt><dd>${planetaryDay.graph.festival.name} · ${tick.festivalAttendance.toLocaleString("en-US")} attending from ${tick.festivalOrigins.length} surrounding regions</dd></div><div><dt>Signature route</dt><dd data-testid="signature-route">${signatureFlow.closed ? "Closed" : "Open"} · ${signatureFlow.count.toLocaleString("en-US")} / ${signatureFlow.capacity.toLocaleString("en-US")}</dd></div><div><dt>Bottlenecks</dt><dd>${bottlenecks.length.toLocaleString("en-US")} capacity-limited edges at regional/globe LOD</dd></div><div class="flow-explanation"><dt>Why this flow?</dt><dd data-testid="flow-explanation">${explainFlow(planetaryDay, selectedDayTick, signatureFlow.edgeId)}</dd></div><div><dt>Invariant failures</dt><dd class="valid">${tick.invariantIssues.length === 0 ? "None — activities and routes valid" : tick.invariantIssues.join("; ")}</dd></div></dl></article>`;
}

function render(root: HTMLElement): void {
  const smoke = createSmokeModel();
  const stage = stages[stageIndex] ?? "Planet";
  const nextLabel = nextLabels[stageIndex];
  const semanticMatch =
    personA !== null &&
    personB !== null &&
    personA.personId === personB.personId &&
    personA.traceHash === personB.traceHash;
  const projection = createTracerProjection({
    stage: stage.toLowerCase() as "planet" | "settlement" | "street" | "person",
    stateHash: snapshotA.stateHash,
    ...(personA ? { traceHash: personA.traceHash } : {}),
  });
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
    <header class="tracer-header"><div><p class="eyebrow"><span aria-hidden="true"></span> Deterministic world / M1</p><h1 id="app-title">Ten Billion Lives</h1></div><div class="status" data-testid="smoke-status"><span aria-hidden="true"></span>${smoke.status}</div></header>
    <section class="tracer-world" aria-labelledby="journey-title">
      <div class="mini-globe ${projection.cssStage}" data-projection-key="${projection.semanticKey}" aria-hidden="true"><i></i><b></b></div>
      <div class="journey-copy"><p class="kicker">Observer A · <span data-testid="observer-a-stage">${stage}</span></p><h2 id="journey-title">${stage === "Planet" ? "Seeded placeholder planet" : stage === "Settlement" ? "Brindle Bay" : stage === "Street" ? "Harbor Street" : "Ari Vale"}</h2><p>Camera ${cameraDegrees}° · tick ${snapshotA.tick} · <code data-testid="state-hash">${snapshotA.stateHash}</code></p>
      <div class="tracer-actions">${nextLabel ? `<button type="button" data-action="next">${nextLabel}</button>` : ""}<button type="button" class="secondary" data-action="camera">Orbit camera</button></div></div>
    </section>
    <section class="observer-grid" aria-label="Independent observer comparison">
      <article><p class="kicker">Observer A</p><h2>${personA?.name ?? "Journey in progress"}</h2>${personCard(personA, "a")}</article>
      <article><p class="kicker">Observer B · independent instance</p><h2>${personB?.name ?? "Not initialized"}</h2>${personCard(personB, "b")}${personA && !personB ? '<button type="button" data-action="observer-b">Initialize observer B</button>' : ""}${semanticMatch ? '<p class="match" data-testid="observer-match">Semantic match</p>' : ""}</article>
    </section>
    <section class="trace-controls" aria-label="Replay and field controls"><button type="button" data-action="replay" ${personA ? "" : "disabled"}>Rewind and replay</button><p data-testid="replay-result">${replayResult}</p><button type="button" class="secondary" data-action="fields">Reveal fields</button><button type="button" class="secondary" data-action="debug" aria-expanded="${debugVisible}">${debugVisible ? "Hide debug world" : "Inspect debug world"}</button></section>
    <section class="reality-budget ${fieldsRevealed ? "revealed" : ""}" data-testid="reality-budget" aria-live="polite"><div><p class="kicker">Authoritative world budget</p><h2><span data-testid="represented-population">${world.totalPopulation.toLocaleString("en-US")}</span> represented lives</h2></div><dl><div><dt>Authority</dt><dd>${world.cells.length.toLocaleString("en-US")} integer cells</dd></div><div><dt>Stored people</dt><dd>0 person rows</dd></div><div><dt>Settlements</dt><dd>${world.settlements.length} land anchors</dd></div><div><dt>Observer state</dt><dd>Camera excluded from hash</dd></div></dl></section>
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
      personB = queryPerson(createPlaceholderSnapshot());
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
}

const root = document.querySelector<HTMLElement>("#app");
if (root === null) throw new Error("Missing #app mount point");
try {
  render(root);
} catch (error: unknown) {
  const reason =
    error instanceof Error ? error.message : "Unknown startup error";
  root.innerHTML = `<main class="smoke-error" role="alert"><h1>Local smoke failed</h1><p>${reason}</p><p>Run <code>pnpm check</code> from the repository root, then reload.</p></main>`;
}
