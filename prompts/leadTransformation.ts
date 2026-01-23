export const getLeadTransformationPrompt = (csvData: string) => {
    return `Role: Act as a Senior Data Engineer.

Task: Map the data from the uploaded Source CSV to the provided Target JSON Schema.

Inputs:

Target Schema (JSON):
{
  "fullName": "string",
  "leadType": "Buyer | Seller",
  "source": "string",
  "status": "New | Qualified | Attempted to Contact | Meeting Fixed | Broker Agreement Sent | Broker Agreement Signed | Actively Searching | Showing | Offer | In Contract",
  "receivedAt": "date",
  "primaryContact": {
    "email": "string",
    "phone": "string",
    "preferredMethod": "Phone | Email | SMS | WhatsApp",
    "homeAddress": "string"
  },
  "leadInfo": {
    "referralType": "string",
    "campaign": "string",
    "customerMessage": "string",
    "budgetRange": "string"
  },
  "engagementScore": "Cold | Warm | Hot | Stale",
  "motivation": "string",
  "targetTimeline": "ASAP | 1-3 Months | 3-6 Months | 6-12 Months | Just Browsing",
  "personaProfile": "First-Time | Investor | Past Client | Relocation",
  "financialVitals": {
    "preApprovalStatus": "boolean",
    "isAllCash": "boolean",
    "budgetMax": "number"
  },
  "searchCriteria": {
    "locations": "string",
    "mustHaves": "string",
    "dealBreakers": "string"
  }
}

Source Data: 
<source_csv>
${csvData}
</source_csv>

Instructions:

1. Semantic Alignment: Identify matches based on meaning (e.g., "prop_desc" should map to "listing_summary" or "lead_name" to "fullName").
2. Data Transformation: Ensure all values match the data types defined in the JSON (e.g., convert "Yes/No" to "true/false", format currencies as floats, parse dates).
3. Constraint Adherence: If the JSON schema requires a "Required" field that is missing in the CSV, flag it with "NULL".
4. Output Requirement: Generate a new CSV that contains all the records from the source file, but strictly follows the headers and formatting of the target schema.
   - For nested objects, flatten them using dot notation (e.g., primaryContact.email, leadInfo.budgetRange).
   - Use standard comma-separated values (CSV) format.
   - Use double quotes for strings that contain commas.

Deliverable: Provide the final mapped data as a code block of a CSV. Do not include any other text.`;
};
