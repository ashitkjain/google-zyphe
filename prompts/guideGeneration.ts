
export interface GuideResult {
   title: string;
   introduction: string;
   whatThisMeans: {
      title: string;
      content: string;
   };
   whyThisHappens: {
      title: string;
      content: string;
   };
   legalFramework: {
      title: string;
      context: string;
      statutes: Array<{ code: string; relevance: string }>;
   };
   timelines: {
      title: string;
      events: Array<{ event: string; timeframe: string; impact: string }>;
   };
   whoIsCommonlyInvolved: {
      title: string;
      roles: Array<{ role: string; description: string }>;
   };
   resolutionPathway: Array<{
      step: number;
      title: string;
      action: string;
   }>;
   whatThisDoesNotMean: {
      title: string;
      points: string[];
   };
   commonMisunderstandings: Array<{
      misunderstanding: string;
      reality: string;
   }>;
   expertPerspective: {
      title: string;
      assessment: string;
      riskMitigation: string[];
   };
   faqs: Array<{
      question: string;
      answer: string;
   }>;
   keyTakeaways: string[];
   summary: {
      title: string;
      content: string;
   };
}

export const guideGenerationSchema = {
   type: "object",
   properties: {
      title: { type: "string" },
      introduction: { type: "string" },
      whatThisMeans: {
         type: "object",
         properties: {
            title: { type: "string" },
            content: { type: "string" }
         },
         required: ["title", "content"]
      },
      whyThisHappens: {
         type: "object",
         properties: {
            title: { type: "string" },
            content: { type: "string" }
         },
         required: ["title", "content"]
      },
      legalFramework: {
         type: "object",
         properties: {
            title: { type: "string" },
            context: { type: "string" },
            statutes: {
               type: "array",
               items: {
                  type: "object",
                  properties: {
                     code: { type: "string" },
                     relevance: { type: "string" }
                  },
                  required: ["code", "relevance"]
               }
            }
         },
         required: ["title", "context", "statutes"]
      },
      timelines: {
         type: "object",
         properties: {
            title: { type: "string" },
            events: {
               type: "array",
               items: {
                  type: "object",
                  properties: {
                     event: { type: "string" },
                     timeframe: { type: "string" },
                     impact: { type: "string" }
                  },
                  required: ["event", "timeframe", "impact"]
               }
            }
         },
         required: ["title", "events"]
      },
      whoIsCommonlyInvolved: {
         type: "object",
         properties: {
            title: { type: "string" },
            roles: {
               type: "array",
               items: {
                  type: "object",
                  properties: {
                     role: { type: "string" },
                     description: { type: "string" }
                  },
                  required: ["role", "description"]
               }
            }
         },
         required: ["title", "roles"]
      },
      resolutionPathway: {
         type: "array",
         items: {
            type: "object",
            properties: {
               step: { type: "number" },
               title: { type: "string" },
               action: { type: "string" }
            },
            required: ["step", "title", "action"]
         }
      },
      whatThisDoesNotMean: {
         type: "object",
         properties: {
            title: { type: "string" },
            points: {
               type: "array",
               items: { type: "string" }
            }
         },
         required: ["title", "points"]
      },
      commonMisunderstandings: {
         type: "array",
         items: {
            type: "object",
            properties: {
               misunderstanding: { type: "string" },
               reality: { type: "string" }
            },
            required: ["misunderstanding", "reality"]
         }
      },
      expertPerspective: {
         type: "object",
         properties: {
            title: { type: "string" },
            assessment: { type: "string" },
            riskMitigation: {
               type: "array",
               items: { type: "string" }
            }
         },
         required: ["title", "assessment", "riskMitigation"]
      },
      faqs: {
         type: "array",
         items: {
            type: "object",
            properties: {
               question: { type: "string" },
               answer: { type: "string" }
            },
            required: ["question", "answer"]
         }
      },
      keyTakeaways: {
         type: "array",
         items: { type: "string" }
      },
      summary: {
         type: "object",
         properties: {
            title: { type: "string" },
            content: { type: "string" }
         },
         required: ["title", "content"]
      }
   },
   required: [
      "title",
      "introduction",
      "whatThisMeans",
      "whyThisHappens",
      "legalFramework",
      "timelines",
      "whoIsCommonlyInvolved",
      "resolutionPathway",
      "whatThisDoesNotMean",
      "commonMisunderstandings",
      "expertPerspective",
      "faqs",
      "keyTakeaways",
      "summary"
   ]
};

