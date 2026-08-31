export interface MapPoint {
  readonly eastCm: number;
  readonly northCm: number;
  readonly upCm: number;
}

export interface VisualTime {
  readonly tick: bigint;
  readonly phasePermillion: number;
}

export interface CityRoad {
  readonly id: string;
  readonly centerline: readonly MapPoint[];
  readonly widthCm: number;
}

export interface CityPathFeature {
  readonly id: string;
  readonly path: readonly MapPoint[];
  readonly widthCm: number;
}

export interface CityAreaFeature {
  readonly id: string;
  readonly boundary: readonly MapPoint[];
}

export interface CityBuilding {
  readonly id: string;
  readonly footprint: readonly MapPoint[];
  readonly heightCm: number;
}

export interface CityProjection {
  readonly schema: 1;
  readonly seed: string;
  readonly settlementId: "place/brindle-bay";
  readonly bounds: Readonly<{ min: MapPoint; max: MapPoint }>;
  readonly roads: readonly CityRoad[];
  readonly sidewalks: readonly CityPathFeature[];
  readonly crossings: readonly CityPathFeature[];
  readonly buildings: readonly CityBuilding[];
  readonly publicSpaces: readonly CityAreaFeature[];
  readonly places: readonly unknown[];
  readonly pedestrianNodes: readonly unknown[];
  readonly pedestrianEdges: readonly unknown[];
  readonly cityHash: string;
}

export interface PedestrianPose {
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

export interface LivingCityFigure {
  readonly personId: string;
  readonly representedWeight: bigint;
  readonly pinned: boolean;
  readonly pose: PedestrianPose;
  readonly appearanceKey: number;
}

export interface LivingCityScene {
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
  readonly figures: readonly LivingCityFigure[];
  readonly selectedPersonId: string | null;
  readonly representedPeople: bigint;
  readonly unsampledRemainder: bigint;
  readonly semanticKey: string;
}

export interface CameraProjection {
  readonly centerEastCm: number;
  readonly centerNorthCm: number;
  readonly pixelsPerMeter: number;
}

export interface LivingCityRenderInput {
  readonly scene: LivingCityScene;
  readonly presentation: Readonly<{
    camera: CameraProjection;
    viewport: Readonly<{ width: number; height: number }>;
    quality: "fallback" | "baseline" | "showcase";
    reducedMotion: boolean;
  }>;
}

export interface PickResult {
  readonly semanticKey: string;
  readonly renderKey: number;
  readonly personId: string;
  readonly representedWeight: bigint;
}

export interface LivingCitySummary {
  readonly semanticKey: string;
  readonly timeLabel: string;
  readonly placeSummaries: readonly string[];
  readonly movementSummary: string;
  readonly eventSummary: string;
  readonly selectionSummary: string | null;
  readonly populationSummary: string;
  readonly observerComparison: string | null;
}

export type LivingCityBackend = "webgpu" | "canvas2d";

export interface LivingCityCapabilityProbe {
  readonly gpuPresent: boolean;
  readonly adapterAvailable: boolean;
  readonly contextAvailable: boolean;
}

export interface LivingCityLifecycleSnapshot {
  readonly backend: LivingCityBackend;
  readonly semanticKey: string;
  readonly selectedPersonId: string | null;
  readonly generation: number;
  readonly contextLosses: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface PreparedPolygon {
  readonly id: string;
  readonly points: readonly ScreenPoint[];
}

export interface PreparedRoad {
  readonly id: string;
  readonly centerline: readonly ScreenPoint[];
  readonly widthPx: number;
}

export interface PreparedBuilding {
  readonly id: string;
  readonly footprint: readonly ScreenPoint[];
  readonly roof: readonly ScreenPoint[];
  readonly depth: number;
}

export type FigurePartKind =
  "left-leg" | "right-leg" | "body" | "head" | "selection-ring";

export interface PreparedFigurePart {
  readonly kind: FigurePartKind;
  readonly points: readonly ScreenPoint[];
  readonly radius: number;
  readonly width: number;
  readonly color: string;
}

export interface PreparedLivingCityFigure {
  readonly personId: string;
  readonly representedWeight: bigint;
  readonly renderKey: number;
  readonly selected: boolean;
  readonly depth: number;
  readonly screen: ScreenPoint;
  readonly hitRadius: number;
  readonly parts: readonly PreparedFigurePart[];
}

export interface PreparedLivingCityFrame {
  readonly semanticKey: string;
  readonly selectedPersonId: string | null;
  readonly fixedTime: VisualTime;
  readonly viewport: Readonly<{ width: number; height: number }>;
  readonly treatment: "day" | "evening";
  readonly roads: readonly PreparedRoad[];
  readonly sidewalks: readonly PreparedRoad[];
  readonly crossings: readonly PreparedRoad[];
  readonly publicSpaces: readonly PreparedPolygon[];
  readonly buildings: readonly PreparedBuilding[];
  readonly figures: readonly PreparedLivingCityFigure[];
  readonly pickTable: readonly PickResult[];
}

export interface LivingCityRenderMetrics {
  readonly backend: LivingCityBackend;
  readonly semanticKey: string;
  readonly selectedPersonId: string | null;
  readonly figureCount: number;
  readonly frameMs: number;
  readonly cpuPrepareMs: number;
  readonly uploadMs: number;
  readonly drawMs: number;
  readonly drawCount: number;
  readonly bufferBytes: number;
  readonly lifecycle: LivingCityLifecycleSnapshot;
}

const silhouetteColors = [
  "#e26d5a",
  "#5a9fd4",
  "#e1a44a",
  "#7dbe74",
  "#bb78c4",
  "#5bb8aa",
] as const;

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value))
    throw new RangeError(`${label} must be a safe integer`);
}

function assertDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 16_384)
    throw new RangeError(`${label} must be a positive safe pixel dimension`);
}

function assertPoint(point: MapPoint, label: string): void {
  assertSafeInteger(point.eastCm, `${label}.eastCm`);
  assertSafeInteger(point.northCm, `${label}.northCm`);
  assertSafeInteger(point.upCm, `${label}.upCm`);
}

function assertTime(time: VisualTime, label: string): void {
  if (time.tick < 0n) throw new RangeError(`${label}.tick must be nonnegative`);
  if (
    !Number.isSafeInteger(time.phasePermillion) ||
    time.phasePermillion < 0 ||
    time.phasePermillion > 999_999
  )
    throw new RangeError(
      `${label}.phasePermillion must be an integer from 0 through 999999`,
    );
}

function sameTime(left: VisualTime, right: VisualTime): boolean {
  return (
    left.tick === right.tick && left.phasePermillion === right.phasePermillion
  );
}

function validateScene(scene: LivingCityScene): void {
  if (scene.schema !== 1 || scene.city.schema !== 1)
    throw new RangeError("living-city scene and city schemas must be 1");
  if (
    scene.semanticKey.length === 0 ||
    scene.context.seed.length === 0 ||
    scene.context.stateHash.length === 0 ||
    scene.context.eventHash.length === 0 ||
    scene.context.manifestationHash.length === 0 ||
    scene.city.cityHash.length === 0
  )
    throw new RangeError(
      "living-city semantic keys and hashes must not be empty",
    );
  assertTime(scene.context.time, "scene.context.time");
  assertPoint(scene.city.bounds.min, "city.bounds.min");
  assertPoint(scene.city.bounds.max, "city.bounds.max");
  if (scene.unsampledRemainder < 0n || scene.representedPeople < 0n)
    throw new RangeError("represented population values must be nonnegative");
  const sortedIds = scene.figures
    .map((figure) => figure.personId)
    .sort((left, right) => left.localeCompare(right));
  const actualIds = scene.figures.map((figure) => figure.personId);
  if (new Set(actualIds).size !== actualIds.length)
    throw new RangeError("living-city figure person IDs must be unique");
  if (sortedIds.some((id, index) => id !== actualIds[index]))
    throw new RangeError(
      "living-city figures must use canonical person ID order",
    );
  let sampledPeople = 0n;
  let selectedCount = 0;
  for (const figure of scene.figures) {
    if (
      figure.personId.length === 0 ||
      figure.pose.personId !== figure.personId
    )
      throw new RangeError("figure and pose person IDs must match");
    if (figure.representedWeight <= 0n)
      throw new RangeError("figure representedWeight must be positive");
    if (!sameTime(figure.pose.time, scene.context.time))
      throw new RangeError("every figure pose must use the scene fixed time");
    assertPoint(figure.pose.position, `figure ${figure.personId} position`);
    assertSafeInteger(
      figure.pose.headingMilliTurns,
      `figure ${figure.personId} headingMilliTurns`,
    );
    if (
      figure.pose.headingMilliTurns < 0 ||
      figure.pose.headingMilliTurns >= 1_000_000
    )
      throw new RangeError("headingMilliTurns must be in [0, 1000000)");
    assertSafeInteger(
      figure.pose.stridePermillion,
      `figure ${figure.personId} stridePermillion`,
    );
    if (
      figure.pose.stridePermillion < 0 ||
      figure.pose.stridePermillion > 999_999
    )
      throw new RangeError("stridePermillion must be in [0, 999999]");
    if (figure.personId === scene.selectedPersonId) {
      selectedCount += 1;
      if (!figure.pinned || figure.representedWeight !== 1n)
        throw new RangeError("selected figure must be pinned at weight one");
    }
    sampledPeople += figure.representedWeight;
  }
  if (sampledPeople + scene.unsampledRemainder !== scene.representedPeople)
    throw new RangeError(
      "figure weights plus unsampled remainder must reconcile to represented people",
    );
  if (scene.selectedPersonId !== null && selectedCount !== 1)
    throw new RangeError("selected person must occur exactly once");
}

function validatePresentation(input: LivingCityRenderInput): void {
  const { viewport, camera } = input.presentation;
  assertDimension(viewport.width, "viewport width");
  assertDimension(viewport.height, "viewport height");
  assertSafeInteger(camera.centerEastCm, "camera.centerEastCm");
  assertSafeInteger(camera.centerNorthCm, "camera.centerNorthCm");
  if (
    !Number.isFinite(camera.pixelsPerMeter) ||
    camera.pixelsPerMeter <= 0 ||
    camera.pixelsPerMeter > 100
  )
    throw new RangeError("camera.pixelsPerMeter must be in (0, 100]");
}

