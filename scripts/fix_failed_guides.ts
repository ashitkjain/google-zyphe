import { GoogleGenAI } from "@google/genai";
import { getGuideGenerationPrompt, guideGenerationSchema } from "../prompts/client/guideGeneration.ts";
import { GUIDE_DATA } from "./guides_data.ts";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../.env");
const envContent = fs.readFileSync(envPath, "utf-8");
const apiKeyMatch = envContent.match(/GEMINI_API_KEY=(.*)/);
const API_KEY = apiKeyMatch ? apiKeyMatch[1].trim() : "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

const OUTPUT_FILE = path.resolve(__dirname, "../guides_content.json");

// --- VALIDATION LOGIC COPED HERE ---

function countWords(str: string): number {
    return str.trim().split(/\s+/).length;
}

function getTotalWordCount(content: any): number {
    let text = [
        content.title,
        content.introduction,
        content.whatThisMeans.title,
        content.whatThisMeans.content,
        content.whyThisHappens.title,
        content.whyThisHappens.content,
        content.legalFramework.title,
        content.legalFramework.context,
        ...content.legalFramework.statutes.map((s: any) => `${s.code} ${s.relevance}`),
        content.timelines.title,
        ...content.timelines.events.map((e: any) => `${e.event} ${e.timeframe} ${e.impact}`),
        content.whoIsCommonlyInvolved.title,
        ...content.whoIsCommonlyInvolved.roles.map((r: any) => `${r.role} ${r.description}`),
        ...content.resolutionPathway.map((p: any) => `${p.title} ${p.action}`),
        content.whatThisDoesNotMean.title,
        ...content.whatThisDoesNotMean.points,
        ...content.commonMisunderstandings.map((m: any) => `${m.misunderstanding} ${m.reality}`),
        content.expertPerspective.title,
        content.expertPerspective.assessment,
        ...content.expertPerspective.riskMitigation,
        ...content.faqs.map((f: any) => `${f.question} ${f.answer}`),
        ...content.keyTakeaways
    ].join(' ');

    return countWords(text);
}

function getAllStringValues(obj: any): string[] {
    let values: string[] = [];
    for (const key in obj) {
        if (typeof obj[key] === 'string') {
            values.push(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            values = [...values, ...getAllStringValues(obj[key])];
        }
    }
    return values;
}

function validateGuide(entry: any): string[] {
    const errors: string[] = [];

    if (typeof entry.content === 'string') {
        errors.push('Guide is in legacy string/markdown format. Full JSON schema required.');
        return errors;
    }

    const c = entry.content;

    // 1. Mandatory Fields
    const requiredFields = [
        "title", "introduction", "whatThisMeans", "whyThisHappens", "legalFramework",
        "timelines", "whoIsCommonlyInvolved", "resolutionPathway", "whatThisDoesNotMean",
        "commonMisunderstandings", "expertPerspective", "faqs", "keyTakeaways"
    ];

    for (const field of requiredFields) {
        if (!c[field]) errors.push(`Missing field: ${field}`);
    }

    if (errors.length > 0) return errors;

    // 2. Word Count (1500 - 3000)
    const wordCount = getTotalWordCount(c);
    if (wordCount < 1500 || wordCount > 3000) {
        errors.push(`V-101: Word count is ${wordCount}. Must be between 1500 and 3000.`);
    }

    const allStrings = getAllStringValues(c);
    const fullText = allStrings.join(' ');

    // 3. No Markdown Check
    const markdownRegex = /[*_`#\[\]]/;
    for (const str of allStrings) {
        if (markdownRegex.test(str)) {
            const match = str.match(markdownRegex);
            errors.push(`V-102: Forbidden markdown symbol "${match?.[0]}" found in: "${str.substring(0, 50)}..."`);
        }
    }

    // 4. No Emojis
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/u;
    if (emojiRegex.test(fullText)) {
        errors.push('V-103: Found emojis in content. Emojis are strictly forbidden.');
    }

    // 5. Instruction Violations
    const forbiddenPatterns = [
        { pattern: /\b(you should|you must|do this|ensure that you|you need to)\b/i, label: 'Imperative Directive' },
        { pattern: /\b(AI|Gemini|LLM|Artificial Intelligence)\b/i, label: 'AI/Generation Mention' },
        { pattern: /\b(I am|as an AI|my purpose)\b/i, label: 'Self-reference' }
    ];

    for (const p of forbiddenPatterns) {
        const matches = fullText.match(p.pattern);
        if (matches) {
            errors.push(`V-104: ${p.label} ("${matches[0]}") detected in the text.`);
        }
    }

    // 6. California Context
    if (!fullText.toLowerCase().includes('california') && !fullText.toLowerCase().includes('ca ')) {
        errors.push('V-105: Missing explicit California context.');
    }

    return errors;
}

// --- GENERATION LOGIC ---

async function generateWithRetry(category: string, title: string, retries = 3): Promise<any | null> {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Regenerating: ${title} (Attempt ${i + 1})...`);
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
            await new Promise(res => setTimeout(res, 5000));
        }
    }
    return null;
}

async function main() {
    if (!fs.existsSync(OUTPUT_FILE)) {
        console.error("Output file not found!");
        return;
    }

    const guides: any[] = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
    const failedGuides: { entry: any, index: number }[] = [];

    console.log("🔍 Scanning for failed guides...");
    guides.forEach((g, i) => {
        const errors = validateGuide(g);
        if (errors.length > 0) {
            failedGuides.push({ entry: g, index: i });
        }
    });

    console.log(`📈 Found ${failedGuides.length} guides that failed validation.`);

    if (failedGuides.length === 0) {
        console.log("✅ All guides are compliant! Nothing to do.");
        return;
    }

    for (const { entry, index } of failedGuides) {
        let categoryTitle = "";
        for (const cat of GUIDE_DATA) {
            if (cat.topicSlug === entry.topicSlug) {
                categoryTitle = cat.title;
                break;
            }
        }

        const newContent = await generateWithRetry(categoryTitle, entry.title);
        if (newContent) {
            guides[index].content = newContent;
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(guides, null, 2));
            console.log(`✅ Fixed and Saved: ${entry.title}`);
        } else {
            console.error(`❌ Failed to regenerate: ${entry.title}`);
        }

        await new Promise(res => setTimeout(res, 2000));
    }

    console.log("\n🚀 All failed guides have been processed.");
}

main().catch(console.error);
