import osmnx as ox
import geopandas as gpd
from shapely.geometry import Point, LineString
import json
import numpy as np
import warnings

warnings.filterwarnings("ignore", category=UserWarning)

# 1. Configuration (Refined for Acoustic Realism)
CITY_NAME = "Pleasanton, California, USA"
NOISE_RADIUS = 1000 
AMBIENT_FLOOR_DB = 42.0  # The quietest it can possibly be in a city

BASE_DB = {
    'motorway': 90,
    'trunk': 84,
    'primary': 78,
    'secondary': 70,
    'tertiary': 62,
    'rail': 85,
    'runway': 95
}

def get_characterization(score):
    if score >= 90: return "Quiet (Serene)"
    if score >= 75: return "Quiet"
    if score >= 60: return "Moderate"
    if score >= 45: return "Loud"
    return "Very Loud"

def calculate_noise():
    try:
        with open('pleasanton_properties.json', 'r') as f:
            properties = json.load(f)
    except Exception:
        print("Error: JSON missing.")
        return

    print(f"Downloading Infrastructure for {CITY_NAME}...")
    try:
        roads = ox.features_from_address(CITY_NAME, tags={'highway': True}, dist=4000)
        rail = ox.features_from_address(CITY_NAME, tags={'railway': 'rail'}, dist=4000)
        airport = ox.features_from_address(CITY_NAME, tags={'aeroway': 'runway'}, dist=6000)
        buildings = ox.features_from_address(CITY_NAME, tags={'building': True}, dist=4000)
    except Exception as e:
        print(f"OSM Fetch failed: {e}")
        return
    
    roads = roads.to_crs(epsg=32610)
    rail = rail.to_crs(epsg=32610) if not rail.empty else rail
    airport = airport.to_crs(epsg=32610) if not airport.empty else airport
    buildings = buildings.to_crs(epsg=32610)

    results = []

    for prop in properties:
        p_geom = gpd.GeoDataFrame([{'geometry': Point(prop['lng'], prop['lat'])}], crs="EPSG:4326").to_crs(epsg=32610).iloc[0].geometry
        
        sources = []
        
        valid_roads = roads[roads['highway'].apply(lambda x: (x if isinstance(x, str) else x[0]) in BASE_DB)]
        nearby_roads = valid_roads[valid_roads.distance(p_geom) < 800]
        for _, road in nearby_roads.iterrows():
            type = road['highway'] if isinstance(road['highway'], str) else road['highway'][0]
            name = road.get('name', 'Unnamed Road')
            sources.append({'type': type, 'name': name, 'geom': road.geometry, 'db': BASE_DB[type]})
            
        if not rail.empty:
            nearby_rail = rail[rail.distance(p_geom) < 800]
            for _, r in nearby_rail.iterrows():
                sources.append({'type': 'rail', 'name': 'Train Track', 'geom': r.geometry, 'db': BASE_DB['rail']})

        if not airport.empty:
            nearby_air = airport[airport.distance(p_geom) < 3000]
            for _, a in nearby_air.iterrows():
                sources.append({'type': 'runway', 'name': 'Livermore Airport', 'geom': a.geometry, 'db': BASE_DB['runway']})

        total_energy = 10**(AMBIENT_FLOOR_DB / 10)  # Start with ambient floor
        primary_source = "Ambient"
        max_impact_db = AMBIENT_FLOOR_DB

        for s in sources:
            dist = max(p_geom.distance(s['geom']), 10)
            los = LineString([p_geom, s['geom'].interpolate(s['geom'].project(p_geom))])
            
            # Efficient barrier check
            intersecting_buildings = buildings[buildings.intersects(los.buffer(0.5))]
            num_barriers = len(intersecting_buildings)
            
            # Realistic Barrier Reduction Math:
            # -8 for first, -3 for second, -1 for third... capped at -20 total
            if num_barriers == 0:
                barrier_reduction = 0
            elif num_barriers == 1:
                barrier_reduction = 8
            elif num_barriers == 2:
                barrier_reduction = 11
            else:
                barrier_reduction = min(20, 11 + (num_barriers - 2) * 1)
            
            # Distance Decay (Inverse Square)
            dist_attenuation = 20 * np.log10(dist / 10)
            
            final_db = s['db'] - dist_attenuation - barrier_reduction
            
            if final_db > max_impact_db:
                max_impact_db = final_db
                primary_source = f"{s['type'].title()}: {s['name']}"
            
            total_energy += 10**(final_db / 10)
            
        final_db_total = 10 * np.log10(total_energy)
        
        # 0-100 Mapping: 
        # 42dB = 100 (Silent)
        # 85dB = 0 (Loud)
        score = max(0, min(100, 100 - (final_db_total - AMBIENT_FLOOR_DB) * (100 / (85 - AMBIENT_FLOOR_DB))))
        
        results.append({
            'address': prop['address'],
            'score': round(score, 0),
            'char': get_characterization(score),
            'source': primary_source,
            'howLoud': prop.get('howLoudScore')
        })

    print("\n--- ZYPHE NOISE RESEARCH: FINAL REFINED MODEL ---")
    print(f"{'Address':<35} | {'HowLoud':<8} | {'Zyphe':<5} | {'Characterization':<15} | {'Primary Source'}")
    print("-" * 115)
    for r in results:
        hl = str(r['howLoud']) if r['howLoud'] else "N/A"
        print(f"{r['address'][:35]:<35} | {hl:<8} | {str(r['score']):<5} | {r['char']:<15} | {r['source']}")

if __name__ == '__main__':
    calculate_noise()
