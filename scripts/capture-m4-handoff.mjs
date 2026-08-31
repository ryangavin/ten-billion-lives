import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { chromium, devices } from "@playwright/test";

import { startProductionPreview } from "./lib/production-preview.mjs";

/* global document, innerHeight, innerWidth */

const evidenceDirectory = process.argv[2] ?? "docs/evidence/issue-37";
const videoDirectory = "/private/tmp/ten-billion-lives-issue-37-video";
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

function observe(page, previewOrigin) {
  const audit = { consoleErrors: [], pageErrors: [], externalRequests: [] };
  page.on("console", (message) => {
    if (message.type() === "error") audit.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => audit.pageErrors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== previewOrigin)
      audit.externalRequests.push(request.url());
  });
  return audit;
}

async function setEvidenceDrawer(page, open) {
  await page.locator("details.evidence-drawer").evaluate((drawer, value) => {
    drawer.open = value;
    drawer.dispatchEvent(new Event("toggle"));
  }, open);
}

async function selectVisibleResident(page) {
  const renderer = page.getByTestId("journey-renderer");
  const canvas = page.locator("[data-render-surface]:not([hidden])");
  const [bounds, size, x, y] = await Promise.all([
    canvas.boundingBox(),
    canvas.evaluate((element) => ({
      width: element.width,
      height: element.height,
    })),
    renderer.getAttribute("data-selected-screen-x"),
    renderer.getAttribute("data-selected-screen-y"),
  ]);
  assert(bounds !== null, "visible renderer has no bounds");
  assert(Number.isFinite(Number(x)) && Number.isFinite(Number(y)));
  await canvas.click({
    position: {
      x: (Number(x) / size.width) * bounds.width,
      y: (Number(y) / size.height) * bounds.height,
    },
  });
}

async function captureRenderer(page, name, states) {
  const path = `${evidenceDirectory}/${name}.png`;
  await page.getByTestId("journey-renderer").screenshot({ path });
  const textIfPresent = async (testId) => {
    const locator = page.getByTestId(testId);
    return (await locator.count()) === 0 ? null : locator.textContent();
  };
  const story = page.getByTestId("city-story");
  const storyPhase =
    (await story.count()) === 0
      ? null
      : await story.getAttribute("data-story-phase");
  states.push({
    name,
    title: await textIfPresent("city-story-title"),
    phase: storyPhase,
    personTick: await textIfPresent("person-tick"),
    stateHash: await textIfPresent("state-hash"),
    manifestationHash: await textIfPresent("manifestation-hash-a"),
    eventHash: await textIfPresent("projection-event-hash-a"),
    cityHash: await textIfPresent("living-city-hash-a"),
  });
  return path;
}

async function layout(page) {
  return page.evaluate(() => {
    const bounds = document
      .querySelector('[data-testid="journey-renderer"]')
      ?.getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      renderer: bounds ? { width: bounds.width, height: bounds.height } : null,
    };
  });
}

await mkdir(evidenceDirectory, { recursive: true });
await mkdir(videoDirectory, { recursive: true });
const preview = await startProductionPreview();
const previewOrigin = new URL(preview.url).origin;
const browser = await chromium.launch();
const artifacts = [];
let desktopContext;
let desktop;

