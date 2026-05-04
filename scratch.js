import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), '.env') });

const ai = new GoogleGenAI({ apiKey: process.env.VITE_FIREBASE_API_KEY });

const schema = {
    type: Type.OBJECT,
    properties: {
        valueAndCost: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        incomePotential: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        marketLeverage: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] }
    },
    required: ["valueAndCost", "incomePotential", "marketLeverage"]
};

async function run() {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Extract factors into the 3 categories. Property has no HOA, large ADU, and motivated seller.",
            config: {
                temperature: 0.2,
                maxOutputTokens: 2048,
                responseMimeType: "application/json",
                responseSchema: schema
            }
        });
        console.log("Success! Response:");
        console.log(response.text);
    } catch(e) {
        console.error("Error:", e);
    }
}
run();
