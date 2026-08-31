import { expect, test } from "@playwright/test";

test("production journey composes semantic zoom, playback, observers, and Canvas recovery", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/?renderer=canvas&quality=fallback");
  await page.getByRole("button", { name: "Enter Brindle Bay" }).click();

  const renderer = page.getByTestId("journey-renderer");
  await expect(renderer).toHaveAttribute("data-city-level", "city");
  await expect(page.getByTestId("render-backend")).toHaveText("canvas2d");
  await expect(page.getByTestId("render-visible")).toHaveText("64");
  await expect(page.getByTestId("living-city-summary")).toContainText(
    "literal figures represent",
  );
  const selectedPersonId = await renderer.getAttribute("data-selection-id");
  const manifestationHash = await page
    .getByTestId("manifestation-hash-a")
    .textContent();
  const cityKey = await renderer.getAttribute("data-projection-key");

  await page.getByRole("button", { name: "Orbit camera" }).click();
  await expect(renderer).toHaveAttribute("data-projection-key", cityKey ?? "");
  await expect(page.getByTestId("manifestation-hash-a")).toHaveText(
    manifestationHash ?? "",
  );

  await page.getByRole("button", { name: "Zoom neighborhood" }).click();
  await expect(renderer).toHaveAttribute("data-city-level", "neighborhood");
  await expect(renderer).toHaveAttribute(
    "data-selection-id",
    selectedPersonId ?? "",
  );
  await expect(page.getByTestId("render-visible")).toHaveText("128");
  await expect(page.getByTestId("manifestation-hash-a")).toHaveText(
    manifestationHash ?? "",
  );

  await page.getByRole("button", { name: "Zoom street" }).click();
  await expect(page.getByTestId("observer-a-stage")).toHaveText("Street");
  await expect(renderer).toHaveAttribute("data-city-level", "street");
  await expect(page.getByTestId("render-visible")).toHaveText("128");
  await expect(page.getByTestId("manifestation-hash-a")).toHaveText(
    manifestationHash ?? "",
  );

  await page.getByRole("button", { name: "Zoom person" }).click();
  await expect(page.getByTestId("observer-a-person-id")).toHaveText(
    selectedPersonId ?? "",
  );
  await expect(page.getByTestId("manifestation-hash-a")).toHaveText(
    manifestationHash ?? "",
  );
  await page.getByRole("button", { name: "Initialize observer B" }).click();
  await expect(page.getByTestId("observer-match")).toHaveText(
    "Semantic match · trajectory match",
  );
  await expect(page.getByTestId("living-city-hash-b")).toHaveText(
    await page.getByTestId("living-city-hash-a").textContent(),
  );

  await page.getByRole("button", { name: "Tick 7 · commute" }).click();
  const phaseZeroKey = await renderer.getAttribute("data-projection-key");
  const stateHash = await page.getByTestId("state-hash").textContent();
  await page
    .getByRole("button", {
      name: "1 simulated minute per real second",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Play local time" }).click();
  await expect(page.getByTestId("time-status")).toContainText("Playing");
  await expect
    .poll(() => renderer.getAttribute("data-projection-key"))
    .not.toBe(phaseZeroKey);
  await expect(page.getByTestId("state-hash")).toHaveText(stateHash ?? "");
  await page.getByRole("button", { name: "Pause local time" }).click();
  await expect(page.getByTestId("observer-match")).toHaveText(
    "Semantic match · trajectory match",
  );
  const pausedKey = await renderer.getAttribute("data-projection-key");
  await page.waitForTimeout(600);
  await expect(renderer).toHaveAttribute(
    "data-projection-key",
    pausedKey ?? "",
  );

  await page.getByRole("button", { name: "Tick 7 · commute" }).click();
  const directSeekKey = await renderer.getAttribute("data-projection-key");
  await page.getByRole("button", { name: "Rewind and replay" }).click();
  await expect(renderer).toHaveAttribute(
    "data-projection-key",
    directSeekKey ?? "",
  );

  await page.getByRole("button", { name: "Simulate renderer loss" }).click();
  await expect(page.getByTestId("render-backend")).toHaveText("canvas2d");
  await expect(page.getByTestId("render-context-losses")).toHaveText("1");
  expect(consoleErrors).toEqual([]);
});
