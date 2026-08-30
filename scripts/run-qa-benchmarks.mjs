import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const evidenceDirectory = "docs/evidence/issue-25";
const benchmarkCommands = [
  "benchmark:primitives",
  "benchmark:world",
  "benchmark:fields",
  "benchmark:transport",
  "benchmark:kernel",
  "benchmark:manifest",
  "benchmark:itinerary",
  "benchmark:projection",
  "benchmark:renderer",
  "benchmark:experience",
  "benchmark",
];

function run(command, args) {
  const started = performance.now();
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
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
    outputTail: output.trim().slice(-2_000),
    passed: true,
  };
}

await mkdir(evidenceDirectory, { recursive: true });
const results = benchmarkCommands.map((script) => run("pnpm", ["run", script]));
results.push(
  run("node", [
    "scripts/summarize-m2-benchmarks.mjs",
    "benchmarks/results",
    `${evidenceDirectory}/benchmark-summary.json`,
  ]),
);
const longSession = JSON.parse(
  await readFile("benchmarks/results/adaptive-quality.json", "utf8"),
);
assert.equal(longSession.budgets.passed, true);
assert.equal(longSession.workload.mode, "wall-clock");
assert.equal(longSession.workload.actualSoakDurationMs >= 30 * 60 * 1000, true);
const report = {
  schemaVersion: 1,
  method:
    "Commands ran sequentially on one profile to avoid cross-benchmark CPU and memory contention.",
  commands: results,
  longSession: {
    source: "benchmarks/results/adaptive-quality.json",
    commit: longSession.commit,
    mode: longSession.workload.mode,
    durationMs: longSession.workload.actualSoakDurationMs,
    totalFrames: longSession.workload.totalFrames,
    baselineFrameP95Ms: longSession.qualityComparison.baselineFrameMs.p95,
    maximumHeapMiB: longSession.metrics.maximumHeapMiB,
    retainedHeapGrowthMiB: longSession.metrics.retainedHeapGrowthMiB,
    passed: true,
  },
  passed: results.every((result) => result.passed),
};
await writeFile(
  `${evidenceDirectory}/benchmark-commands.json`,
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    {
      passed: report.passed,
      commands: results.map((result) => ({
        command: result.command,
        durationMs: result.durationMs,
        passed: result.passed,
      })),
      longSession: report.longSession,
      output: `${evidenceDirectory}/benchmark-commands.json`,
    },
    null,
    2,
  ),
);
