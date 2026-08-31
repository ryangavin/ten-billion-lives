import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { chromium } from "@playwright/test";
import { build } from "vite";

import { startProductionPreview } from "./lib/production-preview.mjs";

const evidenceDirectory = "docs/evidence/issue-32";
const resultPath = "benchmarks/results/living-city-renderer.json";
const bundleDirectory = "/private/tmp/ten-billion-lives-m4-32-benchmark-bundle";
const bundlePath = path.join(bundleDirectory, "living-city-spike.js");
const counts = [64, 128, 256, 512, 1_024];
const fixedPhase = 250_000;
const warmupSamples = 10;
const frameSamples = 60;
const pickSamples = 300;
const resizeSamples = 12;
const zoomSamples = 12;

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

async function sha256(filePath) {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

async function bundleSpike() {
  await build({
    configFile: false,
    root: path.resolve("apps/web"),
    logLevel: "silent",
    build: {
      target: "es2022",
      outDir: bundleDirectory,
      emptyOutDir: true,
      lib: {
        entry: path.resolve("apps/web/src/living-city-spike.ts"),
        formats: ["es"],
        fileName: () => "living-city-spike.js",
      },
    },
  });
  return readFile(bundlePath, "utf8");
}

async function mountSpike(page, previewUrl, bundle, query) {
  await page.route("**/living-city-spike.js", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/javascript; charset=utf-8",
      body: bundle,
    }),
  );
  await page.route("**/living-city-spike-host*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      headers: {
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; object-src 'none'",
      },
      body: '<main data-living-city-spike-root></main><script type="module" src="/living-city-spike.js"></script>',
    }),
  );
  await page.goto(`${previewUrl}/living-city-spike-host?${query}`, {
    waitUntil: "networkidle",
  });
  await page.getByTestId("spike-backend").waitFor();
  await page.waitForFunction(
    () => globalThis.__livingCitySpike?.renderer.status() !== null,
  );
}

async function heapMiB(page) {
  return page.evaluate(
    () => (performance.memory?.usedJSHeapSize ?? 0) / 1_048_576,
  );
}