function projectPoint(
  point: MapPoint,
  camera: CameraProjection,
  viewport: Readonly<{ width: number; height: number }>,
): ScreenPoint {
  const eastMeters = (point.eastCm - camera.centerEastCm) / 100;
  const northMeters = (point.northCm - camera.centerNorthCm) / 100;
  const upMeters = point.upCm / 100;
  const diagonal = camera.pixelsPerMeter * Math.SQRT1_2;
  return Object.freeze({
    x: viewport.width * 0.5 + (eastMeters - northMeters) * diagonal,
    y:
      viewport.height * 0.47 +
      (eastMeters + northMeters) * diagonal * 0.48 -
      upMeters * camera.pixelsPerMeter,
  });
}

function projectPolygon(
  points: readonly MapPoint[],
  camera: CameraProjection,
  viewport: Readonly<{ width: number; height: number }>,
): readonly ScreenPoint[] {
  return Object.freeze(
    points.map((point) => projectPoint(point, camera, viewport)),
  );
}

function part(
  kind: FigurePartKind,
  points: readonly ScreenPoint[],
  radius: number,
  width: number,
  color: string,
): PreparedFigurePart {
  return Object.freeze({
    kind,
    points: Object.freeze(points),
    radius,
    width,
    color,
  });
}

function prepareFigure(
  figure: LivingCityFigure,
  renderKey: number,
  selectedPersonId: string | null,
  camera: CameraProjection,
  viewport: Readonly<{ width: number; height: number }>,
  reducedMotion: boolean,
): PreparedLivingCityFigure {
  const screen = projectPoint(figure.pose.position, camera, viewport);
  const depth = Math.max(0, Math.min(1, screen.y / viewport.height));
  const scale = 0.78 + depth * 0.58;
  const bodyHeight = 12 * scale;
  const bodyWidth = 5.2 * scale;
  const headRadius = 2.5 * scale;
  const headingRadians =
    (figure.pose.headingMilliTurns / 1_000_000) * Math.PI * 2;
  const headingX = Math.sin(headingRadians) * 1.6 * scale;
  const stridePhase = reducedMotion
    ? 0
    : Math.sin((figure.pose.stridePermillion / 1_000_000) * Math.PI * 2);
  const strideX = stridePhase * 3.2 * scale;
  const hipY = screen.y - bodyHeight * 0.48;
  const shoulderY = screen.y - bodyHeight * 1.02;
  const torsoColor =
    silhouetteColors[
      Math.abs(figure.appearanceKey) % silhouetteColors.length
    ] ?? silhouetteColors[0];
  const skinColor =
    Math.abs(figure.appearanceKey) % 3 === 0 ? "#6e4937" : "#d6a277";
  const selected = figure.personId === selectedPersonId;
  const parts = [
    part(
      "left-leg",
      [
        { x: screen.x - bodyWidth * 0.22, y: hipY },
        { x: screen.x - strideX + headingX, y: screen.y },
      ],
      0,
      2.2 * scale,
      "#27313c",
    ),
    part(
      "right-leg",
      [
        { x: screen.x + bodyWidth * 0.22, y: hipY },
        { x: screen.x + strideX + headingX, y: screen.y },
      ],
      0,
      2.2 * scale,
      "#27313c",
    ),
    part(
      "body",
      [
        { x: screen.x - bodyWidth * 0.52, y: shoulderY },
        { x: screen.x + bodyWidth * 0.52, y: shoulderY },
        { x: screen.x + bodyWidth * 0.42 + headingX, y: hipY },
        { x: screen.x - bodyWidth * 0.42 + headingX, y: hipY },
      ],
      0,
      0,
      torsoColor,
    ),
    part(
      "head",
      [
        {
          x: screen.x + headingX * 0.48,
          y: shoulderY - headRadius * 1.35,
        },
      ],
      headRadius,
      0,
      skinColor,
    ),
    ...(selected
      ? [
          part(
            "selection-ring",
            [{ x: screen.x, y: screen.y - 1 }],
            8.5 * scale,
            2.4,
            "#ffe66d",
          ),
        ]
      : []),
  ];
  return Object.freeze({
    personId: figure.personId,
    representedWeight: figure.representedWeight,
    renderKey,
    selected,
    depth,
    screen,
    hitRadius: 9 * scale,
    parts: Object.freeze(parts),
  });
}

