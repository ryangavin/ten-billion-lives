import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

const root = process.cwd();
const documentationFiles = [
  "README.md",
  "CONTRIBUTING.md",
  "docs/ARCHITECTURE.md",
  "docs/BENCHMARKS.md",
  "docs/COMPATIBILITY.md",
  "docs/CONCEPT.md",
  "docs/DEPENDENCIES.md",
  "docs/DETERMINISM.md",
  "docs/FORMATS.md",
  "docs/LIMITATIONS.md",
  "docs/PRODUCT.md",
  "docs/QUICKSTART.md",
  "docs/TESTING.md",
];
const rootPackage = JSON.parse(readFileSync(resolve(root, "package.json")));
const errors = [];

function anchorFor(heading) {
  return heading
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function anchorsIn(markdown) {
  const anchors = new Set();
  const counts = new Map();
  for (const match of markdown.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = anchorFor(match[1] ?? "");
    const count = counts.get(base) ?? 0;
    anchors.add(count === 0 ? base : `${base}-${count}`);
    counts.set(base, count + 1);
  }
  return anchors;
}

function validateLink(sourceFile, rawTarget) {
  if (
    rawTarget.startsWith("http://") ||
    rawTarget.startsWith("https://") ||
    rawTarget.startsWith("mailto:")
  )
    return;
  const decoded = decodeURIComponent(rawTarget);
  const [pathname = "", fragment = ""] = decoded.split("#", 2);
  const targetPath = pathname
    ? resolve(root, dirname(sourceFile), pathname)
    : resolve(root, sourceFile);
  if (!existsSync(targetPath)) {
    errors.push(`${sourceFile}: missing local link target ${rawTarget}`);
    return;
  }
  if (fragment && extname(targetPath).toLowerCase() === ".md") {
    const anchors = anchorsIn(readFileSync(targetPath, "utf8"));
    if (!anchors.has(fragment.toLowerCase()))
      errors.push(`${sourceFile}: missing heading fragment ${rawTarget}`);
  }
}

function validateShell(sourceFile, markdown) {
  for (const block of markdown.matchAll(/```(?:sh|bash)\n([\s\S]*?)```/g)) {
    for (const rawLine of (block[1] ?? "").split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || line.endsWith("\\")) continue;
      if (line.startsWith("$ ")) {
        errors.push(`${sourceFile}: shell snippets must omit prompt markers`);
        continue;
      }
      const words = line.split(/\s+/);
      if (words[0] === "pnpm") {
        let command = words[1];
        if (command === "run") command = words[2];
        if (
          command &&
          !["install", "exec", "licenses", "--filter"].includes(command) &&
          rootPackage.scripts[command] === undefined
        )
          errors.push(`${sourceFile}: unknown pnpm script ${command}`);
      } else if (words[0] === "node" && words[1]?.startsWith("scripts/")) {
        if (!existsSync(resolve(root, words[1])))
          errors.push(`${sourceFile}: missing script ${words[1]}`);
      } else if (
        !["cd", "corepack", "git", "nvm", "open"].includes(words[0] ?? "")
      ) {
        errors.push(`${sourceFile}: unsupported shell snippet ${line}`);
      }
    }
  }
}

for (const file of documentationFiles) {
  const absolute = resolve(root, file);
  if (!existsSync(absolute)) {
    errors.push(`missing required documentation file ${file}`);
    continue;
  }
  const markdown = readFileSync(absolute, "utf8");
  for (const match of markdown.matchAll(/!?(?:\[[^\]]*\])\(([^)]+)\)/g))
    validateLink(file, match[1] ?? "");
  validateShell(file, markdown);
  const diagrams = [...markdown.matchAll(/```mermaid\n[\s\S]*?```/g)];
  for (const diagram of diagrams) {
    const following = markdown.slice(
      (diagram.index ?? 0) + (diagram[0]?.length ?? 0),
      (diagram.index ?? 0) + (diagram[0]?.length ?? 0) + 900,
    );
    if (!/\*\*Text alternative:\*\*/.test(following))
      errors.push(`${file}: Mermaid diagram lacks a nearby text alternative`);
  }
}

const requiredSections = {
  "README.md": [
    "## What it demonstrates",
    "## Quickstart",
    "## Known limitations",
    "## Documentation",
  ],
  "docs/QUICKSTART.md": [
    "## Clean checkout",
    "## Guided local demo",
    "## Troubleshooting",
  ],
  "docs/TESTING.md": ["## Local validation", "## Evidence workflow"],
  "docs/LIMITATIONS.md": ["## Claims", "## Non-claims"],
};
for (const [file, headings] of Object.entries(requiredSections)) {
  const markdown = existsSync(resolve(root, file))
    ? readFileSync(resolve(root, file), "utf8")
    : "";
  for (const heading of headings)
    if (!markdown.includes(heading)) errors.push(`${file}: missing ${heading}`);
}

const architecture = existsSync(resolve(root, "docs/ARCHITECTURE.md"))
  ? readFileSync(resolve(root, "docs/ARCHITECTURE.md"), "utf8")
  : "";
for (const term of [
  "## Simulation equations",
  "packages/sim",
  "packages/manifest",
  "packages/render",
  "packages/testkit",
  "apps/web",
])
  if (!architecture.includes(term))
    errors.push(`docs/ARCHITECTURE.md: missing ${term}`);

const allProse = documentationFiles
  .filter((file) => existsSync(resolve(root, file)))
  .map((file) => readFileSync(resolve(root, file), "utf8"))
  .join("\n");
for (const pattern of [
  /(?:^|[.!?]\s+)(?:we |the app )?(?:run|runs|execute|executes|simulate|simulates) ten billion (?:independent )?(?:minds|agents)/i,
  /software (?:proves|demonstrates) (?:a )?physical (?:law|theory|reality)/i,
])
  if (pattern.test(allProse))
    errors.push(`claim consistency violation: ${pattern}`);

const dependencyDocumentation = existsSync(
  resolve(root, "docs/DEPENDENCIES.md"),
)
  ? readFileSync(resolve(root, "docs/DEPENDENCIES.md"), "utf8").replace(
      /\s+/g,
      " ",
    )
  : "";
for (const [name] of Object.entries(rootPackage.devDependencies)) {
  const manifestPath = resolve(root, "node_modules", name, "package.json");
  if (!existsSync(manifestPath)) {
    errors.push(`dependency is not installed: ${name}`);
    continue;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const row = `| \`${name}\` | \`${manifest.version}\` | ${manifest.license} |`;
  if (!dependencyDocumentation.includes(row))
    errors.push(
      `docs/DEPENDENCIES.md: expected installed version/license row ${row}`,
    );
}
for (const packageFile of [
  "apps/web/package.json",
  "packages/manifest/package.json",
  "packages/render/package.json",
  "packages/sim/package.json",
  "packages/testkit/package.json",
]) {
  const manifest = JSON.parse(readFileSync(resolve(root, packageFile), "utf8"));
  for (const dependency of Object.keys(manifest.dependencies ?? {}))
    if (!dependency.startsWith("@ten-billion-lives/"))
      errors.push(`${packageFile}: unaccounted external runtime ${dependency}`);
}

assert.deepEqual(
  errors,
  [],
  `Documentation check failed:\n${errors.join("\n")}`,
);
console.log(
  `Documentation check passed: ${documentationFiles.length} files, local links, shell snippets, diagram alternatives, claims, and dependency inventory.`,
);
