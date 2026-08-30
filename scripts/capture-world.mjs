import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";

const outputDirectory = "docs/evidence/issue-7";
const fieldOutputDirectory = "docs/evidence/issue-8";
const transportOutputDirectory = "docs/evidence/issue-9";
const checkpointOutputDirectory = "docs/evidence/issue-10";
await mkdir(outputDirectory, { recursive: true });
await mkdir(fieldOutputDirectory, { recursive: true });
await mkdir(transportOutputDirectory, { recursive: true });
await mkdir(checkpointOutputDirectory, { recursive: true });

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

await page.getByRole("button", { name: "Single-step" }).click();
await page.locator("#field-debug-title").scrollIntoViewIfNeeded();
await page.screenshot({
  path: `${fieldOutputDirectory}/field-channels-flux.png`,
  fullPage: true,
});

const transportPanel = page.locator(".transport-debug");
await transportPanel.screenshot({
  path: `${transportOutputDirectory}/route-closed-tick7.png`,
});
await page.getByRole("button", { name: "Tick 9 · reopened" }).click();
await transportPanel.screenshot({
  path: `${transportOutputDirectory}/route-reopened-tick9.png`,
});
await page.getByRole("button", { name: "Tick 19 · festival" }).click();
await transportPanel.screenshot({
  path: `${transportOutputDirectory}/festival-peak-tick19.png`,
});
await page.getByRole("button", { name: "Save and restore checkpoint" }).click();
await page.locator(".checkpoint-debug").screenshot({
  path: `${checkpointOutputDirectory}/checkpoint-restored.png`,
});

await browser.close();
console.log(`Wrote world screenshots to ${outputDirectory}`);
