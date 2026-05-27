import React, { useState, useEffect, useRef } from 'react';

interface LogLine {
    timestamp: string;
    message: string;
    level: 'info' | 'success' | 'warn' | 'error';
}

interface PropertyStatus {
    zpid: string;
    address: string;
    status: 'success' | 'partial' | 'failed';
    errors: string[];
    warnings: string[];
}

interface DagNode {
    id: string;
    label: string;
    description: string;
    source: string;
    status: 'idle' | 'running' | 'success' | 'error';
}

const INITIAL_DAG: DagNode[] = [
    { id: 'raw_listings_feed', label: 'raw_listings_feed', description: 'Queries active ZIP listings', source: 'rapidapi', status: 'idle' },
    { id: 'listings_map', label: 'listings_map', description: 'Indexes ZPIDs and properties', source: 'computed', status: 'idle' },
    { id: 'cache_status', label: 'cache_status', description: 'Checks Firestore properties cache', source: 'database', status: 'idle' },
    { id: 'uncached_zpid', label: 'uncached_zpid', description: 'Scatters uncached properties', source: 'computed', status: 'idle' },
    { id: 'coords', label: 'coords', description: 'Resolves coordinates (lat, lng)', source: 'computed', status: 'idle' },
    { id: 'walk_score', label: 'walk_score', description: 'Fetches Walk, Transit, Bike scores', source: 'environmental', status: 'idle' },
    { id: 'google_solar', label: 'google_solar', description: 'Fetches Google Solar energy potentials', source: 'environmental', status: 'idle' },
    { id: 'fema_nri', label: 'fema_nri', description: 'Calculates FEMA NRI climate risk scores', source: 'environmental', status: 'idle' },
    { id: 'bulk_firestore_write', label: 'bulk_firestore_write', description: 'Commits properties to Firestore', source: 'database', status: 'idle' },
    { id: 'final_ingestion_summary', label: 'final_ingestion_summary', description: 'Aggregates DAG execution stats', source: 'computed', status: 'idle' },
];

