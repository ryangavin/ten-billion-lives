import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { chromium } from "@playwright/test";

import { startProductionPreview } from "./lib/production-preview.mjs";

/* global document */

const evidenceDirectory = "docs/evidence/issue-36";
const resultPath = "benchmarks/results/living-city-hardening.json";
const qualities = ["fallback", "baseline", "showcase"];
const profile = "apple-m1-max-32gb-chromium";

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ];
}

function summary(values) {
  return {
    minimum: Math.min(...values),
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    maximum: Math.max(...values),
  };
}

async function reachPerson(page) {
  for (const name of [
    "Enter Brindle Bay",
    "Enter Harbor Street",
    "Meet a resident",
  ])
    await page.getByRole("button", { name }).click();
  await page
    .getByTestId("journey-renderer")
    .waitFor({ state: "visible", timeout: 30_000 });
}

async function collectTier(context, previewUrl, quality) {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const externalRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(previewUrl).origin)
      externalRequests.push(request.url());
  });
  const started = performance.now();
  await page.goto(`${previewUrl}/?renderer=canvas&quality=${quality}`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="render-backend"]')?.textContent !==
      "probing",
  );
  const startupMs = performance.now() - started;
  await reachPerson(page);
  await page.requestGC();
  const beforeWarmupHeapMiB = await page.evaluate(
    () => (performance.memory?.usedJSHeapSize ?? 0) / 1_048_576,
  );
  await page.evaluate((selectedQuality) => {
    const run = globalThis.__tenBillionLivingCityBenchmark;
    if (run === undefined) throw new Error("living-city benchmark unavailable");
    return run(1_280, 720, 10, selectedQuality);
  }, quality);
  await page.requestGC();
  const initialHeapMiB = await page.evaluate(
    () => (performance.memory?.usedJSHeapSize ?? 0) / 1_048_576,
  );
  const metrics = await page.evaluate((selectedQuality) => {
    const run = globalThis.__tenBillionLivingCityBenchmark;
    if (run === undefined) throw new Error("living-city benchmark unavailable");
    return run(1_280, 720, 60, selectedQuality);
  }, quality);
  await page.requestGC();
  const finalHeapMiB = await page.evaluate(
    () => (performance.memory?.usedJSHeapSize ?? 0) / 1_048_576,
  );
  const screenshot = `${evidenceDirectory}/production-${quality}.png`;
  await page.getByTestId("journey-renderer").screenshot({ path: screenshot });
  const observationText = await page.evaluate(() => {
    const text = (testId) =>
      document.querySelector(`[data-testid=${testId}]`)?.textContent ?? "";
    return {
      personId: text("observer-a-person-id"),
      stateHash: text("state-hash"),
      manifestationHash: text("manifestation-hash-a"),
      eventHash: text("projection-event-hash-a"),
      representedPopulation: text("represented-population"),
    };
  });
  const observation = {
    ...observationText,
    trajectoryHash: metrics.selectedTrajectoryHash,
  };
  assert.equal(metrics.pickedPersonId, metrics.selectedPersonId);
  assert.equal(metrics.representedPeople, "80219543");
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(externalRequests, []);
  await page.close();
  return {
    quality,
    startupMs,
    visibleCount: metrics.visibleCount,
    semanticKey: metrics.semanticKey,
    selectedPersonId: metrics.selectedPersonId,
    representedPeople: metrics.representedPeople,
    unsampledRemainder: metrics.unsampledRemainder,
    backend: metrics.backend,
    frameMs: summary(metrics.frameTimesMs),
    cpuPrepareMs: summary(metrics.cpuPrepareTimesMs),
    drawMs: summary(metrics.drawTimesMs),
    uploadMs: summary(metrics.uploadTimesMs),
    pickMs: summary(metrics.pickTimesMs),
    resizeMs: summary(metrics.resizeTimesMs),
    drawCount: metrics.drawCount,
    heapMiB: {
      beforeWarmup: beforeWarmupHeapMiB,
      initial: initialHeapMiB,
      final: finalHeapMiB,
      retainedGrowth: finalHeapMiB - initialHeapMiB,
      maximum: Math.max(beforeWarmupHeapMiB, initialHeapMiB, finalHeapMiB),
    },
    observation,
    screenshot,
    audits: { consoleErrors, pageErrors, externalRequests },
  };
}

