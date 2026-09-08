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

    await page.getByRole('button', { name: /create roadmap/i }).first().click();
    const roadmapName = `Q3 Release ${Date.now()}`;
    await page.getByPlaceholder('Q3 2024 Release').fill(roadmapName);
    await page.locator('input[type="date"]').first().fill(TOMORROW);
    await page.locator('input[type="date"]').nth(1).fill(NEXT_WEEK);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForTimeout(700);

    await expect(page.getByText(roadmapName)).toBeVisible();
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

    // Create (unique names: retries must not clash with attempt 1)
    const editBase = `Edit Roadmap ${Date.now()}`;
    const updatedName = `Updated Roadmap ${Date.now()}`;
    await page.getByRole('button', { name: /create roadmap/i }).first().click();
    await page.getByPlaceholder('Q3 2024 Release').fill(editBase);
    await page.locator('input[type="date"]').first().fill(TOMORROW);
    await page.locator('input[type="date"]').nth(1).fill(NEXT_WEEK);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForTimeout(700);

    // Click edit pencil
    await page.getByTitle(/edit roadmap/i).first().click();
    await page.getByPlaceholder('Q3 2024 Release').fill(updatedName);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(700);

    await expect(page.getByText(updatedName)).toBeVisible();
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

    // Create (unique name: retries must not clash with attempt 1)
    const deleteName = `Delete Test ${Date.now()}`;
    await page.getByRole('button', { name: /create roadmap/i }).first().click();
    await page.getByPlaceholder('Q3 2024 Release').fill(deleteName);
    await page.locator('input[type="date"]').first().fill(TOMORROW);
    await page.locator('input[type="date"]').nth(1).fill(NEXT_WEEK);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForTimeout(700);

    // Delete (custom ConfirmModal, not a native dialog)
    await page.getByRole('button', { name: /^Delete$/ }).first().click();
    const confirm = page.getByRole('alertdialog');
    await confirm.getByRole('button', { name: 'Delete' }).click();
    // Confirm dialog closes only after a successful delete
    await expect(confirm).not.toBeVisible({ timeout: 5000 });

    await expect(page.getByText(deleteName)).not.toBeVisible({ timeout: 5000 });
  });
});
