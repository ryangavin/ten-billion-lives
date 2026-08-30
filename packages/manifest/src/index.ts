export const MANIFEST_PACKAGE = "manifest" as const;

export interface ManifestQueryContext {
  readonly seed: string;
  readonly tick: number;
  readonly region: string;
  readonly lod: string;
}

export { manifestPlaceholder } from "./placeholder";
export type {
  ManifestPlaceholderQuery,
  PlaceholderManifestation,
  TracerLod,
} from "./placeholder";
export { ManifestationIndex, createManifestationIndex } from "./person";
export type {
  CohortQuotas,
  PersonCard,
  PersonCohort,
  PlaceKind,
  PlaceQuota,
  Relationship,
  RelationshipKind,
} from "./person";
