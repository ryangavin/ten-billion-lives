import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";

const outputDirectory = "docs/evidence/issue-12";
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1300 } });
await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
for (const name of [
  "Enter Brindle Bay",
  "Enter Harbor Street",
  "Meet a resident",
  "Initialize observer B",
])
  await page.getByRole("button", { name }).click();
await page.locator(".observer-grid").screenshot({
  path: `${outputDirectory}/work-encounters-two-observers.png`,
});
await page.getByRole("button", { name: "Tick 7 · commute" }).click();
await page.locator(".observer-grid").screenshot({
  path: `${outputDirectory}/commute-two-observers.png`,
});
await browser.close();
console.log(`Wrote itinerary screenshots to ${outputDirectory}`);
