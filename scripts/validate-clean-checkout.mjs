import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { chromium } from "@playwright/test";

/* global document */

const evidenceDirectory = "docs/evidence/issue-25";
const previewUrl = "http://127.0.0.1:4180";

function run(command, args, cwd) {
  const started = performance.now();
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) {
    process.stderr.write(output.slice(-16_000));
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}`);
  }
  return {
    command: [command, ...args].join(" "),
    durationMs: performance.now() - started,
    exitCode: result.status,
    outputTail: output.trim().slice(-4_000),
    passed: true,
  };
}

async function waitForPreview() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(previewUrl);
      if (response.ok) return response;
    } catch {
      // The clean production preview may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("clean-checkout production preview did not become ready");
}

await mkdir(evidenceDirectory, { recursive: true });
const temporaryParent = await mkdtemp(join(tmpdir(), "ten-billion-lives-qa-"));
const checkout = join(temporaryParent, "repo");
const origin = execFileSync("git", ["config", "--get", "remote.origin.url"], {
  encoding: "utf8",
}).trim();
const expectedCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
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
      origin,
      checkout,
    ],
    process.cwd(),
  ),
);
const checkoutCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: checkout,
  encoding: "utf8",
}).trim();
assert.equal(checkoutCommit, expectedCommit);
commands.push(run("pnpm", ["install", "--frozen-lockfile"], checkout));
commands.push(run("pnpm", ["check"], checkout));
const audit = run(
  "pnpm",
  ["audit", "--audit-level", "high", "--json"],
  checkout,
);
const auditReport = JSON.parse(audit.outputTail);
assert.deepEqual(auditReport.advisories, {});
commands.push({
  ...audit,
  outputTail: JSON.stringify(auditReport.metadata),
});

const preview = spawn(
  "pnpm",
  ["preview", "--host", "127.0.0.1", "--port", "4180"],
  { cwd: checkout, stdio: "ignore" },
);
try {
  const response = await waitForPreview();
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const requests = [];
  const consoleErrors = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const navigationStarted = performance.now();
  await page.goto(`${previewUrl}/?renderer=canvas&quality=baseline`, {
    waitUntil: "networkidle",
  });
  for (const name of [
    "Enter Brindle Bay",
    "Enter Harbor Street",
    "Meet a resident",
  ])
    await page.getByRole("button", { name }).click();
  await page.getByRole("button", { name: "Initialize observer B" }).click();
  const journeyMs = performance.now() - navigationStarted;
  const browserEvidence = await page.evaluate(() => {
    const text = (testId) =>
      document.querySelector(`[data-testid=${testId}]`)?.textContent ?? "";
    return {
      title: document.title,
      secureContext: globalThis.isSecureContext,
      population: text("represented-population"),
      personA: text("observer-a-person-id"),
      personB: text("observer-b-person-id"),
      stateHash: text("state-hash"),
      manifestationA: text("manifestation-hash-a"),
      manifestationB: text("manifestation-hash-b"),
      eventA: text("projection-event-hash-a"),
      eventB: text("projection-event-hash-b"),
      observerMatch: text("observer-match"),
      backend: text("render-backend"),
      csp:
        document
          .querySelector('meta[http-equiv="Content-Security-Policy"]')
          ?.getAttribute("content") ?? "",
    };
  });
  assert.equal(browserEvidence.population, "10,000,000,000");
  assert.equal(browserEvidence.personA, browserEvidence.personB);
  assert.equal(browserEvidence.manifestationA, browserEvidence.manifestationB);
  assert.equal(browserEvidence.eventA, browserEvidence.eventB);
  assert.equal(browserEvidence.observerMatch, "Semantic match");
  assert.equal(browserEvidence.backend, "canvas2d");
  assert.equal(consoleErrors.length, 0);
  const externalRequests = requests.filter(
    (url) => new URL(url).origin !== new URL(previewUrl).origin,
  );
  assert.deepEqual(externalRequests, []);
  await browser.close();

  const lockfile = await readFile(join(checkout, "pnpm-lock.yaml"));
  const worktree = execFileSync("git", ["status", "--porcelain"], {
    cwd: checkout,
    encoding: "utf8",
  }).trim();
  assert.equal(worktree, "");
  const report = {
    schemaVersion: 1,
    source: origin,
    commit: checkoutCommit,
    temporaryCheckoutRetainedAt: checkout,
    environment: {
      node: process.version,
      pnpm: execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim(),
      lockfileSha256: createHash("sha256").update(lockfile).digest("hex"),
    },
    commands,
    productionPreview: {
      command: "pnpm preview --host 127.0.0.1 --port 4180",
      status: response.status,
      journeyMs,
      requests: requests.length,
      externalRequests,
      consoleErrors,
      browserEvidence,
      passed: true,
    },
    cleanWorktreeAfterValidation: true,
    passed: true,
  };
  await writeFile(
    `${evidenceDirectory}/clean-checkout.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      {
        passed: true,
        commit: report.commit,
        commands: commands.map((command) => ({
          command: command.command,
          durationMs: command.durationMs,
          passed: command.passed,
        })),
        productionPreview: report.productionPreview,
        output: `${evidenceDirectory}/clean-checkout.json`,
      },
      null,
      2,
    ),
  );
} finally {
  preview.kill("SIGINT");
}
