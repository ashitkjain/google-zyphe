import React from 'react';
import PremiumLegacyBridge from './PremiumLegacyBridge';
import { BEST_PRACTICES_DATA } from '../MagazineBestPracticesData';

const TimingsSection: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Real Estate Communication Protocols</h2>
                <p className="text-lg text-slate-500 font-medium">Standard operating procedures for timely and effective client interactions.</p>
            </div>

            <PremiumLegacyBridge data={BEST_PRACTICES_DATA.timings} mode="top" />

            <div className="grid gap-6">
                {/* Card 1 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-1">
                            <i className="fa-solid fa-reply"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">1. Respond Promptly to Clients</h3>
                            <p className="text-slate-600 leading-relaxed mb-3">
                                Objective: Show respect, professionalism, and engagement.
                            </p>
                            <p className="text-slate-500 text-sm">
                                Aim to reply to inquiries and follow-ups quickly—often within <span className="font-bold text-slate-700">24 to 48 hours</span>. Prompt responses signal that the client’s time matters and help maintain momentum in the sales process.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Card 2 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                            <i className="fa-solid fa-scale-balanced"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">2. Set Realistic and Honest Timelines</h3>
                            <p className="text-slate-600 leading-relaxed mb-3">
                                Avoid over-promising. Don’t tell clients what they want to hear if it’s unlikely to happen (e.g., unrealistic closing dates).
                            </p>
                            <p className="text-slate-500 text-sm">
                                Provide clear, honest estimates for processes like offer acceptance, inspections, financing, and closing. Managing expectations upfront reduces misunderstandings, stress, and risk of frustration later.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Card 3 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                            <i className="fa-solid fa-eye"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">3. Maintain Transparency Throughout the Process</h3>
                            <p className="text-slate-600 leading-relaxed mb-3">
                                Consistent updates: Even if there’s no new major news, let clients know progress.
                            </p>
                            <p className="text-slate-500 text-sm">
                                Share changes, delays, and obstacles as soon as possible. Transparency builds trust and equips clients to make informed decisions.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Card 4 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                            <i className="fa-solid fa-list-check"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">4. Use a Structured Follow-Up Cadence</h3>
                            <p className="text-slate-600 leading-relaxed mb-3">
                                Have a system or schedule for regular check-ins rather than waiting for the client to reach out. This could include:
                            </p>
                            <ul className="list-disc list-inside text-slate-500 text-sm space-y-1 ml-2">
                                <li>Weekly status summaries</li>
                                <li>Mid-process checkpoints</li>
                                <li>Post-milestone recap messages</li>
                            </ul>
                            <p className="text-slate-500 text-sm mt-3">
                                This proactive cadence ensures clients stay informed and feel supported.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Card 5 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center flex-shrink-0 mt-1">
                            <i className="fa-solid fa-shoe-prints"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">5. Clarify Next Steps and Responsibilities</h3>
                            <p className="text-slate-600 leading-relaxed mb-3">
                                After every interaction, outline what happens next, who is responsible, and by when.
                            </p>
                            <p className="text-slate-500 text-sm">
                                When clients know exactly what to expect and what’s expected of them, they feel more secure and less anxious. Include clear reminders of upcoming deadlines.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Card 6 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 mt-1">
                            <i className="fa-solid fa-volume-high"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">6. Communicate Even When You Don’t Have Full Answers</h3>
                            <p className="text-slate-600 leading-relaxed mb-3">
                                A short, timely acknowledgement like “I received your message and am working on it—update by 4 PM tomorrow” reassures the client.
                            </p>
                            <p className="text-slate-500 text-sm">
                                This prevents the silent gaps that create uncertainty and reassures the client that you’re actively managing their needs.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Card 7 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 mt-1">
                            <i className="fa-solid fa-sliders"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">7. Personalize Communication Based on Client Preferences</h3>
                            <p className="text-slate-600 leading-relaxed mb-3">
                                Ask upfront: How do you prefer to be contacted? (text, email, phone?) What frequency of updates feels right to you?
                            </p>
                            <p className="text-slate-500 text-sm">
                                Tailoring timeliness to preferences improves comfort and ensures your communication rhythm aligns with client expectations.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Card 8 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center flex-shrink-0 mt-1">
                            <i className="fa-solid fa-database"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">8. Track and Document Communications</h3>
                            <p className="text-slate-600 leading-relaxed mb-3">
                                Use tools like a CRM or shared communication logs to track all interactions, avoid duplicate contact, and ensure no questions are overlooked.
                            </p>
                            <p className="text-slate-500 text-sm">
                                Organized timelines and records also help when working with teams or referring clients to others.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Card 9 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-lime-100 text-lime-600 flex items-center justify-center flex-shrink-0 mt-1">
                            <i className="fa-solid fa-flag-checkered"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">9. Prioritize Follow-Ups After Key Milestones</h3>
                            <p className="text-slate-600 leading-relaxed mb-3">
                                After showings, final offers, inspections, or financing steps, reach out promptly with updates and next-step guidance.
                            </p>
                            <p className="text-slate-500 text-sm">
                                A regular follow-up rhythm around milestones keeps clients informed and reduces their stress.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Card 10 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 mt-1">
                            <i className="fa-solid fa-heart"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">10. Keep a Client-First Mindset</h3>
                            <p className="text-slate-600 leading-relaxed mb-3">
                                Treat timeliness not as a speed competition but as a service standard that helps clients feel respected, supported, and valued.
                            </p>
                            <p className="text-slate-500 text-sm">
                                Clients remember consistent attention more than a single fast reply—and are more likely to refer you to others.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="mt-8 bg-indigo-50 p-8 rounded-3xl border border-indigo-100">
                    <div className="flex items-center gap-4 mb-4">
                        <span className="text-2xl">🧠</span>
                        <h3 className="text-xl font-black text-indigo-900">Why Timeliness Matters in Real Estate</h3>
                    </div>
                    <p className="text-indigo-800 leading-relaxed">
                        Real estate transactions often involve emotional and financial stakes; delays or communication gaps can damage trust. Consistent, transparent, and well-timed communication keeps deals moving smoothly, improves satisfaction, and differentiates you from competitors.
                    </p>
                </div>
            </div>
            <PremiumLegacyBridge data={BEST_PRACTICES_DATA.timings} mode="bottom" />
        </div>
    );
};

export default TimingsSection;
