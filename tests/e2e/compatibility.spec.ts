import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function reachPerson(page: Page): Promise<void> {
  for (const name of [
    "Enter Brindle Bay",
    "Enter Harbor Street",
    "Meet a resident",
  ])
    await page.getByRole("button", { name }).click();
  await expect(page.getByTestId("observer-a-person-id")).toHaveText(/^person_/);
}

async function setEvidenceDrawer(page: Page, open: boolean): Promise<void> {
  const drawer = page.locator("details.evidence-drawer");
  await drawer.evaluate((element, value) => {
    element.open = value;
    element.dispatchEvent(new Event("toggle"));
  }, open);
  await expect(drawer).toHaveJSProperty("open", open);
}

test("restores keyboard focus and honors reduced motion", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "desktop keyboard");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?renderer=canvas");
  const next = page.getByRole("button", { name: "Enter Brindle Bay" });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Enter Harbor Street" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Meet a resident" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#journey-title")).toBeFocused();
  await expect(page.getByTestId("journey-renderer")).toHaveAttribute(
    "data-transition-ms",
    "0",
  );
  await page.getByRole("button", { name: "View planet" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "View planet" })).toBeFocused();
  await expect(page.getByTestId("observer-a-stage")).toHaveText("Planet");
});

test("previews visible residents without hash drift, follows, scrubs, and exits", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "desktop keyboard");
  await page.goto("/?renderer=canvas&quality=fallback");
  await reachPerson(page);
  const renderer = page.getByTestId("journey-renderer");
  const semanticKey = await renderer.getAttribute("data-projection-key");
  const selectedPersonId = await renderer.getAttribute("data-selection-id");
  await renderer.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("city-preview")).toContainText(
    "Enter to follow",
  );
  await expect(renderer).toHaveAttribute(
    "data-projection-key",
    semanticKey ?? "",
  );
  await expect(renderer).toHaveAttribute(
    "data-selection-id",
    selectedPersonId ?? "",
  );
  const previewPersonId = await renderer.getAttribute("data-preview-person-id");
  expect(previewPersonId).toMatch(/^person_/);
  expect(previewPersonId).not.toBe(selectedPersonId);
  await page.keyboard.press("Enter");
  await expect(renderer).toHaveAttribute(
    "data-selection-id",
    previewPersonId ?? "",
  );
  await page.getByRole("slider", { name: "Seek simulated hour" }).fill("16");
  await expect(page.getByTestId("person-tick")).toHaveText("16");
  await page.getByRole("button", { name: "View planet" }).click();
  await expect(page.getByTestId("observer-a-stage")).toHaveText("Planet");
});

test("has no serious or critical automated accessibility findings", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one canonical axe audit");
  await page.goto("/?renderer=canvas");
  await reachPerson(page);
  await setEvidenceDrawer(page, true);
  await page.getByRole("button", { name: "Initialize observer B" }).click();
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
});

test("supports the complete touch journey, local share, and follow exit", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "touch profile");
  await page.goto("/?renderer=canvas&quality=fallback");
  await page.getByRole("button", { name: "Enter Brindle Bay" }).tap();
  await page.getByRole("button", { name: "Enter Harbor Street" }).tap();
  await page.getByTestId("journey-renderer").tap();
  await expect(page.getByTestId("observer-a-person-id")).toHaveText(/^person_/);
  const viewportLayout = await page.evaluate(() => ({
    scrollHeight: globalThis.document.documentElement.scrollHeight,
    innerHeight: globalThis.innerHeight,
    rendererHeight:
      globalThis.document
        .querySelector('[data-testid="journey-renderer"]')
        ?.getBoundingClientRect().height ?? 0,
    minimumControlHeight: Math.min(
      ...[
        ...globalThis.document.querySelectorAll(".journey-toolbar button"),
      ].map((element) => element.getBoundingClientRect().height),
    ),
  }));
  expect(viewportLayout.scrollHeight).toBeLessThanOrEqual(
    viewportLayout.innerHeight,
  );
  expect(viewportLayout.rendererHeight).toBeGreaterThan(650);
  expect(viewportLayout.minimumControlHeight).toBeGreaterThanOrEqual(44);
  await setEvidenceDrawer(page, true);
  const href = await page.getByTestId("person-deep-link").getAttribute("href");
  expect(href).toContain("person=person_27yi09s_1obkbba");
  await page.getByRole("button", { name: "Copy local link" }).tap();
  await expect(
    page.getByText(/Link copied|Copy unavailable; open the link directly/),
  ).toBeVisible();
  await page.getByTestId("person-deep-link").tap();
  await expect(page).toHaveURL(/person=person_27yi09s_1obkbba/);
  await expect(page.getByTestId("observer-a-stage")).toHaveText("Person");
  await page.getByRole("button", { name: "View planet" }).tap();
  await expect(page.getByTestId("observer-a-stage")).toHaveText("Planet");
  await expect(page.getByTestId("journey-renderer")).toBeVisible();
});

