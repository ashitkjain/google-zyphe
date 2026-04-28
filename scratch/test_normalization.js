
function normalizeAddressString(address) {
    if (!address) return '';
    return address
        .replace(/, US$/i, '')           // Remove Radar's ", US"
        .replace(/\sUS$/i, '')           // Remove Radar's " US"
        .replace(/,?\s?([A-Z]{2}),?\s?(\d{5})/, ', $1 $2') // Ensure "State Zip" format
        .replace(/,\s*,/g, ',')          // Fix double commas
        .replace(/\s+/g, ' ')            // Collapse whitespace
        .trim();
}

function getVariants(address) {
    const normalized = normalizeAddressString(address);
    const variants = [
        address,
        normalized,
        normalized.replace(/,?\s?([A-Z]{2})\s(\d{5})/, ', $1, $2')
    ];
    return Array.from(new Set(variants.filter(Boolean)));
}

// TEST CASES
const testCases = [
    {
        name: "Radar Format (Lexington)",
        input: "1600 Lexington Ln, Pleasanton, CA 94566 US",
        expectedStored: "1600 Lexington Ln, Pleasanton, CA, 94566"
    },
    {
        name: "Standard Format (No US)",
        input: "1600 Lexington Ln, Pleasanton, CA 94566",
        expectedStored: "1600 Lexington Ln, Pleasanton, CA, 94566"
    }
];

testCases.forEach(tc => {
    console.log(`--- Test: ${tc.name} ---`);
    console.log(`Input: "${tc.input}"`);
    const normalized = normalizeAddressString(tc.input);
    console.log(`Normalized: "${normalized}"`);
    const variants = getVariants(tc.input);
    console.log(`Variants:`, variants);
    const hit = variants.includes(tc.expectedStored);
    console.log(`HIT expected: ${hit ? '✅' : '❌'}`);
    console.log('');
});
