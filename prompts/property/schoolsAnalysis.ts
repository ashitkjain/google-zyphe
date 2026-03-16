import { Type } from "@google/genai";
import { PropertyData, School } from "../../types";

/**
 * Generate a sanitized cache key for a school.
 * Uses school name + city to produce a Firestore-safe document ID.
 */
export const getSchoolCacheKey = (schoolName: string, city: string, state: string = ''): string => {
    const words = schoolName.trim().split(/\s+/);
    const slug = words.slice(0, 4).join('_');
    return `${slug}_${city}_${state}`
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 120);
};

export const getSchoolAnalysisPrompt = (school: School, property: PropertyData) => `
You are an expert education analyst. Analyze the following school in detail for a homebuyer evaluating a property in ${property.city}, ${property.state}.

## SCHOOL TO ANALYZE
- Name: ${school.name}
- Level: ${school.level}
- Rating from listing: ${school.rating}
- Distance from property: ${school.distance}
- City: ${property.city}, ${property.state}

## DATA POINTS TO RESEARCH

Use your search tools to find comprehensive data about this school. Be thorough and cite real data.

RECENCY RULE: The current year is ${new Date().getFullYear()}. Only use data from the ${new Date().getFullYear() - 1}-${new Date().getFullYear()} or ${new Date().getFullYear() - 2}-${new Date().getFullYear() - 1} school years. REJECT any statistics, enrollment numbers, AP data, test scores, or reviews from ${new Date().getFullYear() - 3} or earlier. If only outdated data is available for a field, write "Current data not available".

1. **Academic Performance**: Test score proficiency rates (Math & ELA), any notable AP/IB programs offered, number of AP courses
2. **College Readiness** (high schools only): Graduation rate, college acceptance rate, average SAT/ACT scores, notable college acceptances, percentage attending 4-year vs 2-year institutions
3. **Student Experience**: Student-teacher ratio, total enrollment, demographics summary
4. **Community Sentiment**: What do parents love about this school? What are common concerns or complaints? (from Niche reviews, GreatSchools reviews, Google Reviews, local forums)
5. **Extracurriculars & Strengths**: Notable programs — athletics, arts, STEM, debate, music. Any championship teams or award-winning programs.
6. **Recent Developments**: Any recent news — new principal, construction, boundary changes, safety incidents, awards, funding changes
7. **District Info**: The school district name
8. **Sources**: Include the actual URLs of the web pages you used to gather this data (e.g. greatschools.org, niche.com, the school's official website, news articles). List the 3-5 most important source URLs.

## OUTPUT FORMAT

Return a JSON object with this exact structure:

{
  "name": "${school.name}",
  "type": "public | private | charter | magnet",
  "level": "${school.level}",
  "grades_served": "e.g. K-5, 6-8, 9-12",
  "district_name": "School district name",
  "test_scores": "Summary of Math & ELA proficiency rates...",
  "ap_ib_programs": "List of AP/IB courses or 'N/A' for elementary...",
  "graduation_rate": "95% or N/A",
  "college_readiness": "Summary of college placement data or N/A...",
  "student_teacher_ratio": "22:1",
  "enrollment": 850,
  "demographics_summary": "Brief demographics and socioeconomic summary...",
  "parent_sentiment_positive": "What parents love — specific praises from reviews...",
  "parent_sentiment_concerns": "Common complaints or concerns from reviews...",
  "extracurriculars": "Notable programs, sports, arts, STEM...",
  "recent_news": "Any recent developments, awards, or changes...",
  "overall_assessment": "2-3 sentence assessment of this school...",
  "sources": [
    {"url": "https://www.greatschools.org/...", "title": "School Name - GreatSchools"},
    {"url": "https://www.niche.com/k12/...", "title": "School Name Reviews - Niche"}
  ]
}

**CRITICAL: Respond ONLY with valid JSON. No markdown fences, no extra text.**
`;

// ── Schema for a single school analysis ──

export const schoolAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING },
        type: { type: Type.STRING },
        level: { type: Type.STRING },
        grades_served: { type: Type.STRING },
        district_name: { type: Type.STRING },
        test_scores: { type: Type.STRING },
        ap_ib_programs: { type: Type.STRING },
        graduation_rate: { type: Type.STRING },
        college_readiness: { type: Type.STRING },
        student_teacher_ratio: { type: Type.STRING },
        enrollment: { type: Type.NUMBER },
        demographics_summary: { type: Type.STRING },
        parent_sentiment_positive: { type: Type.STRING },
        parent_sentiment_concerns: { type: Type.STRING },
        extracurriculars: { type: Type.STRING },
        recent_news: { type: Type.STRING },
        overall_assessment: { type: Type.STRING },
        sources: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    url: { type: Type.STRING },
                    title: { type: Type.STRING },
                },
                required: ["url", "title"]
            }
        },
    },
    required: [
        "name", "type", "level", "grades_served", "district_name",
        "test_scores", "student_teacher_ratio", "enrollment",
        "parent_sentiment_positive", "parent_sentiment_concerns",
        "extracurriculars", "overall_assessment", "sources"
    ]
};
