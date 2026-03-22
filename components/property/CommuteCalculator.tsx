import React, { useState, useEffect } from 'react';
import { APP_CONFIG } from '../../config';
import { db, auth } from '../../services/firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const MAPS_API_KEY = APP_CONFIG.maps.key;

interface Props {
    originLat: number;
    originLng: number;
    propertyAddress?: string;
}

const CommuteCalculator: React.FC<Props> = ({ originLat, originLng, propertyAddress }) => {
    const [destination, setDestination] = useState('');
    const [savedDest, setSavedDest] = useState('');
    const [showOverlay, setShowOverlay] = useState(false);
    const [direction, setDirection] = useState<'toWork' | 'toHome'>('toWork');
    const [loadingPref, setLoadingPref] = useState(true);

    const home = propertyAddress || `${originLat},${originLng}`;

    // Load saved destination from Firestore
    useEffect(() => {
        const load = async () => {
            try {
                const uid = auth?.currentUser?.uid;
                if (!uid || !db) { setLoadingPref(false); return; }
                const snap = await getDoc(doc(db, 'users', uid, 'preferences', 'main'));
                const saved = snap.data()?.commuteDestination;
                if (saved) {
                    setDestination(saved);
                    setSavedDest(saved);
                }
            } catch (_) { /* optional */ }
            setLoadingPref(false);
        };
        load();
    }, []);

    const saveDestination = async (dest: string) => {
        try {
            const uid = auth?.currentUser?.uid;
            if (!uid || !db) return;
            await setDoc(doc(db, 'users', uid, 'preferences', 'main'), { commuteDestination: dest }, { merge: true });
            setSavedDest(dest);
        } catch (_) { /* optional */ }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!destination.trim()) return;
        saveDestination(destination.trim());
        setShowOverlay(true);
    };

    const handleCardClick = () => {
        if (savedDest) setShowOverlay(true);
    };

    // Build the embed URL based on direction
    const getEmbedUrl = () => {
        const origin = direction === 'toWork' ? home : encodeURIComponent(savedDest || destination);
        const dest = direction === 'toWork' ? encodeURIComponent(savedDest || destination) : home;
        return `https://www.google.com/maps/embed/v1/directions?key=${MAPS_API_KEY}&origin=${origin}&destination=${dest}&mode=driving`;
    };

    // Google Maps link for "Open in Google Maps" button
    const getMapsLink = () => {
        const origin = direction === 'toWork' ? home : (savedDest || destination);
        const dest = direction === 'toWork' ? (savedDest || destination) : home;
        return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=driving`;
    };

    return (
        <>
            <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center">
                            <i className="fa-solid fa-route text-sky-600 text-[11px]"></i>
                        </div>
                        <span className="text-[16px] font-black text-slate-700 tracking-tight">Commute</span>
                    </div>

                    <form onSubmit={handleSubmit} className="flex gap-1.5 mb-1">
                        <input
                            type="text"
                            value={destination}
                            onChange={e => setDestination(e.target.value)}
                            placeholder={loadingPref ? 'Loading...' : 'Enter work address...'}
                            disabled={loadingPref}
                            className="flex-1 text-[12px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200 placeholder-slate-300 disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={!destination.trim() || loadingPref}
                            className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-[11px] font-bold hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            <i className="fa-solid fa-magnifying-glass text-[10px]"></i>
                        </button>
                    </form>

                    {savedDest && (
                        <button
                            onClick={handleCardClick}
                            className="w-full mt-1.5 flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-100 hover:border-sky-200 hover:bg-sky-50/30 transition-all cursor-pointer text-left"
                        >
                            <i className="fa-solid fa-car text-[10px] text-sky-400"></i>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] text-slate-400 truncate">{savedDest}</div>
                                <div className="text-[11px] font-bold text-sky-600">View commute route →</div>
                            </div>
                        </button>
                    )}

                    <div className="text-[8px] text-slate-700 mt-2 text-right">Google Maps</div>
                </div>
            </div>

            {/* Map overlay */}
            {showOverlay && (
                <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowOverlay(false)}>
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center">
                                    <i className="fa-solid fa-route text-sky-600 text-sm"></i>
                                </div>
                                <div>
                                    <div className="text-sm font-black text-slate-700">Commute Route</div>
                                    <div className="text-[10px] text-slate-400 truncate max-w-[300px]">{savedDest || destination}</div>
                                </div>
                            </div>
                            <button onClick={() => setShowOverlay(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                                <i className="fa-solid fa-xmark text-slate-400"></i>
                            </button>
                        </div>

                        {/* Direction toggle */}
                        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex gap-2">
                            <button
                                onClick={() => setDirection('toWork')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-bold transition-all ${direction === 'toWork'
                                    ? 'bg-sky-100 text-sky-700 shadow-sm'
                                    : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-200'
                                    }`}
                            >
                                <i className="fa-solid fa-arrow-right text-[10px]"></i>
                                Home → Work
                            </button>
                            <button
                                onClick={() => setDirection('toHome')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-bold transition-all ${direction === 'toHome'
                                    ? 'bg-sky-100 text-sky-700 shadow-sm'
                                    : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-200'
                                    }`}
                            >
                                <i className="fa-solid fa-arrow-left text-[10px]"></i>
                                Work → Home
                            </button>
                        </div>

                        {/* Map */}
                        <div className="relative" style={{ height: '400px' }}>
                            <iframe
                                key={direction}
                                src={getEmbedUrl()}
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                            <div className="text-[10px] text-slate-400">
                                <i className="fa-solid fa-clock mr-1"></i>
                                Showing current traffic conditions
                            </div>
                            <a
                                href={getMapsLink()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1.5 transition-colors"
                            >
                                Open in Google Maps
                                <i className="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CommuteCalculator;
