/**
 * RealEstateAPI.com property data provider.
 *
 * Endpoints used:
 *   POST /v2/PropertySearch  — active MLS listing search by zip or city+state
 *   POST /v2/PropertyDetail  — full property record by RealEstateAPI id
 *
 * Authentication: x-api-key header
 * Pagination: pass `resultIndex` from previous response as the next page cursor.
 */

import { APP_CONFIG } from '../../config';
import {
    PropertyDataProvider,
    NormalizedListing,
    NormalizedPropertySpec,
    mapRealEstateApiPropertyType,
    mapRealEstateApiMlsStatus,
} from './propertyDataProvider';

const BASE_URL = APP_CONFIG.realEstateApi.baseUrl;
const PAGE_SIZE = 50;

// ── Internal helpers ───────────────────────────────────────────────────────

function apiKey(): string {
    return APP_CONFIG.realEstateApi.key;
}

async function post<T>(endpoint: string, body: Record<string, any>): Promise<T> {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey(),
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`RealEstateAPI ${endpoint} ${res.status}: ${text}`);
    }
    return res.json();
}

// ── Address helpers ────────────────────────────────────────────────────────

function normalizeAddress(raw: any): {
    line: string; city: string; state: string; zip: string; full: string;
} {
    if (!raw) return { line: '', city: '', state: '', zip: '', full: '' };
    // PropertySearch returns a plain string in `address`; PropertyDetail nests inside propertyInfo.address
    if (typeof raw === 'string') {
        const parts = raw.split(',').map(s => s.trim());
        return {
            line:  parts[0] || '',
            city:  parts[1] || '',
            state: (parts[2] || '').split(' ')[0] || '',
            zip:   (parts[2] || '').split(' ')[1] || '',
            full:  raw,
        };
    }
    // Object form: { address, city, state, zip, label? }
    const line  = raw.address || raw.street || '';
    const city  = raw.city || '';
    const state = raw.state || '';
    const zip   = raw.zip || raw.zipCode || '';
    const full  = raw.label || raw.address || `${line}, ${city}, ${state} ${zip}`.replace(/,\s*,/g, ',').trim();
    return { line, city, state, zip, full };
}

// ── Mapper: search result → NormalizedListing ─────────────────────────────

function mapSearchResult(p: any, fallbackCity?: string, fallbackState?: string): NormalizedListing {
    const addr = normalizeAddress(p.address);
    const homeType = mapRealEstateApiPropertyType(p.propertyType);

    return {
        zpid:        String(p.id ?? p.propertyId),
        property_id: String(p.id ?? p.propertyId),
        source:      'realestateapi',
        homeType,
        location: {
            address: {
                line:       addr.line || addr.full,
                city:       addr.city  || fallbackCity   || '',
                state_code: addr.state || fallbackState  || '',
                postal_code: addr.zip  || '',
            },
        },
        list_price:    p.mlsListingPrice ?? p.listingAmount ?? 0,
        primary_photo: null, // RealEstateAPI does not return photo URLs at search time
        bedrooms:      p.bedrooms ?? null,
        bathrooms:     p.bathrooms ?? null,
        livingArea:    p.squareFeet ?? null,
        daysOnMarket:  p.mlsDaysOnMarket ?? null,
        listedDate:    p.mlsListingDate ?? null,
        coordinates:   (p.latitude && p.longitude)
            ? { latitude: p.latitude, longitude: p.longitude }
            : undefined,
        // pass-through fields CityDataTab may read
        mlsActive:    p.mlsActive,
        mlsStatus:    p.mlsStatus,
        yearBuilt:    p.yearBuilt ?? null,
        stories:      p.stories   ?? null,
        garage:       p.garage    ?? false,
        pool:         p.pool      ?? false,
        hoa:          p.hoa       ?? null,
    };
}

// ── Mapper: detail result → NormalizedPropertySpec ────────────────────────

