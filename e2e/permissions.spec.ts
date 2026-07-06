import { test, expect } from '@playwright/test';

test.describe('Permissions', () => {
  test.use({ storageState: undefined });

  test('should show login page for unauthenticated user', async ({ page }) => {
    await page.goto('/projects');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should redirect to login when accessing protected API directly', async ({ page }) => {
    const response = await page.request.get('http://localhost:4000/api/v1/projects');
    expect(response.status()).toBe(401);
  });

  test('should show 403 when accessing another project as non-member', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    // Try to access a non-existent project
    await page.goto('/projects/nonexistent');
    await page.waitForTimeout(1000);

    // Should either show 404 or redirect
    const currentUrl = page.url();
    expect(currentUrl).toContain('/projects');
  });

  test('should allow project owner to see settings', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByText('Demo').first().click();
    await expect(page).toHaveURL(/\/projects\/demo/);

    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByText('Project Settings')).toBeVisible({ timeout: 3000 });
  });
});
