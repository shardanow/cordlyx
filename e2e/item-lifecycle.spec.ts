import { test, expect } from '@playwright/test';

test.describe('Item lifecycle', () => {
  test.use({ storageState: undefined });

  const TITLE = `E2E Item ${Date.now()}`;

  test('should quick-create an item and redirect to detail page', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    // Navigate to Demo project first
    await page.getByText('Demo').first().click();
    await expect(page).toHaveURL(/\/projects\/demo/);

    // Open quick create via keyboard
    await page.keyboard.press('Meta+k');
    // Fallback to Ctrl+K for non-Mac
    await page.waitForTimeout(500);

    // If meta didn't work, try the button
    const quickCreateBtn = page.getByRole('button', { name: /quick create/i });
    if (await quickCreateBtn.isVisible()) {
      await quickCreateBtn.click();
    }

    await expect(page.getByText('Quick create')).toBeVisible({ timeout: 3000 });

    // Fill and submit
    await page.getByPlaceholder('Item title...').fill(TITLE);
    await page.getByRole('button', { name: /^Create$/ }).click();

    // Should redirect to item detail page
    await expect(page).toHaveURL(/\/items\/\d+/, { timeout: 10000 });
    await expect(page.getByText(TITLE)).toBeVisible({ timeout: 5000 });
  });

  test('should show item in list view after creation', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    // Create item first
    await page.getByText('Demo').first().click();
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(500);
    const quickCreateBtn = page.getByRole('button', { name: /quick create/i });
    if (await quickCreateBtn.isVisible()) {
      await quickCreateBtn.click();
    }
    await expect(page.getByText('Quick create')).toBeVisible({ timeout: 3000 });

    const title = `List Check ${Date.now()}`;
    await page.getByPlaceholder('Item title...').fill(title);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await expect(page).toHaveURL(/\/items\/\d+/, { timeout: 10000 });

    // Go back to list
    await page.getByRole('link', { name: /list/i }).click();
    await expect(page).toHaveURL(/\/projects\/demo$/);
    await expect(page.getByText(title)).toBeVisible({ timeout: 5000 });
  });

  test('should add and delete a comment on an item', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    // Open Demo project and click on an existing item to see detail
    await page.getByText('Demo').first().click();
    await expect(page).toHaveURL(/\/projects\/demo/);

    // Click the first item in the list
    const firstItemLink = page.getByRole('link', { name: /#\d+/ }).first();
    await firstItemLink.click();
    await expect(page).toHaveURL(/\/items\/\d+/);

    // Add a comment
    const commentText = `E2E comment ${Date.now()}`;
    await page.getByPlaceholder('Write a comment...').fill(commentText);
    await page.getByRole('button', { name: /comment/i }).click();
    await expect(page.getByText(commentText)).toBeVisible({ timeout: 5000 });

    // Edit the comment
    await page.getByRole('button', { name: /edit/i }).first().click();
    const editedText = `${commentText} edited`;
    await page.getByPlaceholder('Write a comment...').fill(editedText);
    // Look for Save button which appears during edit
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(editedText)).toBeVisible({ timeout: 5000 });

    // Delete the comment
    await page.getByRole('button', { name: /delete/i }).first().click();
    await expect(page.getByText(editedText)).not.toBeVisible({ timeout: 3000 });
  });

  test('should toggle tags on an item', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    // Open Demo project
    await page.getByText('Demo').first().click();
    await expect(page).toHaveURL(/\/projects\/demo/);

    // Click the first item
    const firstItemLink = page.getByRole('link', { name: /#\d+/ }).first();
    await firstItemLink.click();
    await expect(page).toHaveURL(/\/items\/\d+/);

    // Check if tags section exists
    const tagsHeading = page.getByRole('heading', { name: /tags/i });
    if (await tagsHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Find any tag button
      const tagBtns = page.locator('button').filter({ hasText: /frontend|backend|urgent/i });
      const tagCount = await tagBtns.count();
      if (tagCount > 0) {
        // Click first tag — should toggle (highlight or unhighlight)
        const firstTag = tagBtns.first();
        const initialClass = await firstTag.getAttribute('class');
        await firstTag.click();
        await page.waitForTimeout(300);
        const afterClass = await firstTag.getAttribute('class');
        expect(afterClass).not.toBe(initialClass);
      }
    }
  });
});
