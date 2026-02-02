import React, { useState } from 'react';

interface Props {
    realtorId: string;
}

type RegistrationStep = 'brand' | 'campaign' | 'review' | 'status';

const SmsRegistrationTab: React.FC<Props> = ({ realtorId }) => {
    const [step, setStep] = useState<RegistrationStep>('brand');
    const [formData, setFormData] = useState({
        legalName: '',
        ein: '',
        website: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        useCase: 'AGENTS_AND_FRANCHISES',
        description: 'Direct client communication for real estate leads.',
        sample1: 'Hi {firstName}, this is [Name]. Confirming our viewing for {address}. Reply STOP to unsubscribe.',
        sample2: 'The inspection report for {address} is ready. Reply STOP to opt out.'
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const nextStep = () => {
        if (step === 'brand') setStep('campaign');
        else if (step === 'campaign') setStep('review');
    };

    const prevStep = () => {
        if (step === 'campaign') setStep('brand');
        else if (step === 'review') setStep('campaign');
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsSubmitting(false);
        setStep('status');
    };

    return (
        <div className="max-w-4xl mx-auto py-12 px-6 animate-in fade-in duration-700">
            <div className="mb-12">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">A2P SMS Registration</h1>
                <p className="text-slate-500 font-medium max-w-2xl">
                    Register your business to ensure your messages are delivered reliably.
                    US regulations (10DLC) require brand and campaign verification for all business SMS.
                </p>
            </div>

            {/* Stepper */}
            <div className="flex items-center justify-between mb-12 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="flex-1 flex items-center justify-center gap-4 relative z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black transition-all ${step === 'brand' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110' : 'bg-slate-100 text-slate-400'}`}>1</div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${step === 'brand' ? 'text-slate-900' : 'text-slate-400'}`}>Brand</span>
                </div>
                <div className="w-12 h-px bg-slate-100"></div>
                <div className="flex-1 flex items-center justify-center gap-4 relative z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black transition-all ${step === 'campaign' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110' : 'bg-slate-100 text-slate-400'}`}>2</div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${step === 'campaign' ? 'text-slate-900' : 'text-slate-400'}`}>Campaign</span>
                </div>
                <div className="w-12 h-px bg-slate-100"></div>
                <div className="flex-1 flex items-center justify-center gap-4 relative z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black transition-all ${step === 'review' || step === 'status' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110' : 'bg-slate-100 text-slate-400'}`}>3</div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${step === 'review' || step === 'status' ? 'text-slate-900' : 'text-slate-400'}`}>Status</span>
                </div>
            </div>

            {step === 'brand' && (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-10 animate-in slide-in-from-right-4 duration-500">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                            <i className="fa-solid fa-building text-xl"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900">Brand Identity</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Business Details</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Legal Business Name</label>
                            <input
                                type="text" name="legalName" value={formData.legalName} onChange={handleInputChange}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                placeholder="e.g. Jain Realty Group LLC"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tax ID (EIN)</label>
                            <input
                                type="text" name="ein" value={formData.ein} onChange={handleInputChange}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                placeholder="12-3456789"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Business Website</label>
                            <input
                                type="url" name="website" value={formData.website} onChange={handleInputChange}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                placeholder="https://jainrealty.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Street Address</label>
                            <input
                                type="text" name="address" value={formData.address} onChange={handleInputChange}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                placeholder="123 Main St"
                            />
                        </div>
                    </div>

                    <div className="mt-12 flex justify-end">
                        <button
                            onClick={nextStep}
                            className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                        >
                            Continue to Campaign <i className="fa-solid fa-arrow-right ml-2"></i>
                        </button>
                    </div>
                </div>
            )}

            {step === 'campaign' && (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-10 animate-in slide-in-from-right-4 duration-500">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                            <i className="fa-solid fa-bullhorn text-xl"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900">Campaign Intent</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Messaging Details</p>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Primary Use Case</label>
                            <select
                                name="useCase" value={formData.useCase} onChange={handleInputChange}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                            >
                                <option value="AGENTS_AND_FRANCHISES">Agents and Franchises (Real Estate)</option>
                                <option value="CUSTOMER_CARE">Customer Care / Conversational</option>
                                <option value="MARKETING">Marketing / Promotional</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Campaign Description</label>
                            <textarea
                                name="description" value={formData.description} onChange={handleInputChange}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px]"
                                placeholder="Explain why you are sending messages..."
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sample Message 1</label>
                                <textarea
                                    name="sample1" value={formData.sample1} onChange={handleInputChange}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sample Message 2</label>
                                <textarea
                                    name="sample2" value={formData.sample2} onChange={handleInputChange}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px]"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 flex justify-between">
                        <button
                            onClick={prevStep}
                            className="text-slate-400 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-all"
                        >
                            <i className="fa-solid fa-arrow-left mr-2"></i> Back
                        </button>
                        <button
                            onClick={nextStep}
                            className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                        >
                            Review Submission <i className="fa-solid fa-arrow-right ml-2"></i>
                        </button>
                    </div>
                </div>
            )}

            {step === 'review' && (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-10 animate-in zoom-in-95 duration-500">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
                            <i className="fa-solid fa-magnifying-glass text-xl"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900">Final Review</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verify before submission</p>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-[2rem] p-8 space-y-8 mb-10">
                        <div className="grid grid-cols-2 gap-10">
                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Brand</h4>
                                <p className="text-sm font-black text-slate-900">{formData.legalName || 'N/A'}</p>
                                <p className="text-xs font-bold text-slate-500 mt-1">{formData.ein || 'N/A'}</p>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Website</h4>
                                <p className="text-sm font-black text-indigo-600 underline">{formData.website || 'N/A'}</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Address</h4>
                            <p className="text-sm font-black text-slate-800">{formData.address || 'N/A'}</p>
                        </div>
                        <div className="h-px bg-slate-200 w-full"></div>
                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Campaign Use Case</h4>
                            <p className="text-sm font-black text-slate-900">Agents and Franchises (Real Estate)</p>
                        </div>
                    </div>

                    <div className="mt-12 flex justify-between">
                        <button
                            onClick={prevStep}
                            className="text-slate-400 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-all"
                            disabled={isSubmitting}
                        >
                            <i className="fa-solid fa-arrow-left mr-2"></i> Back
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className={`px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl ${isSubmitting ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'}`}
                        >
                            {isSubmitting ? (
                                <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Submitting...</>
                            ) : (
                                <><i className="fa-solid fa-cloud-arrow-up mr-2"></i> Submit for Approval</>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {step === 'status' && (
                <div className="bg-slate-900 rounded-[3rem] p-16 text-center shadow-2xl animate-in zoom-in-95 duration-700">
                    <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-500 text-white flex items-center justify-center text-4xl shadow-2xl shadow-indigo-500/20 mx-auto mb-8 animate-bounce">
                        <i className="fa-solid fa-clock-rotate-left"></i>
                    </div>
                    <h2 className="text-3xl font-black text-white mb-4">Registration Pending</h2>
                    <p className="text-slate-400 font-medium max-w-lg mx-auto leading-relaxed mb-10">
                        Your application has been submitted to Telnyx and the carrier networks.
                        Carrier review typically takes <span className="text-indigo-400 font-black">3-7 business days</span>.
                        We will notify you once your campaign is ACTIVE.
                    </p>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/5 max-w-md mx-auto">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                            <span className="text-slate-500">Submission ID</span>
                            <span className="text-indigo-400">REG-{Math.floor(Math.random() * 90000) + 10000}</span>
                        </div>
                    </div>
                    <div className="mt-12">
                        <button
                            onClick={() => window.location.reload()}
                            className="text-white/40 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SmsRegistrationTab;