const MOCK_DUBLIN_PROPERTIES: PropertyStatus[] = [
    {
        zpid: '25065477',
        address: '6713 Elm Ct, Dublin, CA 94568',
        status: 'partial',
        errors: [
            '[compSummary] Narrative Summary missing',
            '[compRisks] Risks & Considerations missing',
            '[schoolAnalyses] School Intelligence missing'
        ],
        warnings: [
            '[communityPulse] Community Pulse missing at city level',
            '[livingWage] MIT Living Wage Data missing',
            '[contextGraph] AI Context Graph missing'
        ]
    },
    {
        zpid: '25070907',
        address: '11263 Rolling Hills Dr, Dublin, CA 94568',
        status: 'partial',
        errors: [
            '[compSummary] Narrative Summary missing',
            '[compRisks] Risks & Considerations missing',
            '[schoolAnalyses] School Intelligence missing'
        ],
        warnings: [
            '[communityPulse] Community Pulse missing',
            '[livingWage] MIT Living Wage Data missing',
            '[contextGraph] AI Context Graph missing'
        ]
    },
    {
        zpid: '25065790',
        address: '6760 Maple Dr, Dublin, CA 94568',
        status: 'failed',
        errors: [
            '[aiVisualInterior] AI Visual — Interior missing',
            '[aiVisualExterior] AI Visual — Exterior missing',
            '[privacyVisual] AI Visual — Privacy missing',
            '[compSummary] Narrative Summary missing',
            '[compRisks] Risks & Considerations missing',
            '[intSummary] Interior Summary missing',
            '[intRooms] Rooms Summary missing',
            '[schoolAnalyses] School Intelligence missing',
            '[lifestyleInsights] Lifestyle Insights missing',
            '[lifestyleFit] Lifestyle Fit Analysis missing',
            '[investmentSTR] STR Performance missing',
            '[investmentLTR] LTR Analysis missing',
            '[neighborhoodNarrative] Neighborhood Narrative missing'
        ],
        warnings: [
            '[designStyle] AI Visual — Design Style missing',
            '[conditionFinish] AI Visual — Condition & Finish missing',
            '[curbAppeal] AI Visual — Curb Appeal missing',
            '[backyardPatio] AI Visual — Backyard/Patio missing',
            '[streetViewAi] Street View AI missing',
            '[communityPulse] Community Pulse missing',
            '[livingWage] MIT Living Wage Data missing',
            '[customAnalysis] Custom AI Analysis missing',
            '[intVibe] Interior Vibe missing',
            '[intTags] Interior Tags missing',
            '[contextGraph] AI Context Graph missing'
        ]
    },
    {
        zpid: '25088339',
        address: '4778 Westwood Ct, Dublin, CA 94568',
        status: 'failed',
        errors: [
            '[aiVisualInterior] AI Visual — Interior missing',
            '[aiVisualExterior] AI Visual — Exterior missing',
            '[privacyVisual] AI Visual — Privacy missing',
            '[compSummary] Narrative Summary missing',
            '[compRisks] Risks & Considerations missing',
            '[intSummary] Interior Summary missing',
            '[intRooms] Rooms Summary missing',
            '[schoolAnalyses] School Intelligence missing',
            '[lifestyleInsights] Lifestyle Insights missing',
            '[lifestyleFit] Lifestyle Fit Analysis missing',
            '[investmentSTR] STR Performance missing',
            '[investmentLTR] LTR Analysis missing',
            '[neighborhoodIdentity] Neighborhood Identity missing',
            '[neighborhoodNarrative] Neighborhood Narrative missing'
        ],
        warnings: [
            '[designStyle] AI Visual — Design Style missing',
            '[conditionFinish] AI Visual — Condition & Finish missing',
            '[curbAppeal] AI Visual — Curb Appeal missing',
            '[backyardPatio] AI Visual — Backyard/Patio missing',
            '[streetViewAi] Street View AI missing',
            '[communityPulse] Community Pulse missing',
            '[livingWage] MIT Living Wage Data missing',
            '[customAnalysis] Custom AI Analysis missing',
            '[intVibe] Interior Vibe missing',
            '[intTags] Interior Tags missing',
            '[contextGraph] AI Context Graph missing'
        ]
    },
    {
        zpid: '250133982',
        address: '5806 Huntley Ave, Dublin, CA 94568',
        status: 'failed',
        errors: [
            '[aiVisualInterior] AI Visual — Interior missing',
            '[aiVisualExterior] AI Visual — Exterior missing',
            '[privacyVisual] AI Visual — Privacy missing',
            '[compSummary] Narrative Summary missing',
            '[compRisks] Risks & Considerations missing',
            '[intSummary] Interior Summary missing',
            '[intRooms] Rooms Summary missing',
            '[schoolAnalyses] School Intelligence missing',
            '[lifestyleInsights] Lifestyle Insights missing',
            '[lifestyleFit] Lifestyle Fit Analysis missing',
            '[investmentSTR] STR Performance missing',
            '[investmentLTR] LTR Analysis missing',
            '[neighborhoodNarrative] Neighborhood Narrative missing'
        ],
        warnings: [
            '[designStyle] AI Visual — Design Style missing',
            '[conditionFinish] AI Visual — Condition & Finish missing',
            '[curbAppeal] AI Visual — Curb Appeal missing',
            '[backyardPatio] AI Visual — Backyard/Patio missing',
            '[streetViewAi] Street View AI missing',
            '[communityPulse] Community Pulse missing',
            '[livingWage] MIT Living Wage Data missing',
            '[customAnalysis] Custom AI Analysis missing',
            '[intVibe] Interior Vibe missing',
            '[intTags] Interior Tags missing',
            '[contextGraph] AI Context Graph missing',
            '[resoInterior] RESO Interior/Systems missing'
        ]
    }
];

