import { createServer } from "vite";

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
try {
  const { createManifestationIndex } = await vite.ssrLoadModule(
    "/packages/manifest/src/person.ts",
  );
  const { generateWorld, BASELINE_WORLD_SEED } = await vite.ssrLoadModule(
    "/packages/sim/src/world.ts",
  );
  const world = generateWorld(BASELINE_WORLD_SEED);
  const index = createManifestationIndex(world);
  const cellId = world.settlements[0]?.cellId;
  if (!cellId) throw new Error("missing golden manifestation cell");
  const personId = index.personIdAt(cellId, 42n);
  const card = index.person(personId);
  console.log(
    JSON.stringify(
      {
        worldHash: world.worldHash,
        personId,
        semanticHash: card.semanticHash,
        householdId: card.household.id,
        primaryPlaceId: card.primaryPlace.id,
        householdMembers: index.householdMembers(card.household.id),
        relationships: index.relationships(personId),
      },
      null,
      2,
    ),
  );
} finally {
  await vite.close();
}
