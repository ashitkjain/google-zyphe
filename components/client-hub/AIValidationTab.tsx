
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db, auth, saveAIAssessment, getAIAssessments, AIAssessment, getUserProfile, getAllTesters } from '../../services/firebaseService';
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
    const [userNames, setUserNames] = useState<Record<string, string>>({});
    const [allTesters, setAllTesters] = useState<{ uid: string, displayName: string }[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeTab, setActiveTab] = useState<'audits' | 'reports' | 'instructions'>('audits');
    const [assignmentConfirm, setAssignmentConfirm] = useState<{ zpid: string, address: string, userId: string } | null>(null);
    const [editingComment, setEditingComment] = useState<{ zpid: string, address: string, comment: string } | null>(null);
    const [reportStartDate, setReportStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
    const pageSize = 20;

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

        // Hide a city tab if it has below 5 properties
        const filteredStats = stats.filter(stat => stat.total >= 5);

        // Sort by pending properties descending, then by name
        return (filteredStats as { name: string, total: number, pending: number }[]).sort((a, b) => {
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

    // Reset pagination when city changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeCity]);

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

            // 3. Fetch existing assessments and relevant user profiles
            const existingAssessments = await getAIAssessments();
            const assessmentMap = Object.fromEntries(existingAssessments.map(a => [a.mlsid, a]));
            setAssessments(assessmentMap);

            // Fetch ALL testers for assignment dropdown
            const testers = await getAllTesters();
            const testerList = testers.map(t => ({ uid: t.uid, displayName: t.displayName || t.email || 'Unknown' }));
            setAllTesters(testerList);

            // Fetch user names for audit trail
            const nameMap: Record<string, string> = { ...userNames };
            testers.forEach(t => {
                nameMap[t.uid] = t.displayName || t.email || 'Unknown';
            });

            const uniqueTesters = Array.from(new Set(existingAssessments.map(a => a.tester).filter(Boolean)));
            await Promise.all(uniqueTesters.map(async (uid) => {
                if (!nameMap[uid]) {
                    const profile = await getUserProfile(uid);
                    if (profile) nameMap[uid] = profile.displayName || profile.email || 'Unknown';
                }
            }));
            setUserNames(nameMap);

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

    const paginatedProperties = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredProperties.slice(start, start + pageSize);
    }, [filteredProperties, currentPage]);

    const totalPages = Math.ceil(filteredProperties.length / pageSize);

    const reportData = useMemo(() => {
        const start = new Date(reportStartDate);
        const end = new Date(reportEndDate);
        end.setHours(23, 59, 59, 999);

        const assessmentList = Object.values(assessments) as AIAssessment[];
        const userStats: Record<string, number> = {};

        assessmentList.forEach(a => {
            if (!a.last_update_date) return;
            const updateDate = a.last_update_date.toDate ? a.last_update_date.toDate() : new Date(a.last_update_date);
            if (updateDate >= start && updateDate <= end) {
                userStats[a.tester] = (userStats[a.tester] || 0) + 1;
            }
        });

        return Object.entries(userStats).map(([uid, count]) => ({
            uid,
            userName: userNames[uid] || 'Unknown',
            count
        })).sort((a, b) => b.count - a.count);
    }, [assessments, userNames, reportStartDate, reportEndDate]);

    const handleAssignTester = async (zpid: string, address: string, targetUserId: string, force: boolean = false) => {
        const existing = assessments[zpid];
        if (existing && existing.tester && existing.tester !== targetUserId && !force) {
            setAssignmentConfirm({ zpid, address, userId: targetUserId });
            return;
        }

        setSavingZpids(prev => new Set(prev).add(zpid));
        try {
            const payload = {
                mlsid: zpid,
                propertyAddress: address,
                tester: targetUserId,
                userId: targetUserId, // Maintain both for legacy
                assessment: existing?.assessment || '',
                comment: existing?.comment || ''
            };

            await saveAIAssessment(payload as any);

            setAssessments(prev => ({
                ...prev,
                [zpid]: {
                    ...payload,
                    last_update_date: new Date()
                } as any
            }));

            setAssignmentConfirm(null);
        } catch (error) {
            console.error("Assignment failed:", error);
        } finally {
            setSavingZpids(prev => {
                const nx = new Set(prev);
                nx.delete(zpid);
                return nx;
            });
        }
    };

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
                    <div className="flex items-center gap-4 mt-2">
                        <button
                            onClick={() => setActiveTab('audits')}
                            className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all ${activeTab === 'audits' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                            Audits
                        </button>
                        <button
                            onClick={() => setActiveTab('reports')}
                            className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all ${activeTab === 'reports' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                            Reports
                        </button>
                        <button
                            onClick={() => setActiveTab('instructions')}
                            className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all ${activeTab === 'instructions' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                            Instructions
                        </button>
                    </div>
                </div>
                <button
                    onClick={fetchData}
                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                >
                    <i className={`fa-solid fa-arrows-rotate ${loading ? 'animate-spin' : ''}`}></i>
                </button>
            </div>

            {activeTab === 'audits' ? (
                <div className="space-y-8">
                    {/* City Filter */}
                    <div className="flex gap-4 mb-4 overflow-x-auto pb-4 no-scrollbar">
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
                        <div className="space-y-8">
                            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Property</th>
                                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Assigned To</th>
                                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assessment</th>
                                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Updated</th>
                                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Comments</th>
                                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paginatedProperties.map((prop) => {
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
                                                        <div className="flex justify-center">
                                                            <select
                                                                value={assessments[prop.zpid]?.tester || ''}
                                                                onChange={(e) => handleAssignTester(prop.zpid, prop.address, e.target.value)}
                                                                className={`bg-white border rounded-lg px-3 py-2 text-[10px] font-bold text-slate-600 outline-none transition-all w-32
                                                                    ${assessments[prop.zpid]?.tester ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 opacity-60'}
                                                                    ${savingZpids.has(prop.zpid) ? 'animate-pulse pointer-events-none' : ''}
                                                                `}
                                                            >
                                                                <option value="">Unassigned</option>
                                                                {allTesters.map(t => (
                                                                    <option key={t.uid} value={t.uid}>{t.displayName}</option>
                                                                ))}
                                                            </select>
                                                        </div>
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
                                                        <div className="text-[10px] font-bold text-slate-500">
                                                            {assessments[prop.zpid]?.last_update_date ? (
                                                                (() => {
                                                                    const d = assessments[prop.zpid].last_update_date;
                                                                    const date = d.toDate ? d.toDate() : new Date(d);
                                                                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                                                })()
                                                            ) : '--'}
                                                        </div>
                                                    </td>
                                                    <td className="p-6">
                                                        <div
                                                            onClick={() => setEditingComment({ zpid: prop.zpid, address: prop.address, comment: localComment })}
                                                            className={`min-h-[40px] max-h-[60px] p-3 rounded-xl border border-slate-100 bg-slate-50/50 cursor-pointer hover:bg-white hover:border-indigo-200 hover:shadow-sm transition-all overflow-hidden group/comment`}
                                                        >
                                                            {localComment ? (
                                                                <p className="text-[10px] text-slate-600 font-medium leading-relaxed line-clamp-2">
                                                                    {localComment}
                                                                </p>
                                                            ) : (
                                                                <div className="flex items-center gap-2 text-slate-400">
                                                                    <i className="fa-solid fa-plus text-[8px]"></i>
                                                                    <span className="text-[9px] font-black uppercase tracking-widest">Add Comment</span>
                                                                </div>
                                                            )}
                                                            <div className="absolute top-2 right-2 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                                                                <i className="fa-solid fa-pen-to-square text-indigo-400 text-[10px]"></i>
                                                            </div>
                                                        </div>
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

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="mt-8 flex items-center justify-between bg-white px-8 py-4 rounded-[2rem] border border-slate-200 shadow-sm mx-1">
                                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                        Showing <span className="text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * pageSize, filteredProperties.length)}</span> of <span className="text-slate-900">{filteredProperties.length}</span> properties
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                                        >
                                            <i className="fa-solid fa-chevron-left text-xs"></i>
                                        </button>

                                        <div className="flex items-center gap-1.5 px-4 font-black text-xs text-slate-800">
                                            <span className="text-indigo-600">{currentPage}</span>
                                            <span className="text-slate-300">/</span>
                                            <span>{totalPages}</span>
                                        </div>

                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                                        >
                                            <i className="fa-solid fa-chevron-right text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : activeTab === 'reports' ? (
                <div className="space-y-8">
                    {/* Report Filters */}
                    <div className="flex flex-wrap items-center gap-6 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                            <input
                                type="date"
                                value={reportStartDate}
                                onChange={(e) => setReportStartDate(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                            <input
                                type="date"
                                value={reportEndDate}
                                onChange={(e) => setReportEndDate(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <div className="ml-auto bg-indigo-50 px-6 py-3 rounded-2xl border border-indigo-100">
                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Total Assessments Period</div>
                            <div className="text-2xl font-black text-indigo-700">{reportData.reduce((acc, curr) => acc + curr.count, 0)}</div>
                        </div>
                    </div>

                    {/* Report Table */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-8 text-[11px] font-black text-slate-400 uppercase tracking-widest w-2/3">User / Auditor</th>
                                    <th className="p-8 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Properties Assessed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {reportData.length > 0 ? reportData.map((user) => (
                                    <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs font-black shadow-sm border border-indigo-100">
                                                    {user.userName.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-slate-900">{user.userName}</div>
                                                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{user.uid}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-8 text-right">
                                            <span className="text-lg font-black text-slate-900 bg-slate-100 px-4 py-1.5 rounded-xl border border-slate-200">
                                                {user.count}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={2} className="p-20 text-center">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                                <i className="fa-solid fa-calendar-xmark text-slate-200 text-xl"></i>
                                            </div>
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No assessments found in this date range</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-10 max-w-4xl mx-auto">
                    <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
                        <i className="fa-solid fa-file-invoice text-indigo-600"></i>
                        Property Validation Instructions
                    </h2>

                    <div className="space-y-10">
                        {/* Step 1 */}
                        <div className="flex gap-6">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black shrink-0 border border-indigo-100 shadow-sm">1</div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 mb-2">Access and Login</h3>
                                <ul className="space-y-2 text-slate-600 text-sm font-medium">
                                    <li className="flex items-center gap-2">
                                        <i className="fa-solid fa-circle-chevron-right text-[10px] text-indigo-400"></i>
                                        Navigate to <a href="/realtor" className="font-bold text-indigo-600 hover:underline">zyphe.ai/realtor</a>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <i className="fa-solid fa-circle-chevron-right text-[10px] text-indigo-400"></i>
                                        Create an account as a <span className="font-bold text-indigo-600">tester</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex gap-6">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black shrink-0 border border-indigo-100 shadow-sm">2</div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 mb-2">Locate the Property</h3>
                                <ul className="space-y-2 text-slate-600 text-sm font-medium">
                                    <li className="flex items-center gap-2">
                                        <i className="fa-solid fa-circle-chevron-right text-[10px] text-indigo-400"></i>
                                        Select the <span className="font-bold">AI Validation</span> tab from the top navigation.
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <i className="fa-solid fa-circle-chevron-right text-[10px] text-indigo-400"></i>
                                        Wait for the list of properties to load (organized by city).
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <i className="fa-solid fa-circle-chevron-right text-[10px] text-indigo-400"></i>
                                        Select any property and select your name in the <span className="font-bold">“Assigned To”</span> dropdown.
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <i className="fa-solid fa-circle-chevron-right text-[10px] text-indigo-400"></i>
                                        Click on any property in the list to open it in a new <a href="/" target="_blank" className="font-bold text-indigo-600 hover:underline">Explore</a> tab.
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex gap-6">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black shrink-0 border border-indigo-100 shadow-sm">3</div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 mb-2">Initial Data Verification (Zillow Comparison)</h3>
                                <ul className="space-y-2 text-slate-600 text-sm font-medium">
                                    <li className="flex items-center gap-2">
                                        <i className="fa-solid fa-circle-chevron-right text-[10px] text-indigo-400"></i>
                                        Open <a href="https://www.zillow.com" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 border-b-2 border-indigo-100 hover:bg-indigo-50 transition-colors">Zillow.com</a> and search for the same address.
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <i className="fa-solid fa-circle-chevron-right text-[10px] text-indigo-400"></i>
                                        <span className="font-bold">Photo Count:</span> Compare number of photos on Zyphe against Zillow.
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <i className="fa-solid fa-circle-chevron-right text-[10px] text-indigo-400"></i>
                                        <span className="font-bold">Detail Check:</span> Verify primary details shown on Zillow match Zyphe accurately.
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Step 4 */}
                        <div className="flex gap-6">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black shrink-0 border border-indigo-100 shadow-sm">4</div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 mb-2">Visual & AI Analysis Validation</h3>
                                <ul className="space-y-2 text-slate-600 text-sm font-medium">
                                    <li className="flex items-center gap-2">
                                        <i className="fa-solid fa-circle-chevron-right text-[10px] text-indigo-400"></i>
                                        Click <span className="font-bold italic">“View Visual Analysis”</span> button to review AI insights.
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <i className="fa-solid fa-circle-chevron-right text-[10px] text-indigo-400"></i>
                                        <span className="font-bold">Interior & Rooms:</span> Compare AI descriptions/tags against actual photos.
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <i className="fa-solid fa-circle-chevron-right text-[10px] text-indigo-400"></i>
                                        <span className="font-bold">Neighborhood:</span> Ensure property markings are correct on Google Maps.
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <i className="fa-solid fa-circle-chevron-right text-[10px] text-indigo-400"></i>
                                        <span className="font-bold">Image by image:</span> Verify each description against the specific image.
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <i className="fa-solid fa-circle-chevron-right text-[10px] text-indigo-400"></i>
                                        Click <span className="font-bold">Generate Full Report:</span> Verify the full report for accuracy based on the above steps.
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Step 5 */}
                        <div className="flex gap-6">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-black shrink-0 border border-emerald-100 shadow-sm">5</div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 mb-2">Completion</h3>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-medium text-slate-600">
                                    Once validated, mark the properties as <span className="text-emerald-600 font-bold">Good</span>, <span className="text-rose-600 font-bold">Bad</span>, or <span className="text-slate-600 font-bold underline decoration-slate-300">Other</span> in the AI validation tab. Add a comment and save.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reassignment Confirmation Modal */}
            {assignmentConfirm && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl border border-slate-100 animate-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500 border border-amber-100">
                            <i className="fa-solid fa-triangle-exclamation text-3xl"></i>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 text-center leading-tight mb-2">Reassign Auditor?</h3>
                        <p className="text-sm text-slate-500 text-center mb-8 px-4 font-medium">
                            This property is being validated. Are you sure you want to change the assignee?
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleAssignTester(assignmentConfirm.zpid, assignmentConfirm.address, assignmentConfirm.userId, true)}
                                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                            >
                                Yes, Change Assignee
                            </button>
                            <button
                                onClick={() => setAssignmentConfirm(null)}
                                className="w-full py-4 bg-slate-50 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all outline-none"
                            >
                                No, Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Comment Editing Modal */}
            {editingComment && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                    <i className="fa-solid fa-comment-dots text-xl"></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 leading-tight">Audit Narrative</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5 truncate max-w-[300px]">
                                        {editingComment.address}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingComment(null)}
                                className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center group"
                            >
                                <i className="fa-solid fa-xmark group-hover:rotate-90 transition-transform"></i>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observation Details (Max 100+ Words)</label>
                                <textarea
                                    autoFocus
                                    value={editingComment.comment}
                                    onChange={(e) => setEditingComment(prev => prev ? { ...prev, comment: e.target.value } : null)}
                                    placeholder="Synthesize your audit findings here. Be specific about visual discrepancies or AI hallucinations..."
                                    className="w-full min-h-[300px] p-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-sm text-slate-800 font-medium leading-relaxed outline-none focus:bg-white focus:border-indigo-500 transition-all resize-none shadow-inner"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-full">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Word Count:</span>
                                    <span className={`text-xs font-black ${editingComment.comment.split(/\s+/).filter(Boolean).length > 100 ? 'text-amber-600' : 'text-slate-900'}`}>
                                        {editingComment.comment.trim() === '' ? 0 : editingComment.comment.trim().split(/\s+/).length}
                                    </span>
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 italic">
                                    Changes will be staged until you "Apply Analysis"
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 bg-slate-50/50 border-t border-slate-50 flex items-center gap-4">
                            <button
                                onClick={async () => {
                                    const currentProp = properties.find(p => p.zpid === editingComment.zpid);
                                    const assessment = currentProp?.assessment || assessments[editingComment.zpid]?.assessment || 'other';
                                    await handleSaveAssessment(editingComment.zpid, editingComment.address, assessment as any, '');
                                    setEditingComment(null);
                                }}
                                disabled={savingZpids.has(editingComment.zpid)}
                                className="px-6 py-4 bg-white border border-rose-100 text-rose-500 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center gap-2 group disabled:opacity-50"
                            >
                                <i className={`fa-solid ${savingZpids.has(editingComment.zpid) ? 'fa-spinner animate-spin' : 'fa-trash-can group-hover:shake'}`}></i>
                                Delete Comment
                            </button>

                            <div className="flex-1"></div>

                            <button
                                onClick={() => setEditingComment(null)}
                                className="px-8 py-4 text-slate-400 font-black text-[11px] uppercase tracking-widest hover:text-slate-600 transition-all"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={async () => {
                                    const currentProp = properties.find(p => p.zpid === editingComment.zpid);
                                    const assessment = currentProp?.assessment || assessments[editingComment.zpid]?.assessment || 'other';
                                    await handleSaveAssessment(editingComment.zpid, editingComment.address, assessment as any, editingComment.comment);
                                    setEditingComment(null);
                                }}
                                disabled={savingZpids.has(editingComment.zpid)}
                                className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {savingZpids.has(editingComment.zpid) ? (
                                    <i className="fa-solid fa-spinner animate-spin"></i>
                                ) : (
                                    <i className="fa-solid fa-cloud-arrow-up text-indigo-400"></i>
                                )}
                                Save Narrative
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIValidationTab;
