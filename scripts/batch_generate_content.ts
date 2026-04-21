import { GoogleGenAI } from "@google/genai";
import { getGuideGenerationPrompt, guideGenerationSchema, GuideResult } from "../prompts/client/guideGeneration.ts";
import { GUIDE_DATA } from "./guides_data.ts";
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const apiKeyMatch = envContent.match(/GEMINI_API_KEY=(.*)/);
const API_KEY = apiKeyMatch ? apiKeyMatch[1].trim() : "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

const OUTPUT_FILE = path.join(process.cwd(), "data/guides_content.json");

async function generateWithRetry(category: string, title: string, retries = 3): Promise<GuideResult | null> {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Generating: ${title} (Attempt ${i + 1})...`);
            const prompt = getGuideGenerationPrompt(category, title);
            const result = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: guideGenerationSchema,
                    temperature: 0.7,
                }
            });

            const text = result.text;
            return JSON.parse(text) as GuideResult;
        } catch (error) {
            console.error(`Error generating ${title}:`, error);
            if (i === retries - 1) return null;
            await new Promise(res => setTimeout(res, 5000)); // Wait 5s before retry
        }
    }
    return null;
}

async function main() {
    let existingContent: any[] = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            existingContent = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
        } catch (e) {
            console.warn("Could not parse existing content, starting fresh.");
        }
    }

    const guidesToGenerate = [];
    for (const category of GUIDE_DATA) {
        for (const item of category.items) {
            // Check if already exists to skip (unless we want to refresh everything)
            const exists = existingContent.find((g: any) => g.slug === item.slug && g.topicSlug === category.topicSlug);
            if (!exists) {
                guidesToGenerate.push({ category, item });
            }
        }
    }

    console.log(`Total guides found: 90`);
    console.log(`Guides needing generation: ${guidesToGenerate.length}`);

    // Higher limit for batch run
    const LIMIT = 100;
    const itemsToProcess = guidesToGenerate.slice(0, LIMIT);
    console.log(`Processing next ${itemsToProcess.length} items...`);

    for (const { category, item } of itemsToProcess) {
        const content = await generateWithRetry(category.title, item.title);
        if (content) {
            const entry = {
                topicSlug: category.topicSlug,
                slug: item.slug,
                title: item.title,
                content: content
            };
            existingContent.push(entry);
            // Save after each successful generation to prevent data loss
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingContent, null, 2));
            console.log(`✅ Saved: ${item.title}`);
        } else {
            console.error(`❌ Failed: ${item.title}`);
        }
        // Small delay to avoid aggressive rate limiting
        await new Promise(res => setTimeout(res, 2000));
    }

    console.log("Batch generation complete!");
}

main().catch(console.error);