await mkdir(evidenceDirectory, { recursive: true });
const preview = await startProductionPreview();
const browser = await chromium.launch({
  args: ["--enable-precise-memory-info"],
});
const context = await browser.newContext({
  viewport: { width: 1_440, height: 900 },
});

try {
  const tiers = [];
  for (const quality of qualities)
    tiers.push(await collectTier(context, preview.url, quality));
  const reference = tiers[0]?.observation;
  assert(reference !== undefined);
  for (const tier of tiers) assert.deepEqual(tier.observation, reference);
  assert.deepEqual(
    tiers.map((tier) => tier.visibleCount),
    [128, 256, 512],
  );

  const autoPage = await context.newPage();
  await autoPage.goto(preview.url, { waitUntil: "networkidle" });
  const capability = await autoPage.evaluate(() => ({
    logicalCores: navigator.hardwareConcurrency,
    deviceMemoryGiB: navigator.deviceMemory ?? null,
    webgpuNavigatorPresent: Boolean(navigator.gpu),
    backend:
      document.querySelector('[data-testid="render-backend"]')?.textContent ??
      "missing",
  }));
  await autoPage.close();

  const budgets = {
    startupMsMax: 5_000,
    fallback: { frameP95MsMax: 8 },
    baseline: { frameP95MsMax: 12 },
    showcase: { frameP95MsMax: 1_000 / 60 },
    browserHeapMiBMax: 64,
    retainedHeapGrowthMiBMax: 8,
    cpuPrepareP95MsMax: 4,
    drawP95MsMax: 4,
    uploadP95MsMax: 0,
    pickP95MsMax: 1,
    resizeP95MsMax: 1_000 / 60,
    drawCountMax: 1,
  };
  const failures = [];
  for (const tier of tiers) {
    if (tier.startupMs > budgets.startupMsMax)
      failures.push(`${tier.quality}.startupMs`);
    if (tier.frameMs.p95 > budgets[tier.quality].frameP95MsMax)
      failures.push(`${tier.quality}.frameP95Ms`);
    if (tier.heapMiB.maximum > budgets.browserHeapMiBMax)
      failures.push(`${tier.quality}.browserHeapMiB`);
    if (tier.heapMiB.retainedGrowth > budgets.retainedHeapGrowthMiBMax)
      failures.push(`${tier.quality}.retainedHeapGrowthMiB`);
    if (tier.cpuPrepareMs.p95 > budgets.cpuPrepareP95MsMax)
      failures.push(`${tier.quality}.cpuPrepareP95Ms`);
    if (tier.drawMs.p95 > budgets.drawP95MsMax)
      failures.push(`${tier.quality}.drawP95Ms`);
    if (tier.uploadMs.p95 > budgets.uploadP95MsMax)
      failures.push(`${tier.quality}.uploadP95Ms`);
    if (tier.pickMs.p95 > budgets.pickP95MsMax)
      failures.push(`${tier.quality}.pickP95Ms`);
    if (tier.resizeMs.p95 > budgets.resizeP95MsMax)
      failures.push(`${tier.quality}.resizeP95Ms`);
    if (tier.drawCount > budgets.drawCountMax)
      failures.push(`${tier.quality}.drawCount`);
  }
  const result = {
    schemaVersion: 1,
    benchmarkVersion: "living-city-hardening-v1",
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    capturedAt: new Date().toISOString(),
    profile,
    browser: { name: "chromium", version: await browser.version() },
    workload: {
      productionBuild: true,
      integratedProductionScene: true,
      backend: "canvas2d",
      viewport: { width: 1_280, height: 720 },
      warmupFrames: 10,
      measuredFrames: 60,
      picksPerTier: 120,
      resizeSamplesPerTier: 12,
    },
    capability,
    tiers,
    semanticEvidence: {
      authoritativeObservationsMatchAcrossTiers: true,
      viewSpecificPickKeys: tiers.map((tier) => tier.semanticKey),
      selectedInteractionTargetStable: true,
    },
    budgets: { ...budgets, passed: failures.length === 0 },
    failures,
  };
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (failures.length > 0)
    throw new Error(
      `living-city hardening budgets failed: ${failures.join(", ")}`,
    );
} finally {
  await context.close();
  await browser.close();
  await preview.close();
}
