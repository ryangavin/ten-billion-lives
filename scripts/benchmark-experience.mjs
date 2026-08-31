import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { chromium } from "@playwright/test";

import { startProductionPreview } from "./lib/production-preview.mjs";

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))
  ];
}

async function setEvidenceDrawer(page, open) {
  await page.locator("details.evidence-drawer").evaluate((drawer, value) => {
    drawer.open = value;
    drawer.dispatchEvent(new Event("toggle"));
  }, open);
}

async function waitForPerson(page) {
  await page.waitForFunction(
    () =>
      globalThis.document
        .querySelector('[data-testid="observer-a-person-id"]')
        ?.textContent?.startsWith("person_") === true,
  );
}

const preview = await startProductionPreview();
try {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  let started = performance.now();
  await page.goto(preview.url, { waitUntil: "networkidle" });
  for (const name of [
    "Enter Brindle Bay",
    "Enter Harbor Street",
    "Meet a resident",
  ])
    await page.getByRole("button", { name }).click();
  await waitForPerson(page);
  const planetToPersonMs = performance.now() - started;

  const followSamples = [];
  for (const tick of ["7", "19", "23", "10"]) {
    started = performance.now();
    await page
      .getByRole("combobox", { name: "Signature moment" })
      .selectOption(tick);
    await page.waitForFunction(
      (expected) =>
        globalThis.document.querySelector('[data-testid="person-tick"]')
          ?.textContent === expected,
      tick,
    );
    followSamples.push(performance.now() - started);
  }

  await setEvidenceDrawer(page, true);
  started = performance.now();
  await page.getByRole("button", { name: "Initialize observer B" }).click();
  await page.waitForFunction(
    () =>
      globalThis.document.querySelector('[data-testid="observer-match"]')
        ?.textContent === "Semantic match · trajectory match",
  );
  const initializeSecondObserverMs = performance.now() - started;
  const personHref = await page
    .getByTestId("person-deep-link")
    .getAttribute("href");
  if (!personHref) throw new Error("person experience link unavailable");

  const secondPage = await context.newPage();
  started = performance.now();
  await secondPage.goto(personHref, { waitUntil: "networkidle" });
  await waitForPerson(secondPage);
  const freshDeepLinkLoadMs = performance.now() - started;
  await secondPage.close();
  await setEvidenceDrawer(page, false);
  await page.getByRole("button", { name: "Visit Lantern Tide" }).click();
  const festivalEvidence = {
    personId: await page.getByTestId("observer-a-person-id").textContent(),
    itinerary: await page.getByTestId("observer-a-itinerary").textContent(),
    events: await page.getByTestId("semantic-events-a").textContent(),
  };
  await page
    .getByRole("combobox", { name: "Signature moment" })
    .selectOption("21");
  festivalEvidence.departure = await page
    .getByTestId("observer-a-route")
    .textContent();
  await page.getByRole("button", { name: "Explore closure branch" }).click();
  const closureEvidence = {
    activeBranch: await page.getByTestId("active-branch").textContent(),
    personId: await page.getByTestId("observer-a-person-id").textContent(),
    baselineRoute: await page.getByTestId("baseline-route").textContent(),
    closureRoute: await page.getByTestId("closure-route").textContent(),
    fieldComparison: await page.getByTestId("branch-field-match").textContent(),
    travelerRoute: await page.getByTestId("observer-a-route").textContent(),
  };
  await page.requestGC();
  const browserHeapMiB = await page.evaluate(
    () => performance.memory?.usedJSHeapSize / 1_048_576 || 0,
  );
  const browserVersion = await browser.version();
  await browser.close();

  const metrics = {
    planetToPersonMs,
    followTickP50Ms: percentile(followSamples, 0.5),
    followTickP95Ms: percentile(followSamples, 0.95),
    initializeSecondObserverMs,
    freshDeepLinkLoadMs,
    browserHeapMiB,
  };
  const budgets = {
    planetToPersonMsMax: 10_000,
    followTickP95MsMax: 3_000,
    initializeSecondObserverMsMax: 3_500,
    freshDeepLinkLoadMsMax: 5_000,
    browserHeapMiBMax: 128,
  };
  const failures = [];
  if (metrics.planetToPersonMs > budgets.planetToPersonMsMax)
    failures.push("planetToPersonMs");
  if (metrics.followTickP95Ms > budgets.followTickP95MsMax)
    failures.push("followTickP95Ms");
  if (
    metrics.initializeSecondObserverMs > budgets.initializeSecondObserverMsMax
  )
    failures.push("initializeSecondObserverMs");
  if (metrics.freshDeepLinkLoadMs > budgets.freshDeepLinkLoadMsMax)
    failures.push("freshDeepLinkLoadMs");
  if (metrics.browserHeapMiB > budgets.browserHeapMiBMax)
    failures.push("browserHeapMiB");
  process.stdout.write(
    `${JSON.stringify({ metrics, budgets, failures }, null, 2)}\n`,
  );
  if (failures.length > 0)
    throw new Error(`person experience budgets failed: ${failures.join(", ")}`);

  const result = {
    schemaVersion: 1,
    benchmarkVersion: "local-person-experience-v1",
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    browser: browserVersion,
    seed: "ten-billion-lives/baseline/v1",
    workload: {
      productionBuild: true,
      independentlyInitializedObservers: 2,
      followQueries: followSamples.length,
      retainedPersonRows: 0,
      deepLink: personHref,
      budgetBasis:
        "M4 integrated production scene; issue #36 measured amendment recorded after profiling the formerly pre-M4 experience workload",
    },
    metrics,
    semanticEvidence: {
      festival: festivalEvidence,
      closure: closureEvidence,
    },
    budgets: { ...budgets, passed: true },
  };
  await writeFile(
    "benchmarks/results/person-experience.json",
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await preview.close();
}
