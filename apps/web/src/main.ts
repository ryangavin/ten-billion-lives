import "./style.css";

import { createSmokeModel } from "./smoke";

function mountSmokeSurface(root: HTMLElement): void {
  const model = createSmokeModel();
  const formattedPopulation =
    model.representedPopulation.toLocaleString("en-US");

  root.innerHTML = `
    <main class="observatory" aria-labelledby="app-title">
      <section class="hero">
        <div class="eyebrow"><span aria-hidden="true"></span> Local observatory / M0</div>
        <h1 id="app-title">Ten Billion Lives</h1>
        <p class="claim">
          One compact planetary field. Exactly ten billion represented lives.
          Stable local meaning, without ten billion stored agents.
        </p>
        <div class="status" data-testid="smoke-status">
          <span aria-hidden="true"></span>${model.status}
        </div>
      </section>

      <section class="world-card" aria-labelledby="world-heading">
        <div class="globe" aria-hidden="true">
          <div class="globe-grid"></div>
          <div class="globe-glow"></div>
        </div>
        <div class="world-copy">
          <p class="kicker">Baseline field</p>
          <h2 id="world-heading">A deterministic world, ready to inspect</h2>
          <p>
            This smoke surface proves the local browser, workspace packages, and
            production build are connected. Planet simulation arrives in the next
            milestone; the claim stays honest until then.
          </p>
          <dl class="metrics">
            <div>
              <dt>Represented population</dt>
              <dd data-testid="represented-population">${formattedPopulation}</dd>
            </div>
            <div>
              <dt>Authoritative tick</dt>
              <dd>${model.tick} <small>/ ${model.tickMinutes} minute</small></dd>
            </div>
          </dl>
        </div>
      </section>

      <section class="diagnostics" aria-labelledby="diagnostics-heading">
        <div>
          <p class="kicker">Reproducible foundation</p>
          <h2 id="diagnostics-heading">Local diagnostics</h2>
        </div>
        <dl>
          <div>
            <dt>Seeded fixture</dt>
            <dd><code>${model.seed}</code></dd>
          </div>
          <div>
            <dt>Workspace packages</dt>
            <dd>${model.packages.join(" · ")}</dd>
          </div>
          <div>
            <dt>Ambient clock</dt>
            <dd>Not consulted</dd>
          </div>
        </dl>
      </section>

      <footer>
        <span>Foundation smoke surface</span>
        <span>Run <code>pnpm check</code> from the repository root if a diagnostic fails.</span>
      </footer>
    </main>
  `;
}

function mountFailure(root: HTMLElement, error: unknown): void {
  const reason =
    error instanceof Error ? error.message : "Unknown startup error";
  root.innerHTML = `
    <main class="smoke-error" role="alert">
      <h1>Local smoke failed</h1>
      <p>${reason}</p>
      <p>Run <code>pnpm check</code> from the repository root, then reload.</p>
    </main>
  `;
}

const root = document.querySelector<HTMLElement>("#app");

if (root === null) {
  throw new Error("Missing #app mount point in apps/web/index.html");
}

try {
  mountSmokeSurface(root);
} catch (error: unknown) {
  mountFailure(root, error);
}
