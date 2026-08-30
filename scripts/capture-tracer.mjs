import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";

const outputDirectory = "docs/evidence/issue-5";
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
await page.screenshot({
  path: `${outputDirectory}/tracer-planet.png`,
  fullPage: true,
});

for (const name of [
  "Enter Brindle Bay",
  "Enter Harbor Street",
  "Meet Ari Vale",
  "Initialize observer B",
  "Rewind and replay",
  "Reveal fields",
]) {
  await page.getByRole("button", { name }).click();
}

await page.screenshot({
  path: `${outputDirectory}/tracer-two-observers.png`,
  fullPage: true,
});
await browser.close();
console.log(`Wrote tracer screenshots to ${outputDirectory}`);
