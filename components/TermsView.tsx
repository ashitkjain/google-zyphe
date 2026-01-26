import React from 'react';
import Logo from './Logo';

const TermsView: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-white border-b border-slate-200 py-6">
                <div className="max-w-4xl mx-auto px-6">
                    <Logo size={100} />
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto px-6 py-16">
                <div className="bg-white rounded-[2.5rem] p-12 shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h1 className="text-4xl font-black text-slate-900 mb-8 tracking-tight">Terms of Service</h1>

                    <div className="space-y-8 text-slate-600 leading-relaxed text-lg font-medium">
                        <section>
                            <p>
                                Welcome to Zyphe. By accessing or using our platform, you agree to comply with and be bound by the following terms and conditions.
                                Please read them carefully.
                            </p>
                        </section>

                        <section className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                            <h2 className="text-slate-900 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                1. Nature of the Service
                            </h2>
                            <p>
                                Zyphe is an educational platform providing informational guides and AI-assisted property analysis.
                                Our services are intended for informational purposes only and do not constitute legal, financial, or real estate professional advice.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-slate-900 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                2. AI Analysis and Content
                            </h2>
                            <p>
                                Our platform utilizes Artificial Intelligence to process property data and images.
                                While we strive for accuracy, AI-generated reports may contain errors or omissions. Users should independently verify
                                all information and consult with a licensed professional before making any significant property-related decisions.
                            </p>
                        </section>

                        <section className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                            <h2 className="text-slate-900 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                3. User Responsibility
                            </h2>
                            <p>
                                You are responsible for the accuracy of any information you provide to the platform.
                                You agree not to use the service for any unlawful purposes or in any way that could damage or disrupt the platform's operation.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-slate-900 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                4. Limitation of Liability
                            </h2>
                            <p>
                                Zyphe and its operators shall not be liable for any direct, indirect, or consequential damages resulting from
                                the use or inability to use the platform, including any reliance on the information provided herein.
                            </p>
                        </section>

                        <section className="pt-8 border-t border-slate-100">
                            <p className="text-sm text-slate-400">
                                Last Updated: January 2026
                            </p>
                        </section>
                    </div>

                    <div className="mt-12 flex justify-center">
                        <button
                            onClick={() => window.location.href = '/'}
                            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                        >
                            Accept and Return
                        </button>
                    </div>
                </div>
            </main>

            <footer className="py-8 bg-slate-900 text-white/40 text-[10px] uppercase font-black tracking-widest text-center">
                © 2026 Zyphe Guides. Informational content only.
            </footer>
        </div>
    );
};

export default TermsView;
