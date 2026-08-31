import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { chromium } from "@playwright/test";

import { startProductionPreview } from "./lib/production-preview.mjs";

const evidenceDirectory = "docs/evidence/issue-33";
const benchmarkPath = "benchmarks/results/living-city-integration.json";
const profile = "apple-m1-max-32gb-chromium";
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ];
}

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

async function measure(action) {
  const started = performance.now();
  await action();
  return performance.now() - started;
}

async function screenshotRenderer(page, path) {
  await page.waitForTimeout(300);
  await page.getByTestId("journey-renderer").screenshot({ path });
}

async function canvasPickSelected(page) {
  const renderer = page.getByTestId("journey-renderer");
  const x = Number(await renderer.getAttribute("data-selected-screen-x"));
  const y = Number(await renderer.getAttribute("data-selected-screen-y"));
  const canvas = page.locator("[data-render-surface]:not([hidden])");
  const bounds = await canvas.boundingBox();
  const size = await canvas.evaluate((element) => ({
    width: element.width,
    height: element.height,
  }));
  assert(
    Number.isFinite(x) && Number.isFinite(y),
    "selected figure coordinate is invalid",
  );
  assert(bounds !== null, "selected figure canvas has no bounds");
  await canvas.click({
    position: {
      x: (x / size.width) * bounds.width,
      y: (y / size.height) * bounds.height,
    },
  });
}

function parsePopulationSummary(summary) {
  const match = summary.match(
    /(\d+) literal figures represent (\d+) people; (\d+) people remain unsampled; total (\d+)\./,
  );
  assert(match !== null, "living-city population summary is not parseable");
  const [, figures, sampled, remainder, total] = match;
  assert.equal(BigInt(sampled) + BigInt(remainder), BigInt(total));
  return { figures: Number(figures), sampled, remainder, total };
}

