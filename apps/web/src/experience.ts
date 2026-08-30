import type { ManifestationIndex } from "@ten-billion-lives/manifest";
import {
  BASELINE_WORLD_SEED,
  createWorldKernel,
  type WorldKernel,
} from "@ten-billion-lives/sim";

export const EXPERIENCE_LINK_SCHEMA = 1 as const;
export const EXPERIENCE_MAX_TICK = 1_000_000;
export const FESTIVAL_PERSON_ID = "person_0000a4q_0yrj2dd";
export const CLOSURE_PERSON_ID = "person_1iy9k0p_1by3xrw";

export type ExperienceBranch = "baseline" | "closure";
export type ExperienceStage = "planet" | "settlement" | "street" | "person";

export interface ExperienceSelection {
  readonly schema: typeof EXPERIENCE_LINK_SCHEMA;
  readonly seed: typeof BASELINE_WORLD_SEED;
  readonly tick: number;
  readonly personId: string;
  readonly branch: ExperienceBranch;
  readonly stage: ExperienceStage;
  readonly locationId: string;
}

export type ExperienceLinkResult =
  | Readonly<{ ok: true; value: ExperienceSelection | null }>
  | Readonly<{ ok: false; message: string }>;

function linkError(message: string): ExperienceLinkResult {
  return Object.freeze({
    ok: false,
    message: `${message} Use “Return to baseline” to open the local observatory.`,
  });
}

export function parseExperienceLink(
  search: string,
  manifestation: ManifestationIndex,
): ExperienceLinkResult {
  const parameters = new URLSearchParams(search);
  const relevant = ["schema", "seed", "tick", "person", "branch"];
  if (relevant.every((name) => !parameters.has(name)))
    return Object.freeze({ ok: true, value: null });
  if (relevant.some((name) => !parameters.has(name)))
    return linkError("This person link is incomplete.");
  if (parameters.get("schema") !== String(EXPERIENCE_LINK_SCHEMA))
    return linkError("This person-link schema is incompatible.");
  if (parameters.get("seed") !== BASELINE_WORLD_SEED)
    return linkError(
      "This person-link seed does not match the baseline world.",
    );
  const tickText = parameters.get("tick") ?? "";
  if (!/^(0|[1-9]\d*)$/.test(tickText))
    return linkError("This person-link tick is invalid.");
  const tick = Number(tickText);
  if (!Number.isSafeInteger(tick) || tick > EXPERIENCE_MAX_TICK)
    return linkError(
      `This person-link tick exceeds the local limit of ${EXPERIENCE_MAX_TICK.toLocaleString("en-US")}.`,
    );
  const branch = parameters.get("branch");
  if (branch !== "baseline" && branch !== "closure")
    return linkError("This person-link branch is incompatible.");
  const personId = parameters.get("person") ?? "";
  let personCellId: string;
  try {
    personCellId = manifestation.person(personId).cellId;
  } catch {
    return linkError("This person ID is invalid for the baseline world.");
  }
  const stageParameter = parameters.get("stage");
  const locationParameter = parameters.get("location");
  if ((stageParameter === null) !== (locationParameter === null))
    return linkError("This person link has incomplete location context.");
  const stage = stageParameter ?? "person";
  if (
    stage !== "planet" &&
    stage !== "settlement" &&
    stage !== "street" &&
    stage !== "person"
  )
    return linkError("This person-link stage is incompatible.");
  const locationId = locationParameter ?? personCellId;
  if (
    locationId.length === 0 ||
    locationId.length > 128 ||
    !/^[A-Za-z0-9/_-]+$/.test(locationId)
  )
    return linkError("This person-link location is invalid.");
  if (stage === "person" && locationId !== personCellId)
    return linkError("This person-link location does not match the person.");
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      schema: EXPERIENCE_LINK_SCHEMA,
      seed: BASELINE_WORLD_SEED,
      tick,
      personId,
      branch,
      stage,
      locationId,
    }),
  });
}

export function buildExperienceLink(
  baseUrl: string,
  selection: ExperienceSelection,
): string {
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("schema", String(selection.schema));
  url.searchParams.set("seed", selection.seed);
  url.searchParams.set("tick", String(selection.tick));
  url.searchParams.set("person", selection.personId);
  url.searchParams.set("branch", selection.branch);
  url.searchParams.set("stage", selection.stage);
  url.searchParams.set("location", selection.locationId);
  return url.toString();
}

export function createExperienceKernel(branch: ExperienceBranch): WorldKernel {
  return branch === "baseline"
    ? createWorldKernel(BASELINE_WORLD_SEED, [])
    : createWorldKernel(BASELINE_WORLD_SEED);
}
