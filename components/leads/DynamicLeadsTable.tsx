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
        const isVisibleForPersona = !config.visibility || config.visibility.includes(leadType);
        const stages = config.funnelVisibility || ['All'];
        const effectiveStage = funnelStage === 'Closed & Archived' ? 'Closed' : funnelStage;
        const isVisibleForStage =
            stages.includes('All') ||
            (funnelStage === 'Closed & Archived' ? (stages.includes('Closed') || stages.includes('Archived')) : stages.includes(effectiveStage as FunnelStage));
        return isVisibleForPersona && isVisibleForStage;
    });

    // Organize fields into parent-child hierarchy
    const organizedFields: Array<{
        parent: any;
        children: any[];
        colSpan: number;
    }> = [];

    visibleFields.forEach(field => {
        if ((field.type === 'object' || field.type === 'list') && field.fields) {
            // Parent field with children
            const visibleChildren = field.fields.filter((childField: any) => {
                const childStages = childField.funnelVisibility || ['All'];
                const childIsVisibleForPersona = !childField.visibility || childField.visibility.includes(leadType);
                const effectiveStage = funnelStage === 'Closed & Archived' ? 'Closed' : funnelStage;
                const childIsVisibleForStage =
                    childStages.includes('All') ||
                    (funnelStage === 'Closed & Archived' ? (childStages.includes('Closed') || childStages.includes('Archived')) : childStages.includes(effectiveStage as FunnelStage));
                return childIsVisibleForPersona && childIsVisibleForStage;
            });

            if (visibleChildren.length > 0) {
                organizedFields.push({
                    parent: field,
                    children: visibleChildren,
                    colSpan: visibleChildren.length
                });
            }
        } else {
            // Simple field
            organizedFields.push({
                parent: field,
                children: [],
                colSpan: 1
            });
        }
    });

    // Helper to safely convert timestamps
    const formatDate = (dateValue: any): string => {
        if (!dateValue) return '--';
        try {
            if (dateValue.toDate) return dateValue.toDate().toLocaleDateString();
            if (dateValue.seconds) return new Date(dateValue.seconds * 1000).toLocaleDateString();
            return new Date(dateValue).toLocaleDateString();
        } catch {
            return '--';
        }
    };

    // Helper to safely convert any value to string
    const safeStringify = (val: any): string => {
        if (val == null) return '';
        if (typeof val === 'string') return val;
        if (typeof val === 'number' || typeof val === 'boolean') return String(val);
        if (val.toDate) return formatDate(val);
        if (val.seconds) return formatDate(val);
        if (typeof val === 'object') return JSON.stringify(val).substring(0, 30) + '...';
        return String(val);
    };

    // Render cell value
    const renderCellValue = (lead: Lead, fieldId: string, fieldType: string) => {
        const value = (lead as any)[fieldId];

        if (value === undefined || value === null) return <span className="text-slate-300">--</span>;

        switch (fieldType) {
            case 'date':
            case 'timestamp':
                return <span>{formatDate(value)}</span>;

            case 'boolean':
                return <span className={value ? 'text-green-600' : 'text-slate-400'}>{value ? '✓' : '✗'}</span>;

            case 'enum':
                return <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{value}</span>;

            case 'currency':
                return <span className="font-semibold text-green-600">${typeof value === 'number' ? value.toLocaleString() : value}</span>;

            case 'integer':
            case 'number':
                return <span className="font-mono">{value}</span>;

            case 'url':
                return <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[200px] block">{value}</a>;

            default:
                const strValue = String(value);
                if (strValue.length > 100) {
                    return <div className="max-w-[300px] truncate" title={strValue}>{strValue}</div>;
                }
                return strValue;
        }
    };

    // Render nested field value
    const renderNestedValue = (lead: Lead, parentId: string, childId: string, childType: string) => {
        const parentValue = (lead as any)[parentId];
        if (!parentValue) return <span className="text-slate-300">--</span>;

        const value = parentValue[childId];
        if (value === undefined || value === null) return <span className="text-slate-300">--</span>;

        return renderCellValue({ ...lead, [childId]: value } as Lead, childId, childType);
    };

    return (
        <div className="overflow-x-auto w-full pb-6 -mx-4 px-4">
            <table className="text-left border-collapse min-w-max">
                <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-semibold text-slate-500">
                    {/* Row 1: Parent headers */}
                    <tr>
                        <th rowSpan={2} className="w-12 px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">#</th>
                        <th rowSpan={2} className="w-10 px-2 py-3 border-b border-slate-200/60 bg-slate-50">
                            <input
                                type="checkbox"
                                onChange={(e) => onSelectAll(leads, e.target.checked)}
                                checked={leads.length > 0 && leads.every(l => selectedIds.has(l.id))}
                                className="rounded border-slate-300"
                            />
                        </th>

                        {organizedFields.map((field, idx) => (
                            field.children.length > 0 ? (
                                <th
                                    key={idx}
                                    colSpan={field.colSpan}
                                    className="px-2 py-2 border-b border-slate-200/60 bg-slate-100 text-center font-bold"
                                >
                                    {field.parent.label}
                                </th>
                            ) : (
                                <th
                                    key={idx}
                                    rowSpan={2}
                                    className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                                    onClick={() => onSort(field.parent.id)}
                                >
                                    {field.parent.label}
                                    {sortField === field.parent.id && (
                                        <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>
                                    )}
                                </th>
                            )
                        ))}
                    </tr>

                    {/* Row 2: Child headers (only for nested fields) */}
                    <tr>
                        {organizedFields.map((field, idx) =>
                            field.children.map((child: any, childIdx: number) => (
                                <th
                                    key={`${idx}-${childIdx}`}
                                    className="px-2 py-2 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100 whitespace-nowrap text-xs"
                                    onClick={() => onSort(`${field.parent.id}.${child.id}`)}
                                >
                                    {child.label}
                                    {sortField === `${field.parent.id}.${child.id}` && (
                                        <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>
                                    )}
                                </th>
                            ))
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {leads.map((lead, index) => (
                        <tr key={lead.id} className="group text-slate-700 text-sm transition-colors hover:bg-slate-50/80">
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

                            {organizedFields.map((field, idx) => (
                                field.children.length > 0 ? (
                                    // Nested field - render each child
                                    field.children.map((child: any, childIdx: number) => (
                                        <td key={`${idx}-${childIdx}`} className="px-2 py-2 border-b border-slate-100">
                                            {renderNestedValue(lead, field.parent.id, child.id, child.type)}
                                        </td>
                                    ))
                                ) : (
                                    // Simple field
                                    <td key={idx} className="px-2 py-2 border-b border-slate-100">
                                        {renderCellValue(lead, field.parent.id, field.parent.type)}
                                    </td>
                                )
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
