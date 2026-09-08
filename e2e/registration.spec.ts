import { test, expect } from '@playwright/test';

test.describe('Registration', () => {
  test('should register a new user and redirect to projects', async ({ page }) => {
    const uniqueEmail = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.com`;
    await page.goto('/register');

    await page.getByPlaceholder('Username (letters, numbers, _)').fill(`e2euser${Date.now() % 1000000}`);
    await page.getByPlaceholder('Display name').fill('E2E User');
    await page.getByPlaceholder('Email').fill(uniqueEmail);
    await page.getByPlaceholder('Password (min 8 chars)').fill('password123');
    await page.getByRole('button', { name: 'Register', exact: true }).click();

    await expect(page).toHaveURL('/projects', { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  });

  test('should reject duplicate email registration', async ({ page }) => {
    await page.goto('/register');

    await page.getByPlaceholder('Username (letters, numbers, _)').fill(`e2edupe${Date.now() % 1000000}`);
    await page.getByPlaceholder('Display name').fill('E2E Dupe');
    // alice@example.com is seeded, so this must fail as a duplicate
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password (min 8 chars)').fill('password123');
    await page.getByRole('button', { name: 'Register', exact: true }).click();

    await expect(page.getByText(/already taken|already exists|error|failed/i)).toBeVisible({ timeout: 5000 });
  });
});
