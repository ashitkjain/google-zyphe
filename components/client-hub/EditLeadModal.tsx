import React, { useState } from 'react';
import { Lead, LeadNote } from '../../types';

interface EditLeadModalProps {
    editingLead: Lead;
    setEditingLead: (lead: Lead | null) => void;
    leads: Lead[];
    handleUpdateLead: (leadId: string, updates: Partial<Lead>) => void;
    isSavingLead: boolean;
    newNote: string;
    setNewNote: (note: string) => void;
}

const EditLeadModal: React.FC<EditLeadModalProps> = ({
    editingLead,
    setEditingLead,
    leads,
    handleUpdateLead,
    isSavingLead,
    newNote,
    setNewNote
}) => {
    const [showStatusInfo, setShowStatusInfo] = useState(false);

    const onSave = () => {
        if (editingLead) {
            // Mandatory Validation
            if (!editingLead.name.trim() || !editingLead.phone.trim()) {
                alert("Name and Phone Number are mandatory fields.");
                return;
            }

            const updatedLead = { ...editingLead };

            // Handle New Note
            if (newNote.trim()) {
                const noteEntry: LeadNote = {
                    id: crypto.randomUUID(),
                    content: newNote.trim(),
                    timestamp: new Date().toISOString(),
                    author: 'User'
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
                            {leads.some(l => l.id === editingLead.id) ? `Update profile for ${editingLead.name}` : 'Enter basic contact and property details'}
                        </p>
                    </div>
                    <button onClick={() => setEditingLead(null)} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all text-slate-400">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={editingLead.name}
                                onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                placeholder="John Doe"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
                            <input
                                type="email"
                                defaultValue={editingLead.email}
                                onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={editingLead.phone}
                                onChange={(e) => setEditingLead({ ...editingLead, phone: e.target.value })}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
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
                                        {[
                                            ["New", "Leads added to the system but not yet engaged."],
                                            ["Qualified", "Prospect meets criteria and is actively looking to buy/sell."],
                                            ["Attempted to Contact", "Agent has tried to reach out (call, email)."],
                                            ["Connected", "Successful initial contact made, prospect is aware and responding."],
                                            ["Appointment Scheduled", "A specific meeting or showing is booked."],
                                            ["Listing Agreement Sent/Signed", "For sellers, formal agreement is in process or completed."],
                                            ["Active", "Actively working with them on a transaction."],
                                            ["Closed-Won", "The deal is finalized."],
                                            ["Closed-Lost", "The lead is no longer viable, with reasons tracked."],
                                            ["Archived", "Not currently working; may be unsubscribed from marketing."]
                                        ].map(([status, desc]) => (
                                            <div key={status} className="text-xs">
                                                <div className="font-bold text-indigo-900 mb-0.5">{status}</div>
                                                <div className="text-slate-500 leading-snug">{desc}</div>
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
                                {['New', 'Qualified', 'Attempted to Contact', 'Connected', 'Appointment Scheduled', 'Listing Agreement Sent/Signed', 'Active', 'Closed-Won', 'Closed-Lost', 'Archived'].map(s => (
                                    <option key={s} value={s}>{s}</option>
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
                                defaultValue={editingLead.preferredContactMethod || 'Text'}
                                onChange={(e) => setEditingLead({ ...editingLead, preferredContactMethod: e.target.value as any })}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                            >
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
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Price ($)</label>
                                    <input
                                        type="number"
                                        defaultValue={editingLead.price}
                                        onChange={(e) => setEditingLead({ ...editingLead, price: Number(e.target.value) })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    />
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
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sq Ft</label>
                                <input
                                    type="number"
                                    defaultValue={editingLead.sqft}
                                    onChange={(e) => setEditingLead({ ...editingLead, sqft: Number(e.target.value) })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                />
                            </div>
                        </div>

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
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">User Message</label>
                        <textarea
                            defaultValue={editingLead.message}
                            onChange={(e) => setEditingLead({ ...editingLead, message: e.target.value })}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none min-h-[80px]"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Notes Log</label>
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 max-h-48 overflow-y-auto space-y-3">
                            {editingLead.notesLog && editingLead.notesLog.length > 0 ? (
                                editingLead.notesLog.map((note) => (
                                    <div key={note.id} className="bg-white p-3 rounded-lg border border-slate-100 text-xs shadow-sm">
                                        <div className="flex justify-between text-slate-400 text-[10px] mb-1">
                                            <span>{new Date(note.timestamp).toLocaleString()}</span>
                                            <span>{note.author || 'System'}</span>
                                        </div>
                                        <div className="text-slate-700 whitespace-pre-wrap">{note.content}</div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-slate-400 italic text-xs py-4">No notes recorded yet.</div>
                            )}
                        </div>
                        <textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            rows={2}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none resize-none mt-2"
                            placeholder="Add a new note..."
                        />
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
                        <div className="col-span-2 text-xs text-slate-400 text-right">
                            Last Updated: {editingLead.lastUpdated ? new Date(editingLead.lastUpdated).toLocaleString() : 'Never'}
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
