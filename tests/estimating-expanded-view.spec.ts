/**
 * Smoke test: Estimating page expanded view
 * Verifies that the expanded row stays visible when typing data.
 *
 * Run: npx playwright test tests/estimating-expanded-view.spec.ts
 * Requires: Dev server running (npm run dev), and being logged in.
 * If redirected to /login, run with: npx playwright test --project=chromium
 *   then log in manually first or add storageState for auth.
 */

import { test, expect } from "@playwright/test";

test.describe("Estimating page - expanded view", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/estimating");
    // Wait for page to load (either estimating or login redirect)
    await page.waitForLoadState("networkidle");
  });

  test("expanded row stays visible when typing in a field", async ({ page }) => {
    // Skip if redirected to login
    if (page.url().includes("/login")) {
      test.skip();
      return;
    }

    // Wait for grid to load - look for "Add Line" or table
    await page.waitForSelector('table tbody tr, button:has-text("Add Line")', {
      timeout: 10000,
    });

    const rows = page.locator("table tbody tr[id^='line-']");
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip();
      return; // No lines to expand
    }

    // Click first line's Line ID to expand (chevron/expand button)
    const firstLineIdCell = rows.first().locator('td:first-child button[title="Click to expand details"]');
    await firstLineIdCell.click();

    // Wait for expanded detail panel (EstimatingRowDetail)
    const detailPanel = page.locator('tr:has(td[colspan="8"])').first();
    await expect(detailPanel).toBeVisible({ timeout: 3000 });

    // Type in Item Description field
    const itemDescriptionInput = detailPanel.locator('input[id*="itemDescription"], input[data-field="itemDescription"]').first();
    const existingInput = detailPanel.locator('input[type="text"]').first();
    const inputToUse = (await itemDescriptionInput.count()) > 0 ? itemDescriptionInput : existingInput;

    if ((await inputToUse.count()) > 0) {
      await inputToUse.fill("Smoke test entry");
      // Brief wait for any re-renders
      await page.waitForTimeout(500);
      // Expanded panel should still be visible
      await expect(detailPanel).toBeVisible();
    }

    // Verify expanded row did not collapse
    const stillExpanded = await detailPanel.isVisible();
    expect(stillExpanded).toBe(true);
  });
});