function curvesSvg(density) {
  const width = 980;
  const height = 440;
  const padding = 64;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const maximumFrame = Math.max(...density.map((point) => point.frameMs.p95));
  const maximumHeap = Math.max(...density.map((point) => point.heapMiB.after));
  const x = (index) =>
    padding + (index / Math.max(1, density.length - 1)) * plotWidth;
  const frameY = (value) =>
    padding + plotHeight - (value / Math.max(1, maximumFrame)) * plotHeight;
  const heapY = (value) =>
    padding + plotHeight - (value / Math.max(1, maximumHeap)) * plotHeight;
  const framePoints = density
    .map((point, index) => `${x(index)},${frameY(point.frameMs.p95)}`)
    .join(" ");
  const heapPoints = density
    .map((point, index) => `${x(index)},${heapY(point.heapMiB.after)}`)
    .join(" ");
  const labels = density
    .map(
      (point, index) =>
        `<text x="${x(index)}" y="${height - 28}" text-anchor="middle" fill="#cfe8dc" font-family="system-ui" font-size="13">${point.figureCount}</text>`,
    )
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Literal-person Canvas density curve</title>
  <desc id="desc">Canvas frame p95 and JavaScript heap at 64, 128, 256, 512, and 1024 literal figures on the committed profile.</desc>
  <rect width="${width}" height="${height}" fill="#0a1318"/>
  <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#849e93"/>
  <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#849e93"/>
  <polyline points="${framePoints}" fill="none" stroke="#ffe66d" stroke-width="3"/>
  <polyline points="${heapPoints}" fill="none" stroke="#70b7e6" stroke-width="3"/>
  <text x="${padding}" y="30" fill="#eaf6ef" font-family="system-ui" font-size="19">Fixed-time literal-person Canvas curves</text>
  <text x="${padding}" y="50" fill="#ffe66d" font-family="system-ui" font-size="13">yellow: frame p95 ms (max ${maximumFrame.toFixed(2)})</text>
  <text x="${padding + 260}" y="50" fill="#70b7e6" font-family="system-ui" font-size="13">blue: heap MiB (max ${maximumHeap.toFixed(2)})</text>
  ${labels}
  <text x="${width / 2}" y="${height - 8}" text-anchor="middle" fill="#a9c2b7" font-family="system-ui" font-size="12">literal figures; separate normalized axes show curve shape</text>
</svg>\n`;
}

await mkdir(evidenceDirectory, { recursive: true });
const bundle = await bundleSpike();
const preview = await startProductionPreview();
const browser = await chromium.launch({
  args: ["--enable-precise-memory-info"],
});
const requests = [];
const consoleMessages = [];
const context = await browser.newContext({
  viewport: { width: 1_280, height: 720 },
});
const canvasPage = await context.newPage();
canvasPage.on("request", (request) => requests.push(request.url()));
canvasPage.on("console", (message) =>
  consoleMessages.push({ type: message.type(), text: message.text() }),
);

try {
  await mountSpike(
    canvasPage,
    preview.url,
    bundle,
    `backend=canvas&count=256&phase=${fixedPhase}`,
  );
  const devtools = await context.newCDPSession(canvasPage);
  const density = [];
  for (const figureCount of counts) {
    await devtools.send("HeapProfiler.collectGarbage");
    const beforeHeapMiB = await heapMiB(canvasPage);
    const measurements = await canvasPage.evaluate(
      async ({ count, phase, warmups, samples, picks }) => {
        const hook = globalThis.__livingCitySpike;
        if (hook === undefined)
          throw new Error("living-city benchmark hook unavailable");
        for (let index = 0; index < warmups; index += 1) {
          hook.render(count, phase);
          await new Promise(globalThis.requestAnimationFrame);
        }
        const frames = [];
        for (let index = 0; index < samples; index += 1) {
          frames.push(hook.render(count, phase));
          await new Promise(globalThis.requestAnimationFrame);
        }
        const semanticKey = `living-city/state-spike/event-lantern/t17-p${phase}`;
        const statusSemanticKey =
          hook.renderer.status()?.semanticKey ?? "missing";
        const selectedPoint = hook.selectedPoint();
        if (selectedPoint === null)
          throw new Error("selected spike figure is unavailable");
        const pickTimes = [];
        let pickedPersonId = null;
        for (let index = 0; index < picks; index += 1) {
          const started = performance.now();
          pickedPersonId =
            hook.renderer.pick(
              selectedPoint.x,
              selectedPoint.y,
              statusSemanticKey,
            )?.personId ?? null;
          pickTimes.push(performance.now() - started);
        }
        return {
          frames,
          pickTimes,
          pickedPersonId,
          selectedPoint,
          semanticKey,
          statusSemanticKey,
        };
      },
      {
        count: figureCount,
        phase: fixedPhase,
        warmups: warmupSamples,
        samples: frameSamples,
        picks: pickSamples,
      },
    );
    await devtools.send("HeapProfiler.collectGarbage");
    const afterHeapMiB = await heapMiB(canvasPage);
    if (measurements.pickedPersonId !== "person/spike-000000")
      throw new Error(
        `stable pick failed at ${figureCount} figures: ${JSON.stringify({ pickedPersonId: measurements.pickedPersonId, selectedPoint: measurements.selectedPoint, semanticKey: measurements.semanticKey, statusSemanticKey: measurements.statusSemanticKey })}`,
      );
    density.push({
      figureCount,
      frameMs: summary(measurements.frames.map((frame) => frame.frameMs)),
      cpuPrepareMs: summary(
        measurements.frames.map((frame) => frame.cpuPrepareMs),
      ),
      uploadMs: summary(measurements.frames.map((frame) => frame.uploadMs)),
      drawMs: summary(measurements.frames.map((frame) => frame.drawMs)),
      drawCount: measurements.frames[0]?.drawCount ?? 0,
      bufferBytes: measurements.frames[0]?.bufferBytes ?? 0,
      pickMs: summary(measurements.pickTimes),
      heapMiB: {
        before: beforeHeapMiB,
        after: afterHeapMiB,
        retainedGrowth: afterHeapMiB - beforeHeapMiB,
      },
    });
  }

  canvasPage.on("console", (message) =>
    consoleMessages.push({ type: message.type(), text: message.text() }),
  );
  const interaction = await canvasPage.evaluate(
    ({ resizeCount, zoomCount }) => {
      const hook = globalThis.__livingCitySpike;
      if (hook === undefined)
        throw new Error("living-city benchmark hook unavailable");
      const resizeMs = [];
      for (let index = 0; index < resizeCount; index += 1) {
        const started = performance.now();
        hook.resize(index % 2 === 0 ? 960 : 1_280, index % 2 === 0 ? 540 : 720);
        resizeMs.push(performance.now() - started);
      }
      hook.resize(1_280, 720);
      const zoomMs = [];
      for (let index = 0; index < zoomCount; index += 1) {
        const started = performance.now();
        hook.zoom(index % 2 === 0 ? 1.15 : 1.75);
        zoomMs.push(performance.now() - started);
      }
      hook.zoom(1.45);
      return { resizeMs, zoomMs };
    },
    { resizeCount: resizeSamples, zoomCount: zoomSamples },
  );

  await canvasPage.evaluate(() =>
    globalThis.__livingCitySpike?.render(256, 250_000),
  );
  await canvasPage.getByTestId("living-city-spike").screenshot({
    path: `${evidenceDirectory}/canvas-fixed.png`,
  });
  await canvasPage.evaluate(() =>
    globalThis.__livingCitySpike?.render(1_024, 250_000),
  );
  await canvasPage.getByTestId("living-city-spike").screenshot({
    path: `${evidenceDirectory}/canvas-showcase-1024.png`,
  });

  const eveningPage = await context.newPage();
  await mountSpike(
    eveningPage,
    preview.url,
    bundle,
    `backend=canvas&count=256&phase=${fixedPhase}&tick=19`,
  );
  await eveningPage.getByTestId("living-city-spike").screenshot({
    path: `${evidenceDirectory}/canvas-evening.png`,
  });
  await eveningPage.close();

  const detectedPage = await context.newPage();
  await mountSpike(
    detectedPage,
    preview.url,
    bundle,
    `count=256&phase=${fixedPhase}`,
  );
  const detected = await detectedPage.evaluate(async () => {
    const hook = globalThis.__livingCitySpike;
    if (hook === undefined)
      throw new Error("living-city benchmark hook unavailable");
    const samples = [];
    for (let index = 0; index < 30; index += 1) {
      samples.push(hook.render(256, 250_000));
      await new Promise(globalThis.requestAnimationFrame);
    }
    return {
      navigatorGpuPresent: navigator.gpu !== undefined,
      backend: hook.renderer.status()?.backend ?? "unknown",
      samples,
    };
  });
  let webgpuScreenshot = null;
  if (detected.backend === "webgpu") {
    webgpuScreenshot = `${evidenceDirectory}/webgpu-fixed.png`;
    await detectedPage.getByTestId("living-city-spike").screenshot({
      path: webgpuScreenshot,
    });
  }
  const beforeLoss = await detectedPage.evaluate(() =>
    globalThis.__livingCitySpike?.renderer.status(),
  );
  await detectedPage.getByTestId("spike-context-loss").click();
  const afterLoss = await detectedPage.evaluate(() =>
    globalThis.__livingCitySpike?.renderer.status(),
  );
  await detectedPage.getByTestId("living-city-spike").screenshot({
    path: `${evidenceDirectory}/context-loss-canvas.png`,
  });
  await detectedPage.close();

  const videoContext = await browser.newContext({
    viewport: { width: 1_280, height: 720 },
    recordVideo: { dir: bundleDirectory, size: { width: 1_280, height: 720 } },
  });
  const videoPage = await videoContext.newPage();
  await mountSpike(
    videoPage,
    preview.url,
    bundle,
    `backend=canvas&count=256&phase=${fixedPhase}&animate=1`,
  );
  await videoPage.waitForTimeout(3_500);
  const video = videoPage.video();
  await videoPage.close();
  await videoContext.close();
  if (video === null) throw new Error("walking-loop video was not recorded");
  await copyFile(await video.path(), `${evidenceDirectory}/walking-loop.webm`);

  const browserVersion = await browser.version();
  const oldBaseline = JSON.parse(
    await readFile("benchmarks/results/multi-lod-renderer.json", "utf8"),
  );
  const frozenBudgets = {
    decision: {
      fallbackLiteralFigures: 128,
      baselineLiteralFigures: 256,
      showcaseLiteralFigures: 512,
      measuredCeilingNotSelected: 1_024,
      rationale:
        "Native captures retain head/body/two-leg recognition through 512 figures. The 1024 curve remains fast but adds substantial overlap without equal readable information, so it is evidence of headroom rather than the selected showcase tier.",
    },
    canvas: {
      fallbackFrameP95MsMax: 8,
      baselineFrameP95MsMax: 12,
      showcaseFrameP95MsMax: 1000 / 60,
      browserHeapMiBMax: 64,
      retainedHeapGrowthMiBMax: 8,
      cpuPrepareP95MsMax: 4,
      drawP95MsMax: 4,
      drawCountMax: 1,
    },
    interaction: {
      pickP95MsMax: 1,
      resizeP95MsMax: 1000 / 60,
      zoomTransitionP95MsMax: 60,
    },
    webgpu: {
      status:
        detected.backend === "webgpu"
          ? "evaluated"
          : "not evaluated: no usable adapter/context on the committed headless profile",
      densityAndSemanticFloor:
        "same selected tiers and semantic keys as Canvas",
      numericUploadBudget:
        detected.backend === "webgpu"
          ? "use measured upload curve"
          : "not frozen from zero-valued Canvas fallback measurements",
    },
  };
  const densityByCount = new Map(
    density.map((point) => [point.figureCount, point]),
  );
  const budgetFailures = [];
  for (const [tier, figureCount] of Object.entries({
    fallback: frozenBudgets.decision.fallbackLiteralFigures,
    baseline: frozenBudgets.decision.baselineLiteralFigures,
    showcase: frozenBudgets.decision.showcaseLiteralFigures,
  })) {
    const point = densityByCount.get(figureCount);
    const frameBudget = frozenBudgets.canvas[`${tier}FrameP95MsMax`];
    if (point === undefined) budgetFailures.push(`${tier}.missingDensityPoint`);
    else {
      if (point.frameMs.p95 > frameBudget)
        budgetFailures.push(`${tier}.frameP95Ms`);
      if (point.heapMiB.after > frozenBudgets.canvas.browserHeapMiBMax)
        budgetFailures.push(`${tier}.browserHeapMiB`);
      if (
        point.heapMiB.retainedGrowth >
        frozenBudgets.canvas.retainedHeapGrowthMiBMax
      )
        budgetFailures.push(`${tier}.retainedHeapGrowthMiB`);
      if (point.cpuPrepareMs.p95 > frozenBudgets.canvas.cpuPrepareP95MsMax)
        budgetFailures.push(`${tier}.cpuPrepareP95Ms`);
      if (point.drawMs.p95 > frozenBudgets.canvas.drawP95MsMax)
        budgetFailures.push(`${tier}.drawP95Ms`);
      if (point.drawCount > frozenBudgets.canvas.drawCountMax)
        budgetFailures.push(`${tier}.drawCount`);
      if (point.pickMs.p95 > frozenBudgets.interaction.pickP95MsMax)
        budgetFailures.push(`${tier}.pickP95Ms`);
    }
  }
  if (interaction.resizeMs.p95 > frozenBudgets.interaction.resizeP95MsMax)
    budgetFailures.push("interaction.resizeP95Ms");
  if (interaction.zoomMs.p95 > frozenBudgets.interaction.zoomTransitionP95MsMax)
    budgetFailures.push("interaction.zoomTransitionP95Ms");
  const result = {
    schemaVersion: 1,
    benchmarkVersion: "literal-person-city-block-v1",
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    profile: {
      committedName: "apple-m1-max-32gb-chromium",
      cpu: os.cpus()[0]?.model ?? "unknown",
      logicalCores: os.cpus().length,
      totalMemoryGiB: os.totalmem() / 1_073_741_824,
      browserVersion,
      node: process.version,
      viewport: { width: 1_280, height: 720 },
      headless: true,
      warmupSamples,
      frameSamples,
      fixedTime: { tick: 17, phasePermillion: fixedPhase },
      semantic: {
        seed: "ten-billion-lives/baseline/v1",
        stateHash: "state/spike-t17",
        eventHash: "event/lantern-tide-arrival",
        manifestationHash: "manifestation/spike-harbor-block",
        cityHash: "city/spike-harbor-block-v1",
      },
    },
    historicalPointRendererComparison: {
      claimLimit:
        "Historical 250000 count is one-pixel/point work and is not a literal-person target.",
      visibleManifestations: oldBaseline.workload.visibleManifestations,
      canvasFrameP95Ms: oldBaseline.metrics.fallbackFrameTimeP95Ms,
      browserMemoryMiB: oldBaseline.metrics.browserMemoryMiB,
      source: "benchmarks/results/multi-lod-renderer.json",
    },
    canvasDensity: density,
    interaction: {
      pickSamples,
      resizeMs: summary(interaction.resizeMs),
      zoomTransitionMs: summary(interaction.zoomMs),
    },
    detectedBackend: {
      navigatorGpuPresent: detected.navigatorGpuPresent,
      backend: detected.backend,
      frameMs: summary(detected.samples.map((sample) => sample.frameMs)),
      cpuPrepareMs: summary(
        detected.samples.map((sample) => sample.cpuPrepareMs),
      ),
      uploadMs: summary(detected.samples.map((sample) => sample.uploadMs)),
      drawMs: summary(detected.samples.map((sample) => sample.drawMs)),
      drawCount: detected.samples[0]?.drawCount ?? 0,
      bufferBytes: detected.samples[0]?.bufferBytes ?? 0,
      capabilityLimit:
        detected.backend === "webgpu"
          ? null
          : "Chromium exposed no complete usable WebGPU adapter/context in this headless run; Canvas evidence is authoritative and no WebGPU visual claim is made.",
      screenshot: webgpuScreenshot,
    },
    contextLifecycle: {
      before: beforeLoss,
      after: afterLoss,
      semanticPreserved:
        beforeLoss?.semanticKey === afterLoss?.semanticKey &&
        beforeLoss?.selectedPersonId === afterLoss?.selectedPersonId,
    },
    budgets: {
      ...frozenBudgets,
      failures: budgetFailures,
      passed: budgetFailures.length === 0,
    },
    artifacts: {
      canvasFixed: `${evidenceDirectory}/canvas-fixed.png`,
      canvasShowcase: `${evidenceDirectory}/canvas-showcase-1024.png`,
      canvasEvening: `${evidenceDirectory}/canvas-evening.png`,
      contextLoss: `${evidenceDirectory}/context-loss-canvas.png`,
      webgpuFixed: webgpuScreenshot,
      walkingLoop: `${evidenceDirectory}/walking-loop.webm`,
      curves: `${evidenceDirectory}/density-curves.svg`,
    },
  };
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(
    `${evidenceDirectory}/density-curves.svg`,
    curvesSvg(density),
  );
  await writeFile(
    `${evidenceDirectory}/capability.json`,
    `${JSON.stringify(result.detectedBackend, null, 2)}\n`,
  );
  await writeFile(
    `${evidenceDirectory}/context-lifecycle.json`,
    `${JSON.stringify(result.contextLifecycle, null, 2)}\n`,
  );
  await writeFile(
    `${evidenceDirectory}/semantic-transcript.json`,
    `${JSON.stringify(result.profile.semantic, null, 2)}\n`,
  );
  const externalRequests = requests.filter(
    (url) => new URL(url).origin !== new URL(preview.url).origin,
  );
  const errorMessages = consoleMessages.filter(
    (message) => message.type === "error",
  );
  await writeFile(
    `${evidenceDirectory}/request-console-log.json`,
    `${JSON.stringify(
      { requests, externalRequests, consoleMessages, errorMessages },
      null,
      2,
    )}\n`,
  );
  if (externalRequests.length > 0 || errorMessages.length > 0)
    throw new Error(
      "living-city benchmark emitted external requests or console errors",
    );
  if (budgetFailures.length > 0)
    throw new Error(
      `living-city frozen budgets failed: ${budgetFailures.join(", ")}`,
    );
  const artifacts = Object.values(result.artifacts).filter(
    (artifact) => artifact !== null,
  );
  const hashes = Object.fromEntries(
    await Promise.all(
      artifacts.map(async (artifact) => [artifact, await sha256(artifact)]),
    ),
  );
  await writeFile(
    `${evidenceDirectory}/artifact-hashes.json`,
    `${JSON.stringify(hashes, null, 2)}\n`,
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await context.close();
  await browser.close();
  await preview.close();
}
