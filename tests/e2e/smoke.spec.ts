import { expect, test } from "@playwright/test";

test("production build exposes the deterministic local smoke surface", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Ten Billion Lives" }),
  ).toBeVisible();
  await expect(page.getByTestId("smoke-status")).toHaveText(
    "Local foundation ready",
  );
  await expect(page.getByTestId("represented-population")).toHaveText(
    "10,000,000,000",
  );
  await expect(page.getByText("ten-billion-lives/baseline/v1")).toBeVisible();
  await expect(page.getByTestId("deterministic-vector-hash")).toHaveText(
    "050e18e9f2d20dff",
  );
  await expect(page.getByTestId("world-hash")).toHaveText("ed66e344fcd7e737");
  await expect(page.getByTestId("render-backend")).toHaveText(
    /canvas2d|webgpu/,
  );
  await expect(page.getByTestId("render-visible")).toHaveText("65,536");
  await expect(page.getByTestId("journey-renderer")).toHaveAttribute(
    "data-selection-id",
    "person_27yi09s_1obkbba",
  );
  await expect(page.getByTestId("projection-represented")).toHaveText(
    "10,000,000,000",
  );
  await expect(page.getByTestId("projection-tokens")).toHaveText("8,192");
  await expect(
    page.getByText("Run pnpm check from the repository root"),
  ).toBeVisible();
});

