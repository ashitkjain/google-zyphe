import React from 'react';
import { CommunityPulseResult } from '../../../../types';
import { PulseCard } from './CommonComponents';

interface CommunityPulseViewProps {
    data: CommunityPulseResult;
}

export const CommunityPulseView: React.FC<CommunityPulseViewProps> = ({ data }) => {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <PulseCard title="Resident Sentiment" data={data.resident_sentiment} icon="fa-comment-dots" />
            <PulseCard title="Safety & Crime" data={data.safety_and_crime} icon="fa-shield-halved" />
            <PulseCard title="Neighborhood Character" data={data.character_and_character} icon="fa-building-columns" />
            <PulseCard title="Market & Value" data={data.market_and_value} icon="fa-chart-line" />
            <PulseCard title="Transit & Access" data={data.transit_and_walkability} icon="fa-bus" />
            <PulseCard title="Dining & Social" data={data.dining_and_nightlife} icon="fa-utensils" />
            <PulseCard title="Schools & Families" data={data.schools_and_families} icon="fa-graduation-cap" />
            <PulseCard title="Green Space" data={data.parks_and_outdoors} icon="fa-leaf" />
            <PulseCard title="Essentials" data={data.shopping_and_essentials} icon="fa-cart-shopping" />
        </div>
    );
};
