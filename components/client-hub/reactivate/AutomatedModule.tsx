import React, { useState, useRef } from 'react';
import { analyzeLeadDatabase } from '../../../services/geminiService';
import { LeadReactivationResult } from '../../../types';

interface AutomatedModuleProps {
    realtorId: string;
}

const AutomatedModule: React.FC<AutomatedModuleProps> = ({ realtorId }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [result, setResult] = useState<LeadReactivationResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            setFile(droppedFile);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploadStatus('uploading');

        try {
            const text = await file.text();
            const response = await analyzeLeadDatabase(text);
            setResult(response);
            setUploadStatus('success');
        } catch (error) {
            console.error('Failed to analyze database:', error);
            setUploadStatus('error');
        }
    };

    const reset = () => {
        setFile(null);
        setResult(null);
        setUploadStatus('idle');
    };

    if (result) {
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                            <i className="fa-solid fa-file-csv text-xl"></i>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">{file?.name}</h3>
                            <p className="text-xs text-slate-400">Processed successfully</p>
                        </div>
                    </div>
                    <button
                        onClick={reset}
                        className="px-6 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        Upload Another
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Market Baseline */}
                    <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
                        <div className="relative z-10 space-y-8">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                                        <i className="fa-solid fa-chart-line text-lg"></i>
                                    </div>
                                    <h2 className="text-2xl font-black tracking-tight uppercase">2026 Market Context</h2>
                                </div>
                                <p className="text-slate-400 font-medium">Strategic baseline used for lead analysis and outreach generation.</p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Rate Environment</label>
                                    <p className="text-sm text-slate-200 font-medium leading-relaxed">{result.market_baseline.rate_environment}</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Inventory Outlook</label>
                                    <p className="text-sm text-slate-200 font-medium leading-relaxed">{result.market_baseline.inventory_outlook}</p>
                                </div>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] -mr-48 -mt-48"></div>
                    </div>

                    {/* Automation Stats */}
                    <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-xl shadow-indigo-500/5">
                        <div className="h-full flex flex-col justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 mb-2">Segmented Strategy</h3>
                                <p className="text-slate-500 font-medium">We identified {result.segments.length} distinct lead segments for reactivation.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-8">
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <div className="text-2xl font-black text-indigo-600 mb-1">{result.segments.length}</div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Segments</div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <div className="text-2xl font-black text-emerald-600 mb-1">AI-Ready</div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Campaign Status</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Segments */}
                <div className="space-y-6 pb-12">
                    {result.segments.map((segment, idx) => (
                        <div key={idx} className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 group">
                            <div className="p-8 lg:p-12">
                                <div className="flex flex-col lg:flex-row gap-12">
                                    <div className="lg:w-1/3 space-y-6">
                                        <div>
                                            <div className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-widest mb-4">
                                                Segment {idx + 1}
                                            </div>
                                            <h3 className="text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{segment.segment_name}</h3>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Analysis</label>
                                                <p className="text-sm text-slate-600 font-medium">{segment.reasons_for_stale}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Strategic Hook</label>
                                                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
                                                    <p className="text-sm text-indigo-900 font-bold italic">"{segment.optimal_hook}"</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                        <i className="fa-solid fa-comment-sms text-xs"></i>
                                                    </div>
                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Day 1: SMS Sequence</span>
                                                </div>
                                                <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 relative">
                                                    <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{segment.cadence.day_1_sms}</p>
                                                    <button className="absolute top-4 right-4 text-slate-300 hover:text-indigo-600 transition-colors">
                                                        <i className="fa-solid fa-copy"></i>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                        <i className="fa-solid fa-envelope text-xs"></i>
                                                    </div>
                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Day 4: Email Revival</span>
                                                </div>
                                                <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 relative">
                                                    <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{segment.cadence.day_4_email}</p>
                                                    <button className="absolute top-4 right-4 text-slate-300 hover:text-indigo-600 transition-colors">
                                                        <i className="fa-solid fa-copy"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-xl shadow-indigo-500/5 p-12">
                <div className="max-w-2xl mx-auto text-center space-y-8">
                    <div className="space-y-3">
                        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <i className="fa-solid fa-robot text-2xl"></i>
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Automated Reactivation</h2>
                        <p className="text-slate-500 font-medium">
                            Upload your lead database to trigger AI-driven automated reactivation campaigns with 2026 market context.
                        </p>
                    </div>

                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                            relative border-2 border-dashed rounded-[2rem] p-12 transition-all cursor-pointer
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

                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
                                <i className="fa-solid fa-cloud-arrow-up text-xl"></i>
                            </div>
                            {file ? (
                                <div className="space-y-2">
                                    <p className="text-indigo-600 font-bold">{file.name}</p>
                                    <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-slate-700">Click to upload or drag and drop</p>
                                    <p className="text-xs text-slate-400">Excel or CSV files (max 10MB)</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {file && uploadStatus === 'idle' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleUpload();
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                        >
                            <i className="fa-solid fa-paper-plane"></i>
                            Process Automation
                        </button>
                    )}

                    {uploadStatus === 'uploading' && (
                        <div className="w-full bg-slate-100 rounded-2xl p-4 flex items-center justify-center gap-3">
                            <div className="w-5 h-5 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-slate-600 font-bold">Analyzing Database with Gemini...</span>
                        </div>
                    )}

                    {uploadStatus === 'error' && (
                        <div className="w-full bg-rose-50 text-rose-600 rounded-2xl p-4 flex items-center justify-center gap-3 border border-rose-100">
                            <i className="fa-solid fa-circle-exclamation"></i>
                            <span className="font-bold">Error analyzing database. Please try again.</span>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-100 mt-12">
                        {[
                            { icon: 'fa-bolt', label: 'Instant Sync' },
                            { icon: 'fa-shield-halved', label: 'Secure Data' },
                            { icon: 'fa-chart-pie', label: 'AI Analysis' }
                        ].map((item, i) => (
                            <div key={i} className="text-center space-y-2">
                                <div className="text-slate-400">
                                    <i className={`fa-solid ${item.icon}`}></i>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AutomatedModule;
