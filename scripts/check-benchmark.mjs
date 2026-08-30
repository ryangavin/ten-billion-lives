import { readFile } from "node:fs/promises";

import { evaluateBudgets } from "../packages/testkit/src/regression.ts";

const resultPath = process.argv[2] ?? "benchmarks/results/local-baseline.json";
const [result, budgetDocument] = await Promise.all([
  readFile(resultPath, "utf8").then(JSON.parse),
  readFile("benchmarks/budgets.json", "utf8").then(JSON.parse),
]);

const failures = evaluateBudgets(result.metrics, budgetDocument.catastrophic);

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Benchmark regression check passed: ${resultPath}`);
}
