import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

import { format } from "prettier";
import { createServer } from "vite";

function screenPoint(point) {
  return [point.eastCm / 100, 1_000 - point.northCm / 100];
}

function pathData(points, close = false) {
  return `${points
    .map((point, index) => {
      const [east, north] = screenPoint(point);
      return `${index === 0 ? "M" : "L"}${east} ${north}`;
    })
    .join(" ")}${close ? " Z" : ""}`;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function shortSemanticId(value) {
  return value.length <= 34
    ? value
    : `${value.slice(0, 24)}…${value.slice(-8)}`;
}

function signatureRoute(city) {
  const household = city.places.find((place) => place.kind === "household");
  const festival = city.places.find((place) => place.kind === "festival");
  if (!household || !festival)
    throw new Error("debug map requires household and festival destinations");
  const edgeById = new Map(city.pedestrianEdges.map((edge) => [edge.id, edge]));
  const nodeById = new Map(city.pedestrianNodes.map((node) => [node.id, node]));
  const previous = new Map();
  const visited = new Set([household.entranceNodeId]);
  const queue = [household.entranceNodeId];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (nodeId === undefined) break;
    if (nodeId === festival.entranceNodeId) break;
    const node = nodeById.get(nodeId);
    for (const edgeId of node?.adjacentEdgeIds ?? []) {
      const edge = edgeById.get(edgeId);
      if (!edge) continue;
      const next = edge.fromNodeId === nodeId ? edge.toNodeId : edge.fromNodeId;
      if (visited.has(next)) continue;
      visited.add(next);
      previous.set(next, { nodeId, edgeId });
      queue.push(next);
    }
  }
  if (!visited.has(festival.entranceNodeId))
    throw new Error("signature city route is unreachable");
  const route = [];
  let cursor = festival.entranceNodeId;
  while (cursor !== household.entranceNodeId) {
    const step = previous.get(cursor);
    if (!step) throw new Error("signature city route reconstruction failed");
    route.push(edgeById.get(step.edgeId));
    cursor = step.nodeId;
  }
  return route.reverse();
}

