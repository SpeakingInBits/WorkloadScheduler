import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const BASE = process.env.CI ? 'http://localhost:4173/WorkloadScheduler/' : 'http://localhost:5173/WorkloadScheduler/';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_DATA = path.resolve(__dirname, '../../docs/sample-data/workload-schedule-2026-01-20-SampleData-v3.json');

/**
 * Import a file via the hidden #fileInput element.
 * importSchedule() uses FileReader (async), so dialogs fire AFTER setInputFiles resolves.
 * waitForEvent must be registered before setInputFiles.
 * Dialog sequence: 1) prompt for schedule name, 2) alert for success
 */
async function importFile(page, filePath) {
    // Register before triggering the file change
    const nameDialogPromise = page.waitForEvent('dialog');
    await page.locator('#fileInput').setInputFiles(filePath);

    // Handle the schedule-name prompt
    const nameDialog = await nameDialogPromise;
    await nameDialog.accept(nameDialog.defaultValue() || 'Imported Schedule');

    // Handle the success alert (catches timeout in case it was auto-dismissed)
    const alertDialog = await page.waitForEvent('dialog', { timeout: 5000 }).catch(() => null);
    if (alertDialog) await alertDialog.dismiss();
}

test.describe('Import / Export', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE);
        await page.evaluate(() => localStorage.clear());
        await page.reload();
    });

    test('imports a JSON schedule file', async ({ page }) => {
        await importFile(page, SAMPLE_DATA);
        // Default Schedule + Sample Schedule = 2 options
        await expect(page.locator('#scheduleSelect option')).toHaveCount(2);
    });

    test('exports the current schedule as JSON', async ({ page }) => {
        // exportSchedule() calls prompt() before triggering the download.
        // page.click() blocks until the dialog is dismissed, so we use Promise.all
        // to handle the dialog concurrently with the click action.
        const downloadPromise = page.waitForEvent('download');
        await Promise.all([
            page.waitForEvent('dialog').then(d => d.accept('test-export')),
            page.click('#exportBtn'),
        ]);
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.json$/);
    });

    test('imported data persists after reload', async ({ page }) => {
        await importFile(page, SAMPLE_DATA);
        const countBefore = await page.locator('#scheduleSelect option').count();
        await page.reload();
        await expect(page.locator('#scheduleSelect option')).toHaveCount(countBefore);
    });

    test('export then re-import round-trips schedule names', async ({ page }) => {
        // Grab the current schedule name before exporting
        const originalName = await page.locator('#scheduleSelect').inputValue();
        const exportPath = path.join(__dirname, 'temp-export.json');

        // Export (prompt fires during click — handle with Promise.all)
        const downloadPromise = page.waitForEvent('download');
        await Promise.all([
            page.waitForEvent('dialog').then(d => d.accept('round-trip-export')),
            page.click('#exportBtn'),
        ]);
        const download = await downloadPromise;
        await download.saveAs(exportPath);

        // Clear data and re-import
        await page.evaluate(() => localStorage.clear());
        await page.reload();

        await importFile(page, exportPath);
        const options = await page.locator('#scheduleSelect option').allTextContents();
        expect(options.some(o => o.includes(originalName))).toBe(true);

        // Cleanup
        if (fs.existsSync(exportPath)) fs.unlinkSync(exportPath);
    });
});