export function prepareLivingCityFrame(
  input: LivingCityRenderInput,
): PreparedLivingCityFrame {
  validateScene(input.scene);
  validatePresentation(input);
  const { scene, presentation } = input;
  const { camera, viewport } = presentation;
  const roads = scene.city.roads.map((road) => {
    if (road.centerline.length < 2 || road.widthCm <= 0)
      throw new RangeError(`road ${road.id} requires a width and centerline`);
    return Object.freeze({
      id: road.id,
      centerline: projectPolygon(road.centerline, camera, viewport),
      widthPx: (road.widthCm / 100) * camera.pixelsPerMeter,
    });
  });
  const pathFeatures = (features: readonly CityPathFeature[]) =>
    features.map((feature) => {
      if (feature.path.length < 2 || feature.widthCm <= 0)
        throw new RangeError(`${feature.id} requires a width and path`);
      return Object.freeze({
        id: feature.id,
        centerline: projectPolygon(feature.path, camera, viewport),
        widthPx: (feature.widthCm / 100) * camera.pixelsPerMeter,
      });
    });
  const areaFeatures = (features: readonly CityAreaFeature[]) =>
    features.map((feature) => {
      if (feature.boundary.length < 3)
        throw new RangeError(`${feature.id} requires at least three points`);
      return Object.freeze({
        id: feature.id,
        points: projectPolygon(feature.boundary, camera, viewport),
      });
    });
  const buildings = scene.city.buildings
    .map((building) => {
      if (building.footprint.length < 3 || building.heightCm <= 0)
        throw new RangeError(
          `building ${building.id} requires a footprint and height`,
        );
      const roofPoints = building.footprint.map((point) => ({
        ...point,
        upCm: point.upCm + building.heightCm,
      }));
      const footprint = projectPolygon(building.footprint, camera, viewport);
      const roof = projectPolygon(roofPoints, camera, viewport);
      const depth =
        footprint.reduce((total, point) => total + point.y, 0) /
        footprint.length;
      return Object.freeze({
        id: building.id,
        footprint,
        roof,
        depth,
      });
    })
    .sort((left, right) => left.depth - right.depth);
  const pickTable = scene.figures.map((figure, index) =>
    Object.freeze({
      semanticKey: scene.semanticKey,
      renderKey: index + 1,
      personId: figure.personId,
      representedWeight: figure.representedWeight,
    }),
  );
  const figures = scene.figures
    .map((figure, index) =>
      prepareFigure(
        figure,
        index + 1,
        scene.selectedPersonId,
        camera,
        viewport,
        presentation.reducedMotion,
      ),
    )
    .sort((left, right) => {
      if (left.selected !== right.selected) return left.selected ? 1 : -1;
      return left.depth - right.depth;
    });
  const hour = Number(scene.context.time.tick % 24n);
  return Object.freeze({
    semanticKey: scene.semanticKey,
    selectedPersonId: scene.selectedPersonId,
    fixedTime: Object.freeze({ ...scene.context.time }),
    viewport: Object.freeze({ ...viewport }),
    treatment: hour >= 7 && hour < 18 ? "day" : "evening",
    roads: Object.freeze(roads),
    sidewalks: Object.freeze(pathFeatures(scene.city.sidewalks)),
    crossings: Object.freeze(pathFeatures(scene.city.crossings)),
    publicSpaces: Object.freeze(areaFeatures(scene.city.publicSpaces)),
    buildings: Object.freeze(buildings),
    figures: Object.freeze(figures),
    pickTable: Object.freeze(pickTable),
  });
}

export function pickLivingCityFigure(
  frame: PreparedLivingCityFrame,
  x: number,
  y: number,
  expectedSemanticKey: string,
): PickResult | null {
  if (
    expectedSemanticKey !== frame.semanticKey ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  )
    return null;
  for (let index = frame.figures.length - 1; index >= 0; index -= 1) {
    const figure = frame.figures[index];
    if (figure === undefined) continue;
    const deltaX = x - figure.screen.x;
    const deltaY = y - (figure.screen.y - figure.hitRadius * 0.72);
    if (
      (deltaX * deltaX) / (figure.hitRadius * figure.hitRadius) +
        (deltaY * deltaY) /
          (figure.hitRadius * 1.55 * (figure.hitRadius * 1.55)) <=
      1
    )
      return frame.pickTable[figure.renderKey - 1] ?? null;
  }
  return null;
}

export function createLivingCitySummary(
  scene: LivingCityScene,
): LivingCitySummary {
  validateScene(scene);
  const selected =
    scene.selectedPersonId === null
      ? undefined
      : scene.figures.find(
          (figure) => figure.personId === scene.selectedPersonId,
        );
  const sampledPeople = scene.figures.reduce(
    (total, figure) => total + figure.representedWeight,
    0n,
  );
  const moving = scene.figures.filter(
    (figure) => figure.pose.mode === "walking",
  ).length;
  return Object.freeze({
    semanticKey: scene.semanticKey,
    timeLabel: `Tick ${scene.context.time.tick.toString()} + ${(scene.context.time.phasePermillion / 10_000).toFixed(4)}%`,
    placeSummaries: Object.freeze(
      [
        ...new Set(
          scene.figures.map((figure) => figure.pose.destinationPlaceId),
        ),
      ]
        .sort((left, right) => left.localeCompare(right))
        .map((placeId) => `Destination ${placeId}`),
    ),
    movementSummary: `${moving} of ${scene.figures.length} literal figures are walking.`,
    eventSummary: `${scene.context.branch} branch · event ${scene.context.eventHash}`,
    selectionSummary:
      selected === undefined
        ? null
        : `Selected ${selected.personId}, weight one, ${selected.pose.mode} to ${selected.pose.destinationPlaceId}.`,
    populationSummary: `${scene.figures.length} literal figures represent ${sampledPeople.toString()} people; ${scene.unsampledRemainder.toString()} people remain unsampled; total ${scene.representedPeople.toString()}.`,
    observerComparison: null,
  });
}

export class LivingCityLifecycle {
  #backend: LivingCityBackend = "canvas2d";
  #semanticKey = "";
  #selectedPersonId: string | null = null;
  #generation = 0;
  #contextLosses = 0;

