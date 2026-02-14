
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db, auth, saveAIAssessment, getAIAssessments, AIAssessment } from '../../services/firebaseService';
import { PropertyData } from '../../types';

interface PropertyValidationStatus extends PropertyData {
    hasCoreData: boolean;
    hasInterior: boolean;
    assessment?: 'good' | 'bad' | 'other';
    comment?: string;
    isGrayedOut: boolean;
}

interface AIValidationTabProps {
    onNavigate?: (view: any, path: string) => void;
}

const AIValidationTab: React.FC<AIValidationTabProps> = ({ onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [properties, setProperties] = useState<PropertyValidationStatus[]>([]);
    const [assessments, setAssessments] = useState<Record<string, AIAssessment>>({});
    const [activeCity, setActiveCity] = useState<string | null>(null);
    const [savingZpids, setSavingZpids] = useState<Set<string>>(new Set());

    const cityStats = useMemo(() => {
        const uniqueCities = Array.from(new Set(properties.map(p => p.city || 'Other')));
        const stats = uniqueCities.map(city => {
            const cityProps = properties.filter(p => (p.city || 'Other') === city);
            const total = cityProps.length;
            const assessed = cityProps.filter(p => p.assessment).length;
            return {
                name: city,
                total,
                pending: total - assessed
            };
        });

        // Sort by pending properties descending, then by name
        return stats.sort((a, b) => {
            if (b.pending !== a.pending) return b.pending - a.pending;
            return a.name.localeCompare(b.name);
        });
    }, [properties]);

    // Set default city if none active
    useEffect(() => {
        if (!activeCity && cityStats.length > 0) {
            setActiveCity(cityStats[0].name);
        }
    }, [cityStats, activeCity]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch properties
            const propertyQuery = query(collection(db, "properties"), orderBy("address", "asc"));
            const propertySnapshot = await getDocs(propertyQuery);
            const rawProperties = propertySnapshot.docs.map(doc => ({ zpid: doc.id, ...doc.data() } as any));

            // 2. Fetch Visual Analysis for interior check
            const visualSnapshot = await getDocs(collection(db, "property_analyses_visual"));
            const visualMap = Object.fromEntries(visualSnapshot.docs.map(d => [d.id, d.data()]));

            // 3. Fetch existing assessments
            const existingAssessments = await getAIAssessments();
            const assessmentMap = Object.fromEntries(existingAssessments.map(a => [a.mlsid, a]));
            setAssessments(assessmentMap);

            // 4. Map and determine status
            const mapped: PropertyValidationStatus[] = rawProperties.map(p => {
                const visual = visualMap[p.zpid] as any;

                const hasCoreData = !!((p.bedrooms !== undefined) && (p.bathrooms !== undefined) && p.description && p.price);
                const hasInterior = !!visual?.home_interior;

                const existing = assessmentMap[p.zpid];

                return {
                    ...p,
                    hasCoreData,
                    hasInterior,
                    assessment: existing?.assessment,
                    comment: existing?.comment,
                    isGrayedOut: !hasCoreData || !hasInterior
                };
            });

            setProperties(mapped);
        } catch (error) {
            console.error("Error fetching validation data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredProperties = useMemo(() => {
        if (!activeCity) return [];
        return properties.filter(p => (p.city || 'Other') === activeCity);
    }, [properties, activeCity]);

    const handleSaveAssessment = async (zpid: string, address: string, assessment: 'good' | 'bad' | 'other', comment: string) => {
        const userId = auth?.currentUser?.uid;
        if (!userId) {
            alert("Please sign in to save assessments.");
            return;
        }

        setSavingZpids(prev => new Set(prev).add(zpid));
        try {
            await saveAIAssessment({
                mlsid: zpid,
                propertyAddress: address,
                assessment,
                comment,
                tester: userId,
                userId: userId
            });

            // Update local state
            setAssessments(prev => ({
                ...prev,
                [zpid]: {
                    mlsid: zpid,
                    propertyAddress: address,
                    assessment,
                    comment,
                    tester: userId,
                    userId: userId,
                    create_date: prev[zpid]?.create_date || new Date(),
                    last_update_date: new Date()
                }
            }));

            // Update properties state to reflect the new assessment immediately
            setProperties(prev => prev.map(p => p.zpid === zpid ? { ...p, assessment, comment } : p));

        } catch (error) {
            console.error("Failed to save assessment:", error);
            alert("Save failed. Check console.");
        } finally {
            setSavingZpids(prev => {
                const next = new Set(prev);
                next.delete(zpid);
                return next;
            });
        }
    };

    const handlePropertyClick = (address: string) => {
        const url = `${window.location.origin}/?q=${encodeURIComponent(address)}`;
        window.open(url, '_blank');
    };

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">AI Validation Hub</h1>
                    <p className="text-sm text-slate-500 font-medium mt-1">Audit and assess AI-generated property intelligence.</p>
                </div>
                <button
                    onClick={fetchData}
                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                >
                    <i className={`fa-solid fa-arrows-rotate ${loading ? 'animate-spin' : ''}`}></i>
                </button>
            </div>

            {/* City Filter */}
            <div className="flex gap-4 mb-8 overflow-x-auto pb-4 no-scrollbar">
                {cityStats.map(stat => (
                    <button
                        key={stat.name}
                        onClick={() => setActiveCity(stat.name)}
                        className={`px-8 py-3.5 rounded-[1.5rem] transition-all border flex flex-col items-start gap-1 min-w-[160px]
                            ${activeCity === stat.name ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.02]' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}
                        `}
                    >
                        <span className="text-[11px] font-black uppercase tracking-widest">{stat.name}</span>
                        <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1.5">
                                <span className={`text-[9px] font-bold ${activeCity === stat.name ? 'text-slate-300' : 'text-slate-400'}`}>TOTAL:</span>
                                <span className={`text-[10px] font-black ${activeCity === stat.name ? 'text-white' : 'text-slate-700'}`}>{stat.total}</span>
                            </div>
                            <div className="w-px h-2 bg-slate-300/30"></div>
                            <div className="flex items-center gap-1.5">
                                <span className={`text-[9px] font-bold ${activeCity === stat.name ? 'text-slate-300' : 'text-slate-400'}`}>PENDING:</span>
                                <span className={`text-[10px] font-black ${stat.pending > 0 ? (activeCity === stat.name ? 'text-amber-400' : 'text-amber-600') : (activeCity === stat.name ? 'text-emerald-400' : 'text-emerald-600')}`}>
                                    {stat.pending}
                                </span>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-40">
                    <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading validation data...</p>
                </div>
            ) : (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Property</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assessment</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Comments</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredProperties.map((prop) => {
                                const localAssessment = assessments[prop.zpid]?.assessment || prop.assessment;
                                const localComment = assessments[prop.zpid]?.comment || prop.comment || '';

                                return (
                                    <tr key={prop.zpid} className={`group hover:bg-slate-50/50 transition-colors ${prop.isGrayedOut ? 'opacity-40' : ''}`}>
                                        <td className="p-6">
                                            <button
                                                onClick={() => handlePropertyClick(prop.address)}
                                                className="text-left group/link flex items-center gap-4"
                                            >
                                                <div className="w-16 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                                    {prop.images?.[0] ? (
                                                        <img src={prop.images[0]} alt="" className="w-full h-full object-cover group-hover/link:scale-110 transition-transform duration-500" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                            <i className="fa-solid fa-house text-xs"></i>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-slate-900 group-hover/link:text-indigo-600 transition-colors decoration-indigo-500/30 group-hover/link:underline underline-offset-4 leading-tight">
                                                        {prop.address}
                                                    </div>
                                                    <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center gap-2">
                                                        ZPID: {prop.zpid}
                                                        <i className="fa-solid fa-arrow-up-right-from-square text-[8px]"></i>
                                                    </div>
                                                </div>
                                            </button>
                                        </td>
                                        <td className="p-6">
                                            <select
                                                value={localAssessment || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value as any;
                                                    setProperties(prev => prev.map(p => p.zpid === prop.zpid ? { ...p, assessment: val } : p));
                                                }}
                                                className={`border rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest outline-none transition-all w-32
                                                    ${localAssessment === 'good' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                                        localAssessment === 'bad' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                                                            localAssessment === 'other' ? 'bg-slate-100 border-slate-300 text-slate-600' :
                                                                'bg-slate-50 border-slate-200 text-slate-700'}
                                                `}
                                            >
                                                <option value="" className="bg-white text-slate-900">Select...</option>
                                                <option value="good" className="bg-emerald-50 text-emerald-700">Good</option>
                                                <option value="bad" className="bg-rose-50 text-rose-700">Bad</option>
                                                <option value="other" className="bg-slate-50 text-slate-600">Other</option>
                                            </select>
                                        </td>
                                        <td className="p-6">
                                            <textarea
                                                value={localComment}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setProperties(prev => prev.map(p => p.zpid === prop.zpid ? { ...p, comment: val } : p));
                                                }}
                                                placeholder="Enter audit notes..."
                                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-medium outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-600 w-full min-h-[40px] max-h-[120px] resize-y"
                                            />
                                        </td>
                                        <td className="p-6 text-right">
                                            <button
                                                onClick={() => handleSaveAssessment(prop.zpid, prop.address, prop.assessment as any, prop.comment || '')}
                                                disabled={savingZpids.has(prop.zpid) || !prop.assessment}
                                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                                                    ${savingZpids.has(prop.zpid) ? 'bg-slate-100 text-slate-400' :
                                                        !prop.assessment ? 'bg-slate-50 text-slate-300 pointer-events-none' :
                                                            'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95'}
                                                `}
                                            >
                                                {savingZpids.has(prop.zpid) ? (
                                                    <i className="fa-solid fa-spinner animate-spin"></i>
                                                ) : assessments[prop.zpid] ? (
                                                    <span>Update</span>
                                                ) : (
                                                    <span>Save Audit</span>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filteredProperties.length === 0 && (
                        <div className="py-20 text-center opacity-30">
                            <i className="fa-solid fa-folder-open text-5xl mb-4 text-slate-200"></i>
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No properties discovered for this region</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AIValidationTab;
