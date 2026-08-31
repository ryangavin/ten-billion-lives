import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const contractPath = "docs/LIVING_CITY.md";
const wireframePath = "docs/evidence/issue-29/living-city-wireframe.svg";
const evidencePath = "docs/evidence/issue-29/README.md";

await Promise.all(
  [contractPath, wireframePath, evidencePath].map((file) => access(file)),
);

const [contract, wireframe, evidence, architecture, product, limitations] =
  await Promise.all([
    readFile(contractPath, "utf8"),
    readFile(wireframePath, "utf8"),
    readFile(evidencePath, "utf8"),
    readFile("docs/ARCHITECTURE.md", "utf8"),
    readFile("docs/PRODUCT.md", "utf8"),
    readFile("docs/LIMITATIONS.md", "utf8"),
  ]);

const requiredSections = [
  "# Living-city contract",
  "## Falsifiable product target",
  "## Storyboard and visual direction",
  "## Frozen semantic interfaces",
  "## Presentation-time and playback rules",
  "## Renderer, picking, and accessibility boundaries",
  "## Weighted crowd honesty",
  "## Package and path ownership",
  "## Evidence and benchmark contract",
  "## Risk register and fallbacks",
  "## Non-claims and rejected directions",
];

for (const section of requiredSections)
  assert.ok(
    contract.includes(section),
    `missing living-city section: ${section}`,
  );

for (const token of [
  "CityProjection",
  "VisualTime",
  "PedestrianTrajectoryQuery",
  "LivingCityScene",
  "PickResult",
  "LivingCitySummary",
  "phasePermillion",
  "trajectoryHash",
  "cityHash",
  "simulated minutes per real second",
  "#30",
  "#31",
  "#32",
  "#33",
  "#36",
  "#37",
])
  assert.ok(
    contract.includes(token),
    `missing living-city contract token: ${token}`,
  );

for (const forbidden of ["remote tiles", "1,440 authoritative ticks"])
  assert.ok(
    contract.includes(forbidden),
    `missing explicit rejected direction: ${forbidden}`,
  );

assert.ok(wireframe.includes("<svg") && wireframe.includes("</svg>"));
for (const label of [
  "Brindle Bay",
  "Sidewalk",
  "Lantern Tide",
  "Selected person",
])
  assert.ok(
    wireframe.includes(label),
    `wireframe must visibly include: ${label}`,
  );
assert.ok(
  evidence.includes("## Original-resolution inspection") &&
    evidence.includes("## Baseline validation"),
  "issue #29 evidence must retain visual inspection and baseline validation",
);
assert.ok(
  architecture.includes("living-city contract") &&
    product.includes("living-city contract") &&
    limitations.includes("presentation phase"),
  "architecture, product, and limitations docs must link the frozen contract",
);

const riskRows = contract
  .split("\n")
  .filter((line) => /^\| [^:-].*\|/.test(line) && line.includes("#"));
assert.ok(
  riskRows.length >= 8,
  "risk/ownership tables must identify at least eight issue-owned falsifiers",
);

console.log("Living-city contract check passed.");
