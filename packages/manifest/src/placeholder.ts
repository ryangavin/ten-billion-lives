import type { LocalSnapshot } from "@ten-billion-lives/sim";

export type TracerLod = "planet" | "settlement" | "street" | "person";

export interface ManifestPlaceholderQuery {
  readonly seed: string;
  readonly checkpoint: LocalSnapshot;
  readonly region: "brindle-bay/harbor-street";
  readonly tick: number;
  readonly lod: TracerLod;
}

export interface PlaceholderManifestation {
  readonly personId: "person-5d19f85f";
  readonly name: "Ari Vale";
  readonly home: "Harbor Street 12";
  readonly role: "Garden keeper";
  readonly activity: "Walking to Lantern Square";
  readonly representedWeight: 128;
  readonly stateHash: LocalSnapshot["stateHash"];
  readonly eventHash: LocalSnapshot["eventHash"];
  readonly traceHash: "trace-b11350f7";
}

export function manifestPlaceholder(
  query: ManifestPlaceholderQuery,
): PlaceholderManifestation {
  if (
    query.seed !== query.checkpoint.seed ||
    query.tick !== query.checkpoint.tick
  ) {
    throw new Error("Manifest query does not match its checkpoint context");
  }

  return Object.freeze({
    personId: "person-5d19f85f",
    name: "Ari Vale",
    home: "Harbor Street 12",
    role: "Garden keeper",
    activity: "Walking to Lantern Square",
    representedWeight: 128,
    stateHash: query.checkpoint.stateHash,
    eventHash: query.checkpoint.eventHash,
    traceHash: "trace-b11350f7",
  });
}
