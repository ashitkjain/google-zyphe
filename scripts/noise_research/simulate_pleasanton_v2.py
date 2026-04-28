import osmnx as ox
import geopandas as gpd
from shapely.geometry import Point, LineString
import json
import numpy as np
import warnings

warnings.filterwarnings("ignore", category=UserWarning)

# 1. Configuration with expanded sources
CITY_NAME = "Pleasanton, California, USA"
NOISE_RADIUS = 1000  # meters (increased to catch airports/trains)
BASE_DB = {
    'motorway': 90,
    'trunk': 84,
    'primary': 78,
    'secondary': 70,
    'tertiary': 62,
    'rail': 85,      # BART / ACE / Freight
    'runway': 95     # Airport takeoff/landing
}

def get_characterization(score):
    if score >= 90: return "Quiet (Serene)"
    if score >= 75: return "Quiet"
    if score >= 60: return "Moderate"
    if score >= 45: return "Loud"
    return "Very Loud"

def calculate_noise():
    with open('pleasanton_properties.json', 'r') as f:
        properties = json.load(f)

    print(f"Downloading Infrastructure for {CITY_NAME}...")
    try:
        # Fetch Roads, Railways, and Aeroways
        roads = ox.features_from_address(CITY_NAME, tags={'highway': True}, dist=4000)
        rail = ox.features_from_address(CITY_NAME, tags={'railway': 'rail'}, dist=4000)
        airport = ox.features_from_address(CITY_NAME, tags={'aeroway': 'runway'}, dist=6000)
        buildings = ox.features_from_address(CITY_NAME, tags={'building': True}, dist=4000)
    except Exception as e:
        print(f"OSM Fetch failed: {e}")
        return
    
    # Project to local UTM
    roads = roads.to_crs(epsg=32610)
    rail = rail.to_crs(epsg=32610) if not rail.empty else rail
    airport = airport.to_crs(epsg=32610) if not airport.empty else airport
    buildings = buildings.to_crs(epsg=32610)

    results = []

    for prop in properties:
        p_geom = gpd.GeoDataFrame([{'geometry': Point(prop['lng'], prop['lat'])}], crs="EPSG:4326").to_crs(epsg=32610).iloc[0].geometry
        
        sources = []
        
        # Check Roads
        valid_roads = roads[roads['highway'].apply(lambda x: (x if isinstance(x, str) else x[0]) in BASE_DB)]
        nearby_roads = valid_roads[valid_roads.distance(p_geom) < 800]
        for _, road in nearby_roads.iterrows():
            type = road['highway'] if isinstance(road['highway'], str) else road['highway'][0]
            name = road.get('name', 'Unnamed Road')
            sources.append({'type': type, 'name': name, 'geom': road.geometry, 'db': BASE_DB[type]})
            
        # Check Rail
        if not rail.empty:
            nearby_rail = rail[rail.distance(p_geom) < 800]
            for _, r in nearby_rail.iterrows():
                sources.append({'type': 'rail', 'name': 'Train Track (BART/ACE)', 'geom': r.geometry, 'db': BASE_DB['rail']})

        # Check Airport
        if not airport.empty:
            nearby_air = airport[airport.distance(p_geom) < 3000]
            for _, a in nearby_air.iterrows():
                sources.append({'type': 'runway', 'name': 'Livermore Airport', 'geom': a.geometry, 'db': BASE_DB['runway']})

        total_energy = 0
        primary_source = "Ambient"
        max_impact = -100

        for s in sources:
            dist = max(p_geom.distance(s['geom']), 10)
            los = LineString([p_geom, s['geom'].interpolate(s['geom'].project(p_geom))])
            barriers = len(buildings[buildings.intersects(los.buffer(1))])
            
            final_db = s['db'] - (20 * np.log10(dist / 10)) - (barriers * 10)
            
            if final_db > max_impact:
                max_impact = final_db
                primary_source = f"{s['type'].title()}: {s['name']}"
            
            total_energy += 10**(final_db / 10)
            
        final_db_total = 10 * np.log10(total_energy) if total_energy > 0 else 30
        score = max(0, min(100, 100 - (final_db_total - 35) * (100 / 45)))
        
        results.append({
            'address': prop['address'],
            'score': round(score, 0),
            'char': get_characterization(score),
            'source': primary_source
        })

    print("\n--- ZYPHE NOISE SOURCE IDENTIFICATION ---")
    print(f"{'Address':<35} | {'Score':<5} | {'Characterization':<15} | {'Primary Source'}")
    print("-" * 100)
    for r in results:
        print(f"{r['address'][:35]:<35} | {str(r['score']):<5} | {r['char']:<15} | {r['source']}")

if __name__ == '__main__':
    calculate_noise()
