import { test, expect } from '@playwright/test';

test.describe('Profile', () => {
  test.use({ storageState: undefined });

  test('should view profile page with current name', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    // Navigate to Profile directly (sidebar is rendered twice for
    // mobile/desktop — a plain locator would hit the hidden copy)
    await page.goto('/profile');
    await expect(page).toHaveURL('/profile');
    // Name input should be visible with current value
    await expect(page.getByPlaceholder('Your name')).toBeVisible({ timeout: 3000 });
    // Email should be visible (scoped to main: the sidebar duplicates it,
    // including a hidden mobile copy)
    await expect(page.locator('main').getByText('alice@example.com')).toBeVisible();
  });

  test('should update display name', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    // Go to profile
    await page.goto('/profile');
    await expect(page).toHaveURL('/profile');

    const newName = `Alice E2E ${Date.now()}`;
    await page.getByPlaceholder('Your name').fill(newName);
    // Click save button (scoped to the profile form — the page has more Save buttons)
    const profileForm = page.locator('form', { has: page.getByPlaceholder('Your name') });
    await profileForm.getByRole('button', { name: 'Save' }).click();
    // Verify success feedback
    await expect(page.getByText('Profile updated.')).toBeVisible({ timeout: 5000 });

    // Reload and verify persistence
    await page.reload();
    await page.waitForTimeout(1000);
    await expect(page.getByPlaceholder('Your name')).toHaveValue(newName, { timeout: 3000 });

    // Restore original name
    await page.getByPlaceholder('Your name').fill('Alice');
    await profileForm.getByRole('button', { name: 'Save' }).click();
  });
});
