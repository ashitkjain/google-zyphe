import React, { useState, useRef, useEffect } from 'react';
import { analyzeLeadDatabase } from '../../../services/geminiService';
import { uploadLeadCSV, getLeadDocuments, getLeadDocumentContent } from '../../../services/firebase/leads_documents';
import { LeadReactivationResult, LeadDocument } from '../../../types';
import { getTimeSince } from './shared';

interface AutomatedModuleProps {
    realtorId: string;
}

const AutomatedModule: React.FC<AutomatedModuleProps> = ({ realtorId }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [csvPreview, setCsvPreview] = useState<string[][]>([]);
    const [selectedDocName, setSelectedDocName] = useState<string | null>(null);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [result, setResult] = useState<LeadReactivationResult | null>(null);
    const [recentDocuments, setRecentDocuments] = useState<LeadDocument[]>([]);
    const [selectedMarketName, setSelectedMarketName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadDocs = async () => {
            const docs = await getLeadDocuments(realtorId);
            setRecentDocuments(docs);
        };
        loadDocs();
    }, [realtorId]);

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

        // 1. Process rows and normalize content
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

        // 2. Validate Headers
        const headers = rows[0];
        const EnglishHeaderRegex = /^[a-zA-Z0-9_\s]{2,50}$/;
        for (const header of headers) {
            if (!EnglishHeaderRegex.test(header) || header.toLowerCase() === 'null') {
                setValidationError(`Invalid or non-descriptive header detected: "${header}". Headers should be descriptive English.`);
                return null;
            }
        }

        // 3. Scan for Sensitive Data (API keys, secrets)
        const sensitivePatterns = [
            /(password|passwd|secret|apikey|api_key|token)/i,
            /AIza[0-9A-Za-z-_]{35}/, // Google API Key
            /sk_(live|test)_[0-9a-zA-Z]{24}/, // Stripe
            /[0-9a-f]{32}/i // Generic hex hash
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
        // Remove pipes and replace with hyphens
        let processed = val.replace(/\|/g, '-');
        // Trim leading/trailing whitespace
        processed = processed.trim();
        // Remove excessive newlines and escape characters within cells
        processed = processed.replace(/[\r\n]+/g, ' ');
        // Replace empty cells with NULL
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
                // Join with | as the new delimiter for the content sent to AI
                const outputContent = processedRows.map(row => row.join('|')).join('\n');
                setFileContent(outputContent);
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
        // Simple parser for previewing already processed or raw files
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        const rows = lines.map(line => {
            // Check if it's already pipe-separated (from our new logic)
            if (line.includes('|')) {
                return line.split('|');
            }
            // Otherwise try simple comma split (or use more complex logic if needed)
            // For preview of archived docs, we'll just do a smart split
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
        if (!fileContent) return;
        setUploadStatus('uploading');

        try {
            // 1. Upload to Cloud if it's a new file
            if (file) {
                await uploadLeadCSV(realtorId, file);
            }

            // 2. Proceed with AI analysis
            const response = await analyzeLeadDatabase(fileContent, realtorId);
            setResult(response);
            setUploadStatus('success');
        } catch (error) {
            console.error('Failed to process database:', error);
            setUploadStatus('error');
        }
    };

    const handleSelectPreviousDoc = async (doc: LeadDocument) => {
        setUploadStatus('uploading');
        setSelectedDocName(doc.name);

        try {
            const content = await getLeadDocumentContent(doc.storage_path);
            if (!content) throw new Error("Could not retrieve file content");

            setFileContent(content);
            parseForPreview(content);
            setFile(null); // Mark as not a new local file
            setUploadStatus('idle');
        } catch (error) {
            console.error('Failed to process archived database:', error);
            setUploadStatus('error');
        }
    };

    const reset = () => {
        setFile(null);
        setFileContent(null);
        setCsvPreview([]);
        setSelectedDocName(null);
        setResult(null);
        setUploadStatus('idle');
        setValidationError(null);
    };

    const currentMarketData = result?.market_context.find(m => m.market_name === selectedMarketName);

    if (result) {
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm gap-4">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                            <i className="fa-solid fa-file-csv text-2xl"></i>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900">{selectedDocName}</h3>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-black uppercase tracking-wider">Analysis Complete</span>
                                <span className="text-xs text-slate-400 font-medium">Ready for execution</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={reset}
                        className="px-8 py-3 rounded-2xl border-2 border-slate-100 text-sm font-black text-slate-600 hover:bg-slate-50 hover:border-slate-200 transition-all active:scale-95"
                    >
                        New Database
                    </button>
                </div>

                {/* Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Total Leads', value: result.summary.total_leads, icon: 'fa-users', color: 'indigo' },
                        { label: 'Markets Detected', value: result.summary.markets_detected, icon: 'fa-location-dot', color: 'blue' },
                        { label: 'High Priority', value: result.summary.high_priority, icon: 'fa-fire', color: 'orange' },
                        { label: 'Daily Volume', value: result.summary.recommended_daily_volume, icon: 'fa-chart-line', color: 'emerald' }
                    ].map((stat, i) => (
                        <div key={i} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className={`w-10 h-10 bg-${stat.color}-50 text-${stat.color}-600 rounded-xl flex items-center justify-center mb-4`}>
                                <i className={`fa-solid ${stat.icon} text-sm`}></i>
                            </div>
                            <div className="text-3xl font-black text-slate-900 mb-1">{stat.value}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Market Intelligence & Global Settings */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Market Intelligence */}
                    <div className="lg:col-span-2 bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
                        <div className="relative z-10 space-y-8">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight uppercase mb-1">Market Intelligence</h2>
                                    <p className="text-slate-400 text-sm font-medium">Regional context detected from lead data.</p>
                                </div>
                                <div className="flex gap-2 bg-slate-800/50 p-1.5 rounded-2xl border border-white/5 overflow-x-auto custom-scrollbar no-scrollbar-buttons">
                                    {result.market_context.map((market) => (
                                        <button
                                            key={market.market_name}
                                            onClick={() => setSelectedMarketName(market.market_name)}
                                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${selectedMarketName === market.market_name
                                                ? 'bg-indigo-600 text-white shadow-lg'
                                                : 'text-slate-400 hover:text-white'
                                                }`}
                                        >
                                            {market.market_name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {currentMarketData && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in slide-in-from-left-4 duration-500">
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Yield Strategy</label>
                                            <div className="flex items-center gap-3">
                                                <div className="text-sm font-bold capitalize">{currentMarketData.rates_trend} Rates</div>
                                                <i className={`fa-solid fa-arrow-${currentMarketData.rates_trend === 'rising' ? 'up text-rose-400' : currentMarketData.rates_trend === 'declining' ? 'down text-emerald-400' : 'right text-slate-400'}`}></i>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Inventory Status</label>
                                            <div className="flex items-center gap-3">
                                                <div className="text-sm font-bold capitalize">{currentMarketData.inventory_trend} Supply</div>
                                                <i className={`fa-solid fa-arrow-${currentMarketData.inventory_trend === 'rising' ? 'up text-emerald-400' : currentMarketData.inventory_trend === 'declining' ? 'down text-rose-400' : 'right text-slate-400'}`}></i>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Negotiation Leverage (2026 Context)</label>
                                            <div className="max-h-32 overflow-y-auto custom-scrollbar pr-2">
                                                <p className="text-sm text-slate-200 font-medium leading-relaxed italic border-l-2 border-indigo-600 pl-4 py-1">
                                                    "{currentMarketData.buyer_leverage_notes}"
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 pt-2">
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">DOM:</span>
                                                <span className="text-xs font-bold capitalize">{currentMarketData.avg_days_on_market}</span>
                                            </div>
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Confidence:</span>
                                                <span className="text-xs font-bold capitalize">{currentMarketData.confidence}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] -mr-48 -mt-48"></div>
                    </div>

                    {/* Global Settings */}
                    <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-xl shadow-indigo-500/5">
                        <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
                            <i className="fa-solid fa-sliders text-indigo-600"></i>
                            Automation Rules
                        </h3>
                        <div className="space-y-6">
                            <div className="flex justify-between items-center py-3 border-b border-slate-50">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Default Channel</span>
                                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold uppercase">{result.global_settings.default_channel}</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-slate-50">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Send Window</span>
                                <span className="text-sm font-bold text-slate-700">{result.global_settings.send_window}</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-slate-50">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Timezone</span>
                                <span className="text-sm font-bold text-slate-700">{result.global_settings.timezone}</span>
                            </div>
                            <div className="pt-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Compliance Signature</label>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 italic text-xs text-slate-500">
                                    "{result.global_settings.opt_out_text}"
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lead Action Plans */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-slate-900">Lead Action Plans</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-medium">Strategy: {result.summary.primary_strategy}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {result.lead_plans.map((plan, idx) => (
                            <div key={idx} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-500 group border-l-4" style={{ borderLeftColor: plan.priority_score > 0.8 ? '#4f46e5' : plan.priority_score > 0.5 ? '#3b82f6' : '#94a3b8' }}>
                                <div className="p-8">
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                        {/* Lead Info */}
                                        <div className="lg:col-span-3 space-y-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center font-bold text-xs">
                                                        #{idx + 1}
                                                    </div>
                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">{plan.market}</span>
                                                </div>
                                                <h4 className="text-lg font-black text-slate-900 truncate">{plan.lead_id}</h4>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${plan.recommended_channel === 'sms' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                                                    }`}>
                                                    {plan.recommended_channel}
                                                </div>
                                                <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                    {plan.tone.replace('_', ' ')}
                                                </div>
                                                <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                    {(plan.priority_score * 100).toFixed(0)}% Priority
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drift Cause</label>
                                                <div className="text-sm font-bold text-slate-600 capitalize">{plan.staleness_reason}</div>
                                            </div>
                                        </div>

                                        {/* Outreach Timeline */}
                                        <div className="lg:col-span-9 space-y-6">
                                            {/* First Touch */}
                                            <div className="relative">
                                                <div className="absolute left-4 top-8 bottom-0 w-0.5 border-l-2 border-dashed border-slate-100"></div>
                                                <div className="flex gap-6">
                                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black z-10 shadow-lg shadow-indigo-200">
                                                        1
                                                    </div>
                                                    <div className="flex-1 bg-slate-50 p-6 rounded-2xl border border-slate-100 relative group-hover:bg-white group-hover:border-indigo-100 transition-colors max-h-[300px] overflow-y-auto custom-scrollbar">
                                                        <div className="flex justify-between items-center mb-3 sticky top-0 bg-inherit z-10">
                                                            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Day {plan.first_touch.send_after_days}: Immediate Hook</div>
                                                            <div className="flex gap-2">
                                                                <button className="text-slate-300 hover:text-indigo-600 transition-colors">
                                                                    <i className="fa-solid fa-copy text-xs"></i>
                                                                </button>
                                                                <button className="text-slate-300 hover:text-indigo-600 transition-colors">
                                                                    <i className="fa-solid fa-pen text-xs"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-slate-700 font-medium leading-relaxed">"{plan.first_touch.message}"</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sequence Steps */}
                                            {plan.sequence.enabled && plan.sequence.steps.map((step, sIdx) => (
                                                <div key={sIdx} className="flex gap-6 relative">
                                                    {sIdx < plan.sequence.steps.length - 1 && (
                                                        <div className="absolute left-4 top-8 bottom-0 w-0.5 border-l-2 border-dashed border-slate-100"></div>
                                                    )}
                                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 border-2 border-white flex items-center justify-center text-xs font-black z-10 shadow-sm">
                                                        {sIdx + 2}
                                                    </div>
                                                    <div className="flex-1 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 relative group-hover:bg-white group-hover:border-indigo-100/50 transition-colors max-h-[200px] overflow-y-auto custom-scrollbar">
                                                        <div className="flex justify-between items-center mb-3 sticky top-0 bg-inherit z-10">
                                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Day {step.day_offset}: Follow-up via {step.channel}</div>
                                                            <div className="flex gap-2">
                                                                <button className="text-slate-300 hover:text-indigo-600 transition-colors">
                                                                    <i className="fa-solid fa-copy text-xs"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-slate-600 font-medium leading-relaxed italic">"{step.message}"</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-xl shadow-indigo-500/5 p-12">
                <div className="max-w-2xl mx-auto text-center space-y-8">

                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                            relative border-2 border-dashed rounded-[2.5rem] p-16 transition-all cursor-pointer
                            ${isDragging
                                ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]'
                                : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'
                            }
                        `}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                            accept=".csv"
                        />

                        <div className="space-y-6">
                            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto transition-all group-hover:scale-110 group-hover:text-indigo-600 group-hover:bg-indigo-50">
                                <i className="fa-solid fa-cloud-arrow-up text-2xl"></i>
                            </div>
                            {validationError ? (
                                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                                    <p className="text-sm font-bold text-rose-500 bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 italic">{validationError}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">Please correct the file and try again</p>
                                </div>
                            ) : file ? (
                                <div className="space-y-2 animate-in zoom-in-95 duration-300">
                                    <p className="text-lg font-black text-indigo-600">{file.name}</p>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{(file.size / 1024).toFixed(1)} KB • CSV Ready</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-sm font-black text-slate-700 uppercase tracking-tight">Upload Old Leads</p>
                                    <p className="text-xs text-slate-400 font-medium">Supports multiple markets per file</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {fileContent && uploadStatus === 'idle' && (
                        <div className="space-y-10 animate-in fade-in zoom-in-95 duration-500">
                            {/* CSV Preview Window */}
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
                                                        <td key={cIdx} className="px-6 py-4 text-xs font-medium text-slate-600 border-b border-slate-50 group-last:border-none whitespace-nowrap">{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpload();
                                    }}
                                    className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 px-8 rounded-2xl shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                                >
                                    <i className="fa-solid fa-brain"></i>
                                    {file ? 'Execute Intelligent Planning' : 'Regenerate Strategy'}
                                </button>
                                <button
                                    onClick={reset}
                                    className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors"
                                >
                                    Cancel & Select Different File
                                </button>
                            </div>
                        </div>
                    )}

                    {uploadStatus === 'uploading' && (
                        <div className="w-full bg-indigo-50/50 border border-indigo-100 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 animate-in fade-in zoom-in-95 duration-500">
                            <div className="relative">
                                <div className="w-12 h-12 border-4 border-indigo-100 rounded-full"></div>
                                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-indigo-600 font-black uppercase tracking-widest text-xs">Architecting Lead Reactivation Plan</p>
                                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest opacity-80 italic">Precision intelligence often takes 1-2 minutes to orchestrate...</p>
                            </div>
                        </div>
                    )}

                    {uploadStatus === 'error' && (
                        <div className="w-full bg-rose-50 text-rose-600 rounded-2xl p-6 flex items-center justify-center gap-4 border border-rose-100 animate-in shake duration-500">
                            <i className="fa-solid fa-circle-exclamation text-lg"></i>
                            <span className="font-black uppercase tracking-widest text-xs">Encryption or validation error. Try again.</span>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-8 pt-10 border-t border-slate-100 mt-12">
                        {[
                            { icon: 'fa-earth-americas', label: 'Multi-Market' },
                            { icon: 'fa-shield-check', label: 'Compliance' },
                            { icon: 'fa-chart-network', label: 'Event Tracks' }
                        ].map((item, i) => (
                            <div key={i} className="text-center space-y-3">
                                <div className="text-slate-400 hover:text-indigo-600 transition-colors">
                                    <i className={`fa-solid ${item.icon} text-lg`}></i>
                                </div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Uploads Section */}
            {recentDocuments.length > 0 && uploadStatus === 'idle' && !result && (
                <div className="mt-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Previously Uploaded Leads</h3>
                        <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent mx-8"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {recentDocuments.slice(0, 3).map((doc) => (
                            <div
                                key={doc.id}
                                onClick={() => handleSelectPreviousDoc(doc)}
                                className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all flex items-center justify-between group cursor-pointer active:scale-95"
                            >
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shadow-sm">
                                        <i className="fa-solid fa-file-csv text-lg"></i>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-slate-900 truncate pr-4">{doc.name}</p>
                                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{getTimeSince(doc.created_at)}</p>
                                    </div>
                                </div>
                                <div className="text-[10px] font-black text-slate-300 uppercase tracking-tighter shrink-0">
                                    {(doc.size / 1024).toFixed(0)} KB
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AutomatedModule;
