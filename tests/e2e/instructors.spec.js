import { test, expect } from '@playwright/test';

const BASE = process.env.CI ? 'http://localhost:4173/WorkloadScheduler/' : 'http://localhost:5173/WorkloadScheduler/';

/** Add an instructor via the sidebar form. */
async function addInstructor(page, name) {
    await page.fill('#instructorName', name);
    await page.click('#addInstructorForm button[type="submit"]');
    await expect(page.locator('.instructor-item').filter({ hasText: name })).toBeVisible();
}

test.describe('Instructor management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.evaluate(() => localStorage.clear());
        await page.reload();
    });

    test('adds a new instructor', async ({ page }) => {
        await addInstructor(page, 'Dr. Smith');
        await expect(page.locator('.instructor-item')).toContainText('Dr. Smith');
    });

    test('removes an instructor', async ({ page }) => {
        await addInstructor(page, 'Dr. Jones');
        await page.locator('.instructor-item').first().locator('[data-action="instructor-remove"]').click();
        await expect(page.locator('.instructor-item')).toHaveCount(0);
    });

    test('multiple instructors can be added independently', async ({ page }) => {
        await addInstructor(page, 'Dr. Jones');
        await addInstructor(page, 'Prof. Lee');
        await expect(page.locator('.instructor-item')).toHaveCount(2);
    });

    test('opens edit modal on double-click of instructor', async ({ page }) => {
        await addInstructor(page, 'Prof. Brown');
        await page.locator('.instructor-item').first().dblclick();
        await expect(page.locator('#instructorModal')).toBeVisible();
    });

    test('saves instructor name change from modal', async ({ page }) => {
        await addInstructor(page, 'Prof. Original');
        await page.locator('.instructor-item').first().dblclick();
        await page.fill('#editInstructorName', 'Prof. Renamed');
        await page.locator('#editInstructorForm button[type="submit"]').click();
        await expect(page.locator('.instructor-item')).toContainText('Prof. Renamed');
    });
});
