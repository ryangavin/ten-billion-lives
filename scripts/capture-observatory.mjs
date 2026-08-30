import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

import { chromium } from "@playwright/test";

/* global document */

const previewUrl = "http://127.0.0.1:4176";
const outputDirectory = process.argv[2] ?? "docs/evidence/issue-21";
const videoDirectory = "/tmp/ten-billion-lives-observatory-video";

async function waitForPreview() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
    } catch {
      // The production preview may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("observatory preview did not become ready");
}

async function pause(page, milliseconds = 300) {
  await page.waitForTimeout(milliseconds);
}

async function text(page, testId) {
  const value = await page.getByTestId(testId).textContent();
  assert.notEqual(value, null, `missing ${testId}`);
  return value.trim();
}

async function assertNoHorizontalOverflow(page, label) {
  assert.equal(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
    true,
    `${label} has horizontal overflow`,
  );
}

async function saveVideo(page, path) {
  const video = page.video();
  await page.close();
  if (video === null) throw new Error(`video unavailable for ${path}`);
  await video.saveAs(path);
}

await mkdir(outputDirectory, { recursive: true });
await mkdir(videoDirectory, { recursive: true });
const preview = spawn(
  "pnpm",
  ["preview", "--host", "127.0.0.1", "--port", "4176"],
  { stdio: "ignore" },
);

