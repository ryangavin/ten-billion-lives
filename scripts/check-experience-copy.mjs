import { readFile } from "node:fs/promises";

const source = await readFile("apps/web/src/main.ts", "utf8");
const required = [
  "represented lives",
  "Procedural identity, not a stored agent",
  "represented from compact fields—not an independently simulated mind",
  "0 person rows",
  "Immutable baseline",
  "Closure branch",
  "never mutates the baseline checkpoint",
];
const forbidden = [
  "10 billion simulated minds",
  "10 billion conscious",
  "sentient agents",
];
const missing = required.filter((phrase) => !source.includes(phrase));
const unsafe = forbidden.filter((phrase) => source.includes(phrase));
if (missing.length > 0 || unsafe.length > 0)
  throw new Error(
    `experience copy failed: missing [${missing.join(", ")}], forbidden [${unsafe.join(", ")}]`,
  );
console.log(
  `Experience copy check passed: ${required.length} claims present, ${forbidden.length} misleading claims absent.`,
);
