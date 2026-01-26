import { GUIDE_DATA } from './guides_data.ts';

function generateKeywordsForGuide(title: string, slug: string) {
    const cleanTitle = title.replace(/[?]/g, '');
    const slugKeywords = slug.replace(/-/g, ' ');

    return [
        `[${title}]`,
        `"${title}"`,
        `[${cleanTitle}]`,
        `"${cleanTitle}"`,
        `[${slugKeywords}]`,
        `"${slugKeywords}"`,
        `[${slugKeywords} California]`,
        `"${slugKeywords} California"`
    ];
}

console.log('Ad Group,Keyword,Criterion Type');

GUIDE_DATA.forEach(category => {
    category.items.forEach(item => {
        const adGroupName = item.title;
        const keywords = generateKeywordsForGuide(item.title, item.slug);

        keywords.forEach(kw => {
            let type = 'Broad'; // Default
            let actualKw = kw;

            if (kw.startsWith('[') && kw.endsWith(']')) {
                type = 'Exact';
                actualKw = kw.substring(1, kw.length - 1);
            } else if (kw.startsWith('"') && kw.endsWith('"')) {
                type = 'Phrase';
                actualKw = kw.substring(1, kw.length - 1);
            }

            // Format for CSV (handle commas in titles)
            console.log(`"${adGroupName}","${actualKw}",${type}`);
        });
    });
});
