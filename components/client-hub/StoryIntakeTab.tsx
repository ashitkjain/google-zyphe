import React, { useState, useCallback, useMemo } from 'react';
import ClientEditModal from './ClientEditModal';
import { getRealtorIdFromHost } from '../../services/hostMapping';
import { upsertStoryLead } from '../../services/firebase/crm';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoryIntakeData {
    name: string;
    email: string;
    phone: string;
    preferredMethod: 'Email' | 'Phone';
    budget: string;
    targetLocations: string;
    homeType?: string;
    personaProfile: string;
    targetTimeline: string;
    chapter01: string; // Identity & Background
    chapter02: string; // Daily Rituals & Lifestyle
    chapter03: string; // Architectural & Emotional Soul
    chapter04: string; // What Else Is Important
    selectedAnchors: string[];
    customAnchor: string;
}

interface Props {
    isRealtor?: boolean;
    onMatchRequest?: (story: string, filters: { budgetMin: string; budgetMax: string; beds: string; baths: string }) => void;
    onStoryDiscover?: (story: string, cities: string[], persona?: import('../../services/prompts/buyerStoryMatch').PersonaContext) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ATMOSPHERIC_ANCHORS = [
    'Walking Distance to Coffee',
    'Quiet Streets',
    'Top-Rated Schools',
    'Large Backyard',
    'Home Office Ready',
    'Pet-Friendly Parks',
    'Low Wildfire Risk',
    'Tech Commute Access',
    'Private / Gated',
    'Gourmet Grocery Access',
    'Sustainable Architecture',
    'Modern Kitchen',
    'Natural Light / Open Plan',
    'Vastu / Good Orientation',
    'Mid-Century Aesthetic',
    'ADU Potential',
    'High ROI Potential',
    'Multi-Gen Living',
    'Single Story',
    'Pool Ready',
];

const CHAPTERS = [
    {
        num: '01',
        title: 'Who You Are',
        prompt: 'Tell us about your household background and current life stage.',
        placeholder: 'e.g. A growing family with two young children, Empty nesters, Tech couple in their 30s relocating from SF...',
        key: 'chapter01' as const,
    },
    {
        num: '02',
        title: 'Daily Rituals & Lifestyle',
        prompt: 'Describe your day-to-day flow. Where do you drink your morning coffee? Do you need a dedicated workspace?',
        placeholder: 'I start my day with a quiet espresso looking over a garden... I usually work from home three days a week and need absolute silence...',
        key: 'chapter02' as const,
    },
    {
        num: '03',
        title: 'The Dream Space',
        prompt: 'What are the essential architectural or emotional anchors for your next property?',
        placeholder: 'High ceilings and natural light are non-negotiable. I want a kitchen that opens into a garden for entertaining...',
        key: 'chapter03' as const,
    },
    {
        num: '04',
        title: 'What Else Is Important To You',
        prompt: 'Anything else — schools, commute, risk tolerance, deal-breakers?',
        placeholder: 'Top-rated schools are a must. Low wildfire risk is critical. We\'d prefer to avoid HOA communities. Commute to Palo Alto should be under 30 minutes...',
        key: 'chapter04' as const,
    },
];

// ─── Example Stories ─────────────────────────────────────────────────────────

interface ExampleStory {
    label: string;
    emoji: string;
    tagline: string;
    data: Omit<StoryIntakeData, 'email' | 'phone' | 'preferredMethod' | 'customAnchor'>;
}

const EXAMPLE_STORIES: ExampleStory[] = [
    {
        label: 'Tech Family Upsizing',
        emoji: '👨\u200D👩\u200D👧\u200D👦',
        tagline: 'Growing family, dual-income tech, needs space & top schools',
        data: {
            name: 'Priya & Arjun Mehta',
            budget: '2,200,000',
            targetLocations: 'Pleasanton, Dublin',
            personaProfile: 'First-Time',
            targetTimeline: '3-6 Months',
            chapter01: 'We are a dual-income tech couple in our early 30s with two kids, ages 3 and 6. We\'re currently renting in Fremont but have outgrown the space and want to settle in a top school district before next year.',
            chapter02: 'Arjun commutes to Apple Park three days a week and I work remotely full-time. Our evenings revolve around the kids, and the backyard is their sanctuary.',
            chapter03: 'We need at least four bedrooms, a dedicated home office, and an open kitchen that flows into the family room. A big flat backyard is essential, along with high ceilings, natural light, and a California modern aesthetic.',
            chapter04: 'Top-rated schools are our number one priority. We\'d love to be walking distance to parks, and low wildfire risk matters. Arjun\'s commute to Cupertino should be under 45 minutes.',
            selectedAnchors: ['Top-Rated Schools', 'Large Backyard', 'Home Office Ready', 'Natural Light / Open Plan', 'Tech Commute Access'],
        },
    },
    {
        label: 'Empty Nesters Downsizing',
        emoji: '🏡',
        tagline: 'Retired couple seeking single-story, low-maintenance living',
        data: {
            name: 'Robert & Linda Chen',
            budget: '1,500,000',
            targetLocations: 'Pleasanton, Dublin',
            personaProfile: 'Past Client',
            targetTimeline: '6-12 Months',
            chapter01: 'We are empty nesters in our early 60s. We\'ve lived in a four-bedroom colonial in Dublin for 22 years, and it\'s just too much house now. We\'d like to downsize to a single-story home where we can age in place.',
            chapter02: 'Robert walks three miles every morning, and we cook together daily. The Saturday farmers\' market is our ritual. We host our kids about four times a year, so a guest suite would be ideal.',
            chapter03: 'We want a single-story home with a modern kitchen, large island, and a covered patio. The master should have a walk-in shower, and we\'d like a guest bedroom with its own bathroom. Low-maintenance landscaping is important.',
            chapter04: 'We\'re looking for a quiet, established neighborhood with walking trails and proximity to medical facilities. We\'d prefer to avoid communities with large HOA fees.',
            selectedAnchors: ['Single Story', 'Quiet Streets', 'Modern Kitchen', 'Pet-Friendly Parks'],
        },
    },
    {
        label: 'SF→Suburbs Relocation',
        emoji: '🌉',
        tagline: 'Young professional couple leaving SF for more space',
        data: {
            name: 'Maya & Jordan Brooks',
            budget: '1,800,000',
            targetLocations: 'Dublin, Pleasanton',
            personaProfile: 'Relocation',
            targetTimeline: '1-3 Months',
            chapter01: 'We\'re both 29 with no kids yet, but planning to start a family soon. We\'ve been renting a one-bedroom in the Mission for four years. I work at Salesforce and Jordan is a physical therapist. We\'re pre-approved and ready to go.',
            chapter02: 'I work from home Monday through Wednesday and commute to SF the rest of the week, so BART access is key. We want a walkable neighborhood with restaurants and coffee shops nearby.',
            chapter03: 'We\'re looking for three bedrooms so we can have an office and a future nursery. An open kitchen and a small yard for a veggie garden are important. We love mid-century modern style and natural light is everything to us.',
            chapter04: 'Walking distance to BART is a must. We want good restaurants and cafés nearby, low HOA fees, and a good school district for when we start a family.',
            selectedAnchors: ['Walking Distance to Coffee', 'Home Office Ready', 'Mid-Century Aesthetic', 'Natural Light / Open Plan', 'Tech Commute Access'],
        },
    },
    {
        label: 'Real Estate Investor',
        emoji: '📈',
        tagline: 'Seeking high-ROI rental property with ADU potential',
        data: {
            name: 'David Nakamura',
            budget: '1,200,000',
            targetLocations: 'Dublin, Pleasanton',
            personaProfile: 'Investor',
            targetTimeline: 'ASAP',
            chapter01: 'I\'m a 42-year-old software architect building a rental portfolio. I already own two properties in the East Bay and I\'m looking for a third acquisition with ADU potential.',
            chapter02: 'This is a pure investment — I won\'t be living here. The property needs to be tenant-ready or close to it, with positive cash flow from day one after all expenses.',
            chapter03: 'I need a lot of at least 6,000 square feet to build a detached ADU. The main house should be at least three bedrooms and two baths with a functional kitchen and updated bathrooms. I prefer single-story.',
            chapter04: 'I want an ADU-friendly city with straightforward permitting and a cap rate above 5%. Proximity to BART or the ACE train is a plus. I can go all-cash under a million, conventional financing above that.',
            selectedAnchors: ['ADU Potential', 'High ROI Potential', 'Single Story', 'Large Backyard'],
        },
    },
    {
        label: 'Multi-Gen Household',
        emoji: '👵',
        tagline: 'Three generations under one roof, needs casita or in-law suite',
        data: {
            name: 'The Patel Family',
            budget: '2,800,000',
            targetLocations: 'Pleasanton, Dublin',
            personaProfile: 'First-Time',
            targetTimeline: '3-6 Months',
            chapter01: 'We are a multi-generational family — a couple in our late 40s with two teenagers, plus my elderly parents who are moving from India to live with us permanently. We need separate spaces under one roof.',
            chapter02: 'We share big family meals every Sunday. My parents need ground-floor living with easy access. I work from home as a consultant, and my wife runs a catering business that requires a serious kitchen.',
            chapter03: 'We need at least five bedrooms and a ground-floor in-law suite with its own bathroom. The kitchen should be large with commercial-grade ventilation, and we want open living areas for gatherings of twenty or more.',
            chapter04: 'A ground-floor suite for my parents is the top priority. Good schools for our teenagers and Vastu-compliant orientation are also important. We need a three-car garage and prefer newer construction built after 2000.',
            selectedAnchors: ['Multi-Gen Living', 'Modern Kitchen', 'Top-Rated Schools', 'Vastu / Good Orientation', 'Large Backyard'],
        },
    },
    {
        label: 'Young Solo Buyer',
        emoji: '🎯',
        tagline: 'First-time buyer, single professional, wants community vibes',
        data: {
            name: 'Sophia Martinez',
            budget: '850,000',
            targetLocations: 'Dublin, Pleasanton',
            personaProfile: 'First-Time',
            targetTimeline: '1-3 Months',
            chapter01: 'I\'m a 27-year-old product marketing manager at Google. I\'m single with a golden retriever, and this is my first time buying a home. I\'m pre-approved with 15% down.',
            chapter02: 'I\'m an early bird — I start the day with a run with my dog, grab coffee at a café, then head to the office in Sunnyvale three days a week. My evenings are for cooking, yoga, and friends. Having a social life nearby really matters to me.',
            chapter03: 'I\'d like at least two bedrooms so I have space for a guest room or office. Modern finishes and in-unit laundry are important. A small patio or yard for the dog would be great. I want a clean, bright space with character.',
            chapter04: 'I want to be within walking distance of restaurants, coffee shops, and a dog park. A strong sense of community is important. If it\'s a condo, I\'d prefer low HOA fees. The neighborhood should feel safe at night, and my commute should be under 40 minutes.',
            selectedAnchors: ['Walking Distance to Coffee', 'Pet-Friendly Parks', 'Natural Light / Open Plan', 'Tech Commute Access'],
        },
    },
    {
        label: 'Luxury Upgrade',
        emoji: '✨',
        tagline: 'Established executives seeking premium estate living',
        data: {
            name: 'James & Catherine Whitfield',
            budget: '4,500,000',
            targetLocations: 'Pleasanton, Dublin',
            personaProfile: 'Past Client',
            targetTimeline: '6-12 Months',
            chapter01: 'We are a couple in our 50s with grown children. I\'m a retired CFO and Catherine runs a boutique interior design firm. We currently live in Pleasanton and are ready for our forever home — something with sweeping views and a sense of arrival.',
            chapter02: 'We enjoy leisurely mornings on the terrace, golf twice a week, and hosting monthly dinner parties for eight to twelve guests. Wine is our shared passion, and we have a 400-bottle collection that needs a proper home.',
            chapter03: 'We want something architecturally significant — not a McMansion. A wine cellar, chef\'s kitchen with Wolf and Sub-Zero appliances, infinity pool, and at least 4,000 square feet. Catherine needs a dedicated art studio.',
            chapter04: 'Views are our number one criterion — the East Bay hills or Mt. Diablo. Privacy and a gated setting are essential. We want turnkey luxury with no major renovations needed, close to a good golf course. This will be an all-cash purchase.',
            selectedAnchors: ['Private / Gated', 'Pool Ready', 'Gourmet Grocery Access', 'Modern Kitchen', 'Sustainable Architecture'],
        },
    },
    {
        label: 'Climate-Conscious Buyer',
        emoji: '🌿',
        tagline: 'Sustainability-focused family, solar + EV + low fire risk',
        data: {
            name: 'Erik & Sunita Johansson',
            budget: '1,900,000',
            targetLocations: 'Pleasanton, Dublin',
            personaProfile: 'Relocation',
            targetTimeline: '3-6 Months',
            chapter01: 'We\'re relocating from Seattle — both in our late 30s with a toddler. I\'m a climate scientist at Lawrence Livermore National Lab and Sunita is a sustainability consultant who works remotely. We want a home that reflects our environmental values.',
            chapter02: 'We bike commute whenever possible and keep a home office surrounded by plants. We grow much of our own food in raised beds and drive an EV, so we need Level 2 charging at home.',
            chapter03: 'Solar panels are a requirement. We want energy-efficient HVAC, dual-pane windows, and a yard large enough for raised beds and fruit trees. A south-facing orientation and sustainable architectural aesthetic are ideal.',
            chapter04: 'Low wildfire risk is absolutely critical for us. We value bikeable streets with trails nearby and need good daycare options. My commute to Lawrence Livermore should be under 20 minutes.',
            selectedAnchors: ['Low Wildfire Risk', 'Sustainable Architecture', 'Large Backyard', 'Pet-Friendly Parks', 'Natural Light / Open Plan'],
        },
    },
    {
        label: 'Weekend Retreat Seeker',
        emoji: '🏔️',
        tagline: 'Bay Area exec wanting a vineyard-adjacent weekend escape',
        data: {
            name: 'Michael Torres',
            budget: '1,100,000',
            targetLocations: 'Pleasanton, Dublin',
            personaProfile: 'Investor',
            targetTimeline: 'Just Browsing',
            chapter01: 'I\'m a 45-year-old VP of Engineering and I own a condo in San Jose. I\'m looking for a weekend property in wine country that\'s close enough to enjoy every weekend.',
            chapter02: 'I picture Friday evenings with a glass of wine on the porch at sunset, Saturday mornings exploring local wineries. I\'m an amateur winemaker and would love space for a small crush pad.',
            chapter03: 'It doesn\'t need to be large — two or three bedrooms is fine. I love rustic-modern style with exposed beams, a stone fireplace, and wide plank floors. An outdoor living area with a pergola and fire pit is essential, and I want land with trees.',
            chapter04: 'It should be within 90 minutes of San Jose with vineyard-adjacent vibes and real privacy — no subdivision feel. I\'d consider using it as a short-term rental when I\'m not there.',
            selectedAnchors: ['Quiet Streets', 'Private / Gated', 'Natural Light / Open Plan', 'High ROI Potential'],
        },
    },
    {
        label: 'Divorced Parent Restart',
        emoji: '🔄',
        tagline: 'Recently divorced dad, needs 50/50 custody-friendly home',
        data: {
            name: 'Kevin Park',
            budget: '1,050,000',
            targetLocations: 'Dublin, Pleasanton',
            personaProfile: 'First-Time',
            targetTimeline: 'ASAP',
            chapter01: 'I\'m a 38-year-old software engineer going through a divorce. I have two kids, ages 8 and 11, and we\'re doing 50/50 custody. I need a real home for them — not just a temporary place, but somewhere they feel truly at home.',
            chapter02: 'I work from home at Meta. When the kids are with me, mornings are all about school drop-off. My son needs his own space for gaming and my daughter loves arts and crafts, so separate rooms are important.',
            chapter03: 'I need at least three bedrooms with an open kitchen and living area. A yard for the kids to play in is important. The home should be move-in ready — I don\'t have time for renovations right now. Good storage is a must.',
            chapter04: 'Staying in the same school district as my ex is the top priority — that means Dublin Unified or Pleasanton Unified. I want to be near parks and the kids\' activities. My budget is tight and I need to move within 60 days.',
            selectedAnchors: ['Top-Rated Schools', 'Large Backyard', 'Home Office Ready', 'Pet-Friendly Parks', 'Quiet Streets'],
        },
    },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const StoryIntakeTab: React.FC<Props> = ({ isRealtor = false, onMatchRequest, onStoryDiscover }) => {
    const [data, setData] = useState<StoryIntakeData>({
        name: '',
        email: '',
        phone: '',
        preferredMethod: 'Email',
        budget: '',
        targetLocations: '',
        personaProfile: '',
        targetTimeline: '',
        chapter01: '',
        chapter02: '',
        chapter03: '',
        chapter04: '',
        selectedAnchors: [],
        customAnchor: '',
    });

    const [synthesizing, setSynthesizing] = useState(false);
    const [saved, setSaved] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [showExamples, setShowExamples] = useState(true);
    const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

    const loadExample = (example: ExampleStory) => {
        setData(prev => ({
            ...prev,
            ...example.data,
            email: prev.email,
            phone: prev.phone,
            preferredMethod: prev.preferredMethod,
            customAnchor: '',
        }));
        setShowExamples(false);
        setSaved(false);
        // Scroll to top of form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const wordCountPerSection = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

    const update = useCallback(<K extends keyof StoryIntakeData>(key: K, value: StoryIntakeData[K]) => {
        // Enforce 50 word limit for chapter fields
        if (['chapter01', 'chapter02', 'chapter03', 'chapter04'].includes(key as string)) {
            const words = (value as string).trim().split(/\s+/).filter(Boolean);
            if (words.length > 50) {
                // Keep only the first 50 words
                const limited = (value as string).split(/\s+/).slice(0, 50).join(' ');
                setData(prev => ({ ...prev, [key]: limited }));
                return;
            }
        }
        setData(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    }, []);

    const toggleAnchor = (label: string) => {
        setData(prev => ({
            ...prev,
            selectedAnchors: prev.selectedAnchors.includes(label)
                ? prev.selectedAnchors.filter(a => a !== label)
                : [...prev.selectedAnchors, label],
        }));
    };

    const addCustomAnchor = () => {
        const trimmed = data.customAnchor.trim();
        if (!trimmed || data.selectedAnchors.includes(trimmed)) return;
        setData(prev => ({
            ...prev,
            selectedAnchors: [...prev.selectedAnchors, trimmed],
            customAnchor: '',
        }));
    };

    const fullStory = [data.chapter01, data.chapter02, data.chapter03, data.chapter04]
        .filter(Boolean)
        .join('\n\n');

    // Resolve the realtorId from the current hostname
    const realtorId = useMemo(() => getRealtorIdFromHost(), []);

    // Synthetic client object pre-filled from story form
    const syntheticClient = {
        id: null,
        realtorId,
        firstName: data.name.split(' ')[0] || '',
        lastName: data.name.split(' ').slice(1).join(' ') || '',
        email: data.email,
        phone: data.phone,
        primaryContact: {
            email: data.email,
            phone: data.phone,
            preferredMethod: data.preferredMethod,
        },
        financialVitals: { budgetMax: data.budget.replace(/[^0-9]/g, ''), preApprovalStatus: false, isAllCash: false },
        searchCriteria: {
            locations: data.targetLocations,
            targetTimeline: data.targetTimeline,
            personaProfile: data.personaProfile,
            mustHaves: [data.chapter01, data.chapter04].filter(Boolean).join('\n'),
            dealBreakers: '',
        },
        leadInfo: { customerMessage: fullStory },
        motivation: data.chapter02,
    };

    const wordCount = fullStory.split(/\s+/).filter(Boolean).length;
    const isReady = fullStory.length > 30 || data.selectedAnchors.length > 0;

    const handleDiscover = async () => {
        if (!isReady) return;
        setSynthesizing(true);
        setSaveFeedback(null);

        try {
            // Upsert the lead in the realtor's collection
            const result = await upsertStoryLead(realtorId, {
                name: data.name,
                email: data.email,
                phone: data.phone,
                preferredMethod: data.preferredMethod,
                budget: data.budget,
                targetLocations: data.targetLocations,
                personaProfile: data.personaProfile,
                targetTimeline: data.targetTimeline,
                story: fullStory,
                selectedAnchors: data.selectedAnchors,
            });

            if (result) {
                setSaveFeedback(
                    result.action === 'updated'
                        ? 'Your story has been updated — searching for matches...'
                        : 'Your story has been saved — searching for matches...'
                );
            }
        } catch (err) {
            console.error('[StoryIntake] Failed to save lead:', err);
            setSaveFeedback('Something went wrong saving your story. Please try again.');
        }

        setSynthesizing(false);
        setSaved(true);

        // Parse cities from target locations
        const cities = data.targetLocations
            .split(',')
            .map(c => c.trim())
            .filter(Boolean);

        // Build the full prompt with selected tags appended
        const anchors = data.selectedAnchors;
        const storyWithTags = anchors.length > 0
            ? `${fullStory}\n\nBudget: $${data.budget}\nImportant priorities: ${anchors.join(', ')}.`
            : `${fullStory}\n\nBudget: $${data.budget}`;

        // Trigger the AI discovery flow with the story and cities
        if (onStoryDiscover && cities.length > 0) {
            onStoryDiscover(storyWithTags, cities, {
                personaProfile: data.personaProfile || undefined,
                whoYouAre: data.chapter01 || undefined,
                dailyRituals: data.chapter02 || undefined,
                dreamSpace: data.chapter03 || undefined,
                whatElseMatters: data.chapter04 || undefined,
                selectedAnchors: data.selectedAnchors.length > 0 ? data.selectedAnchors : undefined,
                homeType: data.homeType || undefined,
            });
        }

        // Legacy match request
        onMatchRequest?.(fullStory, {
            budgetMin: '',
            budgetMax: data.budget.replace(/[^0-9]/g, ''),
            beds: '',
            baths: '',
        });
    };

    return (
        <>
        <div className="animate-in fade-in duration-400 min-h-screen bg-slate-50/60 pb-24">

            {/* ── Page Header ── */}
            <div className="px-8 pt-2 pb-6 max-w-5xl mx-auto">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                    Your Home Story: Tell Us Your Vision
                </h1>
                <button
                    onClick={() => setShowExamples(prev => !prev)}
                    className="mt-3 flex items-center gap-2 text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors group"
                >
                    <i className={`fa-solid ${showExamples ? 'fa-chevron-up' : 'fa-lightbulb'} text-[10px] group-hover:scale-110 transition-transform`}></i>
                    {showExamples ? 'Hide examples' : 'See example stories for inspiration'}
                </button>
            </div>

            {/* ── Example Stories Carousel ── */}
            {showExamples && (
                <div className="max-w-5xl mx-auto px-8 pb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <i className="fa-solid fa-lightbulb text-amber-400 text-xs"></i>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Click any story to auto-fill the form</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        {EXAMPLE_STORIES.map((ex, i) => (
                            <button
                                key={i}
                                onClick={() => loadExample(ex)}
                                className="group text-left bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl px-3 py-3 transition-all hover:shadow-md"
                            >
                                <div className="text-lg mb-1">{ex.emoji}</div>
                                <div className="text-[11px] font-black text-slate-800 group-hover:text-indigo-700 leading-tight">{ex.label}</div>
                                <div className="text-[9px] font-medium text-slate-400 group-hover:text-indigo-400 mt-0.5 leading-snug line-clamp-2">{ex.tagline}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Body Grid ── */}
            <div className="max-w-5xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">

                {/* ── LEFT: Profile Panel ── */}
                <div className="space-y-4">
                    {/* Profile card */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                                <i className="fa-solid fa-user text-slate-500 text-xs"></i>
                            </div>
                            <span className="text-sm font-black text-slate-900">Your Profile</span>
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1.5">
                                {isRealtor ? 'Client Name' : 'Full Name'}
                            </label>
                            <input
                                type="text"
                                value={data.name}
                                onChange={e => update('name', e.target.value)}
                                placeholder={isRealtor ? 'e.g. Eleanor & James Vance' : 'e.g. Alexander Sterling'}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                            />
                        </div>

                        {/* Email Address */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                                    Email Address
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={data.preferredMethod === 'Email'}
                                        onChange={() => update('preferredMethod', 'Email')}
                                        className="w-3 h-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider group-hover:text-slate-600 transition-colors">Preferred</span>
                                </label>
                            </div>
                            <input
                                type="email"
                                value={data.email}
                                onChange={e => update('email', e.target.value)}
                                placeholder="e.g. alex@example.com"
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                            />
                        </div>

                        {/* Phone Number */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                                    Phone Number
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={data.preferredMethod === 'Phone'}
                                        onChange={() => update('preferredMethod', 'Phone')}
                                        className="w-3 h-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider group-hover:text-slate-600 transition-colors">Preferred</span>
                                </label>
                            </div>
                            <input
                                type="tel"
                                value={data.phone}
                                onChange={e => update('phone', e.target.value)}
                                placeholder="e.g. (555) 000-0000"
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1.5">
                                Budget Preference
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                                <input
                                    type="text"
                                    value={data.budget}
                                    onChange={e => update('budget', e.target.value)}
                                    placeholder="1,800,000"
                                    className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                                />
                            </div>
                        </div>

                        {/* Target Locations */}
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1.5">
                                Target Locations
                            </label>
                            <input
                                type="text"
                                value={data.targetLocations}
                                onChange={e => update('targetLocations', e.target.value)}
                                placeholder="e.g. Pleasanton, Dublin, San Ramon"
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                            />
                        </div>

                        {/* Home Type */}
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1.5">
                                Home Type
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    { value: '', label: 'Any' },
                                    { value: 'SINGLE_FAMILY', label: 'Single Family' },
                                    { value: 'TOWNHOUSE', label: 'Townhouse' },
                                    { value: 'CONDO', label: 'Condo' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => update('homeType', opt.value)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            (data.homeType || '') === opt.value
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Request more info link */}
                        <button
                            onClick={() => setEditModalOpen(true)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors group"
                        >
                            <i className="fa-solid fa-pen-to-square text-[10px] group-hover:scale-110 transition-transform"></i>
                            Add more details (contact, timeline, financials)
                        </button>
                    </div>

                    {/* Post-it Note: Mission Statement */}
                    <div className="relative transform -rotate-1 group hover:rotate-0 transition-transform duration-300 cursor-default select-none mb-6">
                        {/* The shadow/paper curl effect */}
                        <div className="absolute inset-0 bg-amber-200/30 rounded-sm translate-x-1.5 translate-y-2 blur-sm group-hover:translate-x-0 group-hover:translate-y-0 transition-all"></div>
                        {/* The actual note */}
                        <div className="relative bg-[#FFFDCC] border-l-[10px] border-amber-200/50 px-6 py-6 min-h-[160px] shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] flex flex-col justify-center overflow-hidden">
                            {/* Decorative tape at top */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-6 bg-white/40 border border-white/20 -rotate-2 transform transition-transform group-hover:rotate-0"></div>
                            
                            <div className="absolute top-2 right-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <i className="fa-solid fa-quote-right text-amber-900 text-2xl"></i>
                            </div>
                            
                            <span className="text-[9px] font-black uppercase text-amber-800/60 tracking-[0.2em] mb-3">Our Objective</span>
                            <p className="text-[13px] font-medium text-amber-900/80 leading-relaxed italic drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] font-serif whitespace-pre-wrap">
                                "We aren't just looking for a structure. We're looking for the canvas where our next chapter unfolds — from first steps to backyard sunsets."
                            </p>
                            
                            {/* Hand-drawn underline squiggle */}
                            <div className="mt-4 h-1 w-24 border-b-2 border-amber-300/40 rounded-[50%] skew-x-12"></div>
                        </div>
                    </div>

                    {/* AI Precision card */}
                    <div className="bg-slate-900 rounded-2xl p-5 text-white">
                        <div className="flex items-center gap-2 mb-3">
                            <i className="fa-solid fa-wand-magic-sparkles text-indigo-400 text-sm"></i>
                            <span className="text-sm font-black">AI Precision</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed font-medium">
                            Our engine analyzes over 120 property factors and cross-references
                            your narrative against real listings using context graphs.
                        </p>
                    </div>

                    {/* Realtor-only: Synthesize button */}
                    {isRealtor && (
                        <button
                            onClick={handleDiscover}
                            disabled={synthesizing || !isReady}
                            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider shadow-lg hover:bg-indigo-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {synthesizing
                                ? <><i className="fa-solid fa-spinner animate-spin text-xs"></i>Running match...</>
                                : <><i className="fa-solid fa-bolt text-xs"></i>Synthesize Match</>
                            }
                        </button>
                    )}

                    {/* Progress indicator */}
                    {wordCount > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
                            <div className="flex-1">
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min(100, (wordCount / 100) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 flex-shrink-0">{wordCount} words</span>
                        </div>
                    )}
                </div>

                {/* ── RIGHT: Narrative Chapters ── */}
                <div className="space-y-5">
                    {CHAPTERS.map(ch => (
                        <div key={ch.num} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            {/* Chapter header */}
                            <div className="px-6 pt-5 pb-3 flex items-start gap-4">
                                <span className="text-3xl font-black text-slate-100 leading-none select-none flex-shrink-0 mt-0.5">
                                    {ch.num}
                                </span>
                                <div>
                                    <h2 className="text-base font-black text-slate-900">{ch.title}</h2>
                                    <p className="text-xs text-slate-400 font-medium mt-0.5 italic">{ch.prompt}</p>
                                </div>
                            </div>

                            {/* Textarea */}
                            <div className="px-6 pb-5 relative">
                                <textarea
                                    value={data[ch.key]}
                                    onChange={e => update(ch.key, e.target.value)}
                                    placeholder={ch.placeholder}
                                    rows={4}
                                    className={`w-full resize-none px-4 py-3.5 bg-slate-50 border rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 transition-all leading-relaxed ${
                                        wordCountPerSection(data[ch.key]) >= 50
                                            ? 'border-amber-300 ring-2 ring-amber-100 bg-amber-50/10'
                                            : 'border-slate-200 focus:ring-indigo-200 focus:border-indigo-300'
                                    }`}
                                />
                                <div className={`absolute bottom-7 right-8 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm ${
                                    wordCountPerSection(data[ch.key]) >= 40
                                        ? wordCountPerSection(data[ch.key]) >= 50 ? 'bg-rose-500 text-white animate-pulse' : 'bg-amber-400 text-white'
                                        : 'bg-slate-100 text-slate-400'
                                }`}>
                                    {wordCountPerSection(data[ch.key])} / 50 words
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Atmospheric Anchors ── */}
            <div className="max-w-5xl mx-auto px-8 mt-8">
                <div className="bg-white rounded-2xl border border-slate-200 px-6 py-5">
                    <div className="flex items-center gap-2 mb-4">
                        <i className="fa-solid fa-waveform-lines text-slate-400 text-xs"></i>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                            Atmospheric Anchors
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {ATMOSPHERIC_ANCHORS.map(anchor => {
                            const isSelected = data.selectedAnchors.includes(anchor);
                            return (
                                <button
                                    key={anchor}
                                    onClick={() => toggleAnchor(anchor)}
                                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                                        isSelected
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-900'
                                    }`}
                                >
                                    {anchor}
                                </button>
                            );
                        })}

                        {/* Custom anchors already added */}
                        {data.selectedAnchors
                            .filter(a => !ATMOSPHERIC_ANCHORS.includes(a))
                            .map(a => (
                                <button
                                    key={a}
                                    onClick={() => toggleAnchor(a)}
                                    className="px-4 py-2 rounded-full text-xs font-semibold bg-indigo-600 text-white border border-indigo-600 transition-all"
                                >
                                    {a}
                                </button>
                            ))}

                        {/* Add custom */}
                        <div className="flex items-center gap-1 border border-dashed border-slate-300 rounded-full px-3 py-1.5">
                            <input
                                type="text"
                                value={data.customAnchor}
                                onChange={e => update('customAnchor', e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomAnchor(); } }}
                                placeholder="Add your own..."
                                className="bg-transparent text-xs font-medium text-slate-600 placeholder:text-slate-300 outline-none w-28"
                            />
                            {data.customAnchor.trim() && (
                                <button
                                    onClick={addCustomAnchor}
                                    className="px-2 py-0.5 bg-slate-900 text-white rounded-full text-[9px] font-black"
                                >
                                    +
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Footer CTA ── */}
            <div className="max-w-5xl mx-auto px-8 mt-6 flex items-center justify-between">
                <div className="text-[10px] text-slate-400 font-medium">
                {saveFeedback
                        ? <><i className={`fa-solid ${saveFeedback.includes('wrong') ? 'fa-exclamation-circle text-red-500' : 'fa-check text-emerald-500'} mr-1`}></i>{saveFeedback}</>
                        : saved
                            ? <><i className="fa-solid fa-check text-emerald-500 mr-1"></i>Your story is saved</>
                            : data.selectedAnchors.length > 0
                                ? `${data.selectedAnchors.length} anchor${data.selectedAnchors.length > 1 ? 's' : ''} selected`
                                : 'Select anchors or write your story to begin'
                    }
                </div>
                <button
                    onClick={handleDiscover}
                    disabled={synthesizing || !isReady}
                    className="flex items-center gap-3 px-7 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-black tracking-wide shadow-xl hover:bg-indigo-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {synthesizing ? (
                        <><i className="fa-solid fa-spinner animate-spin"></i>Finding matches...</>
                    ) : (
                        <>Begin Discovery <i className="fa-solid fa-arrow-right ml-1"></i></>
                    )}
                </button>
            </div>
        </div>

        {/* ── ClientEditModal (pre-filled from story data) ── */}
        <ClientEditModal
            client={syntheticClient}
            isOpen={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            onSave={async (updates) => {
                // Pull key fields back into story form
                if (updates.firstName || updates.lastName) {
                    update('name', [updates.firstName, updates.lastName].filter(Boolean).join(' '));
                }
                if ((updates as any).financialVitals?.budgetMax) {
                    update('budget', String((updates as any).financialVitals.budgetMax));
                }
                if ((updates as any).searchCriteria?.locations) {
                    update('targetLocations', (updates as any).searchCriteria.locations);
                }
                if ((updates as any).searchCriteria?.targetTimeline) {
                    update('targetTimeline', (updates as any).searchCriteria.targetTimeline);
                }
                if ((updates as any).searchCriteria?.personaProfile) {
                    update('personaProfile', (updates as any).searchCriteria.personaProfile);
                }
                if (updates.email) {
                    update('email', updates.email);
                }
                if (updates.phone) {
                    update('phone', updates.phone);
                }
                if ((updates as any).primaryContact?.preferredMethod) {
                    update('preferredMethod', (updates as any).primaryContact.preferredMethod);
                }
                setEditModalOpen(false);
            }}
        />
        </>
    );
};

export default StoryIntakeTab;
