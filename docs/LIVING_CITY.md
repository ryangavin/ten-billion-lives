# Living-city contract

Issue #29 freezes the smallest testable M4 contract. It extends the validated local MVP without changing world authority, identity, replay, conservation, runtime scope, or the exact ten-billion total. The contract is a target and interface checkpoint; implementation evidence begins in issues #30–#36, and only gate #37 may call the living city complete.

## Falsifiable product target

The dominant local view is a coherent 2.5D Brindle Bay in which roads, sidewalks, crossings, buildings, public space, named destinations, and recognizable people compose one legible place. At street scale, a figure reads as a person through a head/body/leg silhouette, heading, stride, depth, variation, and selection treatment. A user can zoom from city to neighborhood to street, pick and follow one stable identity, and see ordinary travel, a meeting, Lantern Tide, and the closure comparison while the exact field/reality explanation remains available but subordinate.

The target fails if any of these observable statements is false:

- the map does not dominate the initial Brindle Bay composition or lacks connected pedestrian topology;
- figures read only as pixels, dots, or anonymous particles at street scale;
- equal seed, snapshot, branch, tick, phase, person, and city inputs yield unequal semantic or trajectory values;
- direct seek, playback, pause/resume, rewind, camera motion, frame cadence, backend, or quality changes a semantic result;
- a displayed population weight cannot reconcile to the exact queried population, or a selected person has weight other than one;
- the complete journey is unavailable through Canvas or a structured keyboard-readable text alternative.

## Storyboard and visual direction

The retained [target wireframe](evidence/issue-29/living-city-wireframe.svg) is a composition contract, not a final art claim. Its inspected desktop frame reserves most of the viewport for the tilted city and keeps controls and audit details at the edge.

1. **City arrival:** descend from the planet into a waterfront overview. Brindle Bay, Harbor Street, Lantern Quay, Market Hall, school, gardens, roads, sidewalks, crossings, and walking flows are visible together.
2. **Neighborhood:** zoom without replacing the semantic context. Buildings gain readable entrances and destinations; crowd refinement is nested and the exact population explanation remains reachable.
3. **Street and person:** literal figures become individually readable. Picking pins one stable identity at weight one and opens a compact person card; follow mode keeps that person framed without changing their route.
4. **Commute and meeting:** continuous playback crosses an hourly boundary. The selected route, shared destination, and meeting participants remain visually and textually legible.
5. **Lantern Tide:** named arrival, peak, and departure moments expose convergence on the waterfront without implying an observer-created event.
6. **Closure comparison:** baseline and closure use the same camera and explicit time where useful, but their route and detour semantics stay separately labeled and hashable.
7. **Second observer and rewind:** an independently initialized observer at the same seed/snapshot/branch/tick/phase matches city, person, itinerary, event, manifestation, and trajectory values while retaining an independent camera. Rewind and direct seek recover the same result.
8. **Field reveal:** the city recedes visually but remains present while the exact ten-billion fields, weighted figures, zero person-row count, and authority/derivation/rendering boundary are explained.

The visual direction is an orthographic 2.5D map tilted enough to show building mass and people while keeping topology readable. It is preferred because a stable projection supports dense literal figures, predictable picking, semantic zoom, Canvas parity, and visual comparison at bounded cost. A remote map or remote tiles would add external data and request boundaries while misrepresenting fictional geography. A photorealistic city would spend the milestone on assets, lighting, and uncanny detail rather than legibility. A first-person engine would hide system-scale flows, weaken topology comparison, and increase navigation and accessibility cost.

At narrow widths the city remains the top, dominant region and the inspector becomes a dismissible bottom sheet; time controls wrap without covering the selected route. Selection callouts shorten to name plus state, with full facts in the sheet. Issue #35 owns that responsive behavior and must prove it in a real touch-capable browser rather than treating the desktop wireframe as narrow-layout evidence.

## Frozen semantic interfaces

All structures are deeply readonly plain values. Arrays are canonically ordered by stable ID unless a field states route order. All coordinates and semantic phases are integers. Version 1 uses centimeters in a local east/north/up frame; renderer floats may be derived after hashes are computed.

