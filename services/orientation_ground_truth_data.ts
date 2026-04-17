/**
 * orientation_ground_truth_data.ts
 *
 * Tester-verified orientation ground truth for Pleasanton properties.
 * Source: "Revalidation - Pleasanton Orientation" spreadsheet.
 *
 * expected_orientation: canonical 8-point compass label, or null if the tester
 *   marked "Good" but didn't specify a direction (derive from current DB value).
 *
 * remark:
 *   "Good" — current AI result was correct at time of tester review
 *   "Bad"  — current AI result was wrong; expected_orientation is the correction
 *   ""     — no remark (e.g. new construction, no data)
 */

export interface GroundTruthRow {
    address: string;
    /** "Good" | "Bad" | "" */
    remark: string;
    /** Canonical 8-point compass label, or null */
    expected_orientation: string | null;
    /** Raw tester comment */
    tester_notes: string;
    /** City key — used to resolve address_index sub-collection */
    city: string;
}

/**
 * A single test result entry stored inside orientation_ground_truth/{zpid}.test_results[].
 *
 * remark:
 *   "Good" | "Bad" — human tester review (tester = "manual")
 *   "Pass" | "Fail" — automated batch test run (tester = "automated")
 *
 * ai_assessed_orientation:
 *   What the AI returned at the time of the test. null for manual entries
 *   when the tester's sheet didn't record the AI's specific output.
 */
export interface TestResult {
    /** "Good" | "Bad" | "Pass" | "Fail" */
    remark: string;
    /** Compass label returned by the AI, e.g. "Southwest". null if unknown. */
    ai_assessed_orientation: string | null;
    /** Free-form notes — tester comment or automated test context (path, azimuth, etc.) */
    notes: string;
    /** Source of this test result */
    tester: 'manual' | 'automated';
    /** ISO date string or Firestore Timestamp */
    date: any;
}

/**
 * The full Firestore document stored at orientation_ground_truth/{zpid}.
 */
export interface GroundTruthDoc {
    zpid: string;
    city: string;
    address: string;
    /** Ground-truth orientation established by human testers */
    expected_orientation: string | null;
    expected_azimuth_deg: number | null;
    /** Ordered log of test results (manual + automated) */
    test_results: TestResult[];
}

export const AZIMUTH_FOR_ORIENTATION: Record<string, number> = {
    'North': 0, 'Northeast': 45, 'East': 90, 'Southeast': 135,
    'South': 180, 'Southwest': 225, 'West': 270, 'Northwest': 315,
};

