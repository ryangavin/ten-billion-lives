import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { chromium } from "@playwright/test";

import { startProductionPreview } from "./lib/production-preview.mjs";

const evidenceDirectory = "docs/evidence/issue-34";
const videoDirectory = "/private/tmp/ten-billion-lives-issue-34-video";
const profile = "apple-m1-max-32gb-chromium";
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

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

async function setEvidenceDrawer(page, open) {
  await page.locator("details.evidence-drawer").evaluate((drawer, value) => {
    drawer.open = value;
    drawer.dispatchEvent(new Event("toggle"));
  }, open);
}

async function capture(page, name, expectedTitle) {
  await assert.doesNotReject(async () => {
    await page.getByTestId("city-story-title").waitFor();
  });
  assert.equal(
    await page.getByTestId("city-story-title").textContent(),
    expectedTitle,
  );
  await page.waitForTimeout(250);
  const path = `${evidenceDirectory}/${name}.png`;
  await page.getByTestId("journey-renderer").screenshot({ path });
  return {
    name,
    path,
    phase: await page
      .getByTestId("city-story")
      .getAttribute("data-story-phase"),
    title: await page.getByTestId("city-story-title").textContent(),
    route: await page.getByTestId("city-story-route").textContent(),
    event: await page.getByTestId("city-story-event").textContent(),
    eventIds: await page
      .getByTestId("city-story")
      .getAttribute("data-event-ids"),
    stateHash: await page.getByTestId("state-hash").textContent(),
    manifestationHash: await page
      .getByTestId("manifestation-hash-a")
      .textContent(),
    eventHash: await page.getByTestId("projection-event-hash-a").textContent(),
    trajectoryHash: await page.getByTestId("living-city-hash-a").textContent(),
    frameMs: Number.parseFloat(
      (await page.getByTestId("render-frame-time").textContent()) ?? "NaN",
    ),
  };
}

await mkdir(evidenceDirectory, { recursive: true });
await mkdir(videoDirectory, { recursive: true });
const preview = await startProductionPreview();
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1_280, height: 800 },
  recordVideo: { dir: videoDirectory, size: { width: 1_280, height: 800 } },
});
const page = await context.newPage();
const video = page.video();
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

const transitionsMs = [];
const captures = [];
try {
  await page.goto(`${preview.url}/?renderer=canvas&quality=fallback`, {
    waitUntil: "networkidle",
  });
  transitionsMs.push(
    await measure(async () => {
      await page.getByRole("button", { name: "Visit Lantern Tide" }).click();
      await page.getByTestId("city-story-title").waitFor();
    }),
  );
  captures.push(await capture(page, "festival-peak", "Lantern Tide peak"));

  for (const state of [
    ["17", "festival-arrival", "Lantern Tide arrival"],
    ["19", "festival-peak", "Lantern Tide peak"],
    ["21", "festival-departure", "Lantern Tide departure"],
    ["10", "meeting", "Shared-place meeting"],
  ]) {
    const [tick, name, title] = state;
    transitionsMs.push(
      await measure(async () => {
        await page
          .getByRole("combobox", { name: "Signature moment" })
          .selectOption(tick);
        await page
          .getByTestId("city-story-title")
          .filter({ hasText: title })
          .waitFor();
      }),
    );
    if (name !== "festival-peak")
      captures.push(await capture(page, name, title));
  }

  await setEvidenceDrawer(page, true);
  await page.getByRole("button", { name: "Initialize observer B" }).click();
  await page.getByTestId("observer-match").waitFor();
  assert.equal(
    await page.getByTestId("observer-match").textContent(),
    "Semantic match · trajectory match",
  );
  assert.equal(
    await page.getByTestId("semantic-events-b").textContent(),
    await page.getByTestId("semantic-events-a").textContent(),
  );
  assert.equal(
    await page.getByTestId("living-city-hash-b").textContent(),
    await page.getByTestId("living-city-hash-a").textContent(),
  );
  await setEvidenceDrawer(page, false);

  transitionsMs.push(
    await measure(async () => {
      await page
        .getByRole("button", { name: "Explore closure branch" })
        .click();
      await page
        .getByTestId("city-story-title")
        .filter({ hasText: "Closure detour" })
        .waitFor();
    }),
  );
  assert.equal(
    await page.getByTestId("branch-field-match").textContent(),
    "Identical field state",
  );
  captures.push(await capture(page, "closure-detour", "Closure detour"));

  transitionsMs.push(
    await measure(async () => {
      await page
        .getByRole("button", { name: "View immutable baseline" })
        .click();
      await page
        .getByTestId("city-story-title")
        .filter({ hasText: "Commuting flow" })
        .waitFor();
    }),
  );
  captures.push(await capture(page, "baseline-route", "Commuting flow"));
  assert.match(captures.at(-1)?.route ?? "", /daily commute · 1 graph edge/);

  await page.goto(`${preview.url}/?renderer=canvas&quality=fallback`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "Enter Brindle Bay" }).click();
  await page.getByRole("button", { name: "Enter Harbor Street" }).click();
  await page.getByRole("button", { name: "Meet a resident" }).click();
  await page
    .getByRole("combobox", { name: "Signature moment" })
    .selectOption("7");
  captures.push(await capture(page, "morning-commute", "Commuting flow"));
  await page
    .getByRole("combobox", { name: "Signature moment" })
    .selectOption("16");
  captures.push(await capture(page, "evening-commute", "Commuting flow"));

  await page.requestGC();
  const retainedHeapMiB = await page.evaluate(
    () => (performance.memory?.usedJSHeapSize ?? 0) / 1_048_576,
  );
  const maximumFrameMs = Math.max(...captures.map((entry) => entry.frameMs));
  const maximumTransitionMs = Math.max(...transitionsMs);
  const budgets = {
    frameMsMax: 16.67,
    retainedHeapMiBMax: 128,
  };
  process.stdout.write(
    `Visible-city metrics ${JSON.stringify({ transitionsMs, maximumFrameMs, retainedHeapMiB })}\n`,
  );
  assert(Number.isFinite(maximumFrameMs));
  assert(maximumFrameMs <= budgets.frameMsMax);
  assert(retainedHeapMiB <= budgets.retainedHeapMiBMax);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(externalRequests, []);

  await page.close();
  await context.close();
  assert(video !== null, "story time-lapse was not initialized");
  const recording = `${evidenceDirectory}/visible-city-story.webm`;
  await copyFile(await video.path(), recording);
  const artifacts = [];
  for (const path of [...captures.map((entry) => entry.path), recording])
    artifacts.push({ path, sha256: await sha256(path) });
  await writeFile(
    `${evidenceDirectory}/evidence-index.json`,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        commit,
        profile,
        browser: await browser.version(),
        captures,
        observerEquality: {
          events: true,
          routesAndTrajectories: true,
        },
        closureConservation: true,
        metrics: { maximumFrameMs, retainedHeapMiB, maximumTransitionMs },
        budgets: { ...budgets, passed: true },
        audits: { consoleErrors, pageErrors, externalRequests },
        artifacts,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  if (!page.isClosed()) await page.close();
  await context.close().catch(() => undefined);
  await browser.close();
  await preview.close();
}