```ts
interface CityProjectionQuery {
  readonly schema: 1;
  readonly seed: string;
  readonly settlementId: "place/brindle-bay";
}

interface MapPoint {
  readonly eastCm: number;
  readonly northCm: number;
  readonly upCm: number;
}

interface CityProjection {
  readonly schema: 1;
  readonly seed: string;
  readonly settlementId: "place/brindle-bay";
  readonly bounds: Readonly<{ min: MapPoint; max: MapPoint }>;
  readonly roads: readonly CityRoad[];
  readonly sidewalks: readonly CitySidewalk[];
  readonly crossings: readonly CityCrossing[];
  readonly buildings: readonly CityBuilding[];
  readonly publicSpaces: readonly CityPublicSpace[];
  readonly places: readonly CityPlace[];
  readonly pedestrianNodes: readonly PedestrianNode[];
  readonly pedestrianEdges: readonly PedestrianEdge[];
  readonly cityHash: string;
}

interface VisualTime {
  readonly tick: bigint;
  readonly phasePermillion: number;
}

interface PedestrianTrajectoryQuery {
  readonly schema: 1;
  readonly branch: "baseline" | "closure";
  readonly stateHash: string;
  readonly eventHash: string;
  readonly personId: string;
  readonly itinerary: readonly PersonItineraryPoint[];
  readonly city: CityProjection;
  readonly time: VisualTime;
}

interface PedestrianPose {
  readonly personId: string;
  readonly time: VisualTime;
  readonly mode: "dwelling" | "walking";
  readonly position: MapPoint;
  readonly headingMilliTurns: number;
  readonly stridePermillion: number;
  readonly routeId: string | null;
  readonly edgeId: string | null;
  readonly destinationPlaceId: string;
  readonly trajectoryHash: string;
}
```

`CityRoad`, `CitySidewalk`, `CityCrossing`, `CityBuilding`, and `CityPublicSpace` each have a stable ID, integer geometry, and their relevant adjacent IDs. `CityPlace` maps the existing canonical semantic destination ID to one entrance pedestrian node. Every place entrance reaches every other place entrance through the pedestrian graph unless the explicit closure branch removes an edge. Buildings never invent destinations. Generation rejects duplicate IDs, unsafe coordinates, invalid polygons, dangling references, disconnected baseline topology, noncanonical ordering, or a hash mismatch.

`CityProjection` is a seeded static semantic projection, not authoritative geography. Its `cityHash` covers the version, seed, settlement ID, coordinate units, ordered geometry, place mapping, and pedestrian graph. It excludes camera, viewport, quality, colors, frame timing, selection, and backend.

`VisualTime.tick` is a nonnegative authoritative hourly tick already supported by the world/checkpoint context. `phasePermillion` is a safe integer in `[0, 999999]`; one million is represented canonically as the next tick at phase zero. External noncanonical, negative, fractional, incompatible, or out-of-range values are rejected instead of clamped. `PedestrianPose` is a pure query result. Its `trajectoryHash` covers schema, branch, state/event hashes, person, canonical itinerary/route, `cityHash`, tick, phase, position, heading, stride, and destination. It excludes camera, clock, frame count, query order, renderer, and pixels.

At an itinerary boundary, the final route point approached at tick `t`, phase `999999` and the exact point at tick `t + 1`, phase `0` differ by at most the single fixed-point interpolation remainder defined by #31. Dwelling uses the destination entrance with a stable zero stride. Missing places, unreachable routes, invalid itineraries, and branch/topology mismatches fail closed with an actionable typed error; no straight-line or random fallback may silently change semantics.

Issue #33 reconciles one integration detail exposed by the existing itinerary index: a transit point may name a regional route destination while the following stationary point names the more specific household, workplace, school, or service arrival. The app constructs a deterministic per-trajectory routing view that preserves both original semantic IDs and maps them to the same frozen pedestrian entrance. Trajectory-anchor compatibility may use that shared entrance identity, while itinerary and trajectory hashes still cover the distinct original IDs. A crowd-wide alias is forbidden because the same regional destination can lead different people to different local arrivals.

## Presentation-time and playback rules

The kernel remains 24 authoritative hourly ticks for the repeating day. Presentation time is an explicit `(tick, phasePermillion)` query input and never a new kernel tick, command, snapshot field, event, or state transition. The app owns a pure playback reducer whose only clock input is an injected nonnegative monotonic integer microsecond sample.

