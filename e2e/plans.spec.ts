import { test, expect } from '@playwright/test';

test.describe('Plans', () => {
  test.use({ storageState: undefined });

  test('should show empty state when no plans exist', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByText('Demo').first().click();
    await page.getByRole('link', { name: /plans/i }).click();
    await expect(page).toHaveURL(/\/plans$/);

    await expect(page.getByText('No plans yet')).toBeVisible();
  });

  test('should create a plan and show it in the grid', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByText('Demo').first().click();
    await page.getByRole('link', { name: /plans/i }).click();
    await expect(page).toHaveURL(/\/plans$/);

    await page.getByRole('button', { name: /create plan/i }).click();
    await page.getByPlaceholder(/name/i).fill('Sprint 1');
    await page.getByRole('button', { name: /create$/i }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Sprint 1')).toBeVisible();
  });

  test('should edit a plan name', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByText('Demo').first().click();
    await page.getByRole('link', { name: /plans/i }).click();
    await expect(page).toHaveURL(/\/plans$/);

    // Create a plan first
    await page.getByRole('button', { name: /create plan/i }).click();
    await page.getByPlaceholder(/name/i).fill('Edit Test');
    await page.getByRole('button', { name: /create$/i }).click();
    await page.waitForTimeout(500);

    // Edit it
    await page.getByRole('button', { name: /edit/i }).click();
    await page.getByPlaceholder(/name/i).fill('Edited Plan');
    await page.getByRole('button', { name: /save|update/i }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Edited Plan')).toBeVisible();
  });

  test('should delete a plan', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByText('Demo').first().click();
    await page.getByRole('link', { name: /plans/i }).click();
    await expect(page).toHaveURL(/\/plans$/);

    // Create a plan first
    await page.getByRole('button', { name: /create plan/i }).click();
    await page.getByPlaceholder(/name/i).fill('Delete Me');
    await page.getByRole('button', { name: /create$/i }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Delete Me')).toBeVisible();

    // Delete it
    await page.getByRole('button', { name: /delete/i }).click();
    page.on('dialog', (dialog) => dialog.accept());
    await page.waitForTimeout(500);

    await expect(page.getByText('Delete Me')).not.toBeVisible();
  });
});
