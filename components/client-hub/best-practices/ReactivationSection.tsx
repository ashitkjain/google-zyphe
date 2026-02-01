import React from 'react';
import PremiumLegacyBridge from './PremiumLegacyBridge';
import { BEST_PRACTICES_DATA } from '../MagazineBestPracticesData';

const ReactivationSection: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Lead Reactivation</h2>
                <p className="text-lg text-slate-500 font-medium">Mastering the art of lead resurrection and re-engagement.</p>
            </div>

            <PremiumLegacyBridge data={BEST_PRACTICES_DATA.reactivation} mode="top" />

            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                <p className="text-indigo-800 leading-relaxed font-medium">
                    Your database is a gold mine. Reactivating dormant leads is significantly more cost-effective than acquiring new ones. By leading with empathy and low-friction value, you can turn past "ghosting" into future closings.
                </p>
            </div>

            <div className="grid gap-6">
                {[
                    {
                        title: '1. The "No-Guilt" Re-engagement',
                        content: 'When a lead hasn\'t responded in months, they often feel a sense of guilt or awkwardness about reaching back out. Your scripts should explicitly absolve them of this—"I know life gets crazy"—to lower the psychological barrier for a reply.',
                        icon: 'fa-hand-holding-heart',
                        color: 'emerald'
                    },
                    {
                        title: '2. AI-Powered Signal Detection',
                        content: 'Stop guessing which old leads to call. Use behavioral signals—like a lead returning to your website or opening an old market report—to identify those who are re-entering the market before they reach out to a competitor.',
                        icon: 'fa-brain',
                        color: 'blue'
                    },
                    {
                        title: '3. Lead with Value, Not an Ask',
                        content: 'The "Just checking in" message is dead. Instead, lead with a specific piece of value: a new neighborhood zoning update, a significant recent sale nearby, or a 1-page summary of current inventory shifts.',
                        icon: 'fa-gift',
                        color: 'indigo'
                    },
                    {
                        title: '4. Multi-Channel Sequencing',
                        content: 'People have different communication rhythms. A structured 3-day sequence (SMS -> Email -> Social/Call) ensures you reach them on their preferred platform without feeling intrusive.',
                        icon: 'fa-layer-group',
                        color: 'purple'
                    },
                    {
                        title: '5. The "Life-Event" Pivot',
                        content: 'Reactivation isn\'t always about real estate immediately. Acknowledge major life events—anniversaries, promotions, or community changes—to rebuild the relational bridge before discussing market goals.',
                        icon: 'fa-cake-candles',
                        color: 'rose'
                    },
                    {
                        title: '6. Database Segmentation',
                        content: 'Treat "Cold Buyers" differently than "Dormant Sellers." Segmenting your database by their original intent allows for hyper-relevant messaging that actually resonates and converts.',
                        icon: 'fa-users-viewfinder',
                        color: 'teal'
                    },
                    {
                        title: '7. Low-Friction Invitations',
                        content: 'Instead of asking for a listing appointment or a 30-minute call, ask a simple "Yes/No" question. "Would you like to see the 1-page update on your home\'s value?" is much easier to say yes to.',
                        icon: 'fa-door-open',
                        color: 'amber'
                    },
                    {
                        title: '8. Automated Nurture vs. Personal Pulse',
                        content: 'Use automation for the heavy lifting (monthly reports), but use "Personal Pulse" check-ins (1-to-1 texts) for high-intent leads to maintain the human connection that technology can\'t replace.',
                        icon: 'fa-microchip',
                        color: 'cyan'
                    },
                    {
                        title: '9. The "Closed-Loop" Follow-up',
                        content: 'If someone does reply, your response speed must be elite. Reactivating a lead is a fragile state; failing to respond quickly to a resurrected lead usually results in them disappearing forever.',
                        icon: 'fa-arrows-spin',
                        color: 'orange'
                    },
                    {
                        title: '10. Long-Horizon Perspective',
                        content: 'Reactivation is a marathon. A lead might not buy today, but by providing consistent value without pressure, you become the only agent they think of when they are finally ready in 6-12 months.',
                        icon: 'fa-mountain-sun',
                        color: 'lime'
                    }
                ].map((item, index) => (
                    <div key={index} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                        <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-full bg-${item.color}-100 text-${item.color}-600 flex items-center justify-center flex-shrink-0 mt-1`}>
                                <i className={`fa-solid ${item.icon}`}></i>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                                <p className="text-slate-600 text-sm leading-relaxed">{item.content}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Checklist */}
            <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl">
                        <i className="fa-solid fa-bolt-lightning"></i>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black tracking-tight">Rapid Reactivation Checklist</h3>
                        <p className="text-indigo-200">The 72-Hour Sprint</p>
                    </div>
                </div>
                <div className="space-y-6">
                    {[
                        {
                            category: '🔍 Discovery Phase',
                            items: ['Audit CRM for leads dormant > 6 months', 'Identify "Hot Re-engagers" via website activity', 'Segment leads by original type (Buyer/Seller)']
                        },
                        {
                            category: '📦 Preparation',
                            items: ['Draft "No-Guilt" SMS template', 'Gather 3 localized market stats for value-add', 'Prepare the "1-Page Update" PDF template']
                        },
                        {
                            category: '🚀 Execution',
                            items: ['Batch 25 personal SMS check-ins', 'Send follow-up "Value" email if no reply in 24h', 'Drop personal voicemail for high-priority leads']
                        },
                        {
                            category: '📊 Analysis',
                            items: ['Track response rates by channel', 'Move responders into active pipeline', 'Update CRM notes with new "Life Event" data']
                        }
                    ].map((section, i) => (
                        <div key={i}>
                            <h4 className="font-bold text-indigo-400 uppercase tracking-widest text-xs mb-3">{section.category}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                {section.items.map((item, j) => (
                                    <div key={j} className="flex items-center gap-3 group">
                                        <div className="w-4 h-4 rounded-full border border-emerald-500 flex items-center justify-center flex-shrink-0">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        </div>
                                        <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <PremiumLegacyBridge data={BEST_PRACTICES_DATA.reactivation} mode="bottom" />
        </div>
    );
};

export default ReactivationSection;
