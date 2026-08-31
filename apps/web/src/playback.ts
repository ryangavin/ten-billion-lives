import {
  VISUAL_PHASE_PARTS,
  createVisualTime,
  type VisualTime,
} from "@ten-billion-lives/manifest";

export type PlaybackRate = 1 | 5 | 15 | 60;
export type PlaybackStatus = "paused" | "playing" | "hidden" | "error";
export type PlaybackRateLabel = PlaybackRate | "Paused";

export const PLAYBACK_RATE_OPTIONS = Object.freeze([
  Object.freeze({
    rate: "Paused" as const,
    label: "Paused" as const,
  }),
  Object.freeze({
    rate: 1 as const,
    label: "1 simulated minute per real second" as const,
  }),
  Object.freeze({
    rate: 5 as const,
    label: "5 simulated minutes per real second" as const,
  }),
  Object.freeze({
    rate: 15 as const,
    label: "15 simulated minutes per real second" as const,
  }),
  Object.freeze({
    rate: 60 as const,
    label: "60 simulated minutes per real second" as const,
  }),
]);

export interface PlaybackState {
  readonly visualTime: VisualTime;
  readonly poseTime: VisualTime;
  readonly anchorTime: VisualTime;
  readonly anchorClockMicroseconds: number | null;
  readonly lastClockMicroseconds: number | null;
  readonly status: PlaybackStatus;
  readonly rate: PlaybackRateLabel;
  readonly resumeRate: PlaybackRateLabel;
  readonly reducedMotion: boolean;
  readonly error: string | null;
}

export interface PlaybackAdvanceCommand {
  readonly advanceTicks: bigint;
  readonly visualTime: VisualTime;
  readonly poseTime: VisualTime;
}

export interface PlaybackOptions {
  readonly reducedMotion?: boolean;
}

export type PlaybackAction =
  | Readonly<{
      type: "play";
      rate: PlaybackRate;
      clockMicroseconds: number;
    }>
  | Readonly<{ type: "sample"; clockMicroseconds: number }>
  | Readonly<{ type: "pause"; clockMicroseconds: number }>
  | Readonly<{
      type: "seek" | "rewind";
      visualTime: VisualTime;
      clockMicroseconds: number;
    }>
  | Readonly<{ type: "hidden" | "visible"; clockMicroseconds: number }>;

const rates = new Set<PlaybackRate>([1, 5, 15, 60]);

function assertRate(rate: PlaybackRate): void {
  if (!rates.has(rate))
    throw new RangeError("playback rate must be 1, 5, 15, or 60");
}

function clockError(clockMicroseconds: number): string | null {
  return Number.isSafeInteger(clockMicroseconds) && clockMicroseconds >= 0
    ? null
    : "clock sample must be a nonnegative safe integer number of microseconds";
}

function stateClockError(
  state: PlaybackState,
  clockMicroseconds: number,
): string | null {
  const invalidClock = clockError(clockMicroseconds);
  if (invalidClock !== null) return invalidClock;
  return state.lastClockMicroseconds !== null &&
    clockMicroseconds < state.lastClockMicroseconds
    ? "clock sample decreased below the previous monotonic sample"
    : null;
}

function canonical(time: VisualTime): VisualTime {
  return createVisualTime(time.tick, time.phasePermillion);
}

function quantizedPoseTime(
  time: VisualTime,
  reducedMotion: boolean,
): VisualTime {
  if (!reducedMotion) return time;
  const step = 250_000n;
  const total =
    time.tick * BigInt(VISUAL_PHASE_PARTS) + BigInt(time.phasePermillion);
  const quantized = (total / step) * step;
  return createVisualTime(
    quantized / BigInt(VISUAL_PHASE_PARTS),
    Number(quantized % BigInt(VISUAL_PHASE_PARTS)),
  );
}

function freezeState(state: PlaybackState): PlaybackState {
  return Object.freeze(state);
}

function failed(state: PlaybackState, error: string): PlaybackState {
  return freezeState({
    ...state,
    anchorTime: state.visualTime,
    anchorClockMicroseconds: null,
    status: "error",
    rate: "Paused",
    resumeRate: "Paused",
    error,
  });
}

function withTime(state: PlaybackState, visualTime: VisualTime): PlaybackState {
  return freezeState({
    ...state,
    visualTime,
    poseTime: quantizedPoseTime(visualTime, state.reducedMotion),
    error: null,
  });
}

export function createPlaybackState(
  visualTime: VisualTime,
  options: PlaybackOptions = {},
): PlaybackState {
  const time = canonical(visualTime);
  const reducedMotion = options.reducedMotion ?? false;
  return freezeState({
    visualTime: time,
    poseTime: quantizedPoseTime(time, reducedMotion),
    anchorTime: time,
    anchorClockMicroseconds: null,
    lastClockMicroseconds: null,
    status: "paused",
    rate: "Paused",
    resumeRate: "Paused",
    reducedMotion,
    error: null,
  });
}

