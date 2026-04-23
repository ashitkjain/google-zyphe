# Zyphe Property Orientation Analysis System

## Overview
The Zyphe Property Orientation system is a multi-modal, "2-Pass" computer vision engine designed to determine a property's compass orientation (front door facing) with GPS precision. It combines Gemini 2.0 Flash with Google Maps Geospatial APIs to resolve complex suburban layouts like cul-de-sacs and corner lots that traditional mapping tools often misidentify.

---

## 1. Data Input Strategy
The system operates on three primary visual sources:
*   **Image A (Satellite Aerial)**: Static Satellite API at Zoom 20 (North-up). Provides the authoritative building footprint and site layout.
*   **Image B (Street View)**: Nearest outdoor panorama. The system uses a **Street Verification** algorithm to ensure the camera is on the correct address street before triggering.
*   **Image C (Road Map)**: Static Roadmap API at Zoom 16. Used as a "textual anchor" to let Gemini read road names and identify street geometry (bearings).

---

## 2. Pass 1: Geospatial & Geometric Analysis
The first pass attempts to solve orientation using pure map data and GPS heading math.

### **The GPS Bearing Hint**
The system geocodes two points 50m and 100m down the street to calculate the **Mathematical Road Bearing**.
*   **Straight Roads**: Gemini is given a "perpendicular hint" (e.g., "Road is 90°, so house must face 0° or 180°").
*   **Curve Detection**: If geocoded bearings differ by >25°, the road is flagged as "Curved," and the GPS hint is suppressed to avoid forcing a straight-line error.

### **Heading Math (`computeAccurateAzimuth`)**
If Gemini confirms it sees a **pedestrian front door** in the Street View image, the system uses the camera's GPS heading to compute the exact azimuth:
*   `Final Azimuth = (Camera Heading + 180°) % 360`
*   **Snapping**: To ensure clean data, the result is snapped to the nearest mathematical perpendicular of the road.

---

## 3. The Two-Pass Algorithmic Workflow
The system uses a sequential "Triage" approach where the second pass is only invoked if the first pass cannot determine a conclusive answer.

### **Pass 1: Geospatial Triage (Primary)**
*   **Images**: Aerial Satellite (Image A) + Street View (Image B).
*   **Goal**: Solve orientation using GPS-accurate data.
*   **Outcome**: If the AI definitively sees the front door in the Street View image, it uses the GPS camera heading to set a high-confidence orientation. The process stops here.

### **Pass 2: Visual Evidence Re-Analysis (Fallback)**
*   **The Trigger**: Pass 2 is triggered only if Pass 1 returns `UNCLEAR` **AND** the property is a Single Family/Townhouse. Specific triggers include:
    *   **Privacy/Obstruction**: Street View exists but is blurry, blocked by a wall, or too far away (`street_view_shows_front = null`).
    *   **Wrong Road**: Street View shows the back or side of the house from a different street (`street_view_shows_front = false`).
    *   **Complex Ambiguity**: Corner lots or Cul-de-sacs where the GPS road-bearing is geometrically inconsistent with the house placement.
*   **The Logic**: 
    1.  The system identifies the failure, discards the Street View image, and instead selects the **Top 3 Listing Photos** based on exterior keyword scoring.
    2.  It launches a **fresh Gemini call** with `Aerial Satellite + Listing Photos`.
    3.  Because Listing Photos are often taken from inside the property boundary (past the fences/hedges that block Street View), the AI is able to resolve the "Front Door" position and map it back to the satellite footprint.
*   **The Swap**: The final result from Pass 2 overwrites the initial `UNCLEAR` result from Pass 1.

---

## 4. The Spatial Reasoning Engine
The system uses a set of hierarchical heuristics to prevent common analysis errors:

*   **The Walkway Rule (Primary)**: The architectural front is defined by the pedestrian path from the public sidewalk to the door—NOT the driveway.
*   **The Toward Rule**: Explicitly instructs Gemini that "facing" means the vector **from house to street**. (Prevents the common error of outputting the road's travel direction).
*   **Cul-de-sac Rule**: For properties on a circle, the AI calculates a vector from the house center to the center of the cul-de-sac bulb.
*   **Townhouse Logic**: For multi-unit buildings, the system implements a "Strict Gate"—it only confirms orientation if a **distinct unit-specific pedestrian door** is visible (not just a shared garage or lobby).

---

## 5. Audit & Data Integrity
To maintain accuracy over time, the system includes a "Ground Truth" feedback loop:

*   **Version Tracking**: Current logic is **`v19`**. Every result is stamped with its version so that logic updates can trigger selective re-runs.
*   **Human-in-the-loop**: The **Orientation Audit Tab** compares the AI's result against a "Ground Truth" dataset.
*   **Accuracy Metrics**: The system tracks "Ambiguity rates" and "180-degree flips" to refine the prompts and GPS math periodically.

---

## 6. Edge Case Handling
| Scenario | Processing Strategy |
| :--- | :--- |
| **Corner Lot** | Always triggers Pass 2 to resolve which of the two streets is the "Primary" front. |
| **Privacy Blur** | Automatically flags Street View as uninformative and relies on Pass 2 Listing Photos. |
| **Under Construction** | AI detects raw dirt/foundations and sets status to `UNDER_CONSTRUCTION`. |
| **Cul-de-sac** | Discards standard road bearings; calculates direction toward the court center. |