export const PLEASANTON_GROUND_TRUTH: GroundTruthRow[] = [
    { city: 'Pleasanton', address: '1039 Hopkins Way, Pleasanton, CA 94566 US',       remark: 'Good', expected_orientation: 'North',     tester_notes: 'the property do face north' },
    { city: 'Pleasanton', address: '1131 Mataro Ct, Pleasanton, CA 94566 US',         remark: 'Good', expected_orientation: 'East',      tester_notes: 'the property do face east' },
    { city: 'Pleasanton', address: '1149 Hopkins Way, Pleasanton, CA 94566 US',       remark: 'Good', expected_orientation: 'Northwest', tester_notes: 'the property do face northwest' },
    { city: 'Pleasanton', address: '1224 Harvest Rd, Pleasanton, CA 94566 US',        remark: 'Good', expected_orientation: 'Northeast', tester_notes: 'it actually faces a bit towards northeast' },
    { city: 'Pleasanton', address: '1237 Concord St, Pleasanton, CA 94566 US',        remark: 'Bad',  expected_orientation: 'Northeast', tester_notes: 'the property do not face Southwest it faces Northeast' },
    { city: 'Pleasanton', address: '1265 Koln St, Pleasanton, CA 94566 US',           remark: 'Good', expected_orientation: null,        tester_notes: '' },
    { city: 'Pleasanton', address: '1380 Brookline Loop, Pleasanton, CA 94566 US',    remark: 'Bad',  expected_orientation: 'Southwest', tester_notes: 'the property do not face North it faces Southwest' },
    { city: 'Pleasanton', address: '1398 Piemonte Dr, Pleasanton, CA 94566 US',       remark: 'Bad',  expected_orientation: 'Northeast', tester_notes: 'the property do not face Northwest it faces Northeast' },
    { city: 'Pleasanton', address: '1421 Calle Enrique, Pleasanton, CA 94566 US',     remark: 'Good', expected_orientation: 'Southeast', tester_notes: 'the property do not face west it faces Southeast' },
    { city: 'Pleasanton', address: '1448 Freeman Ln, Pleasanton, CA 94566 US',        remark: 'Bad',  expected_orientation: 'Southeast', tester_notes: 'the property do not face southwest it faces southeast based on the streetview' },
    { city: 'Pleasanton', address: '1450 Finley Rd, Pleasanton, CA 94588 US',         remark: 'Good', expected_orientation: 'East',      tester_notes: 'the property do face east' },
    { city: 'Pleasanton', address: '1515 Germano Way, Pleasanton, CA 94566 US',       remark: 'Bad',  expected_orientation: 'Southeast', tester_notes: 'the property do not face east it faces southeast' },
    { city: 'Pleasanton', address: '1527 Honey Suckle Ct, Pleasanton, CA 94588 US',   remark: 'Bad',  expected_orientation: 'Northwest', tester_notes: 'the property do not face Northeast it faces Northwest' },
    { city: 'Pleasanton', address: '1558 Calle Enrique, Pleasanton, CA 94566 US',     remark: 'Good', expected_orientation: 'Northeast', tester_notes: 'the property do face northeast' },
    { city: 'Pleasanton', address: '1565 Mendoza Ct, Pleasanton, CA 94566 US',        remark: 'Bad',  expected_orientation: 'Southwest', tester_notes: 'the Property do not face East it faces west/southwest (which was correct in earlier version)' },
    { city: 'Pleasanton', address: '1621 Harvest Rd, Pleasanton, CA 94566 US',        remark: 'Good', expected_orientation: 'Southwest', tester_notes: 'the property do face Southwest' },
    { city: 'Pleasanton', address: '1825 Crestline Rd, Pleasanton, CA 94566 US',      remark: 'Bad',  expected_orientation: 'South',     tester_notes: 'the property do not face west it faces South' },
    { city: 'Pleasanton', address: '1889 Via Di Salerno, Pleasanton, CA 94566 US',    remark: 'Good', expected_orientation: 'Southwest', tester_notes: 'the property do face Southwest' },
    { city: 'Pleasanton', address: '2004 W Lagoon Rd, Pleasanton, CA 94566 US',       remark: 'Good', expected_orientation: 'Northeast', tester_notes: 'the property do faces Northeast' },
    { city: 'Pleasanton', address: '2128 Alexander Way, Pleasanton, CA 94588 US',     remark: 'Good', expected_orientation: 'Northeast', tester_notes: 'the property do faces Northeast' },
    { city: 'Pleasanton', address: '215 Mavis Dr, Pleasanton, CA 94566 US',           remark: 'Good', expected_orientation: 'East',      tester_notes: 'the updated orientation is correct, the property front door is towards east' },
    { city: 'Pleasanton', address: '218 Birch Creek Dr, Pleasanton, CA 94566 US',     remark: 'Bad',  expected_orientation: 'South',     tester_notes: 'the property do not face East it faces south (which was correct in earlier version)' },
    { city: 'Pleasanton', address: '226 Birch Creek Dr, Pleasanton, CA 94566 US',     remark: 'Bad',  expected_orientation: 'South',     tester_notes: 'the property do not face East it faces south' },
    { city: 'Pleasanton', address: '2270 Doccia Ct, Pleasanton, CA 94566 US',         remark: 'Bad',  expected_orientation: 'Southeast', tester_notes: 'the property do not face Northeast it faces Southeast' },
    { city: 'Pleasanton', address: '2415 Crestline Rd, Pleasanton, CA 94566 US',      remark: 'Good', expected_orientation: 'West',      tester_notes: 'the property do face West' },
    { city: 'Pleasanton', address: '254 Joseph Ln, Pleasanton, CA 94588 US',          remark: 'Bad',  expected_orientation: 'East',      tester_notes: 'the property do not face northeast it faces East' },
    { city: 'Pleasanton', address: '2577 Arlotta Pl, Pleasanton, CA 94588 US',        remark: 'Bad',  expected_orientation: 'Northwest', tester_notes: 'the property do not face Southeast it faces northwest' },
    { city: 'Pleasanton', address: '2733 Corte Vera Cruz, Pleasanton, CA 94566 US',   remark: 'Good', expected_orientation: 'Southwest', tester_notes: 'the Property do face southwest' },
    { city: 'Pleasanton', address: '282 Del Valle Ct, Pleasanton, CA 94566 US',       remark: 'Bad',  expected_orientation: 'South',     tester_notes: 'The property do not face Northwest it faces south' },
    { city: 'Pleasanton', address: '298 Sullivan Ct, Pleasanton, CA 94566 US',        remark: 'Good', expected_orientation: 'Southeast', tester_notes: 'the property do face Southeast' },
    { city: 'Pleasanton', address: '3019 Boardwalk St, Pleasanton, CA 94588 US',      remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face West' },
    { city: 'Pleasanton', address: '3208 Touriga Dr, Pleasanton, CA 94566 US',        remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face West' },
    { city: 'Pleasanton', address: '3219 Touriga Dr, Pleasanton, CA 94566 US',        remark: 'Good', expected_orientation: 'East',      tester_notes: 'The property do face EAST' },
    { city: 'Pleasanton', address: '3329 Vermont Pl, Pleasanton, CA 94588 US',        remark: 'Good', expected_orientation: 'East',      tester_notes: 'The property do face EAST' },
    { city: 'Pleasanton', address: '337 Trenton Cir, Pleasanton, CA 94566 US',        remark: 'Good', expected_orientation: 'East',      tester_notes: 'The property do face EAST (bit towards Northeast)' },
    { city: 'Pleasanton', address: '3492 Dorset St, Pleasanton, CA 94566 US',         remark: 'Bad',  expected_orientation: 'Southeast', tester_notes: 'determining front door orientation is difficult, but it is definitely not Southwest - Could be southeast/south' },
    { city: 'Pleasanton', address: '3550 Vine St, Pleasanton, CA 94566 US',           remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { city: 'Pleasanton', address: '3593 Whitehall Ct, Pleasanton, CA 94588 US',      remark: 'Good', expected_orientation: 'South',     tester_notes: 'The property do face South' },
    { city: 'Pleasanton', address: '3624 Canelli Ct, Pleasanton, CA 94566 US',        remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North (slight towards Northeast)' },
    { city: 'Pleasanton', address: '3636 Shenandoah Ct, Pleasanton, CA 94588 US',     remark: 'Good', expected_orientation: 'Northwest', tester_notes: 'The property do face Northwest' },
    { city: 'Pleasanton', address: '3641 Shenandoah Ct, Pleasanton, CA 94588 US',     remark: 'Good', expected_orientation: 'South',     tester_notes: 'The property do face South' },
    { city: 'Pleasanton', address: '3653 Kamp Dr, Pleasanton, CA 94588 US',           remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face West' },
    { city: 'Pleasanton', address: '3691 Chillingham Ct, Pleasanton, CA 94588 US',    remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face West' },
    { city: 'Pleasanton', address: '3696 Woodbine Way, Pleasanton, CA 94588 US',      remark: 'Bad',  expected_orientation: 'West',      tester_notes: 'the property do not face Northwest - it is hard to define orientation but based on images it faces West' },
    { city: 'Pleasanton', address: '3817 Muirwood Dr, Pleasanton, CA 94588 US',       remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face West' },
    { city: 'Pleasanton', address: '3825 Brockton Dr, Pleasanton, CA 94588 US',       remark: 'Bad',  expected_orientation: 'West',      tester_notes: 'the property do not face South it faces west' },
    { city: 'Pleasanton', address: '388 Oak Ln, Pleasanton, CA 94566 US',             remark: '',     expected_orientation: null,        tester_notes: 'New construction' },
    { city: 'Pleasanton', address: '3921 Alma Ct, Pleasanton, CA 94588 US',           remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face West' },
    { city: 'Pleasanton', address: '4019 Rennellwood Way, Pleasanton, CA 94566 US',   remark: 'Bad',  expected_orientation: 'Northwest', tester_notes: 'the property do not face Southeast it faces northwest (which was correct in earlier version)' },
    { city: 'Pleasanton', address: '4022 Silver St, Pleasanton, CA 94566 US',         remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { city: 'Pleasanton', address: '4034 Francisco St, Pleasanton, CA 94566 US',      remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { city: 'Pleasanton', address: '4034 Rennellwood Way, Pleasanton, CA 94566 US',   remark: 'Good', expected_orientation: 'Southeast', tester_notes: 'The property do face Southeast' },
    { city: 'Pleasanton', address: '4061 Holland Dr, Pleasanton, CA 94588 US',        remark: 'Good', expected_orientation: 'South',     tester_notes: 'The property do face South' },
    { city: 'Pleasanton', address: '4067 Alvarado St, Pleasanton, CA 94566 US',       remark: 'Good', expected_orientation: 'South',     tester_notes: 'The property do face South' },
    { city: 'Pleasanton', address: '4071 Walnut Dr, Pleasanton, CA 94566 US',         remark: 'Good', expected_orientation: 'Southeast', tester_notes: 'The property do face Southeast' },
    { city: 'Pleasanton', address: '4073 Stanley Blvd, Pleasanton, CA 94566 US',      remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { city: 'Pleasanton', address: '4127 Alvarado St, Pleasanton, CA 94566 US',       remark: 'Good', expected_orientation: 'South',     tester_notes: 'The property do face South' },
    { city: 'Pleasanton', address: '4153 Alba Ct, Pleasanton, CA 94588 US',           remark: 'Bad',  expected_orientation: 'Northwest', tester_notes: 'The property do not face Southwest it faces Northwest (A bit difficult to determine - northwest on the basis of photos)' },
    { city: 'Pleasanton', address: '4159 Amberwood Cir, Pleasanton, CA 94588 US',     remark: 'Bad',  expected_orientation: 'Northeast', tester_notes: 'The Property does not face Southwest it faces northeast' },
    { city: 'Pleasanton', address: '4173 Georgis Pl, Pleasanton, CA 94588 US',        remark: 'Bad',  expected_orientation: 'Northeast', tester_notes: 'The Property does not face North it faces northeast' },
    { city: 'Pleasanton', address: '4181 Georgis Pl, Pleasanton, CA 94588 US',        remark: 'Good', expected_orientation: 'Northeast', tester_notes: 'The property do face Northeast' },
    { city: 'Pleasanton', address: '4207 Zevanove Ct, Pleasanton, CA 94588 US',       remark: 'Bad',  expected_orientation: 'Southeast', tester_notes: 'The property does not face Northwest it faces southeast' },
    { city: 'Pleasanton', address: '4251 Lucero Ct, Pleasanton, CA 94588 US',         remark: 'Bad',  expected_orientation: 'Southwest', tester_notes: 'The Property does not face northeast it faces southwest' },
    { city: 'Pleasanton', address: '4253 Dorman Rd, Pleasanton, CA 94588 US',         remark: 'Bad',  expected_orientation: 'Southwest', tester_notes: 'The property do not face south it faces southwest' },
    { city: 'Pleasanton', address: '4262 Tamur Ct, Pleasanton, CA 94566 US',          remark: 'Bad',  expected_orientation: 'North',     tester_notes: 'The Property does not face south it faces North' },
    { city: 'Pleasanton', address: '4374 Valley Ave #D1, Pleasanton, CA 94566 US',    remark: 'Good', expected_orientation: 'North',     tester_notes: 'The front door do face North' },
    { city: 'Pleasanton', address: '4433 Fairlands Dr, Pleasanton, CA 94588 US',      remark: 'Good', expected_orientation: 'East',      tester_notes: 'The front door do face East' },
    { city: 'Pleasanton', address: '4451 Fairlands Dr, Pleasanton, CA 94588 US',      remark: 'Bad',  expected_orientation: 'South',     tester_notes: 'The property does not face East it faces south' },
    { city: 'Pleasanton', address: '4563 Gatetree Cir, Pleasanton, CA 94566 US',      remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face West' },
    { city: 'Pleasanton', address: '4580 Harper Ct, Pleasanton, CA 94588 US',         remark: 'Good', expected_orientation: 'East',      tester_notes: 'The property do face East' },
    { city: 'Pleasanton', address: '4726 Black Ave, Pleasanton, CA 94566 US',         remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { city: 'Pleasanton', address: '496 Montori Ct, Pleasanton, CA 94566 US',         remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face West' },
    { city: 'Pleasanton', address: '5111 Venice Ct, Pleasanton, CA 94588 US',         remark: 'Good', expected_orientation: 'Southwest', tester_notes: 'The property do face SouthWest' },
    { city: 'Pleasanton', address: '5130 Bianco Ct, Pleasanton, CA 94588 US',         remark: 'Bad',  expected_orientation: 'Southeast', tester_notes: 'The Property does not face East it faces southeast' },
    { city: 'Pleasanton', address: '5207 Crestline Way, Pleasanton, CA 94566 US',     remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { city: 'Pleasanton', address: '5261 Springdale Ave, Pleasanton, CA 94588 US',    remark: 'Bad',  expected_orientation: 'Southwest', tester_notes: 'The property does not face Northeast it faces Southwest' },
    { city: 'Pleasanton', address: '535 San Gabriel Ct, Pleasanton, CA 94566 US',     remark: 'Good', expected_orientation: 'North',     tester_notes: 'The Property do face North' },
    { city: 'Pleasanton', address: '5534 Blackbird Dr, Pleasanton, CA 94566 US',      remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face west' },
    { city: 'Pleasanton', address: '562 Touriga Ct, Pleasanton, CA 94566 US',         remark: 'Good', expected_orientation: 'South',     tester_notes: 'The property do face South' },
    { city: 'Pleasanton', address: '5656 Belleza Dr, Pleasanton, CA 94588 US',        remark: 'Bad',  expected_orientation: 'South',     tester_notes: 'The Property does not face Northwest it faces South/southeast' },
    { city: 'Pleasanton', address: '6156 Corte Padre, Pleasanton, CA 94588 US',       remark: 'Bad',  expected_orientation: 'North',     tester_notes: 'The property do not face South it faces North' },
    { city: 'Pleasanton', address: '6168 Inglewood Dr, Pleasanton, CA 94588 US',      remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { city: 'Pleasanton', address: '6427 Paseo Santa Maria, Pleasanton, CA 94566 US', remark: 'Good', expected_orientation: 'Southwest', tester_notes: 'The property do face Southwest' },
    { city: 'Pleasanton', address: '6650 Johnston Rd, Pleasanton, CA 94588 US',       remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { city: 'Pleasanton', address: '674 Crystal Ct, Pleasanton, CA 94566 US',         remark: 'Bad',  expected_orientation: 'Southwest', tester_notes: 'the property do not face Northeast it faces Southwest (which was correct in earlier versions)' },
    { city: 'Pleasanton', address: '685 Palomino Dr Unit D, Pleasanton, CA 94566 US', remark: 'Bad',  expected_orientation: 'East',      tester_notes: 'The property do not face North it faces east' },
    { city: 'Pleasanton', address: '7332 Stonedale Dr, Pleasanton, CA 94588 US',      remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { city: 'Pleasanton', address: '7333 Tulipwood Cir, Pleasanton, CA 94588 US',     remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property faces west/southwest' },
    { city: 'Pleasanton', address: '7518 Rosedale Ct, Pleasanton, CA 94588 US',       remark: 'Bad',  expected_orientation: 'Northeast', tester_notes: 'the property do not face west it faces Northeast' },
    { city: 'Pleasanton', address: '7543 Maywood Dr, Pleasanton, CA 94588 US',        remark: 'Bad',  expected_orientation: 'South',     tester_notes: 'the property do not face North it faces south (which was correct in earlier verions)' },
    { city: 'Pleasanton', address: '7551 Maywood Dr, Pleasanton, CA 94588 US',        remark: 'Bad',  expected_orientation: 'South',     tester_notes: 'the property do not face East it faces south (which was correct in earlier verions)' },
    { city: 'Pleasanton', address: '7738 Fairoaks Dr, Pleasanton, CA 94588 US',       remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { city: 'Pleasanton', address: '7814 Knollbrook Dr, Pleasanton, CA 94588 US',     remark: 'Good', expected_orientation: 'Northwest', tester_notes: 'The property do face Northwest' },
    { city: 'Pleasanton', address: '788 Crystal Ln, Pleasanton, CA 94566 US',         remark: 'Good', expected_orientation: 'Southwest', tester_notes: 'The property do face Southwest' },
    { city: 'Pleasanton', address: '8044 Golden Eagle Way, Pleasanton, CA 94588 US',  remark: 'Good', expected_orientation: 'Northwest', tester_notes: 'The property do face Northwest' },
    { city: 'Pleasanton', address: '8158 Canyon Creek Cir, Pleasanton, CA 94588 US',  remark: 'Good', expected_orientation: null,        tester_notes: 'property descriptions do not load' },
    { city: 'Pleasanton', address: '859 Gray Fox Cir, Pleasanton, CA 94566 US',       remark: 'Good', expected_orientation: 'Northwest', tester_notes: 'The property do face Northwest' },
    { city: 'Pleasanton', address: '884 Bonita Ave, Pleasanton, CA 94566 US',         remark: 'Good', expected_orientation: 'Northwest', tester_notes: 'The property do face Northwest' },
    { city: 'Pleasanton', address: '9500 Santos Ranch Rd, Pleasanton, CA 94588 US',   remark: 'Bad',  expected_orientation: 'West',      tester_notes: 'The property do not face northeast it faces west' },
];

export const DUBLIN_GROUND_TRUTH: GroundTruthRow[] = [
    { city: 'Dublin', address: '10838 McPeak Ln, Dublin, CA 94568 US',              remark: 'Bad',   expected_orientation: 'Northwest', tester_notes: 'Its Northwest facing, with garage opening facing the south' },
    { city: 'Dublin', address: '10856 Glengarry Ln, Dublin, CA 94568 US',           remark: 'Good',  expected_orientation: 'East',      tester_notes: 'Looks south facing and also says its south facing in the exterior tab but the pin indicates its east facing' },
    { city: 'Dublin', address: '11418 Betlen Dr, Dublin, CA 94568 US',              remark: 'Good',  expected_orientation: 'South',     tester_notes: 'All good...looks south facing, it says south' },
    { city: 'Dublin', address: '11495 Silvergate Dr, Dublin, CA 94568',             remark: 'Good',  expected_orientation: 'Southwest', tester_notes: 'All good...looks south, says South' },
    { city: 'Dublin', address: '1587 Walsh Ave, Dublin, CA 94588 US',               remark: 'Bad',   expected_orientation: null,        tester_notes: 'Open lot, no construction' },
    { city: 'Dublin', address: '1608 Margaret Way, Dublin, CA 94588 US',            remark: 'Bad',   expected_orientation: null,        tester_notes: 'Open lot, no construction' },
    { city: 'Dublin', address: '1652 Savanna Ct, Dublin, CA 94568',                 remark: 'Bad',   expected_orientation: null,        tester_notes: 'Open lot, no construction' },
    { city: 'Dublin', address: '1658 Wren St, Dublin, CA 94588 US',                 remark: 'Bad',   expected_orientation: null,        tester_notes: 'New construction, satellite view shows open land; road indicates could be facing south' },
    { city: 'Dublin', address: '1676 N Terracina Dr, Dublin, CA 94568',             remark: 'Good',  expected_orientation: 'Northeast', tester_notes: 'All good, Northeast it is' },
    { city: 'Dublin', address: '1703 Central Pkwy, Pleasanton, CA 94588 US',        remark: 'Good',  expected_orientation: 'South',     tester_notes: 'All good, South it is' },
    { city: 'Dublin', address: '1799 Sill Ave, Dublin, CA 94568',                   remark: 'Bad',   expected_orientation: null,        tester_notes: 'Unable to determine due to lack of info, open ground with no distinct roads' },
    { city: 'Dublin', address: '1901 Michael Ave, Dublin, CA 94568 US',             remark: 'Good',  expected_orientation: null,        tester_notes: 'Looks its facing north, but says its south, although the satellite view shows an open ground' },
    { city: 'Dublin', address: '1913 Michael Ave, Dublin, CA 94568',                remark: 'Bad',   expected_orientation: null,        tester_notes: 'Looks its facing north, but says its south, although the satellite view shows an open ground' },
    { city: 'Dublin', address: '1935 Ingalls Way, Dublin, CA 94568 US',             remark: 'Bad',   expected_orientation: null,        tester_notes: 'It say west but unable to determine due to lack of info, open ground with no distinct roads' },
    { city: 'Dublin', address: '1949 Michael Ave, Dublin, CA 94568 US',             remark: 'Bad',   expected_orientation: null,        tester_notes: 'It say Northwest but unable to determine due to lack of info, open ground with no distinct roads' },
    { city: 'Dublin', address: '2008 Confidence Way, Dublin, CA 94568 US',          remark: 'Good',  expected_orientation: 'East',      tester_notes: 'Looks Good, Northwest, but also be Entirely west facing' },
    { city: 'Dublin', address: '2100 Carbondale Cir, Dublin, CA 94568',             remark: 'Good',  expected_orientation: 'South',     tester_notes: 'All good, south it is' },
    { city: 'Dublin', address: '2539 Brandini Dr, Dublin, CA 94568 US',             remark: 'Good',  expected_orientation: 'South',     tester_notes: 'All good, south it is' },
    { city: 'Dublin', address: '2730 Mount Dana Dr, Dublin, CA 94568 US',           remark: 'Good',  expected_orientation: 'Northwest', tester_notes: 'All good, Northwest it is' },
    { city: 'Dublin', address: '2829 Mount Dana Dr, Dublin, CA 94568 US',           remark: 'Bad',   expected_orientation: 'Southeast', tester_notes: 'Says it is Northwest facing but looks southwest' },
    { city: 'Dublin', address: '2848 E Cog Hill Ter, Dublin, CA 94568',             remark: 'Good',  expected_orientation: 'Northwest', tester_notes: 'All good, Northwest it is' },
    { city: 'Dublin', address: '2890 Sable Oaks Way, Dublin, CA 94568 US',          remark: 'Bad',   expected_orientation: 'Northwest', tester_notes: 'The V1 of ai northwest seems true; latest ai V5 says north but it is slightly tilted towards west so it is facing northwest' },
    { city: 'Dublin', address: '2933 Stringham Way, Dublin, CA 94568 US',           remark: 'Bad',   expected_orientation: 'Southeast', tester_notes: 'Southeast it is' },
    { city: 'Dublin', address: '3016 Threecastles Way, Dublin, CA 94568',           remark: 'Bad',   expected_orientation: 'South',     tester_notes: 'It says southwest, but looks like it is South' },
    { city: 'Dublin', address: '3132 Aran Way, Dublin, CA 94568 US',                remark: 'Good',  expected_orientation: 'East',      tester_notes: 'The garage is facing west, the door is not visible even in the street view, but satellite shows a path on east side that would lead to the main door; east facing per description' },
    { city: 'Dublin', address: '3159 Central Pkwy, Dublin, CA 94568 US',            remark: 'Good',  expected_orientation: 'South',     tester_notes: 'All good, South it is' },
    { city: 'Dublin', address: '3225 Central Pkwy, Dublin, CA 94568 US',            remark: 'Good',  expected_orientation: 'South',     tester_notes: 'All good, South it is' },
    { city: 'Dublin', address: '3240 Maguire Way Apt 318, Dublin, CA 94568 US',     remark: 'Good',  expected_orientation: 'Northwest', tester_notes: 'All good, Looks like it is Northwest' },
    { city: 'Dublin', address: '3245 Dublin Blvd Apt 402, Dublin, CA 94568 US',     remark: 'Bad',   expected_orientation: 'South',     tester_notes: 'Location of pin differs on both platforms; Zillow shows south (correct) but Zyphe shows Northeast (incorrect)' },
    { city: 'Dublin', address: '3240 Maguire Way Apt 401, Dublin, CA 94568 US',     remark: 'Good',  expected_orientation: 'South',     tester_notes: 'All good, South it is' },
    { city: 'Dublin', address: '3275 Dublin Blvd Apt 407, Dublin, CA 94568 US',     remark: 'Good',  expected_orientation: 'Northeast', tester_notes: 'All good, Northeast it is' },
    { city: 'Dublin', address: '3275 Dublin Blvd Apt 412, Dublin, CA 94568 US',     remark: 'Good',  expected_orientation: 'South',     tester_notes: 'All good, South it is' },
    { city: 'Dublin', address: '3290 Maguire Way Apt 101, Dublin, CA 94568 US',     remark: 'Good',  expected_orientation: 'Northeast', tester_notes: 'All good, Northeast it is' },
    { city: 'Dublin', address: '3360 Maguire Way Unit 201, Dublin, CA 94568 US',    remark: 'Bad',   expected_orientation: null,        tester_notes: 'The location of the pin on Zillow and Zyphe does not match' },
    { city: 'Dublin', address: '3385 Dublin Blvd Unit 130, Dublin, CA 94568',       remark: 'Good',  expected_orientation: 'South',     tester_notes: 'Looks like it is south facing, although the location of the pin on Zillow and Zyphe does not match' },
    { city: 'Dublin', address: '3398 Araldi Ln, Dublin, CA 94568 US',               remark: 'Bad',   expected_orientation: 'South',     tester_notes: 'It looks it is facing south, as per the v1 of ai' },
    { city: 'Dublin', address: '3465 Dublin Blvd Unit 128, Dublin, CA 94568',       remark: 'Bad',   expected_orientation: null,        tester_notes: 'The location of the pin on Zillow and Zyphe does not match' },
    { city: 'Dublin', address: '3489 Capoterra Way, Dublin, CA 94568',              remark: 'Good',  expected_orientation: 'South',     tester_notes: 'All good, South it is' },
    { city: 'Dublin', address: '3662 Branding Iron Pl, Dublin, CA 94568 US',        remark: 'Bad',   expected_orientation: 'Southeast', tester_notes: 'Looks like it is southeast but it says it is southwest' },
    { city: 'Dublin', address: '3703 Whitworth Dr, Dublin, CA 94568 US',            remark: 'Bad',   expected_orientation: 'Southeast', tester_notes: 'Looks like it is southeast but it says it is south' },
    { city: 'Dublin', address: '3710 Central Parkway, Dublin, CA 94568',            remark: 'Good',  expected_orientation: 'Northeast', tester_notes: 'All good, Northeast it is' },
    { city: 'Dublin', address: '3717 Branding Iron Pl, Dublin, CA 94568 US',        remark: 'Good',  expected_orientation: 'Northeast', tester_notes: 'All good, Northeast it is' },
    { city: 'Dublin', address: '3730 Whitworth Dr, Dublin, CA 94568 US',            remark: 'Good',  expected_orientation: 'West',      tester_notes: 'All good, West it is' },
    { city: 'Dublin', address: '3744 Whitworth Dr, Dublin, CA 94568 US',            remark: 'Good',  expected_orientation: 'West',      tester_notes: 'All good, West it is' },
    { city: 'Dublin', address: '3769 Finnian Way, Dublin, CA 94568 US',             remark: 'Bad',   expected_orientation: 'North',     tester_notes: 'Pin location is wrong; it is north facing but says it is south facing' },
    { city: 'Dublin', address: '3815 Hereford Rd, Dublin, CA 94588 US',             remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '3827 Branding Iron Pl, Dublin, CA 94568 US',        remark: 'Good',  expected_orientation: 'Southwest', tester_notes: 'All good, Southwest it is' },
    { city: 'Dublin', address: '3851 Hereford Rd, Dublin, CA 94568',                remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '3868 Hereford Rd, Dublin, CA 94588 US',             remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '3930 Viggo Way, Dublin, CA 94568 US',               remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '3938 Viggo Way, Dublin, CA 94568 US',               remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '3953 Quinn Rd, Dublin, CA 94588 US',                remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '4017 Quinn Rd, Dublin, CA 94588 US',                remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '4021 Doyle Rd, Dublin, CA 94588 US',                remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '4022 Windsor Way, Dublin, CA 94568 US',             remark: 'Good',  expected_orientation: 'East',      tester_notes: 'All good, east it is' },
    { city: 'Dublin', address: '4026 Chalk Hill Way, Dublin, CA 94568',             remark: 'Good',  expected_orientation: 'North',     tester_notes: 'All good, North it is' },
    { city: 'Dublin', address: '4036 Bothrin St, Dublin, CA 94568 US',              remark: 'Bad',   expected_orientation: 'Northeast', tester_notes: 'The satellite view makes it clear it is northeast as it is a bit tilted towards north and not facing entirely to the east' },
    { city: 'Dublin', address: '4052 Knightstown St, Dublin, CA 94568 US',          remark: 'Bad',   expected_orientation: 'East',      tester_notes: 'All good, Northwest it is' },
    { city: 'Dublin', address: '4066 Rosehill Pl, Dublin, CA 94568 US',             remark: 'Good',  expected_orientation: 'West',      tester_notes: 'All good, West it is' },
    { city: 'Dublin', address: '4067 Saint Helena Way, Dublin, CA 94568',           remark: 'Good',  expected_orientation: 'East',      tester_notes: 'All good, South it is' },
    { city: 'Dublin', address: '4126 Clarinbridge Cir, Dublin, CA 94568',           remark: 'Good',  expected_orientation: 'South',     tester_notes: 'All good, South it is' },
    { city: 'Dublin', address: '4138 Clarinbridge Cir, Dublin, CA 94568',           remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '4166 Forest Springs Rd, Dublin, CA 94568 US',       remark: 'Good',  expected_orientation: 'North',     tester_notes: 'All good, North it is' },
    { city: 'Dublin', address: '4302 Keegan St, Dublin, CA 94568 US',               remark: 'Good',  expected_orientation: 'East',      tester_notes: 'All good, East it is' },
    { city: 'Dublin', address: '4431 Duccio Pl, Dublin, CA 94568',                  remark: 'Bad',   expected_orientation: 'West',      tester_notes: 'This could be facing either sides, east or west, but the street is on the west so it has to be facing West' },
    { city: 'Dublin', address: '4433 Cherico Ln, Dublin, CA 94568',                 remark: 'Bad',   expected_orientation: 'West',      tester_notes: 'All good, Northeast it is' },
    { city: 'Dublin', address: '4450 Sunset View Dr, Dublin, CA 94568 US',          remark: 'Bad',   expected_orientation: 'Southeast', tester_notes: 'It is Southeast not Southwest' },
    { city: 'Dublin', address: '4480 Peacock Ct, Dublin, CA 94568 US',              remark: 'Good',  expected_orientation: 'North',     tester_notes: 'All good, North it is' },
    { city: 'Dublin', address: '4585 Brannigan St, Dublin, CA 94568 US',            remark: 'Bad',   expected_orientation: 'West',      tester_notes: 'Says it is south west but looks like direct west' },
    { city: 'Dublin', address: '4612 Sandyford Ct, Dublin, CA 94568 US',            remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '4630 Central Pkwy, Dublin, CA 94568 US',            remark: 'Bad',   expected_orientation: 'North',     tester_notes: 'Says it is Northwest but looks like direct north' },
    { city: 'Dublin', address: '4685 Rimini Ct, Dublin, CA 94568 US',               remark: 'Good',  expected_orientation: 'Northeast', tester_notes: 'All good, Northeast it is' },
    { city: 'Dublin', address: '4692 Rimini Ct, Dublin, CA 94568 US',               remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '4719 Sandyford Ct, Dublin, CA 94568 US',            remark: 'Good',  expected_orientation: 'North',     tester_notes: 'All good, North it is' },
    { city: 'Dublin', address: '4763 Perugia St, Dublin, CA 94568 US',              remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '4866 Shelton St, Dublin, CA 94568 US',              remark: 'Bad',   expected_orientation: 'Northeast', tester_notes: 'It is Northeast not Northwest' },
    { city: 'Dublin', address: '4899 Landmark Way, Dublin, CA 94568 US',            remark: 'Good',  expected_orientation: 'Southeast', tester_notes: 'Door faces Southwest as it is at the corner of the house, the garage door faces Southeast' },
    { city: 'Dublin', address: '4906 Colchester Ct, Dublin, CA 94568 US',           remark: 'Good',  expected_orientation: 'East',      tester_notes: 'All good, East it is' },
    { city: 'Dublin', address: '4915 Shelton St, Dublin, CA 94568 US',              remark: 'Good',  expected_orientation: 'West',      tester_notes: 'All good, West it is' },
    { city: 'Dublin', address: '4958 Trescott Ct, Dublin, CA 94568 US',             remark: 'Bad',   expected_orientation: 'South',     tester_notes: 'It says east but the garage opening is facing that side and the door is facing south' },
    { city: 'Dublin', address: '4978 Houlton Ct, Dublin, CA 94568 US',              remark: 'Bad',   expected_orientation: 'East',      tester_notes: 'Looks like it is facing east and not north' },
    { city: 'Dublin', address: '4999 Piper Glen Ter, Dublin, CA 94568 US',          remark: 'Good',  expected_orientation: 'Southwest', tester_notes: 'All good, Southwest it is' },
    { city: 'Dublin', address: '5089 Winterbrook Ave, Dublin, CA 94568 US',         remark: 'Good',  expected_orientation: 'South',     tester_notes: 'All good, South it is' },
    { city: 'Dublin', address: '5219 N Forestdale Cir, Dublin, CA 94568 US',        remark: 'Good',  expected_orientation: 'East',      tester_notes: 'All good, East it is' },
    { city: 'Dublin', address: '5271 Salerno Dr, Dublin, CA 94568 US',              remark: 'Bad',   expected_orientation: 'Northwest', tester_notes: 'It is Northwest not Northeast' },
    { city: 'Dublin', address: '5345 W Chesterfield Cir, Dublin, CA 94568 US',      remark: 'Good',  expected_orientation: 'West',      tester_notes: 'All good, West it is' },
    { city: 'Dublin', address: '5425 Melissa Ln #221, Dublin, CA 94568 US',         remark: 'Bad',   expected_orientation: 'North',     tester_notes: '' },
    { city: 'Dublin', address: '5473 Dublin Blvd, Dublin, CA 94568 US',             remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '5501 De Marcus Blvd Apt 206, Dublin, CA 94568 US',  remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '5501 De Marcus Blvd Apt 420, Dublin, CA 94568 US',  remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '5501 De Marcus Blvd Apt 542, Dublin, CA 94568 US',  remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '5509 El Dorado Ln, Dublin, CA 94568',               remark: 'Bad',   expected_orientation: 'South',     tester_notes: 'Door is facing North, garage is facing south' },
    { city: 'Dublin', address: '5509 Holly Bay Ave, Dublin, CA 94568',              remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '5552 Holly Bay Ave Unit D, Dublin, CA 94568 US',    remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '5581 Dublin Blvd, Dublin, CA 94568 US',             remark: 'Good',  expected_orientation: 'South',     tester_notes: 'All good, South it is' },
    { city: 'Dublin', address: '5606 Glass Rd, Dublin, CA 94568 US',                remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '5626 El Dorado Ln, Dublin, CA 94568 US',            remark: 'Good',  expected_orientation: 'South',     tester_notes: 'All good, South it is' },
    { city: 'Dublin', address: '5630 Central Pkwy Unit 202, Dublin, CA 94568 US',   remark: 'Bad',   expected_orientation: 'North',     tester_notes: 'It is north not south' },
    { city: 'Dublin', address: '5653 Signal Hill Dr, Dublin, CA 94568 US',          remark: 'Good',  expected_orientation: 'West',      tester_notes: 'All good, West it is' },
    { city: 'Dublin', address: '5679 Melodia Cir, Dublin, CA 94568 US',             remark: 'Bad',   expected_orientation: 'Northeast', tester_notes: 'Northeast it is' },
    { city: 'Dublin', address: '5767 Iron Horse Pkwy Unit D, Dublin, CA 94568 US',  remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
    { city: 'Dublin', address: '5862 Cadence Ave, Dublin, CA 94568 US',             remark: 'Bad',   expected_orientation: 'West',      tester_notes: 'It is South not Northeast' },
    { city: 'Dublin', address: '5919 Topsfield Cir, Dublin, CA 94568 US',           remark: 'Good',  expected_orientation: 'South',     tester_notes: 'All good, South it is' },
    { city: 'Dublin', address: '5990 Peridot Pl, Dublin, CA 94568',                 remark: 'Good',  expected_orientation: 'North',     tester_notes: 'All good, North it is' },
    { city: 'Dublin', address: '6017 Basaltina Pl, Dublin, CA 94568',               remark: 'Good',  expected_orientation: 'East',      tester_notes: 'All good, East it is' },
    { city: 'Dublin', address: '6056 Bullion Ln, Dublin, CA 94568',                 remark: 'Good',  expected_orientation: 'Southwest', tester_notes: 'All good, Southwest it is' },
    { city: 'Dublin', address: '6065 Bullion Ln, Dublin, CA 94568',                 remark: 'Bad',   expected_orientation: 'West',      tester_notes: 'Looks like it is east facing and not west, no street view available' },
    { city: 'Dublin', address: '6635 Maple Dr, Dublin, CA 94568 US',                remark: 'Bad',   expected_orientation: 'Southwest', tester_notes: 'It says south but it is slightly tilted towards west, so its orientation is southwest' },
    { city: 'Dublin', address: '6719 Spruce Ln, Dublin, CA 94568 US',               remark: 'Other', expected_orientation: 'Southwest', tester_notes: 'The door is facing Southeast, the overall the house faces southwest' },
    { city: 'Dublin', address: '6759 S Mariposa Ln, Dublin, CA 94568',              remark: 'Bad',   expected_orientation: 'North',     tester_notes: 'The description says it is North facing, the orientation is north facing only' },
    { city: 'Dublin', address: '6763 Tory Way, Dublin, CA 94568 US',                remark: 'Good',  expected_orientation: 'Southeast', tester_notes: 'All good, Southeast it is' },
    { city: 'Dublin', address: '6916 Stags Leap Ln, Dublin, CA 94568 US',           remark: 'Good',  expected_orientation: 'South',     tester_notes: 'All good, South it is' },
    { city: 'Dublin', address: '6931 Pine Ct, Dublin, CA 94568',                    remark: 'Bad',   expected_orientation: 'Southwest', tester_notes: 'Slightly tilted towards west, so southwest' },
    { city: 'Dublin', address: '7026 N Mariposa Ln, Dublin, CA 94568 US',           remark: 'Bad',   expected_orientation: 'North',     tester_notes: 'North facing it is, not east for sure' },
    { city: 'Dublin', address: '7036 Allegheny Dr, Dublin, CA 94568 US',            remark: 'Good',  expected_orientation: 'Northeast', tester_notes: 'The door is facing northwest, and garage and house seems to face northeast' },
    { city: 'Dublin', address: '7060 Allegheny Dr, Dublin, CA 94568 US',            remark: 'Other', expected_orientation: 'Northeast', tester_notes: 'Faces northeast' },
    { city: 'Dublin', address: '7065 Lancaster Ct, Dublin, CA 94568 US',            remark: 'Other', expected_orientation: 'Southwest', tester_notes: 'Faces southwest' },
    { city: 'Dublin', address: '7081 Ann Arbor Way, Dublin, CA 94568 US',           remark: 'Good',  expected_orientation: 'Southwest', tester_notes: 'Faces southwest' },
    { city: 'Dublin', address: '7134 Regional St, Dublin, CA 94568 US',             remark: 'Good',  expected_orientation: 'East',      tester_notes: 'Faces east' },
    { city: 'Dublin', address: '7151 Atlas Peak Dr, Dublin, CA 94568 US',           remark: 'Bad',   expected_orientation: 'Southwest', tester_notes: 'Faces southwest, not northeast' },
    { city: 'Dublin', address: '7172 Amador Valley Blvd, Dublin, CA 94568 US',      remark: 'Bad',   expected_orientation: 'Northwest', tester_notes: 'Not west, but Northwest it is' },
    { city: 'Dublin', address: '7228 Carneros Ln, Dublin, CA 94568 US',             remark: 'Good',  expected_orientation: 'Northeast', tester_notes: 'Faces northeast' },
    { city: 'Dublin', address: '7229 Calistoga Ln, Dublin, CA 94568 US',            remark: 'Bad',   expected_orientation: 'Southwest', tester_notes: 'Faces southwest, not west' },
    { city: 'Dublin', address: '7240 Carneros Ln, Dublin, CA 94568 US',             remark: 'Bad',   expected_orientation: 'Southeast', tester_notes: 'Faces southeast, not southwest' },
    { city: 'Dublin', address: '7272 Cronin Cir, Dublin, CA 94568 US',              remark: 'Bad',   expected_orientation: 'Northeast', tester_notes: 'Slightly tilted towards north, so northeast' },
    { city: 'Dublin', address: '7511 Oxford Cir, Dublin, CA 94568 US',              remark: 'Bad',   expected_orientation: 'Southeast', tester_notes: 'Faces southeast/south, not north at all' },
    { city: 'Dublin', address: '7516 Stagecoach Rd, Dublin, CA 94568 US',           remark: 'Good',  expected_orientation: 'Northeast', tester_notes: 'Faces Northeast' },
    { city: 'Dublin', address: '7579 Burnham Way, Dublin, CA 94568 US',             remark: 'Good',  expected_orientation: 'West',      tester_notes: 'Faces west' },
    { city: 'Dublin', address: '7584 Silvertree Ln, Dublin, CA 94568 US',           remark: 'Bad',   expected_orientation: 'East',      tester_notes: 'The property does not face Northwest it faces east' },
    { city: 'Dublin', address: '7642 Arbor Creek Cir, Dublin, CA 94568 US',         remark: 'Good',  expected_orientation: 'Northeast', tester_notes: 'Northeast it is' },
    { city: 'Dublin', address: '7663 Amarillo Rd, Dublin, CA 94568 US',             remark: 'Good',  expected_orientation: 'West',      tester_notes: 'Faces west' },
    { city: 'Dublin', address: '7674 Tuscany Dr, Dublin, CA 94568 US',              remark: 'Good',  expected_orientation: 'West',      tester_notes: 'Orientation okay' },
    { city: 'Dublin', address: '7774 Tuscany Dr, Dublin, CA 94568 US',              remark: 'Bad',   expected_orientation: 'Southeast', tester_notes: 'The property does not face South it faces Southeast' },
    { city: 'Dublin', address: '7778 Alto Way, Dublin, CA 94568 US',                remark: 'Good',  expected_orientation: 'East',      tester_notes: 'Faces east' },
    { city: 'Dublin', address: '7780 Clifden Ct, Dublin, CA 94568 US',              remark: 'Good',  expected_orientation: 'East',      tester_notes: 'Faces east' },
    { city: 'Dublin', address: '7800 Woodren Ct, Dublin, CA 94568 US',              remark: 'Good',  expected_orientation: 'South',     tester_notes: 'Faces south/southeast' },
    { city: 'Dublin', address: '7896 Gate Way, Dublin, CA 94568 US',                remark: 'Good',  expected_orientation: 'West',      tester_notes: 'Faces West/southwest' },
    { city: 'Dublin', address: '7906 Regional Cmn, Dublin, CA 94568 US',            remark: 'Bad',   expected_orientation: 'Southeast', tester_notes: 'The property does not face Northwest it faces southeast' },
    { city: 'Dublin', address: '7921 Crossridge Rd, Dublin, CA 94568 US',           remark: 'Bad',   expected_orientation: 'West',      tester_notes: 'The door faces northwest as it is diagonally placed to the property; the garage and house faces west' },
    { city: 'Dublin', address: '7922 Regional Cmn, Dublin, CA 94568 US',            remark: 'Bad',   expected_orientation: 'Northeast', tester_notes: 'Likely to face northeast, as it is slightly tilted' },
    { city: 'Dublin', address: '7991 Regional Cmn, Dublin, CA 94568 US',            remark: 'Bad',   expected_orientation: 'Northwest', tester_notes: 'The property does not face Northeast it faces Northwest' },
    { city: 'Dublin', address: '7997 Via Zapata, Dublin, CA 94568 US',              remark: 'Bad',   expected_orientation: 'West',      tester_notes: 'The property does not face south it faces west' },
    { city: 'Dublin', address: '8107 Peppertree Rd, Dublin, CA 94568 US',           remark: 'Bad',   expected_orientation: 'West',      tester_notes: 'The property does not face Southwest it faces west' },
    { city: 'Dublin', address: '8244 Brittany Dr, Dublin, CA 94568 US',             remark: 'Good',  expected_orientation: 'Northeast', tester_notes: 'Northeast it is' },
    { city: 'Dublin', address: '8318 Mulberry Pl, Dublin, CA 94568 US',             remark: 'Bad',   expected_orientation: 'Northeast', tester_notes: 'The door faces southeast, but the garage and house faces northeast' },
    { city: 'Dublin', address: '8492 Wicklow Ln, Dublin, CA 94568 US',              remark: 'Good',  expected_orientation: null,        tester_notes: 'Orientation okay' },
    { city: 'Dublin', address: '8514 Newry Pl, Dublin, CA 94568',                   remark: 'Good',  expected_orientation: 'Northeast', tester_notes: 'Northeast it is' },
    { city: 'Dublin', address: '8578 Deervale Rd, Dublin, CA 94568 US',             remark: 'Bad',   expected_orientation: 'East',      tester_notes: 'The property does not face Southwest it faces east' },
    { city: 'Dublin', address: '8589 Davona Dr, Dublin, CA 94568 US',               remark: 'Good',  expected_orientation: 'Southwest', tester_notes: 'Orientation okay' },
    { city: 'Dublin', address: '9701 Sara Ann Ct, Dublin, CA 94568',                remark: 'Bad',   expected_orientation: null,        tester_notes: '' },
];

/** All ground truth datasets keyed by city slug */
export const ALL_GROUND_TRUTH: Record<string, GroundTruthRow[]> = {
    pleasanton: PLEASANTON_GROUND_TRUTH,
    dublin:     DUBLIN_GROUND_TRUTH,
};
