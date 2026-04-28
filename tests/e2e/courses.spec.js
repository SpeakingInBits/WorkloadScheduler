import { test, expect } from '@playwright/test';

const BASE = process.env.CI ? 'http://localhost:4173/WorkloadScheduler/' : 'http://localhost:5173/WorkloadScheduler/';

/** Add a course via the sidebar form. Credits are required. */
async function addCourse(page, { name = '', number = '', credits = '3', programValue = '' } = {}) {
    if (name)    await page.fill('#courseName', name);
    if (number)  await page.fill('#courseNumber', number);
    await page.fill('#courseCredits', credits);
    if (programValue) await page.selectOption('#courseProgram', programValue);
    await page.click('#addCourseForm button[type="submit"]');
}

test.describe('Course management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.evaluate(() => localStorage.clear());
        await page.reload();
    });

    test('adds a course to the catalog', async ({ page }) => {
        await addCourse(page, { name: 'Calculus', number: '201', credits: '4' });
        await expect(page.locator('.course-item')).toContainText('Calculus');
    });

    test('does not add a course without credits (required field)', async ({ page }) => {
        // Credits input is required — HTML validation blocks the submit event
        await page.fill('#courseNumber', '999');
        await page.fill('#courseName', 'Test Course');
        await page.click('#addCourseForm button[type="submit"]');
        await expect(page.locator('.course-item')).toHaveCount(0);
    });

    test('removes a course', async ({ page }) => {
        await addCourse(page, { name: 'To Remove', credits: '3' });
        await page.locator('.course-item').first().locator('[data-action="course-remove"]').click();
        await expect(page.locator('.course-item')).toHaveCount(0);
    });

    test('opens edit modal on double-click of course', async ({ page }) => {
        await addCourse(page, { name: 'Physics', credits: '3' });
        await page.locator('.course-item').first().dblclick();
        await expect(page.locator('#courseModal')).toBeVisible();
    });

    test('saves course name change from modal', async ({ page }) => {
        await addCourse(page, { name: 'Old Name', credits: '3' });
        await page.locator('.course-item').first().dblclick();
        await page.fill('#editCourseName', 'New Name');
        await page.locator('#editCourseForm button[type="submit"]').click();
        await expect(page.locator('.course-item')).toContainText('New Name');
    });

    test('program filter shows only matching courses', async ({ page }) => {
        // Add a program via the sidebar form
        await page.fill('#programName', 'CPW');
        await page.click('#addProgramForm button[type="submit"]');

        // Wait for the #courseProgram select to include the new program
        const programOption = page.locator('#courseProgram option').filter({ hasText: 'CPW' });
        await expect(programOption).toBeAttached();
        const programVal = await programOption.getAttribute('value');

        // Add a course in CPW
        await addCourse(page, { name: 'CPW Course', credits: '3', programValue: programVal });

        // Add a course with no program (clear credits field first, then re-fill)
        await addCourse(page, { name: 'Standalone Course', credits: '2' });

        // Filter by CPW
        await page.selectOption('#programFilterSelect', programVal);

        await expect(page.locator('.course-item')).toHaveCount(1);
        await expect(page.locator('.course-item')).toContainText('CPW Course');
    });
});
