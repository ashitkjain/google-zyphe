import React, { useState, useRef, useEffect } from 'react';
import { ReminderRule, ReminderRuleCategory, ReminderRuleUrgency } from '../../types';

interface ReminderRulesManagerProps {
    rules: ReminderRule[];
    onUpdateRule: (ruleId: string, updates: Partial<ReminderRule>) => void;
    onSaveRules?: () => Promise<void>;
}

type EditingField = 'trigger' | 'condition' | 'action' | 'urgency' | null;

const ReminderRulesManager: React.FC<ReminderRulesManagerProps> = ({ rules, onUpdateRule, onSaveRules }) => {
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['lead', 'buyer', 'seller', 'relationship']));
    const [editingRule, setEditingRule] = useState<string | null>(null);
    const [editingField, setEditingField] = useState<EditingField>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const categories = [
        { id: 'lead', label: 'Lead & Prospecting', description: 'Speed-to-lead & conversion', icon: 'fa-user-plus', color: 'emerald' },
        { id: 'buyer', label: 'Active Buyer Deal', description: 'Prevent deal stall or loss', icon: 'fa-handshake', color: 'blue' },
        { id: 'seller', label: 'Listing & Seller Side', description: 'Reduce days on market & pricing mistakes', icon: 'fa-house-circle-check', color: 'purple' },
        { id: 'relationship', label: 'Client Relationship & Long-Term Value', description: 'Referrals & repeat business', icon: 'fa-heart', color: 'pink' }
    ];

    const urgencyOptions: ReminderRuleUrgency[] = ['high', 'medium', 'low'];

    const getCategoryValues = (category: ReminderRuleCategory) => {
        const categoryRules = rules.filter(r => r.category === category);
        return {
            triggers: Array.from(new Set(categoryRules.map(r => r.trigger))).sort(),
            conditions: Array.from(new Set(categoryRules.map(r => r.condition).filter(c => c))).sort(),
            actions: Array.from(new Set(categoryRules.map(r => r.suggested_action))).sort()
        };
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setEditingRule(null);
                setEditingField(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleCategory = (categoryId: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }
        setExpandedCategories(newExpanded);
    };

    const getCategoryColor = (color: string) => {
        const colors: Record<string, string> = {
            emerald: 'from-emerald-500 to-emerald-600',
            blue: 'from-blue-500 to-blue-600',
            purple: 'from-purple-500 to-purple-600',
            pink: 'from-pink-500 to-pink-600'
        };
        return colors[color] || colors.emerald;
    };

    const handleFieldClick = (ruleId: string, field: EditingField, event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setEditingRule(ruleId);
        setEditingField(field);
    };

    const handleFieldUpdate = (ruleId: string, field: string, value: string) => {
        const updates: Partial<ReminderRule> = {};
        if (field === 'trigger') updates.trigger = value;
        else if (field === 'condition') updates.condition = value;
        else if (field === 'action') updates.suggested_action = value;
        else if (field === 'urgency') updates.urgency = value as ReminderRuleUrgency;

        onUpdateRule(ruleId, updates);
        setHasUnsavedChanges(true);
        setEditingRule(null);
        setEditingField(null);
    };

    const handleSave = async () => {
        if (!onSaveRules || isSaving) return;
        setIsSaving(true);
        try {
            await onSaveRules();
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Failed to save rules:', error);
        } finally {
            setIsSaving(false);
        }
    };


    const getUrgencyLabel = (urgency: ReminderRuleUrgency) => {
        return urgency.charAt(0).toUpperCase() + urgency.slice(1) + ' Priority';
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 overflow-hidden relative">
            {/* Floating Action Buttons */}
            {hasUnsavedChanges && (
                <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`px-8 py-3 rounded-xl font-bold text-sm shadow-lg transition-all ${isSaving
                            ? 'bg-slate-400 text-white cursor-not-allowed'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-xl active:scale-95'
                            }`}
                    >
                        {isSaving ? (
                            <>
                                <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                                Saving...
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-save mr-2"></i>
                                Save
                            </>
                        )}
                    </button>

                    <span className="text-slate-900 font-bold text-[10px] tracking-wide animate-pulse flex items-center bg-white/80 px-3 py-1 rounded-full shadow-sm border border-slate-100">
                        <i className="fa-solid fa-circle-exclamation mr-1.5 text-amber-500"></i>
                        Changes not saved
                    </span>
                </div>
            )}

            {/* Rules by Category */}
            <div className="flex-1 overflow-y-auto p-10">
                <div className="max-w-5xl mx-auto space-y-6">
                    {categories.map((category) => {
                        const categoryRules = rules.filter(r => r.category === category.id);
                        const isExpanded = expandedCategories.has(category.id);

                        return (
                            <div key={category.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                                <button
                                    onClick={() => toggleCategory(category.id)}
                                    className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-t-2xl"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getCategoryColor(category.color)} flex items-center justify-center shadow-lg`}>
                                            <i className={`fa-solid ${category.icon} text-white text-xl`}></i>
                                        </div>
                                        <div className="text-left">
                                            <h3 className="text-lg font-black text-slate-900">{category.label}</h3>
                                            <p className="text-xs text-slate-500 font-medium">{category.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs font-bold text-slate-400">
                                            {categoryRules.filter(r => r.enabled).length} / {categoryRules.length} active
                                        </span>
                                        <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-slate-100 py-3 px-6 space-y-1">
                                        {categoryRules.map((rule) => (
                                            <label
                                                key={rule.id}
                                                className="flex items-center gap-3 py-2 px-2 rounded hover:bg-slate-50 transition-all cursor-pointer group"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={rule.enabled}
                                                    onChange={(e) => {
                                                        onUpdateRule(rule.id, { enabled: e.target.checked });
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                    className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500 flex-shrink-0"
                                                />
                                                <div className="flex-1 text-sm text-slate-700 leading-snug relative">
                                                    <span
                                                        onClick={(e) => handleFieldClick(rule.id, 'trigger', e)}
                                                        className="font-semibold text-slate-900 cursor-pointer hover:bg-indigo-50 px-1 rounded transition-colors"
                                                    >
                                                        {rule.trigger}
                                                        {!rule.isExecutable && <span className="text-rose-500 ml-1" title="Field mapping pending">*</span>}
                                                    </span>

                                                    {rule.condition && (
                                                        <>
                                                            {' '}<span className="text-slate-500">when</span>{' '}
                                                            <span
                                                                onClick={(e) => handleFieldClick(rule.id, 'condition', e)}
                                                                className="font-medium text-slate-800 cursor-pointer hover:bg-amber-50 px-1 rounded transition-colors"
                                                            >
                                                                {rule.condition}
                                                            </span>
                                                        </>
                                                    )}

                                                    {' '}<span className="text-slate-500">→</span>{' '}
                                                    <span
                                                        onClick={(e) => handleFieldClick(rule.id, 'action', e)}
                                                        className="font-semibold text-indigo-600 cursor-pointer hover:bg-indigo-50 px-1 rounded transition-colors"
                                                    >
                                                        {rule.suggested_action}
                                                    </span>

                                                    {editingRule === rule.id && editingField && (
                                                        <div ref={dropdownRef} className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto min-w-[300px]">
                                                            {editingField === 'trigger' && getCategoryValues(rule.category).triggers.map((trigger) => (
                                                                <button
                                                                    key={trigger}
                                                                    onClick={() => handleFieldUpdate(rule.id, 'trigger', trigger)}
                                                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 transition-colors ${rule.trigger === trigger ? 'bg-indigo-100 font-semibold' : ''}`}
                                                                >
                                                                    {trigger}
                                                                </button>
                                                            ))}

                                                            {editingField === 'condition' && getCategoryValues(rule.category).conditions.map((condition) => (
                                                                <button
                                                                    key={condition}
                                                                    onClick={() => handleFieldUpdate(rule.id, 'condition', condition)}
                                                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-amber-50 transition-colors ${rule.condition === condition ? 'bg-amber-100 font-semibold' : ''}`}
                                                                >
                                                                    {condition}
                                                                </button>
                                                            ))}

                                                            {editingField === 'action' && getCategoryValues(rule.category).actions.map((action) => (
                                                                <button
                                                                    key={action}
                                                                    onClick={() => handleFieldUpdate(rule.id, 'action', action)}
                                                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 transition-colors ${rule.suggested_action === action ? 'bg-indigo-100 font-semibold' : ''}`}
                                                                >
                                                                    {action}
                                                                </button>
                                                            ))}

                                                            {editingField === 'urgency' && urgencyOptions.map((urgency) => (
                                                                <button
                                                                    key={urgency}
                                                                    onClick={() => handleFieldUpdate(rule.id, 'urgency', urgency)}
                                                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-rose-50 transition-colors ${rule.urgency === urgency ? 'bg-rose-100 font-semibold' : ''}`}
                                                                >
                                                                    {getUrgencyLabel(urgency)}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <span
                                                    onClick={(e) => handleFieldClick(rule.id, 'urgency', e)}
                                                    className={`flex-shrink-0 px-2 py-0.5 text-xs font-bold rounded-full cursor-pointer transition-colors ${rule.urgency === 'high'
                                                        ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                                        : rule.urgency === 'medium'
                                                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                                            : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                                        }`}
                                                >
                                                    {getUrgencyLabel(rule.urgency)}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {/* Legend */}
                    <div className="pt-4 pb-10 border-t border-slate-100 flex items-center gap-2 justify-center">
                        <span className="text-rose-500 font-bold text-lg leading-none">*</span>
                        <p className="text-[10px] text-slate-500 font-medium">
                            Rules marked with an asterisk require additional field mappings in the Lead schema for automatic execution.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReminderRulesManager;
