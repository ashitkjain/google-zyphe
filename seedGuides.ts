import { saveGuideContent } from './services/firebaseService.ts';

const seedGuides = async () => {
    console.log("Starting Guide Generation & Seeding...");

    const guides = [
        {
            topicSlug: 'hoa',
            slug: 'what-happens-if-hoa-fines-go-unpaid-california',
            title: 'What happens if HOA fines go unpaid in California?',
            content: `
# What happens if HOA fines go unpaid in California?

For many California homeowners, a notice of a violation from a Homeowners Association (HOA) can be a source of significant stress. Whether the violation is for a landscaping issue, an unapproved exterior paint color, or a noise complaint, the resulting fines can quickly escalate if left unaddressed. Understanding the specific legal framework in California—governed primarily by the Davis-Stirling Common Interest Development Act—is essential for any homeowner navigating this process.

This guide explains the step-by-step progression of what happens when HOA fines are not paid, the limitations on HOA power in California, and the specific timelines homeowners should expect.

---

## The Step-by-Step Process of Unpaid HOA Fines

### 1. Notice of Violation and Hearing
Before any fine can be legally imposed in California, the HOA must follow a strict procedural path.
- **Initial Notice:** The HOA sends a formal "Notice of Violation" detailing the specific rule breached.
- **Hearing Request:** Under California Civil Code Section 5855, the board must notify the member in writing at least 10 days before a meeting where a fine might be imposed.
- **The Decision:** Following the hearing, the board has 15 days to provide a written explanation of their decision to the homeowner.

### 2. The Imposition of the Fine
If the board determines a violation occurred, they will officially levy the fine against the owner's account. This fine is usually categorized as a "monetary penalty."

### 3. Collection Letters and Late Fees
Once a fine is past due, the HOA will typically begin its internal collection process:
- **Reminder Notices:** Standard billing statements showing the outstanding balance.
- **Demand Letters:** A formal notice demanding payment within a specific timeframe (usually 15-30 days).
- **Late Fees and Interest:** In California, an HOA can charge a late fee of $10.00 or 10% of the delinquent assessment, whichever is greater (unless the CC&Rs specify a smaller amount). Interest can also be charged at a rate up to 12% per year.

### 4. Internal Dispute Resolution (IDR) and Alternative Dispute Resolution (ADR)
Before litigation, California law requires "Meet and Confer" (IDR).
- **IDR Request:** Either the homeowner or the HOA can request a meeting to resolve the dispute informally.
- **ADR:** If IDR fails, the parties may move to ADR (Mediation or Arbitration). If the HOA intends to sue a homeowner, they MUST offer ADR first.

### 5. Small Claims Court or Civil Litigation
**Crucial Distinction:** In California, HOAs cannot inclusive "fines" or "monetary penalties" for rule violations in a standard assessment lien that leads to foreclosure.
- To collect unpaid fines, the HOA must typically sue the homeowner in Small Claims Court or Superior Court.
- If the HOA wins, they receive a **Money Judgment**.

### 6. Recording a Judgment Lien
While they cannot foreclose for *fines alone*, once they have a money judgment from a court, they can record an "Abstract of Judgment."
- This creates a lien on the property for the amount of the judgment.
- This lien will usually need to be cleared when the homeowner sells or refinances the property.

---

## Simple Timeline Section

| Milestone | Typical Timeline | Action Required |
|-----------|------------------|-----------------|
| **Notice of Violation** | Day 1 | Review the specific CC&R rule cited. |
| **Notice of Hearing** | Day 10-15 | Prepare evidence or a defense for the board. |
| **Notice of Decision** | Within 15 days of hearing | Confirm if fine was upheld or dropped. |
| **Payment Due Date** | 30 days after decision | Pay or request IDR. |
| **First Demand Letter** | 30-60 days past due | High urgency: Interest begins accruing. |
| **IDR/ADR Offer** | Variable | Last chance for informal resolution. |
| **Court Filing** | 6+ months past due | HOA files for money judgment. |

---

## What this does NOT mean

- **It does NOT mean immediate foreclosure:** Unlike unpaid regular monthly assessments (dues), an HOA in California **cannot** foreclose on your home solely for unpaid fines or monetary penalties for rule violations.
- **It does NOT mean you lose your voting rights immediately:** Most associations must follow specific procedures before suspending privileges.
- **It does NOT mean the fine is "automatic":** If the HOA did not provide you with a hearing notice 10 days in advance, the fine may be legally unenforceable.

---

## Frequently Asked Questions (FAQs)

### 1. Can the HOA turn off my water or electricity if I don't pay a fine?
No. HOAs in California are generally prohibited from suspending essential utility services or restricting access to your home as a tool for collecting fines. They may, however, be able to suspend access to "common area" amenities like pools or gyms after a proper hearing.

### 2. Is there a limit on how much an HOA can fine me?
The fine must be "reasonable." While California law doesn't set a specific dollar cap, the fine schedule must be distributed to all members annually. If a fine is grossly disproportionate to the violation, it may be challenged as "unreasonable" in court.

### 3. Can I ignore the fine if I think it's unfair?
Ignoring the fine is rarely a successful strategy. Interest and late fees will accumulate, and the HOA's legal costs may eventually be added to the judgment against you. It is better to use the IDR/ADR process to challenge the fine formally.

### 4. Can an HOA take my car for unpaid fines?
Not directly. An HOA can request a court order to garnish wages or levy bank accounts once they have a money judgment, but they don't have the "self-help" power to simply seize vehicles for simple rule-violation fines unless it's a specific parking tow-away zone violation.

### 5. What if the violation was caused by a Previous Owner?
Generally, you are not responsible for fines incurred by a previous owner unless they were recorded as a lien on the property before you purchased it and your title insurance or escrow didn't catch it.

### 6. Do I have to hire a lawyer for an HOA hearing?
No. Homeowners often represent themselves at board hearings and in IDR. However, if the matter moves to ADR or Superior Court, legal counsel is often recommended.

### 7. Can the HOA fine me for something that isn't in the rules?
No. A fine can only be issued for a violation of a specific provision in the CC&Rs, Bylaws, or Operating Rules that was in effect at the time of the violation.

---

## Summary
In California, the process for unpaid HOA fines moves from a formal hearing to internal collection efforts, and potentially to a court judgment. While the HOA maintains strong power to enforce rules, they are restricted from using foreclosure as a primary collection tool for rule-violation fines. Homeowners are encouraged to engage in the IDR process early to prevent a manageable fine from becoming a significant legal judgment.
            `
        },
        {
            topicSlug: 'insurance',
            slug: 'homeowners-insurance-claim-denied',
            title: 'Why was my homeowners insurance claim denied?',
            content: `
# Why was my homeowners insurance claim denied?

Filing a homeowners insurance claim is often a necessity born from a traumatic event—a fire, a theft, or a sudden pipe burst. Receiving a denial letter in the mail following such an event can feel like a secondary disaster. However, in the insurance industry, denials are a procedural outcome based on the language of the contract (the policy). In California, insurers are regulated by the Department of Insurance and must follow specific fair claims settlement practices.

This guide explores the common reasons for denial, the step-by-step appeals process, and what homeowners should understand about their rights.

---

## Common Reasons for Claim Denials

Insurance policies are "conditional contracts." The insurer only pays if specific conditions are met and the cause of loss is "covered."

### 1. Excluded Perils
Most standard policies (HO-3) exclude specific "perils" unless you have added a special endorsement. In California, common exclusions include:
- **Earthquakes:** Requires a separate policy or endorsement.
- **Floods:** Not to be confused with water damage from a burst pipe; flood insurance is a separate product.
- **Wear and Tear:** Gradual deterioration (e.g., a roof that is 30 years old) is a maintenance issue, not a "sudden and accidental" loss.

### 2. Lack of Maintenance
If an insurer determines that the damage occurred because the homeowner failed to maintain the property (e.g., a slow leak under a sink that occurred over several months), they may deny the claim.

### 3. Filing Delay
California policies often specify that a loss must be reported "promptly" or within a specific timeframe (often 24-48 hours for immediate damage, and up to one year for the formal lawsuit). A significant delay can give the insurer grounds to argue their ability to investigate was prejudiced.

### 4. Intentional Acts or Fraud
Damage caused intentionally by the insured or misrepresentations on the claim form will result in an immediate denial and potentially legal consequences.

---

## The Step-by-Step Appeals Process

### 1. Review the Denial Letter
Under California law, the insurer must provide a written explanation of the denial, citing the specific policy language and "exclusion" they are relying upon. 

### 2. Request the Claim File
You have the right to request the documents the insurance company used to make their decision, including the adjuster's report and any third-party expert findings (like an engineer’s report).

### 3. File a Formal Internal Appeal
Most insurers have an internal "appeals" or "ombudsman" department. Present your evidence (photos, contractor estimates, or expert second opinions) that contradicts their reason for denial.

### 4. California Department of Insurance (CDI) Inquiry
If the internal appeal fails, you can file a complaint with the CDI. They will investigate to ensure the insurer followed California's "Fair Claims Settlement Practices Regulations."

### 5. Demand Appraisal or Mediation
Many policies contain an "Appraisal" clause (for disputes over the *amount* of loss) or you can request voluntary mediation through the state.

---

## Simple Timeline Section

| Phase | Timeline | Action Required |
|-----------|------------------|-----------------|
| **Denial Issued** | Day 0 | Mark the date; the "statute of limitations" clock is ticking. |
| **Evidence Gathering** | Week 1-3 | Get independent quotes and expert opinions. |
| **Internal Appeal Filing** | Within 30 days of denial | Submit a formal written letter contesting the denial. |
| **Insurer Response** | 15-30 days | Insurer will either uphold the denial or reopen the claim. |
| **State Complaint** | If appeal fails | File with the California Dept. of Insurance. |

---

## What this does NOT mean

- **It does NOT mean the case is permanently closed:** A denial is the insurer's initial legal position. It can be overturned with new evidence or through legal pressure.
- **It does NOT mean you are "in trouble":** Unless you committed fraud, a denial is simply a contract dispute.
- **It does NOT mean there is no money available:** Even if the insurer denies the *primary* claim, there may be "Loss of Use" or other sub-limits that still apply.

---

## Frequently Asked Questions (FAQs)

### 1. Can an insurance company deny a claim for high-payout amounts?
The dollar amount of a claim should not be a factor in whether it is denied. However, high-value claims naturally receive much more scrutiny. An insurer must provide a valid factual or contractual reason for denial regardless of the claim size.

### 2. What if my contractor says it's covered but the adjuster says it isn't?
Contractors are experts in building/repairing, but they are not experts in insurance policy law. The insurance adjuster's decision is based on the contract language. If they disagree, you may need a "Public Adjuster" or an attorney to advocate on the policy interpretation side.

### 3. Does a denied claim count against my insurance history?
Yes. Even if a claim is denied, it is recorded in the "C.L.U.E." report (Comprehensive Loss Underwriting Exchange), which other insurers use to determine your risk level and premiums.

### 4. Should I hire a Public Adjuster?
Public Adjusters represent *you*, not the insurance company. They charge a percentage of the settlement (often 10-15%). They are most useful for complex, high-value claims where bridge-building between your evidence and the insurer's requirements is needed.

### 5. Can I sue the insurance company for a denial?
Yes. If you believe the insurer acted "in bad faith" (unreasonably denying a claim without proper investigation), you can file a civil lawsuit. In California, bad faith claims can sometimes result in damages beyond the original policy limit.

---

## Summary
A claim denial is a formal notification that the insurer believes the loss falls outside the contract's scope. By methodically reviewing the denial letter, gathering independent evidence, and utilizing state regulatory resources, California homeowners can often find a path to resolution. Engagement and documentation are the two most critical tools in contesting an insurance denial.
            `
        }
    ];

    for (const guide of guides) {
        process.stdout.write(`Seeding guide: ${guide.title}... `);
        const result = await saveGuideContent(guide);
        if (result.success) {
            console.log("✅");
        } else {
            console.log("❌", result.error);
        }
    }

    console.log("Seeding process complete.");
};

// Start seeding
seedGuides();
