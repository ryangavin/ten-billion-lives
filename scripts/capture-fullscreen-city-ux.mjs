import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { chromium, devices } from "@playwright/test";

import { startProductionPreview } from "./lib/production-preview.mjs";

/* global document, innerHeight, innerWidth */

const evidenceDirectory = "docs/evidence/issue-35";
const videoDirectory = "/private/tmp/ten-billion-lives-issue-35-video";
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

function observeErrors(page, previewOrigin) {
  const consoleErrors = [];
  const pageErrors = [];
  const externalRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== previewOrigin)
      externalRequests.push(request.url());
  });
  return { consoleErrors, pageErrors, externalRequests };
}

async function setEvidenceDrawer(page, open) {
  await page.locator("details.evidence-drawer").evaluate((drawer, value) => {
    drawer.open = value;
    drawer.dispatchEvent(new Event("toggle"));
  }, open);
}

async function enterStreet(page, method = "click") {
  await page.getByRole("button", { name: "Enter Brindle Bay" })[method]();
  await page.getByRole("button", { name: "Enter Harbor Street" })[method]();
  await page.locator('[data-render-stack][data-city-level="street"]').waitFor();
}

async function pickSelectedFigure(page, method = "click") {
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
  const position = {
    x: (Number(x) / size.width) * bounds.width,
    y: (Number(y) / size.height) * bounds.height,
  };
  await canvas[method]({ position });
}

async function layoutMetrics(page) {
  return page.evaluate(() => {
    const renderer = document.querySelector('[data-testid="journey-renderer"]');
    const bounds = renderer?.getBoundingClientRect();
    const buttons = [...document.querySelectorAll("button")].filter(
      (button) => button.getClientRects().length > 0,
    );
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      },
      renderer: bounds ? { width: bounds.width, height: bounds.height } : null,
      minimumVisibleButtonHeight: Math.min(
        ...buttons.map((button) => button.getBoundingClientRect().height),
      ),
    };
  });
}

await mkdir(evidenceDirectory, { recursive: true });
await mkdir(videoDirectory, { recursive: true });
const preview = await startProductionPreview();
const browser = await chromium.launch();
const artifacts = [];
const observations = {};

