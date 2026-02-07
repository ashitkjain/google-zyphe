import { test, expect } from '@playwright/test';

test.describe('Zyphe AI - Client Hub & Realtor Dashboard', () => {

    test.beforeEach(async ({ page }) => {
        // Navigate to the realtor section
        await page.goto('/realtor/leads');

        // Handle potential login requirement in mock way if needed
        const signInBtn = page.getByRole('button', { name: 'Sign In to Zyphe' });
        if (await signInBtn.isVisible()) {
            await signInBtn.click();
        }

        // Wait for the hub to load
        await expect(page.locator('header')).toBeVisible();
    });

    test('Dashboard: Navigate to Explore', async ({ page }) => {
        await page.locator('nav').getByText('Explore').click();
        await expect(page).toHaveURL(/.*explore/);
        await expect(page.getByPlaceholder('Enter property address...')).toBeVisible();
    });

    test('Dashboard: Navigate to Leads', async ({ page }) => {
        await page.locator('nav').getByText('Leads').click();
        await expect(page).toHaveURL(/.*leads/);
        await expect(page.getByRole('button', { name: 'Add Lead' })).toBeVisible();
    });

    test('Dashboard: Navigate to Tasks', async ({ page }) => {
        await page.locator('nav').getByText('Tasks').click();
        await expect(page).toHaveURL(/.*tasks/);
        await expect(page.getByText('Pipeline Overview')).toBeVisible();
    });

    test('Dashboard: Navigate to Calendar', async ({ page }) => {
        await page.locator('nav').getByText('Calendar').click();
        await expect(page).toHaveURL(/.*calendar/);
        await expect(page.getByText('Schedule Intelligence')).toBeVisible();
    });

    test('Dashboard: Navigate to Closing', async ({ page }) => {
        await page.locator('nav').getByText('Closing').click();
        await expect(page).toHaveURL(/.*closing/);
        await expect(page.getByText('Transaction Center')).toBeVisible();
    });

    test('Dashboard: Navigate to Setting', async ({ page }) => {
        await page.locator('nav').getByText('Setting').click();
        await expect(page).toHaveURL(/.*setting/);
        await expect(page.getByText('Platform Configuration')).toBeVisible();
    });

    test('Dashboard: Navigate to Whiteboard', async ({ page }) => {
        await page.locator('nav').getByText('Whiteboard').click();
        await expect(page).toHaveURL(/.*whiteboard/);
        await expect(page.getByText('Creative Whiteboard')).toBeVisible();
    });

    test('Dashboard: Navigate to Reactivate', async ({ page }) => {
        await page.locator('nav').getByText('Reactivate').click();
        await expect(page).toHaveURL(/.*reactivate/);
        await expect(page.getByText('Reactivation Suite')).toBeVisible();
    });

    test('Header: Navigate to Profile', async ({ page }) => {
        const profileImg = page.locator('header img[alt="Profile"]');
        if (await profileImg.isVisible()) {
            await profileImg.click();
            await expect(page).toHaveURL(/.*profile/);
        }
    });

    test('Settings: Open Add Client Modal', async ({ page }) => {
        await page.locator('button i.fa-gear').locator('xpath=..').click();
        await page.getByText('Add a client').click();
        await expect(page.getByText('Add New Lead')).toBeVisible();
    });

    test('Settings: Open Remove Client Modal', async ({ page }) => {
        await page.locator('button i.fa-gear').locator('xpath=..').click();
        await page.getByText('Remove a client').click();
        await expect(page.getByText('Remove Client Data')).toBeVisible();
    });

    test('Admin Tools: Add Mock Data', async ({ page }) => {
        // Open tools menu
        await page.getByRole('button', { name: 'Tools' }).click();
        const addMockBtn = page.getByText('Add Mock Data');
        await expect(addMockBtn).toBeVisible();
        // We won't click it to avoid side effects in tests unless we want to, 
        // but checking visibility is a good functional check.
    });

    test('Admin Tools: Purge Data', async ({ page }) => {
        await page.getByRole('button', { name: 'Tools' }).click();
        await expect(page.getByText('Purge All My Data')).toBeVisible();
    });

    test('UI: Sidebar Toggle Mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        const menuBtn = page.locator('button i.fa-bars').locator('xpath=..');
        await expect(menuBtn).toBeVisible();
        await menuBtn.click();
        await expect(page.locator('aside')).toBeVisible();
    });

});
