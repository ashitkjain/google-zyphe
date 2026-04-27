import { GoogleGenAI, Type } from '@google/genai';
import { getBuyerDnaCompressionPrompt, buyerDnaCompressionSchema } from './prompts/property/buyerDnaCompression';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });

async function testDna() {
    console.log("Mocking property factors...");
    
    // A realistic set of factors for a pleasanton property
    const mockFactors = [
        { i: 1, v: "Expensive", t: ["High List Price", "$2.8M List", "$450 HOA"] },
        { i: 2, v: "No STR", t: ["Strict HOA Rental Restrictions", "No AirBnb allowed"] },
        { i: 14, v: "Spacious", t: ["2,400 Sqft", "Spacious Layout"] },
        { i: 21, v: "Needs TLC", t: ["Needs Cosmetic Updates", "Original 1990s Condition", "Fixer-Upper"] },
        { i: 24, v: "Dark", t: ["Poor Natural Light", "North-Facing", "Small Windows"] },
        { i: 25, v: "Choppy", t: ["Choppy Layout", "Closed Off Kitchen"] },
        { i: 26, v: "Dated Kitchen", t: ["Original Kitchen", "Formica Countertops", "Aging Appliances"] },
        { i: 27, v: "Basic baths", t: ["Builder Grade Bathrooms", "Original Tile"] },
        { i: 31, v: "Tiny yard", t: ["Zero Lot Line", "Small Patio Only", "No Grass"] },
        { i: 32, v: "No outdoor entertainment", t: ["No Deck", "No Pool"] },
        { i: 43, v: "Car dependent", t: ["Must Drive Everywhere", "No Sidewalks", "Not Walkable"] },
        { i: 57, v: "Poor WFH", t: ["No Dedicated Office Space", "Slow Internet Area"] },
        { i: 101, v: "Average schools", t: ["High School 5/10", "Elementary 4/10"] },
        { i: 104, v: "Aging systems", t: ["Original Roof (30 yrs)", "HVAC from 2005", "Needs new water heater"] },
        { i: 121, v: "High Fire Risk", t: ["CalFire Severe Risk Zone", "High Insurance Premiums"] }
    ];

    const prompt = getBuyerDnaCompressionPrompt(mockFactors);
    console.log("Calling Gemini API...");

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: buyerDnaCompressionSchema
        }
    });

    console.log("\n====== BUYER DNA COMPRESSION RESULTS ======\n");
    console.log(JSON.stringify(JSON.parse(response.text || "{}"), null, 2));
}

testDna().catch(console.error);
