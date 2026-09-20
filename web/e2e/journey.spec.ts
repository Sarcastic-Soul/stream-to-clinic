import { expect, test, type Page } from "@playwright/test";

// The radio itself is visually hidden inside its label (see ChoiceGroup): the label's own text
// takes the click, so the actionability check has to be skipped.
const choose = (page: Page, label: string) => page.getByRole("radio", { name: label }).check({ force: true });

// The three journeys the project is judged on: a citizen reports, a clinic answers, an authority
// reads the trend. They run against the in-browser mock, which uses the same rules as the API.

test("a citizen files a report and sees the FHIR record it became", async ({ page }) => {
  await page.goto("/report?site=Loc-Almyros");

  await expect(page.getByRole("heading", { name: "Report a stream observation" })).toBeVisible();
  await choose(page, "Filamentous algae");
  await choose(page, "Abundant");
  await page.getByLabel("Your name").fill("E2E volunteer");
  await page.getByRole("button", { name: "Send report" }).click();

  await expect(page.getByRole("heading", { name: "Report saved" })).toBeVisible();
  await expect(page.getByText("Thank you, E2E volunteer")).toBeVisible();
  // The record is a FHIR Observation, linked by id.
  await expect(page.getByRole("link", { name: /^Observation\// })).toBeVisible();
  // Abundant algae in warm, dry weather raises the bloom alert, and it names a clinic.
  await expect(page.getByRole("link", { name: /Possible algal bloom/ })).toBeVisible();
  await expect(page.getByText("Clinics serving this site have been notified.")).toBeVisible();
});

test("a notified clinic answers an alert and the list shows it answered", async ({ page }) => {
  await page.goto("/clinic?clinic=clinic-heraklion-west");

  const alert = page.getByRole("link", { name: /Possible algal bloom/ }).first();
  await expect(alert).toBeVisible();
  await alert.click();

  await expect(page.getByRole("heading", { name: "Possible algal bloom" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why this alert was raised" })).toBeVisible();

  await choose(page, "Patients advised about the water");
  await page.locator("#ack-note").fill("Posters up in the waiting room.");
  await page.getByRole("button", { name: /Send response/i }).click();

  // The reply is a Communication, and it is shown back with the clinic that sent it.
  await expect(page.getByText("Patients advised about the water").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /^Communication\// }).first()).toBeVisible();

  await page.getByRole("link", { name: /Clinic alerts/ }).click();
  await expect(page.getByText("Answered").first()).toBeVisible();
});

test("an alert can be rewritten as a notice for the clinic desk", async ({ page }) => {
  await page.goto("/clinic?clinic=clinic-heraklion-west");
  await page.getByRole("link", { name: /Possible algal bloom/ }).first().click();

  const advisory = page.getByRole("region", { name: "Notice for the clinic desk" });
  await expect(advisory.getByText(/cannot change the risk or its level/)).toBeVisible();
  await advisory.getByRole("button", { name: "Draft the notice" }).click();

  // The draft names the model that wrote it and links the Communication it is stored as.
  await expect(advisory.getByText(/Drafted by demo-model/)).toBeVisible();
  await expect(advisory.getByText("Demo heuristic, not clinical guidance.")).toBeVisible();
});

test("the trend view rolls weeks of reports up by site and region", async ({ page }) => {
  await page.goto("/trends");

  await expect(page.getByRole("heading", { name: "Catchment trends" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "By region" })).toBeVisible();
  await expect(page.getByText("Crete, Greece").first()).toBeVisible();

  // Worst site first, with a direction for each indicator.
  const sites = page.locator("section[aria-labelledby='sites-heading'] section");
  await expect(sites.first().getByRole("heading")).toHaveText("Almyros monitoring reach");
  await expect(sites.first().getByText(/Steady|Rising|Falling/).first()).toBeVisible();
  await expect(sites).toHaveCount(4);
});

test("the map lists every site with its risk, and links on to the trends", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Stream sites" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Almyros monitoring reach/ })).toBeVisible();
  await page.getByRole("link", { name: /over four weeks/ }).click();
  await expect(page.getByRole("heading", { name: "Catchment trends" })).toBeVisible();
});
