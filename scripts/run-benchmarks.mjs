import { execFileSync, spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { chromium } from "@playwright/test";

const SEED = "ten-billion-lives/benchmark/v1";
const RESULT_PATH = "benchmarks/results/local-baseline.json";
const REPORT_PATH = "benchmarks/results/local-baseline.md";

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))
  ];
}

function measureCpu() {
  const cellCount = 65_536;
  const cells = new BigInt64Array(cellCount);
  cells.fill(152_588n);
  const simulationSamples = [];

  for (let sample = 0; sample < 7; sample += 1) {
    const started = performance.now();
    for (let pass = 0; pass < 12; pass += 1) {
      for (let index = 0; index < cellCount; index += 1) {
        const next = (index + 1) % cellCount;
        cells[index] -= 1n;
        cells[next] += 1n;
      }
    }
    simulationSamples.push(
      (cellCount * 12 * 1000) / (performance.now() - started),
    );
  }

  const snapshot = {
    schemaVersion: 1,
    seed: SEED,
    tick: 720,
    population: Array.from(cells.slice(0, 16_384), String),
  };
  const serializeSamples = [];
  const replaySamples = [];
  let serialized;

  for (let sample = 0; sample < 9; sample += 1) {
    let started = performance.now();
    serialized = JSON.stringify(snapshot);
    serializeSamples.push(
      Buffer.byteLength(serialized) /
        1_048_576 /
        ((performance.now() - started) / 1000),
    );
    started = performance.now();
    for (let repeat = 0; repeat < 20; repeat += 1) JSON.parse(serialized);
    replaySamples.push((20 * 1000) / (performance.now() - started));
  }

  const identitySamples = [];
  for (let sample = 0; sample < 7; sample += 1) {
    let hash = 2_166_136_261;
    const started = performance.now();
    for (let index = 0; index < 500_000; index += 1) {
      hash = Math.imul(hash ^ index ^ sample, 16_777_619) >>> 0;
    }
    if (hash === -1) throw new Error("unreachable identity hash sentinel");
    identitySamples.push(500_000_000 / (performance.now() - started));
  }

  return {
    metrics: {
      simulationCellsPerSecond: percentile(simulationSamples, 0.5),
      snapshotSerializeMiBPerSecond: percentile(serializeSamples, 0.5),
      replaySnapshotsPerSecond: percentile(replaySamples, 0.5),
      identitiesPerSecond: percentile(identitySamples, 0.5),
    },
    percentiles: {
      simulationCellsPerSecond: {
        p50: percentile(simulationSamples, 0.5),
        p95: percentile(simulationSamples, 0.95),
      },
      snapshotSerializeMiBPerSecond: {
        p50: percentile(serializeSamples, 0.5),
        p95: percentile(serializeSamples, 0.95),
      },
      replaySnapshotsPerSecond: {
        p50: percentile(replaySamples, 0.5),
        p95: percentile(replaySamples, 0.95),
      },
      identitiesPerSecond: {
        p50: percentile(identitySamples, 0.5),
        p95: percentile(identitySamples, 0.95),
      },
    },
    workload: {
      cellCount,
      simulationPassesPerSample: 12,
      snapshotCells: 16_384,
      identityCountPerSample: 500_000,
      layout: "scaffold-typed-arrays-v1",
    },
  };
}

