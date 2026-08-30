import { writeFile } from "node:fs/promises";

import {
  advanceWorldKernel,
  createWorldKernel,
  restoreWorldKernel,
  serializeWorldKernel,
} from "../packages/sim/dist/checkpoint.js";

const decoder = new TextDecoder();
const encoder = new TextEncoder();
const bytes = serializeWorldKernel(advanceWorldKernel(createWorldKernel(), 4));

function mutate(mutation) {
  const value = JSON.parse(decoder.decode(bytes));
  mutation(value);
  return encoder.encode(JSON.stringify(value));
}

const inputs = [
  { name: "truncated", bytes: bytes.slice(0, bytes.length - 11) },
  {
    name: "corrupt-world-hash",
    bytes: mutate((value) => {
      value.worldHash = "0000000000000000";
    }),
  },
  {
    name: "incompatible-version",
    bytes: mutate((value) => {
      value.checkpointVersion = 999;
    }),
  },
  {
    name: "out-of-order-events",
    bytes: mutate((value) => {
      value.events.reverse();
    }),
  },
];

const cases = inputs.map((input) => {
  try {
    restoreWorldKernel(input.bytes);
    return {
      name: input.name,
      rejected: false,
      error: "accepted invalid input",
    };
  } catch (error) {
    return {
      name: input.name,
      rejected: true,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
});
if (cases.some((item) => !item.rejected))
  throw new Error("an invalid checkpoint was accepted");

const result = {
  schemaVersion: 1,
  checkpointVersion: 1,
  sourceBytes: bytes.length,
  cases,
};
await writeFile(
  "docs/evidence/issue-10/corruption-report.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result, null, 2));