async function recordJourney(browser, previewUrl, options) {
  const videoDirectory = `/private/tmp/ten-billion-lives-issue-33-${options.name}`;
  await mkdir(videoDirectory, { recursive: true });
  const context = await browser.newContext({
    viewport: options.viewport,
    recordVideo: { dir: videoDirectory, size: options.viewport },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const externalRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== previewUrl) externalRequests.push(request.url());
  });
  const video = page.video();
  const timings = {};
  await page.goto(`${previewUrl}/${options.query}`, {
    waitUntil: "networkidle",
  });
  timings.cityMs = await measure(async () => {
    await page.getByRole("button", { name: "Enter Brindle Bay" }).click();
    await page.locator('[data-render-stack][data-city-level="city"]').waitFor();
  });
  await page.getByTestId("render-backend").waitFor();
  await page.waitForFunction(
    () =>
      globalThis.document.querySelector('[data-testid="render-backend"]')
        ?.textContent !== "probing",
  );
  const backend = await page.getByTestId("render-backend").textContent();
  const quality = await page.getByTestId("render-quality").textContent();
  await screenshotRenderer(
    page,
    `${evidenceDirectory}/${options.name}-city.png`,
  );
  const cityManifestationHash = await page
    .getByTestId("manifestation-hash-a")
    .textContent();
  const selectedPersonId = await page
    .getByTestId("journey-renderer")
    .getAttribute("data-selection-id");

  timings.neighborhoodMs = await measure(async () => {
    await page.getByRole("button", { name: "Zoom neighborhood" }).click();
    await page
      .locator('[data-render-stack][data-city-level="neighborhood"]')
      .waitFor();
  });
  assert.equal(
    await page.getByTestId("manifestation-hash-a").textContent(),
    cityManifestationHash,
  );
  await screenshotRenderer(
    page,
    `${evidenceDirectory}/${options.name}-neighborhood.png`,
  );

  timings.streetMs = await measure(async () => {
    await page.getByRole("button", { name: "Zoom street" }).click();
    await page
      .locator('[data-render-stack][data-city-level="street"]')
      .waitFor();
  });
  assert.equal(
    await page.getByTestId("manifestation-hash-a").textContent(),
    cityManifestationHash,
  );
  await screenshotRenderer(
    page,
    `${evidenceDirectory}/${options.name}-street.png`,
  );

  timings.pickMs = await measure(async () => {
    await canvasPickSelected(page);
    await page.getByTestId("observer-a-person-id").waitFor();
  });
  assert.equal(
    await page.getByTestId("observer-a-person-id").textContent(),
    selectedPersonId,
  );
  await screenshotRenderer(
    page,
    `${evidenceDirectory}/${options.name}-selected.png`,
  );

  timings.observerBMs = await measure(async () => {
    await page.getByRole("button", { name: "Initialize observer B" }).click();
    await page.getByTestId("living-city-hash-b").waitFor();
  });
  const observerAHash = await page
    .getByTestId("living-city-hash-a")
    .textContent();
  const observerBHash = await page
    .getByTestId("living-city-hash-b")
    .textContent();
  assert.equal(observerBHash, observerAHash);
  assert.equal(
    await page.getByTestId("observer-match").textContent(),
    "Semantic match · trajectory match",
  );

  const invariantsBeforeCamera = {
    state: await page.getByTestId("state-hash").textContent(),
    manifestation: await page.getByTestId("manifestation-hash-a").textContent(),
    event: await page.getByTestId("projection-event-hash-a").textContent(),
    city: await page.getByTestId("living-city-hash-a").textContent(),
  };
  await page.getByRole("button", { name: "Orbit camera" }).click();
  const invariantsAfterCamera = {
    state: await page.getByTestId("state-hash").textContent(),
    manifestation: await page.getByTestId("manifestation-hash-a").textContent(),
    event: await page.getByTestId("projection-event-hash-a").textContent(),
    city: await page.getByTestId("living-city-hash-a").textContent(),
  };
  assert.deepEqual(invariantsAfterCamera, invariantsBeforeCamera);

  await page.getByRole("button", { name: "Tick 7 · commute" }).click();
  const directSeekKey = await page
    .getByTestId("journey-renderer")
    .getAttribute("data-projection-key");
  await page
    .getByRole("button", {
      name: "60 simulated minutes per real second",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Play local time" }).click();
  await page.waitForFunction(
    () =>
      globalThis.document
        .querySelector('[data-testid="living-city-time"]')
        ?.textContent?.includes("0.0000%") === false,
    undefined,
    { timeout: 20_000 },
  );
  await page.getByRole("button", { name: "Pause local time" }).click();
  await screenshotRenderer(
    page,
    `${evidenceDirectory}/${options.name}-walking-phase.png`,
  );
  await page.getByRole("button", { name: "Play local time" }).click();
  await page.waitForFunction(
    () =>
      Number(
        globalThis.document.querySelector('[data-testid="person-tick"]')
          ?.textContent,
      ) > 7,
    undefined,
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: "Pause local time" }).click();
  await screenshotRenderer(
    page,
    `${evidenceDirectory}/${options.name}-hour-boundary.png`,
  );
  assert.equal(
    await page.getByTestId("observer-match").textContent(),
    "Semantic match · trajectory match",
  );
  const pausedKey = await page
    .getByTestId("journey-renderer")
    .getAttribute("data-projection-key");
  await page.waitForTimeout(700);
  assert.equal(
    await page
      .getByTestId("journey-renderer")
      .getAttribute("data-projection-key"),
    pausedKey,
  );

  await page.getByRole("button", { name: "Tick 7 · commute" }).click();
  assert.equal(
    await page
      .getByTestId("journey-renderer")
      .getAttribute("data-projection-key"),
    directSeekKey,
  );
  await page.getByRole("button", { name: "Rewind and replay" }).click();
  const replayKey = await page
    .getByTestId("journey-renderer")
    .getAttribute("data-projection-key");
  assert.equal(replayKey, directSeekKey);

  const browserMetrics = await page.evaluate(() => ({
    heapMiB: (performance.memory?.usedJSHeapSize ?? 0) / 1_048_576,
    gpuNavigatorPresent: Boolean(navigator.gpu),
  }));
  const frameMs = Number.parseFloat(
    (await page.getByTestId("render-frame-time").textContent()) ?? "NaN",
  );

  await page.getByRole("button", { name: "Simulate renderer loss" }).click();
  const recoveryBackend = await page
    .getByTestId("render-backend")
    .textContent();
  const contextLosses = await page
    .getByTestId("render-context-losses")
    .textContent();
  assert.equal(recoveryBackend, "canvas2d");
  assert.equal(contextLosses, "1");
  if (options.narrow) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `${evidenceDirectory}/${options.name}-narrow.png`,
      fullPage: true,
    });
  }

  const summary = await page.getByTestId("living-city-summary").textContent();
  const population = parsePopulationSummary(summary ?? "");
  assert((summary ?? "").includes("weight one"));
  const semantic = {
    selectedPersonId,
    stateHash: await page.getByTestId("state-hash").textContent(),
    manifestationHash: await page
      .getByTestId("manifestation-hash-a")
      .textContent(),
    eventHash: await page.getByTestId("projection-event-hash-a").textContent(),
    citySceneHash: await page.getByTestId("living-city-hash-a").textContent(),
    observerBCitySceneHash: await page
      .getByTestId("living-city-hash-b")
      .textContent(),
    trajectoryComparison: await page
      .getByTestId("observer-match")
      .textContent(),
    directSeekKey,
    replayKey,
    pausedKey,
    population,
  };
  await page.close();
  await context.close();
  assert(video !== null, "journey recording was not initialized");
  const videoPath = await video.path();
  const recording = `${evidenceDirectory}/${options.name}-journey.webm`;
  await copyFile(videoPath, recording);
  return {
    name: options.name,
    query: options.query,
    backend,
    quality,
    recovery: { backend: recoveryBackend, contextLosses },
    timings,
    frameMs,
    browserMetrics,
    semantic,
    invariantsBeforeCamera,
    invariantsAfterCamera,
    consoleErrors,
    pageErrors,
    externalRequests,
    recording,
  };
}

