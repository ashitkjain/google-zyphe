
import https from 'https';

const API_KEY = "AIzaSyDvf074vL_VYXXD-y_3Gl3KYsKqPLOhqvk"; // Using the key from apiService.ts

// Helper function to make HTTPS requests
const fetchJson = (url, method = 'GET', body = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
};

const checkCoverage = async (lat, lng, label) => {
    console.log(`\n--- Testing Location: ${label} (${lat}, ${lng}) ---`);

    // 1. Check Solar API
    const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${API_KEY}`;
    try {
        const solarRes = await fetchJson(solarUrl);
        if (solarRes.status === 200) {
            console.log(`✅ Solar API: Available (Max Sunshine: ${solarRes.data.solarPotential.maxSunshineHoursPerYear} hrs/yr)`);
        } else if (solarRes.status === 404) {
            console.log(`❌ Solar API: Not Available (404 - Not Found)`);
        } else {
            console.log(`⚠️ Solar API: Error (Status ${solarRes.status}) - ${JSON.stringify(solarRes.data.error?.message || solarRes.data)}`);
        }
    } catch (e) {
        console.log(`❌ Solar API: Failed to connect (${e.message})`);
    }

    // 2. Check Air Quality API
    const aqUrl = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${API_KEY}`;
    try {
        const aqRes = await fetchJson(aqUrl, 'POST', {
            location: { latitude: lat, longitude: lng },
            extraComputations: ["HEALTH_RECOMMENDATIONS", "DOMINANT_POLLUTANT_CONCENTRATION"]
        });

        if (aqRes.status === 200) {
            const aqi = aqRes.data.indexes?.[0];
            console.log(`✅ Air Quality API: Available (AQI: ${aqi?.aqi}, Category: ${aqi?.category})`);
        } else {
            console.log(`⚠️ Air Quality API: Error (Status ${aqRes.status}) - ${JSON.stringify(aqRes.data.error?.message || aqRes.data)}`);
        }
    } catch (e) {
        console.log(`❌ Air Quality API: Failed to connect (${e.message})`);
    }
};

// Run tests
const run = async () => {
    // Test 1: Mountain View (High likelihood of coverage)
    await checkCoverage(37.4221, -122.0841, "Google HQ (Mountain View, CA)");

    // Test 2: A likely unsupported area (e.g., middle of the ocean or remote rural)
    // 0,0 is typically 'null island' but let's try a remote coordinate
    await checkCoverage(34.0522, -118.2437, "Los Angeles, CA");

    // Test 3: User can add more here
    if (process.argv[2] && process.argv[3]) {
        const lat = parseFloat(process.argv[2]);
        const lng = parseFloat(process.argv[3]);
        if (!isNaN(lat) && !isNaN(lng)) {
            await checkCoverage(lat, lng, "Custom Input");
        } else {
            console.log("\nUsage: node check_coverage.js [lat] [lng]");
        }
    }
};

run();