The frozen rates are labeled exactly as **Paused**, **1 simulated minute per real second**, **5 simulated minutes per real second**, **15 simulated minutes per real second**, and **60 simulated minutes per real second**. A rate is presentation policy, never “1×” world authority. From an explicit anchor, the reducer computes `floor(elapsedMicroseconds * simulatedMinutesPerSecond / 60)` phase parts, adds them to the anchor, and carries complete one-million parts into later hourly ticks. It always computes from the anchor rather than accumulating frame deltas, so frame cadence cannot change the result.

- **Play/resume:** store the explicit visual-time and injected-clock anchors plus the selected rate. Equal anchors and clock samples yield equal output.
- **Pause:** sample once, canonicalize the resulting time, and discard clock progression until play is explicitly resumed.
- **Seek:** replace both anchors with an explicit supported tick/phase; named moments are immutable aliases for explicit values.
- **Rewind/replay:** restore an authoritative checkpoint/tick first, then set an explicit phase. Replaying or directly seeking to that pair must yield the same pose and hash.
- **Hidden tab:** on the injected hide event, sample and freeze. On the injected visible event, re-anchor at the frozen time and restore the prior play rate without counting hidden duration. There is no catch-up jump.
- **Clock failure:** a decreasing, fractional, missing, or unsafe sample fails visibly and pauses; ambient `Date`, `performance.now`, animation frames, and visibility state may be adapted only at the app edge and never read by semantic queries.
- **Reduced motion:** initial state is paused. Play remains available, but camera easing and stride cycling are suppressed and position changes are presented at explicit 15-simulated-minute steps with the same textual time and route facts. Pause, seek, rewind, named moments, and complete semantic understanding remain available.

Tests in #31 must cover phase zero and `999999`, at least one hourly carry, playback/direct-seek equality, pause/resume, rewind, every rate, hidden/resume, reduced motion, injected-clock reproducibility, two independently created reducers, camera/frame-cadence independence, and all invalid/range cases above.

## Renderer, picking, and accessibility boundaries

The web app composes one immutable semantic scene. The renderer may cache or upload derived buffers, but it cannot alter or originate any field, identity, destination, route, event, weight, or hash.

```ts
interface LivingCityScene {
  readonly schema: 1;
  readonly context: Readonly<{
    seed: string;
    branch: "baseline" | "closure";
    stateHash: string;
    eventHash: string;
    manifestationHash: string;
    time: VisualTime;
  }>;
  readonly city: CityProjection;
  readonly figures: readonly Readonly<{
    personId: string;
    representedWeight: bigint;
    pinned: boolean;
    pose: PedestrianPose;
    appearanceKey: number;
  }>[];
  readonly selectedPersonId: string | null;
  readonly representedPeople: bigint;
  readonly unsampledRemainder: bigint;
  readonly semanticKey: string;
}

interface LivingCityRenderInput {
  readonly scene: LivingCityScene;
  readonly presentation: Readonly<{
    camera: CameraProjection;
    viewport: Readonly<{ width: number; height: number }>;
    quality: "fallback" | "baseline" | "showcase";
    reducedMotion: boolean;
  }>;
}

interface PickResult {
  readonly semanticKey: string;
  readonly renderKey: number;
  readonly personId: string;
  readonly representedWeight: bigint;
}

interface LivingCitySummary {
  readonly semanticKey: string;
  readonly timeLabel: string;
  readonly placeSummaries: readonly string[];
  readonly movementSummary: string;
  readonly eventSummary: string;
  readonly selectionSummary: string | null;
  readonly populationSummary: string;
  readonly observerComparison: string | null;
}
```

`LivingCityScene.semanticKey` is derived from the canonical semantic hashes and explicit `VisualTime`, never camera or frame data. The renderer allocates a stable per-scene pick table from canonical figure order. A pointer or keyboard pick returns `PickResult`; the app may update selection/follow UI, but picking cannot issue a world command. Stale render keys whose semantic key no longer matches fail closed. A selected/pinned identity is present with weight one before render input is constructed.

The Canvas path owns the complete semantic scene, literal silhouette, selection treatment, picking, resize behavior, and textual alternative. WebGPU may raise density or effects but cannot be required for any journey step. `LivingCitySummary` is derived directly from the same scene rather than canvas pixels or accessibility-tree geometry. It supplies named places, current explicit time, movement/event facts, selection/follow facts, weighted-population explanation, branch status, and observer comparison in DOM reading order. Keyboard focus, touch targets, forced colors, 200% text, and reduced-motion controls are app responsibilities tested in #35/#36.

