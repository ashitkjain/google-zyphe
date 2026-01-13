
import React, { useState, useMemo } from 'react';
import { Lead } from '../types';

interface InternalProps {
    leads: Lead[];
    onUpdateLead: (id: string, updates: Partial<Lead>) => void;
    onViewLead: (lead: Lead) => void;
    onCreateLead: () => void;
}

const LeadsList: React.FC<InternalProps> = ({ leads, onUpdateLead, onViewLead, onCreateLead }) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sortField, setSortField] = useState<keyof Lead>('receivedAt');

    const STATUS_OPTIONS = ['New', 'Qualified', 'Attempted to Contact', 'Connected', 'Appointment Scheduled', 'Listing Agreement Sent/Signed', 'Active', 'Closed-Won', 'Closed-Lost', 'Archived'];

    const STATUS_DEFINITIONS: Record<string, string> = {
        "New": "Leads added to the system but not yet engaged.",
        "Qualified": "Prospect meets criteria and is actively looking to buy/sell.",
        "Attempted to Contact": "Agent has tried to reach out (call, email).",
        "Connected": "Successful initial contact made, prospect is aware and responding.",
        "Appointment Scheduled": "A specific meeting or showing is booked.",
        "Listing Agreement Sent/Signed": "For sellers, formal agreement is in process or completed.",
        "Active": "Actively working with them on a transaction.",
        "Closed-Won": "The deal is finalized.",
        "Closed-Lost": "The lead is no longer viable, with reasons tracked.",
        "Archived": "Not currently working; may be unsubscribed from marketing."
    };
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [viewMode, setViewMode] = useState<'new' | 'active' | 'closed' | 'archived'>('new');
    const [showFilters, setShowFilters] = useState(false);
    const [showStatusInfo, setShowStatusInfo] = useState(false);
    const [columnFilters, setColumnFilters] = useState({
        name: '',
        phone: '',
        email: '',
        status: '',
        source: '',
    });

    // Inline Editing State
    const [editingCell, setEditingCell] = useState<{ id: string, field: keyof Lead } | null>(null);
    const [editValue, setEditValue] = useState<string>('');

    const startEditing = (e: React.MouseEvent, id: string, field: keyof Lead, value: any) => {
        e.stopPropagation(); // Prevent row click
        setEditingCell({ id, field });
        setEditValue(value || '');
    };

    const saveEditing = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (editingCell) {
            onUpdateLead(editingCell.id, { [editingCell.field]: editValue });
            setEditingCell(null);
            setEditValue('');
        }
    };

    const handleBulkArchive = () => {
        if (selectedIds.size === 0) return;
        if (selectedIds.size === 1) {
            const id = Array.from(selectedIds)[0];
            onUpdateLead(id, { status: 'Archived' });
            setSelectedIds(new Set());
            return;
        }
        if (window.confirm(`Are you sure you want to archive ${selectedIds.size} leads?`)) {
            selectedIds.forEach(id => {
                onUpdateLead(id, { status: 'Archived' });
            });
            setSelectedIds(new Set());
        }
    };

    const handleBulkActivate = () => {
        if (selectedIds.size === 0) return;

        const processActivation = () => {
            selectedIds.forEach(id => {
                const lead = leads.find(l => l.id === id);
                if (lead) {
                    const activationNote = {
                        id: crypto.randomUUID(),
                        content: 'Lead activated',
                        timestamp: new Date().toISOString(),
                        author: 'User'
                    };

                    onUpdateLead(id, {
                        status: 'New',
                        activatedAt: new Date(),
                        notes: 'Lead activated',
                        notesLog: [...(lead.notesLog || []), activationNote]
                    });
                }
            });
            setSelectedIds(new Set());
        };

        if (selectedIds.size === 1) {
            processActivation();
            return;
        }

        if (window.confirm(`Are you sure you want to activate ${selectedIds.size} leads?`)) {
            processActivation();
        }
    };

    const cancelEditing = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingCell(null);
        setEditValue('');
    };

    const renderCell = (lead: Lead, field: keyof Lead, type: 'text' | 'select' = 'text', options: string[] = [], viewAction?: () => void) => {
        const isEditing = editingCell?.id === lead.id && editingCell?.field === field;
        const value = lead[field] as string;

        if (isEditing) {
            return (
                <div className="flex items-center gap-1 min-w-[120px]" onClick={e => e.stopPropagation()}>
                    {type === 'select' ? (
                        <select
                            autoFocus
                            className="bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditing(e as any);
                                if (e.key === 'Escape') cancelEditing(e as any);
                            }}
                        >
                            {options.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            autoFocus
                            type="text"
                            className="bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditing(e as any);
                                if (e.key === 'Escape') cancelEditing(e as any);
                            }}
                        />
                    )}
                    <button onClick={saveEditing} className="text-emerald-500 hover:text-emerald-700 bg-emerald-50 p-1 rounded flex-shrink-0"><i className="fa-solid fa-check"></i></button>
                    <button onClick={cancelEditing} className="text-red-400 hover:text-red-600 bg-red-50 p-1 rounded flex-shrink-0"><i className="fa-solid fa-xmark"></i></button>
                </div>
            );
        }

        return (
            <div className="group/cell flex items-center justify-between gap-2 w-full h-full min-h-[20px]">
                <div
                    className={`truncate ${viewAction ? 'cursor-pointer hover:underline' : 'cursor-text'}`}
                    onClick={(e) => {
                        if (viewAction) {
                            e.stopPropagation();
                            viewAction();
                        } else {
                            startEditing(e, lead.id, field, value);
                        }
                    }}
                >
                    {value || <span className="text-slate-300 italic">--</span>}
                </div>
                <button
                    onClick={(e) => startEditing(e, lead.id, field, value)}
                    className="opacity-0 group-hover/cell:opacity-100 hover:text-indigo-500 transition-opacity p-1"
                >
                    <i className="fa-solid fa-pencil text-slate-300 text-[10px]"></i>
                </button>
            </div>
        );
    };

    const stats = useMemo(() => {
        return {
            total: leads.length,
            new: leads.filter(l => l.status === 'New').length,
            active: leads.filter(l => !['New', 'Archived', 'Closed-Won', 'Closed-Lost'].includes(l.status)).length,
            converted: leads.filter(l => ['Closed-Won', 'Closed-Lost'].includes(l.status)).length
        };
    }, [leads]);

    const filteredLeads = useMemo(() => {
        // 1. Bucket Categorization (Strict Separation)
        let result = leads.filter(l => {
            if (viewMode === 'new') return l.status === 'New';
            if (viewMode === 'closed') {
                if (!['Closed-Won', 'Closed-Lost'].includes(l.status)) return false;
                if (!l.closedAt) return true; // Show if no date (fallback)
                const closedDate = new Date(l.closedAt);
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                return closedDate >= threeMonthsAgo;
            }
            if (viewMode === 'archived') return l.status === 'Archived';
            // Default to Active: Everything else
            return !['New', 'Archived', 'Closed-Won', 'Closed-Lost'].includes(l.status);
        }).filter(l => l.collectionName === 'leads');



        // 3. Apply Column Filters (Name, Phone, etc.) - Apply to BOTH views
        if (columnFilters.name) result = result.filter(l => l.name.toLowerCase().includes(columnFilters.name.toLowerCase()));
        if (columnFilters.phone) result = result.filter(l => l.phone.toLowerCase().includes(columnFilters.phone.toLowerCase()));
        if (columnFilters.email) result = result.filter(l => l.email.toLowerCase().includes(columnFilters.email.toLowerCase()));
        if (columnFilters.status) result = result.filter(l => l.status === columnFilters.status);
        if (columnFilters.source) result = result.filter(l => l.source === columnFilters.source);

        // 4. Sorting
        return result.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            if (aVal === bVal) return 0;
            if (!aVal) return 1;
            if (!bVal) return -1;

            const comparison = aVal > bVal ? 1 : -1;
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [leads, viewMode, columnFilters, sortField, sortDirection]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(filteredLeads.map(l => l.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleSort = (field: keyof Lead) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    return (
        <div className="flex flex-col h-full bg-white text-sm font-sans">
            {/* Summary Header - "Without Jazz" */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">


                        <div>
                            <div className="flex bg-slate-100/50 p-1 rounded-2xl border border-slate-200/60 shadow-sm relative overflow-hidden">
                                <button
                                    onClick={() => setViewMode('new')}
                                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 relative z-10 ${viewMode === 'new' ? 'text-indigo-600 bg-white shadow-xl shadow-indigo-500/10' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    New
                                    {stats.new > 0 && viewMode !== 'new' && (
                                        <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[10px] animate-pulse">
                                            {stats.new}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setViewMode('active')}
                                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 relative z-10 ${viewMode === 'active' ? 'text-indigo-600 bg-white shadow-xl shadow-indigo-500/10' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Active
                                </button>
                                <button
                                    onClick={() => setViewMode('closed')}
                                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 relative z-10 ${viewMode === 'closed' ? 'text-indigo-600 bg-white shadow-xl shadow-indigo-500/10' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Closed
                                </button>
                                <button
                                    onClick={() => setViewMode('archived')}
                                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 relative z-10 ${viewMode === 'archived' ? 'text-indigo-600 bg-white shadow-xl shadow-indigo-500/10' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Archived
                                </button>
                            </div>
                            <div className="mt-4">
                                {viewMode === 'new' && (
                                    <div className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                        Incoming Pool
                                        <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">
                                            {filteredLeads.length} Items
                                        </span>
                                    </div>
                                )}
                                {viewMode === 'active' && (
                                    <div className="text-2xl font-black text-slate-900 tracking-tight">Active Pipeline</div>
                                )}
                                {viewMode === 'closed' && (
                                    <div className="text-2xl font-black text-slate-900 tracking-tight">Closed Transactions <span className="text-sm font-bold text-slate-400 ml-2">(Last 3 Months)</span></div>
                                )}
                                {viewMode === 'archived' && (
                                    <div className="text-2xl font-black text-slate-900 tracking-tight">Archive Library</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>


            </div>

            {/* Toolbar */}
            <div className="px-6 py-2 border-b border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-1 text-slate-400">
                    {viewMode === 'new' && (
                        <button
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded flex items-center gap-2 text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                            onClick={onCreateLead}
                        >
                            <i className="fa-solid fa-plus"></i>
                            New Lead
                        </button>
                    )}
                    {(viewMode === 'new' || viewMode === 'active') ? (
                        <button
                            className={`px-3 py-1.5 rounded flex items-center gap-2 text-xs font-semibold transition-colors ${selectedIds.size > 0 ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'text-slate-300 cursor-not-allowed'}`}
                            onClick={handleBulkArchive}
                            disabled={selectedIds.size === 0}
                        >
                            <i className="fa-solid fa-box-archive"></i>
                            Archive Selected {selectedIds.size > 0 && `(${selectedIds.size})`}
                        </button>
                    ) : (
                        <button
                            className={`px-3 py-1.5 rounded flex items-center gap-2 text-xs font-semibold transition-colors ${selectedIds.size > 0 ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'text-slate-300 cursor-not-allowed'}`}
                            onClick={handleBulkActivate}
                            disabled={selectedIds.size === 0}
                        >
                            <i className="fa-solid fa-bolt-lightning"></i>
                            Activate Selected {selectedIds.size > 0 && `(${selectedIds.size})`}
                        </button>
                    )}
                    {viewMode === 'closed' && (
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Read Only Archive</div>
                    )}
                    <div className="h-4 w-px bg-slate-200 mx-2"></div>
                    <button className={`p-2 hover:bg-slate-100 rounded ${showFilters ? 'bg-slate-100 text-indigo-600' : ''}`} onClick={() => setShowFilters(!showFilters)}><i className="fa-solid fa-filter"></i></button>
                </div>

            </div>

            {/* Filter Bar */}
            {showFilters && (
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 grid grid-cols-5 gap-4">
                    <input
                        type="text"
                        placeholder="Filter Name..."
                        className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                        value={columnFilters.name}
                        onChange={(e) => setColumnFilters({ ...columnFilters, name: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Filter Phone..."
                        className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                        value={columnFilters.phone}
                        onChange={(e) => setColumnFilters({ ...columnFilters, phone: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Filter Email..."
                        className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                        value={columnFilters.email}
                        onChange={(e) => setColumnFilters({ ...columnFilters, email: e.target.value })}
                    />
                    <select
                        className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                        value={columnFilters.status}
                        onChange={(e) => setColumnFilters({ ...columnFilters, status: e.target.value })}
                    >
                        <option value="">All Statuses</option>
                        {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <select
                        className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                        value={columnFilters.source}
                        onChange={(e) => setColumnFilters({ ...columnFilters, source: e.target.value })}
                    >
                        <option value="">All Sources</option>
                        {Array.from(new Set(leads.map(l => l.source))).map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-auto bg-white shadow-sm border border-slate-200/60 rounded-2xl mx-6 mb-6">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                            <th className="w-12 px-4 py-3 border-b border-slate-200/60 bg-slate-50 text-center">
                                #
                            </th>
                            <th className="w-10 px-4 py-3 border-b border-slate-200/60 bg-slate-50">
                                <input type="checkbox" onChange={handleSelectAll} checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0} className="rounded border-slate-300" />
                            </th>
                            <th className="px-4 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('name')}>
                                Name {sortField === 'name' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                            </th>

                            <th className="px-4 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('propertyAddress')}>
                                Property {sortField === 'propertyAddress' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                            </th>
                            <th className="px-4 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('phone')}>
                                Phone {sortField === 'phone' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                            </th>
                            <th className="px-4 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('email')}>
                                Email {sortField === 'email' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                            </th>
                            {!(viewMode === 'new' || viewMode === 'archived') && (
                                <th className="px-4 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100 group relative">
                                    <div className="flex items-center gap-1" onClick={() => handleSort('status')}>
                                        Lead Status {sortField === 'status' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                        <div
                                            className="inline-flex self-center ml-1 text-slate-400 hover:text-indigo-600 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowStatusInfo(!showStatusInfo);
                                            }}
                                        >
                                            <i className="fa-solid fa-circle-info"></i>
                                        </div>
                                    </div>
                                    {showStatusInfo && (
                                        <div className="absolute top-full left-0 w-80 bg-white shadow-xl rounded-xl border border-slate-200 p-4 z-50 mt-2 text-left cursor-default" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                                                <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide">Status Definitions</h4>
                                                <button onClick={() => setShowStatusInfo(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
                                            </div>
                                            <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                                {Object.entries(STATUS_DEFINITIONS).map(([status, desc]) => (
                                                    <div key={status} className="text-xs">
                                                        <div className="font-bold text-indigo-900 mb-0.5">{status}</div>
                                                        <div className="text-slate-500 leading-snug">{desc}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </th>
                            )}
                            <th className="px-4 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('source')}>
                                Lead Source {sortField === 'source' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                            </th>
                            <th className="px-4 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('assignedTo')}>
                                Assigned To {sortField === 'assignedTo' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                            </th>

                            <th className="px-4 py-3 border-b border-slate-200/60 bg-slate-50">
                                Message
                            </th>
                            <th className="px-4 py-3 border-b border-slate-200/60 bg-slate-50">
                                Notes
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredLeads.map((lead, index) => (
                            <tr key={lead.id} className="hover:bg-slate-50 group text-slate-700 text-xs transition-colors">
                                <td className="px-4 py-3 border-b border-slate-100 text-center text-slate-400 opacity-50">
                                    {index + 1}
                                </td>
                                <td className="px-4 py-3 border-b border-slate-100">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(lead.id)}
                                        onChange={() => handleSelectOne(lead.id)}
                                        className="rounded border-slate-300"
                                    />
                                </td>
                                <td className="px-4 py-3 border-b border-slate-100 font-semibold text-indigo-600 transition-colors">
                                    {renderCell(lead, 'name', 'text', [], () => onViewLead(lead))}
                                </td>

                                <td className="px-4 py-3 border-b border-slate-100 max-w-[200px] truncate" title={lead.propertyAddress}>
                                    {lead.propertyAddress || <span className="text-slate-300 italic">--</span>}
                                </td>
                                <td className="px-4 py-3 border-b border-slate-100">
                                    {renderCell(lead, 'phone')}
                                </td>
                                <td className="px-4 py-3 border-b border-slate-100 text-indigo-600">
                                    {renderCell(lead, 'email')}
                                </td>
                                {!(viewMode === 'new' || viewMode === 'archived') && (
                                    <td className="px-4 py-3 border-b border-slate-100">
                                        {renderCell(lead, 'status', 'select', STATUS_OPTIONS)}
                                    </td>
                                )}
                                <td className="px-4 py-3 border-b border-slate-100">
                                    {renderCell(lead, 'source')}
                                </td>
                                <td className="px-4 py-3 border-b border-slate-100">
                                    {renderCell(lead, 'assignedTo')}
                                </td>

                                <td className="px-4 py-3 border-b border-slate-100 max-w-[200px]" title={lead.message}>
                                    <div className="truncate text-slate-500 italic">
                                        {lead.message || <span className="opacity-0">-</span>}
                                    </div>
                                </td>
                                <td className="px-4 py-3 border-b border-slate-100 max-w-[150px]" title={lead.notes}>
                                    <div className="truncate text-slate-500 text-xs">
                                        {lead.notes || <span className="opacity-0">-</span>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredLeads.length === 0 && (
                    <div className="p-10 text-center text-slate-400">
                        No leads found matching current filter.
                    </div>
                )}
            </div>
        </div >
    );
};

export default LeadsList;
