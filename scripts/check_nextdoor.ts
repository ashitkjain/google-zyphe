
import fetch from 'node-fetch';

// The 25 Gemini-mined neighborhoods with all their aliases
const neighborhoods = [
    { name: 'Birdland',           aliases: ['Mohr Park', 'Pleasanton Valley North'] },
    { name: 'Pleasanton Meadows', aliases: ['The Meadows', 'Cabana Club'] },
    { name: 'Fairlands',          aliases: ['Fairlands Park'] },
    { name: 'Ponderosa',          aliases: ['Ponderosa Homes', 'Valley Meadows'] },
    { name: 'Vintage Hills',      aliases: ['Vintage Hills I', 'Vintage Hills II'] },
    { name: 'Jensen Tract',       aliases: ['Downtown Pleasanton', 'First Street Area', 'Jensen', 'Downtown'] },
    { name: 'Stoneridge',         aliases: ['Stoneridge Gallery', 'Stoneridge Forest', 'Stoneridge Drive'] },
    { name: 'Val Vista',          aliases: ['Val Vista Park'] },
    { name: 'Highland Oaks',      aliases: ['Westside Pleasanton'] },
    { name: 'Kottinger Ranch',    aliases: ['Kottinger'] },
    { name: 'Moller Ranch',       aliases: ['Westside Hills'] },
    { name: 'Laguna Oaks',        aliases: ['Laguna Oaks HOA'] },
    { name: 'Ironwood',           aliases: ['Ironwood Estates'] },
    { name: 'Whitegate',          aliases: ['Whitegate Ranch'] },
    { name: 'Bridle Creek',       aliases: ['Bridle Creek Estates'] },
    { name: 'Lund Ranch',         aliases: ['Lund Ranch II'] },
    { name: 'The Preserve',       aliases: ['The Preserve at Pleasanton', 'Preserve'] },
    { name: 'Ruby Hill',          aliases: ['The Gates at Ruby Hill'] },
    { name: 'Castlewood',         aliases: ['Castlewood Country Club'] },
    { name: 'Golden Eagle',       aliases: ['Golden Eagle Estates'] },
    { name: 'Muirwood',           aliases: ['Muirwood Park'] },
    { name: 'Heritage Valley',    aliases: ['Heritage'] },
    { name: 'Pleasanton Valley',  aliases: ['The Valley'] },
    { name: 'Shadow Cliffs Area', aliases: ['Willow West', 'Shadow Cliffs'] },
    { name: 'Avignon',            aliases: ['Avignon at Pleasanton'] },
    // Mapbox-only names to test too
    { name: 'Mission Park',       aliases: ['Mission Hills'] },
    { name: 'Del Prado',          aliases: [] },
];

function slugify(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[''']/g, '')           // remove apostrophes
        .replace(/[^a-z0-9\s-]/g, '')   // remove special chars
        .replace(/\s+/g, '-')           // spaces → hyphens
        .replace(/-+/g, '-')            // collapse multiple hyphens
        .replace(/^-|-$/g, '');         // trim leading/trailing hyphens
}

function buildNextdoorUrl(name: string, city = 'pleasanton', state = 'ca'): string {
    const slug = `${slugify(name)}--${slugify(city)}--${slugify(state)}`;
    return `https://nextdoor.com/neighborhood/${slug}/`;
}

async function checkUrl(url: string): Promise<{ status: number; redirected: boolean; finalUrl: string }> {
    try {
        const res = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
            },
        });
        return { status: res.status, redirected: res.redirected, finalUrl: res.url };
    } catch (err: any) {
        return { status: -1, redirected: false, finalUrl: url };
    }
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
    console.log('Checking Nextdoor URLs for all Gemini-mined neighborhoods...');
    console.log('URL pattern: nextdoor.com/neighborhood/{slug}--pleasanton--ca/\n');

    const results: {
        name: string;
        status: 'found' | 'not_found' | 'error';
        matchedOn: string;
        url: string;
        httpStatus: number;
    }[] = [];

    for (const nh of neighborhoods) {
        const allNames = [nh.name, ...nh.aliases];
        let found = false;

        for (const candidate of allNames) {
            const url = buildNextdoorUrl(candidate);
            const { status } = await checkUrl(url);
            await sleep(400); // be polite

            if (status === 200) {
                console.log(`✅  ${nh.name.padEnd(22)} → 200 OK  [matched: "${candidate}"]`);
                console.log(`       ${url}`);
                results.push({ name: nh.name, status: 'found', matchedOn: candidate, url, httpStatus: status });
                found = true;
                break;
            } else if (status !== 404 && status !== -1) {
                // Unexpected status — log it and keep trying aliases
                console.log(`⚠️   ${nh.name}: got ${status} for "${candidate}" — trying next alias...`);
            }
        }

        if (!found) {
            const primaryUrl = buildNextdoorUrl(nh.name);
            console.log(`❌  ${nh.name.padEnd(22)} → NOT FOUND on Nextdoor`);
            console.log(`       ${primaryUrl}`);
            results.push({ name: nh.name, status: 'not_found', matchedOn: '', url: primaryUrl, httpStatus: 404 });
        }
    }

    // ── Summary ──
    const found = results.filter(r => r.status === 'found');
    const notFound = results.filter(r => r.status === 'not_found');

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`\n✅  FOUND on Nextdoor (${found.length}):`);
    found.forEach(r => {
        const alias = r.matchedOn !== r.name ? ` (via alias: "${r.matchedOn}")` : '';
        console.log(`   • ${r.name}${alias}`);
    });

    console.log(`\n❌  NOT FOUND on Nextdoor (${notFound.length}):`);
    notFound.forEach(r => console.log(`   • ${r.name}`));

    console.log('\n' + '-'.repeat(60));
    console.log(`Total checked: ${results.length} | Found: ${found.length} | Missing: ${notFound.length}`);

    process.exit(0);
}

main().catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
});
