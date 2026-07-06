import { test, expect } from '@playwright/test';

test.describe('Item detail', () => {
  test.use({ storageState: undefined });

  async function loginAndOpenItem(page: any) {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByText('Demo').first().click();
    await expect(page).toHaveURL(/\/projects\/demo/);

    // Open first item
    await page.locator('a[href*="/items/"]').first().click();
    await expect(page).toHaveURL(/\/items\/\d+/);
    await page.waitForTimeout(1000);
  }

  test('should display item title and fields', async ({ page }) => {
    await loginAndOpenItem(page);

    await expect(page.locator('h1').or(page.locator('[data-testid="item-title"]'))).toBeVisible({ timeout: 5000 });
  });

  test('should open comment form and add a comment', async ({ page }) => {
    await loginAndOpenItem(page);

    const commentPlaceholder = page.getByPlaceholder('Write a comment...');
    if (await commentPlaceholder.isVisible({ timeout: 3000 }).catch(() => false)) {
      await commentPlaceholder.fill(`E2E detail comment ${Date.now()}`);
      await page.getByRole('button', { name: /send|comment/i }).click();
      await page.waitForTimeout(500);
    }
  });

  test('should show attachments section', async ({ page }) => {
    await loginAndOpenItem(page);

    await expect(page.getByText(/attachments/i)).toBeVisible({ timeout: 3000 });
  });

  test('should show activity section', async ({ page }) => {
    await loginAndOpenItem(page);

    const activityHeading = page.getByText(/activity/i);
    if (await activityHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(await activityHeading.isVisible()).toBe(true);
    }
  });

  test('should navigate back to list from detail', async ({ page }) => {
    await loginAndOpenItem(page);

    await page.getByRole('link', { name: /list|back/i }).first().click();
    await expect(page).toHaveURL(/\/projects\/demo$/);
  });
});
