import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

import { chromium } from "@playwright/test";

/* global document, HTMLInputElement */

const previewUrl = "http://127.0.0.1:4175";
const evidenceDirectory = process.argv[2] ?? "docs/evidence/issue-16";
const videoDirectory = "/tmp/ten-billion-lives-m2-video";

async function waitForPreview() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
    } catch {
      // The local production preview may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("M2 production preview did not become ready");
}

async function pause(page, milliseconds = 350) {
  await page.waitForTimeout(milliseconds);
}

async function text(page, testId) {
  const value = await page.getByTestId(testId).textContent();
  assert.notEqual(value, null, `missing text for ${testId}`);
  return value.trim();
}

async function activateByKeyboard(page, name) {
  const control = page.getByRole("button", { name });
  await control.focus();
  assert.equal(
    await control.evaluate((element) => element === document.activeElement),
    true,
    `${name} did not receive keyboard focus`,
  );
  await page.keyboard.press("Enter");
  await pause(page);
}

async function auditAccessibility(page) {
  return page.evaluate(() => {
    const duplicateIds = [...document.querySelectorAll("[id]")]
      .map((element) => element.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index);
    const unnamedControls = [
      ...document.querySelectorAll("button, a[href], input, [role='button']"),
    ]
      .filter((element) => {
        const label = element.getAttribute("aria-label")?.trim();
        const labelledBy = element.getAttribute("aria-labelledby")?.trim();
        const text = element.textContent?.trim();
        const value = element instanceof HTMLInputElement ? element.value : "";
        const associatedLabel =
          element instanceof HTMLInputElement &&
          (element.labels?.length ?? 0) > 0;
        return !label && !labelledBy && !associatedLabel && !text && !value;
      })
      .map((element) => element.outerHTML.slice(0, 160));
    const unlabelledInputs = [...document.querySelectorAll("input")]
      .filter(
        (element) =>
          element.labels?.length === 0 &&
          !element.hasAttribute("aria-label") &&
          !element.hasAttribute("aria-labelledby"),
      )
      .map((element) => element.outerHTML.slice(0, 160));
    const unlabelledCanvases = [...document.querySelectorAll("canvas")]
      .filter((element) => !element.getAttribute("aria-label")?.trim())
      .map((element) => element.outerHTML.slice(0, 160));
    const mainCount = document.querySelectorAll("main").length;
    const headingCount = document.querySelectorAll("h1").length;
    const language = document.documentElement.lang;
    const horizontalOverflow =
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth;
    const failures = [];
    if (language !== "en")
      failures.push(`document language is ${language || "missing"}`);
    if (mainCount !== 1)
      failures.push(`expected one main landmark, found ${mainCount}`);
    if (headingCount !== 1)
      failures.push(`expected one h1, found ${headingCount}`);
    if (duplicateIds.length > 0)
      failures.push(`duplicate ids: ${[...new Set(duplicateIds)].join(", ")}`);
    if (unnamedControls.length > 0)
      failures.push(
        `${unnamedControls.length} interactive controls lack names`,
      );
    if (unlabelledInputs.length > 0)
      failures.push(`${unlabelledInputs.length} inputs lack labels`);
    if (unlabelledCanvases.length > 0)
      failures.push(`${unlabelledCanvases.length} canvases lack labels`);
    if (horizontalOverflow)
      failures.push("page has horizontal overflow at 1440px");
    return {
      standard:
        "WCAG-oriented local smoke (automated semantics plus keyboard journey)",
      language,
      mainCount,
      headingCount,
      duplicateIds,
      unnamedControls,
      unlabelledInputs,
      unlabelledCanvases,
      horizontalOverflow,
      keyboardJourney: [
        "Enter Brindle Bay",
        "Enter Harbor Street",
        "Inspect highlighted resident",
      ],
      failures,
      passed: failures.length === 0,
    };
  });
}

await mkdir(evidenceDirectory, { recursive: true });
await mkdir(videoDirectory, { recursive: true });
const preview = spawn(
  "pnpm",
  ["preview", "--host", "127.0.0.1", "--port", "4175"],
  { stdio: "ignore" },
);

