import { Lead } from "../../types";

export const getDailyPulsePrompt = (leads: Lead[]) => {
    // Simplify leads for the prompt to save tokens and focus on the last 14 days
    const simplifiedLeads = leads.map(l => ({
        name: l.fullName || `${l.firstName || ''} ${l.lastName || ''}`.trim(),
        type: l.leadType,
        phone: l.phone || l.primaryContact?.phone || '',
        status: l.status,
        temp: l.engagementScore || 'Cold',
        budget: l.price || l.leadInfo?.searchCriteria?.priceMax || 0,
        received: l.receivedAt,
        lastUpdated: l.lastUpdated,
        motivation: l.motivation,
        lastContact: l.lastTouch,
        message: l.message || l.leadInfo?.customerMessage,
        property: l.propertyAddress || l.leadInfo?.inquiryProperty?.address
    }));

    return {
        systemInstruction: `Act as the "Zyphe Intelligence Engine." Your goal is to synthesize a high-level briefing for a Realtor's morning dashboard. Analyze the provided list of leads and output a "Daily Pulse" report.`,
        prompt: `
Task:
1. Prioritization: Identify the top 5 "Must-Action" leads. For each, give a 10-word reason why they are the priority. Include their phone number and lead type (Buyer or Seller) in the response.
2. Pipeline Health: Calculate the total 'PriceMax' (budget) of all leads marked as "Active" or "Hot" (status containing 'Active' or engagementScore 'Hot').
3. The 'Red Flag' List: Identify any leads that are "Stale" or "Archived" but have a high budget (> $700k), and suggest one reactivation 'hook.'
4. Daily Focus: Give me one "Pro Tip" for the day based on the overall volume of the leads (e.g., if lead volume is high, focus on qualifying; if low, focus on old lead reactivation).

User Data (Last 14 days of leads):
${JSON.stringify(simplifiedLeads, null, 2)}

Output Format (JSON):
{
  "activePipelineValue": number,
  "dailyFive": [
    { "name": string, "reason": string, "phone": string, "type": "Buyer" | "Seller" }
  ],
  "redFlags": [
    { "name": string, "hook": string }
  ],
  "proTip": string,
  "summary": {
    "activePursuits": number,
    "neglectedLeads": number
  }
}
`
    };
};

export const dailyPulseSchema = {
    type: "object" as const,
    properties: {
        activePipelineValue: { type: "number" as const },
        dailyFive: {
            type: "array" as const,
            items: {
                type: "object" as const,
                properties: {
                    name: { type: "string" as const },
                    reason: { type: "string" as const },
                    phone: { type: "string" as const },
                    type: { type: "string" as const, enum: ["Buyer", "Seller"] }
                },
                required: ["name", "reason", "phone", "type"]
            }
        },
        redFlags: {
            type: "array" as const,
            items: {
                type: "object" as const,
                properties: {
                    name: { type: "string" as const },
                    hook: { type: "string" as const }
                },
                required: ["name", "hook"]
            }
        },
        proTip: { type: "string" as const },
        summary: {
            type: "object" as const,
            properties: {
                activePursuits: { type: "number" as const },
                neglectedLeads: { type: "number" as const }
            },
            required: ["activePursuits", "neglectedLeads"]
        }
    },
    required: ["activePipelineValue", "dailyFive", "redFlags", "proTip", "summary"]
};
