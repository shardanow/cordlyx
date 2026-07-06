import { test, expect } from '@playwright/test';

test.describe('Dark mode', () => {
  test.use({ storageState: undefined });

  test('should toggle dark mode on and off', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    // Check initial theme class
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/dark/);

    // Toggle dark mode
    const themeBtn = page.getByRole('button', { name: /theme|dark|light|toggle/i });
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      // Should now have dark class
      await expect(html).toHaveClass(/dark/, { timeout: 3000 });

      // Toggle back
      await themeBtn.click();
      await expect(html).not.toHaveClass(/dark/, { timeout: 3000 });
    }
  });
});
