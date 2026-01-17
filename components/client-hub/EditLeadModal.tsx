import React, { useState } from 'react';
import { Lead, CallNote } from '../../types';
import { getStatusOptions, getStatusDefinitions } from '../../services/statusService';
import { storage_instance } from '../../services/firebaseService';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
    const [newCallNote, setNewCallNote] = useState('');
    const [newCallOutcome, setNewCallOutcome] = useState<'Connected' | 'Voicemail' | 'No Answer' | 'Busy' | 'Wrong Number'>('Connected');

    const [activeTab, setActiveTab] = useState<'profile' | 'deal' | 'context' | 'notes'>('profile');

    const tabs = [
        { id: 'profile', label: 'Profile', icon: 'fa-user' },
        { id: 'deal', label: 'Deal & Property', icon: 'fa-house' },
        { id: 'context', label: 'Context', icon: 'fa-sliders' },
        { id: 'notes', label: 'Notes & Activity', icon: 'fa-clipboard-list' },
    ];

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
                {
                    key: 'firstName', colSpan: 2,
                    render: (props) => (
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 mt-1 relative group">
                                <div
                                    className="w-14 h-14 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-90 transition-all ring-1 ring-slate-100"
                                    onClick={() => document.getElementById('avatar-upload-row')?.click()}
                                    title="Click to upload photo"
                                >
                                    {props.lead.clientPhotoUrl ? (
                                        <img src={props.lead.clientPhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <i className="fa-solid fa-camera text-slate-300 text-lg group-hover:text-slate-400 transition-colors"></i>
                                    )}
                                </div>
                                <input
                                    id="avatar-upload-row"
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            if (!storage_instance) {
                                                console.error("Storage not initialized");
                                                alert("Image upload service is currently unavailable.");
                                                return;
                                            }
                                            try {
                                                // Create a reference to 'leads/{leadId}/avatar_{timestamp}_{filename}'
                                                const storageRef = ref(storage_instance, `leads/${props.lead.id}/avatar_${Date.now()}_${file.name}`);
                                                // Upload the file
                                                const snapshot = await uploadBytes(storageRef, file);
                                                // Get the download URL
                                                const downloadURL = await getDownloadURL(snapshot.ref);
                                                // Update state
                                                setEditingLead({ ...props.lead, clientPhotoUrl: downloadURL });
                                            } catch (error) {
                                                console.error("Error uploading avatar:", error);
                                                alert("Failed to upload image. Please try again.");
                                            }
                                        }
                                    }}
                                />
                            </div>
                            <div className="flex-1 grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-0.5">First Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={props.lead.firstName}
                                        placeholder="John"
                                        onChange={(e) => setEditingLead({ ...props.lead, firstName: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-0.5">Last Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={props.lead.lastName}
                                        placeholder="Doe"
                                        onChange={(e) => setEditingLead({ ...props.lead, lastName: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'contact',
            fields: [
                { key: 'email', label: 'Email Address', type: 'email', placeholder: 'client@example.com' },
                { key: 'phone', label: 'Phone Number', type: 'text', required: true, placeholder: '(555) 000-0000' },
                { key: 'homeAddress', label: 'Home / Mailing Address', type: 'text', colSpan: 2, placeholder: '123 Main St, Springfield, IL' },
                { key: 'preferredContactMethod', label: 'Preferred Contact', type: 'select', options: ['', 'Call', 'Text', 'Email'] }
            ]
        },
        {
            id: 'callTracker',
            fields: [
                {
                    key: 'callTracker', colSpan: 2,
                    render: (props) => (
                        <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 flex items-center justify-between my-1">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center border border-indigo-200">
                                    <i className="fa-solid fa-phone-volume text-sm"></i>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Call Tracker</span>
                                    <span className="text-sm font-semibold text-indigo-900">
                                        {props.lead.callCount === 1 ? '1 Call' : `${props.lead.callCount || 0} Calls`}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setEditingLead({ ...props.lead, callCount: Math.max(0, (props.lead.callCount || 0) - 1) })}
                                    className="w-6 h-6 rounded bg-white border border-indigo-100 text-indigo-400 hover:text-indigo-600 hover:border-indigo-300 flex items-center justify-center transition-all shadow-sm"
                                >
                                    <i className="fa-solid fa-minus text-[10px]"></i>
                                </button>
                                <button
                                    onClick={() => setEditingLead({ ...props.lead, callCount: (props.lead.callCount || 0) + 1 })}
                                    className="w-6 h-6 rounded bg-indigo-600 text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 hover:border-indigo-500 flex items-center justify-center transition-all border"
                                >
                                    <i className="fa-solid fa-plus text-[10px]"></i>
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
                            <div className="flex items-center gap-1 mb-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-0.5">Status</label>
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
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:ring-1 focus:ring-indigo-500 transition-all outline-none appearance-none"
                            >
                                {getStatusOptions(editingLead.leadType, realtorSettings).map((o: any) => (
                                    <option key={o.label} value={o.label}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                    )
                },
                { key: 'channel', label: 'Channel', type: 'select', options: ['Email', 'API', 'Manual', 'CRM', 'Others'] },
                { key: 'assignedTo', label: 'Assigned To', type: 'text', placeholder: 'Team Member' },
            ]
        },
        {
            title: 'Property Details',
            id: 'property',
            fields: [
                {
                    key: 'subjectPropertyDetails',
                    label: 'Subject Property',
                    type: 'text',
                    colSpan: 2,
                    required: true,
                    // Use a custom render to access nested property (address) or implement a specialized component later.
                    // For now, removing direct text binding to 'subjectProperty' string as it was deleted.
                    render: (props: any) => (
                        <div className="space-y-1 col-span-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-0.5">Subject Property Address</label>
                            <input
                                type="text"
                                value={editingLead.subjectPropertyDetails?.address || ''}
                                onChange={(e) => setEditingLead({ ...editingLead, subjectPropertyDetails: { ...editingLead.subjectPropertyDetails, address: e.target.value } })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                                placeholder="Property address for this transaction"
                            />
                        </div>
                    )
                },
                {
                    key: 'inquiryProperty',
                    label: 'Inquiry Property',
                    type: 'text',
                    colSpan: 2,
                    placeholder: 'Original property they inquired about',
                    render: (props: any) => (
                        <div className="space-y-1 col-span-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-0.5">Inquiry Property Address</label>
                            <input
                                type="text"
                                value={editingLead.inquiryProperty?.address || ''}
                                onChange={(e) => setEditingLead({ ...editingLead, inquiryProperty: { ...editingLead.inquiryProperty, address: e.target.value } })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                                placeholder="Original property they inquired about"
                            />
                        </div>
                    )
                },
                // Seller Specs
                { key: 'expectedPrice', label: 'Expected Price ($)', type: 'number', showIf: (l) => l.leadType === 'Seller' },
            ]
        },
        {
            title: 'Context & Preferences',
            id: 'context',
            fields: [
                { key: 'leadType', label: 'Type', type: 'select', options: ['Buyer', 'Seller', 'Rental', 'Mortgage'] },
                { key: 'slaUrgency', label: 'SLA Urgency', type: 'select', options: ['low', 'medium', 'high'] },
                {
                    key: 'inquiryProperty', label: 'Price Range', type: 'number', colSpan: 2,
                    showIf: (l) => ['Buyer', 'Rental', 'Mortgage'].includes(l.leadType),
                    render: (props) => (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-0.5">Min Price ($)</label>
                                <input
                                    type="number"
                                    value={editingLead.inquiryProperty?.minPrice || ''}
                                    onChange={(e) => setEditingLead({ ...editingLead, inquiryProperty: { ...editingLead.inquiryProperty, minPrice: Number(e.target.value) } })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-0.5">Max Price ($)</label>
                                <input
                                    type="number"
                                    value={editingLead.inquiryProperty?.maxPrice || ''}
                                    onChange={(e) => setEditingLead({ ...editingLead, inquiryProperty: { ...editingLead.inquiryProperty, maxPrice: Number(e.target.value) } })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                                />
                            </div>
                        </div>
                    )
                },
                { key: 'preferredNeighborhood', label: 'Preferred Neighborhood', type: 'text', colSpan: 2, showIf: (l) => ['Buyer', 'Rental'].includes(l.leadType) },
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
                { key: 'message', label: 'User Message', type: 'textarea', colSpan: 2 },
                // Tags (Custom UI, pseudo-field)
                {
                    key: 'tags' as any, colSpan: 2,
                    render: (props: any) => (
                        <div className="space-y-1 mt-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-0.5">Tags</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {props.lead.tags?.map((tag: string, index: number) => (
                                    <span key={index} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs font-semibold flex items-center gap-1.5 border border-indigo-100">
                                        {tag}
                                        <button onClick={() => {
                                            const newTags = props.lead.tags?.filter((_: any, i: number) => i !== index);
                                            setEditingLead({ ...props.lead, tags: newTags });
                                        }} className="hover:text-indigo-800"><i className="fa-solid fa-xmark text-[10px]"></i></button>
                                    </span>
                                ))}
                            </div>
                            <input
                                type="text"
                                placeholder="Add tag..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = e.currentTarget.value.trim();
                                        if (val) {
                                            const currentTags = props.lead.tags || [];
                                            if (!currentTags.includes(val)) {
                                                setEditingLead({ ...props.lead, tags: [...currentTags, val] });
                                            }
                                            e.currentTarget.value = '';
                                        }
                                    }
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                            />
                        </div>
                    )
                }
            ]
        },
        {
            title: 'Timing',
            id: 'timing',
            fields: [
                { key: 'timeframe', label: 'Timeframe', type: 'text', placeholder: 'e.g. 1-3 months' },
                { key: 'sellWhen', label: 'Sell When?', type: 'text', showIf: (l) => l.leadType === 'Seller' },
                {
                    key: 'receivedAt',
                    label: 'Created At',
                    colSpan: 1,
                    render: (props) => (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-0.5">Created At</label>
                            <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-500 cursor-not-allowed">
                                {props.lead.receivedAt?.toDate ? props.lead.receivedAt.toDate().toLocaleString() : props.lead.receivedAt ? new Date(props.lead.receivedAt).toLocaleString() : '--'}
                            </div>
                        </div>
                    )
                },
                {
                    key: 'lastUpdated',
                    label: 'Last Updated',
                    colSpan: 1,
                    render: (props) => (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-0.5">Last Updated</label>
                            <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-500 cursor-not-allowed">
                                {props.lead.lastUpdated?.toDate ? props.lead.lastUpdated.toDate().toLocaleString() : props.lead.lastUpdated ? new Date(props.lead.lastUpdated).toLocaleString() : '--'}
                            </div>
                        </div>
                    )
                }
            ]
        }
    ];

    const renderField = (field: FieldConfig) => {
        if (field.showIf && !field.showIf(editingLead)) return null;
        if (field.render) return <div key={field.key} className={field.colSpan === 2 ? 'col-span-2' : ''}>{field.render({ value: (editingLead as any)[field.key], lead: editingLead })}</div>;

        const commonClasses = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-indigo-500 transition-all outline-none";

        return (
            <div key={field.key} className={`space-y-1 ${field.colSpan === 2 ? 'col-span-2' : ''}`}>
                {field.label && (
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-0.5">
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
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-white z-10">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-slate-900">
                            {leads.some(l => l.id === editingLead.id) ? 'Edit Client Details' : 'New Client Details'}
                        </h3>
                        {editingLead.clientId && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-500 rounded-md border border-slate-100">
                                <i className="fa-solid fa-hashtag text-[8px] text-slate-300"></i>
                                <span className="text-[10px] font-bold font-mono tracking-tight">{editingLead.clientId}</span>
                            </div>
                        )}
                    </div>
                    <button onClick={() => setEditingLead(null)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all text-slate-400">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex px-5 border-b border-slate-100 bg-white">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className={`fa-solid ${tab.icon}`}></i>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        {FORM_SECTIONS.filter(section => {
                            if (activeTab === 'profile') return ['identity', 'contact'].includes(section.id);
                            if (activeTab === 'deal') return ['status', 'property', 'timing'].includes(section.id);
                            if (activeTab === 'context') return ['context'].includes(section.id);
                            if (activeTab === 'notes') return ['callTracker'].includes(section.id);
                            return false;
                        }).map((section) => (
                            <React.Fragment key={section.id}>
                                {section.title && (
                                    <div className="col-span-2 pt-2 mt-2 border-t border-slate-100 first:border-0 first:pt-0 first:mt-0">
                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-2">{section.title}</h4>
                                    </div>
                                )}
                                {section.fields.map(renderField)}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Notes Tab Special Content */}
                    {activeTab === 'notes' && (
                        <>
                            {/* Call Notes Section */}
                            <div className="space-y-3 pt-4 border-t border-slate-100 mt-4">
                                <div className="flex items-center justify-between ml-1">
                                    <div className="flex items-center gap-2">
                                        <i className="fa-solid fa-phone text-indigo-500 text-xs"></i>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Call Notes</label>
                                        <span className="text-[9px] font-medium text-slate-300">({editingLead.callCount || 0} calls made)</span>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 rounded-2xl p-4 max-h-[250px] overflow-y-auto">
                                    {editingLead.callNotes && editingLead.callNotes.length > 0 ? (
                                        <div className="space-y-3">
                                            {[...editingLead.callNotes].sort((a, b) => b.callNumber - a.callNumber).map((callNote) => (
                                                <div
                                                    key={callNote.callNumber}
                                                    className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition-all group"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                                                <span className="text-xs font-black text-indigo-600">#{callNote.callNumber}</span>
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${callNote.outcome === 'Connected' ? 'bg-emerald-100 text-emerald-600' :
                                                                        callNote.outcome === 'Voicemail' ? 'bg-amber-100 text-amber-600' :
                                                                            callNote.outcome === 'No Answer' ? 'bg-slate-100 text-slate-500' :
                                                                                callNote.outcome === 'Busy' ? 'bg-orange-100 text-orange-600' :
                                                                                    'bg-rose-100 text-rose-600'
                                                                        }`}>
                                                                        {callNote.outcome || 'Connected'}
                                                                    </span>
                                                                    {callNote.duration && (
                                                                        <span className="text-[9px] text-slate-400">
                                                                            {Math.floor(callNote.duration / 60)}m {callNote.duration % 60}s
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[9px] text-slate-300">
                                                                        {new Date(callNote.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm text-slate-700">{callNote.note}</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const updatedCallNotes = editingLead.callNotes?.filter(n => n.callNumber !== callNote.callNumber);
                                                                setEditingLead({ ...editingLead, callNotes: updatedCallNotes });
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500 p-1"
                                                        >
                                                            <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center text-slate-300 italic text-xs py-6">
                                            <i className="fa-solid fa-phone-slash text-2xl mb-2 block opacity-40"></i>
                                            No call notes recorded yet
                                        </div>
                                    )}
                                </div>

                                {/* Add new call note */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                                            <span className="text-xs font-black text-white">#{(editingLead.callCount || 0) + 1}</span>
                                        </div>
                                        <select
                                            value={newCallOutcome}
                                            onChange={(e) => setNewCallOutcome(e.target.value as any)}
                                            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value="Connected">Connected</option>
                                            <option value="Voicemail">Voicemail</option>
                                            <option value="No Answer">No Answer</option>
                                            <option value="Busy">Busy</option>
                                            <option value="Wrong Number">Wrong Number</option>
                                        </select>
                                        <span className="text-[9px] text-slate-400 ml-auto">Next call note</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newCallNote}
                                            onChange={(e) => setNewCallNote(e.target.value)}
                                            placeholder="Add note for this call..."
                                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && newCallNote.trim()) {
                                                    const newCallNoteObj: CallNote = {
                                                        callNumber: (editingLead.callCount || 0) + 1,
                                                        note: newCallNote.trim(),
                                                        timestamp: new Date(),
                                                        outcome: newCallOutcome
                                                    };
                                                    setEditingLead({
                                                        ...editingLead,
                                                        callNotes: [...(editingLead.callNotes || []), newCallNoteObj],
                                                        callCount: (editingLead.callCount || 0) + 1
                                                    });
                                                    setNewCallNote('');
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={() => {
                                                if (newCallNote.trim()) {
                                                    const newCallNoteObj: CallNote = {
                                                        callNumber: (editingLead.callCount || 0) + 1,
                                                        note: newCallNote.trim(),
                                                        timestamp: new Date(),
                                                        outcome: newCallOutcome
                                                    };
                                                    setEditingLead({
                                                        ...editingLead,
                                                        callNotes: [...(editingLead.callNotes || []), newCallNoteObj],
                                                        callCount: (editingLead.callCount || 0) + 1
                                                    });
                                                    setNewCallNote('');
                                                }
                                            }}
                                            className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition-all"
                                        >
                                            <i className="fa-solid fa-plus mr-1"></i> Add
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Comments Section (Post-it Notes) */}
                            <div className="space-y-3 pt-4 border-t border-slate-100 mt-4">
                                <style dangerouslySetInnerHTML={{
                                    __html: `
                            @import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap');
                            .post-it-font { font-family: 'Architects Daughter', cursive; line-height: 1.2; }
                            `}} />
                                <div className="flex items-center justify-between ml-1">
                                    <div className="flex items-center gap-2">
                                        <i className="fa-solid fa-note-sticky text-amber-500 text-xs"></i>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comments</label>
                                    </div>
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

                                <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-6 max-h-[300px] overflow-y-auto">
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
                                            <div className="w-full text-center text-slate-300 italic text-xs py-8">No comments yet. Add one below!</div>
                                        )}
                                    </div>
                                </div>

                                <div className="relative">
                                    <textarea
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                        rows={3}
                                        className={`w-full px-6 py-5 rounded-[2rem] text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none resize-none border-t border-black/5 post-it-font ${noteColor}`}
                                        placeholder="Type a new comment..."
                                    />
                                    <div className="absolute top-2 right-4 flex items-center gap-1 opacity-20">
                                        <i className="fa-solid fa-note-sticky text-xs"></i>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
                    <button onClick={() => setEditingLead(null)} className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-all">Cancel</button>
                    <button
                        onClick={onSave}
                        disabled={isSavingLead}
                        className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSavingLead ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                        {isSavingLead ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditLeadModal;
