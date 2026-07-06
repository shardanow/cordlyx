import { test, expect } from '@playwright/test';

test.describe('Roadmaps', () => {
  test.use({ storageState: undefined });

  const TOMORROW = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const NEXT_WEEK = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  test('should show empty state when no roadmaps exist', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByText('Demo').first().click();
    await page.getByRole('link', { name: /roadmaps/i }).click();
    await expect(page).toHaveURL(/\/roadmaps$/);

    await expect(page.getByText('No roadmaps yet')).toBeVisible();
  });

  test('should create a roadmap', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByText('Demo').first().click();
    await page.getByRole('link', { name: /roadmaps/i }).click();
    await expect(page).toHaveURL(/\/roadmaps$/);

    await page.getByRole('button', { name: /create roadmap/i }).click();
    await page.getByPlaceholder(/name/i).fill('Q3 Release');
    await page.locator('input[type="date"]').first().fill(TOMORROW);
    await page.locator('input[type="date"]').nth(1).fill(NEXT_WEEK);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForTimeout(700);

    await expect(page.getByText('Q3 Release')).toBeVisible();
  });

  test('should edit a roadmap name', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByText('Demo').first().click();
    await page.getByRole('link', { name: /roadmaps/i }).click();
    await expect(page).toHaveURL(/\/roadmaps$/);

    // Create
    await page.getByRole('button', { name: /create roadmap/i }).click();
    await page.getByPlaceholder(/name/i).fill('Edit Roadmap');
    await page.locator('input[type="date"]').first().fill(TOMORROW);
    await page.locator('input[type="date"]').nth(1).fill(NEXT_WEEK);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForTimeout(700);

    // Click edit pencil
    await page.getByRole('button', { title: /edit roadmap/i }).click();
    await page.getByPlaceholder(/name/i).fill('Updated Roadmap');
    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(700);

    await expect(page.getByText('Updated Roadmap')).toBeVisible();
  });

  test('should delete a roadmap', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByText('Demo').first().click();
    await page.getByRole('link', { name: /roadmaps/i }).click();
    await expect(page).toHaveURL(/\/roadmaps$/);

    // Create
    await page.getByRole('button', { name: /create roadmap/i }).click();
    await page.getByPlaceholder(/name/i).fill('Delete Test');
    await page.locator('input[type="date"]').first().fill(TOMORROW);
    await page.locator('input[type="date"]').nth(1).fill(NEXT_WEEK);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForTimeout(700);

    // Delete
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /^Delete$/ }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Delete Test')).not.toBeVisible();
  });
});
