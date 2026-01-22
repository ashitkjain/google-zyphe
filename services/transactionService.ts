import { ChecklistCategory } from '../types/transaction';

// Buyer Checklist (Original)
const getBuyerCategories = (): ChecklistCategory[] => [
    {
        id: 'c1',
        name: '1. Contract & Initial Review',
        icon: '📁',
        description: 'Tasks that happen right after contract ratification and before ordering anything.',
        tasks: [
            { id: 't1_1', name: 'Review and understand the sales/purchase contract.', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
            { id: 't1_2', name: 'Review the property survey (if available).', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t1_1'] },
            { id: 't1_3', name: 'Review and prepare seller disclosure documents.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t1_1'] },
            { id: 't1_4', name: 'Submit earnest money deposit to escrow/title company.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t1_1'] }
        ]
    },
    {
        id: 'c2',
        name: '4. Title & Ownership',
        icon: '🔍',
        description: 'Tasks focused on confirming title and ownership.',
        tasks: [
            { id: 't2_1', name: 'Obtain a clear title to the property.', status: 'Pending', comments: '', durationDays: 20, dependsOn: ['t1_4'] },
            { id: 't2_2', name: 'Conduct title search and resolve title issues.', status: 'Pending', comments: '', durationDays: 15, dependsOn: ['t1_4'] }, // Overlaps with t2_1
            { id: 't2_3', name: 'Verify title insurance details.', status: 'Pending', comments: '', durationDays: 2, dependsOn: ['t2_1'] },
            { id: 't2_4', name: 'Verify chain of title (ownership history).', status: 'Pending', comments: '', durationDays: 3, dependsOn: ['t2_2'] },
        ]
    },
    {
        id: 'c3',
        name: '2. Financing & Appraisal',
        icon: '🏦',
        description: 'Tasks required for loan and valuation.',
        tasks: [
            { id: 't3_1', name: 'Coordinate with lender to ensure loan approval and funds disbursement.', status: 'Pending', comments: '', durationDays: 25, dependsOn: ['t1_1'] },
            { id: 't3_2', name: 'Order appraisal.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t3_1'] },
            { id: 't3_3', name: 'Appraisal inspection is completed by appraiser.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t3_2'] },
            { id: 't3_4', name: 'Review appraisal report and approvals.', status: 'Pending', comments: '', durationDays: 2, dependsOn: ['t3_3'] },
            { id: 't3_5', name: "Verify buyer's financial approval and lender docs.", status: 'Pending', comments: '', durationDays: 5, dependsOn: ['t3_4'] },
            { id: 't3_6', name: "Confirm buyer obtains homeowner's insurance.", status: 'Pending', comments: '', durationDays: 5, dependsOn: ['t3_5'] },
            { id: 't3_7', name: 'Buyer submits all final financial documents to lender (pay stubs, bank statements).', status: 'Pending', comments: '', durationDays: 3, dependsOn: ['t3_1'] }
        ]
    },
    {
        id: 'c4',
        name: '3. Inspections & Negotiations',
        icon: '🧪',
        description: 'Tasks that deal with property condition and repairs.',
        tasks: [
            { id: 't4_1', name: 'Schedule and conduct home inspection.', status: 'Pending', comments: '', durationDays: 5, dependsOn: ['t1_1'] },
            { id: 't4_2', name: 'Review inspection report; identify issues.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t4_1'] },
            { id: 't4_3', name: 'Negotiate repair requests / price adjustments.', status: 'Pending', comments: '', durationDays: 3, dependsOn: ['t4_2'] },
            { id: 't4_4', name: 'Ensure agreed repairs are completed.', status: 'Pending', comments: '', durationDays: 5, dependsOn: ['t4_3'] },
        ]
    },
    {
        id: 'c5',
        name: '5. Document Review & Compliance',
        icon: '📜',
        description: 'Tasks where paperwork and legal docs must be checked.',
        tasks: [
            { id: 't5_1', name: 'Prepare and review all closing documents (HUD-1, disclosures, settlement).', status: 'Pending', comments: '', durationDays: 3, dependsOn: ['t2_1', 't3_5'] },
            { id: 't5_2', name: 'Review closing costs and verify accuracy.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t5_1'] },
            { id: 't5_3', name: 'Review and sign all closing documents.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t5_2', 't5_5'] },
            { id: 't5_4', name: 'Review and approve final settlement statement.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t5_2'] },
            { id: 't5_5', name: 'Prepare deed, bill of sale, mortgage note, lien releases, title insurance docs.', status: 'Pending', comments: '', durationDays: 2, dependsOn: ['t2_3'] },
            { id: 't5_6', name: 'Verify HOA fees and property taxes are current.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t2_1'] },
            { id: 't5_7', name: 'Ensure mandatory 3-day review period for Closing Disclosure (CD) is enforced/tracked.', status: 'Pending', comments: '', durationDays: 3, dependsOn: ['t5_1'] }
        ]
    },
    {
        id: 'c6',
        name: '6. Final Coordination & Checks',
        icon: '📆',
        description: 'Tasks that happen shortly before closing date.',
        tasks: [
            { id: 't6_1', name: 'Schedule final walk-through inspection.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t4_4', 't5_7'] },
            { id: 't6_2', name: 'Confirm time and location of closing meeting.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t5_7'] },
            { id: 't6_3', name: 'Arrange funds for closing (wire, certified check).', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t5_4'] },
            { id: 't6_4', name: 'Arrange utilities transfer/disconnection.', status: 'Pending', comments: '', durationDays: 2, dependsOn: ['t6_2'] },
            { id: 't6_5', name: 'Notify post office & relevant parties of address change.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t6_2'] },
        ]
    },
    {
        id: 'c7',
        name: '7. Closing Day',
        icon: '🗝️',
        description: 'Tasks due on closing day itself.',
        tasks: [
            { id: 't7_1', name: 'Attend closing meeting with parties.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t6_1', 't6_2', 't6_3'] },
            { id: 't7_2', name: 'Sign all documents and verify signatures.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t7_1'] },
            { id: 't7_3', name: 'Disburse funds & record deed.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t7_2'] },
            { id: 't7_4', name: 'Obtain keys, garage openers, manuals.', status: 'Pending', comments: '', durationDays: 0, dependsOn: ['t7_3'] },
            { id: 't7_5', name: 'Lender confirms funds disbursement and wire transfer.', status: 'Pending', comments: '', durationDays: 0, dependsOn: ['t7_3'] }
        ]
    },
    {
        id: 'c8',
        name: '8. Post-Closing & Client Handoff',
        icon: '📦',
        description: 'Tasks after the deal is officially closed.',
        tasks: [
            { id: 't8_1', name: 'Provide buyer with warranties, manuals, local service info.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t7_4'] },
            { id: 't8_2', name: 'Update your internal records with new ownership.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t8_1'] },
            { id: 't8_3', name: 'Follow-up with lender, title, and client.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t8_2'] },
            { id: 't8_4', name: 'Referral / thank-you outreach.', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t8_3'] },
        ]
    }
];

