import { execFileSync, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

import { chromium } from "@playwright/test";

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))
  ];
}

async function waitForPreview(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The local production preview may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Preview did not become ready: ${url}`);
}

const preview = spawn(
  "pnpm",
  ["preview", "--host", "127.0.0.1", "--port", "4173"],
  { stdio: "ignore" },
);
try {
  await mkdir("docs/evidence/issue-13", { recursive: true });
  await waitForPreview("http://127.0.0.1:4173");
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await page.goto("http://127.0.0.1:4173/?renderer=canvas", {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "Enter Brindle Bay" }).click();
  await page.getByRole("button", { name: "Enter Harbor Street" }).click();
  await page.getByTestId("render-backend").waitFor();
  const benchmark = await page.evaluate(() => {
    const run = globalThis.__tenBillionRenderBenchmark;
    if (run === undefined) throw new Error("render benchmark hook unavailable");
    return run(1280, 720, 11);
  });
  const samples = benchmark.frameTimesMs;
  if (samples.some((sample) => !Number.isFinite(sample)))
    throw new Error("renderer benchmark produced a non-finite sample");
  const browserMetrics = await page.evaluate(() => {
    const canvas = globalThis.document.querySelector(
      "[data-render-surface=canvas2d]",
    );
    const memory = performance.memory?.usedJSHeapSize ?? 0;
    return {
      canvasWidth: canvas?.width ?? 0,
      canvasHeight: canvas?.height ?? 0,
      browserMemoryMiB: memory / 1_048_576,
      webgpuNavigatorPresent: Boolean(navigator.gpu),
    };
  });
  const fallbackScreenshot =
    "docs/evidence/issue-13/street-baseline-canvas.png";
  await page.getByTestId("journey-renderer").screenshot({
    path: fallbackScreenshot,
  });
  const detectedPage = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await detectedPage.goto("http://127.0.0.1:4173/", {
    waitUntil: "networkidle",
  });
  await detectedPage.getByRole("button", { name: "Enter Brindle Bay" }).click();
  await detectedPage
    .getByRole("button", { name: "Enter Harbor Street" })
    .click();
  await detectedPage.getByTestId("render-backend").waitFor();
  const detectedSamples = [];
  for (let sample = 0; sample < 7; sample += 1) {
    await detectedPage
      .getByTestId("journey-renderer")
      .evaluate((element, index) => {
        element.style.width = index % 2 === 0 ? "99%" : "100%";
      }, sample);
    await detectedPage.waitForTimeout(50);
    const frame = await detectedPage
      .getByTestId("render-frame-time")
      .textContent();
    detectedSamples.push(Number.parseFloat(frame ?? "NaN"));
  }
  const detectedBackend =
    (await detectedPage.getByTestId("render-backend").textContent()) ??
    "unknown";
  if (detectedSamples.some((sample) => !Number.isFinite(sample)))
    throw new Error("detected renderer produced a non-finite sample");
  const browserVersion = await browser.version();
  await browser.close();

  const metrics = {
    fallbackFrameTimeP50Ms: percentile(samples, 0.5),
    fallbackFrameTimeP95Ms: percentile(samples, 0.95),
    browserMemoryMiB: browserMetrics.browserMemoryMiB,
    detectedBackendFrameTimeP50Ms: percentile(detectedSamples, 0.5),
    detectedBackendFrameTimeP95Ms: percentile(detectedSamples, 0.95),
  };
  const budgets = {
    visibleManifestationsMin: 250_000,
    fallbackFrameTimeP95MsMax: 16.67,
    browserMemoryMiBMax: 256,
  };
  const visibleManifestations = benchmark.visibleCount;
  const failures = [];
  if (visibleManifestations < budgets.visibleManifestationsMin)
    failures.push("visibleManifestations");
  if (metrics.fallbackFrameTimeP95Ms > budgets.fallbackFrameTimeP95MsMax)
    failures.push("fallbackFrameTimeP95Ms");
  if (metrics.browserMemoryMiB > budgets.browserMemoryMiBMax)
    failures.push("browserMemoryMiB");
  if (failures.length > 0) {
    console.error(
      JSON.stringify(
        {
          workload: {
            canvasWidth: 1280,
            canvasHeight: 720,
            visibleManifestations,
          },
          metrics,
          budgets,
        },
        null,
        2,
      ),
    );
    throw new Error(`renderer budgets failed: ${failures.join(", ")}`);
  }

  const result = {
    schemaVersion: 1,
    benchmarkVersion: "multi-lod-renderer-v1",
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    browser: { version: browserVersion },
    workload: {
      stage: "street",
      backend: "canvas2d",
      detectedBackend,
      webgpuNavigatorPresent: browserMetrics.webgpuNavigatorPresent,
      canvasWidth: 1280,
      canvasHeight: 720,
      visibleManifestations,
      bufferBytes: benchmark.bufferBytes,
      frameSamples: samples.length,
      detectedBackendFrameSamples: detectedSamples.length,
      drawStrategy: "typed-pixel-buffer",
      screenshot: fallbackScreenshot,
    },
    metrics,
    budgets: { ...budgets, passed: true },
  };
  await writeFile(
    "benchmarks/results/multi-lod-renderer.json",
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  preview.kill("SIGINT");
}
