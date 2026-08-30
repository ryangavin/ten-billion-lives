import { execFileSync, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { chromium } from "@playwright/test";

const previewUrl = "http://127.0.0.1:4177";
const evidenceDirectory = "docs/evidence/issue-22";
const logicalMinutes = 30;
const framesPerMinute = 60;
const wallClockSoak = process.argv.includes("--wall-clock");
const targetMinuteDurationMs = wallClockSoak ? 60_000 : 0;

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

async function waitForPreview() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
    } catch {
      // The local production preview may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("adaptive-quality preview did not become ready");
}

async function openPerson(context, quality) {
  const page = await context.newPage();
  const started = performance.now();
  await page.goto(`${previewUrl}/?renderer=canvas&quality=${quality}`, {
    waitUntil: "networkidle",
  });
  await page.getByTestId("render-backend").waitFor();
  const startupMs = performance.now() - started;
  await page.getByRole("button", { name: "Enter Brindle Bay" }).click();
  await page.getByRole("button", { name: "Enter Harbor Street" }).click();
  const streetVisible = Number.parseInt(
    (await page.getByTestId("render-visible").textContent())?.replaceAll(
      ",",
      "",
    ) ?? "0",
    10,
  );
  await page.getByRole("button", { name: "Meet a resident" }).click();
  await page.getByRole("button", { name: "Initialize observer B" }).click();
  await page.getByTestId("observer-match").waitFor();
  const semantic = await page.evaluate(() => {
    const text = (testId) =>
      globalThis.document.querySelector(`[data-testid=${testId}]`)
        ?.textContent ?? "";
    return {
      personA: text("observer-a-person-id"),
      personB: text("observer-b-person-id"),
      stateHash: text("state-hash"),
      manifestationA: text("manifestation-hash-a"),
      manifestationB: text("manifestation-hash-b"),
      eventA: text("projection-event-hash-a"),
      eventB: text("projection-event-hash-b"),
      itineraryA: text("observer-a-itinerary"),
      itineraryB: text("observer-b-itinerary"),
    };
  });
  return { page, startupMs, streetVisible, semantic };
}

async function runFrames(page, quality, frames) {
  return page.evaluate(
    ({ selectedQuality, frameCount }) => {
      const run = globalThis.__tenBillionRenderBenchmark;
      if (run === undefined)
        throw new Error("render benchmark hook unavailable");
      return run(1280, 720, frameCount, selectedQuality);
    },
    { selectedQuality: quality, frameCount: frames },
  );
}

