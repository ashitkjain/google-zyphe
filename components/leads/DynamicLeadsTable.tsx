import React from 'react';
import { Lead, LEAD_FIELD_CONFIG, LEAD_STAGE_LIFECYCLE_CONFIG, FunnelStage } from '../../types/lead';

interface DynamicLeadsTableProps {
    leads: Lead[];
    leadType: 'Buyer' | 'Seller';
    funnelStage: FunnelStage | 'Closed & Archived';
    selectedIds: Set<string>;
    onSelectOne: (id: string) => void;
    onSelectAll: (leads: Lead[], checked: boolean) => void;
    onSort: (field: string) => void;
    sortField: string;
    sortDirection: 'asc' | 'desc';
    onUpdateLead?: (id: string, updates: Partial<Lead>) => void;
}

export const DynamicLeadsTable: React.FC<DynamicLeadsTableProps> = ({
    leads,
    leadType,
    funnelStage,
    selectedIds,
    onSelectOne,
    onSelectAll,
    onSort,
    sortField,
    sortDirection,
    onUpdateLead
}) => {
    // Get all field configurations
    const allConfigs = [...LEAD_FIELD_CONFIG, ...LEAD_STAGE_LIFECYCLE_CONFIG];

    // Filter fields based on funnel visibility and persona
    const visibleFields = allConfigs.filter(config => {
        // Check persona visibility
        const isVisibleForPersona = !config.visibility || config.visibility.includes(leadType);

        // Check funnel visibility
        const stages = config.funnelVisibility || ['All'];
        const effectiveStage = funnelStage === 'Closed & Archived' ? 'Closed' : funnelStage;
        const isVisibleForStage =
            stages.includes('All') ||
            (funnelStage === 'Closed & Archived' ? (stages.includes('Closed') || stages.includes('Archived')) : stages.includes(effectiveStage as FunnelStage));

        return isVisibleForPersona && isVisibleForStage;
    });

    // Render cell value based on field type
    const renderCellValue = (lead: Lead, config: any) => {
        const value = (lead as any)[config.id];

        if (value === undefined || value === null) return <span className="text-slate-300">--</span>;

        // Handle different field types
        switch (config.type) {
            case 'date':
            case 'timestamp':
                try {
                    if (value.toDate) return value.toDate().toLocaleDateString();
                    return new Date(value).toLocaleDateString();
                } catch {
                    return <span className="text-slate-300">--</span>;
                }

            case 'boolean':
                return (
                    <span className={value ? 'text-green-600' : 'text-slate-400'}>
                        {value ? '✓' : '✗'}
                    </span>
                );

            case 'enum':
                return <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{value}</span>;

            case 'currency':
                return <span className="font-semibold text-green-600">${typeof value === 'number' ? value.toLocaleString() : value}</span>;

            case 'integer':
            case 'number':
                return <span className="font-mono">{value}</span>;

            case 'object':
                // Handle specific object types
                if (config.id === 'primaryContact') {
                    return (
                        <div className="flex flex-col text-xs space-y-0.5">
                            {value.phone && <div className="font-semibold text-slate-700">{value.phone}</div>}
                            {value.email && <div className="text-blue-600 truncate max-w-[200px]">{value.email}</div>}
                        </div>
                    );
                }

                if (config.id === 'leadInfo') {
                    return (
                        <div className="flex flex-col text-xs space-y-0.5">
                            {value.origin && <div className="text-indigo-600 font-semibold">{value.origin}</div>}
                            {value.campaign && <div className="text-slate-500">{value.campaign}</div>}
                        </div>
                    );
                }

                if (config.id === 'financialVitals') {
                    return (
                        <div className="flex flex-col text-xs space-y-0.5">
                            {value.budgetMax && <div className="text-green-600 font-semibold">${value.budgetMax.toLocaleString()}</div>}
                            {value.preApprovalStatus && <div className="text-emerald-600">Pre-approved ✓</div>}
                            {value.isAllCash && <div className="text-amber-600">Cash buyer</div>}
                        </div>
                    );
                }

                if (config.id === 'searchCriteria') {
                    return (
                        <div className="flex flex-col text-xs space-y-0.5 max-w-[250px]">
                            {value.locations && <div className="text-slate-700 truncate">{value.locations}</div>}
                            {value.mustHaves && <div className="text-slate-500 text-[10px] truncate">Must: {value.mustHaves}</div>}
                        </div>
                    );
                }

                if (config.id === 'listingStatus') {
                    return (
                        <div className="flex flex-col text-xs space-y-0.5">
                            {value.homeAddress && <div className="text-slate-700 truncate max-w-[200px]">{value.homeAddress}</div>}
                            {value.estimatedValue && <div className="text-green-600 font-semibold">${value.estimatedValue.toLocaleString()}</div>}
                        </div>
                    );
                }

                if (config.id === 'activeOffer') {
                    return (
                        <div className="flex flex-col text-xs space-y-0.5">
                            {value.price && <div className="text-green-600 font-semibold">${value.price.toLocaleString()}</div>}
                            {value.offerDate && <div className="text-slate-500">{new Date(value.offerDate).toLocaleDateString()}</div>}
                        </div>
                    );
                }

                if (config.id === 'criticalDates') {
                    return (
                        <div className="flex flex-col text-xs space-y-0.5">
                            {value.closingDate && (
                                <div className="text-red-600 font-semibold">
                                    Close: {new Date(value.closingDate).toLocaleDateString()}
                                </div>
                            )}
                            {value.inspectionEnd && (
                                <div className="text-slate-500 text-[10px]">
                                    Inspection: {new Date(value.inspectionEnd).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    );
                }

                // Generic object display - show first few non-empty fields
                const entries = Object.entries(value).filter(([_, v]) => v != null && v !== '');
                if (entries.length === 0) return <span className="text-slate-300">--</span>;

                return (
                    <div className="flex flex-col text-xs space-y-0.5 max-w-[200px]">
                        {entries.slice(0, 2).map(([key, val]) => (
                            <div key={key} className="text-slate-600 truncate">
                                <span className="text-slate-400">{key}:</span> {String(val)}
                            </div>
                        ))}
                        {entries.length > 2 && <div className="text-slate-400 text-[10px]">+{entries.length - 2} more</div>}
                    </div>
                );

            case 'list':
                if (!Array.isArray(value) || value.length === 0) {
                    return <span className="text-slate-300">--</span>;
                }

                // Show count with preview of first item
                return (
                    <div className="flex flex-col text-xs">
                        <div className="font-semibold text-indigo-600">{value.length} item{value.length !== 1 ? 's' : ''}</div>
                        {typeof value[0] === 'object' && value[0] !== null && (
                            <div className="text-slate-500 text-[10px] truncate max-w-[150px]">
                                {Object.values(value[0])[0]}
                            </div>
                        )}
                    </div>
                );

            case 'url':
                return (
                    <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[200px] block">
                        {value}
                    </a>
                );

            default:
                // String or unknown type
                const strValue = String(value);
                if (strValue.length > 100) {
                    return (
                        <div className="max-w-[300px] truncate" title={strValue}>
                            {strValue}
                        </div>
                    );
                }
                return strValue;
        }
    };

    return (
        <div className="overflow-x-auto w-full pb-6 -mx-4 px-4">
            <table className="text-left border-collapse min-w-max">
                <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-semibold text-slate-500">
                    <tr>
                        {/* Fixed columns */}
                        <th className="w-12 px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">#</th>
                        <th className="w-10 px-2 py-3 border-b border-slate-200/60 bg-slate-50">
                            <input
                                type="checkbox"
                                onChange={(e) => onSelectAll(leads, e.target.checked)}
                                checked={leads.length > 0 && leads.every(l => selectedIds.has(l.id))}
                                className="rounded border-slate-300"
                            />
                        </th>

                        {/* Dynamic columns based on funnel visibility */}
                        {visibleFields.map(config => (
                            <th
                                key={config.id}
                                className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                                onClick={() => onSort(config.id)}
                            >
                                {config.label}
                                {sortField === config.id && (
                                    <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {leads.map((lead, index) => (
                        <tr key={lead.id} className="group text-slate-700 text-sm transition-colors hover:bg-slate-50/80">
                            {/* Fixed columns */}
                            <td className="px-2 py-2 border-b border-slate-100 text-center text-slate-400 font-bold opacity-50">
                                {index + 1}
                            </td>
                            <td className="px-2 py-2 border-b border-slate-100">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(lead.id)}
                                    onChange={() => onSelectOne(lead.id)}
                                    className="rounded border-slate-300"
                                />
                            </td>

                            {/* Dynamic cells */}
                            {visibleFields.map(config => (
                                <td key={config.id} className="px-2 py-2 border-b border-slate-100">
                                    {renderCellValue(lead, config)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