## Weighted crowd honesty

Every visible figure carries a positive integer `representedWeight`. For each explicit semantic scope and quality tier:

```text
sum(figure representedWeight) + unsampledRemainder = representedPeople
```

Samples are nested by a camera-independent stable priority. Moving from city to neighborhood to street may reveal more identities, but an identity retained across levels keeps the same person facts, trajectory, and appearance key. Quality adaptation may choose a smaller prefix of that same sample and update the explicit remainder; it cannot change population, events, routes, selected identity, or observer equality. A selected or followed identity is pinned, appears exactly once, and has weight one; its previous aggregate weight is deterministically redistributed so conservation remains exact.

Named semantic levels and quality capabilities are frozen, but figure counts are not. Issue #32 must measure recognizable literal-person density before committing numeric budgets. The old 25,000/250,000/one-million token tiers are baseline comparison inputs, not automatic living-city targets.

## Package and path ownership

No new workspace or external runtime dependency is authorized. Production flow remains `packages/sim` → `packages/manifest` → `apps/web`, with `packages/render` also consumed by `apps/web`; the app structurally adapts immutable manifest values into renderer input so `packages/render` does not need to import simulation or application code.

| Issue | Sole implementation ownership in its isolated lane                                                                                                                     | Explicitly shared or forbidden paths                                                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| #30   | `packages/manifest/src/city.ts`, colocated test, `packages/manifest/fixtures/city-golden-v1.json`, `scripts/city-vector.mjs`                                           | May add only its city exports to `packages/manifest/src/index.ts`; must not edit trajectory, renderer, app, or this contract            |
| #31   | `packages/manifest/src/trajectory.ts`, colocated test and fixture, `apps/web/src/playback.ts` plus test, `scripts/trajectory-vector.mjs`                               | May add only its trajectory exports to `packages/manifest/src/index.ts`; must not edit city, renderer, app experience, or this contract |
| #32   | `packages/render/src/living-city.ts` plus test, bounded spike under `apps/web/src/living-city-spike.ts`, one dedicated browser case, renderer benchmark script/results | Must not edit city/trajectory semantics, playback, authoritative packages, or this contract                                             |
| #33   | Integration files in `apps/web`, shared package export reconciliation, observer harness, integration browser cases, and merged documentation                           | Sole owner of conflict resolution and any necessary frozen-contract amendment, which requires explicit issue evidence                   |

Parallel work uses separate branches and worktrees: `issue-30-city` at `/private/tmp/ten-billion-lives-m4-30`, `issue-31-trajectories` at `/private/tmp/ten-billion-lives-m4-31`, and `issue-32-renderer-spike` at `/private/tmp/ten-billion-lives-m4-32`. Root `main` remains the integration authority. Each lane starts from the pushed #29 commit, reads #29 and its own issue, keeps its worktree clean between commits, and never closes its issue. Root integrates #30, #31, then #32, runs focused/affected checks after each, and closes each only from integrated `main`. If those worktrees or merge boundaries are unavailable, execution is sequential.

The two one-line `packages/manifest/src/index.ts` export additions are intentionally disjoint but share a file; root owns their merge. No lane changes package manifests or the lockfile. Any new overlapping implementation path is reported to root and serialized before editing.

## Evidence and benchmark contract

Later issues retain semantic assertions and fixed-time pixels together. The canonical baseline context is the committed world seed, Brindle Bay, explicit baseline/closure branch, and explicit tick/phase; every artifact records commit, schema, seed, snapshot or state hash, branch, tick, phase, city hash, manifestation hash, event hash, trajectory hash where applicable, renderer/backend/quality, viewport, browser, and profile.

The visual evidence set is:

- city overview, neighborhood, street-scale literal walkers, selected/followed person, commute, meeting, Lantern Tide arrival/peak/departure, closure comparison, second observer, and field reveal;
- desktop and narrow/touch composition, Canvas, WebGPU when actually available, reduced motion, forced colors, 200% text, focus order, context loss, resize, background/resume, and error recovery;
- an uninterrupted signature recording plus fixed frames immediately before and at an hourly boundary, direct-seek/playback equality, follow, festival peak, closure, observer comparison, and final field reveal;
- original-resolution human-style inspection notes with every visible defect and disposition, SHA-256 hashes, semantic transcript, console/request log, skip/retry/flake log, and exact reproduction command.

