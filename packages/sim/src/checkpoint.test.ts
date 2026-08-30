import { describe, expect, it } from "vitest";

import {
  EVENT_FORMAT_VERSION,
  LOCAL_CHECKPOINT_VERSION,
  WORLD_FORMAT_VERSION,
  advanceWorldKernel,
  createWorldKernel,
  replayKernelHashes,
  restoreWorldKernel,
  serializeWorldKernel,
} from "./checkpoint";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function mutateSnapshot(
  bytes: Uint8Array,
  mutation: (value: Record<string, unknown>) => void,
): Uint8Array {
  const value = JSON.parse(decoder.decode(bytes)) as Record<string, unknown>;
  mutation(value);
  return encoder.encode(JSON.stringify(value));
}

describe("versioned local world checkpoints", () => {
  it("restores a baseline snapshot to the same semantic state and bytes", () => {
    const original = advanceWorldKernel(createWorldKernel(), 13);
    const bytes = serializeWorldKernel(original);
    const restored = restoreWorldKernel(bytes);
    expect(restored).toEqual(original);
    expect(restored.kernelHash).toBe(original.kernelHash);
    expect(serializeWorldKernel(restored)).toEqual(bytes);
  });

  it("replays identical suffix hashes from genesis and three intermediate checkpoints", () => {
    const genesis = createWorldKernel();
    const genesisHashes = replayKernelHashes(genesis, 24);
    for (const checkpointTick of [3, 9, 17]) {
      const checkpoint = advanceWorldKernel(genesis, checkpointTick);
      const restored = restoreWorldKernel(serializeWorldKernel(checkpoint));
      expect(replayKernelHashes(restored, 24 - checkpointTick)).toEqual(
        genesisHashes.slice(checkpointTick),
      );
    }
  });

  it("reproduces the full-day state and event hashes independently", () => {
    const first = createWorldKernel();
    const second = createWorldKernel();
    expect(first.eventHash).toBe(second.eventHash);
    expect(replayKernelHashes(first, 24)).toEqual(
      replayKernelHashes(second, 24),
    );
  });

  it("fails safely for corrupt, truncated, incompatible, and out-of-order inputs", () => {
    const bytes = serializeWorldKernel(
      advanceWorldKernel(createWorldKernel(), 4),
    );
    expect(() => restoreWorldKernel(bytes.slice(0, bytes.length - 11))).toThrow(
      /Invalid checkpoint JSON/,
    );
    expect(() =>
      restoreWorldKernel(
        mutateSnapshot(bytes, (value) => {
          value["worldHash"] = "0000000000000000";
        }),
      ),
    ).toThrow(/world hash mismatch/);
    expect(() =>
      restoreWorldKernel(
        mutateSnapshot(bytes, (value) => {
          value["checkpointVersion"] = 999;
        }),
      ),
    ).toThrow(/Unsupported checkpoint version 999/);
    expect(() =>
      restoreWorldKernel(
        mutateSnapshot(bytes, (value) => {
          const events = value["events"] as unknown[];
          value["events"] = [...events].reverse();
        }),
      ),
    ).toThrow(/events must be ordered by tick and id/);
  });

  it("freezes explicit local world, event, and checkpoint versions", () => {
    expect(WORLD_FORMAT_VERSION).toBe(1);
    expect(EVENT_FORMAT_VERSION).toBe(1);
    expect(LOCAL_CHECKPOINT_VERSION).toBe(1);
    const kernel = createWorldKernel();
    expect(kernel.world.schemaVersion).toBe(WORLD_FORMAT_VERSION);
    expect(
      kernel.events.every((event) => event.version === EVENT_FORMAT_VERSION),
    ).toBe(true);
  });
});
