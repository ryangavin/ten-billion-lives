import { access, readFile } from "node:fs/promises";

await access("docs/ARCHITECTURE.md");

const [architecture, readme] = await Promise.all([
  readFile("docs/ARCHITECTURE.md", "utf8"),
  readFile("README.md", "utf8"),
]);

const requiredSections = [
  "# Local architecture contract",
  "## Invariants and authority",
  "## Deterministic world evolution",
  "## Pure manifestation and identity",
  "## Two-observer semantic contract",
  "## Snapshot and replay compatibility",
  "## Package boundaries",
  "## Data flow",
  "## Rendering and LOD",
  "## Sparse events and interventions",
  "## Risk register and validation owners",
  "## Rejected alternatives",
  "## Out of scope",
];

for (const section of requiredSections) {
  if (!architecture.includes(section)) {
    throw new Error(`docs/ARCHITECTURE.md is missing required section: ${section}`);
  }
}

const requiredContracts = [
  "S[t+1] = evolve(S[t], commands[t])",
  "V = manifest(seed, checkpoint, region, tick, lod)",
  "10,000,000,000",
  "camera",
  "stateHash",
  "eventHash",
  "WebSocket",
  "#27",
];

for (const contract of requiredContracts) {
  if (!architecture.includes(contract)) {
    throw new Error(`docs/ARCHITECTURE.md is missing required contract: ${contract}`);
  }
}

if (!readme.includes("docs/ARCHITECTURE.md")) {
  throw new Error("README.md does not link to docs/ARCHITECTURE.md");
}

console.log("Architecture contract check passed.");