Issue #32 runs the bounded city-block spike on the same `apple-m1-max-32gb-chromium` profile used by the pre-M4 baseline. It measures recognizable literal figures at multiple counts, frame p50/p95, heap and retained growth, CPU preparation, buffer upload, draw count/cost, pick p50/p95, resize, zoom transition, Canvas, WebGPU when available, and context lifecycle. Each density point uses the same fixture, viewport, browser mode, sample/warmup rule, and semantic hashes. It records the old point-renderer baseline for comparison but freezes new numeric living-city budgets only after inspecting readability and measured curves.

Gates #33, #36, and #37 rerun their specified outer loops from fresh remote clones. #33 owns integrated provisional budgets without the soak; #36 freezes release-candidate budgets and runs the real 30-minute soak; #37 independently repeats the complete matrix. A missing artifact, unequal canonical pair, over-budget value, uninspected capture, unexplained skip/retry/flake, external request, console error, or contradictory transcript is a failure, not a pass.

## Risk register and fallbacks

Every risky assumption has a test owner, measured-budget owner, simplest fallback, and integration gate.

| Risky assumption                                                              | Test/falsifier owner                            | Measured-budget owner                 | Simplest local fallback                                                             | Integration gate |
| ----------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------- | ---------------- |
| Seeded geometry is coherent, bounded, canonical, and pedestrian-connected     | #30 golden/property tests                       | #32 geometry preparation measurements | fewer blocks and simpler orthogonal roads while retaining all semantic destinations | #33              |
| Integer city coordinates remain precise and renderer-friendly                 | #30 range/hash tests                            | #32 upload and transform measurements | smaller fixed extent with centimeter integers                                       | #33              |
| Existing places map to visible entrances without inventing semantics          | #30 mapping/connectivity tests                  | #32 scene preparation measurement     | fewer building forms, never fewer canonical destinations                            | #33              |
| Pure trajectories are continuous across hourly boundaries                     | #31 boundary/property tests                     | #32 pose preparation measurement      | fewer route segments and fixed linear edge interpolation                            | #33              |
| Injected-clock playback equals direct seek and ignores frame cadence          | #31 reducer tests                               | #36 long-session timing               | explicit stepped phases using the same reducer                                      | #33 and #36      |
| Literal figures remain recognizable at useful density                         | #32 fixed-time semantic plus inspected captures | #32 density curves                    | fewer figures with stronger silhouettes and honest larger weights                   | #33              |
| Picking is fast, stable, and does not author semantics                        | #32 pick/stale-key tests                        | #32 pick p50/p95                      | CPU spatial buckets over the same canonical pick table                              | #33              |
| Canvas can deliver every required scene and interaction                       | #32/#35 browser tests                           | #32 and #36 Canvas budgets            | reduce effects/density while retaining silhouettes, selection, and summaries        | #33 and #36      |
| Weighted nested refinement conserves exact population and selected weight one | #33 conservation/observer tests                 | #36 quality-transition budgets        | fewer named levels with an explicit unsampled remainder                             | #33 and #36      |
| Commute, meeting, Lantern Tide, and closure are visually legible              | #34 semantic browser journeys                   | #36 signature-journey timing          | stronger labels/path overlays without changing semantics                            | #36              |
| Full-screen controls remain usable for keyboard, touch, and reduced motion    | #35 accessibility/browser tests                 | #36 interaction/startup budgets       | text-first controls and stepped motion                                              | #36              |
| Integrated visuals fit frame, memory, resize, transition, and soak budgets    | #36 complete hardening matrix                   | #36 release-candidate profile         | adaptive quality lowers density/effects only                                        | #36 and #37      |

## Non-claims and rejected directions

This contract does not claim the living city is implemented, visually final, photorealistic, geographically real, a traffic or social model, one visible figure per represented person, or pixel-identical across browsers/GPUs. It adds no authoritative continuous agents or minute state, no 1,440 authoritative ticks, no ten-billion-person table, and no renderer-authored identity, route, event, or command.

It rejects remote maps, remote tiles, external runtime data/assets, servers, networking, remote observer synchronization, CI, Pages, containers, deployment, cloud services, runtime LLMs, paid APIs, photorealistic asset pipelines, first-person engines, and GPU authority. The second observer remains an independent local app instance. Canvas remains the guaranteed complete renderer. Issue #28 and anything labeled `phase:deferred` remain untouched.