// Seller Checklist (New)
const getSellerCategories = (): ChecklistCategory[] => [
    {
        id: 'c1',
        name: 'Phase 1: Opening',
        icon: '🔑',
        description: '0–48 Hours: Formalizing the agreement and initiating the legal clock.',
        tasks: [
            { id: 't1_1', name: 'Deliver Executed Contract', status: 'Pending', comments: '', durationDays: 1, dependsOn: [] },
            { id: 't1_2', name: 'Open Escrow/Title', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t1_1'] },
            { id: 't1_3', name: 'Verify EMD Deposit', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t1_1'] },
            { id: 't1_4', name: 'Update MLS Status', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t1_1'] }
        ]
    },
    {
        id: 'c2',
        name: 'Phase 2: Due Diligence',
        icon: '🔍',
        description: 'Days 3–14: Identifying property condition and supporting valuation.',
        tasks: [
            { id: 't2_1', name: 'Coordinate Inspections', status: 'Pending', comments: '', durationDays: 5, dependsOn: ['t1_2'] },
            { id: 't2_2', name: 'Meet Appraiser', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t1_2'] },
            { id: 't2_3', name: 'Negotiate Repairs', status: 'Pending', comments: '', durationDays: 3, dependsOn: ['t2_1'] }
        ]
    },
    {
        id: 'c3',
        name: 'Phase 3: Contingencies',
        icon: '🛡️',
        description: 'Days 15–21: Closing out buyer exit ramps and securing financing.',
        tasks: [
            { id: 't3_1', name: 'Monitor Loan Commitment', status: 'Pending', comments: '', durationDays: 7, dependsOn: ['t1_1'] },
            { id: 't3_2', name: 'Secure Contingency Removals', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t2_3', 't3_1'] },
            { id: 't3_3', name: 'Verify Repair Completion', status: 'Pending', comments: '', durationDays: 5, dependsOn: ['t2_3'] }
        ]
    },
    {
        id: 'c4',
        name: 'Phase 4: Closing Prep',
        icon: '📝',
        description: 'Days 22–30: Finalizing appointments and condition checks.',
        tasks: [
            { id: 't4_1', name: 'Schedule Closing', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t3_1'] },
            { id: 't4_2', name: 'Conduct Final Walkthrough', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t3_2', 't3_3'] },
            { id: 't4_3', name: 'Manage Utility Transfer', status: 'Pending', comments: '', durationDays: 2, dependsOn: ['t4_1'] }
        ]
    },
    {
        id: 'c5',
        name: 'Phase 5: Possession',
        icon: '🏠',
        description: 'Closing Day: Transfer of ownership and documentation closure.',
        tasks: [
            { id: 't5_1', name: 'Key Exchange', status: 'Pending', comments: '', durationDays: 0, dependsOn: ['t4_2'] },
            { id: 't5_2', name: 'Close Transaction File', status: 'Pending', comments: '', durationDays: 1, dependsOn: ['t5_1'] }
        ]
    }
];

export const getInitialCategories = (type: 'Buyer' | 'Seller' = 'Buyer'): ChecklistCategory[] => {
    return type === 'Seller' ? getSellerCategories() : getBuyerCategories();
};

/**
 * Calculates start and due dates for a task based on its dependencies and duration.
 */
export const calculateTaskDates = (
    task: { dependsOn?: string[], durationDays?: number },
    taskEnds: Record<string, Date>,
    baseDate: Date
) => {
    let startDate = new Date(baseDate);
    if (task.dependsOn && task.dependsOn.length > 0) {
        task.dependsOn.forEach(depId => {
            if (taskEnds[depId] && taskEnds[depId] > startDate) {
                startDate = new Date(taskEnds[depId]);
            }
        });
    }

    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + (task.durationDays || 0));

    return { startDate, dueDate };
};

/**
 * Hydrates a project checklist with calculated dates and mapped IDs.
 */
export const calculateChecklistSchedule = (
    categories: ChecklistCategory[],
    baseDate: Date = new Date(),
    idMapping: Record<string, string> = {}
) => {
    const taskEnds: Record<string, Date> = {};
    const finalCategories: ChecklistCategory[] = [];

    categories.forEach(cat => {
        const updatedTasks = cat.tasks.map(t => {
            const mappedDeps = t.dependsOn?.map(oid => idMapping[oid] || oid) || [];
            const { startDate, dueDate } = calculateTaskDates({ ...t, dependsOn: mappedDeps }, taskEnds, baseDate);

            // Store for future dependencies in this loop
            taskEnds[t.id] = dueDate;
            if (idMapping[t.id]) taskEnds[idMapping[t.id]] = dueDate;

            return {
                ...t,
                id: idMapping[t.id] || t.id,
                startDate,
                dueDate,
                dependsOn: mappedDeps
            };
        });
        finalCategories.push({ ...cat, tasks: updatedTasks });
    });

    return finalCategories;
};
