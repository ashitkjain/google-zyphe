import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the schema types
interface Statute {
    code: string;
    relevance: string;
}

interface TimelineEvent {
    event: string;
    timeframe: string;
    impact: string;
}

interface Role {
    role: string;
    description: string;
}

interface PathwayStep {
    step: number;
    title: string;
    action: string;
}

interface Misunderstanding {
    misunderstanding: string;
    reality: string;
}

interface FAQ {
    question: string;
    answer: string;
}

interface GuideContent {
    title: string;
    introduction: string;
    whatThisMeans: { title: string; content: string };
    whyThisHappens: { title: string; content: string };
    legalFramework: { title: string; context: string; statutes: Statute[] };
    timelines: { title: string; events: TimelineEvent[] };
    whoIsCommonlyInvolved: { title: string; roles: Role[] };
    resolutionPathway: PathwayStep[];
    whatThisDoesNotMean: { title: string; points: string[] };
    commonMisunderstandings: Misunderstanding[];
    expertPerspective: { title: string; assessment: string; riskMitigation: string[] };
    faqs: FAQ[];
    keyTakeaways: string[];
}

interface GuideEntry {
    topicSlug: string;
    slug: string;
    title: string;
    content: string | GuideContent;
}

function countWords(str: string): number {
    return str.trim().split(/\s+/).length;
}

function getTotalWordCount(content: GuideContent): number {
    let text = [
        content.title,
        content.introduction,
        content.whatThisMeans.title,
        content.whatThisMeans.content,
        content.whyThisHappens.title,
        content.whyThisHappens.content,
        content.legalFramework.title,
        content.legalFramework.context,
        ...content.legalFramework.statutes.map(s => `${s.code} ${s.relevance}`),
        content.timelines.title,
        ...content.timelines.events.map(e => `${e.event} ${e.timeframe} ${e.impact}`),
        content.whoIsCommonlyInvolved.title,
        ...content.whoIsCommonlyInvolved.roles.map(r => `${r.role} ${r.description}`),
        ...content.resolutionPathway.map(p => `${p.title} ${p.action}`),
        content.whatThisDoesNotMean.title,
        ...content.whatThisDoesNotMean.points,
        ...content.commonMisunderstandings.map(m => `${m.misunderstanding} ${m.reality}`),
        content.expertPerspective.title,
        content.expertPerspective.assessment,
        ...content.expertPerspective.riskMitigation,
        ...content.faqs.map(f => `${f.question} ${f.answer}`),
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

function validateGuide(entry: GuideEntry): string[] {
    const errors: string[] = [];

    if (typeof entry.content === 'string') {
        errors.push('Guide is in legacy string/markdown format. Full JSON schema required.');
        return errors;
    }

    const c = entry.content as GuideContent;

    // 1. Mandatory Fields (Basic check)
    const requiredFields = [
        "title", "introduction", "whatThisMeans", "whyThisHappens", "legalFramework",
        "timelines", "whoIsCommonlyInvolved", "resolutionPathway", "whatThisDoesNotMean",
        "commonMisunderstandings", "expertPerspective", "faqs", "keyTakeaways"
    ];

    for (const field of requiredFields) {
        if (!(c as any)[field]) errors.push(`Missing field: ${field}`);
    }

    if (errors.length > 0) return errors;

    // 2. Word Count (1300 - 3000)
    const wordCount = getTotalWordCount(c);
    if (wordCount < 1300 || wordCount > 3000) {
        errors.push(`V-101: Word count is ${wordCount}. Must be between 1300 and 3000.`);
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

    // 5. Instruction Violations (Imperatives & AI Mention)
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
        errors.push('V-105: Missing explicit California context (State-level localization required).');
    }

    return errors;
}

// Execution
const dataPath = path.resolve(__dirname, '../guides_content.json');
const guides: GuideEntry[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// Test for the specific guide requested
const targetSlug = 'hoa-lien-process-california';
const target = guides.find(g => g.slug === targetSlug);

if (!target) {
    console.error(`Guide not found: ${targetSlug}`);
    process.exit(1);
}

console.log(`Validating Guide: ${target.title} (${target.slug})`);
const results = validateGuide(target);

if (results.length === 0) {
    console.log('✅ CONTENT VALIDATED: FULLY COMPLIANT');
} else {
    console.log('❌ VALIDATION FAILED:');
    results.forEach(err => console.log(`  - ${err}`));
}
