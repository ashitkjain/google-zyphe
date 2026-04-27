import { GoogleGenAI } from '@google/genai';
import { getBuyerStoryWeightsPrompt, buyerStoryWeightsSchema } from './prompts/client/buyerStoryWeights';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });

async function testStory() {
    console.log("Mocking multi-gen buyer story...");
    
    const story = {
        chapter01: 'We are a multi-generational family — a couple in our late 40s with two teenagers, plus my elderly parents who are moving from India to live with us permanently.',
        chapter02: 'We share big family meals every Sunday. My parents need ground-floor living with easy access. I work from home as a consultant; my wife runs a catering business and needs a serious kitchen.',
        chapter03: 'Must: 5+ bedrooms, ground-floor in-law suite with private bath, large kitchen with commercial ventilation, 3-car garage. Avoid: stairs for elderly parents, newer build before 2000.',
        chapter04: 'Accessibility and the ground-floor suite are essential for my parents. We’d stretch the budget for a home that fits everyone safely.',
        chapter05: 'Move forward within 1–2 months'
    };

    const prompt = getBuyerStoryWeightsPrompt(
        story.chapter01,
        story.chapter02,
        story.chapter03,
        story.chapter04,
        story.chapter05
    );

    console.log("Calling Gemini API...");

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: buyerStoryWeightsSchema
        }
    });

    console.log("\n====== BUYER STORY WEIGHTS ======\n");
    console.log(JSON.stringify(JSON.parse(response.text || "{}"), null, 2));
}

testStory().catch(console.error);
