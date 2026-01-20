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

        if (value === undefined || value === null) return '--';

        // Handle different field types
        switch (config.type) {
            case 'date':
                if (value.toDate) return value.toDate().toLocaleDateString();
                return new Date(value).toLocaleDateString();

            case 'boolean':
                return value ? '✓' : '✗';

            case 'enum':
                return value;

            case 'object':
                // For objects, show a summary or specific fields
                if (config.id === 'primaryContact') {
                    return (
                        <div className="flex flex-col text-xs">
                            <div className="font-semibold">{value.phone || '--'}</div>
                            <div className="text-blue-600">{value.email || '--'}</div>
                        </div>
                    );
                }
                return JSON.stringify(value).substring(0, 50) + '...';

            case 'list':
                return Array.isArray(value) ? `${value.length} items` : '--';

            default:
                return String(value);
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
