import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";

const outputDirectory = "docs/evidence/issue-15";
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1400 },
});
const page = await context.newPage();
await page.goto("http://127.0.0.1:4173/?renderer=canvas", {
  waitUntil: "networkidle",
});
await page.getByRole("button", { name: "Visit Lantern Tide" }).click();
await page.getByRole("button", { name: "Initialize observer B" }).click();
await page.locator(".observer-grid").screenshot({
  path: `${outputDirectory}/festival-peak.png`,
});
await page
  .getByRole("button", { name: "Tick 21 · festival departure" })
  .click();
await page.locator(".observer-grid").screenshot({
  path: `${outputDirectory}/festival-departure.png`,
});
await page.getByRole("button", { name: "Tick 10 · recurring meeting" }).click();
await page.locator(".observer-grid").screenshot({
  path: `${outputDirectory}/recurring-meeting.png`,
});
await page.getByRole("button", { name: "Explore closure branch" }).click();
await page.locator(".observer-grid").screenshot({
  path: `${outputDirectory}/closure-person.png`,
});
await page.locator(".branch-comparison").screenshot({
  path: `${outputDirectory}/closure-comparison.png`,
});
const href = await page.getByTestId("person-deep-link").getAttribute("href");
if (!href) throw new Error("capture deep link unavailable");
const fresh = await context.newPage();
await fresh.goto(href, { waitUntil: "networkidle" });
await fresh.locator(".person-tools").screenshot({
  path: `${outputDirectory}/fresh-deep-link.png`,
});
const invalid = await context.newPage();
await invalid.goto(
  "http://127.0.0.1:4173/?schema=2&seed=ten-billion-lives%2Fbaseline%2Fv1&tick=10&person=person_0000a4q_0yrj2dd&branch=baseline",
  { waitUntil: "networkidle" },
);
await invalid.locator(".smoke-error").screenshot({
  path: `${outputDirectory}/invalid-link-recovery.png`,
});
await browser.close();
console.log(`Wrote experience screenshots to ${outputDirectory}`);
