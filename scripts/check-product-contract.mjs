import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "LICENSE",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "docs/PRODUCT.md",
];

const requiredProductSections = [
  "# Local MVP product contract",
  "## Honest claim and non-claim",
  "## Personas",
  "## Primary five-minute journey",
  "## Secondary journeys",
  "## Signature event and intervention",
  "## Baseline world and continuity",
  "## Terminology",
  "## Success metrics",
  "## Local stopping contract and ownership",
  "## Non-goals",
];

await Promise.all(requiredFiles.map((file) => access(file)));

const [product, readme] = await Promise.all([
  readFile("docs/PRODUCT.md", "utf8"),
  readFile("README.md", "utf8"),
]);

for (const section of requiredProductSections) {
  if (!product.includes(section)) {
    throw new Error(`docs/PRODUCT.md is missing required section: ${section}`);
  }
}

const requiredStatements = [
  "10,000,000,000",
  "does not run ten billion minds",
  "phase:deferred",
  "#27",
];

for (const statement of requiredStatements) {
  if (!product.includes(statement)) {
    throw new Error(`docs/PRODUCT.md is missing required statement: ${statement}`);
  }
}

if (!readme.includes("docs/PRODUCT.md")) {
  throw new Error("README.md does not link to docs/PRODUCT.md");
}

if (!readme.includes("node scripts/check-product-contract.mjs")) {
  throw new Error("README.md does not document the current root local check");
}

console.log("Product contract check passed.");
