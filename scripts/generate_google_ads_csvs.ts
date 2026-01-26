
import { GUIDE_DATA } from './guides_data.ts';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'ads_export');

// --- Helper Functions ---

function sanitizeHeadline(text: string): string {
    // Basic heuristics to shorten headlines to 30 chars
    let shortened = text
        .replace("What happens if", "")
        .replace("in California", "CA")
        .replace("in CA", "CA")
        .replace("California", "CA")
        .replace("Homeowner's", "Homeowner")
        .replace("Homeowners", "Homeowner")
        .replace("Association", "HOA")
        .replace("and", "&")
        .replace("?", "")
        .trim();

    if (shortened.length <= 30) return shortened;

    return shortened.substring(0, 27) + "...";
}

function generateKeywords(title: string, slug: string): { text: string; matchType: string }[] {
    const keywords: { text: string; matchType: string }[] = [];

    // Base keyword from slug replacements
    const baseSlugKw = slug.replace(/-/g, ' ');
    const titleKw = title
        .toLowerCase()
        .replace("?", "")
        .replace("california", "") // Make generic + specific
        .trim();

    // 1. Exact Match [Slug keyword]
    keywords.push({ text: `[${baseSlugKw}]`, matchType: 'Exact' });

    // 2. Phrase Match "Slug keyword"
    keywords.push({ text: `"${baseSlugKw}"`, matchType: 'Phrase' });

    // 3. Exact Match [Title keyword + CA]
    if (!titleKw.includes("ca") && !titleKw.includes("california")) {
        keywords.push({ text: `[${titleKw} california]`, matchType: 'Exact' });
        keywords.push({ text: `"${titleKw} california"`, matchType: 'Phrase' });
    }

    return keywords;
}

// --- CSV Generators ---

function generateCampaignsCSV() {
    const header = "Campaign,Campaign Daily Budget,Campaign Type,Networks,Languages,Bid Strategy Type";
    const rows = GUIDE_DATA.map(cat => {
        const campaignName = `${cat.title} – Informational`;
        return `"${campaignName}",10.00,"Search","Google Search","English","Maximize Clicks"`;
    });

    const content = [header, ...rows].join('\n');
    fs.writeFileSync(path.join(OUTPUT_DIR, 'Campaigns.csv'), content);
    console.log("✅ Campaigns.csv created");
}

function generateAdGroupsCSV() {
    const header = "Campaign,Ad Group,Max CPC,Ad Group Type,Status";
    const rows: string[] = [];

    GUIDE_DATA.forEach(cat => {
        const campaignName = `${cat.title} – Informational`;
        cat.items.forEach(item => {
            const adGroupName = item.title.replace(/"/g, '""'); // Escape quotes
            rows.push(`"${campaignName}","${adGroupName}",0.38,"Standard","Enabled"`);
        });
    });

    const content = [header, ...rows].join('\n');
    fs.writeFileSync(path.join(OUTPUT_DIR, 'AdGroups.csv'), content);
    console.log("✅ AdGroups.csv created");
}

function generateKeywordsCSV() {
    const header = "Campaign,Ad Group,Keyword,Criterion Type,Final URL";
    const rows: string[] = [];

    GUIDE_DATA.forEach(cat => {
        const campaignName = `${cat.title} – Informational`;
        cat.items.forEach(item => {
            const adGroupName = item.title.replace(/"/g, '""');
            // Assuming Zyphe uses this URL structure
            const finalUrl = `https://www.zyphe.com/${cat.topicSlug}/${item.slug}`;

            const keywords = generateKeywords(item.title, item.slug);

            keywords.forEach(kw => {
                rows.push(`"${campaignName}","${adGroupName}","${kw.text}","${kw.matchType}","${finalUrl}"`);
            });
        });
    });

    const content = [header, ...rows].join('\n');
    fs.writeFileSync(path.join(OUTPUT_DIR, 'Keywords.csv'), content);
    console.log("✅ Keywords.csv created");
}

function generateAdsCSV() {
    const header = "Campaign,Ad Group,Headline 1,Headline 2,Headline 3,Description 1,Description 2,Final URL,Path 1,Path 2";
    const rows: string[] = [];

    GUIDE_DATA.forEach(cat => {
        const campaignName = `${cat.title} – Informational`;
        cat.items.forEach(item => {
            const adGroupName = item.title.replace(/"/g, '""');
            const finalUrl = `https://www.zyphe.com/${cat.topicSlug}/${item.slug}`;

            const h1 = sanitizeHeadline(item.title);
            const h2 = "California Real Estate Guide"; // Generic H2
            const h3 = "Zyphe AI Insights"; // Generic H3

            const d1 = `Learn about ${item.title} in California. Timelines & legal frameworks explained.`.substring(0, 90);
            const d2 = "Free specialized guide for homeowners. Know your rights and responsibilities.".substring(0, 90);

            const p1 = cat.topicSlug; // e.g. "hoa"
            const p2 = item.slug.substring(0, 15); // Truncate slug for Path 2

            rows.push(`"${campaignName}","${adGroupName}","${h1}","${h2}","${h3}","${d1}","${d2}","${finalUrl}","${p1}","${p2}"`);
        });
    });

    const content = [header, ...rows].join('\n');
    fs.writeFileSync(path.join(OUTPUT_DIR, 'Ads.csv'), content);
    console.log("✅ Ads.csv created");
}

// --- Main Execution ---

console.log(`Starting CSV Generation into ${OUTPUT_DIR}...`);
generateCampaignsCSV();
generateAdGroupsCSV();
generateKeywordsCSV();
generateAdsCSV();
console.log("🎉 All CSVs generated successfully.");