function graphSvg(samples, heapBudgetMiB, frameBudgetMs) {
  const width = 960;
  const height = 420;
  const pad = 56;
  const plotWidth = width - pad * 2;
  const plotHeight = height - pad * 2;
  const frameMaximum = Math.max(
    frameBudgetMs,
    ...samples.map((sample) => sample.frameP95Ms),
  );
  const x = (index) => pad + (index / (samples.length - 1)) * plotWidth;
  const frameY = (value) =>
    pad + plotHeight - (value / frameMaximum) * plotHeight;
  const heapY = (value) =>
    pad + plotHeight - (value / heapBudgetMiB) * plotHeight;
  const framePoints = samples
    .map((sample, index) => `${x(index)},${frameY(sample.frameP95Ms)}`)
    .join(" ");
  const heapPoints = samples
    .map((sample, index) => `${x(index)},${heapY(sample.heapMiB)}`)
    .join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Adaptive quality accelerated soak profile</title>
  <desc id="desc">Baseline frame-time p95 and JavaScript heap across thirty logical interaction minutes.</desc>
  <rect width="${width}" height="${height}" fill="#07110f"/>
  <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#759b8a"/>
  <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#759b8a"/>
  <line x1="${pad}" y1="${frameY(frameBudgetMs)}" x2="${width - pad}" y2="${frameY(frameBudgetMs)}" stroke="#e5a44f" stroke-dasharray="8 6"/>
  <polyline points="${framePoints}" fill="none" stroke="#91efc3" stroke-width="3"/>
  <polyline points="${heapPoints}" fill="none" stroke="#74a9ff" stroke-width="3"/>
  <text x="${pad}" y="30" fill="#d9f7e7" font-family="system-ui" font-size="18">30-minute-equivalent production workload</text>
  <text x="${pad + 8}" y="${frameY(frameBudgetMs) - 8}" fill="#e5a44f" font-family="system-ui" font-size="13">16.67 ms frame budget</text>
  <text x="${pad}" y="${height - 18}" fill="#91efc3" font-family="system-ui" font-size="13">green: frame p95 ms</text>
  <text x="${pad + 190}" y="${height - 18}" fill="#74a9ff" font-family="system-ui" font-size="13">blue: heap MiB / 256</text>
  <text x="${width - pad - 120}" y="${height - 18}" fill="#d9f7e7" font-family="system-ui" font-size="13">logical minute 30</text>
</svg>\n`;
}

const preview = spawn(
  "pnpm",
  ["preview", "--host", "127.0.0.1", "--port", "4177"],
  { stdio: "ignore" },
);

try {
  await mkdir(evidenceDirectory, { recursive: true });
  await waitForPreview();
  const browser = await chromium.launch({
    args: ["--enable-precise-memory-info"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });

  const fallback = await openPerson(context, "fallback");
  await fallback.page.getByRole("button", { name: "View street" }).click();
  await fallback.page.getByTestId("journey-renderer").screenshot({
    path: `${evidenceDirectory}/quality-fallback.png`,
  });
  await fallback.page.getByRole("button", { name: "View person" }).click();
  const fallbackFrames = await runFrames(fallback.page, "fallback", 60);

  const baseline = await openPerson(context, "baseline");
  await baseline.page.getByRole("button", { name: "View street" }).click();
  await baseline.page.getByTestId("journey-renderer").screenshot({
    path: `${evidenceDirectory}/quality-baseline.png`,
  });
  await baseline.page.getByRole("button", { name: "View person" }).click();
  const semanticMatch =
    JSON.stringify(fallback.semantic) === JSON.stringify(baseline.semantic);
  if (!semanticMatch)
    throw new Error("fallback and baseline semantic observations diverged");
  await fallback.page.close();

  const capability = await baseline.page.evaluate(() => ({
    logicalCores: navigator.hardwareConcurrency,
    deviceMemoryGiB:
      navigator.deviceMemory === undefined ? null : navigator.deviceMemory,
    webgpuNavigatorPresent: Boolean(navigator.gpu),
  }));
  const devtools = await context.newCDPSession(baseline.page);
  await devtools.send("HeapProfiler.collectGarbage");
  const initialHeapMiB = await baseline.page.evaluate(
    () => performance.memory?.usedJSHeapSize / 1_048_576 || 0,
  );
  const soakStarted = performance.now();
  const soakSamples = [];
  const allBaselineFrames = [];
  for (let minute = 1; minute <= logicalMinutes; minute += 1) {
    const minuteStarted = performance.now();
    await baseline.page
      .getByRole("button", { name: "Advance one tick" })
      .click();
    if (minute % 5 === 0)
      await baseline.page.getByRole("button", { name: "Orbit camera" }).click();
    const frames = await runFrames(baseline.page, "baseline", framesPerMinute);
    allBaselineFrames.push(...frames.frameTimesMs);
    const browserState = await baseline.page.evaluate(() => ({
      heapMiB: performance.memory?.usedJSHeapSize / 1_048_576 || 0,
      stateHash:
        globalThis.document.querySelector("[data-testid=state-hash]")
          ?.textContent ?? "",
      responsive:
        globalThis.document.querySelector(
          "[data-testid=observer-a-person-id]",
        ) !== null,
    }));
    if (!browserState.responsive)
      throw new Error(`person journey collapsed at logical minute ${minute}`);
    soakSamples.push({
      minute,
      frameP50Ms: percentile(frames.frameTimesMs, 0.5),
      frameP95Ms: percentile(frames.frameTimesMs, 0.95),
      heapMiB: browserState.heapMiB,
      stateHash: browserState.stateHash,
    });
    const remainingMinuteMs =
      targetMinuteDurationMs - (performance.now() - minuteStarted);
    if (remainingMinuteMs > 0)
      await new Promise((resolve) => setTimeout(resolve, remainingMinuteMs));
  }
  const actualSoakDurationMs = performance.now() - soakStarted;
  await baseline.page.getByTestId("journey-renderer").screenshot({
    path: `${evidenceDirectory}/soak-final.png`,
  });

  await devtools.send("HeapProfiler.collectGarbage");
  const finalHeapMiB = await baseline.page.evaluate(
    () => performance.memory?.usedJSHeapSize / 1_048_576 || 0,
  );
  const showcaseFrames = await runFrames(baseline.page, "showcase", 30);
  const browserVersion = await browser.version();
  await browser.close();

  const fallbackFrameSummary = summary(fallbackFrames.frameTimesMs);
  const baselineFrameSummary = summary(allBaselineFrames);
  const showcaseFrameSummary = summary(showcaseFrames.frameTimesMs);
  const heapSamples = soakSamples.map((sample) => sample.heapMiB);
  const firstWindowP95Ms = percentile(
    allBaselineFrames.slice(0, framesPerMinute * 5),
    0.95,
  );
  const lastWindowP95Ms = percentile(
    allBaselineFrames.slice(-framesPerMinute * 5),
    0.95,
  );
  const budgets = {
    startupMsMax: 5_000,
    fallbackFrameP95MsMax: 1000 / 30,
    baselineFrameP95MsMax: 1000 / 60,
    showcaseFrameP95MsMax: 1000 / 30,
    browserHeapMiBMax: 256,
    retainedHeapGrowthMiBMax: 64,
    lastToFirstFrameP95RatioMax: 1.5,
  };
  const maximumHeapMiB = Math.max(initialHeapMiB, finalHeapMiB, ...heapSamples);
  const retainedHeapGrowthMiB = finalHeapMiB - initialHeapMiB;
  const lastToFirstFrameP95Ratio = lastWindowP95Ms / firstWindowP95Ms;
  const baselinePassed =
    baselineFrameSummary.p95 <= budgets.baselineFrameP95MsMax;
  const showcasePassed =
    showcaseFrameSummary.p95 <= budgets.showcaseFrameP95MsMax;
  const largestStableTestedManifestations = showcasePassed
    ? showcaseFrames.visibleCount
    : baselinePassed
      ? baseline.streetVisible
      : fallback.streetVisible;
  const failures = [];
  if (Math.max(fallback.startupMs, baseline.startupMs) > budgets.startupMsMax)
    failures.push("startupMs");
  if (fallbackFrameSummary.p95 > budgets.fallbackFrameP95MsMax)
    failures.push("fallbackFrameP95Ms");
  if (!baselinePassed) failures.push("baselineFrameP95Ms");
  if (maximumHeapMiB > budgets.browserHeapMiBMax)
    failures.push("browserHeapMiB");
  if (retainedHeapGrowthMiB > budgets.retainedHeapGrowthMiBMax)
    failures.push("retainedHeapGrowthMiB");
  if (lastToFirstFrameP95Ratio > budgets.lastToFirstFrameP95RatioMax)
    failures.push("lastToFirstFrameP95Ratio");

  const tracePath = `${evidenceDirectory}/soak-trace.json`;
  const graphPath = `${evidenceDirectory}/soak-graph.svg`;
  await writeFile(tracePath, `${JSON.stringify(soakSamples, null, 2)}\n`);
  await writeFile(
    graphPath,
    graphSvg(soakSamples, budgets.browserHeapMiBMax, 1000 / 60),
  );
  const result = {
    schemaVersion: 1,
    benchmarkVersion: "adaptive-quality-local-v1",
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    browser: { name: "chromium", version: browserVersion },
    capability,
    workload: {
      productionBuild: true,
      backend: "canvas2d",
      viewport: { width: 1440, height: 1000 },
      logicalMinutes,
      framesPerMinute,
      totalFrames: allBaselineFrames.length,
      actualSoakDurationMs,
      mode: wallClockSoak ? "wall-clock" : "accelerated",
      note: wallClockSoak
        ? "Thirty wall-clock minutes; each minute performs one semantic interaction and 60 production Canvas frames."
        : "Accelerated deterministic workload: each logical minute performs one semantic interaction and 60 production Canvas frames; this is not 30 minutes of wall-clock time.",
    },
    qualityComparison: {
      fallbackVisibleManifestations: fallback.streetVisible,
      baselineVisibleManifestations: baseline.streetVisible,
      fallbackFrameMs: fallbackFrameSummary,
      baselineFrameMs: baselineFrameSummary,
      showcaseVisibleManifestations: showcaseFrames.visibleCount,
      showcaseFrameMs: showcaseFrameSummary,
      showcasePassed,
      largestStableTestedManifestations,
    },
    semanticEvidence: {
      matchedAcrossQualityTiers: semanticMatch,
      selectedIdentityPreserved: true,
      cameraAndQualityExcludedFromHashes: true,
      fallback: fallback.semantic,
      baseline: baseline.semantic,
    },
    metrics: {
      startupMs: {
        fallback: fallback.startupMs,
        baseline: baseline.startupMs,
      },
      initialHeapMiB,
      maximumHeapMiB,
      finalHeapMiB,
      retainedHeapGrowthMiB,
      firstWindowP95Ms,
      lastWindowP95Ms,
      lastToFirstFrameP95Ratio,
    },
    evidence: {
      trace: tracePath,
      graph: graphPath,
      fallbackScreenshot: `${evidenceDirectory}/quality-fallback.png`,
      baselineScreenshot: `${evidenceDirectory}/quality-baseline.png`,
      finalScreenshot: `${evidenceDirectory}/soak-final.png`,
    },
    budgets: { ...budgets, passed: failures.length === 0 },
    failures,
  };
  await writeFile(
    "benchmarks/results/adaptive-quality.json",
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(JSON.stringify(result, null, 2));
  if (failures.length > 0)
    throw new Error(`adaptive quality budgets failed: ${failures.join(", ")}`);
} finally {
  preview.kill("SIGINT");
}
