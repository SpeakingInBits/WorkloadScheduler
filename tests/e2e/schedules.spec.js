import { test, expect } from '@playwright/test';

const BASE = process.env.CI ? 'http://localhost:4173/WorkloadScheduler/' : 'http://localhost:5173/WorkloadScheduler/';

/**
 * ScheduleManager.create() fires three dialogs:
 *   1. prompt  — schedule name
 *   2. prompt  — quarter (must be Fall/Winter/Spring/Summer)
 *   3. confirm — copy existing schedule (dismiss = start empty)
 * Any alert dialogs (invalid input) are dismissed automatically.
 */
function attachCreateDialogs(page, name, quarter = 'Fall') {
    let promptCount = 0;
    let confirmCount = 0;
    page.on('dialog', async dialog => {
        if (dialog.type() === 'prompt') {
            promptCount++;
            if (promptCount === 1) await dialog.accept(name);
            else if (promptCount === 2) await dialog.accept(quarter);
            else await dialog.dismiss();
        } else if (dialog.type() === 'confirm') {
            confirmCount++;
            if (confirmCount === 1) await dialog.dismiss(); // don't copy existing
            else await dialog.accept();                     // delete confirm
        } else {
            await dialog.dismiss(); // alerts
        }
    });
}

test.describe('Schedule management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.evaluate(() => localStorage.clear());
        await page.reload();
    });

    test('default schedule is present on first load', async ({ page }) => {
        const selected = await page.locator('#scheduleSelect').inputValue();
        expect(selected).toBeTruthy();
    });

    test('creates a new schedule via the New Schedule button', async ({ page }) => {
        attachCreateDialogs(page, 'Test Schedule 2026');
        await page.click('#newScheduleBtn');
        await expect(page.locator('#scheduleSelect')).toHaveValue('Test Schedule 2026');
    });

    test('renames the current schedule', async ({ page }) => {
        page.on('dialog', async dialog => {
            if (dialog.type() === 'prompt') await dialog.accept('Renamed Schedule');
            else await dialog.dismiss();
        });
        await page.click('#renameScheduleBtn');
        const options = await page.locator('#scheduleSelect option').allTextContents();
        expect(options.some(o => o.includes('Renamed Schedule'))).toBe(true);
    });

    test('deletes a non-default schedule', async ({ page }) => {
        // Create a schedule then delete it
        // Dialog order: name prompt, quarter prompt, copy-confirm (dismiss), then delete-confirm (accept)
        let promptCount = 0;
        let confirmCount = 0;
        page.on('dialog', async dialog => {
            if (dialog.type() === 'prompt') {
                promptCount++;
                if (promptCount === 1) await dialog.accept('To Delete');
                else if (promptCount === 2) await dialog.accept('Fall');
                else await dialog.dismiss();
            } else if (dialog.type() === 'confirm') {
                confirmCount++;
                if (confirmCount === 1) await dialog.dismiss(); // don't copy
                else await dialog.accept();                     // confirm delete
            } else {
                await dialog.dismiss();
            }
        });

        await page.click('#newScheduleBtn');
        await expect(page.locator('#scheduleSelect')).toHaveValue('To Delete');
        await page.click('#deleteScheduleBtn');

        const options = await page.locator('#scheduleSelect option').allTextContents();
        expect(options.every(o => !o.includes('To Delete'))).toBe(true);
    });

    test('switches between schedules', async ({ page }) => {
        attachCreateDialogs(page, 'Second Schedule');
        await page.click('#newScheduleBtn');
        await expect(page.locator('#scheduleSelect')).toHaveValue('Second Schedule');

        // Switch back to the default
        await page.locator('#scheduleSelect').selectOption({ index: 0 });
        await page.locator('#scheduleSelect').dispatchEvent('change');
        const selected = await page.locator('#scheduleSelect').inputValue();
        expect(selected).not.toBe('Second Schedule');
    });

    test('can set a quarter on the current schedule', async ({ page }) => {
        await page.selectOption('#scheduleQuarter', 'Fall');
        await page.reload();
        await expect(page.locator('#scheduleQuarter')).toHaveValue('Fall');
    });
});