export const getGuideGenerationPrompt = (category: string, title: string) => {
   return `
You are writing an educational guide about California homeownership and property operations.
You are NOT acting as an attorney, broker, tax advisor, or financial advisor, and you must NOT provide legal, tax, or financial advice.

OUTPUT REQUIREMENTS (STRICT):
- Output ONLY a single JSON object that matches the provided GuideResult schema exactly.
- Do NOT include markdown blocks (\`\`\`json), technical commentary, or extra keys outside the schema.
- All strings must be plain text with clean markdown formatting (bolding, lists) where appropriate for density.
- No emojis anywhere in the content.
- Length: The total content across all fields should be between 1,300 and 1,700 words. Provide depth and detail in every section.

STYLE & TONE:
- Use clear subheadings within sections if needed and keep paragraphs short and readable.
- Use neutral, factual, and high-authority language suitable for the general public.
- Do NOT mention AI, Gemini, content generation, or any other artificial origin.
- Do NOT include links, citations, sources, or footnotes.
- Do NOT include disclaimers beyond those specified in the Scope & Disclaimer section.

SCOPE & DISCLAIMER LANGUAGE (MUST BE INCLUDED IN CONTENT):
- In the "introduction" field, include a short educational notice stating:
  "This guide provides general educational information and does not provide legal, tax, or financial advice. Rules and timelines may vary by location and change over time."
- Throughout the guide, clearly indicate variability (e.g., “generally,” “typically,” “often,” “may,” “can include,” “in many cases”).

SAFETY & LEGAL GUARDRAILS (MANDATORY):
- Do NOT instruct the reader what they should/must do. Avoid imperative directives.
- Do NOT provide guarantees, absolute outcomes, or definitive predictions.
- Avoid definitive deadlines unless presented as commonly observed ranges and explicitly stated as variable.
- Do NOT claim to be fully up-to-date in 2026 unless the information is framed as “commonly used references” and “may change.”
- Do NOT encourage specific legal action, threaten consequences, or provide individualized strategies.
- Avoid telling the reader to hire a specific type of professional; if mentioning professionals, do so neutrally (e.g., “Some people choose to consult…”).

FIELD-SPECIFIC INSTRUCTIONS (KEEP JSON SHAPE UNCHANGED):

1) title (string)
- Clear, descriptive, non-sensational.
- Must be phrased as a question where possible.

2) introduction (string)
- Start with the educational notice (required).
- Explain why the topic matters in practical terms (stress-reducing, process clarity).
- No sales language, no calls to action.

3) whatThisMeans (object)
- title: "What This Means"
- content: Explain the concept in plain English with high detail. No recommendations.

4) whyThisHappens (object)
- title: "Why This Happens"
- content: Describe common reasons or triggers. Use soft, qualifying language.

5) legalFramework (object)
- title: neutral (e.g., "Legal and Regulatory Context")
- context: high-level overview only; explain how frameworks generally work.
- statutes: include 2–6 items. Each "code" should be a high-level reference label, not legal advice.
  Examples of acceptable "code" values:
  - "Davis–Stirling Common Interest Development Act (overview)"
  - "California Civil Code (selected sections; varies by topic)"
  - "California Revenue & Taxation Code (property tax concepts; overview)"
  - "Proposition 13 / Proposition 19 (high-level concepts)"
  In "relevance", describe what the framework commonly governs, using qualifying language.
- Do NOT cite precise subsections, do NOT quote statutes, and do NOT state legal conclusions.

6) timelines (object)
- title: "Typical Timeline (Illustrative; Varies)"
- events: 4–10 items.
- timeframe: Use range and stages (e.g., "early stage", "later stage", "often within days to weeks", "commonly 30–90 days"). Avoid exact deadlines or mandates.
- impact: describe potential implications neutrally (no fear-mongering). State that timelines vary.

7) whoIsCommonlyInvolved (object)
- title: "Who Is Commonly Involved or Affected"
- roles: Array of objects. Each object MUST have:
  - "role" (string): the name of the role (e.g., "Homeowner", "HOA Board")
  - "description" (string): a brief, neutral description of their role or how they are affected.

8) resolutionPathway (array)
- This MUST be framed as "common options or steps people consider" rather than directives.
- action strings must be non-prescriptive and informational:
  Use patterns like:
  - "Commonly involves documenting..."
  - "Often includes reviewing..."
  - "May include requesting..."
  - "Some homeowners consider..."
- Include 4–8 steps, numbered 1..N.
- Do NOT include: “You should…”, “You must…”, “Do this now…”, “File X lawsuit…”.

9) whatThisDoesNotMean (object)
- title: "What This Does NOT Mean"
- points: Explicitly correct common misconceptions. Clarify limits of applicability.

10) commonMisunderstandings (array)
- Neutral explanations of common misunderstandings vs reality. Avoid corrective advice.

11) expertPerspective (object)
- title: neutral (e.g., "Practical Considerations and Common Pitfalls")
- assessment: summarize typical pitfalls and decision points without advising.
- riskMitigation: 4–8 neutral “risk reduction” bullets (strings), phrased as general practices (e.g., documentation, keeping records, understanding notices, confirming jurisdiction differences).
- No individualized recommendations.

12) faqs (array)
- 5–7 questions and informational answers. No action guidance. Use jurisdiction-neutral wording.

13) keyTakeaways (array)
- 5–9 items.
- Plain, general, non-advisory statements.

14) summary (object)
- title: "Summary"
- content: Restate educational purpose and end with a neutral closing paragraph. Emphasize variability and general nature of information.

CONTENT CONTEXT:
Category: ${category}
Guide Title: ${title}

QUALITY BAR:
- Be specific to California process patterns, but always state variability.
- Prefer clarity and practical explanation over legalistic detail.
- No generic filler; keep it useful.
- Ensure the total word count is between 1,300 and 1,700 words.
`;
};
