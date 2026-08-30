import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const sourceDirectory = process.argv[2] ?? "benchmarks/results";
const outputPath =
  process.argv[3] ?? "docs/evidence/issue-16/benchmark-summary.json";

async function read(name) {
  return JSON.parse(
    await readFile(join(sourceDirectory, `${name}.json`), "utf8"),
  );
}

const [
  primitives,
  world,
  fields,
  transport,
  kernel,
  manifestation,
  itinerary,
  projection,
  renderer,
  experience,
  baseline,
] = await Promise.all([
  read("deterministic-primitives"),
  read("world-generation"),
  read("field-simulation"),
  read("planetary-day"),
  read("world-kernel"),
  read("manifestation"),
  read("analytical-itinerary"),
  read("illusion-projection"),
  read("multi-lod-renderer"),
  read("person-experience"),
  read("local-baseline"),
]);

assert.equal(world.totalPopulation, "10000000000");
assert.equal(fields.invariantReport.valid, true);
assert.equal(fields.invariantReport.residentPopulation, "10000000000");
assert.equal(fields.invariantReport.presentPopulation, "10000000000");
assert.equal(transport.budget.passed, true);
for (const result of [
  kernel,
  manifestation,
  itinerary,
  projection,
  renderer,
  experience,
])
  assert.equal(result.budgets.passed, true);
assert.equal(manifestation.workload.retainedPersonRows, 0);
assert.equal(itinerary.workload.retainedPersonRows, 0);
assert.equal(experience.workload.retainedPersonRows, 0);

const summary = {
  schemaVersion: 1,
  sourceCommit: world.commit,
  cleanCheckoutCommand:
    "git clone --branch main --single-branch <origin> <temp>/repo",
  command: "pnpm benchmark",
  profile: baseline.profile,
  browser: renderer.browser,
  hashes: {
    deterministicVector: primitives.vectorHash,
    world: world.worldHash,
    initialField: fields.initialStateHash,
    planetaryDay: transport.dayHash,
    event: kernel.eventHash,
    finalKernel: kernel.finalKernelHash,
    streetManifestation:
      projection.semanticEvidence.independentObservers.manifestationHash,
    streetEvents: projection.semanticEvidence.independentObservers.eventHash,
  },
  conservation: {
    representedPopulation: world.totalPopulation,
    residentPopulation: fields.invariantReport.residentPopulation,
    presentPopulation: fields.invariantReport.presentPopulation,
    valid: fields.invariantReport.valid,
    retainedPersonRows: 0,
  },
  measurements: {
    deterministicOperationsPerSecondP50:
      primitives.metrics.operationsPerSecondP50,
    worldGenerationP95Ms: world.metrics.generationP95Ms,
    worldRetainedHeapMiB: world.metrics.retainedHeapMiB,
    fieldCellTicksPerSecondP50: fields.metrics.cellTicksPerSecondP50,
    fieldRetainedHeapMiB: fields.metrics.retainedHeapMiB,
    planetaryDayP95Ms: transport.metrics.representativeDayP95Ms,
    planetaryDayP95MsMax: transport.budget.representativeDayP95Ms,
    kernelReplayTicksPerSecondP50: kernel.metrics.replayTicksPerSecondP50,
    kernelRetainedHeapMiB: kernel.metrics.retainedHeapMiB,
    manifestationPersonQueriesPerSecondP50:
      manifestation.metrics.personQueriesPerSecondP50,
    millionIdentityGenerationMs: manifestation.metrics.millionIdGenerationMs,
    itineraryQueriesPerSecondP50: itinerary.metrics.fullQueriesPerSecondP50,
    streetProjectionP95Ms: projection.metrics.streetProjectionP95Ms,
    streetProjectionP95MsMax: projection.budgets.streetProjectionP95MsMax,
    observerPairMs: projection.metrics.independentObserverPairMs,
    observerPairMsMax: projection.budgets.independentObserverPairMsMax,
    identityRetentionRatio: projection.metrics.identityRetentionRatio,
    fallbackFrameTimeP95Ms: renderer.metrics.fallbackFrameTimeP95Ms,
    fallbackFrameTimeP95MsMax: renderer.budgets.fallbackFrameTimeP95MsMax,
    rendererBrowserMemoryMiB: renderer.metrics.browserMemoryMiB,
    rendererBrowserMemoryMiBMax: renderer.budgets.browserMemoryMiBMax,
    planetToPersonMs: experience.metrics.planetToPersonMs,
    planetToPersonMsMax: experience.budgets.planetToPersonMsMax,
    followTickP95Ms: experience.metrics.followTickP95Ms,
    followTickP95MsMax: experience.budgets.followTickP95MsMax,
    secondObserverMs: experience.metrics.initializeSecondObserverMs,
    deepLinkLoadMs: experience.metrics.freshDeepLinkLoadMs,
    experienceBrowserHeapMiB: experience.metrics.browserHeapMiB,
    experienceBrowserHeapMiBMax: experience.budgets.browserHeapMiBMax,
  },
  budgetResults: {
    baselineProfile: "passed by benchmark:check",
    transport: transport.budget.passed,
    kernel: kernel.budgets.passed,
    manifestation: manifestation.budgets.passed,
    itinerary: itinerary.budgets.passed,
    projection: projection.budgets.passed,
    renderer: renderer.budgets.passed,
    experience: experience.budgets.passed,
  },
  passed: true,
};

await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      passed: true,
      sourceCommit: summary.sourceCommit,
      output: outputPath,
      measurements: summary.measurements,
    },
    null,
    2,
  ),
);
