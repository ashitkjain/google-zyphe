import { Type } from "@google/genai";
import { PropertyData, School } from "../../types";

/**
 * Generate a sanitized cache key for a school.
 *
 * Uses the FULL school name + city + state to produce a Firestore-safe document ID.
 *
 * ⚠️  Do NOT revert to using only the first two words of the school name.
 * Schools like "Harvest Park Middle School" and "Harvest Park Preschool" share
 * the same first two words but are entirely different schools. A truncated key
 * causes a cache collision where both map to the same Firestore document and
 * the wrong school's analysis is served.
 */
export const getSchoolCacheKey = (schoolName: string, city: string, state: string = ''): string => {
    const normalizedName = schoolName.trim().replace(/\s+/g, '_');
    return `${normalizedName}_${city}_${state}`
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

RECENCY RULE: The current year is ${new Date().getFullYear()}. Prefer data from the ${new Date().getFullYear() - 1}-${new Date().getFullYear()} or ${new Date().getFullYear() - 2}-${new Date().getFullYear() - 1} school years. Data from the ${new Date().getFullYear() - 3}-${new Date().getFullYear() - 2} school year is also acceptable if more recent data is unavailable. Only reject statistics older than the ${new Date().getFullYear() - 3}-${new Date().getFullYear() - 2} school year. Always note the data year when citing statistics.

1. **Student Body & Scope**: Current total enrollment numbers and the specific grades served (e.g., K-5, 6-8, 9-12).
2. **Academic Performance**: Test score proficiency rates (Math & ELA).
3. **Extracurriculars & Strengths**: Notable programs — athletics, arts, STEM, debate, music. Identify championship teams or award-winning programs.
4. **College Readiness (HIGH SCHOOLS & MIDDLE SCHOOLS)**: For High Schools, find graduation rates, college acceptance rates, and average SAT/ACT scores. For Middle Schools, find data on high school preparation and any early college-track programs.
5. **AP/IB Programs (HIGH SCHOOLS ONLY)**: Detailed list of AP or IB courses offered. For Middle/Elementary, skip this or note if advanced placement is available for math/science.
6. **Community Sentiment**: What do parents love about this school? What are common concerns or complaints? (from Niche reviews, GreatSchools reviews, Google Reviews).
7. **Demographics**: Brief summary of the student body diversity and community makeup.
8. **Student-Teacher Ratio**: The current ratio of students to teachers.
9. **Recent Developments**: Any recent news — new principal, construction, safety awards, or funding changes.
10. **Sources**: Include the actual URLs of the web pages you used.

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