test("inspects deterministic geography across hierarchy, seam, and pole", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Inspect debug world" }).click();
  await expect(page.getByTestId("debug-globe")).toBeVisible();
  await expect(page.getByTestId("debug-cell-id")).toHaveText("L5/12/0");
  await expect(page.getByTestId("field-hash")).toHaveText("4e04868f72dfe574");
  await expect(page.getByTestId("field-invariants")).toHaveText(
    "None — exact conservation",
  );
  await expect(page.getByTestId("planetary-day-hash")).toHaveText(
    "c09cdd840c68bab2",
  );
  await expect(page.getByTestId("signature-route")).toContainText("Closed · 0");
  await page.getByRole("button", { name: "Tick 9 · reopened" }).click();
  await expect(page.getByTestId("transport-tick")).toHaveText("9");
  await expect(page.getByTestId("signature-route")).toContainText(
    "Open · 8,180,688",
  );
  await page.getByRole("button", { name: "Tick 19 · festival" }).click();
  await expect(
    page.getByText(/100,000 attending from 2 surrounding regions/),
  ).toBeVisible();
  await expect(page.getByTestId("flow-explanation")).toContainText("capacity");
  await expect(page.getByTestId("kernel-hash")).toHaveText("74410bddf69993e9");
  await expect(page.getByTestId("event-hash")).toHaveText("ec998bbac0999abc");
  await page
    .getByRole("button", { name: "Save and restore checkpoint" })
    .click();
  await expect(page.getByTestId("checkpoint-result")).toHaveText(
    "74410bddf69993e9 restored from 189,085 bytes",
  );
  await page.getByRole("button", { name: "Single-step" }).click();
  await expect(page.getByTestId("field-tick")).toHaveText("1");
  await expect(page.getByText(/transfers; \d+ touch this cell/)).toBeVisible();
  await page.getByRole("button", { name: "Advance one day" }).click();
  await expect(page.getByTestId("field-tick")).toHaveText("25");
  await expect(page.getByTestId("field-invariants")).toHaveText(
    "None — exact conservation",
  );
  await page.getByRole("button", { name: "L2 regions" }).click();
  await expect(
    page.getByRole("heading", { name: "Debug globe · L2" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Inspect north pole" }).click();
  await expect(page.getByTestId("debug-cell-id")).toHaveText("L5/0/3");
  await expect(page.getByText("L4/0/1 → L5/0/3")).toBeVisible();
});

test("traces planet to person across two independent local observers", async ({
  page,
}) => {
  await page.goto("/");
  const stateHash = await page.getByTestId("state-hash").textContent();
  const planetManifestationHash = await page
    .getByTestId("manifestation-hash-a")
    .textContent();
  const planetEventHash = await page
    .getByTestId("projection-event-hash-a")
    .textContent();
  await page.getByRole("button", { name: "Orbit camera" }).click();
  await expect(page.getByTestId("state-hash")).toHaveText(stateHash ?? "");
  await expect(page.getByTestId("manifestation-hash-a")).toHaveText(
    planetManifestationHash ?? "",
  );
  await expect(page.getByTestId("projection-event-hash-a")).toHaveText(
    planetEventHash ?? "",
  );
  await expect(page.getByTestId("journey-renderer")).toHaveAttribute(
    "data-camera-degrees",
    "45",
  );
  await page.getByRole("button", { name: "Enter Brindle Bay" }).click();
  await expect(page.getByTestId("observer-a-stage")).toHaveText("Settlement");
  await expect(page.getByTestId("render-visible")).toHaveText("125,000");
  await page.getByRole("button", { name: "Enter Harbor Street" }).click();
  await expect(page.getByTestId("observer-a-stage")).toHaveText("Street");
  await expect(page.getByTestId("render-visible")).toHaveText("250,000");
  await page.getByRole("button", { name: "Meet a resident" }).click();
  await expect(page.getByTestId("render-visible")).toHaveText("50,000");
  await expect(page.getByTestId("journey-renderer")).toHaveAttribute(
    "data-selection-id",
    "person_27yi09s_1obkbba",
  );
  await expect(page.getByTestId("observer-a-person-id")).toHaveText(
    "person_27yi09s_1obkbba",
  );
  await expect(page.getByText("Dara Grove · age 28 · adult")).toBeVisible();
  await expect(page.getByText("North Works · 512/512")).toBeVisible();
  await expect(page.getByTestId("observer-a-itinerary")).toHaveText(
    "Tick 10 · work at North Works",
  );
  await expect(page.getByTestId("observer-a-household-id")).toContainText(
    "household_0yojqkh506h6x_0855mue",
  );
  const personManifestationHash = await page
    .getByTestId("manifestation-hash-a")
    .textContent();

  await page.getByRole("button", { name: "Initialize observer B" }).click();
  await expect(page.getByTestId("observer-b-person-id")).toHaveText(
    "person_27yi09s_1obkbba",
  );
  await expect(page.getByTestId("observer-match")).toHaveText("Semantic match");
  await expect(page.getByTestId("manifestation-hash-b")).toHaveText(
    personManifestationHash ?? "",
  );
  await expect(page.getByTestId("projection-event-hash-b")).toHaveText(
    await page.getByTestId("projection-event-hash-a").textContent(),
  );

  await page.getByRole("button", { name: "View planet" }).click();
  await expect(page.getByTestId("observer-a-stage")).toHaveText("Planet");
  await page.getByRole("button", { name: "View person" }).click();
  await expect(page.getByTestId("observer-a-person-id")).toHaveText(
    "person_27yi09s_1obkbba",
  );
  await expect(page.getByTestId("manifestation-hash-a")).toHaveText(
    personManifestationHash ?? "",
  );
  await page.getByRole("button", { name: "Tick 24 · identity epoch" }).click();
  await expect(page.getByTestId("observer-a-person-id")).toHaveText(
    "person_27yi09s_1obkbba",
  );
  await expect(page.getByTestId("observer-b-person-id")).toHaveText(
    "person_27yi09s_1obkbba",
  );
  await expect(page.getByTestId("observer-match")).toHaveText("Semantic match");

  await page.getByRole("button", { name: "Tick 7 · commute" }).click();
  await expect(page.getByTestId("observer-a-itinerary")).toHaveText(
    "Tick 7 · transit",
  );
  await expect(page.getByTestId("observer-b-itinerary")).toHaveText(
    "Tick 7 · transit",
  );
  await expect(page.getByTestId("observer-match")).toHaveText("Semantic match");
  await page.getByRole("button", { name: "Tick 19 · festival hour" }).click();
  await expect(page.getByTestId("observer-a-itinerary")).toHaveText(
    "Tick 19 · leisure",
  );
  await page
    .getByRole("button", { name: "Tick 10 · primary activity" })
    .click();

  await page.getByRole("button", { name: "Rewind and replay" }).click();
  await expect(page.getByTestId("replay-result")).toHaveText(
    "trace-5182c8d2 restored",
  );
  await page.getByRole("button", { name: "Reveal fields" }).click();
  await expect(page.getByTestId("reality-budget")).toContainText(
    "2,048 integer cells",
  );
});

test("selects, searches, and opens a validated person link in a fresh session", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter Brindle Bay" }).click();
  await page.getByRole("button", { name: "Enter Harbor Street" }).click();
  await page
    .getByTestId("journey-renderer")
    .click({ position: { x: 80, y: 80 } });
  await expect(page.getByTestId("observer-a-stage")).toHaveText("Person");
  await expect(page.getByTestId("observer-a-person-id")).toHaveText(
    "person_27yi09s_1obkbba",
  );

  const search = page.getByRole("searchbox", { name: "Procedural person ID" });
  await search.fill("person_0000a4q_0yrj2dd");
  await search.press("Enter");
  await expect(page.getByTestId("observer-a-person-id")).toHaveText(
    "person_0000a4q_0yrj2dd",
  );
  const firstHash = await page
    .getByTestId("manifestation-hash-a")
    .textContent();
  const href = await page.getByTestId("person-deep-link").getAttribute("href");
  expect(href).toContain("schema=1");
  expect(href).toContain("tick=10");
  expect(href).toContain("branch=baseline");

  const fresh = await context.newPage();
  await fresh.goto(href ?? "/");
  await expect(fresh.getByTestId("observer-a-stage")).toHaveText("Person");
  await expect(fresh.getByTestId("observer-a-person-id")).toHaveText(
    "person_0000a4q_0yrj2dd",
  );
  await expect(fresh.getByTestId("manifestation-hash-a")).toHaveText(
    firstHash ?? "",
  );

  const invalid = await context.newPage();
  await invalid.goto(
    "/?schema=2&seed=ten-billion-lives%2Fbaseline%2Fv1&tick=10&person=person_0000a4q_0yrj2dd&branch=baseline",
  );
  await expect(
    invalid.getByRole("heading", { name: "Incompatible local link" }),
  ).toBeVisible();
  await expect(invalid.getByRole("alert")).toContainText("schema");
  await invalid.getByRole("link", { name: "Return to baseline" }).click();
  await expect(
    invalid.getByRole("heading", { name: "Ten Billion Lives" }),
  ).toBeVisible();
});

test("follows festival meetings and departure, then compares the local closure branch", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Visit Lantern Tide" }).click();
  await expect(page.getByTestId("observer-a-person-id")).toHaveText(
    "person_0000a4q_0yrj2dd",
  );
  await expect(page.getByTestId("observer-a-itinerary")).toContainText(
    "Tick 19 · festival",
  );
  await expect(page.getByTestId("semantic-events-a")).toContainText(
    "festival/lantern-confluence",
  );
  await page
    .getByRole("button", { name: "Tick 21 · festival departure" })
    .click();
  await expect(page.getByTestId("observer-a-itinerary")).toContainText(
    "Tick 21 · transit",
  );
  await expect(page.getByTestId("observer-a-route")).toContainText(
    "festival return",
  );
  await page
    .getByRole("button", { name: "Tick 10 · recurring meeting" })
    .click();
  await expect(page.getByTestId("semantic-events-a")).toContainText("meeting");

  await page.getByRole("button", { name: "Explore closure branch" }).click();
  await expect(page.getByTestId("active-branch")).toHaveText("Closure branch");
  await expect(page.getByTestId("observer-a-person-id")).toHaveText(
    "person_1iy9k0p_1by3xrw",
  );
  await expect(page.getByTestId("baseline-route")).toHaveText("1 edge");
  await expect(page.getByTestId("closure-route")).toHaveText("31 edges");
  await expect(page.getByTestId("branch-field-match")).toHaveText(
    "Identical field state",
  );
  await expect(page.getByTestId("observer-a-route")).toContainText(
    "closure detour",
  );
  await expect(page.getByTestId("person-deep-link")).toHaveAttribute(
    "href",
    /branch=closure/,
  );
  await page.getByRole("button", { name: "View immutable baseline" }).click();
  await expect(page.getByTestId("active-branch")).toHaveText(
    "Immutable baseline",
  );
  await expect(page.getByTestId("observer-a-route")).toContainText(
    "1 graph edge",
  );
  await expect(page.getByTestId("experience-claim")).toContainText(
    "represented from compact fields—not an independently simulated mind",
  );
});

test("keeps the forced Canvas fallback navigable through loss, resize, and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?renderer=canvas");
  await expect(page.getByTestId("render-backend")).toHaveText("canvas2d");
  await expect(page.getByTestId("journey-renderer")).toHaveAttribute(
    "data-transition-ms",
    "0",
  );
  await page.getByRole("button", { name: "Simulate renderer loss" }).click();
  await expect(page.getByTestId("render-backend")).toHaveText("canvas2d");
  await expect(page.getByTestId("render-context-losses")).toHaveText("1");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("journey-renderer")).toBeVisible();
  await page.getByRole("button", { name: "Enter Brindle Bay" }).click();
  await page.getByRole("button", { name: "Enter Harbor Street" }).click();
  await expect(page.getByTestId("render-visible")).toHaveText("250,000");
  await expect(page.getByTestId("render-backend")).toHaveText("canvas2d");
});
