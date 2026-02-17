# Reminder Rules - Field Mappings & Missing Schema Fields

## Missing Fields Needed in Lead Schema

Based on the reminder rules, the following fields are MISSING from the current Lead interface:

### Critical Missing Fields:
1. **`tourBookedAt?: Date`** - Timestamp when a tour was booked
2. **`tourCompletedAt?: Date`** - Timestamp when a tour was completed  
3. **`initialCallCompletedAt?: Date`** - Timestamp of first call completion
4. **`nextStepLoggedAt?: Date`** - Last time a next step was logged
5. **`offerDraftedAt?: Date`** - When an offer was drafted
6. **`offerSentAt?: Date`** - When an offer was submitted
7. **`offerAcceptedAt?: Date`** - When an offer was accepted
8. **`escrowOpenedAt?: Date`** - When escrow was opened
9. **`emdConfirmedAt?: Date`** - Earnest money deposit confirmation
10. **`inspectionScheduledAt?: Date`** - Home inspection scheduled
11. **`inspectionCompletedAt?: Date`** - Home inspection completed
12. **`loanContingencyDeadline?: Date`** - Loan contingency deadline date
13. **`appraisalOrderedAt?: Date`** - When appraisal was ordered
14. **`listingAgreementSignedAt?: Date`** - Listing agreement signed date
15. **`photosScheduledAt?: Date`** - Professional photos scheduled
16. **`listingLiveAt?: Date`** - When listing went live
17. **`showingCount?: number`** - Number of showings
18. **`showingFeedback?: Array<{date: Date, feedback: string, rating: number}>`**
19. **`offerReceivedAt?: Date`** - When seller received an offer (for sellers)
20. **`sellerResponseAt?: Date`** - When seller responded to offer
21. **`openHouseCompletedAt?: Date`** - Open house completion
22. **`closingDate?: Date`** - Scheduled closing date
23. **`dealClosedAt?: Date`** - Actual deal closure timestamp
24. **`positiveOutcomeLoggedAt?: Date`** - Positive outcome logging timestamp
25. **`closingAnniversary?: Date`** - Calculated from closingDate
26. **`isHotListing?: boolean`** - Flag for hot listings (multiple offers)
27. **`taggedHotAt?: Date`** - When lead was tagged as "Hot"
28. **`lastContactAt?: Date`** - Last contact timestamp (different from lastTouch)
29. **`viewCount?: number`** - How many times they viewed a specific listing
30. **`lastViewedAt?: Date`** - Last time they viewed the listing

### Existing Fields That Work:
- `receivedAt` ✅
- `lastTouch` ✅
- `lastUpdated` ✅
- `tourRequestDate` ✅
- `offerCount` ✅
- `daysOnZillow` ✅

## Example Executable Rule Mappings

### Rule 001: New Lead - Immediate Follow-up
```javascript
{
  id: "rule-001",
  trigger: "Lead Creation",
  condition: "No response within 5 minutes after",
  
  // Executable mapping:
  triggerField: "leads.receivedAt",
  conditionField: "leads.lastTouch", 
  operator: "not_exists",
  comparisonField: "NOW()",
  value: "5 minutes"
  // Logic: IF (NOW() - leads.receivedAt > 5 minutes) AND leads.lastTouch IS NULL
}
```

### Rule 004: Listing Viewed Multiple Times
```javascript
{
  id: "rule-004",
  trigger: "Listing Viewed 2+ Times",
  condition: "No tour booked in 48 hours after",
  
  // Executable mapping:
  triggerField: "leads.viewCount",
  operator: ">=",
  value: 2,
  conditionField: "leads.tourBookedAt",
  operator: "not_exists",
  comparisonField: "NOW()",
  value: "48 hours from last view"
  // Logic: IF leads.viewCount >= 2 AND leads.tourBookedAt IS NULL AND (NOW() - leads.lastViewedAt > 48 hours)
}
```

### Rule 009: Offer Intent Reminder
```javascript
{
  id: "rule-009",
  trigger: "Buyer Showed Interest",
  condition: "No offer drafted within 48 hours after",
  
  // Executable mapping:
  triggerField: "leads.funnelStage",
  operator: "=",
  value: "Tour",  // Or some interest indicator
  conditionField: "leads.offerDraftedAt",
  operator: "not_exists",
  comparisonField: "NOW()",
  value: "48 hours"
  // Logic: IF leads.funnelStage = 'Tour' AND leads.offerDraftedAt IS NULL AND (NOW() - leads.lastTouch > 48 hours)
}
```

## Recommended Implementation Approach

1. **Phase 1**: Add missing timestamp fields to Lead schema
2. **Phase 2**: Update UI to capture these timestamps automatically:
   - When tour is booked → set `tourBookedAt`
   - When moving to "Offer" stage → set `offerDraftedAt`
   - When offer is accepted → set `offerAcceptedAt`
   - etc.
3. **Phase 3**: Create a Cloud Function that:
   - Runs every 5-15 minutes
   - Queries all active leads
   - Evaluates each enabled rule against each lead
   - Creates CRM tasks when conditions are met
4. **Phase 4**: Add rule evaluation engine with proper operators