  initialize(
    probe: LivingCityCapabilityProbe,
    scene: LivingCityScene,
  ): LivingCityLifecycleSnapshot {
    validateScene(scene);
    this.#semanticKey = scene.semanticKey;
    this.#selectedPersonId = scene.selectedPersonId;
    this.#backend =
      probe.gpuPresent && probe.adapterAvailable && probe.contextAvailable
        ? "webgpu"
        : "canvas2d";
    this.#generation += 1;
    return this.snapshot();
  }

  scene(scene: LivingCityScene): LivingCityLifecycleSnapshot {
    validateScene(scene);
    this.#semanticKey = scene.semanticKey;
    this.#selectedPersonId = scene.selectedPersonId;
    this.#generation += 1;
    return this.snapshot();
  }

  resized(): LivingCityLifecycleSnapshot {
    this.#generation += 1;
    return this.snapshot();
  }

  contextLost(): LivingCityLifecycleSnapshot {
    this.#backend = "canvas2d";
    this.#contextLosses += 1;
    this.#generation += 1;
    return this.snapshot();
  }

  snapshot(): LivingCityLifecycleSnapshot {
    return Object.freeze({
      backend: this.#backend,
      semanticKey: this.#semanticKey,
      selectedPersonId: this.#selectedPersonId,
      generation: this.#generation,
      contextLosses: this.#contextLosses,
    });
  }
}

function canvasPolygon(
  context: CanvasRenderingContext2D,
  points: readonly ScreenPoint[],
): void {
  const first = points[0];
  if (first === undefined) return;
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
}

function drawPreparedFigure(
  context: CanvasRenderingContext2D,
  figure: PreparedLivingCityFigure,
): void {
  for (const figurePart of figure.parts) {
    context.strokeStyle = figurePart.color;
    context.fillStyle = figurePart.color;
    context.lineWidth = figurePart.width;
    context.lineCap = "round";
    if (figurePart.kind === "left-leg" || figurePart.kind === "right-leg") {
      const [start, end] = figurePart.points;
      if (start === undefined || end === undefined) continue;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    } else if (figurePart.kind === "body") {
      canvasPolygon(context, figurePart.points);
      context.fill();
      context.strokeStyle = "rgba(17, 25, 31, 0.72)";
      context.lineWidth = 0.8;
      context.stroke();
    } else {
      const center = figurePart.points[0];
      if (center === undefined) continue;
      context.beginPath();
      context.arc(center.x, center.y, figurePart.radius, 0, Math.PI * 2);
      if (figurePart.kind === "selection-ring") context.stroke();
      else context.fill();
    }
  }
}

export function drawLivingCityCanvas(
  canvas: HTMLCanvasElement,
  frame: PreparedLivingCityFrame,
): Readonly<{ drawMs: number; drawCount: number; bufferBytes: number }> {
  const context = canvas.getContext("2d", { alpha: false });
  if (context === null) throw new Error("Canvas2D fallback unavailable");
  const started = performance.now();
  const { width, height } = frame.viewport;
  const sky = context.createLinearGradient(0, 0, 0, height);
  if (frame.treatment === "day") {
    sky.addColorStop(0, "#9cc9ca");
    sky.addColorStop(0.45, "#dce1c9");
    sky.addColorStop(1, "#9aa77f");
  } else {
    sky.addColorStop(0, "#182942");
    sky.addColorStop(0.45, "#4d5365");
    sky.addColorStop(1, "#5e695b");
  }
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  context.fillStyle = frame.treatment === "day" ? "#a7ae89" : "#596153";
  context.fillRect(0, height * 0.24, width, height * 0.76);
  for (const space of frame.publicSpaces) {
    canvasPolygon(context, space.points);
    context.fillStyle = frame.treatment === "day" ? "#789b67" : "#466448";
    context.fill();
  }
  for (const road of frame.roads) {
    const first = road.centerline[0];
    if (first === undefined) continue;
    context.beginPath();
    context.moveTo(first.x, first.y);
    for (const point of road.centerline.slice(1))
      context.lineTo(point.x, point.y);
    context.lineCap = "butt";
    context.lineJoin = "round";
    context.lineWidth = road.widthPx;
    context.strokeStyle = frame.treatment === "day" ? "#4c555a" : "#343c48";
    context.stroke();
    context.lineWidth = Math.max(1, road.widthPx * 0.035);
    context.setLineDash([12, 12]);
    context.strokeStyle = "rgba(242, 222, 154, 0.72)";
    context.stroke();
    context.setLineDash([]);
  }
  for (const sidewalk of frame.sidewalks) {
    const first = sidewalk.centerline[0];
    if (first === undefined) continue;
    context.beginPath();
    context.moveTo(first.x, first.y);
    for (const point of sidewalk.centerline.slice(1))
      context.lineTo(point.x, point.y);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = frame.treatment === "day" ? "#c8c4b5" : "#777a78";
    context.lineWidth = sidewalk.widthPx;
    context.stroke();
  }
  for (const crossing of frame.crossings) {
    const first = crossing.centerline[0];
    if (first === undefined) continue;
    context.beginPath();
    context.moveTo(first.x, first.y);
    for (const point of crossing.centerline.slice(1))
      context.lineTo(point.x, point.y);
    context.lineCap = "butt";
    context.strokeStyle = "rgba(235, 234, 216, 0.88)";
    context.lineWidth = crossing.widthPx;
    context.setLineDash([5, 5]);
    context.stroke();
    context.setLineDash([]);
  }
  for (const building of frame.buildings) {
    const wallCount = Math.min(building.footprint.length, building.roof.length);
    for (let index = 0; index < wallCount; index += 1) {
      const next = (index + 1) % wallCount;
      const wall = [
        building.footprint[index],
        building.footprint[next],
        building.roof[next],
        building.roof[index],
      ].filter((point): point is ScreenPoint => point !== undefined);
      canvasPolygon(context, wall);
      context.fillStyle =
        index % 2 === 0
          ? frame.treatment === "day"
            ? "#6f7c7e"
            : "#3d4955"
          : frame.treatment === "day"
            ? "#596a6e"
            : "#323e4a";
      context.fill();
    }
    canvasPolygon(context, building.roof);
    context.fillStyle = frame.treatment === "day" ? "#b5aa92" : "#756d68";
    context.fill();
    context.strokeStyle = "rgba(29, 36, 40, 0.68)";
    context.lineWidth = 1;
    context.stroke();
  }
  for (const figure of frame.figures) drawPreparedFigure(context, figure);
  const selected = frame.figures.find((figure) => figure.selected);
  if (selected !== undefined) {
    context.fillStyle = "rgba(14, 24, 28, 0.9)";
    context.strokeStyle = "#ffe66d";
    context.lineWidth = 1;
    context.font = "600 12px ui-monospace, monospace";
    const label = `${selected.personId} · weight 1`;
    const labelWidth = context.measureText(label).width + 14;
    const labelX = Math.min(width - labelWidth - 8, selected.screen.x + 14);
    const labelY = Math.max(22, selected.screen.y - 34);
    context.fillRect(labelX, labelY - 16, labelWidth, 22);
    context.strokeRect(labelX, labelY - 16, labelWidth, 22);
    context.fillStyle = "#fff8ce";
    context.fillText(label, labelX + 7, labelY);
  }
  return Object.freeze({
    drawMs: performance.now() - started,
    drawCount: 1,
    bufferBytes: 0,
  });
}

