import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { build } from "vite";

const bundleDirectory =
  "/private/tmp/ten-billion-lives-m4-32-spike-browser-case";
const bundlePath = path.join(bundleDirectory, "living-city-spike.js");
let bundle = "";

async function installSpikeBundle(
  page: import("@playwright/test").Page,
  query: string,
) {
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
  await page.goto(`/living-city-spike-host?${query}`);
}

test.beforeAll(async () => {
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
  bundle = await readFile(bundlePath, "utf8");
});

test("fixed-time literal people keep stable picking through Canvas lifecycle", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "canonical spike browser case",
  );
  await installSpikeBundle(page, "backend=canvas&count=256&phase=250000");
  await expect(page.getByTestId("spike-backend")).toHaveText("canvas2d");
  await expect(page.getByTestId("spike-count")).toHaveText("256");
  await expect(page.getByTestId("spike-fixed-time")).toHaveText(
    "Tick 17 + 25.0000%",
  );
  await expect(page.getByTestId("spike-summary")).toContainText(
    "person/spike-000000, weight one, walking",
  );

  const before = await page.evaluate(() => {
    const hook = globalThis.__livingCitySpike;
    if (hook === undefined)
      throw new Error("living-city spike hook unavailable");
    const status = hook.renderer.status();
    const selectedPoint = hook.selectedPoint();
    if (selectedPoint === null) throw new Error("selected point unavailable");
    const picked = hook.renderer.pick(
      selectedPoint.x,
      selectedPoint.y,
      "living-city/state-spike/event-lantern/t17-p250000",
    );
    return { status, picked };
  });
  expect(before.status).toMatchObject({
    backend: "canvas2d",
    semanticKey: "living-city/state-spike/event-lantern/t17-p250000",
    selectedPersonId: "person/spike-000000",
    figureCount: 256,
    drawCount: 1,
  });
  expect(before.picked).toMatchObject({
    personId: "person/spike-000000",
    renderKey: 1,
    representedWeight: 1n,
  });

  await page.getByTestId("spike-context-loss").click();
  const after = await page.evaluate(() =>
    globalThis.__livingCitySpike?.renderer.status(),
  );
  expect(after).toMatchObject({
    backend: "canvas2d",
    semanticKey: before.status?.semanticKey,
    selectedPersonId: before.status?.selectedPersonId,
    lifecycle: { contextLosses: 1 },
  });

  const resize = await page.evaluate(() =>
    globalThis.__livingCitySpike?.resize(960, 540),
  );
  expect(resize).toMatchObject({
    backend: "canvas2d",
    semanticKey: before.status?.semanticKey,
    selectedPersonId: before.status?.selectedPersonId,
  });
});

test("uses WebGPU only when the browser exposes a complete usable context", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "canonical capability probe");
  await installSpikeBundle(page, "count=128&phase=250000");
  await expect(page.getByTestId("spike-backend")).toHaveText(/canvas2d|webgpu/);
  const capability = await page.evaluate(() => ({
    navigatorGpu: navigator.gpu !== undefined,
    status: globalThis.__livingCitySpike?.renderer.status(),
    canvasVisible: !globalThis.document.querySelector<HTMLCanvasElement>(
      "[data-spike-backend=canvas2d]",
    )?.hidden,
    gpuVisible: !globalThis.document.querySelector<HTMLCanvasElement>(
      "[data-spike-backend=webgpu]",
    )?.hidden,
  }));
  expect(capability.status?.backend).toMatch(/canvas2d|webgpu/);
  expect(capability.canvasVisible).toBe(
    capability.status?.backend === "canvas2d",
  );
  expect(capability.gpuVisible).toBe(capability.status?.backend === "webgpu");
  if (!capability.navigatorGpu)
    expect(capability.status?.backend).toBe("canvas2d");
});
