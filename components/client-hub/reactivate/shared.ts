import { Lead } from '../../../types';

export interface Strategy {
    id: string;
    title: string;
    description: string;
    subject: string;
    generate: (name: string) => string;
    type: 'email' | 'sms';
}

export interface Trigger {
    id: string;
    title: string;
    description: string;
    icon: string;
    active: boolean;
    monitoredCount: number;
    threshold?: string;
    templateId?: string;
}

export const getTimeSince = (date: any) => {
    if (!date) return 'Unknown';
    const d = new Date(date.seconds ? date.seconds * 1000 : date);
    const months = Math.floor((new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30));
    return months < 1 ? '< 1 month ago' : `${months} months ago`;
};

export const STRATEGIES: Strategy[] = [
    {
        id: 'strategy_1',
        title: 'Newsletter Re-Opt-in',
        description: 'Confirm if they still want valuable market updates.',
        subject: 'Quick question about market updates',
        generate: (name: string) => `Hi ${name},\n\nI'm cleaning up my email list and want to make sure I'm only sending market updates to those who find them valuable.\n\nDo you still want to receive my monthly newsletter with local real estate insights?\n\nNo hard feelings if not - just reply "yes" to keep them coming or "no" to stop.`,
        type: 'email'
    },
    {
        id: 'strategy_2',
        title: 'Just Checking In',
        description: 'Low pressure check-in for past clients or cold leads.',
        subject: 'Thinking of you',
        generate: (name: string) => `Hi ${name},\n\nI was just thinking about you and wanted to reach out to say hello.\n\nHow have you been? I hope everything is going well on your end.\n\nLet me know if there is anything I can do for you!`,
        type: 'email'
    },
    {
        id: 'strategy_3',
        title: 'House Anniversary',
        description: 'Celebrate their home purchase anniversary.',
        subject: 'Happy Home Anniversary!',
        generate: (name: string) => `Hi ${name},\n\nCan you believe it's been another year in your home? Happy Anniversary!\n\nI hope the house has been treating you well. If you need any recommendations for maintenance or upgrades this year, I have a list of trusted pros I'd be happy to share.\n\nCheers to another great year!`,
        type: 'email'
    },
    {
        id: 'strategy_4',
        title: 'Birthday / Special Date',
        description: 'Personal connection on an important date.',
        subject: 'Happy Birthday!',
        generate: (name: string) => `Hi ${name},\n\nWishing you a fantastic birthday today! I hope you have a wonderful year ahead filled with joy and success.\n\nBest,`,
        type: 'email'
    },
    {
        id: 'strategy_5',
        title: 'Event Invitation',
        description: 'Invite them to a mixer or client appreciation event.',
        subject: 'You\'re invited: Client Appreciation Mixer',
        generate: (name: string) => `Hi ${name},\n\nI'm hosting a client appreciation mixer next Thursday at [Venue Name] and would love for you to come by!\n\nIt'll be a casual evening with drinks, appetizers, and great conversation. Feel free to bring a guest.\n\nLet me know if you can make it!`,
        type: 'email'
    },
    {
        id: 'strategy_6',
        title: 'Maintenance Reminders',
        description: 'Helpful seasonal maintenance checklist.',
        subject: 'Seasonal Home Maintenance Checklist',
        generate: (name: string) => `Hi ${name},\n\nAs the seasons change, it's a great time to tackle a few home maintenance items to keep your property in top shape.\n\nHere's a quick checklist for this month:\n- Check HVAC filters\n- Inspect gutters\n- Test smoke detectors\n\nLet me know if you need a handyman recommendation for any of these!`,
        type: 'email'
    },
    {
        id: 'strategy_7',
        title: 'Homeowner eBook',
        description: 'Value-add content for homeowners.',
        subject: 'eBook: Maximizing Your Home Value',
        generate: (name: string) => `Hi ${name},\n\nI just put together a new eBook on "Maximizing Your Home Value" with simple tips for homeowners. I thought you might find it interesting.\n\nYou can download it here: [Link]\n\nHope you enjoy the read!`,
        type: 'email'
    },
    {
        id: 'strategy_8',
        title: 'Market Guide / Terms',
        description: 'Educational content for buyers/sellers.',
        subject: 'Neighborhood Market Guide',
        generate: (name: string) => `Hi ${name},\n\nThe real estate market has been shifting lately, so I updated my Neighborhood Market Guide with the latest trends and data.\n\nIt breaks down what's happening right here in our area. Attached is a copy for you.\n\nLet me know if you have any questions about the current market!`,
        type: 'email'
    },
    {
        id: 'strategy_9',
        title: 'Local Wins / Testimonial',
        description: 'Share recent success to build credibility.',
        subject: 'Just Sold in Your Neighborhood',
        generate: (name: string) => `Hi ${name},\n\nWe just helped a family in your neighborhood sell their home for [Price] in just [Days] days! The market is still moving for the right properties.\n\nI wanted to share this win because it reminds me of your goals. Here is what they had to say: "[Quote]"\n\nCurious what your home might be worth in today's market?`,
        type: 'email'
    },
    {
        id: 'strategy_10',
        title: 'Market Report Update',
        description: 'Data-driven update to re-engage interest.',
        subject: 'Market Update: Is now the time?',
        generate: (name: string) => `Hi ${name},\n\nI've been tracking the local numbers, and I noticed an interesting trend this month that impacts homeowners in your area.\n\nI've summarized the key stats in the attached report. It's looking like an interesting time for [Buyers/Sellers].\n\nTake a look and let me know your thoughts!`,
        type: 'email'
    }
];

export const MOCK_TRIGGERS: Trigger[] = [
    {
        id: 't1',
        title: 'Rate Drop Alert',
        description: 'Notify leads when interest rates drop significantly.',
        icon: 'fa-percent',
        active: true,
        monitoredCount: 142,
        threshold: '0.5%'
    },
    {
        id: 't2',
        title: 'Inventory Spike',
        description: 'Alert buyers when more homes hit the market in their ZIP.',
        icon: 'fa-house-chimney-window',
        active: false,
        monitoredCount: 89,
        threshold: '10%'
    },
    {
        id: 't3',
        title: 'Price Reduction',
        description: 'Identify listings that just dropped in price.',
        icon: 'fa-tag',
        active: true,
        monitoredCount: 205,
        threshold: '$10k'
    },
    {
        id: 't4',
        title: 'Lead Anniversary',
        description: 'Re-engage leads 6 months after their last activity.',
        icon: 'fa-calendar-check',
        active: true,
        monitoredCount: 12,
        threshold: '6 months'
    }
];
