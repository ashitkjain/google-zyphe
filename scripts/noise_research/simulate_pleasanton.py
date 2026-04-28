import osmnx as ox
import geopandas as gpd
from shapely.geometry import Point, LineString
import json
import numpy as np
import warnings

# Suppress geometry warnings
warnings.filterwarnings("ignore", category=UserWarning)

# 1. Configuration
CITY_NAME = "Pleasanton, California, USA"
NOISE_RADIUS = 600  # meters
BASE_DB = {
    'motorway': 88,
    'trunk': 82,
    'primary': 76,
    'secondary': 68,
    'tertiary': 60
}

def calculate_noise():
    # Load sample properties
    try:
        with open('pleasanton_properties.json', 'r') as f:
            properties = json.load(f)
    except FileNotFoundError:
        print("Error: pleasanton_properties.json not found.")
        return

    print(f"Downloading OSM data for {CITY_NAME} (this may take a minute)...")
    # Get roads and buildings
    try:
        # We fetch within a large bounding box to ensure coverage
        roads = ox.features_from_address(CITY_NAME, tags={'highway': True}, dist=3500)
        buildings = ox.features_from_address(CITY_NAME, tags={'building': True}, dist=3500)
    except Exception as e:
        print(f"Error downloading OSM data: {e}")
        return
    
    # Project to local CRS (UTM Zone 10N for Pleasanton)
    roads = roads.to_crs(epsg=32610)
    buildings = buildings.to_crs(epsg=32610)

    # Filter to only relevant road types to speed up
    valid_roads = roads[roads['highway'].apply(lambda x: (x if isinstance(x, str) else x[0]) in BASE_DB)]

    results = []

    for prop in properties:
        p_point = Point(prop['lng'], prop['lat'])
        # Project point
        p_gdf = gpd.GeoDataFrame([{'geometry': p_point}], crs="EPSG:4326").to_crs(epsg=32610)
        p_geom = p_gdf.iloc[0].geometry
        
        # Find nearby roads
        nearby_roads = valid_roads[valid_roads.distance(p_geom) < NOISE_RADIUS]
        
        total_energy = 0
        
        for idx, road in nearby_roads.iterrows():
            highway_type = road['highway']
            if isinstance(highway_type, list): highway_type = highway_type[0]
            
            # Find closest point on road segment
            dist = p_geom.distance(road.geometry)
            if dist < 5: dist = 5 # Prevent division by zero/near-zero
            
            # Line of sight check (Prop -> Road)
            closest_point_on_road = road.geometry.interpolate(road.geometry.project(p_geom))
            los = LineString([p_geom, closest_point_on_road])
            
            # Check for building intersections (Barriers)
            # We filter buildings to only those near the LOS to speed up
            possible_barriers = buildings[buildings.intersects(los.buffer(1))]
            num_barriers = len(possible_barriers)
            
            # Physics Formula: 
            # L2 = L1 - 20*log10(d2/d1) - Attenuation
            source_db = BASE_DB[highway_type]
            
            # Logarithmic distance decay (reference distance 10m)
            dist_attenuation = 20 * np.log10(max(dist, 10) / 10)
            
            # Barrier attenuation (Building blockages)
            barrier_attenuation = num_barriers * 12
            
            final_db = source_db - dist_attenuation - barrier_attenuation
            
            # Convert dB to linear energy for summation
            total_energy += 10**(final_db / 10)
            
        # Convert back to total dB
        final_score_db = 10 * np.log10(total_energy) if total_energy > 0 else 0
        
        # Mapping dB to a 0-100 "Quietness" score (Zyphe Style)
        # 80dB+ = Loud (Score 0)
        # 40dB- = Silent (Score 100)
        normalized_score = max(0, min(100, 100 - (final_score_db - 40) * (100 / 40)))
        
        results.append({
            'address': prop['address'],
            'howLoud': prop.get('howLoudScore'),
            'zypheSim': round(normalized_score, 0),
            'diff': round(normalized_score - (prop.get('howLoudScore') or 0), 1) if prop.get('howLoudScore') else 'N/A'
        })

    print("\n--- ZYPHE NOISE MODELLING (SIMULATION) ---")
    print(f"{'Address':<40} | {'HowLoud':<8} | {'ZypheSim':<8} | {'Diff':<5}")
    print("-" * 75)
    for r in results:
        h_score = str(r['howLoud']) if r['howLoud'] is not None else 'N/A'
        print(f"{r['address'][:40]:<40} | {h_score:<8} | {str(r['zypheSim']):<8} | {str(r['diff']):<5}")

if __name__ == '__main__':
    calculate_noise()
