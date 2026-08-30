import { createServer } from "vite";

function projectionSummary(projection) {
  return {
    lod: projection.lod,
    identityEpoch: projection.identityEpoch.toString(),
    manifestationHash: projection.manifestationHash,
    eventHash: projection.eventHash,
    representedPeople: projection.realityBudget.representedPeople.toString(),
    materializedTokens: projection.realityBudget.materializedTokens,
    estimatedBytes: projection.realityBudget.estimatedBytes,
    stateHash: projection.realityBudget.stateHash,
    continuityHorizonTicks:
      projection.realityBudget.continuityHorizonTicks.toString(),
    samplingContract: projection.realityBudget.samplingContract,
  };
}

function eventSummary(event) {
  return {
    id: event.id,
    kind: event.kind,
    tick: event.tick.toString(),
    locationId: event.locationId,
    participantIds: event.participantIds,
    activity: event.activity,
  };
}

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
try {
  const { createIllusionEngine } = await vite.ssrLoadModule(
    "/packages/manifest/src/projection.ts",
  );
  const { advanceWorldKernel, createWorldKernel } = await vite.ssrLoadModule(
    "/packages/sim/src/index.ts",
  );
  const genesis = createWorldKernel();
  const state10 = advanceWorldKernel(genesis, 10);
  const cellId = genesis.world.settlements[0]?.cellId;
  if (!cellId) throw new Error("missing projection settlement cell");
  const firstEngine = createIllusionEngine(genesis.world);
  const secondEngine = createIllusionEngine(genesis.world);
  const selectedPersonId = firstEngine.manifestation.personIdAt(cellId, 42n);
  const query = {
    state: state10,
    tick: 10n,
    scopeCellIds: [cellId],
    lod: "street",
    selectedPersonIds: [selectedPersonId],
  };
  const observerA = firstEngine.project(query, {
    observerId: "observer-a",
    cameraPath: "planet/region/street",
    frameRate: 30,
    quality: "fallback",
  });
  const observerB = secondEngine.project(query, {
    observerId: "observer-b",
    cameraPath: "person/planet/street",
    frameRate: 144,
    quality: "showcase",
  });
  if (
    observerA.manifestationHash !== observerB.manifestationHash ||
    observerA.eventHash !== observerB.eventHash
  )
    throw new Error("independent observer projection mismatch");

  const fieldCell = state10.field.cells.find((cell) => cell.cellId === cellId);
  if (!fieldCell) throw new Error("missing projection field cell");
  const reconciliation = Object.fromEntries(
    ["young", "adult", "older"].map((cohort) => [
      cohort,
      {
        field: fieldCell.cohorts[cohort].toString(),
        manifested: observerA.tokens
          .filter((token) => token.cohort === cohort)
          .reduce((sum, token) => sum + token.weight, 0n)
          .toString(),
      },
    ]),
  );

  const lodReentry = ["planet", "region", "street", "person", "planet"].map(
    (lod) => {
      const projected = firstEngine.project({ ...query, lod });
      return {
        lod,
        manifestationHash: projected.manifestationHash,
        selectedPresent: projected.tokens.some(
          (token) => token.personId === selectedPersonId,
        ),
      };
    },
  );

  const before = firstEngine.project({
    ...query,
    state: advanceWorldKernel(genesis, 23),
    tick: 23n,
    lod: "region",
  });
  const after = firstEngine.project({
    ...query,
    state: advanceWorldKernel(genesis, 24),
    tick: 24n,
    lod: "region",
  });
  const beforeIds = new Set(before.tokens.map((token) => token.personId));
  const retained = after.tokens.filter((token) =>
    beforeIds.has(token.personId),
  ).length;

  console.log(
    JSON.stringify(
      {
        schemaVersion: 1,
        worldHash: genesis.world.worldHash,
        selectedPersonId,
        observers: {
          observerA: projectionSummary(observerA),
          observerB: projectionSummary(observerB),
          hashesMatch: true,
        },
        reconciliation,
        lodReentry,
        epochTransition: {
          before: projectionSummary(before),
          after: projectionSummary(after),
          retained,
          total: after.tokens.length,
          retainedPermille: Math.floor(
            (retained * 1_000) / after.tokens.length,
          ),
          selectedPresent: after.tokens.some(
            (token) => token.personId === selectedPersonId,
          ),
        },
        events: observerA.events.map(eventSummary),
      },
      null,
      2,
    ),
  );
} finally {
  await vite.close();
}