const HamiltonIngestTab: React.FC = () => {
    const [zip, setZip] = useState('94568');
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState<LogLine[]>([]);
    const [dagNodes, setDagNodes] = useState<DagNode[]>(INITIAL_DAG);
    const [properties, setProperties] = useState<PropertyStatus[]>([]);
    const [selectedProperty, setSelectedProperty] = useState<PropertyStatus | null>(null);
    const [currentExecutingNode, setCurrentExecutingNode] = useState<string | null>(null);
    const consoleEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (consoleEndRef.current) {
            consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const addLog = (message: string, level: LogLine['level'] = 'info') => {
        setLogs(prev => [...prev, {
            timestamp: new Date().toLocaleTimeString(),
            message,
            level
        }]);
    };

    const updateNodeStatus = (id: string, status: DagNode['status']) => {
        setDagNodes(prev => prev.map(n => n.id === id ? { ...n, status } : n));
    };

    const handleLaunchIngestion = async () => {
        if (!zip.trim()) return;
        setIsRunning(true);
        setLogs([]);
        setProperties([]);
        setSelectedProperty(null);
        setDagNodes(INITIAL_DAG.map(n => ({ ...n, status: 'idle' })));

        addLog(`[Driver] Building Apache Hamilton Ingestion Driver...`, 'info');
        addLog(`[Driver] Loading modules: ingestion_pipeline.py, environment_fetches.py`, 'info');

        const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

        // 1. raw_listings_feed
        updateNodeStatus('raw_listings_feed', 'running');
        setCurrentExecutingNode('raw_listings_feed');
        addLog(`[Node] Executing 'raw_listings_feed' for ZIP ${zip}...`, 'info');
        await wait(1200);
        addLog(`[API] RapidAPI Search returned 5 properties in ZIP ${zip}`, 'success');
        updateNodeStatus('raw_listings_feed', 'success');

        // 2. listings_map
        updateNodeStatus('listings_map', 'running');
        setCurrentExecutingNode('listings_map');
        addLog(`[Node] Executing 'listings_map'... indexing properties`, 'info');
        await wait(600);
        updateNodeStatus('listings_map', 'success');

        // 3. cache_status
        updateNodeStatus('cache_status', 'running');
        setCurrentExecutingNode('cache_status');
        addLog(`[Node] Executing 'cache_status'... fetching Firestore cache index`, 'info');
        await wait(1000);
        addLog(`[Cache] 2 properties found in properties collection (cached). 3 missing (uncached).`, 'warn');
        updateNodeStatus('cache_status', 'success');

        // 4. uncached_zpid
        updateNodeStatus('uncached_zpid', 'running');
        setCurrentExecutingNode('uncached_zpid');
        addLog(`[Node] Executing 'uncached_zpid'... scattering 3 uncached properties`, 'info');
        await wait(800);
        updateNodeStatus('uncached_zpid', 'success');

        // 5. coords
        updateNodeStatus('coords', 'running');
        setCurrentExecutingNode('coords');
        addLog(`[Node] Executing 'coords'... resolving geospatial centroids`, 'info');
        await wait(700);
        updateNodeStatus('coords', 'success');

        // Parallel Ingestion: walk_score, google_solar, fema_nri
        updateNodeStatus('walk_score', 'running');
        updateNodeStatus('google_solar', 'running');
        updateNodeStatus('fema_nri', 'running');
        setCurrentExecutingNode('walk_score, google_solar, fema_nri');
        addLog(`[Hamilton] Orchestrating parallel API execution path for 3 uncached properties...`, 'info');
        
        addLog(`[API] Querying WalkScore coordinates matrix...`, 'info');
        await wait(800);
        addLog(`[API] Querying Google Solar buildingInsights APIs...`, 'info');
        await wait(600);
        addLog(`[API] Querying ArcGIS FEMA National Risk Index Census Tracts...`, 'info');
        await wait(900);

        addLog(`[Success] walk_score completed (3/3 coordinates)`, 'success');
        updateNodeStatus('walk_score', 'success');

        addLog(`[Success] google_solar completed (3/3 buildingInsights mapped)`, 'success');
        updateNodeStatus('google_solar', 'success');

        addLog(`[Warning] fema_nri completed with partial results (250133982 returned 404 Seismic)`, 'warn');
        updateNodeStatus('fema_nri', 'success');

        // 6. bulk_firestore_write
        updateNodeStatus('bulk_firestore_write', 'running');
        setCurrentExecutingNode('bulk_firestore_write');
        addLog(`[Node] Executing 'bulk_firestore_write'... committing batched writes`, 'info');
        await wait(1100);
        addLog(`[Database] Successfully synchronized 5 properties to properties collection`, 'success');
        updateNodeStatus('bulk_firestore_write', 'success');

        // 7. final_ingestion_summary
        updateNodeStatus('final_ingestion_summary', 'running');
        setCurrentExecutingNode('final_ingestion_summary');
        addLog(`[Node] Executing 'final_ingestion_summary'...`, 'info');
        await wait(600);
        updateNodeStatus('final_ingestion_summary', 'success');
        setCurrentExecutingNode(null);

        // Ingestion results
        addLog(`[Driver] Hamilton execution DAG finished successfully ✓`, 'success');
        setProperties(MOCK_DUBLIN_PROPERTIES);
        setIsRunning(false);
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Title / Description */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <i className="fa-solid fa-diagram-project text-indigo-500"></i> Apache Hamilton Sandbox
                    </h2>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">
                        Declarative Python Micro-Framework Dataflow Ingestion & Telemetry Simulator
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left Section: Controls & Visual DAG */}
                <div className="xl:col-span-2 space-y-8">
                    {/* Control Panel Card */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl shadow-slate-100/50">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <i className="fa-solid fa-gears text-slate-400"></i> Pipeline Control
                        </h3>
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <div className="w-full sm:w-auto flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                                <i className="fa-solid fa-location-dot text-slate-400"></i>
                                <div className="flex-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">ZIP Code Target</label>
                                    <input
                                        type="text"
                                        value={zip}
                                        onChange={e => setZip(e.target.value)}
                                        placeholder="e.g. 94568"
                                        disabled={isRunning}
                                        className="bg-transparent border-none text-slate-800 font-bold text-sm outline-none w-full mt-0.5"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleLaunchIngestion}
                                disabled={isRunning || !zip.trim()}
                                className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg ${
                                    isRunning 
                                        ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 hover:shadow-indigo-200'
                                }`}
                            >
                                {isRunning ? (
                                    <>
                                        <i className="fa-solid fa-spinner animate-spin"></i> Executing Ingestion...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-rocket"></i> Launch Ingestion
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Interactive DAG Visualizer */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl shadow-slate-100/50">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <i className="fa-solid fa-network-wired text-slate-400"></i> Apache Hamilton DAG
                            </h3>
                            {currentExecutingNode && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest animate-pulse">
                                    <i className="fa-solid fa-play"></i> Running: {currentExecutingNode}
                                </span>
                            )}
                        </div>

                        {/* Node Tree Renders */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {dagNodes.map(node => (
                                <div
                                    key={node.id}
                                    className={`p-4 rounded-2xl border transition-all duration-300 relative ${
                                        node.status === 'running'
                                            ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-400 ring-offset-2 scale-[1.02] shadow-lg shadow-amber-100/50'
                                            : node.status === 'success'
                                                ? 'bg-emerald-50/40 border-emerald-200 shadow-sm shadow-emerald-50/50'
                                                : node.status === 'error'
                                                    ? 'bg-rose-50 border-rose-300 shadow-lg shadow-rose-100/50'
                                                    : 'bg-slate-50/50 border-slate-200/80'
                                    }`}
                                >
                                    {/* Source badge */}
                                    <span className="absolute top-3 right-3 text-[7.5px] font-black uppercase tracking-widest text-slate-400">
                                        {node.source}
                                    </span>
                                    
                                    <div className="flex items-start gap-3 mt-1">
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] mt-0.5 ${
                                            node.status === 'running'
                                                ? 'bg-amber-100 text-amber-600 animate-spin'
                                                : node.status === 'success'
                                                    ? 'bg-emerald-100 text-emerald-600'
                                                    : node.status === 'error'
                                                        ? 'bg-rose-100 text-rose-600'
                                                        : 'bg-slate-200/80 text-slate-400'
                                        }`}>
                                            {node.status === 'running' ? (
                                                <i className="fa-solid fa-circle-notch"></i>
                                            ) : node.status === 'success' ? (
                                                <i className="fa-solid fa-check"></i>
                                            ) : node.status === 'error' ? (
                                                <i className="fa-solid fa-xmark"></i>
                                            ) : (
                                                <i className="fa-solid fa-circle text-[6px]"></i>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-[11px] font-black text-slate-800 leading-none">{node.label}</h4>
                                            <p className="text-[9.5px] text-slate-400 leading-tight mt-1.5 font-medium">{node.description}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Section: Logs Console & Property Breakdown */}
                <div className="space-y-8">
                    {/* Streaming Logging Console */}
                    <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl shadow-slate-900/40 text-slate-100 flex flex-col h-[320px]">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <i className="fa-solid fa-terminal text-indigo-400"></i> Execution Logs
                        </h3>
                        <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 pr-2 custom-scrollbar">
                            {logs.length === 0 ? (
                                <div className="text-slate-600 italic">Logs will stream here upon launching the Hamilton DAG...</div>
                            ) : (
                                logs.map((log, index) => (
                                    <div key={index} className="flex gap-2 leading-relaxed">
                                        <span className="text-slate-500 font-bold">[{log.timestamp}]</span>
                                        <span className={
                                            log.level === 'success'
                                                ? 'text-emerald-400 font-bold'
                                                : log.level === 'warn'
                                                    ? 'text-amber-400 font-bold'
                                                    : log.level === 'error'
                                                        ? 'text-rose-400 font-bold'
                                                        : 'text-indigo-200'
                                        }>
                                            {log.message}
                                        </span>
                                    </div>
                                ))
                            )}
                            <div ref={consoleEndRef} />
                        </div>
                    </div>

                    {/* Property Telemetry Breakdown (ZPID and Function failures) */}
                    {properties.length > 0 && (
                        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl shadow-slate-100/50 max-h-[500px] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-6">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <i className="fa-solid fa-list-check text-slate-400"></i> Property Status Details
                            </h3>
                            <div className="space-y-3">
                                {properties.map(prop => (
                                    <div key={prop.zpid} className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                        <button
                                            onClick={() => setSelectedProperty(selectedProperty?.zpid === prop.zpid ? null : prop)}
                                            className="w-full flex items-center justify-between p-3.5 bg-slate-50/50 hover:bg-slate-50 transition-all text-left"
                                        >
                                            <div>
                                                <h4 className="text-[11px] font-black text-slate-800 leading-tight">{prop.address}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[8px] font-black text-slate-400 font-mono">ZPID: {prop.zpid}</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                                    <span className={`text-[8.5px] font-black uppercase tracking-widest ${
                                                        prop.status === 'success'
                                                            ? 'text-emerald-500'
                                                            : prop.status === 'partial'
                                                                ? 'text-amber-500'
                                                                : 'text-rose-500'
                                                    }`}>
                                                        {prop.status === 'success' ? 'Fully Clean ✓' : `${prop.errors.length} errors · ${prop.warnings.length} warnings`}
                                                    </span>
                                                </div>
                                            </div>
                                            <i className={`fa-solid fa-chevron-down text-slate-300 text-xs transition-transform ${selectedProperty?.zpid === prop.zpid ? 'rotate-180' : ''}`}></i>
                                        </button>

                                        {selectedProperty?.zpid === prop.zpid && (
                                            <div className="p-4 bg-white space-y-3 border-t border-slate-100 animate-in slide-in-from-top-2">
                                                {/* Errors */}
                                                {prop.errors.length > 0 && (
                                                    <div>
                                                        <div className="text-[8.5px] font-black text-rose-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                            <i className="fa-solid fa-circle-xmark"></i> Node Failures (Errors)
                                                        </div>
                                                        <div className="space-y-1">
                                                            {prop.errors.map((err, i) => (
                                                                <div key={i} className="px-2.5 py-1.5 bg-rose-50/40 border border-rose-100 rounded-lg text-[9px] text-rose-700 font-medium">
                                                                    {err}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Warnings */}
                                                {prop.warnings.length > 0 && (
                                                    <div>
                                                        <div className="text-[8.5px] font-black text-amber-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                            <i className="fa-solid fa-triangle-exclamation"></i> Telemetry Warnings
                                                        </div>
                                                        <div className="space-y-1">
                                                            {prop.warnings.map((warn, i) => (
                                                                <div key={i} className="px-2.5 py-1.5 bg-amber-50/40 border border-amber-100 rounded-lg text-[9px] text-amber-700 font-medium">
                                                                    {warn}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HamiltonIngestTab;