try {
  const desktopContext = await browser.newContext({
    viewport: { width: 1_440, height: 900 },
    recordVideo: { dir: videoDirectory, size: { width: 1_280, height: 800 } },
  });
  const desktop = await desktopContext.newPage();
  const desktopErrors = observeErrors(desktop, new URL(preview.url).origin);
  const desktopVideo = desktop.video();
  await desktop.goto(`${preview.url}/?renderer=canvas&quality=fallback`, {
    waitUntil: "networkidle",
  });
  await enterStreet(desktop);
  const renderer = desktop.getByTestId("journey-renderer");
  await renderer.focus();
  const stateBeforePreview = await desktop
    .getByTestId("state-hash")
    .textContent();
  const selectionBeforePreview =
    await renderer.getAttribute("data-selection-id");
  await desktop.keyboard.press("ArrowRight");
  const previewPersonId = await renderer.getAttribute("data-preview-person-id");
  assert(previewPersonId, "keyboard traversal did not preview a resident");
  assert.equal(
    await desktop.getByTestId("state-hash").textContent(),
    stateBeforePreview,
  );
  assert.equal(
    await renderer.getAttribute("data-selection-id"),
    selectionBeforePreview,
  );

  const compactPath = `${evidenceDirectory}/desktop-compact.png`;
  await desktop.screenshot({ path: compactPath, fullPage: true });
  artifacts.push(compactPath);
  const desktopLayout = await layoutMetrics(desktop);
  assert(desktopLayout.renderer?.width > 1_000);
  assert(desktopLayout.renderer?.height > 600);
  assert(desktopLayout.document.scrollHeight <= desktopLayout.viewport.height);

  await desktop.keyboard.press("Enter");
  assert.equal(
    await renderer.getAttribute("data-selection-id"),
    previewPersonId,
  );
  await desktop.getByRole("slider", { name: "Seek simulated hour" }).fill("16");
  assert.equal(await desktop.getByTestId("person-tick").textContent(), "16");
  await setEvidenceDrawer(desktop, true);
  const evidencePath = `${evidenceDirectory}/desktop-evidence-drawer.png`;
  await desktop.screenshot({ path: evidencePath, fullPage: true });
  artifacts.push(evidencePath);
  const deepLink = await desktop
    .getByTestId("person-deep-link")
    .getAttribute("href");
  assert.match(deepLink ?? "", /person=/);

  const axe = await new AxeBuilder({ page: desktop }).analyze();
  const seriousOrCritical = axe.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  assert.deepEqual(seriousOrCritical, []);
  const ariaSnapshot = await desktop.locator("main").ariaSnapshot();
  for (const phrase of [
    "Pick a visible resident",
    "City view and signature moments",
    "Seek simulated hour",
    "Person & evidence",
  ])
    assert.match(ariaSnapshot, new RegExp(phrase));

  await setEvidenceDrawer(desktop, false);
  await desktop.getByRole("button", { name: "View planet" }).click();
  assert.equal(
    await desktop.getByTestId("observer-a-stage").textContent(),
    "Planet",
  );
  assert.deepEqual(desktopErrors, {
    consoleErrors: [],
    pageErrors: [],
    externalRequests: [],
  });
  observations.desktop = {
    layout: desktopLayout,
    previewPersonId,
    deepLink,
    axe: {
      engine: axe.testEngine,
      passCount: axe.passes.length,
      incompleteCount: axe.incomplete.length,
      seriousOrCritical,
    },
    ariaSnapshot,
  };
  await desktop.close();
  assert(
    desktopVideo !== null,
    "desktop interaction video was not initialized",
  );
  const desktopRecording = `${evidenceDirectory}/keyboard-scrub-follow-exit.webm`;
  await copyFile(await desktopVideo.path(), desktopRecording);
  artifacts.push(desktopRecording);
  await desktopContext.close();

  const mobileContext = await browser.newContext({
    ...devices["Pixel 7"],
    recordVideo: { dir: videoDirectory, size: { width: 412, height: 915 } },
  });
  const mobile = await mobileContext.newPage();
  const mobileErrors = observeErrors(mobile, new URL(preview.url).origin);
  const mobileVideo = mobile.video();
  await mobile.goto(`${preview.url}/?renderer=canvas&quality=fallback`, {
    waitUntil: "networkidle",
  });
  await enterStreet(mobile, "tap");
  await pickSelectedFigure(mobile, "tap");
  assert.match(
    (await mobile.getByTestId("observer-a-person-id").textContent()) ?? "",
    /^person_/,
  );
  const mobilePath = `${evidenceDirectory}/mobile-touch.png`;
  await mobile.screenshot({ path: mobilePath, fullPage: true });
  artifacts.push(mobilePath);
  const mobileLayout = await layoutMetrics(mobile);
  assert(mobileLayout.renderer?.height > 650);
  assert(mobileLayout.document.scrollHeight <= mobileLayout.viewport.height);
  assert(mobileLayout.minimumVisibleButtonHeight >= 44);
  assert.deepEqual(mobileErrors, {
    consoleErrors: [],
    pageErrors: [],
    externalRequests: [],
  });
  observations.mobile = { layout: mobileLayout };
  await mobile.close();
  assert(mobileVideo !== null, "mobile touch video was not initialized");
  const mobileRecording = `${evidenceDirectory}/mobile-touch.webm`;
  await copyFile(await mobileVideo.path(), mobileRecording);
  artifacts.push(mobileRecording);
  await mobileContext.close();

  const contrast = await browser.newPage({
    viewport: { width: 1_280, height: 720 },
  });
  await contrast.emulateMedia({
    forcedColors: "active",
    reducedMotion: "reduce",
  });
  await contrast.goto(`${preview.url}/?renderer=canvas&quality=fallback`, {
    waitUntil: "networkidle",
  });
  await contrast.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await contrast.getByRole("button", { name: "Enter Brindle Bay" }).click();
  const contrastLayout = await layoutMetrics(contrast);
  assert(contrastLayout.document.scrollWidth <= contrastLayout.viewport.width);
  assert(
    contrastLayout.document.scrollHeight <= contrastLayout.viewport.height,
  );
  const contrastPath = `${evidenceDirectory}/forced-colors-200-percent.png`;
  await contrast.screenshot({ path: contrastPath, fullPage: true });
  artifacts.push(contrastPath);
  observations.forcedColors200Percent = { layout: contrastLayout };
  await contrast.close();

  const indexedArtifacts = [];
  for (const path of artifacts)
    indexedArtifacts.push({ path, sha256: await sha256(path) });
  await writeFile(
    `${evidenceDirectory}/evidence-index.json`,
    `${JSON.stringify(
      {
        issue: 35,
        commit,
        capturedAt: new Date().toISOString(),
        browser: `Chromium ${await browser.version()}`,
        observations,
        artifacts: indexedArtifacts,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await browser.close();
  await preview.close();
}
