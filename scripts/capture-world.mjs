import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";

const outputDirectory = "docs/evidence/issue-7";
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Inspect debug world" }).click();
await page.getByTestId("debug-globe").scrollIntoViewIfNeeded();
await page.screenshot({
  path: `${outputDirectory}/world-debug-seam.png`,
  fullPage: true,
});

await page.getByRole("button", { name: "L2 regions" }).click();
await page.getByRole("button", { name: "Inspect north pole" }).click();
await page.getByTestId("debug-globe").scrollIntoViewIfNeeded();
await page.screenshot({
  path: `${outputDirectory}/world-debug-pole-l2.png`,
  fullPage: true,
});

await browser.close();
console.log(`Wrote world screenshots to ${outputDirectory}`);
