import React, { useState } from 'react';

export interface ActionItem {
    id: string;
    type: 'reply' | 'task' | 'error';
    leadName: string;
    leadId: string;
    content: string;
    timestamp: Date;
    priority: 'high' | 'medium' | 'low';
    sentiment?: 'positive' | 'negative' | 'neutral' | 'question';
}

interface ActionCenterWidgetProps {
    onOpenLead: (leadId: string) => void;
}

const ActionCenterWidget: React.FC<ActionCenterWidgetProps> = ({ onOpenLead }) => {
    // Mock Data for "Live" simulation
    const [actionItems, setActionItems] = useState<ActionItem[]>([
        {
            id: '1',
            type: 'reply',
            leadName: 'Sarah Miller',
            leadId: 'L-102',
            content: "Thanks for checking in! We are actually looking to restart our search next month.",
            timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 mins ago
            priority: 'high',
            sentiment: 'positive'
        },
        {
            id: '2',
            type: 'reply',
            leadName: 'Mike Johnson',
            leadId: 'L-105',
            content: "What are the current rates for a 30-year fixed?",
            timestamp: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
            priority: 'medium',
            sentiment: 'question'
        }
    ]);

    const handleDismiss = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setActionItems(prev => prev.filter(item => item.id !== id));
    };

    if (actionItems.length === 0) return null;

    return (
        <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-xl shadow-indigo-500/5 mb-8 animate-in slide-in-from-top-4 duration-700">
            <div className="bg-gradient-to-r from-rose-50 to-white px-8 py-4 border-b border-rose-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 animate-pulse">
                        <i className="fa-solid fa-bell text-sm"></i>
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-800">Action Required</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{actionItems.length} Leads Waiting for Response</p>
                    </div>
                </div>
            </div>

            <div className="divide-y divide-slate-50">
                {actionItems.map(item => (
                    <div
                        key={item.id}
                        onClick={() => onOpenLead(item.leadId)}
                        className="p-6 hover:bg-slate-50 transition-colors cursor-pointer group flex items-start gap-4"
                    >
                        {/* Status Indicator */}
                        <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${item.priority === 'high' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-amber-500'
                            }`}></div>

                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-slate-700 text-sm">{item.leadName}</span>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${item.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700' :
                                            item.sentiment === 'question' ? 'bg-amber-100 text-amber-700' :
                                                'bg-slate-100 text-slate-600'
                                        }`}>
                                        {item.sentiment}
                                    </span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400">
                                    {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>

                            <p className="text-sm font-medium text-slate-600 italic leading-relaxed">"{item.content}"</p>

                            <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-md shadow-indigo-500/20 transition-all">
                                    <i className="fa-solid fa-reply mr-1.5"></i> Reply Now
                                </button>
                                <button
                                    onClick={(e) => handleDismiss(item.id, e)}
                                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ActionCenterWidget;
