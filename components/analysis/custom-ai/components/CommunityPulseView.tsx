import React from 'react';
import { CommunityPulseResult } from '../../../../types';
import { PulseCard } from './CommonComponents';

interface CommunityPulseViewProps {
    data: CommunityPulseResult;
}

export const CommunityPulseView: React.FC<CommunityPulseViewProps> = ({ data }) => {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <PulseCard title="What Residents Like" data={data.what_residents_like} icon="fa-thumbs-up" />
            <PulseCard title="Common Complaints" data={data.common_complaints} icon="fa-circle-exclamation" />
            <PulseCard title="Safety & Concerns" data={data.safety_and_concerns} icon="fa-shield-halved" />
            <PulseCard title="Schools & Families" data={data.schools_family_friendliness} icon="fa-graduation-cap" />
            <PulseCard title="Lifestyle & Convenience" data={data.lifestyle_convenience} icon="fa-bus" />
            <PulseCard title="Investment Insights" data={data.investment_insights} icon="fa-chart-line" />
        </div>
    );
};
