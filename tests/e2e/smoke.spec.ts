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
  await expect(
    page.getByText("Run pnpm check from the repository root"),
  ).toBeVisible();
});
