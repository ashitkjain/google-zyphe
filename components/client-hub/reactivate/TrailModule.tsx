import React, { useState, useEffect } from 'react';
import { getReactivationMessages } from '../../../services/firebase/communications';
import { getAllUserLeadPlans } from '../../../services/firebase/reactivation';
import { Lead } from '../../../types';
import { LeadPlanRecord } from '../../../types/ai';
import ActivityFeed from './components/ActivityFeed';

interface TrailModuleProps {
    realtorId: string;
    leads: Lead[];
}

const TrailModule: React.FC<TrailModuleProps> = ({ realtorId, leads }) => {
    const [messages, setMessages] = useState<any[]>([]);
    const [plans, setPlans] = useState<LeadPlanRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [msgs, p] = await Promise.all([
                    getReactivationMessages(realtorId),
                    getAllUserLeadPlans(realtorId)
                ]);
                setMessages(msgs);
                setPlans(p);
            } catch (err) {
                console.error("Failed to fetch trail data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [realtorId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-16 shadow-xl shadow-indigo-500/5 text-center">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8 text-blue-500">
                    <i className="fa-solid fa-clock-rotate-left text-4xl"></i>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Message Trail</h3>
                <p className="text-slate-500 max-w-md mx-auto font-medium text-lg leading-relaxed">No reactivation messages have been sent yet. Head over to Intelligence to start outreach.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8">
            <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
                <i className="fa-solid fa-list-ul text-indigo-500"></i>
                Reactivation Activity Feed
            </h3>
            <ActivityFeed messages={messages} leads={leads} plans={plans} />
        </div>
    );
};

export default TrailModule;
