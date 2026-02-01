import React, { useState, useRef } from 'react';
import { convertDocumentToCsv } from '../../services/geminiService';

const PdfToCsvTab: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [csvOutput, setCsvOutput] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setCsvOutput('');
            setError(null);

            // Create preview URL
            const objectUrl = URL.createObjectURL(selectedFile);
            setPreviewUrl(objectUrl);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const selectedFile = e.dataTransfer.files[0];
            setFile(selectedFile);
            setCsvOutput('');
            setError(null);

            const objectUrl = URL.createObjectURL(selectedFile);
            setPreviewUrl(objectUrl);
        }
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                // Remove the execution/metadata part (e.g., "data:application/pdf;base64,")
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleConvert = async () => {
        if (!file) return;

        setIsConverting(true);
        setError(null);

        try {
            const base64 = await fileToBase64(file);
            const result = await convertDocumentToCsv(base64, file.type);

            if (result.csv === "NO_DATA_FOUND") {
                setError("No structured data could be identified in this document.");
            } else {
                setCsvOutput(result.csv);
            }
        } catch (err: any) {
            console.error("Conversion failed:", err);
            setError(err.message || "Failed to convert document. Please try again.");
        } finally {
            setIsConverting(false);
        }
    };

    const handleDownload = () => {
        if (!csvOutput) return;

        const blob = new Blob([csvOutput], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${file?.name.replace(/\.[^/.]+$/, "") || 'converted'}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 p-6 md:p-12 overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-black text-slate-900 mb-2">PDF to CSV Converter</h1>
                    <p className="text-slate-500 text-sm">Upload a PDF or Image containing a table to convert it into editable CSV data.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Input Section */}
                    <div className="flex flex-col gap-6">
                        <div
                            className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all bg-white min-h-[300px] ${file ? 'border-indigo-200' : 'border-slate-300 hover:border-indigo-400 cursor-pointer'}`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            onClick={() => !file && fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="application/pdf,image/png,image/jpeg,image/webp"
                            />

                            {file ? (
                                <div className="animate-in fade-in zoom-in duration-300 w-full flex flex-col items-center">
                                    <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-4 text-2xl shadow-sm">
                                        <i className={`fa-solid ${file.type.includes('pdf') ? 'fa-file-pdf' : 'fa-file-image'}`}></i>
                                    </div>
                                    <p className="font-bold text-slate-900 break-all max-w-full px-4 mb-1">{file.name}</p>
                                    <p className="text-xs text-slate-400 mb-6">{(file.size / 1024 / 1024).toFixed(2)} MB</p>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFile(null);
                                                setCsvOutput('');
                                                setPreviewUrl(null);
                                            }}
                                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
                                        >
                                            Remove
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleConvert();
                                            }}
                                            disabled={isConverting}
                                            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isConverting ? (
                                                <>
                                                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                                                    Converting...
                                                </>
                                            ) : (
                                                <>
                                                    Convert to CSV
                                                    <i className="fa-solid fa-arrow-right"></i>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mb-4 text-2xl">
                                        <i className="fa-solid fa-cloud-arrow-up"></i>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-700 mb-1">Click or Drag File</h3>
                                    <p className="text-xs text-slate-400 max-w-[200px]">Supports PDF documents, PNG, JPG logs, and screenshots of tables.</p>
                                </>
                            )}
                        </div>

                        {error && (
                            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top-2">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Output Section */}
                    <div className="flex flex-col h-full min-h-[300px]">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">CSV Output</h3>
                            {csvOutput && (
                                <button
                                    onClick={handleDownload}
                                    className="text-xs font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg transition-colors"
                                >
                                    <i className="fa-solid fa-download"></i>
                                    Download File
                                </button>
                            )}
                        </div>

                        <div className="flex-1 bg-slate-900 rounded-3xl p-6 relative group overflow-hidden shadow-2xl shadow-slate-200">
                            {csvOutput ? (
                                <textarea
                                    readOnly
                                    value={csvOutput}
                                    className="w-full h-full bg-transparent text-emerald-400 font-mono text-xs outline-none resize-none custom-scrollbar leading-relaxed"
                                />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700 p-8 text-center">
                                    <i className="fa-solid fa-table-cells text-3xl mb-4 opacity-20"></i>
                                    <p className="text-sm font-medium opacity-50">Converted data will appear here.</p>
                                </div>
                            )}

                            {/* Decorative elements */}
                            <div className="absolute top-0 right-0 p-4 opacity-50 pointer-events-none">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


            </div>
        </div>
    );
};

export default PdfToCsvTab;
