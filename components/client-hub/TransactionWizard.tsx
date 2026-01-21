import React, { useState, useMemo } from 'react';
import { Lead, Transaction, TransactionType, TransactionStatus } from '../../types';
import { createTransaction } from '../../services/firebaseService';

interface TransactionWizardProps {
    leads: Lead[];
    realtorId: string;
    onClose: () => void;
    onComplete: (transaction: Transaction) => void;
}

type WizardStep = 'SELECT_CLIENT' | 'BASIC_INFO' | 'DATES' | 'CONFIRM';

const TransactionWizard: React.FC<TransactionWizardProps> = ({ leads, realtorId, onClose, onComplete }) => {
    const [step, setStep] = useState<WizardStep>('SELECT_CLIENT');
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<Transaction>>({
        type: 'BUY',
        status: 'DRAFT',
        property: {
            address: '',
            zpid: ''
        },
        purchase_price: 0,
        commission: '2.5%',
        important_dates: {
            acceptance_date: null,
            contingency_removal_date: null
        }
    });

    // Filter leads in closing
    const closingLeads = useMemo(() => {
        return leads.filter(lead =>
            lead.funnelStage === 'Contract' ||
            lead.status === 'In Contract' ||
            lead.funnelStage === 'Closed'
        );
    }, [leads]);

    const selectedLead = useMemo(() =>
        leads.find(l => l.id === selectedLeadId),
        [leads, selectedLeadId]);

    const handleSelectLead = (lead: Lead) => {
        setSelectedLeadId(lead.id);
        setFormData(prev => ({
            ...prev,
            type: lead.leadType === 'Buyer' ? 'BUY' : lead.leadType === 'Seller' ? 'SELL' : 'OTHER',
            property: {
                address: lead.subjectProperty || lead.propertyAddress || '',
                zpid: lead.zpid || ''
            },
            purchase_price: lead.price || 0
        }));
        setStep('BASIC_INFO');
    };

    const handleComplete = async () => {
        setLoading(true);
        try {
            const newTransaction: Transaction = {
                id: '', // Auto-gen
                realtorId,
                clientId: selectedLeadId || undefined,
                type: formData.type as TransactionType,
                status: 'ACTIVE',
                property: formData.property || { address: '' },
                apn: '',
                state: 'CA',
                purchase_price: formData.purchase_price,
                commission: formData.commission,
                important_dates: formData.important_dates || {},
                checklist: [],
                created_at: new Date(),
                updated_at: new Date()
            };

            const created = await createTransaction(newTransaction);
            if (created) {
                onComplete(created);
            }
        } catch (error) {
            console.error("Error in wizard:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/20 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-12 py-10 bg-gradient-to-br from-indigo-600 to-purple-700 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-8 right-8 w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                    >
                        <i className="fa-solid fa-xmark text-xl"></i>
                    </button>

                    <div className="flex items-center gap-6 mb-8">
                        <div className="w-16 h-16 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-xl">
                            <i className="fa-solid fa-file-signature text-3xl"></i>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black tracking-tight">New Transaction</h2>
                            <p className="text-indigo-100/80 font-medium">Initialize a new real estate record</p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex items-center gap-4">
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white transition-all duration-500 ease-out shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                                style={{ width: step === 'SELECT_CLIENT' ? '25%' : step === 'BASIC_INFO' ? '50%' : step === 'DATES' ? '75%' : '100%' }}
                            ></div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                            {step === 'SELECT_CLIENT' ? 'Step 1 of 4' : step === 'BASIC_INFO' ? 'Step 2 of 4' : step === 'DATES' ? 'Step 3 of 4' : 'Final Step'}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-12">
                    {step === 'SELECT_CLIENT' && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center max-w-lg mx-auto mb-10">
                                <h3 className="text-2xl font-black text-slate-900 mb-4">Select an Existing Client</h3>
                                <p className="text-slate-500">Only clients currently in the "In Contract" or "Closing" stage are shown here.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {closingLeads.length > 0 ? (
                                    closingLeads.map(lead => (
                                        <button
                                            key={lead.id}
                                            onClick={() => handleSelectLead(lead)}
                                            className="group flex items-center gap-4 p-6 bg-slate-50 border border-slate-100 rounded-3xl hover:bg-white hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/10 transition-all text-left"
                                        >
                                            <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-sm flex-shrink-0">
                                                {lead.clientPhotoUrl ? (
                                                    <img src={lead.clientPhotoUrl} alt={lead.firstName} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                                        {lead.firstName.charAt(0)}{lead.lastName.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                                    {lead.firstName} {lead.lastName}
                                                </div>
                                                <div className="text-xs text-slate-400 font-medium truncate">
                                                    {lead.subjectProperty || lead.propertyAddress}
                                                </div>
                                            </div>
                                            <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all"></i>
                                        </button>
                                    ))
                                ) : (
                                    <div className="col-span-2 py-12 text-center bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
                                        <p className="text-slate-400 font-medium">No clients found in Closing stage.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'BASIC_INFO' && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Property Address</label>
                                    <input
                                        type="text"
                                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-800"
                                        value={formData.property?.address}
                                        onChange={(e) => setFormData({ ...formData, property: { ...formData.property, address: e.target.value } })}
                                    />
                                </div>
                                <div className="space-y-4">
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Transaction Type</label>
                                    <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                                        {['BUY', 'SELL', 'OTHER'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setFormData({ ...formData, type: type as any })}
                                                className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${formData.type === type ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Purchase Price</label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                        <input
                                            type="number"
                                            className="w-full p-5 pl-10 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-800"
                                            value={formData.purchase_price}
                                            onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Commission</label>
                                    <input
                                        type="text"
                                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-800"
                                        value={formData.commission}
                                        onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-between pt-10">
                                <button onClick={() => setStep('SELECT_CLIENT')} className="px-8 py-4 text-slate-400 font-black uppercase tracking-widest hover:text-slate-600 transition-all italic underline underline-offset-8">Back</button>
                                <button onClick={() => setStep('DATES')} className="px-10 py-5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-indigo-700 shadow-xl shadow-indigo-600/30 transition-all flex items-center gap-4 group">
                                    Next Step
                                    <i className="fa-solid fa-arrow-right group-hover:translate-x-2 transition-all"></i>
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'DATES' && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Acceptance Date</label>
                                    <input
                                        type="date"
                                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-800"
                                        onChange={(e) => setFormData({ ...formData, important_dates: { ...formData.important_dates, acceptance_date: new Date(e.target.value) } })}
                                    />
                                </div>
                                <div className="space-y-4">
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Close of Escrow Date</label>
                                    <input
                                        type="date"
                                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-800"
                                        onChange={(e) => setFormData({ ...formData, close_of_escrow_date: new Date(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-4">
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Contingency Removal</label>
                                    <input
                                        type="date"
                                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-800"
                                        onChange={(e) => setFormData({ ...formData, important_dates: { ...formData.important_dates, contingency_removal_date: new Date(e.target.value) } })}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-between pt-10">
                                <button onClick={() => setStep('BASIC_INFO')} className="px-8 py-4 text-slate-400 font-black uppercase tracking-widest hover:text-slate-600 transition-all italic underline underline-offset-8">Back</button>
                                <button onClick={() => setStep('CONFIRM')} className="px-10 py-5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-indigo-700 shadow-xl shadow-indigo-600/30 transition-all flex items-center gap-4 group">
                                    Next Step
                                    <i className="fa-solid fa-arrow-right group-hover:translate-x-2 transition-all"></i>
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'CONFIRM' && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="p-10 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6">
                                <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                                    <i className="fa-solid fa-circle-check text-emerald-500"></i>
                                    Review & Confirm
                                </h3>

                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Client</div>
                                        <div className="font-bold text-slate-800 text-lg">{selectedLead?.firstName} {selectedLead?.lastName}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Property</div>
                                        <div className="font-bold text-slate-800">{formData.property?.address}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Deal Info</div>
                                        <div className="font-bold text-slate-800">{formData.type} @ ${formData.purchase_price?.toLocaleString()}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Commission</div>
                                        <div className="font-bold text-emerald-600">{formData.commission}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between pt-10">
                                <button onClick={() => setStep('DATES')} className="px-8 py-4 text-slate-400 font-black uppercase tracking-widest hover:text-slate-600 transition-all italic underline underline-offset-8">Back</button>
                                <button
                                    onClick={handleComplete}
                                    disabled={loading}
                                    className="px-12 py-6 bg-indigo-600 text-white rounded-[2rem] text-sm font-black uppercase tracking-[0.25em] hover:bg-indigo-700 shadow-2xl shadow-indigo-600/40 transition-all flex items-center justify-center gap-4 min-w-[200px]"
                                >
                                    {loading ? (
                                        <>
                                            <i className="fa-solid fa-spinner fa-spin"></i>
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            Create Transaction
                                            <i className="fa-solid fa-rocket"></i>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TransactionWizard;
