import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const outputDirectory = process.argv[2] ?? "docs/evidence/issue-16";
const result = spawnSync(
  "pnpm",
  ["exec", "playwright", "test", "--reporter=json", "--workers=1"],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  },
);

if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.stderr.write(result.stdout.slice(-16_000));
  throw new Error(`Playwright exited with status ${result.status}`);
}

const report = JSON.parse(result.stdout);
const cases = [];

function collect(suites, ancestors = []) {
  for (const suite of suites ?? []) {
    const path = suite.title ? [...ancestors, suite.title] : ancestors;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const finalResult = test.results?.at(-1);
        cases.push({
          title: [...path, spec.title].filter(Boolean).join(" › "),
          project: test.projectName,
          expectedStatus: test.expectedStatus,
          actualStatus: finalResult?.status ?? "not-run",
          durationMs: (test.results ?? []).reduce(
            (sum, attempt) => sum + (attempt.duration ?? 0),
            0,
          ),
          retries: Math.max(0, (test.results?.length ?? 1) - 1),
          ok: spec.ok === true,
        });
      }
    }
    collect(suite.suites, path);
  }
}

collect(report.suites);
const projects = Object.fromEntries(
  [...new Set(cases.map((testCase) => testCase.project))]
    .sort()
    .map((project) => {
      const projectCases = cases.filter(
        (testCase) => testCase.project === project,
      );
      return [
        project,
        {
          passed: projectCases.filter(
            (testCase) => testCase.actualStatus === "passed" && testCase.ok,
          ).length,
          skipped: projectCases.filter(
            (testCase) =>
              testCase.actualStatus === "skipped" &&
              testCase.expectedStatus === "skipped" &&
              testCase.ok,
          ).length,
          total: projectCases.length,
          durationMs: projectCases.reduce(
            (sum, testCase) => sum + testCase.durationMs,
            0,
          ),
        },
      ];
    }),
);
const failed = cases.filter(
  (testCase) =>
    !testCase.ok ||
    !(
      testCase.actualStatus === "passed" ||
      (testCase.actualStatus === "skipped" &&
        testCase.expectedStatus === "skipped")
    ),
);
assert.equal(
  cases.length >= 12,
  true,
  "expected at least the six M2 journeys in each of two browsers",
);
assert.deepEqual(failed, []);

const summary = {
  schemaVersion: 1,
  command: "pnpm exec playwright test --reporter=json --workers=1",
  productionWebServer:
    report.config?.webServer?.command ??
    "pnpm build && pnpm preview --host 127.0.0.1 --port 4173",
  startTime: report.stats?.startTime,
  wallDurationMs: report.stats?.duration,
  expected: report.stats?.expected,
  unexpected: report.stats?.unexpected,
  flaky: report.stats?.flaky,
  skipped: report.stats?.skipped,
  projects,
  cases,
  passed: failed.length === 0 && report.stats?.unexpected === 0,
};
assert.equal(summary.passed, true);
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  `${outputDirectory}/playwright-summary.json`,
  `${JSON.stringify(summary, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    {
      passed: summary.passed,
      cases: cases.length,
      projects,
      output: `${outputDirectory}/playwright-summary.json`,
    },
    null,
    2,
  ),
);