try {
  await waitForPreview();
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    recordVideo: { dir: videoDirectory, size: { width: 1440, height: 1000 } },
  });
  const page = await context.newPage();
  const video = page.video();
  await page.goto(`${previewUrl}/?renderer=canvas`, {
    waitUntil: "networkidle",
  });
  await pause(page, 700);

  const transcript = {
    schemaVersion: 1,
    seed: "ten-billion-lives/baseline/v1",
    browser: await browser.version(),
    baseline: {
      representedPopulation: await text(page, "represented-population"),
      worldHash: await text(page, "world-hash"),
      stateHash: await text(page, "state-hash"),
      manifestationHash: await text(page, "manifestation-hash-a"),
      eventHash: await text(page, "projection-event-hash-a"),
    },
  };
  assert.equal(transcript.baseline.representedPopulation, "10,000,000,000");
  assert.equal(transcript.baseline.worldHash, "ed66e344fcd7e737");

  const cameraInvariant = { before: { ...transcript.baseline } };
  await activateByKeyboard(page, "Orbit camera");
  cameraInvariant.after = {
    stateHash: await text(page, "state-hash"),
    manifestationHash: await text(page, "manifestation-hash-a"),
    eventHash: await text(page, "projection-event-hash-a"),
  };
  assert.equal(
    cameraInvariant.after.stateHash,
    cameraInvariant.before.stateHash,
  );
  assert.equal(
    cameraInvariant.after.manifestationHash,
    cameraInvariant.before.manifestationHash,
  );
  assert.equal(
    cameraInvariant.after.eventHash,
    cameraInvariant.before.eventHash,
  );
  transcript.cameraInvariant = cameraInvariant;

  await activateByKeyboard(page, "Inspect debug world");
  assert.equal(
    await text(page, "field-invariants"),
    "None — exact conservation",
  );
  await activateByKeyboard(page, "Tick 9 · reopened");
  const openFlow = await text(page, "signature-route");
  await activateByKeyboard(page, "Tick 19 · festival");
  const dayHash = await text(page, "planetary-day-hash");
  const festivalSummary = await page
    .getByText(/100,000 attending from 2 surrounding regions/)
    .textContent();
  assert.match(openFlow, /Open · 8,180,688/);
  assert.equal(dayHash, "c09cdd840c68bab2");
  assert.notEqual(festivalSummary, null);
  transcript.planetaryRhythm = { dayHash, openFlow, festivalSummary };
  await activateByKeyboard(page, "Hide debug world");

  await activateByKeyboard(page, "Enter Brindle Bay");
  assert.equal(await text(page, "observer-a-stage"), "Settlement");
  await activateByKeyboard(page, "Enter Harbor Street");
  assert.equal(await text(page, "observer-a-stage"), "Street");
  const streetSurface = page.getByRole("button", {
    name: "Inspect highlighted resident",
  });
  await streetSurface.focus();
  assert.equal(
    await streetSurface.evaluate(
      (element) => element === document.activeElement,
    ),
    true,
  );
  await page.keyboard.press("Enter");
  await pause(page, 500);
  assert.equal(await text(page, "observer-a-stage"), "Person");
  const selectedPerson = await text(page, "observer-a-person-id");
  const household = await text(page, "observer-a-household-id");
  assert.equal(selectedPerson, "person_27yi09s_1obkbba");
  assert.match(household, /household_0yojqkh506h6x_0855mue/);

  const activityTransitions = [];
  for (const name of [
    "Tick 7 · commute",
    "Tick 19 · festival hour",
    "Tick 23 · sleep",
    "Tick 10 · primary activity",
  ]) {
    await activateByKeyboard(page, name);
    activityTransitions.push(await text(page, "observer-a-itinerary"));
  }
  assert.equal(new Set(activityTransitions).size >= 3, true);
  transcript.personJourney = { selectedPerson, household, activityTransitions };

  await activateByKeyboard(page, "Initialize observer B");
  const observerAgreement = {
    personA: await text(page, "observer-a-person-id"),
    personB: await text(page, "observer-b-person-id"),
    manifestationA: await text(page, "manifestation-hash-a"),
    manifestationB: await text(page, "manifestation-hash-b"),
    eventA: await text(page, "projection-event-hash-a"),
    eventB: await text(page, "projection-event-hash-b"),
    result: await text(page, "observer-match"),
  };
  assert.equal(observerAgreement.personA, observerAgreement.personB);
  assert.equal(
    observerAgreement.manifestationA,
    observerAgreement.manifestationB,
  );
  assert.equal(observerAgreement.eventA, observerAgreement.eventB);
  assert.equal(observerAgreement.result, "Semantic match");
  transcript.observerAgreement = observerAgreement;

  const beforeLodReturn = observerAgreement.manifestationA;
  await activateByKeyboard(page, "View planet");
  await activateByKeyboard(page, "View person");
  assert.equal(await text(page, "manifestation-hash-a"), beforeLodReturn);
  await activateByKeyboard(page, "Rewind and replay");
  const replayResult = await text(page, "replay-result");
  assert.equal(replayResult, "trace-5182c8d2 restored");
  await activateByKeyboard(page, "Reveal fields");
  assert.match(await text(page, "reality-budget"), /2,048 integer cells/);
  transcript.continuity = {
    manifestationHashBeforeLeave: beforeLodReturn,
    manifestationHashAfterReturn: await text(page, "manifestation-hash-a"),
    replayResult,
    realityBudgetRevealed: true,
  };

  await activateByKeyboard(page, "Visit Lantern Tide");
  const festival = {
    person: await text(page, "observer-a-person-id"),
    itinerary: await text(page, "observer-a-itinerary"),
    events: await text(page, "semantic-events-a"),
  };
  assert.equal(festival.person, "person_0000a4q_0yrj2dd");
  assert.match(festival.itinerary, /Tick 19 · festival/);
  await activateByKeyboard(page, "Tick 21 · festival departure");
  festival.departure = await text(page, "observer-a-route");
  assert.match(festival.departure, /festival return/);
  transcript.festival = festival;

  await activateByKeyboard(page, "Explore closure branch");
  const branch = {
    active: await text(page, "active-branch"),
    person: await text(page, "observer-a-person-id"),
    baselineRoute: await text(page, "baseline-route"),
    closureRoute: await text(page, "closure-route"),
    fieldComparison: await text(page, "branch-field-match"),
    eventHash: await text(page, "projection-event-hash-a"),
  };
  assert.deepEqual(
    {
      active: branch.active,
      baselineRoute: branch.baselineRoute,
      closureRoute: branch.closureRoute,
      fieldComparison: branch.fieldComparison,
    },
    {
      active: "Closure branch",
      baselineRoute: "1 edge",
      closureRoute: "31 edges",
      fieldComparison: "Identical field state",
    },
  );
  transcript.branch = branch;

  const accessibility = await auditAccessibility(page);
  assert.deepEqual(accessibility.failures, []);
  await writeFile(
    `${evidenceDirectory}/accessibility-smoke.json`,
    `${JSON.stringify(accessibility, null, 2)}\n`,
  );
  await writeFile(
    `${evidenceDirectory}/hash-transcript.json`,
    `${JSON.stringify(transcript, null, 2)}\n`,
  );
  await page.screenshot({
    path: `${evidenceDirectory}/m2-acceptance-final.png`,
    fullPage: true,
  });
  await pause(page, 800);
  await page.close();
  if (video === null) throw new Error("M2 acceptance video was not recorded");
  await video.saveAs(`${evidenceDirectory}/m2-acceptance.webm`);
  await context.close();
  await browser.close();
  console.log(
    JSON.stringify(
      {
        passed: true,
        evidenceDirectory,
        worldHash: transcript.baseline.worldHash,
        manifestationHash: transcript.observerAgreement.manifestationA,
        eventHash: transcript.observerAgreement.eventA,
        accessibility: accessibility.passed,
      },
      null,
      2,
    ),
  );
} finally {
  preview.kill("SIGINT");
}