function mapDetailResult(data: any): NormalizedPropertySpec {
    const pi    = data.propertyInfo || {};
    const addr  = normalizeAddress(pi.address ?? data.address);
    const id    = String(data.id ?? data.propertyId ?? '');
    const homeType = mapRealEstateApiPropertyType(data.propertyType ?? pi.propertyType);
    const mlsH  = Array.isArray(data.mlsHistory) && data.mlsHistory.length > 0 ? data.mlsHistory[0] : null;
    const price = mlsH?.price ?? data.mlsListingPrice ?? data.listingAmount ?? data.estimatedValue ?? null;

    const coords = (pi.latitude && pi.longitude)
        ? { latitude: pi.latitude, longitude: pi.longitude }
        : undefined;

    const mapUrl = coords
        ? `https://maps.googleapis.com/maps/api/staticmap?center=${coords.latitude},${coords.longitude}&zoom=17&size=600x400&maptype=satellite&key=`
        : undefined;

    return {
        zpid:          id,
        source:        'realestateapi',
        address:       addr.full || `${addr.line}, ${addr.city}, ${addr.state} ${addr.zip}`.replace(/,\s*,/g, ',').trim(),
        streetAddress: addr.line,
        city:          addr.city,
        state:         addr.state,
        zipCode:       addr.zip,
        price:         typeof price === 'string' ? parseFloat(price) || undefined : price ?? undefined,
        bedrooms:      pi.bedrooms ?? null,
        bathrooms:     pi.bathrooms ?? null,
        livingAreaValue: pi.livingSquareFeet ?? pi.buildingSquareFeet ?? null,
        lotSize:       pi.lotSquareFeet ? `${pi.lotSquareFeet} sqft` : undefined,
        homeType:      homeType ?? undefined,
        homeStatus:    mapRealEstateApiMlsStatus(mlsH?.status ?? data.mlsStatus),
        coordinates:   coords,
        mapZoomIn:     mapUrl,
        mapZoomOut:    mapUrl,
        yearBuilt:     pi.yearBuilt ?? null,
        stories:       pi.stories   ?? null,
        garageSpaces:  pi.parkingSpaces ?? (pi.garageType && pi.garageType !== 'None' ? 1 : null),
        pool:          pi.pool       ?? false,
        monthlyHoaFee: pi.hoa        ? undefined : undefined, // bool only — no dollar amount
        timeOnZillow:  mlsH?.daysOnMarket ?? null,
        listedDate:    mlsH?.statusDate   ?? null,
        images:        [],
        resoFacts: {
            hasPool:       pi.pool       ?? false,
            hasGarage:     !!(pi.parkingSpaces || pi.garageType),
            stories:       pi.stories    ?? null,
            yearBuilt:     pi.yearBuilt  ?? null,
            lotSize:       pi.lotSquareFeet ? `${pi.lotSquareFeet} sqft` : null,
        },
        // Extra fields that may be useful downstream
        taxInfo:       data.taxInfo   ?? null,
        schoolInfo:    data.schools   ?? null,
        lotInfo:       data.lotInfo   ?? null,
    };
}

// ── Provider implementation ───────────────────────────────────────────────

export const realEstateApiProvider: PropertyDataProvider = {
    name: 'realestateapi',

    async searchByZip(zip, fallbackCity, fallbackState): Promise<NormalizedListing[]> {
        const results: NormalizedListing[] = [];
        let resultIndex = 0;

        do {
            const body: Record<string, any> = {
                zip,
                mls_active: true,
                size: PAGE_SIZE,
            };
            if (resultIndex > 0) body.resultIndex = resultIndex;

            const data: any = await post('/PropertySearch', body);
            const page: any[] = data.data ?? [];

            for (const p of page) {
                results.push(mapSearchResult(p, fallbackCity, fallbackState));
            }

            const total: number = data.resultCount ?? 0;
            resultIndex = data.resultIndex ?? results.length;

            if (resultIndex >= total || page.length === 0) break;
        } while (true);

        return results;
    },

    async getPropertyDetail(id): Promise<NormalizedPropertySpec | null> {
        try {
            const data: any = await post('/PropertyDetail', { id });
            const property = data.data;
            if (!property) return null;
            return mapDetailResult(property);
        } catch (e: any) {
            console.warn(`[RealEstateAPI] getPropertyDetail(${id}) failed:`, e.message);
            return null;
        }
    },
};
