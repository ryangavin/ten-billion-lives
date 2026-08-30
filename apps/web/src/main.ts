import "./style.css";

import {
  manifestPlaceholder,
  type PlaceholderManifestation,
} from "@ten-billion-lives/manifest";
import {
  createPlaceholderSnapshot,
  deterministicVectorHash,
  replayPlaceholder,
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
let stageIndex = 0;
let cameraDegrees = 0;
let personA: PlaceholderManifestation | null = null;
let personB: PlaceholderManifestation | null = null;
let replayResult = "Not run";
let fieldsRevealed = false;

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

  root.innerHTML = `<main class="observatory" aria-labelledby="app-title">
    <header class="tracer-header"><div><p class="eyebrow"><span aria-hidden="true"></span> Architecture tracer / M0 gate</p><h1 id="app-title">Ten Billion Lives</h1></div><div class="status" data-testid="smoke-status"><span aria-hidden="true"></span>${smoke.status}</div></header>
    <section class="tracer-world" aria-labelledby="journey-title">
      <div class="mini-globe ${projection.cssStage}" data-projection-key="${projection.semanticKey}" aria-hidden="true"><i></i><b></b></div>
      <div class="journey-copy"><p class="kicker">Observer A · <span data-testid="observer-a-stage">${stage}</span></p><h2 id="journey-title">${stage === "Planet" ? "Seeded placeholder planet" : stage === "Settlement" ? "Brindle Bay" : stage === "Street" ? "Harbor Street" : "Ari Vale"}</h2><p>Camera ${cameraDegrees}° · tick ${snapshotA.tick} · <code data-testid="state-hash">${snapshotA.stateHash}</code></p>
      <div class="tracer-actions">${nextLabel ? `<button type="button" data-action="next">${nextLabel}</button>` : ""}<button type="button" class="secondary" data-action="camera">Orbit camera</button></div></div>
    </section>
    <section class="observer-grid" aria-label="Independent observer comparison">
      <article><p class="kicker">Observer A</p><h2>${personA?.name ?? "Journey in progress"}</h2>${personCard(personA, "a")}</article>
      <article><p class="kicker">Observer B · independent instance</p><h2>${personB?.name ?? "Not initialized"}</h2>${personCard(personB, "b")}${personA && !personB ? '<button type="button" data-action="observer-b">Initialize observer B</button>' : ""}${semanticMatch ? '<p class="match" data-testid="observer-match">Semantic match</p>' : ""}</article>
    </section>
    <section class="trace-controls" aria-label="Replay and field controls"><button type="button" data-action="replay" ${personA ? "" : "disabled"}>Rewind and replay</button><p data-testid="replay-result">${replayResult}</p><button type="button" class="secondary" data-action="fields">Reveal fields</button></section>
    <section class="reality-budget ${fieldsRevealed ? "revealed" : ""}" data-testid="reality-budget" aria-live="polite"><div><p class="kicker">Early reality budget</p><h2><span data-testid="represented-population">${smoke.representedPopulation.toLocaleString("en-US")}</span> represented lives</h2></div><dl><div><dt>Authority</dt><dd>3 authoritative cells</dd></div><div><dt>Stored people</dt><dd>0 person rows</dd></div><div><dt>Visible manifestation</dt><dd>${personA ? "1 × weight 128" : "0"}</dd></div><div><dt>Observer state</dt><dd>Camera excluded from hash</dd></div></dl></section>
    <footer><span>Seed <code>${smoke.seed}</code> · vectors <code data-testid="deterministic-vector-hash">${deterministicVectorHash()}</code></span><span>Run <code>pnpm check</code> from the repository root if a diagnostic fails.</span></footer>
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
