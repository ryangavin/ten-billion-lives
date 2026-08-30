import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";

const outputDirectory = "docs/evidence/issue-13";
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "no-preference",
});
const page = await context.newPage();
const settleRenderer = async () => {
  await page.getByTestId("journey-renderer").evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished),
    );
  });
};
await page.goto("http://127.0.0.1:4173/?renderer=canvas", {
  waitUntil: "networkidle",
});
await page.getByTestId("render-backend").waitFor();
await settleRenderer();
await page.locator(".tracer-world").screenshot({
  path: `${outputDirectory}/lod-planet.png`,
});
await page.getByRole("button", { name: "Enter Brindle Bay" }).click();
await settleRenderer();
await page.locator(".tracer-world").screenshot({
  path: `${outputDirectory}/lod-region.png`,
});
await page.getByRole("button", { name: "Enter Harbor Street" }).click();
await settleRenderer();
await page.locator(".tracer-world").screenshot({
  path: `${outputDirectory}/lod-street.png`,
});
await page.getByRole("button", { name: "Meet a resident" }).click();
await settleRenderer();
await page.locator(".tracer-world").screenshot({
  path: `${outputDirectory}/lod-person.png`,
});
await page.getByRole("button", { name: "Simulate renderer loss" }).click();
await page.locator(".tracer-world").screenshot({
  path: `${outputDirectory}/context-loss-fallback.png`,
});
await browser.close();
console.log(`Wrote renderer screenshots to ${outputDirectory}`);
