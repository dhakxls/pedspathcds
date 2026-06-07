// @ts-nocheck
import { expect, test } from "@playwright/test";

const FRONTEND_BASE_URL = "https://homelab.taild08007.ts.net/peds";
const API_BASE_URL = `${FRONTEND_BASE_URL.replace(/\/$/, "")}/api`;
const SMART_PATIENT_ID = "SYN-002";
const PUBLIC_SANDBOX_BASE = "https://launch.smarthealthit.org/v/r4/sim/eyJrIjoiMSJ9/fhir";

/**
 * This script walks through the public demo experience that an attending user would follow:
 * 1. Land on the hero page and confirm the synthetic-only disclaimer.
 * 2. Jump to the synthetic cohort, open a patient, and review their pathway panel.
 * 3. Inspect the FHIR mapping gallery.
 * 4. Launch the SMART tester, request a code via the real backend, and exchange it via the UI.
 */
test("attending walkthrough across landing, patients, FHIR, and SMART", async ({ page, request }) => {
  await test.step("Gather synthetic patient metadata via API", async () => {
    const patientsResponse = await request.get(`${API_BASE_URL}/patients`);
    expect(patientsResponse.ok()).toBeTruthy();
    const payload = await patientsResponse.json();
    const targetPatient = payload.patients.find((patient: any) => patient.patient_id === SMART_PATIENT_ID) ?? payload.patients[0];

    await test.step("Landing hero reinforces disclaimer", async () => {
      await page.goto(`${FRONTEND_BASE_URL}/`);
      await expect(page.getByText("Synthetic-data pediatric pathway support", { exact: false })).toBeVisible();
      await expect(page.getByText("This prototype uses synthetic data only", { exact: false })).toBeVisible();
    });

    await test.step("Navigate to synthetic cohort and open the selected patient", async () => {
      await page.getByRole("link", { name: "Run Synthetic Pediatric Demo" }).click();
      await expect(page.getByRole("heading", { name: "Synthetic Pediatric Cohort" })).toBeVisible();

      const patientCard = page.locator("div", { hasText: targetPatient.patient_id }).filter({ hasText: "Open pathway review" }).first();
      await expect(patientCard).toBeVisible();
      await page.goto(`${FRONTEND_BASE_URL}/patients/${targetPatient.patient_id}`);
      await expect(page.getByRole("heading", { name: new RegExp(`Pathway support for ${targetPatient.name}`) })).toBeVisible();
      await expect(page.getByText("Bronchiolitis module — clinician review required.")).toBeVisible();
    });

    await test.step("Review FHIR mapping", async () => {
      await page.getByRole("link", { name: "FHIR Mapping" }).click();
      await expect(page.getByRole("heading", { name: "FHIR-aware mapping" })).toBeVisible();
      await page.getByRole("button", { name: targetPatient.name }).click();
      await expect(page.getByRole("heading", { name: "Selected resource mapping" })).toBeVisible();
      await expect(page.getByText("Patient → FHIR Patient")).toBeVisible();
    });

    await test.step("SMART launch tester with real code + token exchange", async () => {
      await page.getByRole("link", { name: "Epic Placeholder" }).click();
      await expect(page.getByRole("heading", { name: "3. Exchange the returned code" })).toBeVisible();

      const authorizeResponse = await request.fetch(`${API_BASE_URL}/smart/authorize`, {
        method: "GET",
        params: {
          response_type: "code",
          client_id: "peds-path-demo-client",
          redirect_uri: "https://example.org/smart-redirect",
          scope: "launch patient/*.read",
          state: "playwright-demo",
          smart_patient_id: targetPatient.patient_id,
        },
        maxRedirects: 0,
      });
      expect(authorizeResponse.status()).toBe(302);
      const redirectUrl = authorizeResponse.headers()["location"];
      expect(redirectUrl).toBeTruthy();
      const redirect = new URL(redirectUrl!);
      const code = redirect.searchParams.get("code");
      expect(code).toBeTruthy();

      await page.getByLabel("Authorization code").fill(code!);
      await page.getByRole("button", { name: "Exchange token" }).click();
      await expect(page.getByText("Token response", { exact: false })).toBeVisible();

      const tokenJson = await page.locator("pre").first().textContent();
      expect(tokenJson).toBeTruthy();
      const tokenPayload = JSON.parse(tokenJson ?? "{}");
      expect(tokenPayload.patient).toBe(targetPatient.patient_id);

      const contextResponse = await request.get(`${API_BASE_URL}/smart/context`, {
        headers: {
          Authorization: `Bearer ${tokenPayload.access_token}`,
        },
      });
      expect(contextResponse.ok()).toBeTruthy();
      const contextBody = await contextResponse.json();
      expect(contextBody.patient.patient_id).toBe(targetPatient.patient_id);
    });

    await test.step("Inspect SMART Health IT sandbox metadata", async () => {
      if (process.env.CI) return;
      const heading = page.getByRole("heading", { name: "4. Explore SMART Health IT sandbox metadata" });
      if (!(await heading.count())) {
        return;
      }
      await heading.scrollIntoViewIfNeeded();
      await expect(page.getByText("Sandbox discovery document", { exact: false })).toBeVisible({ timeout: 1000 }).catch(async () => {
        await page.getByLabel("Sandbox FHIR base URL").fill(PUBLIC_SANDBOX_BASE);
        await page.getByRole("button", { name: "Fetch SMART config" }).click();
        await expect(page.getByText("Sandbox discovery document", { exact: false })).toBeVisible({ timeout: 10000 });
      });
    });
  });
});
