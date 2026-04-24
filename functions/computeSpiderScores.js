const admin = require('firebase-admin');
const fs = require('fs');

try { admin.initializeApp({ projectId: 'zyphe-af0bf' }); } catch (e) {}
const db = admin.firestore();

const cap = (val) => Math.max(0, Math.min(100, Math.round(val)));

function computePropertyFitScores(propertyData, schoolsIntelligence, environmentalData, poiData, commuteTimeMins = 30) {
  // 1. Entertain (0-100)
  let entertain = 20;
  if (poiData && Array.isArray(poiData)) {
      const entertainmentPois = poiData.filter(p => 
          p.type === 'restaurant' || p.type === 'bar' || p.type === 'cafe'
      ).length;
      if (entertainmentPois > 15) entertain += 40;
      else if (entertainmentPois > 5) entertain += 20;
      else if (entertainmentPois > 0) entertain += 10;
  }
  
  if (propertyData?.lotSize > 6000) entertain += 20;
  
  const desc = (propertyData?.description || "").toLowerCase();
  if (desc.includes("open concept") || desc.includes("chef's kitchen") || desc.includes("entertain")) {
      entertain += 20;
  }
  entertain = cap(entertain);

  // 2. Commute (0-100)
  let commute = 50;
  if (commuteTimeMins < 15) commute = 95;
  else if (commuteTimeMins < 30) commute = 80;
  else if (commuteTimeMins < 45) commute = 60;
  else if (commuteTimeMins < 60) commute = 40;
  else commute = 20;
  
  if (poiData && Array.isArray(poiData)) {
      const transitPois = poiData.filter(p => p.type === 'transit_station' || p.type === 'bus_station').length;
      if (transitPois > 0) commute += 10;
  }
  commute = cap(commute);

  // 3. Schools (0-100)
  let schoolsScore = 50;
  if (schoolsIntelligence?.schools?.length > 0) {
      let totalRating = 0;
      let validSchools = 0;
      let hasBonus = false;

      schoolsIntelligence.schools.forEach((s) => {
          if (s.rating) {
              const r = parseInt(s.rating);
              if (!isNaN(r)) {
                  totalRating += r;
                  validSchools++;
              }
          }
          if (s.college_readiness || s.ap_ib_programs) {
              hasBonus = true;
          }
      });

      if (validSchools > 0) {
          const avgRating = totalRating / validSchools;
          schoolsScore = avgRating * 10;
      }
      if (hasBonus) schoolsScore += 10;
  }
  schoolsScore = cap(schoolsScore);

  // 4. Walkability (0-100)
  let walkability = 30; // Default suburban
  if (poiData && Array.isArray(poiData)) {
      const essentials = ['supermarket', 'grocery_or_supermarket', 'cafe', 'pharmacy', 'park'];
      let essentialTypes = new Set();
      poiData.forEach(p => {
          if (essentials.includes(p.type)) essentialTypes.add(p.type);
      });
      
      const count = essentialTypes.size;
      if (count >= 4) walkability = 95;
      else if (count >= 3) walkability = 80;
      else if (count >= 2) walkability = 60;
      else if (count >= 1) walkability = 45;
  }
  walkability = cap(walkability);

  // 5. Quiet (0-100)
  let quiet = 90; // Start quiet
  if (environmentalData) {
      if (environmentalData.highway_proximity && environmentalData.highway_proximity < 1) {
          quiet -= 30;
      }
      if (environmentalData.airport_proximity && environmentalData.airport_proximity < 3) {
          quiet -= 20;
      }
  }
  if (desc.includes("cul-de-sac") || desc.includes("quiet street")) {
      quiet += 10;
  } else if (desc.includes("main street") || desc.includes("busy")) {
      quiet -= 15;
  }
  quiet = cap(quiet);

  // 6. Tech (0-100)
  let tech = 20;
  if (propertyData?.solarPotential?.maxSunshineHours > 1500) tech += 20;
  if (propertyData?.solarPotential?.maxArrayAreaM2 > 40) tech += 10;
  
  const techKeywords = ['solar', 'ev charger', 'tesla', 'smart home', 'nest', 'ecobee', 'wired', 'ethernet'];
  let techCount = 0;
  techKeywords.forEach(kw => {
      if (desc.includes(kw)) techCount++;
  });
  tech += techCount * 10;

  if (poiData && Array.isArray(poiData)) {
      const chargers = poiData.filter(p => p.type === 'charging_station').length;
      if (chargers > 0) tech += 15;
  }
  tech = cap(tech);

  return { entertain, commute, schools: schoolsScore, walkability, quiet, tech };
}

async function run() {
    console.log("Fetching 10 Pleasanton properties...");
    const snap = await db.collection('properties')
        .where('city', '==', 'Pleasanton')
        .limit(10)
        .get();
        
    let results = [];
    
    for (const doc of snap.docs) {
        const prop = doc.data();
        const zpid = doc.id;
        
        // Fetch subcollections for data
        const compSnap = await doc.ref.collection('analysis').doc('comprehensive').get();
        const compData = compSnap.exists ? compSnap.data() : {};
        
        // Let's get POIs (usually in community_pulse or visual_poi)
        let poiData = [];
        // Try to fetch from communityPulse or city level? The UI fetches cityNhEntryOverview, but we might have it on property.
        // For testing, let's just use what's directly on the property or mock an empty array if not found.
        
        const schoolsIntelligence = compData.schoolsIntelligence || {};
        const envData = compData.environmental || {};
        
        const scores = computePropertyFitScores(prop, schoolsIntelligence, envData, poiData, 25);
        
        results.push({
            Address: prop.streetAddress || zpid,
            Entertain: scores.entertain,
            Commute: scores.commute,
            Schools: scores.schools,
            Walkability: scores.walkability,
            Quiet: scores.quiet,
            Tech: scores.tech,
            Total: Object.values(scores).reduce((a,b)=>a+b, 0)
        });
    }
    
    // Output Markdown table
    console.log("\n| Address | Entertain | Commute | Schools | Walkability | Quiet | Tech | Total |");
    console.log("|---------|-----------|---------|---------|-------------|-------|------|-------|");
    results.forEach(r => {
        console.log(`| ${r.Address} | ${r.Entertain} | ${r.Commute} | ${r.Schools} | ${r.Walkability} | ${r.Quiet} | ${r.Tech} | **${r.Total}** |`);
    });
    
    process.exit(0);
}

run();
