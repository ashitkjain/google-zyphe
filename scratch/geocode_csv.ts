import admin from 'firebase-admin';
import * as fs from 'fs';

// Initialize firebase-admin
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: 'zyphe-af0bf' });
}

const firestore = admin.firestore();

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result.map(c => c.trim());
}

function formatCSVLine(cells: string[]): string {
    return cells.map(cell => {
        if (cell.includes('"') || cell.includes(',') || cell.includes('\n') || cell.includes('\r')) {
            return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
    }).join(',');
}

async function main() {
    console.log('Fetching Radar API Key via firebase-admin...');
    const snap = await firestore.doc('app_config/api_keys').get();
    if (!snap.exists) {
        throw new Error('app_config/api_keys not found in Firestore');
    }
    const data = snap.data();
    const radarKey = data?.radar_key;
    if (!radarKey) {
        throw new Error('Radar key not found in app_config/api_keys');
    }
    console.log('Successfully retrieved Radar API key.');

    const csvPath = '/Users/ashitjain/Downloads/340houses.csv';
    if (!fs.existsSync(csvPath)) {
        throw new Error(`CSV file not found at: ${csvPath}`);
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
        throw new Error('CSV is empty');
    }

    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine);
    console.log('Headers:', headers);

    // Find indices
    const streetAddressIdx = headers.indexOf('Street Address');
    const postalCityIdx = headers.indexOf('Postal City');
    
    if (streetAddressIdx === -1 || postalCityIdx === -1) {
        throw new Error(`Could not find required columns ("Street Address" or "Postal City"). Found headers: ${headers.join(', ')}`);
    }

    // Find or add "Zip Code" column
    let zipCodeIdx = headers.indexOf('Zip Code');
    if (zipCodeIdx === -1) {
        headers.push('Zip Code');
        zipCodeIdx = headers.length - 1;
        console.log('Added "Zip Code" column to header.');
    } else {
        console.log('"Zip Code" column already exists at index', zipCodeIdx);
    }

    const rowsToProcess = lines.slice(1);
    const parsedRows = rowsToProcess.map(parseCSVLine);
    
    // Count how many are already resolved
    let alreadyResolved = 0;
    parsedRows.forEach(cells => {
        const val = cells[zipCodeIdx];
        if (val && val !== 'ERROR' && val.match(/^\d{5}$/)) {
            alreadyResolved++;
        }
    });
    console.log(`Current state: ${alreadyResolved} / ${parsedRows.length} rows already successfully resolved.`);

    // Helper to geocode a single address with Radar and exponential backoff for 429
    async function getZipCodeWithRetry(address: string, city: string, rowLabel: string): Promise<string> {
        const query = `${address}, ${city}, CA`;
        const url = `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(query)}`;
        
        let attempt = 1;
        const maxAttempts = 5;
        let delay = 1000; // start with 1s delay on failure

        while (attempt <= maxAttempts) {
            try {
                const res = await fetch(url, {
                    headers: { 'Authorization': radarKey }
                });

                if (res.status === 429) {
                    console.warn(`[${rowLabel}] Radar API 429 (Rate Limit) on attempt ${attempt}/${maxAttempts}. Backing off for ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                    attempt++;
                    delay *= 2; // double delay time
                    continue;
                }

                if (!res.ok) {
                    throw new Error(`Status ${res.status}`);
                }

                const resData = await res.json();
                const results = resData.addresses || [];
                if (results.length === 0) {
                    throw new Error('No geocode results found');
                }
                return results[0].postalCode || '';
            } catch (err: any) {
                if (attempt === maxAttempts) {
                    throw err;
                }
                console.warn(`[${rowLabel}] Network/HTTP error on attempt ${attempt}/${maxAttempts}: ${err.message}. Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                attempt++;
                delay *= 2;
            }
        }
        throw new Error('Max attempts exceeded');
    }

    let successCount = 0;
    let failCount = 0;

    // Process rows sequentially to strictly obey rate limits and print clean output
    for (let idx = 0; idx < parsedRows.length; idx++) {
        const cells = parsedRows[idx];
        const address = cells[streetAddressIdx];
        const city = cells[postalCityIdx];

        if (!address || !city) {
            continue;
        }

        // Check if already resolved
        const currentZip = cells[zipCodeIdx];
        if (currentZip && currentZip !== 'ERROR' && currentZip.match(/^\d{5}$/)) {
            continue;
        }

        const label = `Row ${idx + 1}/${parsedRows.length}`;
        try {
            // Introduce a short artificial delay between requests to prevent hitting the rate limit
            await new Promise(resolve => setTimeout(resolve, 200));

            const zip = await getZipCodeWithRetry(address, city, label);
            
            // Add the zip code to the cells array at the correct index
            if (zipCodeIdx < cells.length) {
                cells[zipCodeIdx] = zip;
            } else {
                while (cells.length < zipCodeIdx) cells.push('');
                cells[zipCodeIdx] = zip;
            }
            successCount++;
            console.log(`[${label}] Resolved "${address}, ${city}" -> ${zip}`);

            // Periodically auto-save to disk after every 10 successes so we don't lose progress if interrupted!
            if (successCount % 10 === 0) {
                const tempRows = [headers, ...parsedRows];
                const tempContent = tempRows.map(formatCSVLine).join('\n');
                fs.writeFileSync(csvPath, tempContent, 'utf8');
                console.log(`  Saved progress to disk (${alreadyResolved + successCount}/${parsedRows.length} total resolved)`);
            }

        } catch (err: any) {
            failCount++;
            console.error(`[${label}] Failed to resolve "${address}, ${city}": ${err.message}`);
            if (zipCodeIdx < cells.length) {
                cells[zipCodeIdx] = 'ERROR';
            } else {
                while (cells.length < zipCodeIdx) cells.push('');
                cells[zipCodeIdx] = 'ERROR';
            }
        }
    }

    // Final save
    const finalRows = [headers, ...parsedRows];
    const finalContent = finalRows.map(formatCSVLine).join('\n');
    fs.writeFileSync(csvPath, finalContent, 'utf8');

    console.log('\n==================================================');
    console.log(`✔ Finished processing!`);
    console.log(`Saved output back to: ${csvPath}`);
    console.log(`Previously resolved: ${alreadyResolved}`);
    console.log(`Newly resolved this run: ${successCount}`);
    console.log(`Failed rows this run: ${failCount}`);
    console.log(`Total successfully resolved in file: ${alreadyResolved + successCount} / ${parsedRows.length}`);
    console.log('==================================================');
}

main().catch(console.error);
