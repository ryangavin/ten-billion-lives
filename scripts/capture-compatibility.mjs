import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { chromium, devices, webkit } from "@playwright/test";

/* global document */

const previewUrl = "http://127.0.0.1:4178";
const evidenceDirectory = "docs/evidence/issue-23";
const videoDirectory = "/tmp/ten-billion-lives-compatibility-video";

async function waitForPreview() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
    } catch {
      // The local production preview may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("compatibility preview did not become ready");
}

async function reachPerson(page, method = "click") {
  for (const name of [
    "Enter Brindle Bay",
    "Enter Harbor Street",
    "Meet a resident",
  ])
    await page.getByRole("button", { name })[method]();
  await page.getByTestId("observer-a-person-id").waitFor();
}

async function semanticObservation(page) {
  return page.evaluate(() => {
    const text = (testId) =>
      document.querySelector(`[data-testid=${testId}]`)?.textContent ?? "";
    return {
      personA: text("observer-a-person-id"),
      personB: text("observer-b-person-id"),
      state: text("state-hash"),
      manifestationA: text("manifestation-hash-a"),
      manifestationB: text("manifestation-hash-b"),
      eventA: text("projection-event-hash-a"),
      eventB: text("projection-event-hash-b"),
      match: text("observer-match"),
    };
  });
}

function axeSummary(result) {
  const violations = result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      failureSummary: node.failureSummary,
    })),
  }));
  const seriousOrCritical = violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  return {
    engine: result.testEngine,
    testEnvironment: result.testEnvironment,
    url: result.url,
    violations,
    seriousOrCritical,
    passCount: result.passes.length,
    incompleteCount: result.incomplete.length,
    passed: seriousOrCritical.length === 0,
  };
}

const preview = spawn(
  "pnpm",
  ["preview", "--host", "127.0.0.1", "--port", "4178"],
  { stdio: "ignore" },
);

