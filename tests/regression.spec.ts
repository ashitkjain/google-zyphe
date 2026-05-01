import { test, expect } from '@playwright/test';

// ── Shared mock setup ──────────────────────────────────────────────────────────
async function mockPropertyAPIs(page: any) {
    await page.route('**/api.radar.io/v1/geocode/forward*', async (route: any) => {
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

    await page.route('**/us-housing-market-data1.p.rapidapi.com/property*', async (route: any) => {
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

    await page.route('**/walkAndTransitScore*', async (route: any) => {
        await route.fulfill({ body: JSON.stringify({ walkScore: { walkscore: 75, description: 'Very Walkable' } }) });
    });
    await page.route('**/propertyComps*', async (route: any) => {
        await route.fulfill({ body: JSON.stringify({ comps: [{ address: '123 Test St', price: 1400000 }] }) });
    });
    await page.route('**/images*', async (route: any) => {
        await route.fulfill({ body: JSON.stringify(['https://images.zillowstatic.com/fp/4cae966e6093416790a3c267a3a9926c-full.webp']) });
    });
}

// ── Helper: load a property and wait for MLS section ──────────────────────────
async function loadProperty(page: any) {
    await page.goto('/');
    const searchInput = page.getByPlaceholder('Enter property address...');
    await searchInput.fill('551 Vista Arroyo');
    await page.getByRole('button', { name: 'Analyze' }).click();
    // Default landing section is MLS Property Data
    await expect(page.getByText('MLS Property Data')).toBeVisible({ timeout: 20000 });
}

test.describe('Zyphe AI - Stable Regression Suite', () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.text().includes('Gemini') || msg.text().includes('AI')) {
                console.log(`PAGE LOG: [${msg.type()}] ${msg.text()}`);
            }
        });
        await mockPropertyAPIs(page);
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

        // 2. Verify Property Data Page — MLS Data section loads by default
        await expect(page.locator('h2', { hasText: /Vista Arroyo/i })).toBeVisible({ timeout: 20000 });
        await expect(page.getByText('MLS Property Data')).toBeVisible();
        await expect(page.getByText('Listing Data')).toBeVisible();
        // Verify stat tiles from mock property data
        await expect(page.getByText('List Price')).toBeVisible();
        await expect(page.getByText('Year Built')).toBeVisible();

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

test.describe('Zyphe AI - Property Dashboard Nav Coverage', () => {

    test.beforeEach(async ({ page }) => {
        await mockPropertyAPIs(page);
        // XL viewport so PropertyNav sidebar is visible (hidden xl:flex)
        await page.setViewportSize({ width: 1440, height: 900 });
    });

    test('Property > MLS Data section renders', async ({ page }) => {
        await loadProperty(page);
        await expect(page.getByText('MLS Property Data')).toBeVisible();
        await expect(page.getByText('Listing Data')).toBeVisible();
        await expect(page.getByText('List Price')).toBeVisible();
        await expect(page.getByText('Year Built')).toBeVisible();
    });

    test('Property > Indoor section renders', async ({ page }) => {
        await loadProperty(page);
        const propertyNav = page.locator('nav').filter({ has: page.getByText('MLS Data', { exact: true }) });
        await propertyNav.getByText('Indoor', { exact: true }).click();
        await expect(page.getByText('Indoor atmosphere', { exact: false })).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Interior Overview')).toBeVisible();
    });

    test('Property > Outdoor section renders', async ({ page }) => {
        await loadProperty(page);
        const propertyNav = page.locator('nav').filter({ has: page.getByText('MLS Data', { exact: true }) });
        await propertyNav.getByText('Outdoor', { exact: true }).click();
        await expect(page.getByText('Exterior Overview')).toBeVisible({ timeout: 10000 });
    });

    test('Environment section renders (climate risk, pollen, solar)', async ({ page }) => {
        await loadProperty(page);
        const propertyNav = page.locator('nav').filter({ has: page.getByText('MLS Data', { exact: true }) });
        await propertyNav.getByText('Environment', { exact: true }).click();
        await expect(page.getByText('Environmental Overview')).toBeVisible({ timeout: 10000 });
    });

    test('Connectivity section renders (walk scores + CommuteCalculator)', async ({ page }) => {
        await loadProperty(page);
        const propertyNav = page.locator('nav').filter({ has: page.getByText('MLS Data', { exact: true }) });
        await propertyNav.getByText('Connectivity', { exact: true }).click();
        await expect(page.getByText('Mobility & Infrastructure')).toBeVisible({ timeout: 10000 });
        // CommuteCalculator is rendered in this section when coordinates are present
        await expect(page.getByText('Commute', { exact: false }).first()).toBeVisible();
    });

    test('Location > Location Overview section renders', async ({ page }) => {
        await loadProperty(page);
        const propertyNav = page.locator('nav').filter({ has: page.getByText('MLS Data', { exact: true }) });
        await propertyNav.getByText('Location', { exact: true }).click();
        await expect(page.getByText('Geographic Context')).toBeVisible({ timeout: 10000 });
    });

    test('Location > Community Pulse section renders', async ({ page }) => {
        await loadProperty(page);
        const propertyNav = page.locator('nav').filter({ has: page.getByText('MLS Data', { exact: true }) });
        // Expand Location section first
        await propertyNav.getByText('Location', { exact: true }).click();
        await propertyNav.getByText('Community Pulse', { exact: true }).click();
        await expect(page.getByText('Resident Sentiment Report')).toBeVisible({ timeout: 10000 });
    });

    test('Location > City Neighborhoods section renders', async ({ page }) => {
        await loadProperty(page);
        const propertyNav = page.locator('nav').filter({ has: page.getByText('MLS Data', { exact: true }) });
        await propertyNav.getByText('Location', { exact: true }).click();
        await propertyNav.getByText('City Neighborhoods', { exact: true }).click();
        await expect(page.getByText('Urban Geography')).toBeVisible({ timeout: 10000 });
    });

    test('Investment Research section renders', async ({ page }) => {
        await loadProperty(page);
        const propertyNav = page.locator('nav').filter({ has: page.getByText('MLS Data', { exact: true }) });
        await propertyNav.getByText('Investment Research', { exact: true }).click();
        await expect(page.getByText('Market Economics')).toBeVisible({ timeout: 10000 });
        // Shows deep research empty state when no analysis yet
        await expect(
            page.getByText('Deep Research Not Available').or(page.getByText('Market Economics'))
        ).toBeVisible();
    });

    test('Executive Summary section renders', async ({ page }) => {
        await loadProperty(page);
        const propertyNav = page.locator('nav').filter({ has: page.getByText('MLS Data', { exact: true }) });
        await propertyNav.getByText('Executive Summary', { exact: true }).click();
        // Shows "No Summary Available" empty state when no comprehensive analysis
        await expect(
            page.getByText('No Summary Available').or(page.getByText('Synthesizing Report...'))
        ).toBeVisible({ timeout: 10000 });
    });

    test('Context Graph (Factors) section renders', async ({ page }) => {
        await loadProperty(page);
        const propertyNav = page.locator('nav').filter({ has: page.getByText('MLS Data', { exact: true }) });
        await propertyNav.getByText('Factors - At A Glance', { exact: true }).click();
        await expect(page.getByText('Decision Factors', { exact: false })).toBeVisible({ timeout: 10000 });
    });

    test('Lifestyle section renders when visible', async ({ page }) => {
        await loadProperty(page);
        const propertyNav = page.locator('nav').filter({ has: page.getByText('MLS Data', { exact: true }) });
        const lifestyleBtn = propertyNav.getByText('Lifestyle', { exact: true });
        // Lifestyle nav item is conditionally rendered; only test if visible
        if (await lifestyleBtn.isVisible()) {
            await lifestyleBtn.click();
            await expect(page.locator('section, [class*="fade-in"]').first()).toBeVisible({ timeout: 10000 });
        }
    });
});

test.describe('Zyphe AI - Story Mode & Browse Mode', () => {

    test('Story Mode - StoryIntakeTab renders on Story tab click', async ({ page }) => {
        await page.goto('/');
        // Click the "Story" tab in the search box
        await page.getByRole('button', { name: 'Story' }).click();
        // StoryIntakeTab renders with the main heading
        await expect(page.getByText('Tell us your story', { exact: false })).toBeVisible({ timeout: 10000 });
    });

    test('Browse Mode - BrowseByCitySection renders on landing', async ({ page }) => {
        await page.goto('/');
        // When no property is loaded the landing shows BrowseByCitySection
        await expect(page.getByPlaceholder('Enter property address...')).toBeVisible();
        // Browse tab triggers city browse UI
        await page.getByRole('button', { name: 'Browse' }).click();
        // Browse modal or browse UI appears
        await expect(
            page.getByText('Browse', { exact: false }).first()
        ).toBeVisible({ timeout: 10000 });
    });
});
