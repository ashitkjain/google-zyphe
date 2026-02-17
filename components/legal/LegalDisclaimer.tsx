import React from 'react';
import Logo from '../shared/Logo';

const LegalDisclaimer: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-white border-b border-slate-200 py-6">
                <div className="max-w-4xl mx-auto px-6">
                    <Logo size={100} />
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto px-6 py-16">
                <div className="bg-white rounded-[2.5rem] p-12 shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h1 className="text-4xl font-black text-slate-900 mb-8 tracking-tight">Legal Disclaimer</h1>

                    <div className="space-y-8 text-slate-600 leading-relaxed text-lg font-medium">
                        <section>
                            <p>
                                The information provided on this website is for <strong>general educational purposes only</strong>.
                                It is intended to help users understand common processes and concepts related to homeownership and property operations.
                            </p>
                        </section>

                        <section className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                            <h2 className="text-slate-900 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                Accuracy and Currency
                            </h2>
                            <p>
                                While we make reasonable efforts to ensure the accuracy and reliability of the content presented,
                                we do not guarantee that all information is current, complete, or applicable to every individual situation.
                                Real estate laws, local ordinances, and community rules are subject to frequent change and vary significantly by jurisdiction.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-slate-900 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                No Professional-Client Relationship
                            </h2>
                            <p>
                                Using this website (including the use of AI analysis tools, reading guides, or interacting with the interface)
                                <strong>does not establish a professional-client relationship</strong>.
                                We are not acting as your attorney, real estate broker, financial advisor, or tax consultant.
                            </p>
                        </section>

                        <section className="bg-rose-50/50 p-8 rounded-3xl border border-rose-100/50">
                            <h2 className="text-rose-900 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                Consult a Professional
                            </h2>
                            <p className="text-rose-900/80">
                                You should not rely on the information on this site as an alternative to professional advice from a qualified expert in your area.
                                If you have specific questions about any legal, financial, or real estate matter, you should consult an appropriate professional advisor.
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
                            Return to Home
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

export default LegalDisclaimer;
