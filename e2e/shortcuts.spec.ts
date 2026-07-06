import { test, expect } from '@playwright/test';

test.describe('Keyboard shortcuts', () => {
  test.use({ storageState: undefined });

  async function loginAndGoToProject(page: any) {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByText('Demo').first().click();
    await expect(page).toHaveURL(/\/projects\/demo/);
    await page.waitForTimeout(500);
  }

  test('should open shortcuts modal with ? key', async ({ page }) => {
    await loginAndGoToProject(page);

    await page.keyboard.press('?');
    await page.waitForTimeout(500);

    await expect(page.getByText(/shortcuts|keyboard/i)).toBeVisible({ timeout: 3000 });
  });

  test('should close shortcuts modal with Escape', async ({ page }) => {
    await loginAndGoToProject(page);

    await page.keyboard.press('?');
    await expect(page.getByText(/shortcuts|keyboard/i)).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await expect(page.getByText(/shortcuts|keyboard/i)).not.toBeVisible({ timeout: 3000 });
  });

  test('should open search with / key', async ({ page }) => {
    await loginAndGoToProject(page);

    await page.keyboard.press('/');
    await page.waitForTimeout(500);

    await expect(page.getByPlaceholder('Search items...')).toBeVisible({ timeout: 3000 });
  });

  test('should close search modal with Escape', async ({ page }) => {
    await loginAndGoToProject(page);

    await page.keyboard.press('/');
    await expect(page.getByPlaceholder('Search items...')).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await expect(page.getByPlaceholder('Search items...')).not.toBeVisible({ timeout: 3000 });
  });
});
