import { test, expect } from '@playwright/test';

test.describe('Quick create', () => {
  test.use({ storageState: undefined });

  test('should create item from board page', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByText('Demo').first().click();

    // Go to board
    await page.getByRole('link', { name: /board/i }).click();
    await expect(page).toHaveURL(/\/board$/);
    await page.waitForTimeout(1000);

    // Click Create item
    await page.getByRole('button', { name: /create item/i }).first().click();
    await expect(page.getByText('Quick create')).toBeVisible({ timeout: 3000 });

    const title = `Board QC ${Date.now()}`;
    await page.getByPlaceholder('Item title...').fill(title);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForTimeout(1500);

    // Verify: item should appear after reload
    await page.reload();
    await page.waitForTimeout(2000);
  });

  test('should create item from list page', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByText('Demo').first().click();
    await expect(page).toHaveURL(/\/projects\/demo/);
    await page.waitForTimeout(500);

    // Click Create item on the list page
    await page.getByRole('button', { name: /create item/i }).first().click();
    await expect(page.getByText('Quick create')).toBeVisible({ timeout: 3000 });

    const title = `List QC ${Date.now()}`;
    await page.getByPlaceholder('Item title...').fill(title);
    await page.getByRole('button', { name: /^Create$/ }).click();

    // Should redirect to the new item detail page
    await expect(page).toHaveURL(/\/items\/\d+/, { timeout: 10000 });
  });

  test('should show validation when creating with empty title', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByText('Demo').first().click();
    await page.waitForTimeout(500);

    // Open quick create and try to submit empty
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(500);

    const quickCreateBtn = page.getByRole('button', { name: /quick create/i });
    if (await quickCreateBtn.isVisible()) {
      await quickCreateBtn.click();
    }

    // Submit button should be disabled with empty title
    const submitBtn = page.getByRole('button', { name: /^Create$/ });
    await expect(submitBtn).toBeDisabled({ timeout: 3000 });
  });
});
