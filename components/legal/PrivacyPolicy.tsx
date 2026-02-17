import React from 'react';
import Logo from '../shared/Logo';

const PrivacyPolicy: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-white border-b border-slate-200 py-6">
                <div className="max-w-4xl mx-auto px-6">
                    <Logo size={100} />
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto px-6 py-16">
                <div className="bg-white rounded-[2.5rem] p-12 shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h1 className="text-4xl font-black text-slate-900 mb-8 tracking-tight">Privacy Policy</h1>

                    <div className="space-y-8 text-slate-600 leading-relaxed text-lg font-medium">
                        <section>
                            <p>
                                At Zyphe, we take your privacy seriously. This Privacy Policy describes how we collect, use, and protect your information when you use our platform.
                            </p>
                        </section>

                        <section className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                            <h2 className="text-slate-900 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                1. Information Collection
                            </h2>
                            <p>
                                We collect information that you provide securely to us, such as your property interests and account details, solely to provide our AI analysis services.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-slate-900 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                2. Mobile Information & Privacy
                            </h2>
                            <p className="font-bold text-slate-800">
                                Mobile information will not be shared with third parties/affiliates for marketing or promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.
                            </p>
                        </section>

                        <section className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                            <h2 className="text-slate-900 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                3. Data Security
                            </h2>
                            <p>
                                We implement industry-standard security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction.
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
                © 2026 Zyphe. Informational content only.
            </footer>
        </div>
    );
};

export default PrivacyPolicy;
