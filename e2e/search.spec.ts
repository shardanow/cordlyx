import { test, expect } from '@playwright/test';

test.describe('Search', () => {
  test.use({ storageState: undefined });

  test('should open search and find items', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    // Open search via keyboard
    await page.keyboard.press('/');
    await expect(page.getByPlaceholder('Search items...')).toBeVisible({ timeout: 3000 });

    // Search for something
    await page.getByPlaceholder('Search items...').fill('CI/CD');
    await page.waitForTimeout(500);
    // Should find at least one result
    await expect(page.locator('text=/CI\\/CD|ci\\/cd/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show no results for unmatched query', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    // Open search via sidebar button
    await page.getByRole('button', { name: /search/i }).click();
    await expect(page.getByPlaceholder('Search items...')).toBeVisible({ timeout: 3000 });

    // Search for something that doesn't exist
    await page.getByPlaceholder('Search items...').fill('zzzzzznonexistent');
    await page.waitForTimeout(500);
    await expect(page.getByText('No results found.')).toBeVisible({ timeout: 5000 });
  });
});
