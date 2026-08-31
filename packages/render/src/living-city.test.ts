import { describe, expect, it } from "vitest";

import {
  LivingCityLifecycle,
  createLivingCitySummary,
  pickLivingCityFigure,
  prepareLivingCityFrame,
  type LivingCityRenderInput,
} from "./living-city";

function fixedInput(): LivingCityRenderInput {
  const point = (eastCm: number, northCm: number, upCm = 0) => ({
    eastCm,
    northCm,
    upCm,
  });
  const pose = (
    personId: string,
    eastCm: number,
    northCm: number,
    headingMilliTurns: number,
    stridePermillion: number,
  ) => ({
    personId,
    time: { tick: 7n, phasePermillion: 250_000 },
    mode: "walking" as const,
    position: point(eastCm, northCm),
    headingMilliTurns,
    stridePermillion,
    routeId: "route/harbor-street",
    edgeId: "edge/harbor-east",
    destinationPlaceId: "place/market-hall",
    trajectoryHash: `trajectory/${personId}`,
  });
  return {
    scene: {
      schema: 1,
      context: {
        seed: "ten-billion-lives/baseline/v1",
        branch: "baseline",
        stateHash: "state/7",
        eventHash: "event/7",
        manifestationHash: "manifestation/harbor",
        time: { tick: 7n, phasePermillion: 250_000 },
      },
      city: {
        schema: 1,
        seed: "ten-billion-lives/baseline/v1",
        settlementId: "place/brindle-bay",
        bounds: { min: point(-20_000, -20_000), max: point(20_000, 20_000) },
        roads: [
          {
            id: "road/harbor",
            centerline: [point(-20_000, 0), point(20_000, 0)],
            widthCm: 1_200,
          },
        ],
        sidewalks: [
          {
            id: "sidewalk/north",
            path: [point(-20_000, -900), point(20_000, -900)],
            widthCm: 600,
          },
        ],
        crossings: [
          {
            id: "crossing/market",
            path: [point(0, -600), point(0, 600)],
            widthCm: 1_200,
          },
        ],
        buildings: [
          {
            id: "building/market",
            footprint: [
              point(-8_000, -8_000),
              point(-1_000, -8_000),
              point(-1_000, -3_000),
              point(-8_000, -3_000),
            ],
            heightCm: 1_400,
          },
        ],
        publicSpaces: [],
        places: [],
        pedestrianNodes: [],
        pedestrianEdges: [],
        cityHash: "city/harbor-fixture-v1",
      },
      figures: [
        {
          personId: "person/ada",
          representedWeight: 1n,
          pinned: true,
          pose: pose("person/ada", -1_200, -900, 0, 750_000),
          appearanceKey: 17,
        },
        {
          personId: "person/bea",
          representedWeight: 49n,
          pinned: false,
          pose: pose("person/bea", 1_600, 900, 250_000, 200_000),
          appearanceKey: 92,
        },
      ],
      selectedPersonId: "person/ada",
      representedPeople: 100n,
      unsampledRemainder: 50n,
      semanticKey: "scene/state-7/event-7/t7-p250000",
    },
    presentation: {
      camera: {
        centerEastCm: 0,
        centerNorthCm: 0,
        pixelsPerMeter: 1.2,
      },
      viewport: { width: 960, height: 640 },
      quality: "baseline",
      reducedMotion: false,
    },
  };
}

