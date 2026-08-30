import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";

const outputDirectory = "docs/evidence/issue-14";
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1500 } });
await page.goto("http://127.0.0.1:4173/?renderer=canvas", {
  waitUntil: "networkidle",
});
await page.getByRole("button", { name: "Reveal fields" }).click();
await page.locator(".reality-budget").screenshot({
  path: `${outputDirectory}/planet-reality-budget.png`,
});
for (const name of [
  "Enter Brindle Bay",
  "Enter Harbor Street",
  "Meet a resident",
  "Initialize observer B",
])
  await page.getByRole("button", { name }).click();
await page.locator(".observer-grid").screenshot({
  path: `${outputDirectory}/two-observer-hashes.png`,
});
await page.getByRole("button", { name: "View planet" }).click();
await page.getByRole("button", { name: "View person" }).click();
await page.getByRole("button", { name: "Tick 24 · identity epoch" }).click();
await page.locator(".observer-grid").screenshot({
  path: `${outputDirectory}/epoch-reentry.png`,
});
await page.locator(".reality-budget").screenshot({
  path: `${outputDirectory}/epoch-reality-budget.png`,
});
await browser.close();
console.log(`Wrote projection screenshots to ${outputDirectory}`);
