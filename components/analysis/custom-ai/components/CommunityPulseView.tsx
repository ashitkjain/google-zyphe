import React from 'react';
import { CommunityPulseResult } from '../../../../types';
import { PulseCard } from './CommonComponents';

interface CommunityPulseViewProps {
    data: CommunityPulseResult;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    userRole?: string;
}

export const CommunityPulseView: React.FC<CommunityPulseViewProps> = ({ data, onRefresh, isRefreshing, userRole }) => {
    return (
        <div className="flex flex-col gap-6">
            {userRole === 'admin' && onRefresh && (
                <div className="flex justify-center mb-6">
                    <button
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm ${isRefreshing ? 'bg-indigo-50 text-indigo-300 animate-pulse' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md'}`}
                    >
                        <i className={`fa-solid fa-arrows-rotate ${isRefreshing ? 'animate-spin' : ''}`}></i>
                        {isRefreshing ? 'REFRESHING...' : 'REFRESH PULSE'}
                    </button>
                </div>
            )}

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <PulseCard title="What Residents Like" data={data.what_residents_like} icon="fa-thumbs-up" />
                <PulseCard title="Common Complaints" data={data.common_complaints} icon="fa-circle-exclamation" />
                <PulseCard title="Safety & Concerns" data={data.safety_and_concerns} icon="fa-shield-halved" />
                <PulseCard title="Schools & Families" data={data.schools_family_friendliness} icon="fa-graduation-cap" />
                <PulseCard title="Lifestyle & Convenience" data={data.lifestyle_convenience} icon="fa-bus" />
                <PulseCard title="Investment Insights" data={data.investment_insights} icon="fa-chart-line" />
            </div>
        </div>
    );
};
