import { createServer } from "vite";

function summary(point) {
  return {
    tick: point.tick.toString(),
    dayIndex: point.dayIndex.toString(),
    hour: point.hour,
    activity: point.activity,
    location: point.location,
    route:
      point.route === null
        ? null
        : {
            ...point.route,
            replannedAtTick: point.route.replannedAtTick?.toString(),
          },
    fieldMembership: {
      ...point.fieldMembership,
      cohortPopulation: point.fieldMembership.cohortPopulation.toString(),
      channelPopulation: point.fieldMembership.channelPopulation.toString(),
    },
    encounterGroupId: point.encounterGroupId,
    encounters: point.encounters,
    semanticHash: point.semanticHash,
  };
}

function encodedPersonValue(personId) {
  return Number.parseInt(personId.split("_")[1] ?? "", 36);
}

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
try {
  const { createAnalyticalItineraryIndex } = await vite.ssrLoadModule(
    "/packages/manifest/src/itinerary.ts",
  );
  const {
    advanceWorldKernel,
    buildTransportGraph,
    createSignatureCommandLog,
    createWorldKernel,
  } = await vite.ssrLoadModule("/packages/sim/src/index.ts");
  const genesis = createWorldKernel();
  const world = genesis.world;
  const itinerary = createAnalyticalItineraryIndex(world);
  const manifestation = itinerary.manifestation;
  const states = [genesis];
  for (let tick = 1; tick <= 24; tick += 1)
    states.push(advanceWorldKernel(states[tick - 1], 1));
  const stateAt = (tick) => {
    const state = states[tick];
    if (state === undefined) throw new Error(`missing state at tick ${tick}`);
    return state;
  };

  const settlementCellId = world.settlements[0]?.cellId;
  if (!settlementCellId) throw new Error("missing itinerary settlement cell");
  const personId = manifestation.personIdForCohortRank(
    settlementCellId,
    "adult",
    42n,
  );
  const trace = Array.from({ length: 25 }, (_value, tick) =>
    summary(itinerary.queryPerson(personId, BigInt(tick), stateAt(tick))),
  );

  const graph = buildTransportGraph(world);
  const signatureEdgeId = createSignatureCommandLog(graph)[0]?.edgeId;
  const sourceRegionId = graph.edges.find(
    (edge) => edge.id === signatureEdgeId,
  )?.from;
  const sourceCell = world.cells
    .filter((cell) => `region/${cell.regionId}` === sourceRegionId)
    .reduce(
      (largest, cell) =>
        largest === undefined || cell.population > largest.population
          ? cell
          : largest,
      undefined,
    );
  if (!sourceCell || !signatureEdgeId)
    throw new Error("missing signature route source");
  let closurePersonId;
  for (let ordinal = 0n; ordinal < 4_096n; ordinal += 1n) {
    const candidate = manifestation.personIdAt(sourceCell.id, ordinal);
    if (
      itinerary.queryPerson(candidate, 9n, stateAt(9)).route?.edgeIds[0] ===
      signatureEdgeId
    ) {
      closurePersonId = candidate;
      break;
    }
  }
  if (!closurePersonId) throw new Error("missing closure itinerary person");

  let festivalPersonId;
  let searched = 0;
  for (const cell of world.cells) {
    const limit = cell.population < 1_000_000n ? cell.population : 1_000_000n;
    for (let ordinal = 0n; ordinal < limit; ordinal += 1n) {
      const candidate = manifestation.personIdAt(cell.id, ordinal);
      searched += 1;
      if (
        encodedPersonValue(candidate) < Number(graph.festival.peakAttendance)
      ) {
        festivalPersonId = candidate;
        break;
      }
      if (searched >= 2_000_000) break;
    }
    if (festivalPersonId || searched >= 2_000_000) break;
  }
  if (!festivalPersonId)
    throw new Error("missing deterministic festival participant");

  const output = {
    schemaVersion: 1,
    worldHash: world.worldHash,
    eventHash: genesis.eventHash,
    personId,
    trace,
    closure: {
      personId: closurePersonId,
      edgeId: signatureEdgeId,
      points: [7, 8, 9].map((tick) =>
        summary(
          itinerary.queryPerson(closurePersonId, BigInt(tick), stateAt(tick)),
        ),
      ),
    },
    festival: {
      personId: festivalPersonId,
      searchedIds: searched,
      points: [17, 18, 19, 20, 21, 22].map((tick) =>
        summary(
          itinerary.queryPerson(festivalPersonId, BigInt(tick), stateAt(tick)),
        ),
      ),
    },
  };
  console.log(JSON.stringify(output, null, 2));
} finally {
  await vite.close();
}
