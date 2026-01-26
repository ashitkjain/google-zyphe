<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/150fadEl9HZng4b8wuYne7a8GlASYVQ--

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Guide Generation

The app includes a library of 90 educational guides. To generate or refresh their content:

1. **Batch Generate Content**:
   `npx tsx scripts/batch_generate_content.ts`
   This uses Gemini to generate high-quality JSON content for all guides and saves it to `guides_content.json`.

2. **Seed to Firestore**:
   `npx tsx seedGuides.ts`
   This uploads the content from `guides_content.json` to your Firestore database.

Note: Hero images are manually curated/generated and stored in `public/guide-images/`.
