
import { runSatellitaryAnalysis } from './services/satellitaryService.ts';
import { loadApiKeys } from './services/apiKeyLoader.ts';

async function test() {
  await loadApiKeys();
  const zpid = "25086332";
  const lat = 37.6460824;
  const lng = -121.8699326;
  const address = "1039 Hopkins Way, Pleasanton, CA 94566";
  
  console.log('--- RUNNING ORIENTATION TEST FOR 1039 HOPKINS WAY ---');
  try {
    const result = await runSatellitaryAnalysis(
      lat,
      lng,
      null,
      'test-system',
      zpid,
      address,
      'Beautiful home in Pleasanton'
    );
    console.log('Result Orientation:', result.final_orientation);
    console.log('Result Azimuth:', result.azimuth_degrees);
    console.log('Result Confidence:', result.confidence);
    console.log('Result Visual Azimuth:', result.visual_azimuth_estimate);
    console.log('Explanation:', result.explanation);
  } catch (e) {
    console.error('Test Failed:', e);
  }
}
test();
