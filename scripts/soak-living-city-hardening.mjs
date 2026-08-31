import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { chromium } from "@playwright/test";

import { startProductionPreview } from "./lib/production-preview.mjs";

/* global document */

const evidenceDirectory = "docs/evidence/issue-36";
const resultPath = "benchmarks/results/living-city-soak.json";
const requestedMinutes = process.argv
  .find((argument) => argument.startsWith("--minutes="))
  ?.slice("--minutes=".length);
const soakMinutes =
  requestedMinutes === undefined ? 30 : Number(requestedMinutes);
if (!Number.isSafeInteger(soakMinutes) || soakMinutes < 1 || soakMinutes > 30)
  throw new RangeError("soak minutes must be an integer from 1 through 30");
const minuteDurationMs = 60_000;
const profile = "apple-m1-max-32gb-chromium";

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ];
}

async function setEvidenceDrawer(page, open) {
  await page.locator("details.evidence-drawer").evaluate((drawer, value) => {
    drawer.open = value;
    drawer.dispatchEvent(new Event("toggle"));
  }, open);
}

async function reachPerson(page) {
  for (const name of [
    "Enter Brindle Bay",
    "Enter Harbor Street",
    "Meet a resident",
  ])
    await page.getByRole("button", { name }).click();
}

async function semanticObservation(page) {
  return page.evaluate(() => {
    const text = (testId) =>
      document.querySelector(`[data-testid=${testId}]`)?.textContent ?? "";
    return {
      personA: text("observer-a-person-id"),
      personB: text("observer-b-person-id"),
      stateHash: text("state-hash"),
      manifestationA: text("manifestation-hash-a"),
      manifestationB: text("manifestation-hash-b"),
      eventA: text("projection-event-hash-a"),
      eventB: text("projection-event-hash-b"),
      observerMatch: text("observer-match"),
      representedPopulation: text("represented-population"),
      projectionRepresented: text("projection-represented"),
      tick: text("person-tick"),
      backend: text("render-backend"),
      quality: text("render-quality"),
      contextLosses: text("render-context-losses"),
    };
  });
}

async function runProductionFrames(page) {
  return page.evaluate(() => {
    const run = globalThis.__tenBillionLivingCityBenchmark;
    if (run === undefined) throw new Error("living-city benchmark unavailable");
    return run(1_280, 720, 60, "baseline");
  });
}

