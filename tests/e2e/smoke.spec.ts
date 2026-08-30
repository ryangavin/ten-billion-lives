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
  await expect(
    page.getByText("ten-billion-lives/local-smoke/v1"),
  ).toBeVisible();
  await expect(page.getByTestId("deterministic-vector-hash")).toHaveText(
    "050e18e9f2d20dff",
  );
  await expect(
    page.getByText("Run pnpm check from the repository root"),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "Meet Ari Vale" }).click();
  await expect(page.getByTestId("observer-a-person-id")).toHaveText(
    "person-5d19f85f",
  );

  await page.getByRole("button", { name: "Initialize observer B" }).click();
  await expect(page.getByTestId("observer-b-person-id")).toHaveText(
    "person-5d19f85f",
  );
  await expect(page.getByTestId("observer-match")).toHaveText("Semantic match");

  await page.getByRole("button", { name: "Rewind and replay" }).click();
  await expect(page.getByTestId("replay-result")).toHaveText(
    "trace-b11350f7 restored",
  );
  await page.getByRole("button", { name: "Reveal fields" }).click();
  await expect(page.getByTestId("reality-budget")).toContainText(
    "3 authoritative cells",
  );
});
