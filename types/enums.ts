export type LeadSource = 'Zillow' | 'Realtor.com' | 'Facebook' | 'Website' | 'Manual' | 'Referral' | 'Instagram' | 'Google' | 'Direct';
export type LeadStatus = string; // Changed from union to string to support custom statuses

export type FunnelStage =
    | 'Leads'         // Initial inquiry/Lead
    | 'Nurture'       // Long-term follow-up
    | 'Active Search' // Currently viewing homes
    | 'Offer'         // Offer submitted
    | 'Contract'      // Under contract
    | 'Closed'        // Deal finalized
    | 'Archived';      // Hidden/Archived leads

export type LeadHealth = 'Active' | 'Stale' | 'Dormant' | 'Responsive';

export type LeadType = 'Buyer' | 'Seller' | 'Rental' | 'Mortgage';
export type ConnectionType = 'Direct Lead' | 'Live Connection' | 'Nurture';

export type CommChannel = 'SMS' | 'Email' | 'Call';