try {
  desktopContext = await browser.newContext({
    viewport: { width: 1_440, height: 900 },
    recordVideo: { dir: videoDirectory, size: { width: 1_440, height: 900 } },
  });
  desktop = await desktopContext.newPage();
  const video = desktop.video();
  const desktopAudit = observe(desktop, previewOrigin);
  const states = [];
  await desktop.goto(`${preview.url}/?renderer=canvas&quality=baseline`, {
    waitUntil: "networkidle",
  });
  assert.equal(
    await desktop.getByTestId("represented-population").textContent(),
    "10,000,000,000",
  );
  artifacts.push(await captureRenderer(desktop, "01-planet", states));

  await desktop.getByRole("button", { name: "Enter Brindle Bay" }).click();
  await desktop
    .locator('[data-render-stack][data-city-level="city"]')
    .waitFor();
  artifacts.push(await captureRenderer(desktop, "02-city", states));
  const phaseBefore = await desktop
    .getByTestId("journey-renderer")
    .getAttribute("data-projection-key");
  await desktop
    .getByRole("button", {
      name: "60 simulated minutes per real second",
      exact: true,
    })
    .click();
  await desktop.getByRole("button", { name: "Play local time" }).click();
  await desktop.waitForFunction(
    (key) =>
      document
        .querySelector('[data-testid="journey-renderer"]')
        ?.getAttribute("data-projection-key") !== key,
    phaseBefore,
  );
  await desktop.getByRole("button", { name: "Pause local time" }).click();

  await desktop.getByRole("button", { name: "Zoom neighborhood" }).click();
  await desktop
    .locator('[data-render-stack][data-city-level="neighborhood"]')
    .waitFor();
  artifacts.push(await captureRenderer(desktop, "03-neighborhood", states));
  await desktop.getByRole("button", { name: "Zoom street" }).click();
  await desktop
    .locator('[data-render-stack][data-city-level="street"]')
    .waitFor();
  artifacts.push(await captureRenderer(desktop, "04-street", states));
  await selectVisibleResident(desktop);
  const selectedPersonId = await desktop
    .getByTestId("observer-a-person-id")
    .textContent();
  assert.match(selectedPersonId ?? "", /^person_/);
  await desktop.getByRole("button", { name: "View person" }).click();
  assert.equal(
    await desktop.getByTestId("observer-a-stage").textContent(),
    "Person",
  );
  artifacts.push(await captureRenderer(desktop, "05-follow-person", states));

  await desktop
    .getByRole("combobox", { name: "Signature moment" })
    .selectOption("7");
  assert.equal(
    await desktop.getByTestId("city-story-title").textContent(),
    "Commuting flow",
  );
  artifacts.push(await captureRenderer(desktop, "06-commute", states));
  await desktop
    .getByRole("combobox", { name: "Signature moment" })
    .selectOption("10");
  assert.equal(
    await desktop.getByTestId("city-story-title").textContent(),
    "Shared-place meeting",
  );
  artifacts.push(await captureRenderer(desktop, "07-meeting", states));

  await desktop.getByRole("button", { name: "Visit Lantern Tide" }).click();
  for (const [tick, name, title] of [
    ["17", "08-festival-arrival", "Lantern Tide arrival"],
    ["19", "09-festival-peak", "Lantern Tide peak"],
    ["21", "10-festival-departure", "Lantern Tide departure"],
  ]) {
    await desktop
      .getByRole("combobox", { name: "Signature moment" })
      .selectOption(tick);
    assert.equal(
      await desktop.getByTestId("city-story-title").textContent(),
      title,
    );
    artifacts.push(await captureRenderer(desktop, name, states));
  }

  await desktop.getByRole("button", { name: "Explore closure branch" }).click();
  assert.equal(
    await desktop.getByTestId("city-story-title").textContent(),
    "Closure detour",
  );
  assert.equal(
    await desktop.getByTestId("branch-field-match").textContent(),
    "Identical field state",
  );
  artifacts.push(await captureRenderer(desktop, "11-closure", states));

  await setEvidenceDrawer(desktop, true);
  await desktop.getByRole("button", { name: "Initialize observer B" }).click();
  assert.equal(
    await desktop.getByTestId("observer-match").textContent(),
    "Semantic match · trajectory match",
  );
  const observerAHash = await desktop
    .getByTestId("living-city-hash-a")
    .textContent();
  assert.equal(
    await desktop.getByTestId("living-city-hash-b").textContent(),
    observerAHash,
  );
  const semanticBeforeCamera = {
    state: await desktop.getByTestId("state-hash").textContent(),
    manifestation: await desktop
      .getByTestId("manifestation-hash-a")
      .textContent(),
    event: await desktop.getByTestId("projection-event-hash-a").textContent(),
    city: observerAHash,
  };
  await setEvidenceDrawer(desktop, false);
  await desktop.getByRole("button", { name: "Orbit camera" }).click();
  const semanticAfterCamera = {
    state: await desktop.getByTestId("state-hash").textContent(),
    manifestation: await desktop
      .getByTestId("manifestation-hash-a")
      .textContent(),
    event: await desktop.getByTestId("projection-event-hash-a").textContent(),
    city: await desktop.getByTestId("living-city-hash-a").textContent(),
  };
  assert.deepEqual(semanticAfterCamera, semanticBeforeCamera);

  await desktop
    .getByRole("combobox", { name: "Signature moment" })
    .selectOption("7");
  const seekKey = await desktop
    .getByTestId("journey-renderer")
    .getAttribute("data-projection-key");
  await setEvidenceDrawer(desktop, true);
  await desktop.getByRole("button", { name: "Rewind and replay" }).click();
  assert.equal(
    await desktop
      .getByTestId("journey-renderer")
      .getAttribute("data-projection-key"),
    seekKey,
  );
  await desktop.getByRole("button", { name: "Reveal fields" }).click();
  assert.match(
    (await desktop.getByTestId("reality-budget").textContent()) ?? "",
    /0 person rows/,
  );
  assert.match(
    (await desktop.getByTestId("living-city-summary").textContent()) ?? "",
    /weight one/,
  );
  const desktopPath = `${evidenceDirectory}/12-desktop-complete.png`;
  await desktop.screenshot({ path: desktopPath, fullPage: true });
  artifacts.push(desktopPath);
  const desktopLayout = await layout(desktop);
  assert(desktopLayout.renderer?.width > 1_000);
  assert(desktopLayout.renderer?.height > 600);
  assert(desktopLayout.document.height <= desktopLayout.viewport.height);
  const axe = await new AxeBuilder({ page: desktop }).analyze();
  const seriousOrCritical = axe.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  assert.deepEqual(seriousOrCritical, []);
  assert.deepEqual(desktopAudit, {
    consoleErrors: [],
    pageErrors: [],
    externalRequests: [],
  });

  await desktop.close();
  await desktopContext.close();
  assert(video !== null, "handoff recording was not initialized");
  const recording = `${evidenceDirectory}/complete-journey.webm`;
  await copyFile(await video.path(), recording);
  artifacts.push(recording);

  const narrowContext = await browser.newContext(devices["Pixel 7"]);
  const narrow = await narrowContext.newPage();
  const narrowAudit = observe(narrow, previewOrigin);
  await narrow.goto(`${preview.url}/?renderer=canvas&quality=fallback`, {
    waitUntil: "networkidle",
  });
  await narrow.getByRole("button", { name: "Enter Brindle Bay" }).tap();
  await narrow.getByRole("button", { name: "Enter Harbor Street" }).tap();
  const narrowPath = `${evidenceDirectory}/13-narrow-independent.png`;
  await narrow.screenshot({ path: narrowPath, fullPage: true });
  artifacts.push(narrowPath);
  const narrowLayout = await layout(narrow);
  assert(narrowLayout.document.height <= narrowLayout.viewport.height);
  assert.deepEqual(narrowAudit, {
    consoleErrors: [],
    pageErrors: [],
    externalRequests: [],
  });
  await narrowContext.close();

  const checksums = [];
  for (const path of artifacts)
    checksums.push({ path, sha256: await sha256(path) });
  const report = {
    schemaVersion: 1,
    issue: 37,
    commit,
    browser: await browser.version(),
    journey: [
      "planet",
      "Brindle Bay",
      "continuous playback",
      "neighborhood",
      "street",
      "pick and follow resident",
      "commute",
      "meeting",
      "Lantern Tide arrival, peak, and departure",
      "closure",
      "observer B",
      "rewind and replay",
      "field and reality budget",
    ],
    selectedPersonId,
    observerEquality: true,
    cameraSemanticIndependence: {
      before: semanticBeforeCamera,
      after: semanticAfterCamera,
      equal: true,
    },
    replayEquality: { seekKey, replayKey: seekKey, equal: true },
    exactPopulation: "10000000000",
    storedPersonRows: 0,
    selectedVisibleWeight: 1,
    states,
    layouts: { desktop: desktopLayout, narrow: narrowLayout },
    accessibility: {
      engine: axe.testEngine,
      seriousOrCritical,
    },
    audits: { desktop: desktopAudit, narrow: narrowAudit },
    artifacts: checksums,
  };
  await writeFile(
    `${evidenceDirectory}/complete-journey.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  if (desktop && !desktop.isClosed()) await desktop.close();
  if (desktopContext) await desktopContext.close().catch(() => undefined);
  await browser.close();
  await preview.close();
}
