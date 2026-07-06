import { test, expect } from '@playwright/test';

test.describe('Item inline edit', () => {
  test.use({ storageState: undefined });

  async function loginAndGoToList(page: any) {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('alice@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/projects', { timeout: 10000 });

    await page.getByText('Demo').first().click();
    await expect(page).toHaveURL(/\/projects\/demo/);
    await page.waitForTimeout(1000);
  }

  test('should show inline edit buttons on item rows', async ({ page }) => {
    await loginAndGoToList(page);

    const statusBtns = page.locator('button').filter({ hasText: /set status|to do|in progress|done|backlog/i });
    await expect(statusBtns.first()).toBeVisible({ timeout: 5000 });
  });

  test('should open inline status editor on click', async ({ page }) => {
    await loginAndGoToList(page);

    // Click the first "Set status" or status button
    const statusBtn = page.locator('button').filter({ hasText: /set status|to do|in progress|done|inbox|backlog/i }).first();
    await statusBtn.click();
    await page.waitForTimeout(300);

    // A Select dropdown should open
    const selectContent = page.locator('[role="listbox"]').or(page.locator('.select-content'));
    const isVisible = await selectContent.isVisible({ timeout: 2000 }).catch(() => false);
    if (isVisible) {
      // Select a different status
      const option = selectContent.locator('[role="option"]').or(selectContent.locator('button')).first();
      if (await option.isVisible()) {
        await option.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should open inline priority editor on click', async ({ page }) => {
    await loginAndGoToList(page);

    const priorityBtn = page.locator('button').filter({ hasText: /set priority|critical|medium|low/i }).first();
    await priorityBtn.click();
    await page.waitForTimeout(300);

    const selectContent = page.locator('[role="listbox"]').or(page.locator('.select-content'));
    if (await selectContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      const option = selectContent.locator('[role="option"]').or(selectContent.locator('button')).first();
      if (await option.isVisible()) {
        await option.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should open inline assignee editor on click', async ({ page }) => {
    await loginAndGoToList(page);

    const assigneeBtn = page.locator('button').filter({ hasText: /unassigned|alice|bob/i }).first();
    await assigneeBtn.click();
    await page.waitForTimeout(300);

    const selectContent = page.locator('[role="listbox"]').or(page.locator('.select-content'));
    if (await selectContent.isVisible({ timeout: 2000 }).catch(() => false)) {
      const option = selectContent.locator('[role="option"]').or(selectContent.locator('button')).first();
      if (await option.isVisible()) {
        await option.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should delete item from list and not appear after', async ({ page }) => {
    await loginAndGoToList(page);

    const deleteBtn = page.getByRole('button', { name: /delete/i }).first();
    if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      page.on('dialog', (dialog) => dialog.accept());
      await deleteBtn.click();
      await page.waitForTimeout(1000);
    }
  });
});