async function exerciseMinute(page, context, minute, interactions) {
  const action = minute % 6;
  if (action === 1) {
    const before = await page.getByTestId("person-tick").textContent();
    await page
      .getByRole("button", {
        name: "60 simulated minutes per real second",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Play local time" }).click();
    await page.waitForFunction(
      (prior) =>
        document.querySelector('[data-testid="person-tick"]')?.textContent !==
        prior,
      before,
      { timeout: 20_000 },
    );
    await page.evaluate(() => {
      const control = globalThis.document.querySelector(
        '[data-action="clock-toggle"]',
      );
      if (control === null || control.tagName !== "BUTTON")
        throw new Error("playback control unavailable while pausing");
      control.click();
    });
    await page.waitForFunction(
      () =>
        globalThis.document
          .querySelector('[data-action="clock-toggle"]')
          ?.getAttribute("aria-label") === "Play local time",
    );
    interactions.push({ minute, action: "playback-pause" });
  } else if (action === 2) {
    await page.getByRole("button", { name: "Orbit camera" }).click();
    interactions.push({ minute, action: "camera-orbit" });
  } else if (action === 3) {
    await page.getByRole("button", { name: "Zoom neighborhood" }).click();
    await page.getByRole("button", { name: "Zoom street" }).click();
    await page.getByRole("button", { name: "Zoom person" }).click();
    interactions.push({ minute, action: "semantic-zoom-cycle" });
  } else if (action === 4) {
    const closure = page.getByRole("button", {
      name: "Explore closure branch",
    });
    const baseline = page.getByRole("button", {
      name: "View immutable baseline",
    });
    if ((await closure.getAttribute("aria-pressed")) === "true")
      await baseline.click();
    else await closure.click();
    interactions.push({ minute, action: "branch-toggle" });
  } else if (action === 5) {
    const renderer = page.getByTestId("journey-renderer");
    await renderer.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    interactions.push({ minute, action: "keyboard-selection-follow" });
  } else {
    await page
      .getByRole("combobox", { name: "Signature moment" })
      .selectOption(minute % 12 === 0 ? "19" : "7");
    interactions.push({ minute, action: "signature-seek" });
  }

  if (minute % 10 === 0) {
    await setEvidenceDrawer(page, true);
    await page.getByRole("button", { name: "Simulate renderer loss" }).click();
    await setEvidenceDrawer(page, false);
    interactions.push({ minute, action: "context-loss-recovery" });
  }
  if (minute % 12 === 0) {
    const background = await context.newPage();
    await background.goto("about:blank");
    await page.bringToFront();
    await background.close();
    interactions.push({ minute, action: "background-resume" });
  }
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
  const x = (index) =>
    pad + (index / Math.max(1, samples.length - 1)) * plotWidth;
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
  <title id="title">Living-city real wall-clock soak</title>
  <desc id="desc">Production Canvas frame-time p95 and JavaScript heap across ${samples.length} real wall-clock minutes.</desc>
  <rect width="${width}" height="${height}" fill="#07110f"/>
  <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#759b8a"/>
  <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#759b8a"/>
  <line x1="${pad}" y1="${frameY(frameBudgetMs)}" x2="${width - pad}" y2="${frameY(frameBudgetMs)}" stroke="#e5a44f" stroke-dasharray="8 6"/>
  <polyline points="${framePoints}" fill="none" stroke="#91efc3" stroke-width="3"/>
  <polyline points="${heapPoints}" fill="none" stroke="#74a9ff" stroke-width="3"/>
  <text x="${pad}" y="30" fill="#d9f7e7" font-family="system-ui" font-size="18">${samples.length}-minute production interaction soak</text>
  <text x="${pad}" y="${height - 18}" fill="#91efc3" font-family="system-ui" font-size="13">green: frame p95 ms</text>
  <text x="${pad + 190}" y="${height - 18}" fill="#74a9ff" font-family="system-ui" font-size="13">blue: heap MiB / ${heapBudgetMiB}</text>
</svg>\n`;
}

await mkdir(evidenceDirectory, { recursive: true });
const preview = await startProductionPreview();
const browser = await chromium.launch({
  args: ["--enable-precise-memory-info"],
});
const context = await browser.newContext({
  viewport: { width: 1_440, height: 900 },
});
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const externalRequests = [];
const previewOrigin = new URL(preview.url).origin;
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("request", (request) => {
  if (new URL(request.url()).origin !== previewOrigin)
    externalRequests.push(request.url());
});

try {
  await page.goto(`${preview.url}/?renderer=canvas`, {
    waitUntil: "networkidle",
  });
  await reachPerson(page);
  await setEvidenceDrawer(page, true);
  await page.getByRole("button", { name: "Initialize observer B" }).click();
  await setEvidenceDrawer(page, false);
  const initialSemantic = await semanticObservation(page);
  assert.equal(
    initialSemantic.observerMatch,
    "Semantic match · trajectory match",
  );
  assert.equal(initialSemantic.representedPopulation, "10,000,000,000");
  await page.requestGC();
  const initialHeapMiB = await page.evaluate(
    () => (performance.memory?.usedJSHeapSize ?? 0) / 1_048_576,
  );
  const startPath = `${evidenceDirectory}/soak-start.png`;
  await page.screenshot({ path: startPath, fullPage: true });
  const samples = [];
  const interactions = [];
  const soakStarted = performance.now();
  for (let minute = 1; minute <= soakMinutes; minute += 1) {
    const minuteStarted = performance.now();
    await exerciseMinute(page, context, minute, interactions);
    const frames = await runProductionFrames(page);
    const semantic = await semanticObservation(page);
    assert.equal(semantic.observerMatch, "Semantic match · trajectory match");
    assert.equal(semantic.representedPopulation, "10,000,000,000");
    assert.equal(semantic.manifestationA, semantic.manifestationB);
    assert.equal(semantic.eventA, semantic.eventB);
    const heapMiB = await page.evaluate(
      () => (performance.memory?.usedJSHeapSize ?? 0) / 1_048_576,
    );
    samples.push({
      minute,
      elapsedMs: performance.now() - soakStarted,
      frameP50Ms: percentile(frames.frameTimesMs, 0.5),
      frameP95Ms: percentile(frames.frameTimesMs, 0.95),
      heapMiB,
      ...semantic,
    });
    const remainingMs = minuteDurationMs - (performance.now() - minuteStarted);
    if (remainingMs > 0)
      await new Promise((resolve) => setTimeout(resolve, remainingMs));
  }
  const actualDurationMs = performance.now() - soakStarted;
  await page.requestGC();
  const finalHeapMiB = await page.evaluate(
    () => (performance.memory?.usedJSHeapSize ?? 0) / 1_048_576,
  );
  const finalPath = `${evidenceDirectory}/soak-final.png`;
  await page.screenshot({ path: finalPath, fullPage: true });
  const frameP95Values = samples.map((sample) => sample.frameP95Ms);
  const heapValues = samples.map((sample) => sample.heapMiB);
  const firstWindowP95Ms = percentile(frameP95Values.slice(0, 5), 0.95);
  const lastWindowP95Ms = percentile(frameP95Values.slice(-5), 0.95);
  const budgets = {
    durationMsMin: soakMinutes * minuteDurationMs,
    baselineFrameP95MsMax: 12,
    browserHeapMiBMax: 128,
    retainedHeapGrowthMiBMax: 32,
    lastToFirstFrameP95RatioMax: 1.5,
  };
  const maximumFrameP95Ms = Math.max(...frameP95Values);
  const maximumHeapMiB = Math.max(initialHeapMiB, finalHeapMiB, ...heapValues);
  const retainedHeapGrowthMiB = finalHeapMiB - initialHeapMiB;
  const lastToFirstFrameP95Ratio = lastWindowP95Ms / firstWindowP95Ms;
  const failures = [];
  if (actualDurationMs < budgets.durationMsMin) failures.push("durationMs");
  if (maximumFrameP95Ms > budgets.baselineFrameP95MsMax)
    failures.push("baselineFrameP95Ms");
  if (maximumHeapMiB > budgets.browserHeapMiBMax)
    failures.push("browserHeapMiB");
  if (retainedHeapGrowthMiB > budgets.retainedHeapGrowthMiBMax)
    failures.push("retainedHeapGrowthMiB");
  if (lastToFirstFrameP95Ratio > budgets.lastToFirstFrameP95RatioMax)
    failures.push("lastToFirstFrameP95Ratio");
  if (consoleErrors.length > 0) failures.push("consoleErrors");
  if (pageErrors.length > 0) failures.push("pageErrors");
  if (externalRequests.length > 0) failures.push("externalRequests");
  const tracePath = `${evidenceDirectory}/soak-trace.json`;
  const graphPath = `${evidenceDirectory}/soak-graph.svg`;
  await writeFile(tracePath, `${JSON.stringify(samples, null, 2)}\n`);
  await writeFile(
    graphPath,
    graphSvg(samples, budgets.browserHeapMiBMax, budgets.baselineFrameP95MsMax),
  );
  const result = {
    schemaVersion: 1,
    benchmarkVersion: "living-city-wall-clock-soak-v1",
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    capturedAt: new Date().toISOString(),
    profile,
    browser: { name: "chromium", version: await browser.version() },
    workload: {
      productionBuild: true,
      backend: "canvas2d",
      requestedMinutes: soakMinutes,
      actualDurationMs,
      realWallClock: true,
      releaseCandidateDuration: soakMinutes === 30,
      interactionCount: interactions.length,
      interactions,
    },
    semanticEvidence: {
      initial: initialSemantic,
      final: await semanticObservation(page),
      observerEqualityCheckedEveryMinute: true,
      exactPopulationCheckedEveryMinute: true,
    },
    metrics: {
      initialHeapMiB,
      maximumHeapMiB,
      finalHeapMiB,
      retainedHeapGrowthMiB,
      maximumFrameP95Ms,
      firstWindowP95Ms,
      lastWindowP95Ms,
      lastToFirstFrameP95Ratio,
      contextLossRecoveries: interactions.filter(
        (entry) => entry.action === "context-loss-recovery",
      ).length,
      backgroundResumes: interactions.filter(
        (entry) => entry.action === "background-resume",
      ).length,
    },
    audits: { consoleErrors, pageErrors, externalRequests },
    evidence: { startPath, finalPath, tracePath, graphPath },
    budgets: { ...budgets, passed: failures.length === 0 },
    failures,
  };
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (failures.length > 0)
    throw new Error(`living-city soak budgets failed: ${failures.join(", ")}`);
} finally {
  await page.close();
  await context.close();
  await browser.close();
  await preview.close();
}
