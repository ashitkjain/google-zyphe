import { Lead, CRMTask, CalendarEvent } from "../../types";

export const getDailyPulsePrompt = (leads: Lead[], tasks: CRMTask[], events: CalendarEvent[]) => {
    const now = new Date();
    const todayStr = now.toDateString();

    // Simplify leads
    const simplifiedLeads = leads.map(l => ({
        name: l.fullName || `${l.firstName || ''} ${l.lastName || ''}`.trim(),
        type: l.leadType,
        phone: l.phone || l.primaryContact?.phone || '',
        status: l.status,
        temp: l.engagementScore || 'Cold',
        budget: l.price || l.financialVitals?.budgetMax || 0,
        motivation: l.motivation,
        property: l.propertyAddress || l.leadInfo?.inquiryProperty?.address
    }));

    return {
        systemInstruction: `Act as the "Zyphe Intelligence Engine." Your goal is to synthesize a high-level briefing for a Realtor's morning dashboard. Analyze leads, tasks, and meetings to output a "Morning Briefing" report. Today's date is ${todayStr}.`,
        prompt: `
Task:
1. Prioritization: Identify the top 5 "Must-Action" leads. For each, give a 10-word reason why they are the priority. Include their phone number and lead type (Buyer or Seller).
2. Pipeline Health: Calculate the total budget of all leads marked as "Active" or "Hot".
3. The 'Red Flag' List: Identify high-budget leads (> $700k) that are "Stale" or "Archived" and suggest a reactivation hook.
4. Daily Focus: Give one "Pro Tip" for the day.

User Data:
Leads: ${JSON.stringify(simplifiedLeads, null, 1)}

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