interface Rgba {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

function color(colorValue: string): Rgba {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(colorValue);
  if (match === null) return { red: 1, green: 1, blue: 1, alpha: 1 };
  return {
    red: Number.parseInt(match[1] ?? "ff", 16) / 255,
    green: Number.parseInt(match[2] ?? "ff", 16) / 255,
    blue: Number.parseInt(match[3] ?? "ff", 16) / 255,
    alpha: 1,
  };
}

function triangleVertices(
  output: number[],
  viewport: Readonly<{ width: number; height: number }>,
  points: readonly ScreenPoint[],
  fill: Rgba,
): void {
  const origin = points[0];
  if (origin === undefined) return;
  const push = (point: ScreenPoint) =>
    output.push(
      (point.x / viewport.width) * 2 - 1,
      1 - (point.y / viewport.height) * 2,
      fill.red,
      fill.green,
      fill.blue,
      fill.alpha,
    );
  for (let index = 1; index < points.length - 1; index += 1) {
    const middle = points[index];
    const end = points[index + 1];
    if (middle === undefined || end === undefined) continue;
    push(origin);
    push(middle);
    push(end);
  }
}

function circleVertices(
  output: number[],
  viewport: Readonly<{ width: number; height: number }>,
  center: ScreenPoint,
  radius: number,
  fill: Rgba,
  ring: boolean,
): void {
  const segments = 12;
  for (let index = 0; index < segments; index += 1) {
    const firstAngle = (index / segments) * Math.PI * 2;
    const secondAngle = ((index + 1) / segments) * Math.PI * 2;
    const outerFirst = {
      x: center.x + Math.cos(firstAngle) * radius,
      y: center.y + Math.sin(firstAngle) * radius,
    };
    const outerSecond = {
      x: center.x + Math.cos(secondAngle) * radius,
      y: center.y + Math.sin(secondAngle) * radius,
    };
    if (!ring) {
      triangleVertices(
        output,
        viewport,
        [center, outerFirst, outerSecond],
        fill,
      );
      continue;
    }
    const innerRadius = Math.max(0, radius - 2.2);
    const innerFirst = {
      x: center.x + Math.cos(firstAngle) * innerRadius,
      y: center.y + Math.sin(firstAngle) * innerRadius,
    };
    const innerSecond = {
      x: center.x + Math.cos(secondAngle) * innerRadius,
      y: center.y + Math.sin(secondAngle) * innerRadius,
    };
    triangleVertices(
      output,
      viewport,
      [outerFirst, outerSecond, innerSecond, innerFirst],
      fill,
    );
  }
}

function lineVertices(
  output: number[],
  viewport: Readonly<{ width: number; height: number }>,
  start: ScreenPoint,
  end: ScreenPoint,
  width: number,
  fill: Rgba,
): void {
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const offsetX = (-(end.y - start.y) / length) * width * 0.5;
  const offsetY = ((end.x - start.x) / length) * width * 0.5;
  triangleVertices(
    output,
    viewport,
    [
      { x: start.x + offsetX, y: start.y + offsetY },
      { x: end.x + offsetX, y: end.y + offsetY },
      { x: end.x - offsetX, y: end.y - offsetY },
      { x: start.x - offsetX, y: start.y - offsetY },
    ],
    fill,
  );
}

function gpuVertices(frame: PreparedLivingCityFrame): Float32Array {
  const output: number[] = [];
  const viewport = frame.viewport;
  triangleVertices(
    output,
    viewport,
    [
      { x: 0, y: 0 },
      { x: viewport.width, y: 0 },
      { x: viewport.width, y: viewport.height },
      { x: 0, y: viewport.height },
    ],
    color(frame.treatment === "day" ? "#9aa77f" : "#3c4650"),
  );
  for (const space of frame.publicSpaces)
    triangleVertices(output, viewport, space.points, color("#67885c"));
  for (const road of frame.roads)
    for (let index = 0; index < road.centerline.length - 1; index += 1) {
      const start = road.centerline[index];
      const end = road.centerline[index + 1];
      if (start !== undefined && end !== undefined)
        lineVertices(
          output,
          viewport,
          start,
          end,
          road.widthPx,
          color("#465058"),
        );
    }
  for (const sidewalk of frame.sidewalks)
    for (let index = 0; index < sidewalk.centerline.length - 1; index += 1) {
      const start = sidewalk.centerline[index];
      const end = sidewalk.centerline[index + 1];
      if (start !== undefined && end !== undefined)
        lineVertices(
          output,
          viewport,
          start,
          end,
          sidewalk.widthPx,
          color("#c8c4b5"),
        );
    }
  for (const crossing of frame.crossings)
    for (let index = 0; index < crossing.centerline.length - 1; index += 1) {
      const start = crossing.centerline[index];
      const end = crossing.centerline[index + 1];
      if (start !== undefined && end !== undefined)
        lineVertices(
          output,
          viewport,
          start,
          end,
          crossing.widthPx,
          color("#e9e7d8"),
        );
    }
  for (const building of frame.buildings) {
    triangleVertices(output, viewport, building.footprint, color("#596a6e"));
    triangleVertices(output, viewport, building.roof, color("#b5aa92"));
  }
  for (const figure of frame.figures)
    for (const figurePart of figure.parts) {
      const fill = color(figurePart.color);
      if (figurePart.kind === "left-leg" || figurePart.kind === "right-leg") {
        const [start, end] = figurePart.points;
        if (start !== undefined && end !== undefined)
          lineVertices(output, viewport, start, end, figurePart.width, fill);
      } else if (figurePart.kind === "body")
        triangleVertices(output, viewport, figurePart.points, fill);
      else {
        const center = figurePart.points[0];
        if (center !== undefined)
          circleVertices(
            output,
            viewport,
            center,
            figurePart.radius,
            fill,
            figurePart.kind === "selection-ring",
          );
      }
    }
  return new Float32Array(output);
}

const GPU_BUFFER_USAGE_COPY_DST = 0x0008;
const GPU_BUFFER_USAGE_VERTEX = 0x0020;

export interface LivingCityRendererElements {
  readonly fallbackCanvas: HTMLCanvasElement;
  readonly gpuCanvas: HTMLCanvasElement;
}

export class LivingCityBrowserRenderer {
  readonly #elements: LivingCityRendererElements;
  readonly #forceCanvas: boolean;
  readonly #lifecycle = new LivingCityLifecycle();
  #device: GPUDevice | null = null;
  #context: GPUCanvasContext | null = null;
  #pipeline: GPURenderPipeline | null = null;
  #input: LivingCityRenderInput | null = null;
  #frame: PreparedLivingCityFrame | null = null;
  #metrics: LivingCityRenderMetrics | null = null;
  #destroyed = false;

