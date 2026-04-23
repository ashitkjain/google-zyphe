
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp();
const db = getFirestore();

const groundTruthData = [
  { address: "4416 Comanche Way", orientation: "SOUTH", comment: "it is bit difficult to tell but the front door might face towards South based on photos and satellite imagery" },
  { address: "3074 Boardwalk St", orientation: "NORTHWEST", comment: "it faces northwest" },
  { address: "4350 Columbine Dr", orientation: "EAST_NORTHEAST", comment: "it faces East/Northeast" },
  { address: "7449 Muirwood Ct", orientation: "SOUTH", comment: "The property do face south" },
  { address: "7880 La Quinta Ct", orientation: "UNCLEAR", comment: "the property's Front Orientation displays UNCLEAR" },
  { address: "4093 Alta Ct", orientation: "UNCLEAR", comment: "the property's Front Orientation displays UNCLEAR" },
  { address: "7830 Medinah Ct", orientation: "NORTHWEST", comment: "it faces northwest" },
  { address: "3341 Sorrel Downs Ct", orientation: "NORTH", comment: "it faces North" },
  { address: "8509 Lupine Ct", orientation: "UNCLEAR", comment: "the property's Front Orientation displays UNCLEAR" },
  { address: "3671 Platt Ct S", orientation: "WEST", comment: "it faces west" },
  { address: "3002 Tonopah Cir", orientation: "EAST", comment: "it faces East" },
  { address: "1296 Vintner Way", orientation: "UNCLEAR", comment: "the property's Front Orientation displays UNCLEAR" },
  { address: "4286 Garibaldi Pl", orientation: "NORTHWEST", comment: "it faces northwest based on images" },
  { address: "665 Palomino Dr Unit D", orientation: "UNCLEAR", comment: "difficult to determine the front door orientation" },
  { address: "581 Tawny Dr", orientation: "NORTH", comment: "The property do face North" },
  { address: "775 Bonde Ct", orientation: "NORTH", comment: "The property do face North" },
  { address: "733 Vineyard Ter", orientation: "SOUTHEAST", comment: "it faces Southeast" },
  { address: "2223 Camino Brazos", orientation: "SOUTH", comment: "it faces south" },
  { address: "1647 Harvest Rd", orientation: "UNCLEAR", comment: "less data available for the property (vetted as unclear)" },
  { address: "5550 Black Ave", orientation: "UNCLEAR", comment: "less data available for the property (vetted as unclear)" },
  { address: "150 Trenton Cir", orientation: "NORTH", comment: "it faces North" },
  { address: "4767 Del Valle Pkwy", orientation: "SOUTH", comment: "it faces south" },
  { address: "1164 Tiffany Ln", orientation: "SOUTHEAST", comment: "it faces southeast" },
  { address: "5484 San Jose Dr", orientation: "SOUTH", comment: "it faces south" },
  { address: "4452 Del Valle Pkwy", orientation: "UNCLEAR", comment: "the front door orientation is difficult to determine" },
  { address: "1144 Harvest Rd", orientation: "NORTH", comment: "The property do face north" },
  { address: "2865 Longspur Way", orientation: "NORTH", comment: "The property do face north" },
  { address: "646 Windmill Ln", orientation: "UNCLEAR", comment: "the property's Front Orientation displays UNCLEAR" },
  { address: "2383 Silver Oaks Ln", orientation: "UNCLEAR", comment: "the property's Front Orientation displays UNCLEAR" },
  { address: "2426 Tapestry Way", orientation: "EAST", comment: "The property do face East" }
];

async function run() {
  console.log(`[GroundTruth] Loading Pleasanton Index...`);
  const indexDoc = await db.collection('address_index').doc('pleasanton').get();
  
  if (!indexDoc.exists) {
    console.error("Pleasanton index missing!");
    return;
  }

  const entries = indexDoc.data().entries || [];
  const results = { found: 0, missing: [], errors: 0 };
  const normalize = (s) => s.toLowerCase().replace(/\s+/g, '').replace(/[.,]/g, '').trim();

  for (const item of groundTruthData) {
    try {
      const targetStreet = normalize(item.address);
      const match = entries.find(e => normalize(e.a || '').includes(targetStreet));

      if (!match) {
         results.missing.push(item.address);
         continue;
      }

      const zpidStr = String(match.z);
      
      await db.collection('orientation_ground_truth').doc(zpidStr).set({
        zpid: zpidStr,
        address: item.address,
        db_address: match.a,
        final_orientation: item.orientation,
        vetted_by: 'ashit_manual_full_v7',
        comment: item.comment,
        updatedAt: new Date().toISOString(),
        is_gold_standard: true
      });

      console.log(`✓ SAVED: ${zpidStr} (${item.address}) -> ${item.orientation}`);
      results.found++;
    } catch (e) {
      results.errors++;
    }
  }

  console.log(`\n--- SUMMARY: ${results.found} saved, ${results.missing.length} missing. ---`);
}

run().catch(console.error);
