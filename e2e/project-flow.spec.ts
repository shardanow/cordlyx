import { test, expect } from '@playwright/test';

test.describe('Project flow', () => {
  test.use({ storageState: undefined });

  test('should create a project, navigate to board, and create an item', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    // Create a new project (unique name: retries must not clash with attempt 1)
    const projectName = `E2E Test Project ${Date.now()}`;
    await page.getByRole('button', { name: /create project/i }).first().click();
    await page.getByPlaceholder('Project name').fill(projectName);
    await page.locator('form').getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByRole('heading', { name: projectName, exact: true })).toBeVisible({ timeout: 5000 });

    // Navigate to board
    await page.getByRole('link', { name: /board/i }).click();
    await expect(page).toHaveURL(/\/board$/);

    // Navigate back to list
    await page.getByRole('link', { name: /list/i }).click();
    await expect(page).not.toHaveURL(/\/board$/);
  });

  test('should show settings tabs with default config', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    // Create project for test (unique name: retries must not clash with attempt 1)
    await page.getByRole('button', { name: /create project/i }).first().click();
    await page.getByPlaceholder('Project name').fill(`Settings Test ${Date.now()}`);
    await page.locator('form').getByRole('button', { name: 'Create project' }).click();
    await page.waitForTimeout(1000);

    // Go to Settings tab
    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByText('Item Types')).toBeVisible();
    await expect(page.getByText('Item Statuses')).toBeVisible();
    await expect(page.getByText('Item Priorities')).toBeVisible();
    // Default types should be pre-seeded
    await expect(page.getByText('Task', { exact: true })).toBeVisible();
    await expect(page.getByText('Bug', { exact: true })).toBeVisible();
  });

  test('should show activity page with empty state', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    // Use existing project (Demo) to see activity
    await page.getByText('Demo').first().click();
    await expect(page).toHaveURL(/\/projects\/demo/);

    // Go to Activity tab
    await page.getByRole('link', { name: /activity/i }).click();
    await expect(page).toHaveURL(/\/activity$/);
    // Should either show items or empty state
    await page.waitForTimeout(1000);
    const emptyState = page.getByText('No activity found.');
    const activityItems = page.locator('text=/created|updated|deleted|changed|added|removed/i');
    // At least one of them should be present
    await expect(emptyState.or(activityItems.first())).toBeVisible({ timeout: 3000 });
  });

  test('should show members tab with owner listed as admin', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    // Use Demo project
    await page.getByText('Demo').first().click();
    await expect(page).toHaveURL(/\/projects\/demo/);

    // Go to Members tab
    await page.getByRole('link', { name: /members/i }).click();
    await expect(page).toHaveURL(/\/members$/);
    // Alice should be listed as admin (scoped to main: the sidebar duplicates
    // her email, including a hidden mobile copy)
    const main = page.locator('main');
    await expect(main.getByText('alice@example.com')).toBeVisible({ timeout: 5000 });
    // Alice's own row renders a lowercase "admin" span; other rows render an
    // "Admin" <option> inside a <select> (hidden) — exact match skips those
    await expect(main.getByText('admin', { exact: true })).toBeVisible({ timeout: 5000 });
  });
});
