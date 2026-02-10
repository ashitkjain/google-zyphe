
import React, { useState, useRef } from 'react';
import { uploadVideoToStorage } from '../../services/firebase/storage';

const VideoUploadTab: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [summary, setSummary] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!selectedFile.type.startsWith('video/')) {
                setUploadStatus({ type: 'error', message: 'Please select a valid video file.' });
                return;
            }
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setUploadStatus(null);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            setUploadStatus({ type: 'error', message: 'Please select a video file first.' });
            return;
        }

        setIsUploading(true);
        setUploadStatus(null);

        try {
            const downloadUrl = await uploadVideoToStorage(file, summary);
            setUploadStatus({
                type: 'success',
                message: `Video uploaded successfully! Link: ${downloadUrl}`
            });
            // Reset form
            setFile(null);
            setSummary('');
            setPreviewUrl(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error: any) {
            setUploadStatus({ type: 'error', message: error.message || 'Failed to upload video.' });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2 border-b border-slate-200 pb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-[10px] font-black uppercase tracking-widest text-amber-600 w-fit">
                    <i className="fa-solid fa-screwdriver-wrench"></i>
                    Admin Content Management
                </div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Video Asset Upload</h1>
                <p className="text-slate-500 text-sm font-medium">
                    Upload video content to Zyphe's secure cloud storage and attach descriptive summaries for indexing.
                </p>
            </div>

            <form onSubmit={handleUpload} className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                {/* Upload Area */}
                <div className="lg:col-span-12">
                    <div className="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 p-12 transition-all hover:border-indigo-400 group relative">
                        <input
                            type="file"
                            accept="video/*"
                            onChange={handleFileChange}
                            ref={fileInputRef}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        <div className="flex flex-col items-center text-center gap-6">
                            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                <i className="fa-solid fa-cloud-arrow-up text-3xl"></i>
                            </div>
                            <div className="space-y-2">
                                <p className="text-lg font-black text-slate-900">
                                    {file ? file.name : "Drag and drop video or click to browse"}
                                </p>
                                <p className="text-sm text-slate-500 font-medium">
                                    MP4, MOV, or WEBM up to 100MB
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-7 space-y-8">
                    <section className="space-y-4">
                        <label className="text-[11px] font-black uppercase tracking-widest text-slate-900 ml-1">Video Summary</label>
                        <textarea
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            placeholder="Enter a comprehensive summary of the video content..."
                            rows={6}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 text-[14px] text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none placeholder:text-slate-400"
                        />
                    </section>

                    <button
                        type="submit"
                        disabled={isUploading || !file}
                        className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 text-[12px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 ${isUploading || !file
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                            }`}
                    >
                        {isUploading ? (
                            <>
                                <i className="fa-solid fa-circle-notch animate-spin"></i>
                                Uploading to Cloud...
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-upload"></i>
                                Execute Secure Upload
                            </>
                        )}
                    </button>

                    {uploadStatus && (
                        <div className={`p-6 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top-2 duration-300 ${uploadStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                            <i className={`fa-solid ${uploadStatus.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} mt-1`}></i>
                            <div className="space-y-1">
                                <p className="text-[14px] font-black">
                                    {uploadStatus.type === 'success' ? 'Transformation Complete' : 'Upload Failed'}
                                </p>
                                <p className="text-[12px] font-medium leading-relaxed break-all">
                                    {uploadStatus.message}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Preview Sidebar */}
                <div className="lg:col-span-5">
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 space-y-6 sticky top-8">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Preview</h4>
                        {previewUrl ? (
                            <div className="aspect-video rounded-2xl overflow-hidden bg-black border border-white/10">
                                <video src={previewUrl} controls className="w-full h-full object-contain" />
                            </div>
                        ) : (
                            <div className="aspect-video rounded-2xl bg-white/5 border border-dashed border-white/10 flex flex-col items-center justify-center text-slate-600 gap-4">
                                <i className="fa-solid fa-video-slash text-2xl"></i>
                                <span className="text-[10px] uppercase font-black tracking-widest">Awaiting Video</span>
                            </div>
                        )}

                        <div className="space-y-4 pt-6 border-t border-white/10">
                            <div className="flex justify-between items-center text-[11px] font-bold">
                                <span className="text-slate-500 uppercase tracking-widest">Protocol</span>
                                <span className="text-indigo-400">Firebase Blob Storage</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] font-bold">
                                <span className="text-slate-500 uppercase tracking-widest">Indexing</span>
                                <span className="text-emerald-400">Metadata Aware</span>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default VideoUploadTab;
