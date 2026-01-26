import React from 'react';
import Logo from './Logo';

interface FooterProps {
    onNavigate?: (view: any) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
    return (
        <footer className="bg-white border-t border-slate-200 py-1.5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Logo size={50} className="opacity-30 grayscale hover:grayscale-0 transition-all" />
                        <span className="text-[7px] font-black uppercase tracking-widest text-slate-400">© 2026 Zyphe Guides. Informational content only. No legal or financial advice.</span>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[7px] font-black uppercase tracking-tighter text-slate-400">Systems Operational</span>
                        </div>
                        <div className="hidden sm:flex items-center gap-4">
                            <button
                                onClick={() => onNavigate ? onNavigate('legal-disclaimer') : window.location.href = '/legal-disclaimer'}
                                className="text-[7px] font-black uppercase tracking-widest text-slate-300 hover:text-indigo-600 transition-colors"
                            >
                                Legal Disclaimer
                            </button>
                            <button
                                onClick={() => onNavigate ? onNavigate('terms') : window.location.href = '/terms'}
                                className="text-[7px] font-black uppercase tracking-widest text-slate-300 hover:text-indigo-600 transition-colors"
                            >
                                Terms
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
