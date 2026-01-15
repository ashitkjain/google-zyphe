import React, { useState } from 'react';
import { Lead } from '../../types';
import { getStatusOptions, getStatusDefinitions } from '../../services/statusService';

interface EditLeadModalProps {
    editingLead: Lead;
    setEditingLead: (lead: Lead | null) => void;
    leads: Lead[];
    handleUpdateLead: (leadId: string, updates: Partial<Lead>) => void;
    isSavingLead: boolean;
    newNote: string;
    setNewNote: (note: string) => void;
    realtorSettings?: any;
    handleAddNote?: (leadId: string, content: string, color: string) => Promise<string | undefined>;
    handleDeleteNote?: (noteId: string) => Promise<void>;
}

type FieldType = 'text' | 'number' | 'email' | 'select' | 'textarea' | 'checkbox' | 'date' | 'badge';

interface FieldConfig {
    key: keyof Lead | 'callTracker'; // callTracker is a pseudo-field
    label?: string;
    type?: FieldType;
    placeholder?: string;
    options?: string[];
    required?: boolean;
    colSpan?: 1 | 2;
    showIf?: (lead: Lead) => boolean;
    render?: (props: any) => React.ReactNode; // Custom render function
}

interface SectionConfig {
    id: string;
    title?: string;
    fields: FieldConfig[];
}

