import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function reachPerson(page: Page): Promise<void> {
  for (const name of [
    "Enter Brindle Bay",
    "Enter Harbor Street",
    "Meet a resident",
  ])
    await page.getByRole("button", { name }).click();
  await expect(page.getByTestId("observer-a-person-id")).toBeVisible();
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

test("has no serious or critical automated accessibility findings", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one canonical axe audit");
  await page.goto("/?renderer=canvas");
  await reachPerson(page);
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
  await expect(page.getByTestId("observer-a-person-id")).toBeVisible();
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
  await expect(page.getByTestId("observer-match")).toHaveText("Semantic match");
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
  const layout = await page.evaluate(() => ({
    clientWidth: globalThis.document.documentElement.clientWidth,
    scrollWidth: globalThis.document.documentElement.scrollWidth,
    offenders: [...globalThis.document.querySelectorAll("body *")]
      .map((element) => ({
        element: element.tagName.toLowerCase(),
        className: element.getAttribute("class") ?? "",
        testId: element.getAttribute("data-testid") ?? "",
        right: Math.round(element.getBoundingClientRect().right),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }))
      .filter(
        (element) =>
          element.right > globalThis.document.documentElement.clientWidth + 1,
      )
      .slice(0, 12),
  }));
  expect(layout.offenders).toEqual([]);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
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
