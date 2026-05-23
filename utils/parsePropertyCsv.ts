import { SubjectProperty } from '../services/compService';

function splitCsvLine(line: string): string[] {
    const row: string[] = [];
    let inQuotes = false;
    let current = '';
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === ',' && !inQuotes) { row.push(current.trim()); current = ''; }
        else { current += char; }
    }
    row.push(current.trim());
    return row;
}

function normalizeHomeType(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    const r = raw.toLowerCase();
    if (r.includes('single') || r.includes('sfr') || r.includes('detached')) return 'Single Family';
    if (r.includes('condo') || r.includes('condominium')) return 'Condo';
    if (r.includes('townhouse') || r.includes('townhome')) return 'Townhouse';
    if (r.includes('multi') || r.includes('duplex')) return 'Multi Family';
    return raw;
}

export function parsePropertyCsv(
    text: string,
    currentYear = new Date().getFullYear()
): (SubjectProperty & { mlsId?: string })[] {
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const rawHeaders = splitCsvLine(lines[0]);
    const headers = rawHeaders.map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

    const findIdx = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));

    const streetIdx = findIdx(['streetaddress', 'address', 'street', 'location']);
    const cityIdx   = findIdx(['postalcity', 'city']);
    const mlsIdx    = findIdx(['mls']);
    const priceIdx  = findIdx(['price', 'list']);
    const bedsIdx   = findIdx(['bedstotal', 'bed', 'bd']);
    const bathsIdx  = findIdx(['bths', 'bath', 'bth']);
    const sqftIdx   = findIdx(['sqfttotal', 'sqft', 'livingarea', 'squarefeet', 'sf', 'livingareasf']);
    const lotIdx    = findIdx(['lotsize', 'lot']);
    const ageIdx    = findIdx(['age']);
    const yearIdx   = findIdx(['yearbuilt', 'year', 'built']);
    const typeIdx   = findIdx(['propertysubtype', 'propertytype', 'type']);
    const zestIdx   = findIdx(['zest', 'zestimate']);
    const zipIdx    = findIdx(['zipcode', 'zip', 'postalcode']);

    const getStr = (row: string[], idx: number) => {
        if (idx === -1 || idx >= row.length) return undefined;
        return row[idx].replace(/^"|"$/g, '').trim() || undefined;
    };

    const getNum = (row: string[], idx: number): number | undefined => {
        if (idx === -1 || idx >= row.length) return undefined;
        const raw = row[idx].replace(/^"|"$/g, '').trim();
        const pipeVal = raw.includes('|') ? raw.split('|')[0] : raw;
        const cleaned = pipeVal.replace(/[^0-9.]/g, '');
        const val = parseFloat(cleaned);
        return isNaN(val) ? undefined : val;
    };

    const results: (SubjectProperty & { mlsId?: string })[] = [];

    for (let i = 1; i < lines.length; i++) {
        const row = splitCsvLine(lines[i]);
        if (row.length === 0 || !row[0]) continue;

        const streetAddr = getStr(row, streetIdx) || row[0] || '';
        const city = getStr(row, cityIdx);
        const zip = getStr(row, zipIdx);
        const fullAddress = city ? `${streetAddr}, ${city}, CA` : streetAddr;
        if (!fullAddress.trim() || fullAddress === ', CA') continue;

        let yearBuilt = getNum(row, yearIdx);
        if (!yearBuilt) {
            const age = getNum(row, ageIdx);
            if (age != null && age > 0 && age < 200) yearBuilt = currentYear - age;
        }

        results.push({
            address: fullAddress,
            zipCode: zip,
            mlsId: getStr(row, mlsIdx),
            listPrice: getNum(row, priceIdx),
            bedrooms: getNum(row, bedsIdx),
            bathrooms: getNum(row, bathsIdx),
            squareFootage: getNum(row, sqftIdx),
            lotSize: getNum(row, lotIdx),
            yearBuilt,
            homeType: normalizeHomeType(getStr(row, typeIdx)),
            zestimate: getNum(row, zestIdx),
        });
    }

    return results;
}
