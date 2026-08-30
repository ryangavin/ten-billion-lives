import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { chromium } from "@playwright/test";

const repositoryRoot = process.cwd();
const evidenceDirectory = resolve(repositoryRoot, "docs/evidence/issue-27");
const temporaryRoot = await mkdtemp(join(tmpdir(), "ten-billion-lives-final-"));
const checkout = join(temporaryRoot, "repo");
const temporaryEvidence = join(temporaryRoot, "evidence");
const videoDirectory = join(temporaryRoot, "video");
const source = execFileSync("git", ["remote", "get-url", "origin"], {
  encoding: "utf8",
}).trim();
const expectedCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

function run(command, args, cwd = checkout) {
  const started = performance.now();
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) {
    process.stderr.write(output.slice(-20_000));
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}`);
  }
  return {
    command: [command, ...args].join(" "),
    durationMs: performance.now() - started,
    exitCode: result.status,
    outputTail: output.trim().slice(-5_000),
    passed: true,
  };
}

async function waitForPreview(child, readOutput) {
  for (let attempt = 0; attempt < 1_200; attempt += 1) {
    const output = readOutput();
    const match = /Local:\s+(http:\/\/127\.0\.0\.1:\d+\/)/.exec(output);
    if (match?.[1]) return match[1];
    if (child.exitCode !== null)
      throw new Error(
        `pnpm start exited before launch:\n${output.slice(-8_000)}`,
      );
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`pnpm start did not print a local URL:\n${readOutput()}`);
}

async function text(page, testId) {
  const value = await page.getByTestId(testId).textContent();
  assert.notEqual(value, null, `missing ${testId}`);
  return value.trim();
}

async function personFacts(page, observerIndex) {
  const article = page.locator(".observer-grid article").nth(observerIndex);
  return article
    .locator(".person-facts > div")
    .evaluateAll((nodes) =>
      Object.fromEntries(
        nodes.map((node) => [
          node.querySelector("dt")?.textContent?.trim() ?? "",
          node.querySelector("dd")?.textContent?.trim() ?? "",
        ]),
      ),
    );
}

function semanticSubset(observation) {
  return {
    personId: observation.facts["Person ID"],
    itinerary: observation.facts.Now,
    relationships: observation.facts.Relationships,
    encounters: observation.facts["Co-located encounters"],
    events: observation.facts["Local semantic events"],
    manifestationHash: observation.manifestationHash,
    eventHash: observation.eventHash,
  };
}

async function observerObservation(page, observer, index) {
  return {
    facts: await personFacts(page, index),
    manifestationHash: await text(page, `manifestation-hash-${observer}`),
    eventHash: await text(page, `projection-event-hash-${observer}`),
  };
}

await Promise.all([
  mkdir(evidenceDirectory, { recursive: true }),
  mkdir(temporaryEvidence, { recursive: true }),
  mkdir(videoDirectory, { recursive: true }),
]);
const commands = [];
commands.push(
  run(
    "git",
    [
      "clone",
      "--quiet",
      "--branch",
      "main",
      "--single-branch",
      source,
      checkout,
    ],
    repositoryRoot,
  ),
);
const checkoutCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: checkout,
  encoding: "utf8",
}).trim();
assert.equal(checkoutCommit, expectedCommit, "remote main is not current HEAD");
commands.push(run("pnpm", ["install", "--frozen-lockfile"]));
commands.push(run("pnpm", ["check"]));
const cleanAfterRootCheck =
  execFileSync("git", ["status", "--short"], {
    cwd: checkout,
    encoding: "utf8",
  }).trim() === "";
assert.equal(
  cleanAfterRootCheck,
  true,
  "root check modified the clean checkout",
);

commands.push(
  run("node", ["scripts/capture-m2-replay.mjs", temporaryEvidence]),
);
commands.push(
  run("node", ["scripts/capture-playwright-summary.mjs", temporaryEvidence]),
);
commands.push(run("pnpm", ["qa:benchmarks"]));

for (const [sourcePath, targetName] of [
  [
    join(temporaryEvidence, "deterministic-replay.json"),
    "deterministic-replay.json",
  ],
  [
    join(temporaryEvidence, "playwright-summary.json"),
    "playwright-summary.json",
  ],
  [
    join(checkout, "docs/evidence/issue-25/benchmark-summary.json"),
    "benchmark-summary.json",
  ],
  [
    join(checkout, "docs/evidence/issue-25/benchmark-commands.json"),
    "benchmark-commands.json",
  ],
])
  await copyFile(sourcePath, join(evidenceDirectory, targetName));

const replay = JSON.parse(
  await readFile(join(evidenceDirectory, "deterministic-replay.json"), "utf8"),
);
const playwright = JSON.parse(
  await readFile(join(evidenceDirectory, "playwright-summary.json"), "utf8"),
);
const benchmarks = JSON.parse(
  await readFile(join(evidenceDirectory, "benchmark-summary.json"), "utf8"),
);
const benchmarkCommands = JSON.parse(
  await readFile(join(evidenceDirectory, "benchmark-commands.json"), "utf8"),
);
assert.equal(replay.passed, true);
assert.equal(playwright.unexpected, 0);
assert.equal(playwright.flaky, 0);
assert.equal(playwright.expected, 24);
assert.equal(benchmarks.passed, true);
assert.equal(benchmarks.conservation.representedPopulation, "10000000000");
assert.equal(benchmarkCommands.passed, true);
assert.equal(benchmarkCommands.longSession.durationMs >= 30 * 60 * 1000, true);

let previewOutput = "";
const previewStarted = performance.now();
const preview = spawn("pnpm", ["start"], {
  cwd: checkout,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
});
preview.stdout.on("data", (chunk) => {
  previewOutput += chunk.toString();
});
preview.stderr.on("data", (chunk) => {
  previewOutput += chunk.toString();
});
let browser;
let previewUrl;
let signature;
try {
  previewUrl = await waitForPreview(preview, () => previewOutput);
  const previewOrigin = new URL(previewUrl).origin;
  const response = await fetch(previewUrl);
  assert.equal(response.status, 200);
  browser = await chromium.launch();
  const primaryContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    recordVideo: { dir: videoDirectory, size: { width: 1440, height: 1000 } },
  });
  const page = await primaryContext.newPage();
  const requests = [];
  const consoleErrors = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const stages = [];
  await page.goto(`${previewUrl}?renderer=canvas&quality=baseline`, {
    waitUntil: "networkidle",
  });
  assert.equal(await text(page, "represented-population"), "10,000,000,000");
  assert.equal(await text(page, "observer-a-stage"), "Planet");
  stages.push("Planet");
  const cameraInvariant = {
    stateHash: await text(page, "state-hash"),
    manifestationHash: await text(page, "manifestation-hash-a"),
    eventHash: await text(page, "projection-event-hash-a"),
  };
  await page.screenshot({
    path: join(evidenceDirectory, "signature-start.png"),
  });
  await page.getByRole("button", { name: "Orbit camera" }).click();
  assert.equal(await text(page, "state-hash"), cameraInvariant.stateHash);
  assert.equal(
    await text(page, "manifestation-hash-a"),
    cameraInvariant.manifestationHash,
  );
  assert.equal(
    await text(page, "projection-event-hash-a"),
    cameraInvariant.eventHash,
  );

  await page.getByRole("button", { name: "Enter Brindle Bay" }).click();
  assert.equal(await text(page, "observer-a-stage"), "Settlement");
  stages.push("Settlement");
  await page.waitForTimeout(450);
  await page.getByRole("button", { name: "Visit Lantern Tide" }).click();
  assert.match(await text(page, "observer-a-itinerary"), /Tick 19 · festival/);
  stages.push("Festival");
  await page.waitForTimeout(450);
  await page.screenshot({
    path: join(evidenceDirectory, "signature-festival.png"),
  });
  await page.getByRole("button", { name: "View street" }).click();
  assert.equal(await text(page, "observer-a-stage"), "Street");
  stages.push("Street");
  await page.waitForTimeout(450);
  await page.getByRole("button", { name: "Meet a resident" }).click();
  assert.equal(await text(page, "observer-a-stage"), "Person");
  stages.push("Person");
  await page.waitForTimeout(450);

  await page.getByRole("button", { name: "Initialize observer B" }).click();
  assert.equal(await text(page, "observer-match"), "Semantic match");
  stages.push("Second observer");
  const observerA = await observerObservation(page, "a", 0);
  const observerB = await observerObservation(page, "b", 1);
  assert.deepEqual(semanticSubset(observerB), semanticSubset(observerA));
  await page.locator(".observer-grid").screenshot({
    path: join(evidenceDirectory, "signature-observers.png"),
  });

  const personUrl = await page
    .getByTestId("person-deep-link")
    .getAttribute("href");
  assert.notEqual(personUrl, null);
  const independentContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const independentPage = await independentContext.newPage();
  await independentPage.goto(personUrl, { waitUntil: "networkidle" });
  assert.equal(await text(independentPage, "observer-a-stage"), "Person");
  const independentObserver = await observerObservation(
    independentPage,
    "a",
    0,
  );
  assert.deepEqual(
    semanticSubset(independentObserver),
    semanticSubset(observerA),
  );
  await independentContext.close();

  await page.getByRole("button", { name: "Rewind and replay" }).click();
  assert.match(await text(page, "replay-result"), /restored/);
  assert.match(await text(page, "experience-mode"), /replay verified/);
  stages.push("Rewind and replay");
  await page.waitForTimeout(450);
  await page.getByRole("button", { name: "Reveal fields" }).click();
  assert.match(await text(page, "authority-bytes"), /2,048 integer cells/);
  assert.match(
    await page.getByTestId("reality-budget").textContent(),
    /0 person rows/,
  );
  assert.equal(await text(page, "represented-population"), "10,000,000,000");
  stages.push("Field reveal");
  await page.waitForTimeout(650);
  await page.screenshot({
    path: join(evidenceDirectory, "signature-final.png"),
    fullPage: true,
  });

  const video = page.video();
  await page.close();
  assert.notEqual(video, null, "signature video is unavailable");
  await video.saveAs(join(evidenceDirectory, "signature-journey.webm"));
  await primaryContext.close();
  assert.deepEqual(consoleErrors, []);
  const externalRequests = requests.filter(
    (requestUrl) => new URL(requestUrl).origin !== previewOrigin,
  );
  assert.deepEqual(externalRequests, []);
  signature = {
    seed: "ten-billion-lives/baseline/v1",
    url: previewUrl,
    stages,
    population: "10000000000",
    cameraInvariant,
    observerA: semanticSubset(observerA),
    observerB: semanticSubset(observerB),
    independentObserver: semanticSubset(independentObserver),
    independentContexts: 2,
    requests: requests.length,
    externalRequests,
    consoleErrors,
    backend: "canvas2d",
    passed: true,
  };
} finally {
  if (browser) await browser.close();
  if (preview.pid !== undefined) {
    try {
      process.kill(-preview.pid, "SIGINT");
    } catch {
      // The documented start command may already have exited after a failure.
    }
  }
}
commands.push({
  command: "pnpm start + Chromium signature journey",
  durationMs: performance.now() - previewStarted,
  exitCode: null,
  outputTail: previewOutput.trim().slice(-5_000),
  passed: true,
});
assert.notEqual(signature, undefined);
await writeFile(
  join(evidenceDirectory, "signature-journey.json"),
  `${JSON.stringify(signature, null, 2)}\n`,
);

const benchmarkChanges = execFileSync("git", ["status", "--short"], {
  cwd: checkout,
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter(Boolean);
assert.equal(
  benchmarkChanges.every(
    (line) =>
      line.includes("benchmarks/results/") ||
      line.includes("docs/evidence/issue-13/street-baseline-canvas.png") ||
      line.includes("docs/evidence/issue-25/"),
  ),
  true,
  `unexpected clean-checkout changes: ${benchmarkChanges.join(", ")}`,
);
const report = {
  schemaVersion: 1,
  source,
  commit: checkoutCommit,
  temporaryCheckoutRetainedAt: checkout,
  environment: {
    node: process.version,
    pnpm: execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim(),
    browser: await chromium.executablePath(),
  },
  commands,
  cleanAfterInstallAndRootCheck: cleanAfterRootCheck,
  generatedBenchmarkChanges: benchmarkChanges,
  replay: {
    vectors: Object.keys(replay.results),
    twiceAndByteIdentical: Object.values(replay.results).every(
      (result) => result.runs === 2 && result.identical === true,
    ),
    passed: replay.passed,
  },
  browsers: {
    applicablePassed: playwright.expected,
    unexpected: playwright.unexpected,
    flaky: playwright.flaky,
    skipped: playwright.skipped,
    projects: playwright.projects,
    passed: playwright.unexpected === 0 && playwright.flaky === 0,
  },
  benchmarks: {
    profile: benchmarks.profile.profileId,
    conservation: benchmarks.conservation,
    measurements: benchmarks.measurements,
    budgets: benchmarks.budgetResults,
    longSession: benchmarkCommands.longSession,
    passed: benchmarks.passed && benchmarkCommands.passed,
  },
  signature,
  passed: true,
};
await writeFile(
  join(evidenceDirectory, "final-gate.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    {
      passed: true,
      commit: checkoutCommit,
      commands: commands.map(({ command, durationMs, passed }) => ({
        command,
        durationMs,
        passed,
      })),
      replay: report.replay,
      browsers: report.browsers,
      benchmarkProfile: report.benchmarks.profile,
      signature: {
        stages: signature.stages,
        observerMatch: true,
        population: signature.population,
      },
      output: join(evidenceDirectory, "final-gate.json"),
    },
    null,
    2,
  ),
);
