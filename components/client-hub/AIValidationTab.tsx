
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
    const [activeCity, setActiveCity] = useState<string>('All Cities');
    const [savingZpids, setSavingZpids] = useState<Set<string>>(new Set());

    const cities = useMemo(() => {
        const uniqueCities = Array.from(new Set(properties.map(p => p.city || 'Other'))).sort();
        return ['All Cities', ...uniqueCities];
    }, [properties]);

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
        if (activeCity === 'All Cities') return properties;
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
        if (onNavigate) {
            onNavigate('explore', address);
        }
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
            <div className="flex gap-3 mb-8 overflow-x-auto pb-2 no-scrollbar">
                {cities.map(city => (
                    <button
                        key={city}
                        onClick={() => setActiveCity(city)}
                        className={`px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border
                            ${activeCity === city ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}
                        `}
                    >
                        {city}
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
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Intelligence Health</th>
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
                                                className="text-left group/link"
                                            >
                                                <div className="text-sm font-black text-slate-900 group-hover/link:text-indigo-600 transition-colors decoration-indigo-500/30 group-hover/link:underline underline-offset-4">
                                                    {prop.address}
                                                </div>
                                                <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center gap-2">
                                                    ZPID: {prop.zpid}
                                                    <i className="fa-solid fa-arrow-up-right-from-square text-[8px]"></i>
                                                </div>
                                            </button>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex gap-2">
                                                <div className={`px-2 py-1 rounded text-[9px] font-black uppercase border
                                                    ${prop.hasCoreData ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}
                                                `}>
                                                    Core Data
                                                </div>
                                                <div className={`px-2 py-1 rounded text-[9px] font-black uppercase border
                                                    ${prop.hasInterior ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}
                                                `}>
                                                    Interior Analysis
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <select
                                                value={localAssessment || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value as any;
                                                    setProperties(prev => prev.map(p => p.zpid === prop.zpid ? { ...p, assessment: val } : p));
                                                }}
                                                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all text-slate-700 w-32"
                                            >
                                                <option value="">Select...</option>
                                                <option value="good">Good</option>
                                                <option value="bad">Bad</option>
                                                <option value="other">Other</option>
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
