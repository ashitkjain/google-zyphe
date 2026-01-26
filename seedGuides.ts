import { saveGuideContent } from './services/firebaseService.ts';
import fs from 'fs';
import path from 'path';

const seedGuides = async () => {
    console.log("Starting Guide Seeding from guides_content.json...");

    const filePath = path.join(process.cwd(), 'guides_content.json');
    if (!fs.existsSync(filePath)) {
        console.error("guides_content.json not found! Run the generation script first.");
        return;
    }

    const guides = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`Found ${guides.length} guides to seed.`);

    for (const guide of guides) {
        process.stdout.write(`Seeding guide: ${guide.title}... `);

        // Ensure content is in the right format for GuideContent interface
        const guideData = {
            id: `${guide.topicSlug}_${guide.slug}`,
            topicSlug: guide.topicSlug,
            slug: guide.slug,
            title: guide.title,
            content: guide.content,
            lastUpdated: new Date()
        };

        const result = await saveGuideContent(guideData);
        if (result.success) {
            console.log("✅");
        } else {
            console.log("❌", result.error);
        }
    }

    console.log("Seeding process complete.");
};

// Start seeding
seedGuides();
