import { test, expect } from '@playwright/test';

test.describe('Zyphe AI - Stable Regression Suite', () => {

    test.beforeEach(async ({ page }) => {
        // Capture console logs for debugging
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.text().includes('Gemini') || msg.text().includes('AI')) {
                console.log(`PAGE LOG: [${msg.type()}] ${msg.text()}`);
            }
        });

        // Mock Radar Geocode API
        await page.route('**/api.radar.io/v1/geocode/forward*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    addresses: [{
                        latitude: 37.6624,
                        longitude: -121.8747,
                        formattedAddress: '551 Vista Arroyo, Pleasanton, CA 94566',
                        street: '551 Vista Arroyo',
                        city: 'Pleasanton',
                        state: 'CA',
                        postalCode: '94566',
                        country: 'US'
                    }]
                })
            });
        });

        // Mock RapidAPI US Housing Property Data
        await page.route('**/us-housing-market-data1.p.rapidapi.com/property*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    zpid: '18485290',
                    address: { streetAddress: '551 Vista Arroyo', city: 'Pleasanton', state: 'CA', zipcode: '94566' },
                    price: 1500000,
                    zestimate: 1550000,
                    bedrooms: 4,
                    bathrooms: 3,
                    livingAreaValue: 2400,
                    yearBuilt: 1995,
                    homeType: 'SINGLE_FAMILY',
                    homeStatus: 'FOR_SALE',
                    description: 'Beautiful home in Pleasanton with modern finishes.',
                    resoFacts: { lotSize: '0.25 acres' },
                    climate: { floodSources: { primary: { riskScore: 1 } } },
                    schools: [{ name: 'Pleasanton High', rating: 9, distance: '0.5 mi' }]
                })
            });
        });

        // Mock other RapidAPI endpoints (WalkScore, Comps, etc.)
        await page.route('**/walkAndTransitScore*', async route => {
            await route.fulfill({ body: JSON.stringify({ walkScore: { walkscore: 75, description: 'Very Walkable' } }) });
        });
        await page.route('**/propertyComps*', async route => {
            await route.fulfill({ body: JSON.stringify({ comps: [{ address: '123 Test St', price: 1400000 }] }) });
        });
        await page.route('**/images*', async route => {
            await route.fulfill({ body: JSON.stringify(['https://images.zillowstatic.com/fp/4cae966e6093416790a3c267a3a9926c-full.webp']) });
        });
    });

    test('Landing Page - Smoke Test', async ({ page }) => {
        await page.goto('/');
        const logo = page.locator('header svg').first();
        await expect(logo).toBeVisible();
        await expect(page.getByPlaceholder('Enter property address...')).toBeVisible();
        await expect(page.getByText('most advanced property analysis suite', { exact: false })).toBeVisible();
    });

    test('Core User Journey - Search and Analysis Flow', async ({ page }) => {
        test.setTimeout(600000); // 10 minutes

        await page.goto('/');

        // 1. Search
        const searchInput = page.getByPlaceholder('Enter property address...');
        await searchInput.fill('551 Vista Arroyo');
        await page.getByRole('button', { name: 'Analyze' }).click();

        // 2. Verify Property Data Page
        await expect(page.locator('h2', { hasText: /Vista Arroyo/i })).toBeVisible({ timeout: 20000 });
        await expect(page.getByText('Physical Specifications')).toBeVisible();
        await expect(page.getByText('Value & Market Status')).toBeVisible();
        await expect(page.getByText('Mobility scores', { exact: false })).toBeVisible();
        await expect(page.getByText('Performance', { exact: false })).toBeVisible();
        await expect(page.getByText('Climate Risk', { exact: false })).toBeVisible();

        // 3. Trigger Visual AI Analysis
        await page.getByRole('button', { name: 'View Visual AI Analysis' }).click();
        await expect(page.getByText('Visual Scanning', { exact: false })).toBeVisible();

        // Wait for AI generation
        await expect(page.getByText('SUMMARY', { exact: true })).toBeVisible({ timeout: 200000 });

        // 4. Test all Analysis Tabs
        const tabs = [
            'Interior',
            'Rooms',
            'Exterior',
            'Neighborhood',
            'Community Pulse',
            'Picture Quality Audit',
            'Investment Research',

        ];

        for (const label of tabs) {
            const tabElement = page.getByText(label, { exact: true }).first();
            await tabElement.click();

            if (label === 'Community Pulse') {
                await expect(page.getByText('Resident Highlights', { exact: true })).toBeVisible({ timeout: 15000 });
            } else if (label === 'Investment Research') {
                await expect(page.getByText('STR INVESTMENT SUMMARY')).toBeVisible({ timeout: 150000 });

            }
        }

        // 5. Trigger Comprehensive Report
        await page.getByRole('button', { name: 'Generate Full Report' }).click();
        await expect(page.getByText('Drafting Comprehensive Intelligence...', { exact: false })).toBeVisible();

        // Race between success and error card
        const executiveSummary = page.getByText('Executive Summary', { exact: true });
        const errorCard = page.locator('.bg-rose-50');

        await Promise.race([
            executiveSummary.waitFor({ state: 'visible', timeout: 300000 }),
            errorCard.waitFor({ state: 'visible', timeout: 300000 }).then(async () => {
                const text = await errorCard.textContent();
                throw new Error(`Report generation failed with UI error: ${text}`);
            })
        ]);

        // Verify report sections
        await expect(page.getByText('Location & Neighborhood', { exact: true })).toBeVisible();
        await expect(page.getByText('Critical Risks & Considerations', { exact: true })).toBeVisible();
        await expect(page.getByText('ZYPHE INTELLIGENCE SYSTEMS', { exact: false })).toBeVisible();
    });

    test('Authentication - Modal Functional Check', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('button', { name: 'Sign In' }).click();
        await expect(page.getByText('Welcome Back', { exact: true })).toBeVisible();
        await expect(page.getByPlaceholder('email@example.com')).toBeVisible();
    });
});