describe("literal-person living-city renderer", () => {
  it("prepares deterministic fixed-time literal silhouettes from immutable semantics", () => {
    const input = fixedInput();
    const first = prepareLivingCityFrame(input);
    const second = prepareLivingCityFrame(fixedInput());

    expect(first.semanticKey).toBe(input.scene.semanticKey);
    expect(first.fixedTime).toEqual({ tick: 7n, phasePermillion: 250_000 });
    expect(first.pickTable).toEqual(second.pickTable);
    expect(first.figures).toEqual(second.figures);
    const selected = first.figures.find((figure) => figure.selected);
    expect(selected).toMatchObject({
      personId: "person/ada",
      representedWeight: 1n,
      selected: true,
      renderKey: 1,
    });
    expect(selected?.parts.map((part) => part.kind)).toEqual([
      "left-leg",
      "right-leg",
      "body",
      "head",
      "selection-ring",
    ]);
    expect(input.scene.figures[0]?.pose.position).toEqual({
      eastCm: -1_200,
      northCm: -900,
      upCm: 0,
    });
  });

  it("uses stable canonical keys for visible picking and fails stale scenes closed", () => {
    const baseline = prepareLivingCityFrame(fixedInput());
    const resized = prepareLivingCityFrame({
      ...fixedInput(),
      presentation: {
        ...fixedInput().presentation,
        viewport: { width: 1_280, height: 720 },
      },
    });
    expect(resized.pickTable).toEqual(baseline.pickTable);

    const selected = baseline.figures.find((figure) => figure.selected);
    expect(selected).toBeDefined();
    expect(
      pickLivingCityFigure(
        baseline,
        selected?.screen.x ?? 0,
        selected?.screen.y ?? 0,
        baseline.semanticKey,
      ),
    ).toEqual({
      semanticKey: baseline.semanticKey,
      renderKey: 1,
      personId: "person/ada",
      representedWeight: 1n,
    });
    expect(pickLivingCityFigure(baseline, 0, 0, "scene/stale")).toBeNull();
  });

  it("falls back to Canvas on context loss without changing scene or selection", () => {
    const input = fixedInput();
    const trajectoriesBefore = input.scene.figures.map(
      (figure) => figure.pose.trajectoryHash,
    );
    const lifecycle = new LivingCityLifecycle();
    lifecycle.initialize(
      { gpuPresent: true, adapterAvailable: true, contextAvailable: true },
      input.scene,
    );
    expect(lifecycle.snapshot()).toMatchObject({
      backend: "webgpu",
      semanticKey: "scene/state-7/event-7/t7-p250000",
      selectedPersonId: "person/ada",
      contextLosses: 0,
    });
    expect(lifecycle.contextLost()).toMatchObject({
      backend: "canvas2d",
      semanticKey: "scene/state-7/event-7/t7-p250000",
      selectedPersonId: "person/ada",
      contextLosses: 1,
    });
    expect(
      input.scene.figures.map((figure) => figure.pose.trajectoryHash),
    ).toEqual(trajectoriesBefore);
  });

  it("rejects broken conservation, noncanonical figures, and selected aggregates", () => {
    const input = fixedInput();
    expect(() =>
      prepareLivingCityFrame({
        ...input,
        scene: { ...input.scene, unsampledRemainder: 51n },
      }),
    ).toThrow(/reconcile/);
    expect(() =>
      prepareLivingCityFrame({
        ...input,
        scene: {
          ...input.scene,
          figures: [...input.scene.figures].reverse(),
        },
      }),
    ).toThrow(/canonical/);
    expect(() =>
      prepareLivingCityFrame({
        ...input,
        scene: {
          ...input.scene,
          figures: input.scene.figures.map((figure) =>
            figure.personId === input.scene.selectedPersonId
              ? { ...figure, representedWeight: 2n }
              : figure,
          ),
          representedPeople: 101n,
        },
      }),
    ).toThrow(/weight one/);
  });

  it("derives a camera-independent textual alternative from the same scene", () => {
    const input = fixedInput();
    const summary = createLivingCitySummary(input.scene);
    expect(summary).toMatchObject({
      semanticKey: input.scene.semanticKey,
      timeLabel: "Tick 7 + 25.0000%",
      selectionSummary:
        "Selected person/ada, weight one, walking to place/market-hall.",
      populationSummary:
        "2 literal figures represent 50 people; 50 people remain unsampled; total 100.",
    });
    expect(
      createLivingCitySummary({
        ...input.scene,
        selectedPersonId: null,
      }).selectionSummary,
    ).toBeNull();
  });

  it("selects day and evening treatment from explicit fixed time only", () => {
    const day = fixedInput();
    const eveningTime = { tick: 19n, phasePermillion: 250_000 } as const;
    const evening: LivingCityRenderInput = {
      ...day,
      scene: {
        ...day.scene,
        context: { ...day.scene.context, time: eveningTime },
        figures: day.scene.figures.map((figure) => ({
          ...figure,
          pose: { ...figure.pose, time: eveningTime },
        })),
      },
    };
    expect(prepareLivingCityFrame(day).treatment).toBe("day");
    expect(prepareLivingCityFrame(evening).treatment).toBe("evening");
    expect(day.scene.context.time).toEqual({
      tick: 7n,
      phasePermillion: 250_000,
    });
  });
});
