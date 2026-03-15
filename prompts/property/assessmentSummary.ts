import { Type } from "@google/genai";

export interface AssessmentDataForPrompt {
    totalProperties: number;
    totalAssessed: number;
    totalPending: number;
    goodCount: number;
    badCount: number;
    otherCount: number;
    totalWithComments: number;
    auditorBreakdown: Array<{
        name: string;
        total: number;
        good: number;
        bad: number;
        other: number;
        withComments: number;
        weeklyActivity: Array<{ week: string; count: number }>;
    }>;
    cityBreakdown: Array<{
        city: string;
        total: number;
        assessed: number;
        pending: number;
        good: number;
        bad: number;
    }>;
    weeklyOverallActivity: Array<{ week: string; count: number }>;
    recentComments: Array<{
        auditor: string;
        address: string;
        assessment: string;
        comment: string;
        date: string;
    }>;
    /** All comments from "bad" assessments — used for AI image discrepancy analysis */
    allBadComments: Array<{
        auditor: string;
        address: string;
        comment: string;
        date: string;
    }>;
    llmStats: {
        totalCalls: number;
        completedCalls: number;
        failedCalls: number;
        topPrompts: Array<{ prompt: string; count: number; failCount: number }>;
        avgCostPerCall: number;
        totalCost: number;
    };
}

export const getAssessmentSummaryPrompt = (data: AssessmentDataForPrompt) => {
    const DATA_DUMP = JSON.stringify(data, null, 2);

    return `You are a QA Analytics Lead producing an executive summary of an AI property analysis validation program.

Your task is to analyze the provided assessment data and produce a comprehensive, well-written executive summary that covers:

## DATA PROVIDED:
${DATA_DUMP}

## REQUIRED ANALYSIS:

1. **Program Overview**: How many properties have been assessed vs pending. The overall completion rate and trend.

2. **Quality Distribution**: Break down the good/bad/other assessments. Highlight the bad assessment rate — this indicates where AI analysis differed from reality. Calculate the AI accuracy rate (good / (good + bad) * 100).

3. **Auditor Performance & Effectiveness**: Evaluate each tester:
   - Volume: How many properties they've reviewed
   - Quality focus: What ratio of bad statuses they found (testers who find more issues are more thorough)
   - Comment engagement: Do they leave detailed comments? 
   - Consistency: Are they active week over week?
   - Rank auditors by productivity and thoroughness

4. **AI Issues Found**: Based on the comments from "bad" assessments, synthesize the common themes:
   - What kinds of errors is the AI making? (e.g., wrong room identification, incorrect orientation, hallucinated features)
   - Are issues more from MLS data inaccuracies vs AI hallucinations vs 3rd party data problems?
   - What are the most frequent error categories?

5. **Weekly Trends**: Analyze the week-over-week assessment velocity. Is the program accelerating, plateauing, or declining?

6. **City Coverage**: Which cities have the most pending work? Which are fully validated?

7. **LLM Performance**: If LLM stats are provided, summarize:
   - Success rate of AI calls
   - Which prompts/analysis types fail most
   - Cost efficiency

8. **Recommendations**: Based on all the data, provide 3-5 actionable recommendations to improve the validation program.

9. **Pure AI Image Evaluation (CRITICAL SECTION)**:
   This section must evaluate ONLY the AI's visual/image analysis capabilities. EXCLUDE all pricing, market data, data integrations (Rentcast, ArcGIS, USGS, etc.), or any non-image-related factors.
   
   Focus exclusively on:
   - How accurately the AI identifies and describes rooms, spaces, and features from property photos
   - Whether the AI correctly detects property condition, finishes, materials, and style from images
   - Whether the AI's image-based assessments of orientation, lot coverage, exterior condition, and neighborhood are accurate
   - Any cases where the AI hallucinated or misidentified features visible (or not visible) in photos
   - The AI's ability to match what it "sees" in images with reality as confirmed by human auditors

   Using the "allBadComments" data (comments from auditors who marked properties as "bad"), carefully identify every property where the auditor's comment indicates a **discrepancy between what the AI analyzed from images vs what the auditor observed**. A discrepancy means the auditor explicitly noted that the AI got something wrong about the visual/image analysis — such as wrong room count from images, incorrect style/finish identification, hallucinated features, wrong orientation detection from satellite/street view, incorrect condition assessment from photos, etc.
   
   DO NOT count discrepancies related to: pricing errors, data feed issues, MLS data mismatches (unless the AI was supposed to visually verify), API/integration failures, or market data inaccuracies.
   
   For the "image_discrepancy_properties" output:
   - List EVERY property where you identified an AI image analysis discrepancy
   - Include the address and a brief description of what the AI got wrong visually
   - Be thorough — review ALL comments in allBadComments, not just a sample

## FORMATTING RULES:
- Write in professional but accessible prose with paragraph style
- Use **bold** for key metrics, percentages, and auditor names
- Include specific numbers and percentages throughout
- The tone should be like a weekly operational report to leadership
- Be direct about problems — don't sugarcoat low performance or high error rates

**CRITICAL: Return valid JSON only. No markdown fences.**`;
};

export const assessmentSummarySchema = {
    type: Type.OBJECT,
    properties: {
        executive_overview: { type: Type.STRING, description: "2-3 paragraph overview with key metrics" },
        quality_analysis: { type: Type.STRING, description: "Analysis of good/bad/other distribution and AI accuracy" },
        auditor_performance: { type: Type.STRING, description: "Detailed per-auditor analysis with rankings" },
        ai_issues_found: { type: Type.STRING, description: "Synthesis of common AI errors from bad assessment comments" },
        weekly_trends: { type: Type.STRING, description: "Week-over-week velocity analysis" },
        city_coverage: { type: Type.STRING, description: "City-level coverage and gap analysis" },
        llm_performance: { type: Type.STRING, description: "LLM call success rates and cost analysis" },
        ai_image_evaluation: { type: Type.STRING, description: "Pure AI image analysis review — excludes pricing/data integration, focuses only on visual/image analysis accuracy" },
        image_discrepancy_count: { type: Type.NUMBER, description: "Count of properties with discrepancies between AI image analysis and auditor observations" },
        image_discrepancy_properties: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    address: { type: Type.STRING, description: "Property address" },
                    discrepancy: { type: Type.STRING, description: "Brief description of what the AI got wrong visually" }
                },
                required: ["address", "discrepancy"]
            },
            description: "List of properties where AI image analysis disagrees with auditor assessment"
        },
        recommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 actionable recommendations"
        }
    },
    required: ["executive_overview", "quality_analysis", "auditor_performance", "ai_issues_found", "weekly_trends", "city_coverage", "llm_performance", "ai_image_evaluation", "image_discrepancy_count", "image_discrepancy_properties", "recommendations"]
};

export interface AssessmentSummaryResult {
    executive_overview: string;
    quality_analysis: string;
    auditor_performance: string;
    ai_issues_found: string;
    weekly_trends: string;
    city_coverage: string;
    llm_performance: string;
    ai_image_evaluation: string;
    image_discrepancy_count: number;
    image_discrepancy_properties: Array<{ address: string; discrepancy: string }>;
    recommendations: string[];
}