await mkdir(evidenceDirectory, { recursive: true });
const preview = await startProductionPreview();
const browser = await chromium.launch();
try {
  const browserVersion = await browser.version();
  const production = await recordJourney(browser, preview.url, {
    name: "production",
    query: "?quality=baseline",
    viewport: { width: 1280, height: 800 },
    narrow: false,
  });
  const fallback = await recordJourney(browser, preview.url, {
    name: "fallback",
    query: "?renderer=canvas&quality=fallback",
    viewport: { width: 960, height: 720 },
    narrow: true,
  });
  const failures = [];
  for (const journey of [production, fallback]) {
    if (journey.consoleErrors.length > 0)
      failures.push(`${journey.name} console`);
    if (journey.pageErrors.length > 0) failures.push(`${journey.name} page`);
    if (journey.externalRequests.length > 0)
      failures.push(`${journey.name} external requests`);
  }
  const metrics = {
    coldCityMs: production.timings.cityMs,
    zoomP95Ms: percentile(
      [
        production.timings.neighborhoodMs,
        production.timings.streetMs,
        fallback.timings.neighborhoodMs,
        fallback.timings.streetMs,
      ],
      0.95,
    ),
    pickResponseMs: production.timings.pickMs,
    initializeObserverBMs: production.timings.observerBMs,
    productionFrameMs: production.frameMs,
    fallbackFrameMs: fallback.frameMs,
    peakObservedHeapMiB: Math.max(
      production.browserMetrics.heapMiB,
      fallback.browserMetrics.heapMiB,
    ),
  };
  const budgets = {
    coldCityMsMax: 3_500,
    zoomP95MsMax: 2_500,
    pickResponseMsMax: 2_500,
    initializeObserverBMsMax: 3_500,
    frameMsMax: 16.67,
    peakObservedHeapMiBMax: 128,
  };
  if (metrics.coldCityMs > budgets.coldCityMsMax) failures.push("cold city");
  if (metrics.zoomP95Ms > budgets.zoomP95MsMax) failures.push("zoom");
  if (metrics.pickResponseMs > budgets.pickResponseMsMax) failures.push("pick");
  if (metrics.initializeObserverBMs > budgets.initializeObserverBMsMax)
    failures.push("observer B");
  if (
    metrics.productionFrameMs > budgets.frameMsMax ||
    metrics.fallbackFrameMs > budgets.frameMsMax
  )
    failures.push("frame");
  if (metrics.peakObservedHeapMiB > budgets.peakObservedHeapMiBMax)
    failures.push("heap");
  assert.deepEqual(failures, [], JSON.stringify({ metrics, budgets }));

  const result = {
    schemaVersion: 1,
    benchmarkVersion: "living-city-integration-v1",
    commit,
    profile,
    browser: browserVersion,
    production,
    fallback,
    metrics,
    budgets: { ...budgets, passed: true },
    caveats: {
      webgpu:
        production.backend === "webgpu"
          ? "Measured with an available WebGPU adapter."
          : "navigator.gpu may be present, but no usable adapter was available; Canvas is authoritative.",
      soak: "The release-candidate soak remains owned by issue #36.",
    },
  };
  await writeFile(benchmarkPath, `${JSON.stringify(result, null, 2)}\n`);

  const artifactPaths = [
    benchmarkPath,
    ...[production, fallback].flatMap((journey) => [
      `${evidenceDirectory}/${journey.name}-city.png`,
      `${evidenceDirectory}/${journey.name}-neighborhood.png`,
      `${evidenceDirectory}/${journey.name}-street.png`,
      `${evidenceDirectory}/${journey.name}-selected.png`,
      `${evidenceDirectory}/${journey.name}-walking-phase.png`,
      `${evidenceDirectory}/${journey.name}-hour-boundary.png`,
      journey.recording,
    ]),
    `${evidenceDirectory}/fallback-narrow.png`,
  ];
  const artifacts = [];
  for (const path of artifactPaths)
    artifacts.push({ path, sha256: await sha256(path) });
  const index = {
    schemaVersion: 1,
    issue: 33,
    commit,
    profile,
    generatedAt: new Date().toISOString(),
    capturedImplementationCommit: commit,
    productionBackend: production.backend,
    fallbackBackend: fallback.backend,
    failures: [],
    skips:
      production.backend === "webgpu" ? [] : ["WebGPU adapter unavailable"],
    retries: [],
    externalRequests: [],
    consoleErrors: [],
    artifacts,
  };
  await writeFile(
    `${evidenceDirectory}/evidence-index.json`,
    `${JSON.stringify(index, null, 2)}\n`,
  );
  console.log(JSON.stringify({ result, index }, null, 2));
} finally {
  await browser.close();
  await preview.close();
}
