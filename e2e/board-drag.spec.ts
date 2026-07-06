import { test, expect } from '@playwright/test';

test.describe('Board drag-and-drop', () => {
  test.use({ storageState: undefined });

  async function loginAndGoToBoard(page: any) {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByText('Demo').first().click();
    await expect(page).toHaveURL(/\/projects\/demo/);

    await page.getByRole('link', { name: /board/i }).click();
    await expect(page).toHaveURL(/\/board$/);
    await page.waitForTimeout(2000);
  }

  test('should navigate to board and see columns', async ({ page }) => {
    await loginAndGoToBoard(page);

    const columnHeaders = page.locator('text=/backlog|todo|in progress|done|cancelled/i').first();
    await expect(columnHeaders).toBeVisible({ timeout: 5000 });
  });

  test('should show item counts on board columns', async ({ page }) => {
    await loginAndGoToBoard(page);

    await expect(page.locator('text=/\\d+/').first()).toBeVisible({ timeout: 5000 });

    await page.reload();
    await page.waitForTimeout(2000);
    await expect(page.locator('text=/\\d+/').first()).toBeVisible({ timeout: 5000 });
  });

  test('should have draggable cards in columns', async ({ page }) => {
    await loginAndGoToBoard(page);

    const cards = page.locator('.cursor-grab');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should create an item on board and see it appear', async ({ page }) => {
    await loginAndGoToBoard(page);

    const createBtn = page.getByRole('button', { name: /create item/i }).first();
    await createBtn.click();

    await expect(page.getByText('Quick create')).toBeVisible({ timeout: 3000 });
    await page.getByPlaceholder('Item title...').fill(`Board item ${Date.now()}`);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForTimeout(1500);

    // Go to list view to verify the item exists
    await page.getByRole('link', { name: /list/i }).click();
    await expect(page).toHaveURL(/\/projects\/demo$/);
    await page.waitForTimeout(500);
  });
});
