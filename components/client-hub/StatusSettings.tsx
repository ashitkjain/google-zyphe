import React, { useState } from 'react';
import { PropertyOption } from '../../types';
import { LEAD_FIELD_CONFIG as DEFAULT_PROPERTIES, LEAD_STAGE_LIFECYCLE_CONFIG, LEAD_STATUS_CONFIG } from '../../types/lead';

interface StatusSettingsProps {
    realtorId: string;
}

interface ManagedProperty extends PropertyOption {
    applicableTo?: 'Both' | 'Buyer' | 'Seller';
}

const PROPERTY_CATEGORIES = [
    'Lead Statuses',
    'Leads',
    'Nurture',
    'Active Search',
    'Offer',
    'Closing',
    'General'
];

const StatusSettings: React.FC<StatusSettingsProps> = ({ realtorId }) => {
    const [activeCategory, setActiveCategory] = useState<string>('Lead Statuses');
    const [expandedFields, setExpandedFields] = useState<Set<string>>(() => {
        const allConfigs = [...DEFAULT_PROPERTIES, ...LEAD_STAGE_LIFECYCLE_CONFIG];
        const expandableIds = allConfigs
            .filter(p => p.type === 'object' || p.type === 'list')
            .map(p => p.id);
        return new Set(expandableIds);
    });

    // Unified list of all properties from configuration
    const allProperties = React.useMemo(() => {
        const allConfigs = [...DEFAULT_PROPERTIES, ...LEAD_STAGE_LIFECYCLE_CONFIG];
        const HIDDEN_FIELD_IDS = ['id', 'isMock', 'collectionName', 'clientId', 'leadStatus', 'nurtureStatus', 'activeSearchStatus', 'offerStatus', 'closingStatus'];

        return (allConfigs as unknown as PropertyOption[])
            .filter(p => !HIDDEN_FIELD_IDS.includes(p.id))
            .map(p => ({
                ...p,
                applicableTo: (p.visibility?.length === 2) ? 'Both' : (p.visibility?.[0] || 'Both'),
                funnelVisibility: p.funnelVisibility || ['All'],
                isLocked: p.isLocked || false
            })) as ManagedProperty[];
    }, []);

    const toggleField = (fieldId: string) => {
        const next = new Set(expandedFields);
        if (next.has(fieldId)) next.delete(fieldId);
        else next.add(fieldId);
        setExpandedFields(next);
    };

    const renderTable = (groups: string[]) => {
        if (groups.includes('Lead Statuses')) {
            return (
                <div className="bg-white rounded-[2.5rem] border border-indigo-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[200px]">Status Label</th>
                                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[240px]">Funnel Stage</th>
                                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logic & Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {LEAD_STATUS_CONFIG.sort((a, b) => (a.order || 0) - (b.order || 0)).map((status, idx) => (
                                <tr key={`status-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-8 py-2.5 align-top">
                                        <div className="flex items-center gap-3">
                                            <div className="font-bold text-slate-900 text-sm whitespace-nowrap">{status.label}</div>
                                            <div className="flex gap-1">
                                                {status.visibility?.includes('Buyer') && <div className="w-4 h-4 rounded-md bg-sky-500 flex items-center justify-center text-[7px] font-black text-white" title="Buyer">B</div>}
                                                {status.visibility?.includes('Seller') && <div className="w-4 h-4 rounded-md bg-emerald-500 flex items-center justify-center text-[7px] font-black text-white" title="Seller">S</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-2.5 align-top">
                                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-wider border border-indigo-100">
                                            {status.funnelStage}
                                        </span>
                                    </td>
                                    <td className="px-8 py-2.5 align-top">
                                        <p className="text-sm text-slate-600 font-medium leading-relaxed">{status.description}</p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {groups.map((group) => {
                    const groupItems = allProperties.filter(item => (item.category || 'General') === group);
                    const groupItemsWithIndex = groupItems.map(item => ({ item, originalIndex: allProperties.indexOf(item) }));

                    if (groupItems.length === 0) return null;

                    return (
                        <div key={group} className="bg-white rounded-2xl border transition-all duration-300 border-indigo-100 shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[240px]">Field Name</th>
                                        <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[140px]">Data Type</th>
                                        <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {groupItemsWithIndex.map(({ item, originalIndex }, index) => {
                                        const isObject = item.type === 'object' || item.type === 'list';
                                        const isFieldExpanded = expandedFields.has(item.id || `field-${index}`);

                                        return (
                                            <React.Fragment key={`property-${originalIndex}-fragment`}>
                                                <tr className={`group hover:bg-slate-50/80 transition-colors`}>
                                                    <td className="px-4 py-2 w-[240px] align-middle">
                                                        <div className="flex items-center gap-2.5 group/field">
                                                            {isObject && (
                                                                <button onClick={() => toggleField(item.id || `field-${index}`)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                                                                    <i className={`fa-solid fa-chevron-right text-[10px] transition-transform ${isFieldExpanded ? 'rotate-90' : ''}`}></i>
                                                                </button>
                                                            )}
                                                            <div className="flex-1 min-w-0 font-semibold text-slate-900 text-sm leading-snug px-0 py-0.5 font-sans">
                                                                {item.label}
                                                            </div>
                                                            {item.visibility && item.visibility.length === 1 && item.visibility.includes('Buyer') && (
                                                                <div className="w-5 h-5 rounded bg-sky-500 flex items-center justify-center text-[8px] font-black text-white shadow-sm" title="Buyer Only">B</div>
                                                            )}
                                                            {item.visibility && item.visibility.length === 1 && item.visibility.includes('Seller') && (
                                                                <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center text-[8px] font-black text-white shadow-sm" title="Seller Only">S</div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-2 w-[140px] align-top">
                                                        <div className="flex flex-col gap-1.5 pt-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${item.type === 'boolean' ? 'bg-amber-50 text-amber-700 border border-amber-100' : item.type === 'integer' ? 'bg-purple-50 text-purple-700 border border-purple-100' : item.type === 'enum' ? 'bg-blue-50 text-blue-700 border border-blue-100' : (item.type === 'object' || item.type === 'list') ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-slate-50 text-slate-600 border border-slate-100'}`}>
                                                                    {item.type || 'string'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 align-top">
                                                        <div className="flex flex-col">
                                                            <div className="w-full text-slate-600 text-sm leading-snug font-medium px-0 py-0.5 font-sans">
                                                                {item.description}
                                                            </div>
                                                            {item.type === 'enum' && (
                                                                <div className="flex flex-wrap gap-1 mt-2">
                                                                    {item.options?.map((opt: string) => (
                                                                        <span key={opt} className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[9px] font-bold text-slate-500 shadow-sm">
                                                                            {opt}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isObject && isFieldExpanded && (
                                                    <tr className="bg-slate-50/50">
                                                        <td colSpan={6} className="p-0 border-b border-slate-100">
                                                            <div className="w-full relative">
                                                                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-indigo-100"></div>
                                                                <table className="w-full">
                                                                    <tbody>
                                                                        {item.fields && item.fields.length > 0 ? (
                                                                            item.fields.map((field: any, idx: number) => {
                                                                                const isObj = typeof field === 'object';
                                                                                const label = isObj ? (field.label || field.name) : field;
                                                                                const type = isObj ? field.type : 'string';
                                                                                const desc = isObj ? field.description : '';

                                                                                return (
                                                                                    <tr key={`${originalIndex}-sub-${idx}`} className="hover:bg-indigo-50/20 transition-colors">
                                                                                        <td className="w-[240px] px-4 py-2 align-top">
                                                                                            <div className="flex items-center gap-2 pl-6">
                                                                                                <div className="w-4 h-4 border-l-2 border-b-2 border-indigo-200 rounded-bl-md -mt-3.5"></div>
                                                                                                <div className="flex flex-col">
                                                                                                    <span className="text-xs font-bold text-slate-700">{label}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="w-[140px] px-4 py-2 align-top">
                                                                                            <div className="flex gap-2">
                                                                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${type === 'date' || type === 'timestamp' ? 'bg-orange-50 text-orange-700 border-orange-100' : type === 'currency' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : type === 'enum' ? 'bg-blue-50 text-blue-700 border-blue-100' : type?.startsWith('list') ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                                                                    {type}
                                                                                                </span>
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="px-4 py-2 align-top">
                                                                                            <p className="text-xs text-slate-500 font-medium leading-relaxed">{desc || 'No description provided.'}</p>
                                                                                            {type === 'enum' && field.options && (
                                                                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                                                                    {field.options.map((opt: string) => (
                                                                                                        <span key={opt} className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[9px] font-bold text-slate-500 shadow-sm">
                                                                                                            {opt}
                                                                                                        </span>
                                                                                                    ))}
                                                                                                </div>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })
                                                                        ) : (
                                                                            <tr>
                                                                                <td colSpan={4} className="px-10 py-3 text-xs text-slate-400 italic">
                                                                                    Complex defined structure (no breakdown available).
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="h-full overflow-y-auto bg-[#F8FAFC] p-2 custom-scrollbar">
            <div className="w-full max-w-5xl mx-auto pb-24">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Data Field Definitions</h2>
                        <p className="text-sm font-medium text-slate-500 mt-1">Reference for system data organization and field requirements.</p>
                    </div>
                </div>

                {/* Category Tabs */}
                <div className="flex p-1 bg-slate-100 rounded-xl mb-6 overflow-x-auto no-scrollbar border border-slate-200">
                    {PROPERTY_CATEGORIES.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`flex-1 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeCategory === cat
                                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {renderTable([activeCategory])}

                {/* Legend Section */}
                <div className="mt-12 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Persona Visibility</h4>
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-xl bg-sky-500 flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-sky-100">B</div>
                                    <div>
                                        <span className="text-sm font-bold text-slate-700 block">Buyer Experience</span>
                                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Field is prioritized for buyer-side transactions.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-emerald-100">S</div>
                                    <div>
                                        <span className="text-sm font-bold text-slate-700 block">Seller Experience</span>
                                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Field is prioritized for seller-side transactions.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col justify-center border-l border-slate-50 pl-12">
                            <i className="fa-solid fa-circle-info text-2xl text-indigo-100 mb-4"></i>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed italic">
                                Properties without specific icons are universal and apply to both buyer and seller workflows. These definitions are standardized across the portal to ensure data integrity.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatusSettings;
