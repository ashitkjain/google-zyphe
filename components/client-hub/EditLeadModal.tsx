import React, { useState } from 'react';
import { Lead, LeadNote, UserProfile } from '../../types';
import { getStatusOptions, getStatusDefinitions } from '../../services/statusService';

interface EditLeadModalProps {
    editingLead: Lead;
    setEditingLead: (lead: Lead | null) => void;
    leads: Lead[];
    handleUpdateLead: (leadId: string, updates: Partial<Lead>) => void;
    isSavingLead: boolean;
    newNote: string;
    setNewNote: (note: string) => void;
    realtorSettings?: UserProfile['settings'];
}

const EditLeadModal: React.FC<EditLeadModalProps> = ({
    editingLead,
    setEditingLead,
    leads,
    handleUpdateLead,
    isSavingLead,
    newNote,
    setNewNote,
    realtorSettings
}) => {
    const [showStatusInfo, setShowStatusInfo] = useState(false);
    const [noteColor, setNoteColor] = useState('bg-[#ffff88] text-slate-800 border-[#eeee77] shadow-[5px_5px_7px_rgba(33,33,33,.1)]');

    const noteTypes = [
        { id: 'note-yellow', color: 'bg-[#ffff88] text-slate-800 border-[#eeee77]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
        { id: 'note-blue', color: 'bg-[#7afaff] text-slate-800 border-[#69e9ee]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
        { id: 'note-pink', color: 'bg-[#ff7eb9] text-white border-[#ee6da8]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
        { id: 'note-green', color: 'bg-[#a7ffeb] text-slate-800 border-[#96eee0]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
    ];

    const onSave = () => {
        if (editingLead) {
            // Mandatory Validation
            if (!editingLead.firstName.trim() || !editingLead.lastName.trim() || !editingLead.phone.trim()) {
                alert("First Name, Last Name, and Phone Number are mandatory fields.");
                return;
            }

            const updatedLead = { ...editingLead };

            // Handle New Note
            if (newNote.trim()) {
                const noteEntry: LeadNote = {
                    id: crypto.randomUUID(),
                    content: newNote.trim(),
                    timestamp: new Date().toISOString(),
                    author: 'User',
                    color: noteColor
                };
                updatedLead.notesLog = [...(updatedLead.notesLog || []), noteEntry];
                updatedLead.notes = newNote.trim(); // Update latest note for list view
            }

            handleUpdateLead(updatedLead.id, updatedLead);
            setNewNote(''); // Clear input
            setEditingLead(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900">{leads.some(l => l.id === editingLead.id) ? 'Edit Lead Data' : 'Create New Lead'}</h3>
                        <p className="text-sm text-slate-500 font-medium">
                            {leads.some(l => l.id === editingLead.id)
                                ? (editingLead.firstName || editingLead.lastName ? `Update profile for ${editingLead.firstName || ''} ${editingLead.lastName || ''}` : 'Update lead details')
                                : 'Enter basic contact and property details'}
                        </p>
                    </div>
                    <button onClick={() => setEditingLead(null)} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all text-slate-400">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="grid grid-cols-2 gap-4 col-span-2">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">First Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={editingLead.firstName}
                                    onChange={(e) => setEditingLead({ ...editingLead, firstName: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    placeholder="John"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Last Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={editingLead.lastName}
                                    onChange={(e) => setEditingLead({ ...editingLead, lastName: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    placeholder="Doe"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
                            <input
                                type="email"
                                defaultValue={editingLead.email}
                                onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                                className={`w-full px-5 py-4 bg-slate-50 border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none ${editingLead.preferredContactMethod === 'Email' ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10' : 'border-slate-100'}`}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={editingLead.phone}
                                onChange={(e) => setEditingLead({ ...editingLead, phone: e.target.value })}
                                className={`w-full px-5 py-4 bg-slate-50 border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none ${['Text', 'Call'].includes(editingLead.preferredContactMethod || '') ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10' : 'border-slate-100'}`}
                                placeholder="(555) 000-0000"
                            />
                        </div>
                        <div className="space-y-2 relative">
                            <div className="flex items-center gap-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Lead Status</label>
                                <div
                                    className="inline-flex self-center text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowStatusInfo(!showStatusInfo);
                                    }}
                                >
                                    <i className="fa-solid fa-circle-info text-[10px]"></i>
                                </div>
                            </div>

                            {showStatusInfo && (
                                <div className="absolute top-6 left-0 w-80 bg-white shadow-xl rounded-xl border border-slate-200 p-4 z-50 mt-2 text-left cursor-default" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                                        <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide">Status Definitions</h4>
                                        <button onClick={() => setShowStatusInfo(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
                                    </div>
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                        <div className="text-[10px] font-black text-indigo-500 uppercase mb-2">Buyer Statuses</div>
                                        {Object.entries(getStatusDefinitions('Buyer', realtorSettings)).map(([status, desc]) => (
                                            <div key={`buyer-${status}`} className="text-xs mb-2">
                                                <div className="font-bold text-indigo-900 mb-0.5">{status}</div>
                                                <div className="text-slate-500 leading-snug">{desc as string}</div>
                                            </div>
                                        ))}
                                        <div className="text-[10px] font-black text-emerald-500 uppercase mt-4 mb-2">Seller Statuses</div>
                                        {Object.entries(getStatusDefinitions('Seller', realtorSettings)).map(([status, desc]) => (
                                            <div key={`seller-${status}`} className="text-xs mb-2">
                                                <div className="font-bold text-emerald-900 mb-0.5">{status}</div>
                                                <div className="text-slate-500 leading-snug">{desc as string}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <select
                                defaultValue={editingLead.status}
                                onChange={(e) => setEditingLead({ ...editingLead, status: e.target.value as any })}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                            >
                                {getStatusOptions(editingLead.leadType, realtorSettings).map((o: any) => (
                                    <option key={o.label} value={o.label}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Lead Type</label>
                            <select
                                defaultValue={editingLead.leadType}
                                onChange={(e) => setEditingLead({ ...editingLead, leadType: e.target.value as any })}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                            >
                                {['Buyer', 'Seller', 'Rental', 'Mortgage'].map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Preferred Contact</label>
                            <select
                                defaultValue={editingLead.preferredContactMethod || ''}
                                onChange={(e) => setEditingLead({ ...editingLead, preferredContactMethod: e.target.value as any })}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                            >
                                <option value="">Select Method...</option>
                                {['Call', 'Text', 'Email'].map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2 col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Subject Property Address</label>
                            <input
                                type="text"
                                defaultValue={editingLead.propertyAddress}
                                onChange={(e) => setEditingLead({ ...editingLead, propertyAddress: e.target.value })}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                placeholder="123 Example St, City, State"
                            />
                        </div>

                        {/* Property Details Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Property Type</label>
                                <input
                                    type="text"
                                    defaultValue={editingLead.propertyType}
                                    onChange={(e) => setEditingLead({ ...editingLead, propertyType: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    placeholder="Single Family"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">MLS Number</label>
                                <input
                                    type="text"
                                    defaultValue={editingLead.mlsNumber}
                                    onChange={(e) => setEditingLead({ ...editingLead, mlsNumber: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    placeholder="MLS12345"
                                />
                            </div>
                        </div>

                        {/* Property Specs Row */}
                        <div className="grid grid-cols-4 gap-4 col-span-2">
                            {(editingLead.collectionName === 'buyers' || editingLead.leadType === 'Buyer') ? (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Min Price ($)</label>
                                        <input
                                            type="number"
                                            defaultValue={editingLead.minPrice}
                                            onChange={(e) => setEditingLead({ ...editingLead, minPrice: Number(e.target.value) })}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Max Price ($)</label>
                                        <input
                                            type="number"
                                            defaultValue={editingLead.maxPrice}
                                            onChange={(e) => setEditingLead({ ...editingLead, maxPrice: Number(e.target.value) })}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-2 col-span-2 grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">List Price ($)</label>
                                        <input
                                            type="number"
                                            defaultValue={editingLead.price}
                                            onChange={(e) => setEditingLead({ ...editingLead, price: Number(e.target.value) })}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Expected Price ($)</label>
                                        <input
                                            type="number"
                                            defaultValue={editingLead.expectedPrice}
                                            onChange={(e) => setEditingLead({ ...editingLead, expectedPrice: Number(e.target.value) })}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Beds</label>
                                <input
                                    type="number"
                                    defaultValue={editingLead.bedrooms}
                                    onChange={(e) => setEditingLead({ ...editingLead, bedrooms: Number(e.target.value) })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Baths</label>
                                <input
                                    type="number"
                                    defaultValue={editingLead.bathrooms}
                                    onChange={(e) => setEditingLead({ ...editingLead, bathrooms: Number(e.target.value) })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                />
                            </div>
                        </div>

                        {/* Additional Lead Context */}
                        <div className="col-span-2 pt-4 border-t border-slate-100">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-4 ml-1">Lead Context & Preferences</h4>
                            <div className="grid grid-cols-2 gap-6">
                                {(editingLead.leadType === 'Buyer' || editingLead.leadType === 'Rental') ? (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Preferred Neighborhood</label>
                                            <input
                                                type="text"
                                                defaultValue={editingLead.preferredNeighborhood}
                                                onChange={(e) => setEditingLead({ ...editingLead, preferredNeighborhood: e.target.value })}
                                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                                placeholder="e.g. Downtown, Westside"
                                            />
                                        </div>
                                        <div className="flex gap-4 items-center h-full pt-4">
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={editingLead.isAlsoSelling}
                                                    onChange={(e) => setEditingLead({ ...editingLead, isAlsoSelling: e.target.checked })}
                                                    className="w-5 h-5 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                                <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Also Selling?</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={editingLead.preQualified}
                                                    onChange={(e) => setEditingLead({ ...editingLead, preQualified: e.target.checked })}
                                                    className="w-5 h-5 rounded-lg border-slate-200 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                />
                                                <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Pre-qualified?</span>
                                            </label>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sell When?</label>
                                            <input
                                                type="text"
                                                defaultValue={editingLead.sellWhen}
                                                onChange={(e) => setEditingLead({ ...editingLead, sellWhen: e.target.value })}
                                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                                placeholder="e.g. ASAP, 3-6 months"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Occupancy Status</label>
                                            <input
                                                type="text"
                                                defaultValue={editingLead.occupancyStatus}
                                                onChange={(e) => setEditingLead({ ...editingLead, occupancyStatus: e.target.value })}
                                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                                placeholder="e.g. Owner Occupied, Tenant"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Most Important to Seller</label>
                                            <input
                                                type="text"
                                                defaultValue={editingLead.mostImportantToSeller}
                                                onChange={(e) => setEditingLead({ ...editingLead, mostImportantToSeller: e.target.value })}
                                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                                placeholder="e.g. Speed, Profit, Terms"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Reason For Selling</label>
                                            <input
                                                type="text"
                                                defaultValue={editingLead.reasonForSelling}
                                                onChange={(e) => setEditingLead({ ...editingLead, reasonForSelling: e.target.value })}
                                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                                placeholder="e.g. Relocation, Upsizing"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Existing Agent?</label>
                                            <input
                                                type="text"
                                                defaultValue={editingLead.existingAgentName}
                                                onChange={(e) => setEditingLead({ ...editingLead, existingAgentName: e.target.value })}
                                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                                placeholder="e.g. None, John Smith"
                                            />
                                        </div>
                                        <div className="flex gap-4 items-center h-full pt-4">
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={editingLead.isAlsoBuying}
                                                    onChange={(e) => setEditingLead({ ...editingLead, isAlsoBuying: e.target.checked })}
                                                    className="w-5 h-5 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                                <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Also Buying?</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={editingLead.homeValueNeeded}
                                                    onChange={(e) => setEditingLead({ ...editingLead, homeValueNeeded: e.target.checked })}
                                                    className="w-5 h-5 rounded-lg border-slate-200 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                />
                                                <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Home Value Needed?</span>
                                            </label>
                                        </div>
                                    </>
                                )}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Lead Readiness / Timeframe</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 1-3 months"
                                        defaultValue={editingLead.timeframe}
                                        onChange={(e) => setEditingLead({ ...editingLead, timeframe: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">User Message</label>
                        <textarea
                            defaultValue={editingLead.message}
                            onChange={(e) => setEditingLead({ ...editingLead, message: e.target.value })}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none min-h-[80px]"
                        />
                    </div>
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <style dangerouslySetInnerHTML={{
                            __html: `
                            @import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap');
                            .post-it-font {
                                font-family: 'Architects Daughter', cursive;
                                line-height: 1.2;
                            }
                            `}} />
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes Log</label>
                            <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">New Note Color:</span>
                                <div className="flex gap-1.5">
                                    {noteTypes.map((type) => (
                                        <button
                                            key={type.id}
                                            onClick={() => setNoteColor(`${type.color} ${type.shadow}`)}
                                            className={`w-4 h-4 rounded-full border border-black/5 transition-all hover:scale-125 ${type.color} ${noteColor.includes(type.color) ? 'ring-2 ring-indigo-500 ring-offset-2 scale-110' : 'opacity-60'}`}
                                            title={type.id.replace('note-', '')}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-6 max-h-[400px] overflow-y-auto">
                            <div className="flex flex-wrap gap-4">
                                {editingLead.notesLog && editingLead.notesLog.length > 0 ? (
                                    [...editingLead.notesLog].reverse().map((note, i) => (
                                        <div
                                            key={note.id}
                                            className={`p-4 pt-5 w-32 h-32 rounded-sm border-t border-black/5 text-[12px] font-bold post-it-font whitespace-normal shadow-lg transition-all hover:scale-105 group/note flex flex-col relative ${note.color || 'bg-[#ffff88] text-slate-800 border-[#eeee77] shadow-[5px_5px_7px_rgba(33,33,33,.1)]'} ${i % 2 === 0 ? 'rotate-1' : '-rotate-1'} hover:rotate-0`}
                                        >
                                            <div className="flex justify-between text-[7px] opacity-40 mb-1 font-sans uppercase tracking-tighter">
                                                <span>{new Date(note.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                <span>{note.author || 'System'}</span>
                                            </div>
                                            <div className="text-slate-800 line-clamp-6 leading-tight flex-1">{note.content}</div>

                                            <button
                                                onClick={() => {
                                                    const updatedNotesLog = editingLead.notesLog?.filter(n => n.id !== note.id);
                                                    setEditingLead({ ...editingLead, notesLog: updatedNotesLog });
                                                }}
                                                className="absolute top-1 right-1 opacity-0 group-hover/note:opacity-100 transition-opacity text-slate-400 hover:text-red-500 p-1"
                                            >
                                                <i className="fa-solid fa-trash-can text-[8px]"></i>
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="w-full text-center text-slate-300 italic text-xs py-8">No notes recorded yet. Add one below!</div>
                                )}
                            </div>
                        </div>

                        <div className="relative">
                            <textarea
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                rows={3}
                                className={`w-full px-6 py-5 rounded-[2rem] text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none resize-none border-t border-black/5 post-it-font ${noteColor}`}
                                placeholder="Type a new post-it note..."
                            />
                            <div className="absolute top-2 right-4 flex items-center gap-1 opacity-20">
                                <i className="fa-solid fa-note-sticky text-xs"></i>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tags</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {editingLead.tags?.map((tag, index) => (
                                <span key={index} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold flex items-center gap-2">
                                    {tag}
                                    <button onClick={() => {
                                        const newTags = editingLead.tags?.filter((_, i) => i !== index);
                                        setEditingLead({ ...editingLead, tags: newTags });
                                    }} className="hover:text-indigo-800"><i className="fa-solid fa-xmark"></i></button>
                                </span>
                            ))}
                        </div>
                        <input
                            type="text"
                            placeholder="Add tag and press Enter..."
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = e.currentTarget.value.trim();
                                    if (val) {
                                        const currentTags = editingLead.tags || [];
                                        if (!currentTags.includes(val)) {
                                            setEditingLead({ ...editingLead, tags: [...currentTags, val] });
                                        }
                                        e.currentTarget.value = '';
                                    }
                                }
                            }}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                        />
                    </div>

                    {/* System Fields */}
                    <div className="grid grid-cols-2 gap-4 col-span-2 pt-4 border-t border-slate-100">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Assigned To</label>
                            <input
                                type="text"
                                defaultValue={editingLead.assignedTo}
                                onChange={(e) => setEditingLead({ ...editingLead, assignedTo: e.target.value })}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                placeholder="Team Member"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Channel</label>
                            <select
                                defaultValue={editingLead.channel || 'Manual'}
                                onChange={(e) => setEditingLead({ ...editingLead, channel: e.target.value as any })}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                            >
                                {['Email', 'API', 'Manual', 'CRM', 'Others'].map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-span-2 text-xs text-slate-400 text-right flex flex-col gap-0.5">
                            <div>Created At: {editingLead.receivedAt ? (editingLead.receivedAt?.toDate ? editingLead.receivedAt.toDate().toLocaleString() : new Date(editingLead.receivedAt).toLocaleString()) : 'Unknown'}</div>
                            <div>Last Updated: {editingLead.lastUpdated ? (editingLead.lastUpdated?.toDate ? editingLead.lastUpdated.toDate().toLocaleString() : new Date(editingLead.lastUpdated).toLocaleString()) : 'Never'}</div>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-slate-50 flex items-center justify-between">
                    <button onClick={() => setEditingLead(null)} className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-all underline underline-offset-4">Cancel Changes</button>
                    <button
                        onClick={onSave}
                        disabled={isSavingLead}
                        className="bg-indigo-600 text-white px-10 py-5 rounded-[2rem] text-xs font-black shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
                    >
                        {isSavingLead ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
                        {isSavingLead ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditLeadModal;
