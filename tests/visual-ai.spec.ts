import { test, expect } from '@playwright/test';

test.describe('Zyphe AI - Visual AI & Analysis Tabs', () => {

    test.beforeEach(async ({ page }) => {
        // Mock API responses for property data
        await page.route('**/api.radar.io/v1/geocode/forward*', async route => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({
                    addresses: [{
                        latitude: 37.6624, longitude: -121.8747,
                        formattedAddress: '551 Vista Arroyo, CA', city: 'Pleasanton', state: 'CA'
                    }]
                })
            });
        });

        await page.route('**/us-housing-market-data1.p.rapidapi.com/property*', async route => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({
                    zpid: '18485290',
                    address: { streetAddress: '551 Vista Arroyo', city: 'Pleasanton', state: 'CA', zipcode: '94566' },
                    price: 1500000,
                    homeStatus: 'FOR_SALE'
                })
            });
        });

        await page.route('**/images*', async route => {
            await route.fulfill({ body: JSON.stringify(['https://images.zillowstatic.com/fp/4cae966e6093416790a3c267a3a9926c-full.webp']) });
        });

        // Navigate and get to the analysis view
        await page.goto('/');
        await page.getByPlaceholder('Enter property address...').fill('551 Vista Arroyo');
        await page.getByRole('button', { name: 'Analyze' }).click();
        await page.getByRole('button', { name: 'View Visual AI Analysis' }).click();

        // Wait for the analysis tabs to appear
        await expect(page.getByText('Interior', { exact: true }).first()).toBeVisible({ timeout: 60000 });
    });

    test('Tab Navigation: Community Pulse (Handles Empty State)', async ({ page }) => {
        await page.getByText('Community Pulse', { exact: true }).first().click();

        // Assert: The view should be visible
        const content = page.locator('section');
        await expect(content).toBeVisible();

        // Assert: If "Resident Highlights" (data) isn't there, "No Community Pulse Data Yet" (empty state) MUST be
        const hasData = await page.getByText('Resident Highlights').isVisible();
        if (!hasData) {
            await expect(page.getByText('No Community Pulse Data Yet')).toBeVisible();
        }
    });

    test('Tab Navigation: Picture Quality Audit (Handles Fallbacks)', async ({ page }) => {
        await page.getByText('Picture Quality Audit', { exact: true }).first().click();

        // Assert: Check for either a loading spinner, EmptyState, or valid data
        await expect(page.locator('section')).toBeVisible();
        const emptyStateText = page.getByText('No Quality Audit Data Yet');
        const loadingText = page.getByText('Picture Audit...');
        const dataText = page.getByText('Audit Verdict');

        // The .or() ensures that as long as the page shows something meaningful (not a blank screen), the test passes
        await expect(emptyStateText.or(loadingText).or(dataText)).toBeVisible();
    });

    // ... other basic tab navigation checks ...
    test('Tab Navigation: Interior View', async ({ page }) => {
        await page.getByText('Interior', { exact: true }).first().click();
        await expect(page.getByText('Interior', { exact: true }).first()).toHaveClass(/bg-gradient-to-r/);
    });

    test('Tab Navigation: Rooms View', async ({ page }) => {
        await page.getByText('Rooms', { exact: true }).first().click();
        await expect(page.getByText('Rooms', { exact: true }).first()).toHaveClass(/bg-gradient-to-r/);
    });

    test('Action: Back Button functionality', async ({ page }) => {
        await page.getByRole('button', { name: 'Back' }).click();
        await expect(page.getByRole('button', { name: 'View Visual AI Analysis' })).toBeVisible();
    });
});