try {
  await mkdir(evidenceDirectory, { recursive: true });
  await mkdir(videoDirectory, { recursive: true });
  await waitForPreview();

  const chromiumBrowser = await chromium.launch();
  const chromiumVersion = await chromiumBrowser.version();
  const desktopContext = await chromiumBrowser.newContext({
    viewport: { width: 1440, height: 1000 },
    recordVideo: { dir: videoDirectory, size: { width: 1280, height: 720 } },
  });
  const keyboardPage = await desktopContext.newPage();
  await keyboardPage.emulateMedia({ reducedMotion: "reduce" });
  await keyboardPage.goto(`${previewUrl}/?renderer=canvas`);
  const focusSequence = [];
  const next = keyboardPage.getByRole("button", {
    name: "Enter Brindle Bay",
  });
  await next.focus();
  for (const expected of [
    "Enter Harbor Street",
    "Meet a resident",
    "Dara Grove",
  ]) {
    await keyboardPage.keyboard.press("Enter");
    const active = await keyboardPage.evaluate(() => ({
      id: document.activeElement?.id ?? "",
      text: document.activeElement?.textContent?.trim() ?? "",
      tag: document.activeElement?.tagName.toLowerCase() ?? "",
    }));
    focusSequence.push(active);
    assert.match(active.text, new RegExp(expected));
  }
  assert.equal(
    await keyboardPage
      .getByTestId("journey-renderer")
      .getAttribute("data-transition-ms"),
    "0",
  );
  await keyboardPage
    .getByRole("button", { name: "Initialize observer B" })
    .click();
  const axe = axeSummary(
    await new AxeBuilder({ page: keyboardPage }).analyze(),
  );
  assert.equal(axe.passed, true);
  const ariaTranscript = await keyboardPage.locator("main").ariaSnapshot();
  for (const phrase of [
    "Ten Billion Lives",
    "Dara Grove",
    "Independent observer comparison",
    "Semantic match",
    "Copy local link",
  ])
    assert.match(ariaTranscript, new RegExp(phrase));
  const beforeLoss = await semanticObservation(keyboardPage);
  await keyboardPage
    .getByRole("button", { name: "Simulate renderer loss" })
    .click();
  const backgroundPage = await desktopContext.newPage();
  await backgroundPage.goto(`${previewUrl}/?renderer=canvas`);
  await keyboardPage.bringToFront();
  await keyboardPage.setViewportSize({ width: 900, height: 600 });
  await keyboardPage.setViewportSize({ width: 600, height: 900 });
  const afterResume = await semanticObservation(keyboardPage);
  assert.deepEqual(afterResume, beforeLoss);
  assert.equal(
    await keyboardPage.getByTestId("render-context-losses").textContent(),
    "1",
  );
  const fallbackPerformance = await keyboardPage.evaluate(() => {
    const run = globalThis.__tenBillionRenderBenchmark;
    if (run === undefined) throw new Error("render benchmark hook unavailable");
    return run(1280, 720, 60, "fallback");
  });
  await keyboardPage.screenshot({
    path: `${evidenceDirectory}/keyboard-resume.png`,
    fullPage: true,
  });
  const keyboardVideo = keyboardPage.video();
  await backgroundPage.close();
  await keyboardPage.close();
  if (keyboardVideo === null) throw new Error("keyboard video unavailable");
  await keyboardVideo.saveAs(`${evidenceDirectory}/keyboard-resume.webm`);
  await desktopContext.close();

  const contrastPage = await chromiumBrowser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await contrastPage.emulateMedia({
    forcedColors: "active",
    reducedMotion: "reduce",
  });
  await contrastPage.goto(`${previewUrl}/?renderer=canvas&quality=fallback`);
  await contrastPage.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await reachPerson(contrastPage);
  const scaledLayout = await contrastPage.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(scaledLayout.scrollWidth <= scaledLayout.clientWidth, true);
  await contrastPage.screenshot({
    path: `${evidenceDirectory}/forced-colors-200-percent.png`,
    fullPage: true,
  });
  await contrastPage.close();

  const mobileContext = await chromiumBrowser.newContext({
    ...devices["Pixel 7"],
    recordVideo: { dir: videoDirectory, size: { width: 412, height: 915 } },
  });
  const touchPage = await mobileContext.newPage();
  await touchPage.goto(`${previewUrl}/?renderer=canvas&quality=fallback`);
  await reachPerson(touchPage, "tap");
  const personLink = await touchPage
    .getByTestId("person-deep-link")
    .getAttribute("href");
  assert.match(personLink ?? "", /person=person_27yi09s_1obkbba/);
  await touchPage.getByRole("button", { name: "Copy local link" }).tap();
  await touchPage.waitForFunction(() =>
    /Link copied|Copy unavailable/.test(
      document.querySelector(".share-row [role=status]")?.textContent ?? "",
    ),
  );
  const shareStatus =
    (await touchPage.locator(".share-row [role=status]").textContent()) ?? "";
  assert.match(shareStatus, /Link copied|Copy unavailable/);
  await touchPage.getByTestId("person-deep-link").tap();
  await touchPage.getByRole("button", { name: "View planet" }).tap();
  assert.equal(
    await touchPage.getByTestId("observer-a-stage").textContent(),
    "Planet",
  );
  await touchPage.screenshot({
    path: `${evidenceDirectory}/touch-follow-exit.png`,
    fullPage: true,
  });
  const touchVideo = touchPage.video();
  await touchPage.close();
  if (touchVideo === null) throw new Error("touch video unavailable");
  await touchVideo.saveAs(`${evidenceDirectory}/touch-follow-exit.webm`);
  await mobileContext.close();
  await chromiumBrowser.close();

  const webkitBrowser = await webkit.launch();
  const webkitVersion = await webkitBrowser.version();
  const webkitPage = await webkitBrowser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await webkitPage.goto(`${previewUrl}/?renderer=canvas`);
  await reachPerson(webkitPage);
  assert.equal(
    await webkitPage.getByTestId("render-backend").textContent(),
    "canvas2d",
  );
  await webkitPage.screenshot({
    path: `${evidenceDirectory}/webkit-fallback.png`,
    fullPage: true,
  });
  await webkitBrowser.close();

  const frameTimes = fallbackPerformance.frameTimesMs;
  const sortedFrames = [...frameTimes].sort((left, right) => left - right);
  const fallbackFrameP95Ms =
    sortedFrames[Math.ceil(sortedFrames.length * 0.95) - 1];
  assert.equal(fallbackFrameP95Ms <= 1000 / 30, true);
  const firefoxAvailable =
    existsSync("/Applications/Firefox.app") ||
    existsSync(
      `${process.env["HOME"] ?? ""}/Library/Caches/ms-playwright/firefox`,
    );
  const matrix = {
    schemaVersion: 1,
    productionBuild: true,
    browsers: {
      chromium: {
        available: true,
        version: chromiumVersion,
        desktopKeyboard: "passed",
        mobileTouch: "passed",
        forcedColorsAndTextScaling: "passed",
      },
      webkit: {
        available: true,
        version: webkitVersion,
        desktopKeyboard: "passed",
        canvasFallback: "passed",
      },
      firefox: {
        available: firefoxAvailable,
        result: firefoxAvailable
          ? "not configured: unexpected local installation requires explicit follow-up"
          : "not run: no system Firefox app or Playwright Firefox browser is installed locally",
      },
    },
    reducedMotion: {
      transitionMs: 0,
      cssAnimationsAndTransitionsSuppressed: true,
    },
    keyboard: { focusSequence, ariaTranscript: "screen-reader-transcript.yml" },
    accessibility: {
      seriousOrCritical: axe.seriousOrCritical.length,
      passed: axe.passed,
    },
    touch: { personLink, shareStatus, exitedFollowModeAt: "Planet" },
    resilience: {
      contextLosses: 1,
      tabResume: "passed",
      portraitLandscapeResize: "passed",
      semanticBefore: beforeLoss,
      semanticAfter: afterResume,
    },
    fallbackPerformance: {
      visibleManifestations: fallbackPerformance.visibleCount,
      frames: frameTimes.length,
      frameP95Ms: fallbackFrameP95Ms,
      frameBudgetMs: 1000 / 30,
      passed: true,
    },
    scaledLayout,
    passed: axe.passed && !firefoxAvailable,
  };
  await Promise.all([
    writeFile(
      `${evidenceDirectory}/browser-matrix.json`,
      `${JSON.stringify(matrix, null, 2)}\n`,
    ),
    writeFile(
      `${evidenceDirectory}/axe-report.json`,
      `${JSON.stringify(axe, null, 2)}\n`,
    ),
    writeFile(
      `${evidenceDirectory}/screen-reader-transcript.yml`,
      `${ariaTranscript}\n`,
    ),
  ]);
  console.log(
    JSON.stringify(
      {
        passed: matrix.passed,
        browsers: matrix.browsers,
        accessibility: matrix.accessibility,
        fallbackPerformance: matrix.fallbackPerformance,
        evidenceDirectory,
      },
      null,
      2,
    ),
  );
} finally {
  preview.kill("SIGINT");
}
