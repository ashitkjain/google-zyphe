export const validateEIN = (ein: string): boolean => {
    const re = /^\d{2}-\d{7}$/;
    return re.test(ein);
};

export const validateWebsite = (url: string): boolean => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

export interface SmsRegistrationData {
    legalName: string;
    ein: string;
    website: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    useCase: string;
    description: string;
    sample1: string;
    sample2: string;
}

export const validateBrandDetails = (data: Partial<SmsRegistrationData>): { isValid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};

    if (!data.legalName?.trim()) errors.legalName = "Legal Name is required";
    if (!data.ein || !validateEIN(data.ein)) errors.ein = "Invalid EIN format (XX-XXXXXXX)";
    if (!data.website || !validateWebsite(data.website)) errors.website = "Invalid website URL";
    if (!data.address?.trim()) errors.address = "Address is required";

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

export const validateCampaignDetails = (data: Partial<SmsRegistrationData>): { isValid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};

    if (!data.description || data.description.length < 20) errors.description = "Description must be at least 20 characters";
    if (!data.sample1?.trim()) errors.sample1 = "Sample message 1 is required";
    if (!data.sample2?.trim()) errors.sample2 = "Sample message 2 is required";

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};