  constructor(elements: LivingCityRendererElements, forceCanvas = false) {
    this.#elements = elements;
    this.#forceCanvas = forceCanvas;
  }

  async initialize(
    input: LivingCityRenderInput,
  ): Promise<LivingCityRenderMetrics> {
    this.#input = input;
    const gpu = this.#forceCanvas ? undefined : navigator.gpu;
    let adapter: GPUAdapter | null = null;
    let context: GPUCanvasContext | null = null;
    if (gpu !== undefined) {
      try {
        adapter = await gpu.requestAdapter();
        context = this.#elements.gpuCanvas.getContext(
          "webgpu",
        ) as unknown as GPUCanvasContext | null;
      } catch {
        adapter = null;
        context = null;
      }
    }
    this.#lifecycle.initialize(
      {
        gpuPresent: gpu !== undefined,
        adapterAvailable: adapter !== null,
        contextAvailable: context !== null,
      },
      input.scene,
    );
    if (gpu !== undefined && adapter !== null && context !== null) {
      try {
        const device = await adapter.requestDevice();
        const format = gpu.getPreferredCanvasFormat();
        context.configure({ device, format, alphaMode: "opaque" });
        const module = device.createShaderModule({
          code: `
struct VertexInput {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
};
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};
@vertex fn vertex_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.position, 0.0, 1.0);
  output.color = input.color;
  return output;
}
@fragment fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}`,
        });
        const pipeline = device.createRenderPipeline({
          layout: "auto",
          vertex: {
            module,
            entryPoint: "vertex_main",
            buffers: [
              {
                arrayStride: 24,
                attributes: [
                  { shaderLocation: 0, offset: 0, format: "float32x2" },
                  { shaderLocation: 1, offset: 8, format: "float32x4" },
                ],
              },
            ],
          },
          fragment: {
            module,
            entryPoint: "fragment_main",
            targets: [{ format }],
          },
          primitive: { topology: "triangle-list" },
        });
        this.#device = device;
        this.#context = context;
        this.#pipeline = pipeline;
        void device.lost.then(() => {
          if (!this.#destroyed) this.simulateContextLoss();
        });
      } catch {
        this.#device = null;
        this.#context = null;
        this.#pipeline = null;
        this.#lifecycle.contextLost();
      }
    }
    return this.render(input);
  }

