import React, { useState } from 'react';
import { Trigger, MOCK_TRIGGERS } from './shared';

const TriggerEditor: React.FC<{ trigger: Trigger; onBack: () => void; onSave: (t: Trigger) => void }> = ({ trigger, onBack, onSave }) => {
    const [localThreshold, setLocalThreshold] = useState(trigger.threshold || '');
    const [isActive, setIsActive] = useState(trigger.active);

    return (
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                    <i className="fa-solid fa-arrow-left text-slate-500"></i>
                </button>
                <div>
                    <h2 className="text-xl font-black text-slate-900">{trigger.title}</h2>
                    <p className="text-slate-500 text-sm">{trigger.description}</p>
                </div>
            </div>

            <div className="space-y-6 max-w-lg">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Trigger Threshold</label>
                    <input
                        type="text"
                        value={localThreshold}
                        onChange={(e) => setLocalThreshold(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none font-bold text-slate-900"
                    />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                            <i className="fa-solid fa-power-off"></i>
                        </div>
                        <div>
                            <div className="font-bold text-slate-900">Status</div>
                            <div className="text-xs text-slate-500">{isActive ? 'Active & Monitoring' : 'Disabled'}</div>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsActive(!isActive)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                <div className="pt-4 flex gap-3">
                    <button onClick={() => onSave({ ...trigger, threshold: localThreshold, active: isActive })} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-800">
                        Save Trigger
                    </button>
                </div>
            </div>
        </div>
    );
};

const TriggersModule: React.FC = () => {
    const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
    const [triggers, setTriggers] = useState<Trigger[]>(MOCK_TRIGGERS);

    const handleSaveTrigger = (updatedTrigger: Trigger) => {
        setTriggers(triggers.map(t => t.id === updatedTrigger.id ? updatedTrigger : t));
        setSelectedTriggerId(null);
    };

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Timing & Trigger Engine</h1>
                <p className="text-slate-500">Configure automated market signals that wake up your database.</p>
            </div>

            {selectedTriggerId ? (
                <TriggerEditor
                    trigger={triggers.find(t => t.id === selectedTriggerId)!}
                    onBack={() => setSelectedTriggerId(null)}
                    onSave={handleSaveTrigger}
                />
            ) : (
                <div className="grid grid-cols-2 gap-6">
                    {triggers.map((trigger) => (
                        <div
                            key={trigger.id}
                            onClick={() => setSelectedTriggerId(trigger.id)}
                            className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4">
                                <div className={`w-10 h-6 rounded-full relative transition-colors ${trigger.active ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${trigger.active ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </div>
                            </div>
                            <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 mb-4 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                <i className={`fa-solid ${trigger.icon}`}></i>
                            </div>
                            <h3 className="font-bold text-slate-900">{trigger.title}</h3>
                            <p className="text-xs text-slate-400 mt-2">Currently monitoring {trigger.monitoredCount} leads.</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TriggersModule;