export function playbackTimeAt(
  state: PlaybackState,
  clockMicroseconds: number,
): VisualTime {
  const invalidClock = clockError(clockMicroseconds);
  if (invalidClock !== null) throw new RangeError(invalidClock);
  if (state.status !== "playing") return state.visualTime;
  if (state.anchorClockMicroseconds === null || typeof state.rate !== "number")
    throw new Error("playing playback state is missing an explicit anchor");
  const elapsed = clockMicroseconds - state.anchorClockMicroseconds;
  if (
    elapsed < 0 ||
    (state.lastClockMicroseconds !== null &&
      clockMicroseconds < state.lastClockMicroseconds)
  )
    throw new RangeError("clock sample decreased below the playback anchor");
  const addedParts = (BigInt(elapsed) * BigInt(state.rate)) / 60n;
  const total =
    state.anchorTime.tick * BigInt(VISUAL_PHASE_PARTS) +
    BigInt(state.anchorTime.phasePermillion) +
    addedParts;
  return createVisualTime(
    total / BigInt(VISUAL_PHASE_PARTS),
    Number(total % BigInt(VISUAL_PHASE_PARTS)),
  );
}

export function playbackAdvanceAt(
  state: PlaybackState,
  clockMicroseconds: number,
): PlaybackAdvanceCommand {
  const visualTime = playbackTimeAt(state, clockMicroseconds);
  const advanceTicks = visualTime.tick - state.visualTime.tick;
  if (advanceTicks < 0n)
    throw new RangeError("clock sample would rewind authoritative time");
  return Object.freeze({
    advanceTicks,
    visualTime,
    poseTime: quantizedPoseTime(visualTime, state.reducedMotion),
  });
}

function sampled(
  state: PlaybackState,
  clockMicroseconds: number,
): PlaybackState {
  if (state.status !== "playing") return state;
  try {
    return freezeState({
      ...withTime(state, playbackTimeAt(state, clockMicroseconds)),
      lastClockMicroseconds: clockMicroseconds,
    });
  } catch (error) {
    return failed(
      state,
      error instanceof Error ? error.message : "clock sample failed",
    );
  }
}

function explicitAnchor(
  state: PlaybackState,
  visualTime: VisualTime,
  clockMicroseconds: number,
): PlaybackState {
  const invalidStateClock = stateClockError(state, clockMicroseconds);
  if (invalidStateClock !== null) return failed(state, invalidStateClock);
  const time = canonical(visualTime);
  const playing = state.status === "playing";
  return freezeState({
    ...state,
    visualTime: time,
    poseTime: quantizedPoseTime(time, state.reducedMotion),
    anchorTime: time,
    anchorClockMicroseconds: playing ? clockMicroseconds : null,
    lastClockMicroseconds: clockMicroseconds,
    error: null,
  });
}

export function reducePlayback(
  state: PlaybackState,
  action: PlaybackAction,
): PlaybackState {
  if (action.type === "sample") return sampled(state, action.clockMicroseconds);

  if (action.type === "play") {
    assertRate(action.rate);
    const invalidClock = stateClockError(state, action.clockMicroseconds);
    if (invalidClock !== null) return failed(state, invalidClock);
    const current = sampled(state, action.clockMicroseconds);
    if (current.status === "error") return current;
    const time = current.visualTime;
    return freezeState({
      ...current,
      visualTime: time,
      poseTime: quantizedPoseTime(time, state.reducedMotion),
      anchorTime: time,
      anchorClockMicroseconds: action.clockMicroseconds,
      lastClockMicroseconds: action.clockMicroseconds,
      status: "playing",
      rate: action.rate,
      resumeRate: action.rate,
      error: null,
    });
  }

  if (action.type === "pause") {
    const invalidClock = stateClockError(state, action.clockMicroseconds);
    if (invalidClock !== null) return failed(state, invalidClock);
    const current = sampled(state, action.clockMicroseconds);
    if (current.status === "error") return current;
    return freezeState({
      ...current,
      anchorTime: current.visualTime,
      anchorClockMicroseconds: null,
      lastClockMicroseconds: action.clockMicroseconds,
      status: "paused",
      rate: "Paused",
      resumeRate: "Paused",
      error: null,
    });
  }

  if (action.type === "seek" || action.type === "rewind")
    return explicitAnchor(state, action.visualTime, action.clockMicroseconds);

  if (action.type === "hidden") {
    const invalidClock = stateClockError(state, action.clockMicroseconds);
    if (invalidClock !== null) return failed(state, invalidClock);
    const current = sampled(state, action.clockMicroseconds);
    if (current.status === "error") return current;
    return freezeState({
      ...current,
      anchorTime: current.visualTime,
      anchorClockMicroseconds: null,
      lastClockMicroseconds: action.clockMicroseconds,
      status: "hidden",
      rate: "Paused",
      resumeRate: state.status === "playing" ? state.rate : "Paused",
      error: null,
    });
  }

  const invalidClock = stateClockError(state, action.clockMicroseconds);
  if (invalidClock !== null) return failed(state, invalidClock);
  if (state.status !== "hidden") return state;
  if (typeof state.resumeRate !== "number")
    return freezeState({ ...state, status: "paused", error: null });
  return freezeState({
    ...state,
    anchorTime: state.visualTime,
    anchorClockMicroseconds: action.clockMicroseconds,
    lastClockMicroseconds: action.clockMicroseconds,
    status: "playing",
    rate: state.resumeRate,
    error: null,
  });
}
