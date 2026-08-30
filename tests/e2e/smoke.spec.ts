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
  await page.getByRole("button", { name: "Orbit camera" }).click();
  await expect(page.getByTestId("state-hash")).toHaveText(stateHash ?? "");
  await page.getByRole("button", { name: "Enter Brindle Bay" }).click();
  await expect(page.getByTestId("observer-a-stage")).toHaveText("Settlement");
  await page.getByRole("button", { name: "Enter Harbor Street" }).click();
  await expect(page.getByTestId("observer-a-stage")).toHaveText("Street");
  await page.getByRole("button", { name: "Meet a resident" }).click();
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

  await page.getByRole("button", { name: "Initialize observer B" }).click();
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
    "trace-1a66653c restored",
  );
  await page.getByRole("button", { name: "Reveal fields" }).click();
  await expect(page.getByTestId("reality-budget")).toContainText(
    "2,048 integer cells",
  );
});
