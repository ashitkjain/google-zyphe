/**
 * screenshotSections.ts
 *
 * Automatically screenshots every section of the property explore view.
 * Saves PNGs to screenshots/sections/ ready to drag into Claude Design.
 *
 * Usage:
 *   1. Start the dev server:  npm run dev
 *   2. Run:  npx tsx scripts/screenshotSections.ts
 *   3. A browser window opens — log in and navigate to any property page.
 *   4. Press Enter in the terminal when the property is fully loaded.
 *   5. All screenshots land in screenshots/sections/
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// ── Config ────────────────────────────────────────────────────────────────────
const EMAIL    = 'buyer@fc.com';
const PASSWORD = 'password123';
const PROPERTY = '1144 Harvest Rd, Pleasanton, CA 94566 US';

// ── Sections to capture ───────────────────────────────────────────────────────
const SECTIONS = [
  { label: 'Lifestyle, Schools & Vastu', filename: '01-lifestyle-schools-vastu' },
  { label: 'MLS Data',                   filename: '02-mls-data' },
  { label: 'Indoor',                     filename: '03-indoor' },
  { label: 'Rooms',                      filename: '04-rooms' },
  { label: 'Outdoor',                    filename: '05-outdoor' },
  { label: 'Environment',               filename: '06-environment' },
  { label: 'Connectivity',              filename: '07-connectivity' },
  { label: 'Location Overview',         filename: '08-location-overview' },
  { label: 'Community Pulse',           filename: '09-community-pulse' },
  { label: 'City Neighborhoods',        filename: '10-city-neighborhoods' },
  { label: 'Investment Intelligence',   filename: '11-investment-intelligence' },
];

const OUT_DIR = path.join(process.cwd(), 'screenshots', 'sections');

function prompt(question: string): Promise<void> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, () => { rl.close(); resolve(); });
  });
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Try Playwright's bundled Chromium first; fall back to system Chrome/Chromium.
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',   // uses system Chrome — no extra download needed
    args: ['--start-maximized'],
  }).catch(() =>
    chromium.launch({ headless: false, args: ['--start-maximized'] })
  );

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  await page.goto('http://localhost:3000');

  console.log('\n──────────────────────────────────────────────');
  console.log('  Zyphe Section Screenshot Tool');
  console.log('──────────────────────────────────────────────');

  // ── Step 1: Sign in ────────────────────────────────────────────────────────
  console.log(`  Signing in as ${EMAIL}...`);
  await page.getByRole('button', { name: /sign in/i }).first().click();
  await page.waitForSelector('input[type="email"]', { timeout: 5000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).last().click();

  // Wait for the auth modal to close (user element appears in header)
  await page.waitForSelector('button:has-text("SIGN OUT")', { timeout: 15000 });
  console.log('  Signed in.');

  // ── Step 2: Search for the property ──────────────────────────────────────
  console.log(`  Searching for: ${PROPERTY}`);
  await page.fill('input[placeholder="Enter property address..."]', PROPERTY);
  await page.getByRole('button', { name: /^search$/i }).click();

  // Wait for property section nav to appear (indicates successful load)
  console.log('  Waiting for property to load (this can take ~30-60 s)...');
  await page.waitForSelector('#property-section-top, [data-section], .property-nav', { timeout: 120000 }).catch(async () => {
    // Fallback: wait for a known section label to appear
    await page.waitForSelector('button:has-text("MLS Data")', { timeout: 120000 });
  });
  await page.waitForTimeout(2000);
  console.log('  Property loaded.');

  console.log('\n  Starting screenshot capture...\n');

  let captured = 0;
  let skipped = 0;

  for (const section of SECTIONS) {
    try {
      // Find the nav item by its text label (partial match, case-insensitive)
      const navBtn = page.getByRole('button', { name: new RegExp(section.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
        .or(page.locator('button, [role="menuitem"]').filter({ hasText: new RegExp(section.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }))
        .first();

      const found = await navBtn.count();
      if (!found) {
        // Try by any clickable element with this text
        const anyEl = page.locator('*').filter({ hasText: new RegExp(`^${section.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first();
        const anyFound = await anyEl.count();
        if (!anyFound) {
          console.log(`  ⚠  Skipping "${section.label}" — nav item not visible (section may be unavailable for this property)`);
          skipped++;
          continue;
        }
        await anyEl.click();
      } else {
        await navBtn.click();
      }

      // Wait for any loading spinners to clear, then let content settle
      await page.waitForTimeout(600);
      try {
        await page.waitForSelector('.animate-pulse', { state: 'detached', timeout: 8000 });
      } catch {
        // Some sections have no loading state — fine to proceed
      }
      await page.waitForTimeout(400);

      // Scroll to top of content area
      await page.evaluate(() => {
        const el = document.getElementById('property-section-top');
        if (el) el.scrollIntoView({ behavior: 'instant' });
        else window.scrollTo(0, 0);
      });
      await page.waitForTimeout(200);

      const outPath = path.join(OUT_DIR, `${section.filename}.png`);
      await page.screenshot({ path: outPath, fullPage: true });

      console.log(`  ✓  ${section.label.padEnd(35)} → ${section.filename}.png`);
      captured++;
    } catch (err: any) {
      console.log(`  ✗  ${section.label.padEnd(35)} — error: ${err.message?.split('\n')[0]}`);
      skipped++;
    }
  }

  console.log(`\n──────────────────────────────────────────────`);
  console.log(`  Done: ${captured} captured, ${skipped} skipped`);
  console.log(`  Saved to: ${OUT_DIR}`);
  console.log(`──────────────────────────────────────────────\n`);

  await prompt('  → Press Enter to close the browser: ');
  await browser.close();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
