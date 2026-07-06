import { test, expect } from '@playwright/test';

test.describe('Auth', () => {
  test('should login with seed credentials and see projects page', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL('/projects', { timeout: 10000 });
    await expect(page.getByText('Projects')).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('Email').fill('wrong@example.com');
    await page.getByPlaceholder('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText(/login failed/i)).toBeVisible({ timeout: 5000 });
  });

  test('should logout and redirect to login', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL('/login', { timeout: 5000 });
    // Verify we're actually logged out — login page is shown
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });
});
