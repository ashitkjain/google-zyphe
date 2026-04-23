/**
 * PropertyOverviewDashboard
 *
 * Thin compositor: manages state and derived booleans, then renders the
 * two-column layout by delegating to PropertyDashboardLeft and PropertyDashboardRight.
 *
 * Column files:
 *   Left  → PropertyDashboardLeft.tsx   (MLS · Environment · Resilience · Solar · Daily Living)
 *   Right → PropertyDashboardRight.tsx  (Schools · Orientation · Neighborhood · Rental · Nearby · AI Summary)
 *   Shared → PropertyDashboardShared.tsx (SectionCard)
 */
import React from 'react';
import { PropertyData, ComprehensiveAnalysisResult, CustomAIAnalysisResult } from '../../types';
import { calculateSolarPotential } from '../../utils/solarCalculations';
import { computeSolarBenchmarks } from '../../utils/solarCityBenchmarks';
import { NeighborhoodAnalysis } from '../../types/ai';
import { CensusDemographics } from '../../services/api/environmental';
import { PropertyDashboardLeft } from './PropertyDashboardLeft';
import { PropertyDashboardRight } from './PropertyDashboardRight';

interface Props {
    propertyData: PropertyData;
    analysis?: ComprehensiveAnalysisResult | null;
    customAnalysis?: CustomAIAnalysisResult | null;
    micro?: { insight: string; fetchedAt: number } | null;
    schoolsIntelligence?: any;
    census?: CensusDemographics | null;
    cityNhEntryOverview?: any;
    visualPoi?: NeighborhoodAnalysis['visual_poi'];
    mapLabels?: string[];
    ltrAnalysis?: { monthly_rent?: string; vacancy_rate?: string; comparison_summary?: string } | null;
    onRunAnalysis?: () => void;
    orientationGroundTruth?: { expected_orientation: string; expected_azimuth_deg: number | null; gt_source: string } | null;
}

const PropertyOverviewDashboard: React.FC<Props> = ({
    propertyData: data,
    customAnalysis,
    micro,
    schoolsIntelligence,
    cityNhEntryOverview,
    visualPoi,
    mapLabels,
    neighborhoodOverview,
    ltrAnalysis,
    onRunAnalysis,
    orientationGroundTruth,
}) => {
    // ── Derived feature flags ──────────────────────────────────────────────────
    const solar = data.solarData;
    const solarPotential = solar?.estimatedSolarProduction || (solar ? calculateSolarPotential(solar) : null);
    // computeSolarBenchmarks kept here for future use; columns may accept it as a prop when needed
    const _solarBench = solar ? computeSolarBenchmarks(solar, data.city, data.state) : null; // eslint-disable-line @typescript-eslint/no-unused-vars

    const hasClimate = !!(data.windRiskScore || data.floodRiskScore || data.fireRiskScore || data.heatRiskScore);
    const hasPollen  = !!(data.pollen?.score != null || data.pollen?.category);
    const hasNoise   = data.noiseScore != null;
    const hasBroadband = !!data.broadband;
    const hasEV      = !!(data as any).evChargers;
    const hasWalk    = !!(data.walkScore || data.transitScore || data.bikeScore);
    const hasSchools = !!(schoolsIntelligence?.schools?.length);
    const hasPlaces  = !!(data as any).nearbyPlaces?.length;
    const hasSolar   = !!solar;
    const hasCoords  = !!data.coordinates;
    const hasEnv     = !!(hasClimate || hasPollen || data.airQuality || hasNoise || data.drought || (data as any).historical_disasters);

    // ── UI state ───────────────────────────────────────────────────────────────
    const [mlsOpen, setMlsOpen]                         = React.useState(false);
    const [envOpen, setEnvOpen]                         = React.useState<Record<string, boolean>>({});
    const [selectedSchool, setSelectedSchool]           = React.useState(0);
    const [isSchoolModalOpen, setIsSchoolModalOpen]     = React.useState(false);
    const [isNearbyCollapsed, setIsNearbyCollapsed]     = React.useState(false);

    const toggleEnv = (key: string) => setEnvOpen(prev => ({ ...prev, [key]: !prev[key] }));

    // ── Layout ─────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-col xl:flex-row gap-8 items-start">

                {/* ── LEFT COLUMN ── */}
                <div className="flex-1 xl:flex-[3] min-w-0 flex flex-col gap-8">
                    <PropertyDashboardLeft
                        data={data}
                        micro={micro}
                        hasEnv={hasEnv}
                        hasCoords={hasCoords}
                        hasNoise={hasNoise}
                        hasPollen={hasPollen}
                        hasSolar={hasSolar}
                        hasWalk={hasWalk}
                        hasBroadband={hasBroadband}
                        hasEV={hasEV}
                        solarPotential={solarPotential}
                        mlsOpen={mlsOpen}
                        setMlsOpen={setMlsOpen}
                        envOpen={envOpen}
                        toggleEnv={toggleEnv}
                        customAnalysis={customAnalysis}
                    />
                </div>

                {/* ── RIGHT COLUMN ── */}
                <div className="xl:flex-1 flex flex-col">
                    <PropertyDashboardRight
                        data={data}
                        customAnalysis={customAnalysis}
                        schoolsIntelligence={schoolsIntelligence}
                        cityNhEntryOverview={cityNhEntryOverview}
                        visualPoi={visualPoi}
                        mapLabels={mapLabels}
                        neighborhoodOverview={neighborhoodOverview}
                        ltrAnalysis={ltrAnalysis}
                        hasSchools={hasSchools}
                        hasPlaces={hasPlaces}
                        selectedSchool={selectedSchool}
                        setSelectedSchool={setSelectedSchool}
                        isSchoolModalOpen={isSchoolModalOpen}
                        setIsSchoolModalOpen={setIsSchoolModalOpen}
                        isNearbyCollapsed={isNearbyCollapsed}
                        setIsNearbyCollapsed={setIsNearbyCollapsed}
                        onRunAnalysis={onRunAnalysis}
                        orientationGroundTruth={orientationGroundTruth}
                    />
                </div>

            </div>
        </div>
    );
};

export default PropertyOverviewDashboard;
