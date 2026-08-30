import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const outputDirectory = process.argv[2] ?? "docs/evidence/issue-16";
const vectors = [
  ["world", "scripts/replay-world.mjs"],
  ["projection", "scripts/projection-vector.mjs"],
  ["person", "scripts/person-vector.mjs"],
  ["itinerary", "scripts/itinerary-vector.mjs"],
];

function run(script) {
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`${script} exited with status ${result.status}`);
  }
  return result.stdout;
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

const results = {};
for (const [name, script] of vectors) {
  const first = run(script);
  const second = run(script);
  assert.equal(second, first, `${name} replay output differed between runs`);
  const parsed = JSON.parse(first);
  results[name] = {
    command: `node ${script}`,
    runs: 2,
    byteLength: Buffer.byteLength(first),
    sha256: digest(first),
    identical: true,
    semanticHashes: Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, value]) =>
          (key.toLowerCase().includes("hash") || key === "population") &&
          typeof value === "string",
      ),
    ),
  };
}

assert.equal(results.world.semanticHashes.population, "10000000000");
assert.equal(results.world.semanticHashes.worldHash, "ed66e344fcd7e737");
assert.equal(results.world.semanticHashes.eventHash, "ec998bbac0999abc");
const report = {
  schemaVersion: 1,
  command: "pnpm gate:m2:replay",
  method:
    "Each canonical JSON vector was generated twice in independent processes and compared byte-for-byte.",
  results,
  passed: Object.values(results).every((result) => result.identical),
};
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  `${outputDirectory}/deterministic-replay.json`,
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
