import { writeFile } from "node:fs/promises";

import {
  EVENT_FORMAT_VERSION,
  LOCAL_CHECKPOINT_VERSION,
  WORLD_FORMAT_VERSION,
  advanceWorldKernel,
  createWorldKernel,
  replayKernelHashes,
  restoreWorldKernel,
  serializeWorldKernel,
} from "../packages/sim/dist/checkpoint.js";

const genesis = createWorldKernel();
const fullDayHashes = replayKernelHashes(genesis, 24);
const checkpoints = [];
for (const tick of [3, 9, 17]) {
  const checkpoint = advanceWorldKernel(genesis, tick);
  const bytes = serializeWorldKernel(checkpoint);
  const restored = restoreWorldKernel(bytes);
  const suffix = replayKernelHashes(restored, 24 - tick);
  if (JSON.stringify(suffix) !== JSON.stringify(fullDayHashes.slice(tick)))
    throw new Error(`checkpoint replay diverged at tick ${tick}`);
  checkpoints.push({
    tick,
    kernelHash: checkpoint.kernelHash,
    snapshotBytes: bytes.length,
    restoredKernelHash: restored.kernelHash,
    suffixFinalHash: suffix.at(-1),
  });
}

const snapshotIndex = process.argv.indexOf("--snapshot");
if (snapshotIndex >= 0) {
  const outputPath = process.argv[snapshotIndex + 1];
  if (!outputPath) throw new RangeError("--snapshot requires an output path");
  await writeFile(
    outputPath,
    serializeWorldKernel(advanceWorldKernel(genesis, 13)),
  );
}

const result = {
  schemaVersion: 1,
  worldFormatVersion: WORLD_FORMAT_VERSION,
  eventFormatVersion: EVENT_FORMAT_VERSION,
  checkpointVersion: LOCAL_CHECKPOINT_VERSION,
  worldHash: genesis.world.worldHash,
  eventHash: genesis.eventHash,
  initialFieldHash: genesis.field.stateHash,
  initialKernelHash: genesis.kernelHash,
  fullDayHashes,
  finalKernelHash: fullDayHashes.at(-1),
  checkpoints,
  population: genesis.field.totalPopulation.toString(),
};

console.log(JSON.stringify(result, null, 2));
