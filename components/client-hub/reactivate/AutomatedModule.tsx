import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { analyzeLeadDatabase, transformLeadCsv } from '../../../services/geminiService';
import { uploadLeadCSV, getLeadDocuments, getLeadDocumentContent } from '../../../services/firebase/leads_documents';
import {
    saveReactivationAnalysis,
    getExistingReactivationAnalysis,
    getUserReactivationSummaries,
    getAllUserLeadPlans,
    getAllUserMarketContexts
} from '../../../services/firebase/reactivation';
import { LeadReactivationResult, LeadDocument, Lead, LeadPlanRecord, ReactivationAnalysisSummary } from '../../../types';
import { getTimeSince } from './shared';
import ReactivationVisualizer from './ReactivationVisualizer';
import ClientDetailsView from '../ClientDetailsView';
import { LeadReactivationList } from './components/LeadReactivationList';

interface AutomatedModuleProps {
    realtorId: string;
    leads?: Lead[];
    onOpenLeadDetails?: (leadId: string) => void;
    onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void;
}

const AutomatedModule: React.FC<AutomatedModuleProps> = ({ realtorId, leads = [], onOpenLeadDetails, onUpdateLead }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [csvPreview, setCsvPreview] = useState<string[][]>([]);
    const [selectedDocName, setSelectedDocName] = useState<string | null>(null);
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [result, setResult] = useState<LeadReactivationResult | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<'GENERATE' | 'PLANS'>('GENERATE');
    const [aggregatedData, setAggregatedData] = useState<LeadReactivationResult | null>(null);
    const [loadingAggregated, setLoadingAggregated] = useState(false);
    const [recentDocuments, setRecentDocuments] = useState<LeadDocument[]>([]);
    const [selectedMarketName, setSelectedMarketName] = useState<string | null>(null);
    const [transformedCsv, setTransformedCsv] = useState<string | null>(null);
    const [isTransforming, setIsTransforming] = useState(false);
    const [localLeads, setLocalLeads] = useState<Lead[]>(leads);
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
    const [statusMenuOpen, setStatusMenuOpen] = useState<string | null>(null);
    const [selectedLeadForDetails, setSelectedLeadForDetails] = useState<Lead | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCityTab, setActiveCityTab] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'lastSeen', direction: 'desc' });
    const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
    const [actionMenuPosition, setActionMenuPosition] = useState<{ top: number; left: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLocalLeads(leads);
    }, [leads]);

    const eligibleLeads = (localLeads || []).filter(l => l.funnelStage === 'Archived');

    const getCity = (l: Lead) => {
        const loc = l.searchCriteria?.locations;
        return loc ? loc.split(',')[0].trim() : 'Unknown';
    };
    const allCities = Array.from(new Set(eligibleLeads.map(l => getCity(l)))).filter(Boolean).sort();
    const visibleCities = allCities.slice(0, 4);
    const hiddenCities = allCities.slice(4);

    const archivedLeads = eligibleLeads
        .filter(l => {
            const matchesSearch = !searchTerm || (
                l.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                l.primaryContact?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                l.searchCriteria?.locations?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            const matchesCity = activeCityTab === 'All' || getCity(l) === activeCityTab;
            return matchesSearch && matchesCity;
        })
        .sort((a, b) => {
            let valA: any, valB: any;

            switch (sortConfig.key) {
                case 'name':
                    valA = a.fullName?.toLowerCase() || '';
                    valB = b.fullName?.toLowerCase() || '';
                    break;
                case 'type':
                    valA = a.leadType || '';
                    valB = b.leadType || '';
                    break;
                case 'market':
                    valA = a.searchCriteria?.locations?.toLowerCase() || '';
                    valB = b.searchCriteria?.locations?.toLowerCase() || '';
                    break;
                case 'source':
                    valA = a.source?.toLowerCase() || '';
                    valB = b.source?.toLowerCase() || '';
                    break;
                case 'status':
                    valA = a.engagementScore || a.health || '';
                    valB = b.engagementScore || b.health || '';
                    break;
                case 'lastSeen':
                default:
                    const getT = (l: any) => {
                        const d = l.lastActivity || l.receivedAt || l.lastUpdated || 0;
                        return new Date(d?.seconds ? d.seconds * 1000 : d).getTime();
                    };
                    valA = getT(a);
                    valB = getT(b);
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

    const pageSize = 25;
    const totalPages = Math.ceil(archivedLeads.length / pageSize);
    const paginatedLeads = archivedLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handleOpenActionMenu = (e: React.MouseEvent, leadId: string) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const menuWidth = 180;
        setActionMenuPosition({
            top: rect.bottom + 8,
            left: rect.right - menuWidth + 8
        });
        setOpenActionMenuId(openActionMenuId === leadId ? null : leadId);
    };

    useEffect(() => {
        const loadDocs = async () => {
            const docs = await getLeadDocuments(realtorId);
            setRecentDocuments(docs);
        };
        loadDocs();
    }, [realtorId]);

    useEffect(() => {
        const loadAggregatedData = async () => {
            if (activeSubTab !== 'PLANS') return;
            setLoadingAggregated(true);
            try {
                const [summaries, allPlans, allMarkets] = await Promise.all([
                    getUserReactivationSummaries(realtorId),
                    getAllUserLeadPlans(realtorId),
                    getAllUserMarketContexts(realtorId)
                ]);

                if (summaries.length === 0) {
                    setAggregatedData(null);
                    setLoadingAggregated(false);
                    return;
                }

                const sortedSummaries = [...summaries].sort((a, b) => {
                    const timeA = (a.created_date as any)?.seconds || 0;
                    const timeB = (b.created_date as any)?.seconds || 0;
                    return timeB - timeA;
                });

                const sortedPlans = [...allPlans].sort((a, b) => b.priority_score - a.priority_score);

                const totalLeads = sortedSummaries.reduce((acc, s) => acc + (s.summary?.total_leads || 0), 0);
                const highPriority = sortedPlans.filter(p => p.priority_score > 0.8).length;

                const marketMap = new Map<string, any>();
                allMarkets.forEach(m => {
                    if (!marketMap.has(m.market_name)) {
                        marketMap.set(m.market_name, {
                            market_name: m.market_name,
                            rates_trend: m.rates_trend,
                            inventory_trend: m.inventory_trend,
                            avg_days_on_market: m.avg_days_on_market,
                            buyer_leverage_notes: m.buyer_leverage_notes,
                            confidence: m.confidence
                        });
                    }
                });

                const latestRun = sortedSummaries[0];

                const result: LeadReactivationResult = {
                    summary: {
                        total_leads: totalLeads,
                        markets_detected: marketMap.size,
                        high_priority: highPriority,
                        primary_strategy: "Aggregated Portfolio Strategy",
                        recommended_daily_volume: latestRun.summary?.recommended_daily_volume || 0
                    },
                    global_settings: latestRun.global_settings,
                    market_context: Array.from(marketMap.values()),
                    lead_plans: sortedPlans
                };

                setAggregatedData(result);
            } catch (error) {
                console.error('Error loading aggregated data:', error);
            } finally {
                setLoadingAggregated(false);
            }
        };

        loadAggregatedData();
    }, [realtorId, activeSubTab]);

    useEffect(() => {
        if (result && result.market_context.length > 0) {
            setSelectedMarketName(result.market_context[0].market_name);
        }
    }, [result]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const validateAndProcessCSV = (text: string): string[][] | null => {
        setValidationError(null);
        const rows: string[][] = [];
        const lines = text.split(/\r?\n/).filter(line => line.trim());

        if (lines.length === 0) {
            setValidationError("The file appears to be empty.");
            return null;
        }

        for (const line of lines) {
            const values: string[] = [];
            let value = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];

                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        value += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    values.push(normalizeValue(value));
                    value = '';
                } else {
                    value += char;
                }
            }
            values.push(normalizeValue(value));
            rows.push(values);
        }

        if (rows.length === 0) return null;

        const headers = rows[0];
        const EnglishHeaderRegex = /^[a-zA-Z0-9_\s]{2,50}$/;
        for (const header of headers) {
            if (!EnglishHeaderRegex.test(header) || header.toLowerCase() === 'null') {
                setValidationError(`Invalid or non-descriptive header detected: "${header}". Headers should be descriptive English.`);
                return null;
            }
        }

        const sensitivePatterns = [
            /(password|passwd|secret|apikey|api_key|token)/i,
            /AIza[0-9A-Za-z-_]{35}/,
            /sk_(live|test)_[0-9a-zA-Z]{24}/,
            /[0-9a-f]{32}/i
        ];

        for (const row of rows) {
            for (const cell of row) {
                for (const pattern of sensitivePatterns) {
                    if (pattern.test(cell)) {
                        setValidationError("Security Alert: We detected potentially sensitive data (password, API key, or token) in your file. Please remove it before uploading.");
                        return null;
                    }
                }
            }
        }

        return rows;
    };

    const normalizeValue = (val: string): string => {
        let processed = val.replace(/\|/g, '-');
        processed = processed.trim();
        processed = processed.replace(/[\r\n]+/g, ' ');
        return processed === '' ? 'NULL' : processed;
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            processFile(droppedFile);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            processFile(selectedFile);
        }
    };

    const processFile = async (selectedFile: File) => {
        setFile(selectedFile);
        setValidationError(null);
        setSelectedDocName(selectedFile.name);
        try {
            const text = await selectedFile.text();
            const processedRows = validateAndProcessCSV(text);
            if (processedRows) {
                setCsvPreview(processedRows);
                const outputContent = processedRows.map(row => row.join('|')).join('\n');
                setFileContent(outputContent);

                setUploadStatus('uploading');
                const uploadedDoc = await uploadLeadCSV(realtorId, selectedFile);
                if (uploadedDoc) {
                    setSelectedDocId(uploadedDoc.id);
                    setRecentDocuments(prev => [uploadedDoc, ...prev]);
                    setUploadStatus('idle');
                } else {
                    setUploadStatus('error');
                }
            } else {
                setFile(null);
                setFileContent(null);
                setCsvPreview([]);
            }
        } catch (err) {
            setValidationError("Failed to read file. Please ensure it is a valid UTF-8 encoded CSV.");
        }
    };

    const parseForPreview = (text: string) => {
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        const rows = lines.map(line => {
            if (line.includes('|')) {
                return line.split('|');
            }
            const values: string[] = [];
            let value = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    values.push(value.trim());
                    value = '';
                } else value += char;
            }
            values.push(value.trim());
            return values;
        });
        setCsvPreview(rows);
    };

    const handleUpload = async () => {
        if (!fileContent || !selectedDocId) return;
        setUploadStatus('uploading');

        try {
            const existing = await getExistingReactivationAnalysis(selectedDocId, realtorId);
            if (existing) {
                setResult(existing);
                setUploadStatus('success');
                return;
            }

            const { result: analysis, llmCallId } = await analyzeLeadDatabase(fileContent, realtorId);

            await saveReactivationAnalysis(
                realtorId,
                realtorId,
                selectedDocId,
                llmCallId || "gen_ui_" + Date.now(),
                analysis
            );

            setResult(analysis);
            setUploadStatus('success');
        } catch (error) {
            console.error('Failed to process database:', error);
            setUploadStatus('error');
        }
    };

    const handleTransform = async () => {
        if (!fileContent) return;
        setIsTransforming(true);
        setValidationError(null);

        try {
            const transformed = await transformLeadCsv(fileContent, realtorId);
            setTransformedCsv(transformed);
        } catch (error: any) {
            console.error('Failed to transform CSV:', error);
            setValidationError("Failed to transform CSV. " + (error.message || ""));
        } finally {
            setIsTransforming(false);
        }
    };

    const downloadTransformedCsv = () => {
        if (!transformedCsv) return;
        const blob = new Blob([transformedCsv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transformed_${selectedDocName || 'leads'}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const handleSelectPreviousDoc = async (doc: LeadDocument) => {
        setUploadStatus('uploading');
        setSelectedDocName(doc.name);
        setSelectedDocId(doc.id);

        try {
            const content = await getLeadDocumentContent(doc.storage_path);
            if (!content) throw new Error("Could not retrieve file content");

            setFileContent(content);
            parseForPreview(content);
            setFile(null);
            setUploadStatus('idle');
        } catch (error) {
            console.error('Failed to process archived database:', error);
            setUploadStatus('error');
        }
    };

    const toggleLeadSelection = (leadId: string) => {
        setSelectedLeadIds(prev =>
            prev.includes(leadId)
                ? prev.filter(id => id !== leadId)
                : [...prev, leadId]
        );
    };

    const updateLeadStatus = (leadId: string, newStatus: string) => {
        setLocalLeads(prev => prev.map(l => {
            if (l.id === leadId) {
                return {
                    ...l,
                    engagementScore: newStatus === 'Hot' ? 'Hot' : (newStatus === 'Cold' ? 'Cold' : 'None'),
                    health: newStatus === 'Stale' ? 'Stale' : 'Healthy'
                };
            }
            return l;
        }));
        setStatusMenuOpen(null);
    };


    const handleAnalyzeSelectedLeads = async () => {
        if (selectedLeadIds.length === 0) return;

        setUploadStatus('uploading');
        try {
            const selectedLeads = archivedLeads.filter(l => selectedLeadIds.includes(l.id));

            const headers = ['lead_id', 'name', 'phone', 'email', 'market', 'budget', 'lead_source', 'last_activity', 'notes'];
            const rows = selectedLeads.map(l => [
                l.id,
                l.fullName,
                l.primaryContact?.phone || 'NULL',
                l.primaryContact?.email || 'NULL',
                l.searchCriteria?.locations || 'NULL',
                l.financialVitals?.budgetMax?.toString() || 'NULL',
                l.source || 'NULL',
                l.lastActivity ? new Date(l.lastActivity).toLocaleDateString() : 'NULL',
                (l.leadInfo?.customerMessage || '').replace(/\n/g, ' ') || 'NULL'
            ]);

            const content = [headers.join('|'), ...rows.map(r => r.join('|'))].join('\n');
            const docId = 'database_selection_' + Date.now();

            setSelectedDocName(`${selectedLeadIds.length} Selected Leads`);
            setSelectedDocId(docId);

            const { result: analysis, llmCallId } = await analyzeLeadDatabase(content, realtorId);

            await saveReactivationAnalysis(
                realtorId,
                realtorId,
                docId,
                llmCallId || "gen_ui_" + Date.now(),
                analysis
            );

            setResult(analysis);
            setUploadStatus('success');
        } catch (error) {
            console.error('Failed to process database selection:', error);
            setUploadStatus('error');
        }
    };

    const reset = () => {
        setFile(null);
        setFileContent(null);
        setCsvPreview([]);
        setSelectedDocName(null);
        setSelectedDocId(null);
        setResult(null);
        setUploadStatus('idle');
        setValidationError(null);
        setSelectedLeadIds([]);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Sub Tab Navigation */}
            <div className="flex items-center gap-8 border-b border-slate-200">
                <button
                    onClick={() => setActiveSubTab('GENERATE')}
                    className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeSubTab === 'GENERATE' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    AI Analysis
                    {activeSubTab === 'GENERATE' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full"></div>}
                </button>
                <button
                    onClick={() => setActiveSubTab('PLANS')}
                    className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeSubTab === 'PLANS' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Action Plans
                    {activeSubTab === 'PLANS' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full"></div>}
                </button>
            </div>

            {activeSubTab === 'GENERATE' ? (
                <>
                    {result ? (
                        <ReactivationVisualizer
                            result={result}
                            onReset={reset}
                            title={selectedDocName || 'Lead Analysis'}
                            agentId={realtorId}
                            onOpenLeadDetails={(leadId) => {
                                const lead = leads.find(l => l.id === leadId) || localLeads.find(l => l.id === leadId);
                                if (lead) setSelectedLeadForDetails(lead);
                            }}
                        />
                    ) : (
                        <div className={`bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-xl shadow-indigo-500/5 ${!fileContent ? 'p-0' : 'p-12'}`}>
                            <div className="w-full text-center space-y-0">

                                {/* Lead Database Selection Section (Default Landing) */}
                                {!fileContent && !uploadStatus.includes('uploading') && (
                                    <div className="animate-in fade-in slide-in-from-top-4 duration-700">
                                        <div className="animate-in fade-in zoom-in-95 duration-500 text-left">
                                            <div className="bg-white overflow-hidden">
                                                {/* Dashboard Header with Search Only */}
                                                {/* City Tabs & Search Combined Header */}
                                                <div className="px-8 py-5 border-b border-slate-50 flex items-center justify-between bg-white gap-4">
                                                    <div className="flex items-center gap-6 flex-1 overflow-x-auto no-scrollbar">
                                                        {/* City Tabs */}
                                                        <div className="flex items-center gap-2 p-1.5 bg-slate-100/50 rounded-2xl w-fit shrink-0">
                                                            <button
                                                                onClick={() => setActiveCityTab('All')}
                                                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeCityTab === 'All' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                            >
                                                                All
                                                                <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[8px] ${activeCityTab === 'All' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                                                                    {eligibleLeads.length}
                                                                </span>
                                                            </button>
                                                            {visibleCities.map(c => (
                                                                <button
                                                                    key={c}
                                                                    onClick={() => setActiveCityTab(c)}
                                                                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeCityTab === c ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                                >
                                                                    {c}
                                                                    <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[8px] ${activeCityTab === c ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                                                                        {eligibleLeads.filter(l => getCity(l) === c).length}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                            {hiddenCities.length > 0 && (
                                                                <div className="relative group/others flex items-center">
                                                                    <button
                                                                        className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${hiddenCities.includes(activeCityTab) ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                                    >
                                                                        More <i className="fa-solid fa-chevron-down text-[8px]"></i>
                                                                    </button>
                                                                    <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 min-w-[150px] z-50 opacity-0 invisible group-hover/others:opacity-100 group-hover/others:visible transition-all transform origin-top-right">
                                                                        {hiddenCities.map(c => (
                                                                            <button
                                                                                key={c}
                                                                                onClick={() => setActiveCityTab(c)}
                                                                                className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-between ${activeCityTab === c ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                                                                            >
                                                                                {c}
                                                                                <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${activeCityTab === c ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                                                                    {eligibleLeads.filter(l => getCity(l) === c).length}
                                                                                </span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Search Input */}
                                                        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50/80 rounded-2xl border border-slate-100 w-[280px] focus-within:bg-white focus-within:border-indigo-200 transition-all shrink-0">
                                                            <i className="fa-solid fa-magnifying-glass text-slate-300"></i>
                                                            <input
                                                                type="text"
                                                                placeholder="Search across all fields..."
                                                                className="bg-transparent border-none outline-none w-full text-slate-700 placeholder:text-slate-400 font-bold text-xs"
                                                                value={searchTerm}
                                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="ml-auto flex items-center gap-4 shrink-0">
                                                        {selectedLeadIds.length > 0 && (
                                                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                                                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm border border-indigo-100">
                                                                    {selectedLeadIds.length} Selected
                                                                </span>
                                                                <div className="h-4 w-px bg-slate-100 mx-1"></div>
                                                                <button
                                                                    onClick={() => setSelectedLeadIds(archivedLeads.map(l => l.id))}
                                                                    className="text-[9px] font-black text-slate-500 hover:text-indigo-600 uppercase tracking-widest transition-colors px-2"
                                                                >
                                                                    Select All
                                                                </button>
                                                                <button
                                                                    onClick={() => setSelectedLeadIds([])}
                                                                    className="text-[9px] font-black text-rose-400 hover:text-rose-600 uppercase tracking-widest transition-colors px-2"
                                                                >
                                                                    Clear
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <LeadReactivationList
                                                    leads={paginatedLeads}
                                                    selectedLeads={selectedLeadIds}
                                                    onToggleSelection={toggleLeadSelection}
                                                    onToggleAll={() => setSelectedLeadIds(selectedLeadIds.length === archivedLeads.length ? [] : archivedLeads.map(l => l.id))}
                                                    onLeadClick={setSelectedLeadForDetails}
                                                    onStatusChange={updateLeadStatus}
                                                    pagination={{
                                                        currentPage,
                                                        totalPages,
                                                        onPageChange: setCurrentPage
                                                    }}
                                                    sortConfig={sortConfig}
                                                    onSort={handleSort}
                                                    actionHeaderLabel=""
                                                    maxHeight="600px"
                                                    variant="flat"
                                                    mode="action"
                                                    renderActionColumn={(lead) => (
                                                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={(e) => handleOpenActionMenu(e, lead.id)}
                                                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${openActionMenuId === lead.id ? 'bg-indigo-600 text-white shadow-md scale-110' : 'bg-white border border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600'}`}
                                                            >
                                                                <i className="fa-solid fa-ellipsis-vertical text-xs"></i>
                                                            </button>

                                                            {openActionMenuId === lead.id && actionMenuPosition && typeof document !== 'undefined' && createPortal(
                                                                <>
                                                                    <div className="fixed inset-0 z-[100]" onClick={() => setOpenActionMenuId(null)} />
                                                                    <div
                                                                        className="fixed z-[101] bg-white rounded-xl shadow-2xl border border-slate-100 p-2 min-w-[180px] animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-1"
                                                                        style={{ top: actionMenuPosition.top, left: actionMenuPosition.left }}
                                                                    >
                                                                        <div className="px-3 py-2 border-b border-slate-50 mb-1 flex items-center justify-between">
                                                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Actions</p>
                                                                            <i className="fa-solid fa-bolt text-[10px] text-indigo-400"></i>
                                                                        </div>
                                                                        {[
                                                                            { id: 'email', icon: 'fa-envelope', label: 'Send Email', color: 'text-indigo-500', bg: 'hover:bg-indigo-50' },
                                                                            { id: 'call', icon: 'fa-phone', label: 'Log Call', color: 'text-emerald-500', bg: 'hover:bg-emerald-50' },
                                                                            { id: 'sms', icon: 'fa-comment', label: 'Send SMS', color: 'text-blue-500', bg: 'hover:bg-blue-50' },
                                                                            { id: 'whatsapp', icon: 'fa-brands fa-whatsapp', label: 'WhatsApp', color: 'text-green-500', bg: 'hover:bg-green-50' },
                                                                            { id: 'mail', icon: 'fa-paper-plane', label: 'Direct Mail', color: 'text-purple-500', bg: 'hover:bg-purple-50' }
                                                                        ].map(action => (
                                                                            <button
                                                                                key={action.id}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    // Handle action - for now just close menu
                                                                                    // In the future, this could open an outreach modal for this lead
                                                                                    console.log('Action:', action.id, 'for lead:', lead.id);
                                                                                    setOpenActionMenuId(null);
                                                                                }}
                                                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-slate-600 transition-colors ${action.bg} text-left group`}
                                                                            >
                                                                                <div className={`w-6 h-6 rounded-md bg-white border border-slate-100 flex items-center justify-center group-hover:border-transparent ${action.color}`}>
                                                                                    <i className={`fa-solid ${action.icon} text-[10px]`}></i>
                                                                                </div>
                                                                                {action.label}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </>,
                                                                document.body
                                                            )}
                                                        </div>
                                                    )}
                                                />

                                            </div>
                                            <div className="flex justify-center p-8">
                                                <button
                                                    onClick={handleAnalyzeSelectedLeads}
                                                    disabled={selectedLeadIds.length === 0}
                                                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black py-6 px-10 rounded-[2rem] shadow-2xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-4 active:scale-[0.98] text-sm uppercase tracking-widest"
                                                >
                                                    <i className="fa-solid fa-wand-sparkles text-lg"></i>
                                                    Generate High-Intent Analysis for {selectedLeadIds.length} Selected Leads
                                                </button>
                                            </div>
                                        </div>

                                        <div className="relative pt-4 pb-0 mt-4 mb-4 mx-12">
                                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                                <div className="w-full border-t border-slate-100"></div>
                                            </div>
                                            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
                                                <span className="bg-white px-8 text-slate-300">OR UPLOAD EXTERNAL CSV</span>
                                            </div>
                                        </div>

                                        <div
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`relative border-2 border-dashed rounded-[2.5rem] p-16 transition-all cursor-pointer group mx-12 mb-12 ${isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'}`}
                                        >
                                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".csv" />
                                            <div className="space-y-6">
                                                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto transition-all group-hover:scale-110 group-hover:text-indigo-600 group-hover:bg-indigo-50 shadow-inner">
                                                    <i className="fa-solid fa-cloud-arrow-up text-2xl"></i>
                                                </div>
                                                {validationError ? (
                                                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                                                        <p className="text-sm font-bold text-rose-500 bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 italic">{validationError}</p>
                                                    </div>
                                                ) : file ? (
                                                    <div className="space-y-2 animate-in zoom-in-95 duration-300">
                                                        <p className="text-lg font-black text-indigo-600">{file.name}</p>
                                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{(file.size / 1024).toFixed(1)} KB • CSV Ready</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <p className="text-xs text-slate-400 font-medium">Click to browse or drag & drop external CSV</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Preview Section */}
                                {fileContent && uploadStatus === 'idle' && (
                                    <div className="space-y-10 animate-in fade-in zoom-in-95 duration-500 p-12">
                                        <div className="bg-slate-50/50 rounded-3xl border border-slate-200 overflow-hidden">
                                            <div className="max-h-[400px] overflow-y-auto overflow-x-auto custom-scrollbar">
                                                <table className="w-full text-left border-collapse">
                                                    <thead className="sticky top-0 z-20">
                                                        <tr className="bg-slate-50 shadow-sm">
                                                            {csvPreview[0]?.map((header, i) => (
                                                                <th key={i} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 whitespace-nowrap bg-slate-50">{header}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {csvPreview.slice(1).map((row, rIdx) => (
                                                            <tr key={rIdx} className="hover:bg-white transition-colors group">
                                                                {row.map((cell, cIdx) => (
                                                                    <td key={cIdx} className="px-6 py-4 text-xs font-medium text-slate-600 border-b border-slate-50 whitespace-nowrap">{cell}</td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <button onClick={handleUpload} className="bg-slate-900 hover:bg-black text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3">
                                                    <i className="fa-solid fa-brain"></i> Execute Planning
                                                </button>
                                                <button onClick={handleTransform} disabled={isTransforming} className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 font-black py-5 rounded-2xl flex items-center justify-center gap-3">
                                                    <i className="fa-solid fa-wand-magic-sparkles"></i> {isTransforming ? 'Transforming...' : 'Schema Map'}
                                                </button>
                                            </div>
                                            <button onClick={reset} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors">Cancel</button>
                                        </div>
                                    </div>
                                )}

                                {/* Transformed CSV Success */}
                                {transformedCsv && (
                                    <div className="mt-10 p-8 bg-emerald-50 border border-emerald-100 rounded-[2rem] space-y-6 mx-12 mb-12 animate-in zoom-in-95 duration-500">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center"><i className="fa-solid fa-check"></i></div>
                                                <p className="text-sm font-black text-emerald-900 uppercase tracking-tight">Transformation Complete</p>
                                            </div>
                                            <button onClick={downloadTransformedCsv} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all"><i className="fa-solid fa-download"></i> Download CSV</button>
                                        </div>
                                        <div className="bg-white rounded-2xl border border-emerald-100 overflow-hidden">
                                            <pre className="p-6 text-[10px] font-mono text-slate-600 overflow-x-auto text-left max-h-[200px]">{transformedCsv}</pre>
                                        </div>
                                    </div>
                                )}

                                {/* Loader */}
                                {uploadStatus === 'uploading' && (
                                    <div className="w-full bg-indigo-50/50 border border-indigo-100 rounded-3xl p-16 flex flex-col items-center justify-center gap-4">
                                        <div className="relative">
                                            <div className="w-12 h-12 border-4 border-indigo-100 rounded-full"></div>
                                            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                                        </div>
                                        <p className="text-indigo-600 font-black uppercase tracking-widest text-xs">Architecting Lead Reactivation Plan</p>
                                    </div>
                                )}

                                {/* Features Footer */}
                                <div className="grid grid-cols-3 gap-8 pt-10 border-t border-slate-100 mt-12 px-12 pb-12">
                                    {[{ icon: 'fa-earth-americas', label: 'Multi-Market' }, { icon: 'fa-shield-check', label: 'Compliance' }, { icon: 'fa-chart-network', label: 'Event Tracks' }].map((item, i) => (
                                        <div key={i} className="text-center space-y-3">
                                            <i className={`fa-solid ${item.icon} text-lg text-slate-400`}></i>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recent Uploads Section */}
                    {
                        recentDocuments.length > 0 && uploadStatus === 'idle' && !result && (
                            <div className="mt-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Previously Uploaded Leads</h3>
                                    <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent mx-8"></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {recentDocuments.slice(0, 3).map((doc) => (
                                        <div key={doc.id} onClick={() => handleSelectPreviousDoc(doc)} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all cursor-pointer active:scale-95 flex items-center justify-between group">
                                            <div className="flex items-center gap-5">
                                                <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 shadow-sm"><i className="fa-solid fa-file-csv text-lg"></i></div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-slate-900 truncate pr-4">{doc.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{getTimeSince(doc.created_at)}</p>
                                                </div>
                                            </div>
                                            <div className="text-[10px] font-black text-slate-300 uppercase tracking-tighter shrink-0">{(doc.size / 1024).toFixed(0)} KB</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    }

                    {/* Editable Profile Drawer */}
                    {selectedLeadForDetails && typeof document !== 'undefined' && createPortal(
                        <div className="fixed inset-0 z-[100] flex justify-end">
                            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedLeadForDetails(null)} />
                            <div className="relative w-full max-w-6xl h-full p-8 flex flex-col pointer-events-none justify-center">
                                <div className="bg-white h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden pointer-events-auto flex flex-col animate-in slide-in-from-right duration-500 relative">
                                    <ClientDetailsView
                                        realtorId={realtorId}
                                        clients={[]}
                                        leads={localLeads}
                                        onUpdateClient={async (id: string, updates: any, collectionName: string) => {
                                            /* Update local state immediately */
                                            setLocalLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));

                                            /* Propagate to parent if available */
                                            if (onUpdateLead) {
                                                onUpdateLead(id, updates);
                                            }
                                            return true;
                                        }}
                                        initialSelectedId={selectedLeadForDetails.id}
                                        hideClientList={true}
                                    />
                                    <button
                                        onClick={() => setSelectedLeadForDetails(null)}
                                        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors shadow-lg z-10"
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                </>
            ) : (
                <div className="space-y-6">
                    {loadingAggregated ? (
                        <div className="w-full h-96 flex items-center justify-center">
                            <div className="relative">
                                <div className="w-12 h-12 border-4 border-indigo-100 rounded-full"></div>
                                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                            </div>
                        </div>
                    ) : aggregatedData && aggregatedData.lead_plans.length > 0 ? (
                        <ReactivationVisualizer
                            result={aggregatedData}
                            showReset={false}
                            title="Portfolio Reactivation Dashboard"
                            agentId={realtorId}
                            onOpenLeadDetails={(leadId) => {
                                const lead = leads.find(l => l.id === leadId) || localLeads.find(l => l.id === leadId);
                                if (lead) setSelectedLeadForDetails(lead);
                            }}
                        />
                    ) : (
                        <div className="text-center py-32 bg-white rounded-[2.5rem] border border-slate-100">
                            <div className="space-y-4 max-w-xl mx-auto px-8">
                                <div className="relative mx-auto w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 mb-6">
                                    <i className="fa-solid fa-folder-open text-3xl text-slate-300"></i>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">No Active Plans Found</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    You haven't generated any reactivation plans yet. Head over to the "AI Analysis" tab to get started with your lead database.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AutomatedModule;
