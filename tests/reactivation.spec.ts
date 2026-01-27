import { test, expect } from '@playwright/test';

/**
 * Zyphe AI - Reactivation Suite (Robust)
 */
test.describe('Zyphe AI - Reactivation Regression Suite', () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.text().includes('AI') || msg.text().includes('Reactivation')) {
                console.log(`PAGE LOG: [${msg.type()}] ${msg.text()}`);
            }
        });
    });

    test('End-to-End Reactivation: Selection -> Analysis -> SMS -> Reply -> Respond', async ({ page }) => {
        test.setTimeout(300000);

        // 1. Initial Access
        await page.goto('/realtor/reactivate');

        // 2. Authentication Flow
        // Check if we need to sign in
        const signInButton = page.locator('button:has-text("Sign In")').first();
        if (await signInButton.isVisible()) {
            console.log("Detecting Sign In requirement...");
            await signInButton.click();

            // Wait for modal fields
            const emailInput = page.getByPlaceholder('email@example.com');
            await expect(emailInput).toBeVisible({ timeout: 10000 });

            await emailInput.fill('shivani@homesbyshivani.com');
            await page.getByPlaceholder('••••••••').fill('password');

            // Click the submit button inside the form
            await page.locator('form button:has-text("Sign In")').click();

            // Wait for authentication to complete and redirect/refresh
            await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible({ timeout: 30000 });
            console.log("Authentication successful.");
        }

        // 3. Close any blocking modals (Amanda White modal often appears on fresh state)
        // This is a common pattern for "First logical step" popups in this app
        const closeModalBtn = page.locator('button i.fa-xmark').locator('xpath=..');
        if (await closeModalBtn.isVisible()) {
            console.log("Closing initial lead modal...");
            await closeModalBtn.click();
            await page.waitForTimeout(1000);
        }

        // 4. Data Seeding
        // Switch to 'Respond' tab which contains the DashboardModule and the dev helper button
        console.log("Navigating to Respond tab for seeding...");
        const respondTab = page.locator('button:has-text("Respond")');
        await respondTab.click();

        const generateMockBtn = page.getByTitle('Create mock reactivation test suite');
        await expect(generateMockBtn).toBeVisible({ timeout: 30000 });
        await generateMockBtn.click();

        // The page reloads after seeding
        console.log("Mock data seeded. Waiting for page reload...");
        await expect(page.getByText('Matthew Lewis', { exact: false })).toBeVisible({ timeout: 60000 });

        // 5. Lead Selection (Old Leads Module)
        console.log("Selecting leads for analysis...");
        await page.locator('button:has-text("Old Leads")').click();
        await page.waitForTimeout(2000); // Wait for list animation

        // Target checkboxes in the table body
        const leadCheckboxes = page.locator('tbody input[type="checkbox"]');
        const count = await leadCheckboxes.count();
        console.log(`Found ${count} lead checkboxes.`);

        for (let i = 0; i < Math.min(5, count); i++) {
            await leadCheckboxes.nth(i).click();
        }

        await expect(page.getByText(/Selected/i)).toBeVisible();

        // 6. Generate Analysis (AI Pipeline)
        console.log("Triggering AI Analysis...");
        await page.locator('button:has-text("Generate High-Intent Analysis")').click();

        // This step involves Gemini AI and can take 30-120 seconds
        await expect(page.getByText(/Priority/i).first()).toBeVisible({ timeout: 180000 });
        console.log("AI Analysis complete.");

        // 7. Execute Outreach (SMS)
        const firstLeadCard = page.locator('div').filter({ hasText: 'Matthew Lewis' }).first();
        const sendSmsBtn = firstLeadCard.getByTitle('Send now');
        await sendSmsBtn.click();

        await expect(firstLeadCard.getByText(/Sent Today|Sent \d+/i)).toBeVisible();
        console.log("SMS outreach simulated.");

        // 8. Simulate Response
        const simulateReplyBtn = firstLeadCard.getByTitle(/Simulate a reply/i);
        await simulateReplyBtn.click();

        await expect(firstLeadCard.getByText('Reply Received')).toBeVisible();
        console.log("Inbound reply simulated.");

        // 9. Verify Final Results in Respond Module
        await page.locator('button:has-text("Respond")').click();
        await expect(page.getByText('Action Required')).toBeVisible();
        await expect(page.getByText('Matthew Lewis')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Positive Response')).toBeVisible();

        // 10. Verify in Message Trail
        await page.locator('button:has-text("Message Trail")').click();
        await expect(page.getByText('Matthew Lewis')).toBeVisible();
        console.log("Regression test successfully completed all stages.");
    });

});
