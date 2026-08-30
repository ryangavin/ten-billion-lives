import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import {
  deterministicVectorHash,
  randomU32,
} from "../packages/sim/src/deterministic.ts";

const operations = 100_000;
const samples = [];
for (let sample = 0; sample < 7; sample += 1) {
  let checksum = 0;
  const started = performance.now();
  for (let index = 0; index < operations; index += 1) {
    checksum ^= randomU32("benchmark", 42n, BigInt(index));
  }
  if (!Number.isInteger(checksum)) throw new Error("invalid checksum");
  samples.push((operations * 1000) / (performance.now() - started));
}
samples.sort((left, right) => left - right);

const result = {
  schemaVersion: 1,
  benchmarkVersion: "deterministic-primitives-v1",
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  seed: "benchmark/42",
  workload: {
    operation: "domain-separated randomU32",
    operationsPerSample: operations,
    samples: samples.length,
  },
  metrics: {
    operationsPerSecondP50: samples[Math.floor(samples.length * 0.5)],
    operationsPerSecondP95: samples[Math.floor(samples.length * 0.95)],
  },
  vectorHash: deterministicVectorHash(),
};

await writeFile(
  "benchmarks/results/deterministic-primitives.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result.metrics));