test("preserves semantics through context loss, tab resume, and orientation", async ({
  context,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "desktop resume matrix",
  );
  await page.goto("/?renderer=canvas");
  await reachPerson(page);
  await setEvidenceDrawer(page, true);
  await page.getByRole("button", { name: "Initialize observer B" }).click();
  const before = await page.evaluate(() => ({
    state: globalThis.document.querySelector("[data-testid=state-hash]")
      ?.textContent,
    manifestation: globalThis.document.querySelector(
      "[data-testid=manifestation-hash-a]",
    )?.textContent,
    event: globalThis.document.querySelector(
      "[data-testid=projection-event-hash-a]",
    )?.textContent,
  }));
  await page.getByRole("button", { name: "Simulate renderer loss" }).click();
  const other = await context.newPage();
  await other.goto("/?renderer=canvas");
  await page.bringToFront();
  await page.setViewportSize({ width: 900, height: 600 });
  await page.setViewportSize({ width: 600, height: 900 });
  await expect(page.getByTestId("render-backend")).toHaveText("canvas2d");
  await expect(page.getByTestId("render-context-losses")).toHaveText("1");
  await expect(page.getByTestId("observer-match")).toHaveText(
    "Semantic match · trajectory match",
  );
  const after = await page.evaluate(() => ({
    state: globalThis.document.querySelector("[data-testid=state-hash]")
      ?.textContent,
    manifestation: globalThis.document.querySelector(
      "[data-testid=manifestation-hash-a]",
    )?.textContent,
    event: globalThis.document.querySelector(
      "[data-testid=projection-event-hash-a]",
    )?.textContent,
  }));
  expect(after).toEqual(before);
  await other.close();
});

test("remains legible with forced colors and 200 percent text", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "canonical contrast audit");
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?renderer=canvas&quality=fallback");
  await page.evaluate(() => {
    globalThis.document.documentElement.style.fontSize = "200%";
  });
  await reachPerson(page);
  await setEvidenceDrawer(page, true);
  const layout = await page.evaluate(() => ({
    clientWidth: globalThis.document.documentElement.clientWidth,
    scrollWidth: globalThis.document.documentElement.scrollWidth,
    scrollHeight: globalThis.document.documentElement.scrollHeight,
    innerHeight: globalThis.innerHeight,
    drawer: (() => {
      const bounds = globalThis.document
        .querySelector(".evidence-drawer-body")
        ?.getBoundingClientRect();
      return bounds === undefined
        ? null
        : { left: bounds.left, right: bounds.right };
    })(),
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.scrollHeight).toBeLessThanOrEqual(layout.innerHeight);
  expect(layout.drawer?.left ?? -1).toBeGreaterThanOrEqual(0);
  expect(layout.drawer?.right ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
    layout.clientWidth,
  );
  await expect(page.getByText("Semantic events")).toBeVisible();
  await page.getByRole("button", { name: "View planet" }).focus();
  await expect(page.getByRole("button", { name: "View planet" })).toBeFocused();
});

test("keeps the production browser boundary local and restrictive", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "canonical security audit");
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/?renderer=canvas");
  await reachPerson(page);
  expect(
    requests.filter((url) => new URL(url).origin !== "http://127.0.0.1:4173"),
  ).toEqual([]);
  expect(await page.evaluate(() => globalThis.isSecureContext)).toBe(true);
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'none'");
  expect(csp).toContain("form-action 'self'");
});
