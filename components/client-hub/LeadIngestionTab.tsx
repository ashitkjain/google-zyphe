
import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase/config';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';

interface RawLead {
    id: string;
    source: 'Zillow' | 'Realtor' | 'Facebook';
    payload: any;
    timestamp: any;
}

interface Props {
    realtorId: string;
}

const LeadIngestionTab: React.FC<Props> = ({ realtorId }) => {
    const [rawLeads, setRawLeads] = useState<RawLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [copySuccess, setCopySuccess] = useState<string | null>(null);

    // Use the custom domain for webhooks (configured via Firebase Hosting rewrites)
    const baseUrl = `https://zyphe.ai/api/webhooks`;

    const webhooks = [
        {
            name: 'Zillow Premier Agent',
            source: 'Zillow',
            url: `${baseUrl}/zillow?realtorId=${realtorId}`,
            description: 'Use the Zillow Tech Connect API. Registers this URL as your CRM endpoint in your Zillow Premier Agent dashboard.',
            icon: 'fa-house-user'
        },
        {
            name: 'Realtor.com (Move.com)',
            source: 'Realtor',
            url: `${baseUrl}/realtor?realtorId=${realtorId}`,
            description: 'Direct Lead API. Provides faster, richer lead data compared to email parsing.',
            icon: 'fa-magnifying-glass-location'
        },
        {
            name: 'Facebook Lead Ads',
            source: 'Facebook',
            url: `${baseUrl}/facebook?realtorId=${realtorId}`,
            description: 'Real-time Webhook for Facebook Ads. Requires "ZYPHE_FB_VERIFY" as the Verify Token.',
            icon: 'fa-facebook'
        }
    ];

    useEffect(() => {
        const q = query(
            collection(db, 'raw_leads'),
            where('realtorId', '==', realtorId),
            orderBy('timestamp', 'desc'),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const leads = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as RawLead));
            setRawLeads(leads);
            setLoading(false);
        }, (error) => {
            console.error("Failed to fetch raw leads:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [realtorId]);

    const copyToClipboard = (text: string, name: string) => {
        navigator.clipboard.writeText(text);
        setCopySuccess(name);
        setTimeout(() => setCopySuccess(null), 2000);
    };

    const formatTimestamp = (ts: any) => {
        if (!ts) return 'Just now';
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleString();
    };

    return (
        <div className="max-w-6xl mx-auto py-12 px-6 animate-in fade-in duration-700">
            <div className="mb-12">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">Lead Ingestion</h1>
                <p className="text-slate-500 font-medium max-w-2xl">Connect your favorite lead sources directly to Zyphe. Automated ingestion ensures you never miss a high-intent opportunity.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Webhook URLs */}
                <div className="lg:col-span-2 space-y-6">
                    {webhooks.map((hook) => (
                        <div key={hook.source} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden group hover:border-indigo-200 transition-all duration-300">
                            <div className="p-8">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${hook.source === 'Zillow' ? 'bg-blue-600' :
                                        hook.source === 'Realtor' ? 'bg-rose-600' :
                                            'bg-indigo-600'
                                        }`}>
                                        <i className={`fa-brands ${hook.icon} text-xl`}></i>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">{hook.name}</h3>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{hook.source} Integration</p>
                                    </div>
                                </div>

                                <p className="text-slate-500 text-sm mb-6 leading-relaxed">{hook.description}</p>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">Your Webhook URL</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-mono text-slate-600 break-all border-dashed">
                                            {hook.url}
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(hook.url, hook.source)}
                                            className={`px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${copySuccess === hook.source
                                                ? 'bg-emerald-500 text-white shadow-emerald-200'
                                                : 'bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800'
                                                } shadow-lg`}
                                        >
                                            {copySuccess === hook.source ? 'Copied!' : 'Copy'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Recent Ingestion Activity */}
                <div className="lg:col-span-1">
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl h-full flex flex-col min-h-[600px]">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Live Ingestion Log</h3>
                            </div>
                            <span className="text-[9px] font-black text-slate-500 uppercase">Last 10 Events</span>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 font-mono text-[10px] custom-scrollbar pr-2">
                            {loading ? (
                                <div className="text-slate-600 italic">Monitoring incoming webhooks...</div>
                            ) : rawLeads.length === 0 ? (
                                <div className="text-slate-600 italic">No activity detected yet. Send a test lead to your webhooks above.</div>
                            ) : (
                                rawLeads.map((lead) => (
                                    <div key={lead.id} className="border-l-2 border-slate-800 pl-4 py-3 space-y-2 group hover:border-indigo-500 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${lead.source === 'Zillow' ? 'bg-blue-500/10 text-blue-400' :
                                                lead.source === 'Realtor' ? 'bg-rose-500/10 text-rose-400' :
                                                    'bg-indigo-500/10 text-indigo-400'
                                                }`}>
                                                {lead.source}
                                            </span>
                                            <span className="text-slate-500 text-[8px]">{formatTimestamp(lead.timestamp)}</span>
                                        </div>
                                        <div className="text-slate-300 bg-slate-800/50 p-3 rounded-xl break-words line-clamp-3 group-hover:line-clamp-none transition-all">
                                            {JSON.stringify(lead.payload, null, 2)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Guide Section */}
            <div className="mt-16 bg-indigo-50 rounded-[3rem] p-12 border border-indigo-100 flex flex-col md:flex-row items-center gap-10">
                <div className="w-20 h-20 rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center text-3xl shadow-xl shadow-indigo-200 shrink-0">
                    <i className="fa-solid fa-circle-question"></i>
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-900 mb-3">How to use Webhooks?</h2>
                    <p className="text-slate-600 font-medium leading-relaxed max-w-3xl">
                        Copy the Webhook URL for your source and paste it into the "Lead Delivery" or "Tech Connect" settings of your provider.
                        Once connected, new leads will automatically appear in your **Funnel** within seconds. You can track raw data in the Live Log above for troubleshooting.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LeadIngestionTab;