function debugSvg(city) {
  const signature = signatureRoute(city);
  const spaceColor = {
    park: "#94ad74",
    plaza: "#e9bb68",
    "transit-square": "#a9c6ca",
    waterfront: "#79a9c2",
  };
  const buildingLayers = city.buildings
    .map(
      (building) =>
        `<path d="${pathData(building.footprint, true)}" fill="#c7b49b" stroke="#503f34" stroke-width="3"><title>${escapeXml(building.id)}</title></path>`,
    )
    .join("");
  const spaceLayers = city.publicSpaces
    .map(
      (space) =>
        `<path d="${pathData(space.boundary, true)}" fill="${spaceColor[space.kind]}" stroke="#334b4c" stroke-width="3"><title>${escapeXml(space.id)}</title></path>`,
    )
    .join("");
  const roadLayers = city.roads
    .map(
      (road) =>
        `<path d="${pathData(road.centerline)}" fill="none" stroke="#35404a" stroke-width="${road.widthCm / 100}" stroke-linecap="square"><title>${escapeXml(road.name)}</title></path>`,
    )
    .join("");
  const sidewalkLayers = city.sidewalks
    .map(
      (sidewalk) =>
        `<path d="${pathData(sidewalk.path)}" fill="none" stroke="#f1eadb" stroke-width="${sidewalk.widthCm / 100}" stroke-linecap="round"><title>${escapeXml(sidewalk.id)}</title></path>`,
    )
    .join("");
  const crossingLayers = city.crossings
    .map(
      (crossing) =>
        `<path d="${pathData(crossing.path)}" fill="none" stroke="#fff6cf" stroke-width="${crossing.widthCm / 100}" stroke-dasharray="8 6"><title>${escapeXml(crossing.id)}</title></path>`,
    )
    .join("");
  const graphLayers = city.pedestrianEdges
    .map(
      (edge) =>
        `<path d="${pathData(edge.path)}" fill="none" stroke="#0c7c78" stroke-width="2" opacity="0.7"><title>${escapeXml(edge.id)}</title></path>`,
    )
    .join("");
  const routeLayer = signature
    .map(
      (edge) =>
        `<path d="${pathData(edge.path)}" fill="none" stroke="#f15a24" stroke-width="6" stroke-linecap="round"/>`,
    )
    .join("");
  const nodeLayers = city.pedestrianNodes
    .map((node) => {
      const [east, north] = screenPoint(node.position);
      return `<circle cx="${east}" cy="${north}" r="3" fill="#073b4c"><title>${escapeXml(node.id)}</title></circle>`;
    })
    .join("");
  const labelLayout = {
    community: { east: 10, north: -12, anchor: "start" },
    festival: { east: 10, north: -12, anchor: "start" },
    household: { east: 10, north: -12, anchor: "start" },
    school: { east: 10, north: -12, anchor: "start" },
    service: { east: -10, north: -30, anchor: "end" },
    transport: { east: 10, north: -12, anchor: "start" },
    workplace: { east: -10, north: -30, anchor: "end" },
  };
  const placeLabels = city.places
    .map((place) => {
      const node = city.pedestrianNodes.find(
        (candidate) => candidate.id === place.entranceNodeId,
      );
      if (!node)
        throw new Error(`missing debug-map node: ${place.entranceNodeId}`);
      const [east, north] = screenPoint(node.position);
      const layout = labelLayout[place.kind];
      const labelEast = east + layout.east;
      const labelNorth = north + layout.north;
      return `<g><title>${escapeXml(place.id)}</title><circle cx="${east}" cy="${north}" r="8" fill="#fff" stroke="#b23722" stroke-width="4"/><text x="${labelEast}" y="${labelNorth}" text-anchor="${layout.anchor}" class="place">${escapeXml(place.name)}</text><text x="${labelEast}" y="${labelNorth + 14}" text-anchor="${layout.anchor}" class="semantic">${escapeXml(place.kind)} · ${escapeXml(shortSemanticId(place.id))}</text></g>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1000" viewBox="0 0 1200 1000" role="img" aria-labelledby="title description">
  <title id="title">Brindle Bay deterministic city debug map</title>
  <desc id="description">Top-down debug projection showing city bounds, waterfront, blocks, roads, sidewalks, crossings, public spaces, connected pedestrian nodes and edges, seven semantic anchors, and the household-to-Lantern-Tide signature route.</desc>
  <style>
    text { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; fill: #182126; paint-order: stroke; stroke: #fff; stroke-width: 3px; stroke-linejoin: round; }
    .place { font-size: 14px; font-weight: 700; }
    .semantic { font-size: 10px; stroke-width: 2px; }
    .legend { font-size: 13px; stroke-width: 2px; }
  </style>
  <rect width="1200" height="1000" fill="#e7dfcf"/>
  ${spaceLayers}
  ${roadLayers}
  ${sidewalkLayers}
  ${crossingLayers}
  ${buildingLayers}
  ${graphLayers}
  ${routeLayer}
  ${nodeLayers}
  ${placeLabels}
  <g transform="translate(18 24)"><rect width="390" height="72" rx="7" fill="#fff" opacity="0.92"/><text x="12" y="22" class="place">Brindle Bay · schema 1 · centimeters</text><text x="12" y="42" class="legend">orange: signature route · teal: pedestrian topology</text><text x="12" y="61" class="legend">cityHash ${city.cityHash}</text></g>
</svg>
`;
}

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
try {
  const { createCityProjection } = await vite.ssrLoadModule(
    "/packages/manifest/src/city.ts",
  );
  const { BASELINE_WORLD_SEED } = await vite.ssrLoadModule(
    "/packages/sim/src/world.ts",
  );
  const city = createCityProjection({
    schema: 1,
    seed: BASELINE_WORLD_SEED,
    settlementId: "place/brindle-bay",
  });
  const json = await format(JSON.stringify(city), { parser: "json" });
  const svg = debugSvg(city);
  if (process.argv.includes("--write")) {
    await mkdir("docs/evidence/issue-30", { recursive: true });
    await writeFile("packages/manifest/fixtures/city-golden-v1.json", json);
    await writeFile("docs/evidence/issue-30/city-debug-map.svg", svg);
    console.log(
      JSON.stringify(
        {
          cityHash: city.cityHash,
          fixtureSha256: createHash("sha256").update(json).digest("hex"),
          debugSvgSha256: createHash("sha256").update(svg).digest("hex"),
          roads: city.roads.length,
          buildings: city.buildings.length,
          places: city.places.length,
          pedestrianNodes: city.pedestrianNodes.length,
          pedestrianEdges: city.pedestrianEdges.length,
          signatureRouteEdgeIds: signatureRoute(city).map(({ id }) => id),
        },
        null,
        2,
      ),
    );
  } else {
    process.stdout.write(json);
  }
} finally {
  await vite.close();
}
