import React, { useState } from 'react';
import { UserProfile, Lead, KYCData, DocumentChecklistItem } from '../../types';

interface KYCModalProps {
    lead: Lead | UserProfile;
    onClose: () => void;
    onSave: (updates: any) => void;
}

const KYCModal: React.FC<KYCModalProps> = ({ lead, onClose, onSave }) => {
    // Type Helper
    const isUser = (c: UserProfile | Lead): c is UserProfile => 'uid' in c;
    const getName = () => isUser(lead) ? lead.displayName : `${lead.firstName} ${lead.lastName}`;
    const getPhone = () => isUser(lead) ? lead.phoneNumber : lead.phone;
    const getSource = () => isUser(lead) ? 'Zyphe Platform' : lead.source;

    const [activeTab, setActiveTab] = useState<'preferences' | 'management' | 'pipeline'>('preferences');
    const [kyc, setKyc] = useState<KYCData>(lead.kyc || {
        dealBreakers: [],
        neighborhoodTargets: [],
        schoolDistricts: [],
        documentChecklist: [
            { id: '1', name: 'Buyer Broker Agreement', status: 'Missing' },
            { id: '2', name: 'Lead-Based Paint Disclosure', status: 'Missing' },
            { id: '3', name: 'HOA Disclosures', status: 'Missing' }
        ]
    });

    const [basicInfo, setBasicInfo] = useState({
        firstName: isUser(lead) ? (lead.displayName || '').split(' ')[0] : lead.firstName,
        lastName: isUser(lead) ? (lead.displayName || '').split(' ').slice(1).join(' ') : lead.lastName,
        email: lead.email,
        phone: isUser(lead) ? lead.phoneNumber || '' : lead.phone || '',
        minPrice: lead.minPrice || 0,
        maxPrice: lead.maxPrice || 0,
        bedrooms: (lead as any).bedrooms || 0,
        bathrooms: (lead as any).bathrooms || 0,
        preApprovalStatus: (lead as any).preApprovalStatus || false,
    });

    const handleFieldChange = (field: keyof KYCData, value: any) => {
        setKyc(prev => ({ ...prev, [field]: value }));
    };

    const handleBasicChange = (field: string, value: any) => {
        setBasicInfo(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        onSave({ ...basicInfo, kyc });
        onClose();
    };

    const tabs = [
        { id: 'preferences', label: '1. Profiles & Preferences', icon: 'fa-user-gear' },
        { id: 'management', label: '2. Lead Management', icon: 'fa-gauge-high' },
        { id: 'pipeline', label: '3. Transaction Pipeline', icon: 'fa-map-location-dot' }
    ];

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                            <i className="fa-solid fa-passport text-xl"></i>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Know Your Customer (KYC)</h3>
                            <p className="text-sm text-slate-500 font-medium flex items-center gap-2">
                                Comprehensive profile for <span className="text-indigo-600 font-bold">{getName()}</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-200 flex items-center justify-center transition-all text-slate-400 hover:text-slate-600 border border-slate-200">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex px-8 border-b border-slate-100 bg-white">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className={`fa-solid ${tab.icon}`}></i>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-white">
                    {activeTab === 'preferences' && (
                        <div className="grid grid-cols-2 gap-8 animate-in slide-in-from-left duration-300">
                            {/* Section: Identity */}
                            <div className="space-y-4 col-span-2 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                                <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2 border-b border-indigo-100/20 pb-2">
                                    <i className="fa-solid fa-id-card"></i> Core Identity
                                </h4>
                                <div className="grid grid-cols-3 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">First Name</label>
                                        <input
                                            type="text"
                                            value={basicInfo.firstName}
                                            onChange={(e) => handleBasicChange('firstName', e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Last Name</label>
                                        <input
                                            type="text"
                                            value={basicInfo.lastName}
                                            onChange={(e) => handleBasicChange('lastName', e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Email Address</label>
                                        <input
                                            type="email"
                                            value={basicInfo.email}
                                            onChange={(e) => handleBasicChange('email', e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Phone Number</label>
                                        <input
                                            type="text"
                                            value={basicInfo.phone}
                                            onChange={(e) => handleBasicChange('phone', e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section: Must-Haves */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2 border-b border-indigo-50 pb-2">
                                    <i className="fa-solid fa-house-circle-check"></i> Property Must-Haves
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Budget Range</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                placeholder="Min"
                                                value={basicInfo.minPrice || ''}
                                                onChange={(e) => handleBasicChange('minPrice', parseInt(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                            <input
                                                type="number"
                                                placeholder="Max"
                                                value={basicInfo.maxPrice || ''}
                                                onChange={(e) => handleBasicChange('maxPrice', parseInt(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Beds / Baths</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                placeholder="Beds"
                                                value={basicInfo.bedrooms || ''}
                                                onChange={(e) => handleBasicChange('bedrooms', parseInt(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                            <input
                                                type="number"
                                                step="0.5"
                                                placeholder="Baths"
                                                value={basicInfo.bathrooms || ''}
                                                onChange={(e) => handleBasicChange('bathrooms', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Specific Deal-Breakers</label>
                                    <textarea
                                        value={kyc.dealBreakers?.join(', ') || ''}
                                        onChange={(e) => handleFieldChange('dealBreakers', e.target.value.split(',').map(s => s.trim()))}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                                        placeholder="e.g. No pool, needs home office, no busy roads"
                                    />
                                </div>
                            </div>

                            {/* Section: Neighborhood */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2 border-b border-indigo-50 pb-2">
                                    <i className="fa-solid fa-map-location"></i> Neighborhood Targets
                                </h4>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Target Zip Codes / Cities</label>
                                    <input
                                        type="text"
                                        value={kyc.neighborhoodTargets?.join(', ') || ''}
                                        onChange={(e) => handleFieldChange('neighborhoodTargets', e.target.value.split(',').map(s => s.trim()))}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="e.g. 80202, Highlands, Cherry Creek"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">School Districts</label>
                                    <input
                                        type="text"
                                        value={kyc.schoolDistricts?.join(', ') || ''}
                                        onChange={(e) => handleFieldChange('schoolDistricts', e.target.value.split(',').map(s => s.trim()))}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="e.g. Denver Public Schools, Cherry Creek 5"
                                    />
                                </div>
                            </div>

                            {/* Section: Financial Readiness */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2 border-b border-indigo-50 pb-2">
                                    <i className="fa-solid fa-wallet"></i> Financial Readiness
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Pre-Approval Status</label>
                                        <div className="flex items-center gap-4 py-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={basicInfo.preApprovalStatus}
                                                    onChange={(e) => handleBasicChange('preApprovalStatus', e.target.checked)}
                                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                                <span className="text-xs font-bold text-slate-700">Pre-Approved</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={kyc.isAllCash}
                                                    onChange={(e) => handleFieldChange('isAllCash', e.target.checked)}
                                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-xs font-bold text-slate-700">All-Cash</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Lender Information</label>
                                        <input
                                            type="text"
                                            value={kyc.lenderName || ''}
                                            onChange={(e) => handleFieldChange('lenderName', e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Bank Name / Agent"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section: Life Events */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2 border-b border-indigo-50 pb-2">
                                    <i className="fa-solid fa-cake-candles"></i> Life Events & Family
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Key Birthdays</label>
                                        <input
                                            type="text"
                                            value={kyc.birthdays || ''}
                                            onChange={(e) => handleFieldChange('birthdays', e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="e.g. John (May 12), Sparky (Pet)"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Purchase Anniversaries</label>
                                        <input
                                            type="text"
                                            value={kyc.homeAnniversary || ''}
                                            onChange={(e) => handleFieldChange('homeAnniversary', e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="e.g. Move-in: June 20th"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section: Communication */}
                            <div className="space-y-4 col-span-2">
                                <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2 border-b border-indigo-50 pb-2">
                                    <i className="fa-solid fa-comments"></i> Communication Style
                                </h4>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Preferences & Availability</label>
                                    <textarea
                                        value={kyc.communicationPreferenceNotes || ''}
                                        onChange={(e) => handleFieldChange('communicationPreferenceNotes', e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none min-h-[60px]"
                                        placeholder="Does the client prefer WhatsApp, text, or a 7:00 PM phone call?"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'management' && (
                        <div className="grid grid-cols-2 gap-8 animate-in slide-in-from-right duration-300">
                            {/* Lead Analytics */}
                            <div className="space-y-6">
                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                                    <div>
                                        <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Lead Source</div>
                                        <div className="text-xl font-black text-slate-900">{getSource()}</div>
                                    </div>
                                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-600 shadow-sm">
                                        <i className="fa-solid fa-satellite-dish"></i>
                                    </div>
                                </div>

                                <div className="p-6 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-100 flex items-center justify-between">
                                    <div>
                                        <div className="text-[10px] font-black uppercase opacity-60 mb-1">Lead Score Override</div>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                value={kyc.leadScore || 85}
                                                onChange={(e) => handleFieldChange('leadScore', parseInt(e.target.value) || 0)}
                                                className="bg-transparent text-3xl font-black tracking-tighter w-20 outline-none border-b border-white/30 focus:border-white"
                                            />
                                            <span className="text-3xl font-black tracking-tighter">%</span>
                                            <div className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-black uppercase">Manual Adjustment</div>
                                        </div>
                                    </div>
                                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                                        <i className="fa-solid fa-fire-flame-curved text-xl"></i>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Speed-to-Lead (SLA Tracking)</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="text-[8px] font-black uppercase text-slate-400">Response Target (Mins)</div>
                                            <input
                                                type="number"
                                                value={kyc.slaMinutesTarget || 15}
                                                onChange={(e) => handleFieldChange('slaMinutesTarget', parseInt(e.target.value) || 0)}
                                                className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none"
                                            />
                                        </div>
                                        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                                            <div className="text-[8px] font-black uppercase text-rose-400">Status</div>
                                            <div className="text-sm font-bold text-rose-600 flex items-center gap-2">
                                                <i className="fa-solid fa-flag"></i> Exceeded
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Nurture Status */}
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2 border-b border-indigo-50 pb-2">
                                        <i className="fa-solid fa-seedling"></i> Nurture Stage Detail
                                    </h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['Cold', 'Warm', 'Hot'].map(stage => (
                                            <button
                                                key={stage}
                                                onClick={() => handleFieldChange('nurtureDetail', stage)}
                                                className={`py-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${kyc.nurtureDetail === stage ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                                            >
                                                <i className={`fa-solid ${stage === 'Hot' ? 'fa-fire' : stage === 'Warm' ? 'fa-sun' : 'fa-snowflake'} text-lg`}></i>
                                                <span className="text-[10px] font-black uppercase tracking-widest">{stage}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[10px] font-medium text-slate-500 italic">
                                        {kyc.nurtureDetail === 'Hot' ? "Ready to tour/offer immediately." : kyc.nurtureDetail === 'Warm' ? "Interviewing agents, planning for next 30 days." : "Initial browsing/discovery phase."}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'pipeline' && (
                        <div className="space-y-8 animate-in slide-in-from-bottom duration-300">
                            {/* Current Stage */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2 border-b border-indigo-50 pb-2">
                                    <i className="fa-solid fa-signs-post"></i> Current Pipeline Roadmap
                                </h4>
                                <div className="flex items-center justify-between relative px-2">
                                    <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 -z-10"></div>
                                    {['Listing', 'Under Contract', 'Inspection', 'Appraisal', 'Closing'].map((stage, i) => {
                                        const isCompleted = ['Listing', 'Under Contract', 'Inspection', 'Appraisal', 'Closing'].indexOf(kyc.transactionStage || 'Listing') >= i;
                                        return (
                                            <button
                                                key={stage}
                                                onClick={() => handleFieldChange('transactionStage', stage)}
                                                className="flex flex-col items-center gap-3 group"
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border-4 shadow-sm ${isCompleted ? 'bg-indigo-600 border-indigo-100 text-white' : 'bg-white border-slate-100 text-slate-300'}`}>
                                                    <i className={`fa-solid ${isCompleted ? 'fa-check' : 'fa-circle-dot'} text-[10px]`}></i>
                                                </div>
                                                <span className={`text-[9px] font-black uppercase tracking-tight ${isCompleted ? 'text-indigo-600' : 'text-slate-400'}`}>{stage}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                {/* Critical Deadlines */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2 border-b border-indigo-50 pb-2">
                                        <i className="fa-solid fa-clock"></i> Critical Deadlines (Contingencies)
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="text-[10px] font-black uppercase text-slate-600">Inspection Period</div>
                                            <input
                                                type="date"
                                                value={kyc.inspectionDeadline || ''}
                                                onChange={(e) => handleFieldChange('inspectionDeadline', e.target.value)}
                                                className="bg-transparent text-xs font-bold text-indigo-600 outline-none"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="text-[10px] font-black uppercase text-slate-600">Appraisal Deadline</div>
                                            <input
                                                type="date"
                                                value={kyc.appraisalDeadline || ''}
                                                onChange={(e) => handleFieldChange('appraisalDeadline', e.target.value)}
                                                className="bg-transparent text-xs font-bold text-indigo-600 outline-none"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="text-[10px] font-black uppercase text-slate-600">Loan Commitment</div>
                                            <input
                                                type="date"
                                                value={kyc.loanCommitmentDeadline || ''}
                                                onChange={(e) => handleFieldChange('loanCommitmentDeadline', e.target.value)}
                                                className="bg-transparent text-xs font-bold text-indigo-600 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Document Checklist */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2 border-b border-indigo-50 pb-2">
                                        <i className="fa-solid fa-file-signature"></i> Document Checklist
                                    </h4>
                                    <div className="space-y-2">
                                        {kyc.documentChecklist?.map(item => (
                                            <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${item.status === 'Signed' ? 'bg-emerald-500' : item.status === 'Pending' ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
                                                    <span className="text-[10px] font-bold text-slate-700">{item.name}</span>
                                                </div>
                                                <select
                                                    value={item.status}
                                                    onChange={(e) => {
                                                        const newList = kyc.documentChecklist?.map(i => i.id === item.id ? { ...i, status: e.target.value as any } : i);
                                                        handleFieldChange('documentChecklist', newList);
                                                    }}
                                                    className="bg-transparent text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer"
                                                >
                                                    <option value="Signed">Signed</option>
                                                    <option value="Pending">Pending</option>
                                                    <option value="Missing">Missing</option>
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <button onClick={onClose} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Discard Draft</button>
                    <button
                        onClick={handleSave}
                        className="bg-indigo-600 text-white px-10 py-5 rounded-[2rem] text-xs font-black shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                    >
                        <i className="fa-solid fa-cloud-arrow-up"></i>
                        Complete KYC Profile
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KYCModal;
