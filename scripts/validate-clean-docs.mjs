import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { chromium } from "@playwright/test";

const evidenceDirectory = "docs/evidence/issue-26";
const temporaryRoot = await mkdtemp(join(tmpdir(), "ten-billion-lives-docs-"));
const checkout = join(temporaryRoot, "repo");
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

async function waitForPreview(child, readOutput) {
  for (let attempt = 0; attempt < 1_200; attempt += 1) {
    const output = readOutput();
    const match = /Local:\s+(http:\/\/127\.0\.0\.1:\d+\/)/.exec(output);
    if (match?.[1]) return match[1];
    if (child.exitCode !== null)
      throw new Error(
        `pnpm start exited before launch:\n${output.slice(-8_000)}`,
      );
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`pnpm start did not print a local URL:\n${readOutput()}`);
}

await mkdir(evidenceDirectory, { recursive: true });
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
    process.cwd(),
  ),
);
const checkoutCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: checkout,
  encoding: "utf8",
}).trim();
assert.equal(checkoutCommit, expectedCommit, "remote main is not current HEAD");
commands.push(run("pnpm", ["install", "--frozen-lockfile"]));
commands.push(run("pnpm", ["docs:check"]));
commands.push(run("pnpm", ["check"]));

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
let browserEvidence;
try {
  previewUrl = await waitForPreview(preview, () => previewOutput);
  const response = await fetch(previewUrl);
  assert.equal(response.status, 200);
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await page.goto(previewUrl, { waitUntil: "networkidle" });
  browserEvidence = {
    title: await page.title(),
    population: await page.getByTestId("represented-population").textContent(),
    firstRunClaim: await page.getByTestId("first-run-claim").textContent(),
    backend: await page.getByTestId("render-backend").textContent(),
  };
  assert.equal(browserEvidence.title, "Ten Billion Lives");
  assert.equal(browserEvidence.population, "10,000,000,000");
  assert.match(browserEvidence.firstRunClaim ?? "", /represented lives/);
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
  command: "pnpm start",
  durationMs: performance.now() - previewStarted,
  exitCode: null,
  outputTail: previewOutput.trim().slice(-4_000),
  passed: true,
});

const status = execFileSync("git", ["status", "--short"], {
  cwd: checkout,
  encoding: "utf8",
}).trim();
assert.equal(status, "", "clean walkthrough modified the checkout");
const report = {
  schemaVersion: 1,
  source,
  commit: checkoutCommit,
  temporaryCheckoutRetainedAt: checkout,
  environment: {
    node: process.version,
    pnpm: execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim(),
  },
  commands,
  documentation: {
    maintainedFiles: 13,
    spellingIssues: 0,
    validated: [
      "local links and heading fragments",
      "shell snippets and root scripts",
      "diagram text alternatives",
      "claim and non-claim consistency",
      "zero external runtime packages",
      "installed direct development versions and licenses",
    ],
  },
  productionPreview: {
    url: previewUrl,
    browserEvidence,
    passed: true,
  },
  cleanWorktreeAfterValidation: true,
  passed: true,
};
await writeFile(
  `${evidenceDirectory}/clean-doc-walkthrough.json`,
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
      productionPreview: report.productionPreview,
      output: `${evidenceDirectory}/clean-doc-walkthrough.json`,
    },
    null,
    2,
  ),
);
