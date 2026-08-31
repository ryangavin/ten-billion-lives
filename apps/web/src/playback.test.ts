import { describe, expect, it } from "vitest";

import {
  PLAYBACK_RATE_OPTIONS,
  createPlaybackState,
  playbackAdvanceAt,
  playbackTimeAt,
  reducePlayback,
  type PlaybackRate,
} from "./playback";

const at = (tick: bigint, phasePermillion: number) => ({
  tick,
  phasePermillion,
});

describe("injected-clock visual playback", () => {
  it("exposes only the frozen, explicit rate labels", () => {
    expect(PLAYBACK_RATE_OPTIONS.map(({ label }) => label)).toEqual([
      "Paused",
      "1 simulated minute per real second",
      "5 simulated minutes per real second",
      "15 simulated minutes per real second",
      "60 simulated minutes per real second",
    ]);
  });

  it.each([
    [1, 16_666],
    [5, 83_333],
    [15, 250_000],
    [60, 1_000_000],
  ] as const)(
    "advances %i simulated minutes per second without frame accumulation",
    (rate, expectedParts) => {
      const initial = createPlaybackState(at(3n, 0));
      const playing = reducePlayback(initial, {
        type: "play",
        rate,
        clockMicroseconds: 4_000_000,
      });
      const sampled = reducePlayback(playing, {
        type: "sample",
        clockMicroseconds: 5_000_000,
      });
      const direct = playbackTimeAt(playing, 5_000_000);

      expect(sampled.visualTime).toEqual(
        expectedParts === 1_000_000 ? at(4n, 0) : at(3n, expectedParts),
      );
      expect(sampled.visualTime).toEqual(direct);
      expect(sampled.anchorTime).toEqual(at(3n, 0));
      expect(sampled.anchorClockMicroseconds).toBe(4_000_000);
    },
  );

  it("carries hours and makes intermediate frame cadence irrelevant", () => {
    const playing = reducePlayback(createPlaybackState(at(8n, 900_000)), {
      type: "play",
      rate: 15,
      clockMicroseconds: 10_000,
    });
    const direct = reducePlayback(playing, {
      type: "sample",
      clockMicroseconds: 2_010_000,
    });
    const withFrames = [110_000, 343_333, 1_110_000, 2_010_000].reduce(
      (state, clockMicroseconds) =>
        reducePlayback(state, { type: "sample", clockMicroseconds }),
      playing,
    );

    expect(direct.visualTime).toEqual(at(9n, 400_000));
    expect(withFrames).toEqual(direct);
    const directSeek = reducePlayback(createPlaybackState(at(0n, 0)), {
      type: "seek",
      visualTime: at(9n, 400_000),
      clockMicroseconds: 2_010_000,
    });
    expect(directSeek.visualTime).toEqual(direct.visualTime);
    expect(directSeek.poseTime).toEqual(direct.poseTime);
    expect(playbackAdvanceAt(playing, 2_010_000)).toMatchObject({
      advanceTicks: 1n,
      visualTime: at(9n, 400_000),
    });
  });

  it("pauses, resumes, seeks, and rewinds from explicit anchors", () => {
    const playing = reducePlayback(createPlaybackState(at(1n, 500_000)), {
      type: "play",
      rate: 5,
      clockMicroseconds: 1_000_000,
    });
    const paused = reducePlayback(playing, {
      type: "pause",
      clockMicroseconds: 4_000_000,
    });
    expect(paused.visualTime).toEqual(at(1n, 750_000));
    expect(
      reducePlayback(paused, {
        type: "sample",
        clockMicroseconds: 40_000_000,
      }).visualTime,
    ).toEqual(paused.visualTime);

    const resumed = reducePlayback(paused, {
      type: "play",
      rate: 1,
      clockMicroseconds: 40_000_000,
    });
    expect(
      reducePlayback(resumed, {
        type: "sample",
        clockMicroseconds: 43_000_000,
      }).visualTime,
    ).toEqual(at(1n, 800_000));

    const sought = reducePlayback(resumed, {
      type: "seek",
      visualTime: at(19n, 250_000),
      clockMicroseconds: 50_000_000,
    });
    expect(sought.visualTime).toEqual(at(19n, 250_000));
    expect(sought.anchorTime).toEqual(at(19n, 250_000));
    const rewound = reducePlayback(sought, {
      type: "rewind",
      visualTime: at(7n, 0),
      clockMicroseconds: 51_000_000,
    });
    expect(rewound.visualTime).toEqual(at(7n, 0));
  });

  it("freezes hidden time and resumes without catch-up", () => {
    const playing = reducePlayback(createPlaybackState(at(2n, 0)), {
      type: "play",
      rate: 60,
      clockMicroseconds: 0,
    });
    const hidden = reducePlayback(playing, {
      type: "hidden",
      clockMicroseconds: 500_000,
    });
    expect(hidden.visualTime).toEqual(at(2n, 500_000));
    expect(hidden.status).toBe("hidden");
    expect(
      reducePlayback(hidden, {
        type: "sample",
        clockMicroseconds: 100_000_000,
      }).visualTime,
    ).toEqual(at(2n, 500_000));

    const visible = reducePlayback(hidden, {
      type: "visible",
      clockMicroseconds: 100_000_000,
    });
    expect(visible.status).toBe("playing");
    expect(visible.rate).toBe(60);
    expect(
      reducePlayback(visible, {
        type: "sample",
        clockMicroseconds: 100_250_000,
      }).visualTime,
    ).toEqual(at(2n, 750_000));
  });

  it("starts paused and quantizes only pose time under reduced motion", () => {
    const initial = createPlaybackState(at(4n, 100_000), {
      reducedMotion: true,
    });
    expect(initial.status).toBe("paused");
    const playing = reducePlayback(initial, {
      type: "play",
      rate: 15,
      clockMicroseconds: 0,
    });
    const sampled = reducePlayback(playing, {
      type: "sample",
      clockMicroseconds: 800_000,
    });
    expect(sampled.visualTime).toEqual(at(4n, 300_000));
    expect(sampled.poseTime).toEqual(at(4n, 250_000));
  });

  it("reproduces independently and rejects every invalid clock/rate/time", () => {
    const actions = [
      {
        type: "play" as const,
        rate: 15 as PlaybackRate,
        clockMicroseconds: 2_000_000,
      },
      { type: "sample" as const, clockMicroseconds: 3_250_000 },
      { type: "pause" as const, clockMicroseconds: 4_000_000 },
    ];
    const run = () =>
      actions.reduce(
        (state, action) => reducePlayback(state, action),
        createPlaybackState(at(0n, 999_999)),
      );
    expect(run()).toEqual(run());

    const playing = reducePlayback(createPlaybackState(at(0n, 0)), {
      type: "play",
      rate: 1,
      clockMicroseconds: 20,
    });
    for (const clockMicroseconds of [
      19,
      1.5,
      -1,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      const failed = reducePlayback(playing, {
        type: "sample",
        clockMicroseconds,
      });
      expect(failed.status).toBe("error");
      expect(failed.rate).toBe("Paused");
      expect(failed.error).toMatch(/clock/i);
    }
    const sampledForward = reducePlayback(playing, {
      type: "sample",
      clockMicroseconds: 40,
    });
    expect(
      reducePlayback(sampledForward, {
        type: "sample",
        clockMicroseconds: 30,
      }).status,
    ).toBe("error");
    expect(
      reducePlayback(playing, {
        type: "play",
        rate: 5,
        clockMicroseconds: 19,
      }).status,
    ).toBe("error");
    expect(
      reducePlayback(playing, {
        type: "seek",
        visualTime: at(2n, 0),
        clockMicroseconds: 19,
      }).status,
    ).toBe("error");
    expect(
      reducePlayback(playing, {
        type: "sample",
        clockMicroseconds: undefined as unknown as number,
      }).status,
    ).toBe("error");
    expect(() =>
      reducePlayback(createPlaybackState(at(0n, 0)), {
        type: "play",
        rate: 2 as PlaybackRate,
        clockMicroseconds: 0,
      }),
    ).toThrow(/rate/);
    expect(() => createPlaybackState(at(-1n, 0))).toThrow(/nonnegative/);
    expect(() => createPlaybackState(at(0n, -1))).toThrow(/phase/);
    expect(() => createPlaybackState(at(0n, 1_000_000))).toThrow(/phase/);
    expect(() => createPlaybackState(at(0n, 0.5))).toThrow(/phase/);
  });
});
