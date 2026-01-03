
import { PropertyData } from "../types";

// Note: In a production environment, these would be handled via a secure backend or proxy
// to protect API keys. For this demonstration, we focus on the logic structure.
const RADAR_API_KEY = "prj_live_sk_..."; // Placeholder
const RAPID_API_KEY = "YOUR_RAPID_API_KEY"; // Placeholder
const RAPID_API_HOST = "us-housing-market-data1.p.rapidapi.com";

export const normalizeAddress = async (address: string): Promise<string> => {
  try {
    // In a real scenario, you'd fetch from Radar
    // const response = await fetch(`https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(address)}`, {
    //   headers: { 'Authorization': RADAR_API_KEY }
    // });
    // const data = await response.json();
    // return data.addresses?.[0]?.formattedAddress || address;
    
    // Simulate API delay and return the input for now since we don't have keys
    await new Promise(r => setTimeout(r, 500));
    return address;
  } catch (e) {
    console.error("Radar normalization failed", e);
    return address;
  }
};

export const fetchPropertyData = async (address: string): Promise<PropertyData> => {
  // Simulate the US Housing Data API response based on the logic provided in the prompt
  // In reality, this would be a fetch call to US-housing-market-data1.p.rapidapi.com
  
  await new Promise(r => setTimeout(r, 1500));

  // Mock data matching the structure from the prompt's Deno function
  return {
    address: address,
    zpid: "25064531",
    homeStatus: "FOR_SALE",
    homeType: "SINGLE_FAMILY",
    livingAreaValue: 1796,
    bedrooms: 4,
    bathrooms: 2,
    yearBuilt: 1981,
    lotSize: "6,969 sqft",
    price: 1625000,
    zestimate: 1589600,
    rentZestimate: 4219,
    annualHomeownersInsurance: 6825,
    windRiskScore: 1,
    floodRiskScore: 1,
    fireRiskScore: 7,
    heatRiskScore: 4,
    description: "Gorgeous light, bright, move in condition, very well cared for home. Turn key. Freshly painted. Remodeled gourmet kitchen: deluxe features includes: Quartz counters. New cabinets, self closing drawers, lazy susan, pull out spice drawer, pull out pots/pans drawers. Upgraded knobs and handles. Stainless steel appliances, gas stove/oven (four burner-plus additional griddle in center) built-in microwave, dishwasher, deep sink. Formal LR w/bay window and DR. Family room with fireplace. Dual level halo lighting. Recessed lighting. New LVP faux wood flooring. Upgraded bathrooms with new quartz counters, mirrors, lights. Six panel doors-new knobs/hinges. Nest Thermostat. Ring doorbell. Inside laundry. Central heating and air conditioning. Whole house fan. Dual pane windows. Shelves, storage area, sink in garage. Stamped concrete driveway. Certainteed Roof (2023). Newly landscaped backyard with brick island, good size grass area, cement pad for spa or BBQ area. Second cement pad on side yard for a shed. Washer/Dryer included. Refrigerator in garage included. Covered patio. Covered side yard. Wonderful Pleasant Meadows neighborhood with sidewalks. Superior school district. Rare find, one story. Move in condition!",
    schools: [
      { name: "Fairlands Elementary School", level: "Elementary", rating: "8/10", distance: "0.8mi" },
      { name: "Harvest Park Preschool Center", level: "Elementary", rating: "N/A/10", distance: "2mi" },
      { name: "Thomas S. Hart Middle School", level: "Middle", rating: "8/10", distance: "2.1mi" }
    ],
    resoFacts: {
      flooring: "Vinyl",
      foundationDetails: "Slab",
      rooms: "Kitchen: Counter - Solid Surface, Eat-in Kitchen, Gas Range/Cooktop, Microwave, Updated Kitchen",
      feesAndDues: "N/A",
      exteriorFeatures: "Stucco",
      architecturalStyle: "Traditional",
      garageParkingCapacity: 2,
      lotFeatures: "Back Yard, Front Yard",
      roofType: "Composition",
      daysOnZillow: 26,
      constructionMaterials: "Stucco",
      fireplaceFeatures: "Family Room",
      appliances: "Gas Range, Microwave",
      fencing: "Fenced",
      cooling: "Central Air",
      laundryFeatures: "Inside",
      heating: "Central"
    }
  };
};