async function waitForPreview(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The local preview may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Preview did not become ready: ${url}`);
}

async function measureBrowser(qualityTiers) {
  const preview = spawn(
    "pnpm",
    ["preview", "--host", "127.0.0.1", "--port", "4173"],
    { stdio: "ignore" },
  );
  try {
    await waitForPreview("http://127.0.0.1:4173");
    const browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
    await page.getByTestId("smoke-status").waitFor();
    const measured = await page.evaluate(async (tiers) => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const startupMs = navigation ? navigation.duration : performance.now();
      let detailedMemory = null;
      if (performance.measureUserAgentSpecificMemory) {
        try {
          detailedMemory = await performance.measureUserAgentSpecificMemory();
        } catch {
          // Some Chromium modes expose the API but reject collection.
        }
      }
      const memory =
        detailedMemory?.bytes ?? performance.memory?.usedJSHeapSize ?? 0;
      const memoryMethod = detailedMemory
        ? "measureUserAgentSpecificMemory"
        : "performance.memory.usedJSHeapSize";
      const gpu = navigator.gpu;
      const adapter = gpu ? await gpu.requestAdapter() : null;
      const canvas = globalThis.document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Canvas2D fallback unavailable");
      const tierMetrics = {};
      for (const [tier, config] of Object.entries(tiers)) {
        const points = new Uint32Array(config.renderedManifestations);
        for (let index = 0; index < points.length; index += 1)
          points[index] = Math.imul(index + 1, 2654435761) >>> 0;
        const frames = [];
        for (let frame = 0; frame < 9; frame += 1) {
          const started = performance.now();
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = "#77e1ac";
          for (let index = 0; index < points.length; index += 1) {
            const value = points[index];
            context.fillRect(value % 1280, ((value / 1280) >>> 0) % 720, 1, 1);
          }
          frames.push(performance.now() - started);
        }
        frames.sort((left, right) => left - right);
        tierMetrics[tier] = {
          renderedManifestations: points.length,
          frameTimeP50Ms: frames[Math.floor(frames.length * 0.5)],
          frameTimeP95Ms: frames[Math.floor(frames.length * 0.95)],
        };
      }
      return {
        startupMs,
        browserMemoryMiB: memory / 1_048_576,
        memoryMethod,
        webgpu: {
          navigatorPresent: Boolean(gpu),
          adapterAvailable: Boolean(adapter),
          selectedProfile: adapter ? "webgpu" : "fallback",
        },
        tierMetrics,
      };
    }, qualityTiers);
    const browserVersion = await browser.version();
    await browser.close();
    return { ...measured, browserVersion };
  } finally {
    preview.kill("SIGINT");
  }
}

const budgets = JSON.parse(await readFile("benchmarks/budgets.json", "utf8"));
const profile = JSON.parse(
  await readFile("benchmarks/profiles/apple-m1-max.json", "utf8"),
);
const cpu = measureCpu();
const browser = await measureBrowser(budgets.qualityTiers);
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const result = {
  schemaVersion: 1,
  benchmarkVersion: "local-scaffold-v1",
  commit,
  seed: SEED,
  generatedAt: new Date().toISOString(),
  profile,
  workload: { ...cpu.workload, qualityTiers: budgets.qualityTiers },
  capabilities: {
    webgpu: browser.webgpu,
    fallback: { canvas2d: true, profile: "fallback" },
    memoryMeasurement: browser.memoryMethod,
  },
  percentiles: { ...cpu.percentiles, render: browser.tierMetrics },
  metrics: {
    ...cpu.metrics,
    baselineFrameTimeP95Ms: browser.tierMetrics.baseline.frameTimeP95Ms,
    browserMemoryMiB: browser.browserMemoryMiB,
    startupMs: browser.startupMs,
  },
  browser: { version: browser.browserVersion, device: profile.device },
};

const report = `# Local benchmark baseline\n\n- Revision: \`${commit}\`\n- Seed: \`${SEED}\`\n- Profile: \`${profile.profileId}\`\n- Browser: ${browser.browserVersion}\n\n## Capability\n\n- WebGPU navigator: ${browser.webgpu.navigatorPresent}\n- WebGPU adapter: ${browser.webgpu.adapterAvailable}\n- Selected profile: **${browser.webgpu.selectedProfile}**\n- Canvas2D fallback: available\n\n## Metrics\n\n| Metric | Result |\n| --- | ---: |\n${Object.entries(
  result.metrics,
)
  .map(([name, value]) => `| ${name} | ${value.toFixed(2)} |`)
  .join(
    "\n",
  )}\n\n## Render tiers\n\n| Tier | Manifestations | p50 frame ms | p95 frame ms |\n| --- | ---: | ---: | ---: |\n${Object.entries(
  browser.tierMetrics,
)
  .map(
    ([name, value]) =>
      `| ${name} | ${value.renderedManifestations} | ${value.frameTimeP50Ms.toFixed(2)} | ${value.frameTimeP95Ms.toFixed(2)} |`,
  )
  .join(
    "\n",
  )}\n\nThe CPU workloads use the current production-compatible typed-array/integer seams. They are scaffold workloads, not final world-kernel claims, and must be replaced in-place as #6–#14 add production layouts. The 250k/60 FPS and 256 MiB figures remain aspirations; the regression command enforces only coarse catastrophic limits to avoid noisy M0 micro-thresholds.\n`;

await mkdir("benchmarks/results", { recursive: true });
await Promise.all([
  writeFile(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`),
  writeFile(REPORT_PATH, report),
]);
console.log(`Wrote ${RESULT_PATH} and ${REPORT_PATH}`);