const EditLeadModal: React.FC<EditLeadModalProps> = ({
    editingLead,
    setEditingLead,
    leads,
    handleUpdateLead,
    isSavingLead,
    newNote,
    setNewNote,
    realtorSettings,
    handleAddNote,
    handleDeleteNote
}) => {
    const [showStatusInfo, setShowStatusInfo] = useState(false);
    const [noteColor, setNoteColor] = useState('bg-[#ffff88] text-slate-800 border-[#eeee77] shadow-[5px_5px_7px_rgba(33,33,33,.1)]');

    const noteTypes = [
        { id: 'note-yellow', color: 'bg-[#ffff88] text-slate-800 border-[#eeee77]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
        { id: 'note-blue', color: 'bg-[#7afaff] text-slate-800 border-[#69e9ee]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
        { id: 'note-pink', color: 'bg-[#ff7eb9] text-white border-[#ee6da8]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
        { id: 'note-green', color: 'bg-[#a7ffeb] text-slate-800 border-[#96eee0]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
    ];

    // --- Dynamic Form Configuration ---
    const FORM_SECTIONS: SectionConfig[] = [
        {
            id: 'identity',
            fields: [
                { key: 'firstName', label: 'First Name', type: 'text', required: true, placeholder: 'John' },
                { key: 'lastName', label: 'Last Name', type: 'text', required: true, placeholder: 'Doe' },
                {
                    key: 'clientId', label: 'Client ID', type: 'badge', colSpan: 2,
                    showIf: (l) => !!l.clientId,
                    render: (props) => (
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-2xl border border-slate-200/50">
                            <i className="fa-solid fa-id-badge text-xs text-slate-400"></i>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Client ID:</span>
                            <span className="text-xs font-bold font-mono tracking-tight text-slate-900">{props.value}</span>
                        </div>
                    )
                },
                { key: 'avatarUrl', label: 'Profile Photo URL', type: 'text', colSpan: 2, placeholder: 'https://example.com/photo.jpg' }
            ]
        },
        {
            id: 'contact',
            fields: [
                { key: 'email', label: 'Email Address', type: 'email', placeholder: 'client@example.com' },
                { key: 'phone', label: 'Phone Number', type: 'text', required: true, placeholder: '(555) 000-0000' },
                { key: 'homeAddress', label: 'Home / Mailing Address', type: 'text', colSpan: 2, placeholder: '123 Main St, Springfield, IL' },
                { key: 'preferredContactMethod', label: 'Preferred Contact', type: 'select', options: ['Call', 'Text', 'Email'] }
            ]
        },
        {
            id: 'callTracker',
            fields: [
                {
                    key: 'callTracker', colSpan: 2,
                    render: (props) => (
                        <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex items-center justify-between my-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm border border-indigo-200">
                                    <i className="fa-solid fa-phone-volume text-lg"></i>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Call Tracker</span>
                                    <span className="text-sm font-bold text-indigo-900">
                                        {props.lead.callCount === 1 ? '1 Call Made' : `${props.lead.callCount || 0} Calls Made`}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setEditingLead({ ...props.lead, callCount: Math.max(0, (props.lead.callCount || 0) - 1) })}
                                    className="w-8 h-8 rounded-full bg-white border border-indigo-100 text-indigo-400 hover:text-indigo-600 hover:border-indigo-300 flex items-center justify-center transition-all shadow-sm"
                                >
                                    <i className="fa-solid fa-minus text-xs"></i>
                                </button>
                                <button
                                    onClick={() => setEditingLead({ ...props.lead, callCount: (props.lead.callCount || 0) + 1 })}
                                    className="w-8 h-8 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:border-indigo-500 flex items-center justify-center transition-all border"
                                >
                                    <i className="fa-solid fa-plus text-xs"></i>
                                </button>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            title: 'Deal Status',
            id: 'status',
            fields: [
                {
                    key: 'status', label: 'Status', type: 'select',
                    render: (props) => (
                        <div className="relative">
                            <div className="flex items-center gap-1 mb-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
                                <div
                                    className="inline-flex self-center text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); setShowStatusInfo(!showStatusInfo); }}
                                >
                                    <i className="fa-solid fa-circle-info text-[10px]"></i>
                                </div>
                            </div>
                            {showStatusInfo && (
                                <div className="absolute top-8 left-0 w-80 bg-white shadow-xl rounded-xl border border-slate-200 p-4 z-50 text-left cursor-default" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                                        <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide">Status Definitions</h4>
                                        <button onClick={() => setShowStatusInfo(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
                                    </div>
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                        <div className="text-[10px] font-black text-indigo-500 uppercase mb-2">Buyer Statuses</div>
                                        {Object.entries(getStatusDefinitions('Buyer', realtorSettings)).map(([s, d]) => (
                                            <div key={`buyer-${s}`} className="text-xs mb-2">
                                                <div className="font-bold text-indigo-900 mb-0.5">{s}</div>
                                                <div className="text-slate-500 leading-snug">{d as string}</div>
                                            </div>
                                        ))}
                                        <div className="text-[10px] font-black text-emerald-500 uppercase mt-4 mb-2">Seller Statuses</div>
                                        {Object.entries(getStatusDefinitions('Seller', realtorSettings)).map(([s, d]) => (
                                            <div key={`seller-${s}`} className="text-xs mb-2">
                                                <div className="font-bold text-emerald-900 mb-0.5">{s}</div>
                                                <div className="text-slate-500 leading-snug">{d as string}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <select
                                value={editingLead.status}
                                onChange={(e) => setEditingLead({ ...editingLead, status: e.target.value as any })}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                            >
                                {getStatusOptions(editingLead.leadType, realtorSettings).map((o: any) => (
                                    <option key={o.label} value={o.label}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                    )
                },
                { key: 'leadType', label: 'Type', type: 'select', options: ['Buyer', 'Seller', 'Rental', 'Mortgage'] },
                { key: 'timeframe', label: 'Timeframe', type: 'text', placeholder: 'e.g. 1-3 months' },
                { key: 'channel', label: 'Channel', type: 'select', options: ['Email', 'API', 'Manual', 'CRM', 'Others'] },
                { key: 'assignedTo', label: 'Assigned To', type: 'text', placeholder: 'Team Member' },
            ]
        },
        {
            title: 'Property Details',
            id: 'property',
            fields: [
                { key: 'propertyAddress', label: 'Subject Property Address', type: 'text', colSpan: 2, placeholder: '123 Example St' },
                { key: 'propertyType', label: 'Property Type', type: 'text', placeholder: 'Single Family' },
                { key: 'mlsNumber', label: 'MLS Number', type: 'text', placeholder: 'MLS123' },
                { key: 'bedrooms', label: 'Beds', type: 'number' },
                { key: 'bathrooms', label: 'Baths', type: 'number' },
                { key: 'sqft', label: 'Sq Ft', type: 'number' },
                // Buyer Specs
                { key: 'minPrice', label: 'Min Price ($)', type: 'number', showIf: (l) => ['Buyer', 'Rental', 'Mortgage'].includes(l.leadType) },
                { key: 'maxPrice', label: 'Max Price ($)', type: 'number', showIf: (l) => ['Buyer', 'Rental', 'Mortgage'].includes(l.leadType) },
                { key: 'preferredNeighborhood', label: 'Preferred Neighborhood', type: 'text', colSpan: 2, showIf: (l) => ['Buyer', 'Rental'].includes(l.leadType) },
                // Seller Specs
                { key: 'price', label: 'List Price ($)', type: 'number', showIf: (l) => l.leadType === 'Seller' },
                { key: 'expectedPrice', label: 'Expected Price ($)', type: 'number', showIf: (l) => l.leadType === 'Seller' },
            ]
        },
        {
            title: 'Context & Preferences',
            id: 'context',
            fields: [
                { key: 'sellWhen', label: 'Sell When?', type: 'text', showIf: (l) => l.leadType === 'Seller' },
                { key: 'occupancyStatus', label: 'Occupancy', type: 'text', showIf: (l) => l.leadType === 'Seller' },
                { key: 'mostImportantToSeller', label: 'Priority', type: 'text', showIf: (l) => l.leadType === 'Seller' },
                { key: 'reasonForSelling', label: 'Reason for Selling', type: 'text', showIf: (l) => l.leadType === 'Seller' },
                { key: 'existingAgentName', label: 'Existing Agent?', type: 'text', showIf: (l) => l.leadType === 'Seller' },
                // Checkboxes as custom renders for layout control
                {
                    key: 'isAlsoSelling', label: '', type: 'checkbox', colSpan: 2,
                    render: (props) => (
                        <div className="flex flex-wrap gap-4 items-center">
                            {['Buyer', 'Rental'].includes(props.lead.leadType) && (
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={props.lead.isAlsoSelling || false}
                                        onChange={(e) => setEditingLead({ ...props.lead, isAlsoSelling: e.target.checked })}
                                        className="w-5 h-5 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Also Selling?</span>
                                </label>
                            )}
                            {['Buyer', 'Rental'].includes(props.lead.leadType) && (
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={props.lead.preQualified || false}
                                        onChange={(e) => setEditingLead({ ...props.lead, preQualified: e.target.checked })}
                                        className="w-5 h-5 rounded-lg border-slate-200 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Pre-qualified?</span>
                                </label>
                            )}
                            {props.lead.leadType === 'Seller' && (
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={props.lead.isAlsoBuying || false}
                                        onChange={(e) => setEditingLead({ ...props.lead, isAlsoBuying: e.target.checked })}
                                        className="w-5 h-5 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Also Buying?</span>
                                </label>
                            )}
                            {props.lead.leadType === 'Seller' && (
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={props.lead.homeValueNeeded || false}
                                        onChange={(e) => setEditingLead({ ...props.lead, homeValueNeeded: e.target.checked })}
                                        className="w-5 h-5 rounded-lg border-slate-200 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Home Value Needed?</span>
                                </label>
                            )}
                        </div>
                    )
                },
                { key: 'message', label: 'User Message', type: 'textarea', colSpan: 2 }
            ]
        }
    ];

    const renderField = (field: FieldConfig) => {
        if (field.showIf && !field.showIf(editingLead)) return null;
        if (field.render) return <div key={field.key} className={field.colSpan === 2 ? 'col-span-2' : ''}>{field.render({ value: (editingLead as any)[field.key], lead: editingLead })}</div>;

        const commonClasses = "w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none";

        return (
            <div key={field.key} className={`space-y-2 ${field.colSpan === 2 ? 'col-span-2' : ''}`}>
                {field.label && (
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                )}
                {field.type === 'select' ? (
                    <select
                        value={(editingLead as any)[field.key] || ''}
                        onChange={(e) => setEditingLead({ ...editingLead, [field.key]: e.target.value })}
                        className={`${commonClasses} appearance-none`}
                    >
                        {field.options && field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                ) : field.type === 'textarea' ? (
                    <textarea
                        value={(editingLead as any)[field.key] || ''}
                        onChange={(e) => setEditingLead({ ...editingLead, [field.key]: e.target.value })}
                        className={`${commonClasses} min-h-[80px]`}
                        placeholder={field.placeholder}
                    />
                ) : (
                    <input
                        type={field.type}
                        value={(editingLead as any)[field.key] || ''}
                        onChange={(e) => setEditingLead({ ...editingLead, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
                        className={commonClasses}
                        placeholder={field.placeholder}
                    />
                )}
            </div>
        );
    };

    const onSave = async () => {
        if (editingLead) {
            if (!editingLead.firstName.trim() || !editingLead.lastName.trim() || !editingLead.phone.trim()) {
                alert("First Name, Last Name, and Phone Number are mandatory fields.");
                return;
            }
            const updatedLead = { ...editingLead };
            const { notesLog, ...detailsToSave } = updatedLead;
            handleUpdateLead(updatedLead.id, detailsToSave);
            if (newNote.trim()) {
                if (handleAddNote) {
                    await handleAddNote(updatedLead.id, newNote.trim(), noteColor);
                }
            }
            setNewNote('');
            setEditingLead(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900">
                            {leads.some(l => l.id === editingLead.id) ? 'Edit Funnel Entry' : 'New Funnel Entry'}
                        </h3>
                        <p className="text-sm text-slate-500 font-medium">
                            {leads.some(l => l.id === editingLead.id)
                                ? `Dynamic Schema: ${Object.keys(editingLead).length} fields detected`
                                : 'Enter basic contact and property details'}
                        </p>
                    </div>
                    <button onClick={() => setEditingLead(null)} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all text-slate-400">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {FORM_SECTIONS.map((section) => (
                        <div key={section.id}>
                            {section.title && <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-4 ml-1 pb-2 border-b border-slate-100/50">{section.title}</h4>}
                            <div className="grid grid-cols-2 gap-6">
                                {section.fields.map(renderField)}
                            </div>
                        </div>
                    ))}

                    {/* Tags (Custom UI) */}
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

                    {/* Notes (Custom UI) */}
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <style dangerouslySetInnerHTML={{
                            __html: `
                            @import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap');
                            .post-it-font { font-family: 'Architects Daughter', cursive; line-height: 1.2; }
                            `}} />
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Call Notes & Comments</label>
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
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (handleDeleteNote) handleDeleteNote(note.id);
                                                    else setEditingLead({ ...editingLead, notesLog: editingLead.notesLog?.filter(n => n.id !== note.id) });
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
                </div>

                <div className="p-8 bg-slate-50 flex items-center justify-between flex-shrink-0">
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
