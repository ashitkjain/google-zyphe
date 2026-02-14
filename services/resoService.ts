import { RESOConfig, PropertyData } from '../types';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(config: RESOConfig): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
        return cachedToken.token;
    }

    const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: config.clientId,
            client_secret: config.clientSecret,
            scope: 'api',
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to get RESO access token: ${response.statusText}`);
    }

    const data = await response.json();
    cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000, // Expire 1 minute early
    };

    return data.access_token;
}

export async function fetchResoPropertyData(config: RESOConfig, addressOrId: string, isId: boolean): Promise<PropertyData | null> {
    try {
        const token = await getAccessToken(config);

        // OData query construction
        let filter = "";
        if (isId) {
            filter = `ListingId eq '${addressOrId}'`;
        } else {
            // UnparsedAddress is common in RESO for full address strings
            filter = `UnparsedAddress eq '${addressOrId}'`;
        }

        const url = `${config.odataUrl}/Property?$filter=${encodeURIComponent(filter)}&$top=1&$expand=Media`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.error(`RESO API error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        const raw = data.value?.[0];

        if (!raw) return null;

        // Map RESO fields to PropertyData
        return {
            zpid: raw.ListingId || raw.ListingKey,
            address: raw.UnparsedAddress || `${raw.StreetNumber || ''} ${raw.StreetName || ''}, ${raw.City || ''}, ${raw.StateOrProvince || ''} ${raw.PostalCode || ''}`.trim(),
            city: raw.City,
            state: raw.StateOrProvince,
            zipCode: raw.PostalCode,
            homeStatus: raw.StandardStatus,
            homeType: raw.PropertyType,
            livingAreaValue: raw.LivingArea,
            bedrooms: raw.BedroomsTotal,
            bathrooms: raw.BathroomsFull || raw.BathroomsTotalInteger,
            yearBuilt: raw.YearBuilt,
            description: raw.PublicRemarks,
            price: raw.ListPrice,
            lotSize: raw.LotSizeArea ? `${raw.LotSizeArea} ${raw.LotSizeUnits || ''}` : undefined,
            images: raw.Media?.filter((m: any) => m.MediaCategory === 'Photos' || !m.MediaCategory)
                .map((m: any) => m.MediaURL || m.MediaUrl) || [],
            coordinates: raw.Latitude && raw.Longitude ? {
                latitude: raw.Latitude,
                longitude: raw.Longitude
            } : undefined,
            resoFacts: {
                architecturalStyle: raw.ArchitecturalStyle,
                constructionMaterials: raw.ConstructionMaterials,
                cooling: raw.Cooling,
                heating: raw.Heating,
                flooring: raw.Flooring,
                appliances: raw.Appliances,
                basement: raw.Basement,
                fencing: raw.Fencing,
                fireplaceFeatures: raw.FireplaceFeatures,
                laundryFeatures: raw.LaundryFeatures,
                roofType: raw.Roof,
                zoningDescription: raw.Zoning,
                mlsid: raw.ListingId
            },
            attribution: {
                listingAgentName: raw.ListAgentFullName,
                brokerageName: raw.ListOfficeName,
                mlsName: raw.OriginatingSystemName,
                mlsId: raw.ListingId
            }
        };
    } catch (error) {
        console.error("RESO fetch error:", error);
        return null;
    }
}

export async function searchResoProperties(config: RESOConfig, query: string): Promise<PropertyData[]> {
    try {
        const token = await getAccessToken(config);

        let filter = "";
        if (/^\d{5}(-\d{4})?$/.test(query.trim())) {
            filter = `PostalCode eq '${query.trim()}'`;
        } else {
            filter = `substringof('${query.trim()}', City)`;
        }

        const url = `${config.odataUrl}/Property?$filter=${encodeURIComponent(filter)}&$top=100&$expand=Media`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.error(`RESO API Search error: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const results = data.value || [];

        return results.map((raw: any) => ({
            zpid: raw.ListingId || raw.ListingKey,
            address: raw.UnparsedAddress || `${raw.StreetNumber || ''} ${raw.StreetName || ''}, ${raw.City || ''}, ${raw.StateOrProvince || ''} ${raw.PostalCode || ''}`.trim(),
            city: raw.City,
            state: raw.StateOrProvince,
            zipCode: raw.PostalCode,
            homeStatus: raw.StandardStatus,
            homeType: raw.PropertyType,
            livingAreaValue: raw.LivingArea,
            bedrooms: raw.BedroomsTotal,
            bathrooms: raw.BathroomsFull || raw.BathroomsTotalInteger,
            yearBuilt: raw.YearBuilt,
            description: raw.PublicRemarks,
            price: raw.ListPrice,
            images: raw.Media?.filter((m: any) => m.MediaCategory === 'Photos' || !m.MediaCategory)
                .map((m: any) => m.MediaURL || m.MediaUrl) || [],
            coordinates: raw.Latitude && raw.Longitude ? {
                latitude: raw.Latitude,
                longitude: raw.Longitude
            } : undefined
        }));
    } catch (error) {
        console.error("RESO search error:", error);
        return [];
    }
}