  #show(backend: LivingCityBackend): void {
    this.#elements.gpuCanvas.hidden = backend !== "webgpu";
    this.#elements.fallbackCanvas.hidden = backend !== "canvas2d";
  }

  render(input: LivingCityRenderInput): LivingCityRenderMetrics {
    const frameStarted = performance.now();
    const preparationStarted = performance.now();
    const frame = prepareLivingCityFrame(input);
    const cpuPrepareMs = performance.now() - preparationStarted;
    this.#input = input;
    this.#frame = frame;
    this.#lifecycle.scene(input.scene);
    let uploadMs = 0;
    let drawMs: number;
    let bufferBytes = 0;
    let backend: LivingCityBackend = "canvas2d";
    if (
      this.#device !== null &&
      this.#context !== null &&
      this.#pipeline !== null
    ) {
      backend = "webgpu";
      const vertices = gpuVertices(frame);
      bufferBytes = vertices.byteLength;
      const uploadStarted = performance.now();
      const buffer = this.#device.createBuffer({
        size: Math.max(4, vertices.byteLength),
        usage: GPU_BUFFER_USAGE_VERTEX | GPU_BUFFER_USAGE_COPY_DST,
      });
      this.#device.queue.writeBuffer(
        buffer,
        0,
        vertices.buffer as ArrayBuffer,
        vertices.byteOffset,
        vertices.byteLength,
      );
      uploadMs = performance.now() - uploadStarted;
      const drawStarted = performance.now();
      const encoder = this.#device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.#context.getCurrentTexture().createView(),
            clearValue: { r: 0.08, g: 0.12, b: 0.15, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(this.#pipeline);
      pass.setVertexBuffer(0, buffer);
      pass.draw(vertices.length / 6);
      pass.end();
      this.#device.queue.submit([encoder.finish()]);
      drawMs = performance.now() - drawStarted;
    } else {
      const canvas = drawLivingCityCanvas(this.#elements.fallbackCanvas, frame);
      drawMs = canvas.drawMs;
    }
    this.#show(backend);
    this.#metrics = Object.freeze({
      backend,
      semanticKey: frame.semanticKey,
      selectedPersonId: frame.selectedPersonId,
      figureCount: frame.figures.length,
      frameMs: performance.now() - frameStarted,
      cpuPrepareMs,
      uploadMs,
      drawMs,
      drawCount: 1,
      bufferBytes,
      lifecycle: this.#lifecycle.snapshot(),
    });
    return this.#metrics;
  }

  resize(width: number, height: number): LivingCityRenderMetrics | null {
    assertDimension(width, "render width");
    assertDimension(height, "render height");
    for (const canvas of [
      this.#elements.fallbackCanvas,
      this.#elements.gpuCanvas,
    ]) {
      canvas.width = width;
      canvas.height = height;
    }
    this.#lifecycle.resized();
    if (this.#input === null) return null;
    return this.render({
      ...this.#input,
      presentation: {
        ...this.#input.presentation,
        viewport: { width, height },
      },
    });
  }

  pick(x: number, y: number, expectedSemanticKey: string): PickResult | null {
    return this.#frame === null
      ? null
      : pickLivingCityFigure(this.#frame, x, y, expectedSemanticKey);
  }

  simulateContextLoss(): LivingCityRenderMetrics | null {
    this.#context?.unconfigure();
    this.#device = null;
    this.#context = null;
    this.#pipeline = null;
    this.#lifecycle.contextLost();
    if (this.#input === null || this.#frame === null) return null;
    const frameStarted = performance.now();
    const canvas = drawLivingCityCanvas(
      this.#elements.fallbackCanvas,
      this.#frame,
    );
    this.#show("canvas2d");
    this.#metrics = Object.freeze({
      backend: "canvas2d",
      semanticKey: this.#frame.semanticKey,
      selectedPersonId: this.#frame.selectedPersonId,
      figureCount: this.#frame.figures.length,
      frameMs: performance.now() - frameStarted,
      cpuPrepareMs: 0,
      uploadMs: 0,
      drawMs: canvas.drawMs,
      drawCount: 1,
      bufferBytes: 0,
      lifecycle: this.#lifecycle.snapshot(),
    });
    return this.#metrics;
  }

  status(): LivingCityRenderMetrics | null {
    return this.#metrics;
  }

  destroy(): void {
    this.#destroyed = true;
    this.#context?.unconfigure();
    this.#device?.destroy();
    this.#device = null;
    this.#context = null;
    this.#pipeline = null;
  }
}
