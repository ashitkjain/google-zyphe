import { Lead, CRMTask, CalendarEvent } from "../../types";

export const getDailyPulsePrompt = (leads: Lead[], tasks: CRMTask[], events: CalendarEvent[]) => {
    const now = new Date();
    const todayStr = now.toDateString();

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    const parseDate = (val: any): Date => {
        if (!val) return new Date(0);
        if (typeof val.toDate === 'function') return val.toDate();
        if (val.seconds !== undefined) return new Date(val.seconds * 1000);
        return new Date(val);
    };

    // Simplify leads
    const simplifiedLeads = leads.map(l => ({
        name: l.fullName || `${l.firstName || ''} ${l.lastName || ''}`.trim(),
        type: l.leadType,
        phone: l.phone || l.primaryContact?.phone || '',
        status: l.status,
        temp: l.engagementScore || 'Cold',
        budget: l.price || l.leadInfo?.searchCriteria?.priceMax || 0,
        motivation: l.motivation,
        property: l.propertyAddress || l.leadInfo?.inquiryProperty?.address
    }));

    // Simplify Tasks (Filter for relevant ones)
    const simplifiedTasks = tasks.map(t => ({
        id: t.id,
        name: t.name,
        due: parseDate(t.dueDate),
        status: t.status,
        priority: t.priority
    })).filter(t => t.status !== 'DONE' && t.status !== 'Completed');

    // Simplify Meetings
    const simplifiedEvents = events.map(e => ({
        id: e.id,
        title: e.title,
        start: parseDate(e.start),
        type: e.type,
        client: e.client
    }));

    return {
        systemInstruction: `Act as the "Zyphe Intelligence Engine." Your goal is to synthesize a high-level briefing for a Realtor's morning dashboard. Analyze leads, tasks, and meetings to output a "Morning Briefing" report. Today's date is ${todayStr}.`,
        prompt: `
Task:
1. Prioritization: Identify the top 5 "Must-Action" leads. For each, give a 10-word reason why they are the priority. Include their phone number and lead type (Buyer or Seller).
2. Pipeline Health: Calculate the total budget of all leads marked as "Active" or "Hot".
3. The 'Red Flag' List: Identify high-budget leads (> $700k) that are "Stale" or "Archived" and suggest a reactivation hook.
4. Schedule & Agendas:
   - Identify "Today's Tasks": Tasks due on ${todayStr} that are not done.
   - Identify "Upcoming Tasks": Tasks due in the next 3 days (after today).
   - Identify "Today's Meetings": Calendar events starting on ${todayStr}.
5. Daily Focus: Give one "Pro Tip" for the day.

User Data:
Leads: ${JSON.stringify(simplifiedLeads, null, 1)}
Tasks: ${JSON.stringify(simplifiedTasks, null, 1)}
Meetings: ${JSON.stringify(simplifiedEvents, null, 1)}

Output Format (JSON):
{
  "activePipelineValue": number,
  "dailyFive": [
    { "name": string, "reason": string, "phone": string, "type": "Buyer" | "Seller" }
  ],
  "todayTasks": [
    { "name": string, "priority": string }
  ],
  "upcomingTasks": [
    { "name": string, "dueDate": string }
  ],
  "todayMeetings": [
    { "title": string, "time": string, "client": string }
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
        todayTasks: {
            type: "array" as const,
            items: {
                type: "object" as const,
                properties: {
                    name: { type: "string" as const },
                    priority: { type: "string" as const }
                },
                required: ["name", "priority"]
            }
        },
        upcomingTasks: {
            type: "array" as const,
            items: {
                type: "object" as const,
                properties: {
                    name: { type: "string" as const },
                    dueDate: { type: "string" as const }
                },
                required: ["name", "dueDate"]
            }
        },
        todayMeetings: {
            type: "array" as const,
            items: {
                type: "object" as const,
                properties: {
                    title: { type: "string" as const },
                    time: { type: "string" as const },
                    client: { type: "string" as const }
                },
                required: ["title", "time"]
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
    required: ["activePipelineValue", "dailyFive", "todayTasks", "upcomingTasks", "todayMeetings", "redFlags", "proTip", "summary"]
};
