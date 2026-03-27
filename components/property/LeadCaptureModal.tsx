import React, { useState } from 'react';
import { saveIDXLeadRequest } from '../../services/firebase/idx';
import { trackTourRequested, trackInfoRequested } from '../../services/analytics/idxTracking';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LeadCaptureModalProps {
    type: 'tour' | 'info';
    propertyAddress: string;
    propertyZpid?: string;
    propertyPrice?: number;
    city?: string;
    realtorId: string;
    onClose: () => void;
}

// ── Tour time slots ────────────────────────────────────────────────────────────

const TIME_SLOTS = [
    '9:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '1:00 PM', '2:00 PM',
    '3:00 PM', '4:00 PM', '5:00 PM',
];

// ── Component ──────────────────────────────────────────────────────────────────

const LeadCaptureModal: React.FC<LeadCaptureModalProps> = ({
    type,
    propertyAddress,
    propertyZpid,
    propertyPrice,
    city,
    realtorId,
    onClose,
}) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [preferredDate, setPreferredDate] = useState('');
    const [preferredTime, setPreferredTime] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const isTour = type === 'tour';

    // Get tomorrow's date as min date for tour scheduling
    const minDate = (() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    })();

    const fmt = (n: number) => {
        if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
        return `$${n}`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !email.trim()) {
            setError('Name and email are required.');
            return;
        }
        setError('');
        setSubmitting(true);

        try {
            const result = await saveIDXLeadRequest(realtorId, {
                type,
                name: name.trim(),
                email: email.trim().toLowerCase(),
                phone: phone.trim(),
                message: message.trim(),
                propertyAddress,
                propertyZpid,
                propertyPrice,
                city,
                source: 'property_detail',
                preferredDate: isTour ? preferredDate : undefined,
                preferredTime: isTour ? preferredTime : undefined,
            });

            if (result.success) {
                // Fire PostHog tracking event
                if (isTour) {
                    trackTourRequested({
                        zpid: propertyZpid,
                        address: propertyAddress,
                        city: city || '',
                        listPrice: propertyPrice,
                        buyerName: name.trim(),
                        buyerEmail: email.trim().toLowerCase(),
                        tourDate: preferredDate,
                    });
                } else {
                    trackInfoRequested({
                        zpid: propertyZpid,
                        address: propertyAddress,
                        city: city || '',
                        listPrice: propertyPrice,
                        buyerEmail: email.trim().toLowerCase(),
                    });
                }
                setSubmitted(true);
            } else {
                setError('Something went wrong. Please try again.');
            }
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-hidden">

                {/* Header */}
                <div className={`px-8 pt-8 pb-6 ${isTour
                    ? 'bg-gradient-to-br from-indigo-600 to-violet-700'
                    : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                }`}>
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                    >
                        <i className="fa-solid fa-xmark text-sm"></i>
                    </button>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                            <i className={`fa-solid ${isTour ? 'fa-calendar-check' : 'fa-envelope'} text-white text-lg`}></i>
                        </div>
                        <div>
                            <div className="text-white/70 text-[10px] font-black uppercase tracking-widest">
                                {isTour ? 'Schedule a Tour' : 'Request More Info'}
                            </div>
                            <div className="text-white font-black text-base leading-tight">
                                {isTour ? 'Book a Showing' : 'Get Property Details'}
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/15 rounded-xl px-4 py-3">
                        <div className="text-white text-xs font-bold leading-snug line-clamp-2">{propertyAddress}</div>
                        {propertyPrice && (
                            <div className="text-white/80 text-[11px] font-black mt-0.5">{fmt(propertyPrice)}</div>
                        )}
                    </div>
                </div>

                {/* Success State */}
                {submitted ? (
                    <div className="px-8 py-10 text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                            <i className="fa-solid fa-circle-check text-emerald-500 text-3xl"></i>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">
                            {isTour ? 'Tour Requested!' : 'Request Sent!'}
                        </h3>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
                            {isTour
                                ? 'Your agent will confirm the tour time shortly. Check your email for details.'
                                : 'Your agent will reach out with more information about this property.'
                            }
                        </p>
                        <button
                            onClick={onClose}
                            className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-black transition-colors"
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
                        {/* Name */}
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Full Name *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Jane Smith"
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all"
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Email *</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="jane@example.com"
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all"
                            />
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Phone</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="(925) 555-0100"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all"
                            />
                        </div>

                        {/* Tour date/time picker */}
                        {isTour && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Preferred Date</label>
                                    <input
                                        type="date"
                                        value={preferredDate}
                                        min={minDate}
                                        onChange={e => setPreferredDate(e.target.value)}
                                        className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Preferred Time</label>
                                    <select
                                        value={preferredTime}
                                        onChange={e => setPreferredTime(e.target.value)}
                                        className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all cursor-pointer"
                                    >
                                        <option value="">Any time</option>
                                        {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Message */}
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                                {isTour ? 'Notes (optional)' : 'What would you like to know?'}
                            </label>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder={isTour ? 'Anything specific you want to see?' : 'Ask about the neighborhood, HOA, schools...'}
                                rows={3}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all resize-none"
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-2">
                                <i className="fa-solid fa-circle-exclamation text-rose-500 text-sm"></i>
                                <p className="text-xs font-bold text-rose-700">{error}</p>
                            </div>
                        )}

                        {/* Disclaimer */}
                        <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
                            By submitting, you agree to be contacted by a licensed real estate agent. Your information is never sold.
                        </p>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`w-full py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${isTour
                                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200'
                            }`}
                        >
                            {submitting ? (
                                <><i className="fa-solid fa-spinner animate-spin"></i> Sending...</>
                            ) : isTour ? (
                                <><i className="fa-solid fa-calendar-check"></i> Request Tour</>
                            ) : (
                                <><i className="fa-solid fa-paper-plane"></i> Send Request</>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default LeadCaptureModal;
