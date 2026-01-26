export const getGuideImagePrompt = (category: string, title: string) => {
    return `
Create a beautiful, professional illustration for an educational guide about California homeownership.

GUIDE DETAILS:
Category: ${category}
Title: ${title}

IMAGE REQUIREMENTS:
- Style: Clean, modern vector illustration with a friendly, professional aesthetic
- Setting: California residential neighborhood scene with palm trees, suburban houses, and blue sky
- Color Palette: Warm, inviting colors (blues, oranges, greens, soft pastels)
- Include: Relevant visual elements based on the topic (e.g., documents, gavel, keys, house, tax forms, insurance papers, etc.)
- Layout: Horizontal composition suitable for a header/hero image
- Include text overlay area in the upper center for the guide title
- Aspect ratio: Wide landscape (approximately 16:9 or similar)
- Avoid: Photos of real people, text within the image itself, cluttered designs

VISUAL ELEMENTS BY CATEGORY:
- HOA: Documents, gavel, clipboard, neighborhood homes, community symbols
- Insurance: Policy documents, umbrella, shield, protection symbols, house
- Escrow: Keys, house keys on documents, contract papers, closing documents
- Property Taxes: Tax forms, calculator, calendar, house with assessment symbols
- Repairs & Liability: Tools, house repair imagery, safety symbols, maintenance items

MOOD:
- Informative yet approachable
- Professional but not intimidating
- California-specific with recognizable elements (palm trees, Spanish-style architecture)
- Clean and uncluttered design that conveys trust and expertise

OUTPUT:
Generate a single high-quality illustration that will serve as the hero image for this educational guide.
`;
};
