import { test, expect } from '@playwright/test';

const uniqueEmail = `e2e-${Date.now()}@test.com`;

test.describe('Registration', () => {
  test('should register a new user and redirect to projects', async ({ page }) => {
    await page.goto('/register');

    await page.getByPlaceholder(/name/i).fill('E2E User');
    await page.getByPlaceholder('Email').fill(uniqueEmail);
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: /sign up|register|create/i }).click();

    await expect(page).toHaveURL('/projects', { timeout: 10000 });
    await expect(page.getByText('Projects')).toBeVisible();
  });

  test('should reject duplicate email registration', async ({ page }) => {
    await page.goto('/register');

    await page.getByPlaceholder(/name/i).fill('E2E Dupe');
    await page.getByPlaceholder('Email').fill(uniqueEmail);
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: /sign up|register|create/i }).click();

    await expect(page.getByText(/already exists|error|failed/i)).toBeVisible({ timeout: 5000 });
  });
});
