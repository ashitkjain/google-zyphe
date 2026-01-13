
import React, { useState } from 'react';
import { sendInviteEmail } from '../services/firebaseService';
import Logo from './Logo';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    realtorName: string;
    realtorId: string;
}

const AddClientModal: React.FC<Props> = ({ isOpen, onClose, realtorName, realtorId }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);
    const [sending, setSending] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Generate the invite link
        const baseUrl = window.location.origin;
        const params = new URLSearchParams({
            mode: 'invite',
            realtorId: realtorId,
            realtorName: realtorName,
            email: email,
            name: name,
            role: role,
            minPrice: minPrice,
            maxPrice: maxPrice
        });

        setGeneratedLink(`${baseUrl}?${params.toString()}`);
    };

    const handleSendInvite = async () => {
        if (!generatedLink) return;
        setSending(true);
        setEmailError(null);

        const subject = `Invitation to join Zyphe AI`;
        const body = `
            <p>Hi ${name},</p>
            <p>I've created a Zyphe AI account for you to view property insights. Please click the link below to finish setting up your password:</p>
            <p><a href="${generatedLink}">${generatedLink}</a></p>
            <p>Best,<br/>${realtorName}</p>
        `;

        const response = await sendInviteEmail(email, subject, body);

        if (response.success) {
            setEmailSent(true);
        } else {
            setEmailError(response.error || "Failed to send email");
        }
        setSending(false);
    };

    const copyToClipboard = () => {
        if (generatedLink) {
            navigator.clipboard.writeText(generatedLink);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }
    };

    const resetForm = () => {
        setName('');
        setEmail('');
        setRole('buyer');
        setGeneratedLink(null);
        setCopySuccess(false);
        setEmailSent(false);
        setEmailError(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={handleClose}></div>

            <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
                <div className="p-8 pb-4 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 text-indigo-600 shadow-sm">
                        <i className="fa-solid fa-user-plus text-2xl"></i>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Add New Client</h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        Generate an exclusive invitation link for your client.
                    </p>
                </div>

                <div className="px-8 pb-8">
                    {!generatedLink ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Client Role</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setRole('buyer')}
                                        className={`py-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${role === 'buyer'
                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                            : 'border-slate-100 text-slate-400 hover:border-slate-200'
                                            }`}
                                    >
                                        <i className="fa-solid fa-cart-shopping text-xs"></i>
                                        <span className="text-[9px] font-black uppercase tracking-widest">Buyer</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRole('seller')}
                                        className={`py-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${role === 'seller'
                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                            : 'border-slate-100 text-slate-400 hover:border-slate-200'
                                            }`}
                                    >
                                        <i className="fa-solid fa-house-chimney text-xs"></i>
                                        <span className="text-[9px] font-black uppercase tracking-widest">Seller</span>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Client Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-5 py-3.5 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl outline-none text-sm font-medium transition-all"
                                    placeholder="Jane Smith"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Client Email</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-5 py-3.5 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl outline-none text-sm font-medium transition-all"
                                    placeholder="jane@example.com"
                                />
                            </div>

                            {role === 'buyer' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Min Price ($)</label>
                                        <input
                                            type="number"
                                            value={minPrice}
                                            onChange={(e) => setMinPrice(e.target.value)}
                                            className="w-full px-5 py-3.5 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl outline-none text-sm font-medium transition-all"
                                            placeholder="400000"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Max Price ($)</label>
                                        <input
                                            type="number"
                                            value={maxPrice}
                                            onChange={(e) => setMaxPrice(e.target.value)}
                                            className="w-full px-5 py-3.5 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl outline-none text-sm font-medium transition-all"
                                            placeholder="600000"
                                        />
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="w-full py-4 bg-gradient-to-r from-indigo-700 to-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-98 transition-all mt-4"
                            >
                                Create Invitation Link
                            </button>
                        </form>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-center">
                                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <i className="fa-solid fa-check text-sm"></i>
                                </div>
                                <h3 className="text-emerald-900 font-bold text-sm mb-1">Invitation Ready!</h3>
                                <p className="text-emerald-700 text-xs">Send this link to {name} so they can join.</p>
                            </div>

                            {!emailSent ? (
                                <>
                                    <button
                                        onClick={handleSendInvite}
                                        disabled={sending}
                                        className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 hover:scale-[1.02] active:scale-98 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {sending ? (
                                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                                        ) : (
                                            <i className="fa-solid fa-paper-plane"></i>
                                        )}
                                        {sending ? "Sending..." : `Send Email to ${name.split(' ')[0]}`}
                                    </button>
                                    {emailError && (
                                        <p className="text-rose-500 text-xs text-center font-bold mt-2">{emailError}</p>
                                    )}
                                </>
                            ) : (
                                <div className="w-full py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold text-xs uppercase tracking-widest text-center border border-emerald-100 flex items-center justify-center gap-2">
                                    <i className="fa-solid fa-check-circle"></i>
                                    Email Sent Successfully
                                </div>
                            )}

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-100"></div>
                                </div>
                                <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
                                    <span className="bg-white px-2 text-slate-300">Or copy link</span>
                                </div>
                            </div>

                            <div className="relative">
                                <input
                                    type="text"
                                    readOnly
                                    value={generatedLink}
                                    className="w-full pl-5 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-[10px] font-mono text-slate-500"
                                />
                                <button
                                    onClick={copyToClipboard}
                                    className="absolute right-1 top-1 bottom-1 w-10 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                                >
                                    <i className={`fa-solid ${copySuccess ? 'fa-check text-emerald-500' : 'fa-copy'}`}></i>
                                </button>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={resetForm}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all"
                                >
                                    Add Another
                                </button>
                                <button
                                    onClick={handleClose}
                                    className="flex-1 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:border-slate-300 transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddClientModal;
