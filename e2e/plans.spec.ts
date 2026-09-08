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

    const sprintName = `Sprint 1 ${Date.now()}`;
    await page.getByRole('button', { name: /create plan/i }).first().click();
    await page.getByPlaceholder('Plan name').fill(sprintName);
    await page.locator('form').getByRole('button', { name: 'Create plan' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText(sprintName)).toBeVisible();
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

    // Create a plan first (unique names: retries must not clash with attempt 1)
    const editName = `Edit Test ${Date.now()}`;
    const editedName = `Edited Plan ${Date.now()}`;
    await page.getByRole('button', { name: /create plan/i }).first().click();
    await page.getByPlaceholder('Plan name').fill(editName);
    await page.locator('form').getByRole('button', { name: 'Create plan' }).click();
    await page.waitForTimeout(500);

    // Edit it
    await page.getByTitle('Edit plan').first().click();
    await page.getByPlaceholder('Plan name').fill(editedName);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText(editedName)).toBeVisible();
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

    // Create a plan first (unique name: retries must not clash with attempt 1)
    const planName = `Delete Me ${Date.now()}`;
    await page.getByRole('button', { name: /create plan/i }).first().click();
    await page.getByPlaceholder('Plan name').fill(planName);
    await page.locator('form').getByRole('button', { name: 'Create plan' }).click();
    await expect(page.getByText(planName)).toBeVisible({ timeout: 5000 });

    // Delete it (custom ConfirmModal, not a native dialog)
    await page.getByTitle('Delete plan').first().click();
    const confirm = page.getByRole('alertdialog');
    await confirm.getByRole('button', { name: 'Delete' }).click();
    // Confirm dialog closes only after a successful delete
    await expect(confirm).not.toBeVisible({ timeout: 5000 });

    await expect(page.getByText(planName)).not.toBeVisible({ timeout: 5000 });
  });
});