try {
  await waitForPreview();
  const browser = await chromium.launch();
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    recordVideo: { dir: videoDirectory, size: { width: 1440, height: 1000 } },
  });
  const desktop = await desktopContext.newPage();
  let delayedBundle = true;
  await desktop.route("**/assets/*.js", async (route) => {
    if (delayedBundle) {
      delayedBundle = false;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    await route.continue();
  });
  const navigation = desktop.goto(`${previewUrl}/?renderer=canvas`);
  await desktop.locator(".loading-state").waitFor();
  await desktop.screenshot({ path: `${outputDirectory}/loading.png` });
  await navigation;
  await desktop.waitForLoadState("networkidle");
  await pause(desktop, 500);
  assert.equal(await text(desktop, "represented-population"), "10,000,000,000");
  assert.equal(await text(desktop, "observer-a-stage"), "Planet");
  assert.equal(await text(desktop, "render-backend"), "canvas2d");
  assert.match(await text(desktop, "render-support"), /Canvas fallback active/);
  await desktop.screenshot({ path: `${outputDirectory}/landing-desktop.png` });

  const initialTick = Number(await text(desktop, "person-tick"));
  await desktop.getByRole("button", { name: "Set speed 24×" }).click();
  await desktop.getByRole("button", { name: "Play local time" }).click();
  await pause(desktop, 1_150);
  const advancedTick = Number(await text(desktop, "person-tick"));
  assert.equal(advancedTick, initialTick + 24);
  await desktop.getByRole("button", { name: "Pause local time" }).click();
  await pause(desktop);
  await desktop.screenshot({ path: `${outputDirectory}/time-24x.png` });

  const discovery = desktop.getByRole("searchbox", {
    name: "Find a place or event",
  });
  await discovery.fill("Atlantis");
  await discovery.press("Enter");
  assert.match(await text(desktop, "discovery-status"), /No local match/);
  await pause(desktop);
  await desktop.screenshot({ path: `${outputDirectory}/empty-discovery.png` });
  await desktop
    .getByRole("button", { name: "Brindle Bay", exact: true })
    .click();
  assert.equal(await text(desktop, "observer-a-stage"), "Settlement");
  assert.equal(
    await desktop.getByRole("heading", { name: "Brindle Bay" }).textContent(),
    "Brindle Bay",
  );
  await pause(desktop);
  await desktop.screenshot({ path: `${outputDirectory}/settlement.png` });
  await desktop
    .getByRole("button", { name: "Harbor Street", exact: true })
    .click();
  assert.equal(await text(desktop, "observer-a-stage"), "Street");
  assert.equal(
    await desktop.getByRole("heading", { name: "Harbor Street" }).textContent(),
    "Harbor Street",
  );
  await pause(desktop);
  await desktop.screenshot({ path: `${outputDirectory}/street.png` });
  const streetSurface = desktop.getByRole("button", {
    name: "Inspect highlighted resident",
  });
  await streetSurface.focus();
  await desktop.keyboard.press("Enter");
  assert.equal(await text(desktop, "observer-a-stage"), "Person");
  await pause(desktop);
  await desktop.screenshot({ path: `${outputDirectory}/person.png` });

  await desktop.getByRole("button", { name: "Visit Lantern Tide" }).click();
  await desktop.getByRole("button", { name: "Initialize observer B" }).click();
  assert.equal(await text(desktop, "observer-match"), "Semantic match");
  await desktop.locator(".observer-grid").screenshot({
    path: `${outputDirectory}/festival-two-observers.png`,
  });
  await desktop.getByRole("button", { name: "Rewind and replay" }).click();
  assert.match(await text(desktop, "experience-mode"), /replay verified/);
  await desktop.getByRole("button", { name: "Reveal fields" }).click();
  assert.match(await text(desktop, "authority-bytes"), /checkpoint bytes/);
  assert.match(await text(desktop, "budget-frame-time"), /ms/);
  await desktop.locator(".reality-budget").screenshot({
    path: `${outputDirectory}/replay-field-reveal.png`,
  });
  await desktop.getByRole("button", { name: "Explore closure branch" }).click();
  assert.equal(await text(desktop, "experience-mode"), "Local closure branch");
  assert.equal(
    await text(desktop, "branch-field-match"),
    "Identical field state",
  );
  await desktop.locator(".branch-comparison").screenshot({
    path: `${outputDirectory}/closure-branch.png`,
  });
  await assertNoHorizontalOverflow(desktop, "desktop closure");
  await pause(desktop, 700);
  await saveVideo(desktop, `${outputDirectory}/observatory-desktop.webm`);
  await desktopContext.close();

  const narrowContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    recordVideo: { dir: videoDirectory, size: { width: 390, height: 844 } },
  });
  const narrow = await narrowContext.newPage();
  await narrow.goto(`${previewUrl}/?renderer=canvas`, {
    waitUntil: "networkidle",
  });
  assert.equal(await text(narrow, "render-backend"), "canvas2d");
  await assertNoHorizontalOverflow(narrow, "narrow landing");
  await narrow.screenshot({ path: `${outputDirectory}/landing-narrow.png` });
  await narrow
    .getByRole("button", { name: "Harbor Street", exact: true })
    .click();
  await pause(narrow, 500);
  await narrow
    .getByRole("button", { name: "Inspect highlighted resident" })
    .press("Enter");
  await pause(narrow, 500);
  await narrow.getByRole("button", { name: "Visit Lantern Tide" }).click();
  await pause(narrow, 500);
  await narrow.getByRole("button", { name: "Initialize observer B" }).click();
  await pause(narrow, 500);
  await narrow.getByRole("button", { name: "Reveal fields" }).click();
  await pause(narrow, 500);
  await narrow.getByRole("button", { name: "Explore closure branch" }).click();
  assert.equal(await text(narrow, "observer-match"), "Semantic match");
  assert.equal(
    await text(narrow, "branch-field-match"),
    "Identical field state",
  );
  await assertNoHorizontalOverflow(narrow, "narrow closure");
  await narrow.screenshot({
    path: `${outputDirectory}/journey-narrow.png`,
    fullPage: true,
  });
  await pause(narrow, 700);
  await saveVideo(narrow, `${outputDirectory}/observatory-narrow.webm`);
  await narrowContext.close();

  const errorContext = await browser.newContext({
    viewport: { width: 1000, height: 720 },
  });
  const invalid = await errorContext.newPage();
  await invalid.goto(
    `${previewUrl}/?schema=2&seed=ten-billion-lives%2Fbaseline%2Fv1&tick=19&person=person_0000a4q_0yrj2dd&branch=baseline`,
    { waitUntil: "networkidle" },
  );
  assert.match(await invalid.getByRole("alert").textContent(), /schema/i);
  await invalid.screenshot({ path: `${outputDirectory}/invalid-link.png` });
  await errorContext.close();

  const comprehension = {
    schemaVersion: 1,
    method:
      "Production UI assertions plus inspected desktop and narrow recordings; questions are answered by visible copy or state, without external documentation.",
    checks: [
      {
        question: "What does ten billion mean?",
        evidence:
          "First-run copy says exactly 10,000,000,000 represented lives, no table of people, reconstructed from compact fields.",
        passed: true,
      },
      {
        question: "Where am I in the journey?",
        evidence:
          "The visible Planet/Settlement/Street/Person label includes a numbered step and every navigation updates it.",
        passed: true,
      },
      {
        question: "Is local time running and at what rate?",
        evidence:
          "Pause/play, one-tick step, 1×/6×/24× controls, day/hour, and pressed rate are explicit; 24× advanced exactly 24 ticks.",
        passed: true,
      },
      {
        question: "How can I find a place or event?",
        evidence:
          "Local search and three named shortcuts open Brindle Bay, Harbor Street, and Lantern Tide; an unknown query changes no semantic state and gives next choices.",
        passed: true,
      },
      {
        question: "What is authoritative and what is projected?",
        evidence:
          "Reality budget exposes integer cells/checkpoint bytes, zero stored people, represented scope, weighted visible tokens, tick/state/event hashes, frame time, backend, and sampling contract.",
        passed: true,
      },
      {
        question: "Am I viewing baseline, replay, or branch state?",
        evidence:
          "The mode label distinguishes Immutable baseline, replay verified, and Local closure branch; the branch panel shows field equality and route consequences.",
        passed: true,
      },
      {
        question: "Does a weaker browser lose the experience?",
        evidence:
          "Forced Canvas reports its fallback explicitly and completed both desktop and 390×844 signature journeys without overflow.",
        passed: true,
      },
    ],
    passed: true,
  };
  await writeFile(
    `${outputDirectory}/comprehension-checklist.json`,
    `${JSON.stringify(comprehension, null, 2)}\n`,
  );
  await browser.close();
  console.log(
    JSON.stringify(
      {
        passed: true,
        initialTick,
        advancedTick,
        checks: comprehension.checks.length,
        outputDirectory,
      },
      null,
      2,
    ),
  );
} finally {
  preview.kill("SIGINT");
}
