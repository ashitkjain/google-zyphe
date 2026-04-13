import React, { useState } from 'react';
import { APP_CONFIG } from '../../config';

/**
 * ConciergeCall Component
 * A premium, Getbee-inspired video call trigger using Zoom for concierge services.
 */
const ConciergeCall: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'connecting' | 'active'>('idle');

    const handleStartCall = () => {
        setStatus('connecting');
        // Simulate a "Connecting to Concierge" premium experience
        setTimeout(() => {
            setStatus('idle');
            // Construct Zoom URL using config
            const zoomUrl = `https://zoom.us/j/${APP_CONFIG.concierge.zoomRoomId}`;
            window.open(zoomUrl, '_blank', 'width=1000,height=800');
        }, 2500);
    };

    return (
        <>
            {/* Floating Trigger Button */}
            <div className="fixed bottom-6 right-6 z-[200]">
                <button
                    onClick={handleStartCall}
                    disabled={status === 'connecting'}
                    className={`group relative flex items-center gap-3 px-5 py-3 rounded-2xl transition-all duration-500 shadow-2xl overflow-hidden ${
                        status === 'connecting' 
                        ? 'bg-slate-900 border-slate-700 w-14 sm:w-14' 
                        : 'bg-white/90 backdrop-blur-md border border-white hover:bg-white hover:scale-105 active:scale-95'
                    }`}
                >
                    {/* Ring Pulse for Live Status */}
                    {status === 'idle' && (
                        <span className="absolute top-3 right-3 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                    )}

                    {/* Icon Container with Zoom Branding Color */}
                    <div className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-500 ${
                        status === 'connecting' ? 'bg-indigo-500/10 text-indigo-400 animate-spin' : 'bg-blue-500 text-white group-hover:bg-blue-600'
                    }`}>
                        <i className={`fa-solid ${status === 'connecting' ? 'fa-spinner' : 'fa-video'} text-[14px]`}></i>
                    </div>

                    {/* Label */}
                    <div className={`flex flex-col items-start transition-all duration-500 ${status === 'connecting' ? 'opacity-0 scale-90 w-0' : 'opacity-100 scale-100'}`}>
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] leading-none mb-0.5">Live Now</span>
                        <span className="text-[13px] font-bold text-slate-800 tracking-tight leading-none">Call Concierge</span>
                    </div>

                    {/* Background Shine Effect */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                </button>
            </div>

            {/* Connecting Overlay (Getbee Style) */}
            {status === 'connecting' && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-500">
                    <div className="bg-white rounded-[2.5rem] p-12 shadow-2xl border border-white/20 flex flex-col items-center gap-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-500">
                        {/* Avatar / Branding */}
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-slate-100 border-4 border-white shadow-xl flex items-center justify-center overflow-hidden">
                                <img 
                                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4" 
                                    alt="Concierge" 
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center shadow-lg">
                                <i className="fa-solid fa-check text-white text-[12px]"></i>
                            </div>
                        </div>

                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Connecting...</h3>
                            <p className="text-slate-500 font-medium">A Zyphe concierge is joining the session</p>
                        </div>

                        {/* Loading Bar */}
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full animate-progress-fast"></div>
                        </div>

                        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl">
                            <i className="fa-solid fa-cloud text-blue-500 text-[12px]"></i>
                            <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest">Secure Zoom Link</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Add needed animation for progress bar if not in tailwind config */}
            <style>{`
                @keyframes progress-fast {
                    0% { width: 0%; }
                    100% { width: 100%; }
                }
                .animate-progress-fast {
                    animation: progress-fast 2.5s ease-out forwards;
                }
            `}</style>
        </>
    );
};

export default ConciergeCall;
