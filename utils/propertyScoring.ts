export interface PropertyFitScores {
  entertain: number;
  commute: number;
  schools: number;
  walkability: number;
  quiet: number;
  tech: number;
}

export function computePropertyFitScores(
  propertyData: any,
  schoolsIntelligence: any,
  environmentalData: any,
  poiData: any[],
  commuteTimeMins: number = 30 // Default or user preference
): PropertyFitScores {
  
  const cap = (val: number) => Math.max(0, Math.min(100, val));

  // 1. Entertain (0-100)
  // Look at POIs and interior summary
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
  // Based on driving time
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

      schoolsIntelligence.schools.forEach((s: any) => {
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
          schoolsScore = avgRating * 10; // Convert 1-10 to 10-100
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

  // 6. Tech (0-100) (Replaces Future-proof)
  let tech = 20;
  // Solar potential
  if (propertyData?.solarPotential?.maxSunshineHours > 1500) tech += 20;
  if (propertyData?.solarPotential?.maxArrayAreaM2 > 40) tech += 10;
  
  // Description / In-home tech
  const techKeywords = ['solar', 'ev charger', 'tesla', 'smart home', 'nest', 'ecobee', 'wired', 'ethernet'];
  let techCount = 0;
  techKeywords.forEach(kw => {
      if (desc.includes(kw)) techCount++;
  });
  tech += techCount * 10;

  // Community EV Chargers
  if (poiData && Array.isArray(poiData)) {
      const chargers = poiData.filter(p => p.type === 'charging_station').length;
      if (chargers > 0) tech += 15;
  }
  tech = cap(tech);

  return {
      entertain,
      commute,
      schools: schoolsScore,
      walkability: walkability,
      quiet,
      tech
  };
}
