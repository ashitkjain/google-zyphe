import React, { useState } from 'react';
import { ReminderRule, ReminderRuleCategory, ReminderRuleUrgency } from '../../types';

interface ReminderRulesManagerProps {
    rules: ReminderRule[];
    onUpdateRule: (ruleId: string, updates: Partial<ReminderRule>) => void;
}

const ReminderRulesManager: React.FC<ReminderRulesManagerProps> = ({ rules, onUpdateRule }) => {
    const [selectedCategory, setSelectedCategory] = useState<ReminderRuleCategory | 'all'>('all');
    const [editingRule, setEditingRule] = useState<string | null>(null);
    const [expandedRule, setExpandedRule] = useState<string | null>(null);

    const categories = [
        { id: 'all', label: 'All Rules', icon: 'fa-list-check', count: rules.length },
        { id: 'lead', label: 'Lead & Prospecting', icon: 'fa-user-plus', count: rules.filter(r => r.category === 'lead').length },
        { id: 'buyer', label: 'Active Buyer Deal', icon: 'fa-handshake', count: rules.filter(r => r.category === 'buyer').length },
        { id: 'seller', label: 'Listing & Seller', icon: 'fa-house-circle-check', count: rules.filter(r => r.category === 'seller').length },
        { id: 'relationship', label: 'Client Relationship', icon: 'fa-heart', count: rules.filter(r => r.category === 'relationship').length }
    ];

    const filteredRules = selectedCategory === 'all'
        ? rules
        : rules.filter(rule => rule.category === selectedCategory);

    const getUrgencyColor = (urgency: ReminderRuleUrgency) => {
        switch (urgency) {
            case 'high': return 'bg-rose-50 text-rose-600 border-rose-200';
            case 'medium': return 'bg-amber-50 text-amber-600 border-amber-200';
            case 'low': return 'bg-indigo-50 text-indigo-600 border-indigo-200';
        }
    };

    const getCategoryColor = (category: ReminderRuleCategory) => {
        switch (category) {
            case 'lead': return 'bg-emerald-50 text-emerald-700';
            case 'buyer': return 'bg-blue-50 text-blue-700';
            case 'seller': return 'bg-purple-50 text-purple-700';
            case 'relationship': return 'bg-pink-50 text-pink-700';
        }
    };

    const handleToggleRule = (ruleId: string, enabled: boolean) => {
        onUpdateRule(ruleId, { enabled });
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 overflow-hidden">
            {/* Header */}
            <div className="p-10 bg-white border-b border-slate-200/60 shadow-sm relative z-20">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Reminder Rules</h2>
                        <p className="text-sm text-slate-500 font-medium">Configure automated task triggers and notifications</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo100">
                            <i className="fa-solid fa-robot text-indigo-600"></i>
                            <span className="text-xs font-bold text-indigo-900">{rules.filter(r => r.enabled).length} Active Rules</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Category Filters */}
            <div className="px-10 py-6 bg-white border-b border-slate-100">
                <div className="flex gap-3 overflow-x-auto pb-2">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id as any)}
                            className={`flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${selectedCategory === cat.id
                                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                        >
                            <i className={`fa-solid ${cat.icon}`}></i>
                            <span>{cat.label}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-black ${selectedCategory === cat.id ? 'bg-white/20' : 'bg-slate-200 text-slate-700'
                                }`}>
                                {cat.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Rules List */}
            <div className="flex-1 overflow-y-auto p-10">
                <div className="max-w-6xl mx-auto space-y-4">
                    {filteredRules.map((rule, index) => {
                        const isExpanded = expandedRule === rule.id;
                        const isEditing = editingRule === rule.id;

                        return (
                            <div
                                key={rule.id}
                                className={`bg-white rounded-2xl border transition-all ${isExpanded
                                        ? 'border-indigo-300 shadow-xl shadow-indigo-100/50'
                                        : 'border-slate-200 hover:border-indigo-200 shadow-sm hover:shadow-md'
                                    }`}
                            >
                                {/* Rule Header */}
                                <div
                                    className="p-6 cursor-pointer"
                                    onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Toggle Switch */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleRule(rule.id, !rule.enabled);
                                            }}
                                            className={`mt-1 w-12 h-6 rounded-full transition-all relative ${rule.enabled ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-slate-300'
                                                }`}
                                        >
                                            <div
                                                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${rule.enabled ? 'left-7' : 'left-1'
                                                    }`}
                                            />
                                        </button>

                                        {/* Rule Number & Content */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 flex items-center justify-center text-xs font-black text-indigo-700">
                                                    {index + 1}
                                                </span>
                                                <h3 className={`text-lg font-black tracking-tight ${rule.enabled ? 'text-slate-900' : 'text-slate-400'}`}>
                                                    {rule.name}
                                                </h3>
                                            </div>

                                            {/* Quick Info */}
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${getCategoryColor(rule.category)}`}>
                                                    {rule.category.toUpperCase()}
                                                </span>
                                                <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${getUrgencyColor(rule.urgency)}`}>
                                                    {rule.urgency.toUpperCase()} PRIORITY
                                                </span>
                                                <span className="text-xs text-slate-500 font-medium">
                                                    <i className="fa-solid fa-bolt text-amber-500 mr-1"></i>
                                                    {rule.trigger}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Expand Icon */}
                                        <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="px-6 pb-6 border-t border-slate-100 pt-6 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {/* Trigger & Condition */}
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                                                    <i className="fa-solid fa-bolt text-amber-500 mr-2"></i>Trigger
                                                </label>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={rule.trigger}
                                                        onChange={(e) => onUpdateRule(rule.id, { trigger: e.target.value })}
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                    />
                                                ) : (
                                                    <p className="text-sm font-semibold text-slate-900 bg-slate-50 px-4 py-3 rounded-xl">{rule.trigger}</p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                                                    <i className="fa-solid fa-clock text-indigo-500 mr-2"></i>Condition
                                                </label>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={rule.condition}
                                                        onChange={(e) => onUpdateRule(rule.id, { condition: e.target.value })}
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                    />
                                                ) : (
                                                    <p className="text-sm font-semibold text-slate-900 bg-slate-50 px-4 py-3 rounded-xl">
                                                        {rule.condition || 'N/A'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Suggested Action */}
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                                                <i className="fa-solid fa-clipboard-check text-emerald-500 mr-2"></i>Suggested Action
                                            </label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={rule.suggested_action}
                                                    onChange={(e) => onUpdateRule(rule.id, { suggested_action: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                />
                                            ) : (
                                                <p className="text-sm font-semibold text-slate-900 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 rounded-xl border border-emerald-200">
                                                    {rule.suggested_action}
                                                </p>
                                            )}
                                        </div>

                                        {/* Suggested Message */}
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                                                <i className="fa-solid fa-message text-blue-500 mr-2"></i>Suggested Message Template
                                            </label>
                                            {isEditing ? (
                                                <textarea
                                                    value={rule.suggested_message}
                                                    onChange={(e) => onUpdateRule(rule.id, { suggested_message: e.target.value })}
                                                    rows={4}
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                                />
                                            ) : (
                                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 rounded-xl border border-blue-200">
                                                    <p className="text-sm font-medium text-slate-700 italic leading-relaxed">
                                                        "{rule.suggested_message}"
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-2">
                                                        Variables: <code className="bg-white px-2 py-0.5 rounded text-indigo-600">{'{firstName}'}</code>,{' '}
                                                        <code className="bg-white px-2 py-0.5 rounded text-indigo-600">{'{propertyAddress}'}</code>,{' '}
                                                        <code className="bg-white px-2 py-0.5 rounded text-indigo-600">{'{neighborhood}'}</code>
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                            <button
                                                onClick={() => setEditingRule(isEditing ? null : rule.id)}
                                                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isEditing
                                                        ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                    }`}
                                            >
                                                <i className={`fa-solid ${isEditing ? 'fa-check' : 'fa-pen'} mr-2`}></i>
                                                {isEditing ? 'Save Changes' : 'Edit Rule'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {filteredRules.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                            <i className="fa-solid fa-inbox text-3xl text-slate-300"></i>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">No rules in this category</h3>
                        <p className="text-sm text-slate-500">Try selecting a different category</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReminderRulesManager;
