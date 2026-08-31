export const MANIFEST_PACKAGE = "manifest" as const;

export {
  cityProjectionHash,
  createCityProjection,
  validateCityProjection,
} from "./city";
export type {
  CityBuilding,
  CityCrossing,
  CityPlace,
  CityPlaceKind,
  CityProjection,
  CityProjectionQuery,
  CityPublicSpace,
  CityRoad,
  CitySidewalk,
  MapPoint,
  PedestrianEdge,
  PedestrianNode,
} from "./city";

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
export {
  AnalyticalItineraryIndex,
  createAnalyticalItineraryIndex,
} from "./itinerary";
export type {
  PersonActivity,
  PersonEncounter,
  PersonItineraryPoint,
  PersonQueryLod,
  PersonQueryOptions,
  PersonRoute,
  PersonSemanticLocation,
} from "./itinerary";
export {
  IllusionEngine,
  allocateManifestationWeights,
  createIllusionEngine,
} from "./projection";
export * from "./trajectory";
export type {
  IllusionProjection,
  ManifestationToken,
  ProjectionEvent,
  ProjectionEventKind,
  ProjectionLod,
  ProjectionQuery,
  ProjectionRealityBudget,
  ProjectionVisualContext,
  SemanticTransform,
} from "./projection";
