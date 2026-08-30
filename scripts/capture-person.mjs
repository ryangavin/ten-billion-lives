import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";

const outputDirectory = "docs/evidence/issue-11";
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
for (const name of [
  "Enter Brindle Bay",
  "Enter Harbor Street",
  "Meet a resident",
  "Initialize observer B",
])
  await page.getByRole("button", { name }).click();
await page.locator(".observer-grid").screenshot({
  path: `${outputDirectory}/procedural-person-two-observers.png`,
});
await browser.close();
console.log(`Wrote procedural person screenshot to ${outputDirectory}`);
