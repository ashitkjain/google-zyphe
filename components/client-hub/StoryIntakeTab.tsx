import React, { useState, useCallback, useMemo } from 'react';
import ClientEditModal from './ClientEditModal';
import { getRealtorIdFromHost } from '../../services/hostMapping';
import { upsertStoryLead, findLeadByEmailOrPhone } from '../../services/firebase/crm';
import { auth } from '../../services/firebase/config';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoryIntakeData {
    name: string;
    email: string;
    phone: string;
    preferredMethod: 'Email' | 'Phone';
    budget: string;
    targetLocations: string;
    targetTimeline: string;
    homeType?: string;
    personaProfile: string;
    chapter01: string; // Who You Are
    chapter02: string; // Daily Rituals & Lifestyle
    chapter03: string; // Must-haves & Deal-breakers
    chapter04: string; // Lifestyle Priorities
    chapter05: string; // The Future You
    selectedAnchors: string[];
    customAnchor: string;
}

interface Props {
    isRealtor?: boolean;
    realtorId?: string;
    onMatchRequest?: (story: string, filters: { budgetMin: string; budgetMax: string; beds: string; baths: string }) => void;
    onStoryDiscover?: (story: string, cities: string[], persona?: import('../../services/prompts/buyerStoryMatch').PersonaContext) => void;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const ACCENT = '#4F46E5';
const ACCENT_600 = '#4338CA';
const ACCENT_SOFT = '#EEF0FF';

// ─── Persona starters ────────────────────────────────────────────────────────

const STORY_PERSONAS = [
    { id: 'tech-family', icon: '⌂', name: 'Tech Family Upsizing', sub: 'Growing family · dual-income · top schools', tint: '#EEF0FF', ink: '#4338CA' },
    { id: 'empty-nesters', icon: '✧', name: 'Empty Nesters Downsizing', sub: 'Retired · single-story · low-maintenance', tint: '#FEF3C7', ink: '#92400E' },
    { id: 'sf-suburbs', icon: '◐', name: 'SF → Suburbs Relocation', sub: 'Young professionals leaving the city for space', tint: '#DBEAFE', ink: '#1E40AF' },
    { id: 'investor', icon: '▲', name: 'Real Estate Investor', sub: 'Seeking high-ROI rental with ADU potential', tint: '#DCFCE7', ink: '#15803D' },
    { id: 'multi-gen', icon: '⌘', name: 'Multi-Gen Household', sub: 'Three generations · casita or in-law suite', tint: '#FEE2E2', ink: '#991B1B' },
    { id: 'solo', icon: '◉', name: 'Young Solo Buyer', sub: 'First-time buyer · community vibes', tint: '#FCE7F3', ink: '#9D174D' },
    { id: 'luxury', icon: '✦', name: 'Luxury Upgrade', sub: 'Established executives · premium estate', tint: '#F3E8FF', ink: '#6B21A8' },
    { id: 'climate', icon: '☘', name: 'Climate-Conscious Buyer', sub: 'Sustainable · solar · low fire risk', tint: '#D1FAE5', ink: '#065F46' },
    { id: 'retreat', icon: '⌒', name: 'Weekend Retreat Seeker', sub: 'Vineyard-adjacent weekend escape', tint: '#FED7AA', ink: '#9A3412' },
    { id: 'restart', icon: '✿', name: 'Divorced Parent Restart', sub: 'Custody-friendly · fresh start home', tint: '#E0E7FF', ink: '#3730A3' },
];

// ─── Story chapters ───────────────────────────────────────────────────────────

const CHAPTERS = [
    {
        num: '01', label: 'Who you are', icon: '◉',
        title: 'Tell us about your household, life stage, and what brought you here.',
        placeholder: 'A growing family with two young kids, in our late 30s, both working in tech and ready to leave our SF rental for a real backyard…',
        examples: ['A growing family with two young children', 'Empty nesters ready to downsize', 'Tech couple in their 30s relocating from SF'],
        key: 'chapter01' as const,
    },
    {
        num: '02', label: 'Daily rituals & lifestyle', icon: '☼',
        title: 'Walk us through your day. Where do you drink your morning coffee? Do you need a dedicated workspace?',
        placeholder: 'I start my day with a quiet espresso looking over a garden… I work from home three days a week and need absolute silence for calls…',
        examples: ['WFH with a closed-door office for video calls', 'Garden coffee in the morning, sunset porch in the evening', 'Open kitchen so I can cook while the kids do homework'],
        key: 'chapter02' as const,
    },
    {
        num: '03', label: 'Must-haves & deal-breakers', icon: '✓',
        title: 'What\'s non-negotiable, and what would absolutely disqualify a home for you?',
        placeholder: 'Must: 4+ beds, two-car garage, walk to top elementary. Avoid: north-facing backyards, busy roads, anything needing a major remodel…',
        examples: ['10/10 schools within walking distance', 'Two home offices, both with doors', 'No HOAs above $300/mo, no flood zones'],
        key: 'chapter03' as const,
    },
    {
        num: '04', label: 'Lifestyle priorities', icon: '✧',
        title: 'What do weekends look like? What do you want your neighborhood to feel like?',
        placeholder: 'Weekends are farmer\'s markets, a 5-mile run on a tree-lined trail, then a long brunch. We want neighbors who say hi but don\'t drop in unannounced…',
        examples: ['Walkable downtown with cafes and a Saturday market', 'Quiet cul-de-sac, lots of kids on bikes', 'Vineyard country, an hour from a real airport'],
        key: 'chapter04' as const,
    },
    {
        num: '05', label: 'The future you', icon: '↗',
        title: 'How long do you plan to stay? What will life look like in five years?',
        placeholder: 'Planning to be here 10+ years. Want one more kid. My parents may move in with us by 2030 — need a flexible floorplan or in-law potential…',
        examples: ['Here 10+ years — want room to grow', '3-year hold, then trade up', 'Forever home — must work for aging in place'],
        key: 'chapter05' as const,
    },
];

// ─── Atmospheric anchors ──────────────────────────────────────────────────────

const ATMOSPHERIC_ANCHORS = [
    'Walking Distance to Coffee', 'Quiet Streets', 'Top-Rated Schools', 'Large Backyard',
    'Home Office Ready', 'Pet-Friendly Parks', 'Low Wildfire Risk', 'Tech Commute Access',
    'Private / Gated', 'Gourmet Grocery Access', 'Sustainable Architecture', 'Modern Kitchen',
    'Natural Light / Open Plan', 'Vastu / Good Orientation', 'Mid-Century Aesthetic',
    'ADU Potential', 'High ROI Potential', 'Multi-Gen Living', 'Single Story', 'Pool Ready',
];

// ─── Example stories ──────────────────────────────────────────────────────────

interface ExampleStory {
    personaId: string;
    data: Omit<StoryIntakeData, 'email' | 'phone' | 'preferredMethod' | 'customAnchor'>;
}

const EXAMPLE_STORIES: ExampleStory[] = [
    {
        personaId: 'tech-family',
        data: {
            name: 'Priya & Arjun Mehta',
            budget: '2,200,000',
            targetLocations: 'Pleasanton, Dublin',
            targetTimeline: 'Q2 2026',
            homeType: 'SINGLE_FAMILY',
            personaProfile: 'First-Time',
            chapter01: 'We are a dual-income tech couple in our early 30s with two kids, ages 3 and 6. We\'re currently renting in Fremont but have outgrown the space and want to settle in a top school district before next year.',
            chapter02: 'Arjun commutes to Apple Park three days a week and I work remotely full-time. Our evenings revolve around the kids, and the backyard is their sanctuary.',
            chapter03: 'Must: 4+ bedrooms, dedicated home office, open kitchen into family room, big flat backyard, top elementary school (10/10 GreatSchools). Avoid: busy roads, north-facing backyards, HOAs over $300/mo, flood zones.',
            chapter04: 'We love weekend farmers\' markets and the kids riding bikes in the neighborhood. We want neighbors who wave hello. A walkable park within 10 minutes matters.',
            chapter05: 'Planning to stay 10+ years. We want a third child and my parents may visit for extended stays — a guest suite or in-law potential would be ideal.',
            selectedAnchors: ['Top-Rated Schools', 'Large Backyard', 'Home Office Ready', 'Natural Light / Open Plan', 'Tech Commute Access'],
        },
    },
    {
        personaId: 'empty-nesters',
        data: {
            name: 'Robert & Linda Chen',
            budget: '1,500,000',
            targetLocations: 'Pleasanton, Dublin',
            targetTimeline: 'Q3 2026',
            homeType: 'SINGLE_FAMILY',
            personaProfile: 'Past Client',
            chapter01: 'We are empty nesters in our early 60s. We\'ve lived in a four-bedroom colonial in Dublin for 22 years, and it\'s just too much house now. We\'d like to downsize to a single-story home where we can age in place.',
            chapter02: 'Robert walks three miles every morning, and we cook together daily. The Saturday farmers\' market is our ritual. We host our kids about four times a year, so a guest suite would be ideal.',
            chapter03: 'Must: single-story, modern kitchen with large island, covered patio, guest bedroom with en-suite. Avoid: large HOA fees, two-story homes, high-maintenance landscaping.',
            chapter04: 'We want a quiet, established neighborhood with walking trails. Proximity to medical facilities and a golf course are a plus.',
            chapter05: 'This is our forever home. Aging in place is the priority — wide hallways, step-free entry, and a master bath with a walk-in shower are essential.',
            selectedAnchors: ['Single Story', 'Quiet Streets', 'Modern Kitchen', 'Pet-Friendly Parks'],
        },
    },
    {
        personaId: 'sf-suburbs',
        data: {
            name: 'Maya & Jordan Brooks',
            budget: '1,800,000',
            targetLocations: 'Dublin, Pleasanton',
            targetTimeline: 'Q1 2026',
            homeType: 'SINGLE_FAMILY',
            personaProfile: 'Relocation',
            chapter01: 'We\'re both 29 with no kids yet, but planning to start a family soon. We\'ve been renting a one-bedroom in the Mission for four years and are pre-approved and ready to go.',
            chapter02: 'I work from home Monday through Wednesday and commute to SF the rest of the week, so BART access is key. Evenings are cooking, friends, and the occasional hike.',
            chapter03: 'Must: 3 bedrooms, open kitchen, small yard, BART walkable. Avoid: high HOA fees, deferred maintenance, anything over 45 min to SF.',
            chapter04: 'We love walkable downtown areas with restaurants and coffee shops. Mid-century modern aesthetic speaks to us strongly — natural light is everything.',
            chapter05: 'We plan to be here 5–7 years, then trade up after starting a family. Good school district for when we have kids is already on our radar.',
            selectedAnchors: ['Walking Distance to Coffee', 'Home Office Ready', 'Mid-Century Aesthetic', 'Natural Light / Open Plan', 'Tech Commute Access'],
        },
    },
    {
        personaId: 'investor',
        data: {
            name: 'David Nakamura',
            budget: '1,200,000',
            targetLocations: 'Dublin, Pleasanton',
            targetTimeline: 'ASAP',
            homeType: 'SINGLE_FAMILY',
            personaProfile: 'Investor',
            chapter01: 'I\'m a 42-year-old software architect building a rental portfolio. I already own two properties in the East Bay and I\'m looking for a third acquisition with ADU potential.',
            chapter02: 'This is a pure investment — I won\'t be living here. The property needs to be tenant-ready or close to it, with positive cash flow from day one.',
            chapter03: 'Must: lot 6,000+ sq ft for ADU, 3+ bed 2+ bath, functional kitchen and updated baths, single-story. Avoid: anything requiring major renovation or in flood zones.',
            chapter04: 'Proximity to BART or the ACE train is a plus for rental demand. I want a city with straightforward ADU permitting.',
            chapter05: '3–5 year hold, then reassess. Target cap rate above 5%. I can go all-cash under $1M, conventional financing above.',
            selectedAnchors: ['ADU Potential', 'High ROI Potential', 'Single Story', 'Large Backyard'],
        },
    },
    {
        personaId: 'multi-gen',
        data: {
            name: 'The Patel Family',
            budget: '2,800,000',
            targetLocations: 'Pleasanton, Dublin',
            targetTimeline: 'Q2 2026',
            homeType: 'SINGLE_FAMILY',
            personaProfile: 'First-Time',
            chapter01: 'We are a multi-generational family — a couple in our late 40s with two teenagers, plus my elderly parents who are moving from India to live with us permanently.',
            chapter02: 'We share big family meals every Sunday. My parents need ground-floor living with easy access. I work from home as a consultant; my wife runs a catering business and needs a serious kitchen.',
            chapter03: 'Must: 5+ bedrooms, ground-floor in-law suite with private bath, large kitchen with commercial ventilation, 3-car garage. Avoid: stairs for elderly parents, newer build before 2000.',
            chapter04: 'Good schools for our teenagers and Vastu-compliant orientation are important. We need open living areas for gatherings of 20 or more.',
            chapter05: 'This is a forever home. We expect my parents to live with us indefinitely. Accessibility features and a separate living space for them are essential long-term.',
            selectedAnchors: ['Multi-Gen Living', 'Modern Kitchen', 'Top-Rated Schools', 'Vastu / Good Orientation', 'Large Backyard'],
        },
    },
    {
        personaId: 'solo',
        data: {
            name: 'Sophia Martinez',
            budget: '850,000',
            targetLocations: 'Dublin, Pleasanton',
            targetTimeline: 'Q1 2026',
            homeType: 'CONDO',
            personaProfile: 'First-Time',
            chapter01: 'I\'m a 27-year-old product marketing manager at Google. I\'m single with a golden retriever, and this is my first time buying. Pre-approved with 15% down.',
            chapter02: 'Early bird — run with the dog, grab coffee at a café, head to Sunnyvale three days a week. Evenings are cooking, yoga, and friends nearby.',
            chapter03: 'Must: 2+ bedrooms, modern finishes, in-unit laundry, small patio or yard for the dog. Avoid: high HOAs (over $400/mo), unsafe streets at night, long commutes.',
            chapter04: 'Walking distance to restaurants, coffee shops, and a dog park is essential. A strong sense of community matters — I want to know my neighbors.',
            chapter05: 'Planning to stay 3–5 years, then reassess. This is my starter home, not forever. I want to build equity while I\'m young.',
            selectedAnchors: ['Walking Distance to Coffee', 'Pet-Friendly Parks', 'Natural Light / Open Plan', 'Tech Commute Access'],
        },
    },
    {
        personaId: 'luxury',
        data: {
            name: 'James & Catherine Whitfield',
            budget: '4,500,000',
            targetLocations: 'Pleasanton, Dublin',
            targetTimeline: 'Q3 2026',
            homeType: 'SINGLE_FAMILY',
            personaProfile: 'Past Client',
            chapter01: 'We are a couple in our 50s with grown children. I\'m a retired CFO and Catherine runs a boutique interior design firm. We\'re ready for our forever home — architecturally significant, with a sense of arrival.',
            chapter02: 'Leisurely mornings on the terrace, golf twice a week, hosting monthly dinner parties for 8–12 guests. Wine is our passion — we have a 400-bottle collection that needs a proper home.',
            chapter03: 'Must: wine cellar, chef\'s kitchen with Wolf/Sub-Zero, infinity pool, 4,000+ sq ft, art studio. Avoid: McMansions, major renovations, lack of privacy.',
            chapter04: 'Views are our top criterion — East Bay hills or Mt. Diablo. Privacy and a gated setting are essential. Close to a good golf course.',
            chapter05: 'This is an all-cash forever purchase. We want turnkey luxury with room to entertain for decades. No major work — our next chapter starts the day we move in.',
            selectedAnchors: ['Private / Gated', 'Pool Ready', 'Gourmet Grocery Access', 'Modern Kitchen', 'Sustainable Architecture'],
        },
    },
    {
        personaId: 'climate',
        data: {
            name: 'Erik & Sunita Johansson',
            budget: '1,900,000',
            targetLocations: 'Pleasanton, Dublin',
            targetTimeline: 'Q2 2026',
            homeType: 'SINGLE_FAMILY',
            personaProfile: 'Relocation',
            chapter01: 'Relocating from Seattle — both late 30s with a toddler. I\'m a climate scientist at Lawrence Livermore and Sunita is a sustainability consultant who works remotely.',
            chapter02: 'We bike commute when possible, keep a home office surrounded by plants, grow our own food in raised beds, and drive an EV needing Level 2 charging.',
            chapter03: 'Must: solar panels, energy-efficient HVAC, dual-pane windows, large yard for raised beds. Avoid: high wildfire risk zones, south-facing slopes, gas-only appliances.',
            chapter04: 'Bikeable streets with trails nearby are important. We want daycare and good schools within the neighborhood. South-facing orientation ideal.',
            chapter05: 'Planning to be here 10+ years as our daughter grows up. We want a neighborhood that values sustainability and where she can grow up outdoors.',
            selectedAnchors: ['Low Wildfire Risk', 'Sustainable Architecture', 'Large Backyard', 'Pet-Friendly Parks', 'Natural Light / Open Plan'],
        },
    },
    {
        personaId: 'retreat',
        data: {
            name: 'Michael Torres',
            budget: '1,100,000',
            targetLocations: 'Pleasanton, Dublin',
            targetTimeline: 'Just Browsing',
            homeType: 'SINGLE_FAMILY',
            personaProfile: 'Investor',
            chapter01: 'I\'m a 45-year-old VP of Engineering and I own a condo in San Jose. Looking for a weekend property in wine country close enough for every weekend.',
            chapter02: 'Friday evenings with wine on the porch at sunset, Saturday mornings exploring local wineries. Amateur winemaker — would love space for a small crush pad.',
            chapter03: 'Must: 2–3 bedrooms, outdoor living with pergola and fire pit, land with trees. Avoid: subdivision feel, HOA that restricts rentals.',
            chapter04: 'Rustic-modern style with exposed beams, stone fireplace, wide plank floors. Real privacy — not a backyard neighbor situation. Wine-adjacent vibes essential.',
            chapter05: 'Would consider using it as a short-term rental when not in use. If it performs well, I might hold it long-term. Within 90 minutes of San Jose is the hard limit.',
            selectedAnchors: ['Quiet Streets', 'Private / Gated', 'Natural Light / Open Plan', 'High ROI Potential'],
        },
    },
    {
        personaId: 'restart',
        data: {
            name: 'Kevin Park',
            budget: '1,050,000',
            targetLocations: 'Dublin, Pleasanton',
            targetTimeline: 'ASAP',
            homeType: 'SINGLE_FAMILY',
            personaProfile: 'First-Time',
            chapter01: 'I\'m a 38-year-old software engineer going through a divorce. I have two kids (ages 8 and 11) on 50/50 custody and need a real home for them — somewhere they feel settled.',
            chapter02: 'I work remotely at Meta. When kids are here, mornings are school drop-off. My son games, my daughter does arts and crafts — separate rooms matter.',
            chapter03: 'Must: 3+ bedrooms, move-in ready, open kitchen/living, yard for kids. Avoid: same school district conflict with ex — must stay in Dublin or Pleasanton Unified.',
            chapter04: 'Parks and after-school activities nearby. I want a neighborhood where the kids can ride bikes and feel safe. Proximity to their activities is key.',
            chapter05: 'Need to move within 60 days. Long-term I\'d like to stay in the school district. This isn\'t my forever home but it needs to feel like one for my kids.',
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
        targetTimeline: '',
        homeType: 'SINGLE_FAMILY',
        personaProfile: '',
        chapter01: '',
        chapter02: '',
        chapter03: '',
        chapter04: '',
        chapter05: '',
        selectedAnchors: [],
        customAnchor: '',
    });

    const [synthesizing, setSynthesizing] = useState(false);
    const [saved, setSaved] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [showExamples, setShowExamples] = useState(true);
    const [showAnchors, setShowAnchors] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
    const [history, setHistory] = useState<{ story: string; timestamp: any }[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [activePersona, setActivePersona] = useState<string | null>(null);

    const realtorId = useMemo(() => getRealtorIdFromHost(), []);

    const loadExample = (ex: ExampleStory) => {
        setData(prev => ({
            ...prev,
            ...ex.data,
            email: prev.email,
            phone: prev.phone,
            preferredMethod: prev.preferredMethod,
            customAnchor: '',
        }));
        setActivePersona(ex.personaId);
        setSaved(false);
    };

    React.useEffect(() => {
        const user = auth?.currentUser;
        if (user?.email && realtorId) {
            findLeadByEmailOrPhone(realtorId, user.email).then(lead => {
                if (lead) {
                    const l = lead as any;
                    setData(prev => ({
                        ...prev,
                        name: lead.fullName || prev.name,
                        email: lead.email || prev.email,
                        phone: lead.phone || prev.phone,
                        budget: lead.financialVitals?.budgetMax || prev.budget,
                        targetLocations: lead.searchCriteria?.locations || prev.targetLocations,
                        targetTimeline: l.searchCriteria?.targetTimeline || prev.targetTimeline,
                        personaProfile: lead.personaProfile || prev.personaProfile,
                        chapter01: l.storyChapters?.chapter01 || '',
                        chapter02: l.storyChapters?.chapter02 || '',
                        chapter03: l.storyChapters?.chapter03 || '',
                        chapter04: l.storyChapters?.chapter04 || '',
                        chapter05: l.storyChapters?.chapter05 || '',
                        selectedAnchors: l.leadInfo?.atmosphericAnchors || prev.selectedAnchors,
                    }));
                    if (l.motivationHistory) setHistory(l.motivationHistory);
                }
            });
        }
    }, [realtorId]);

    const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

    const CHAPTER_KEYS = ['chapter01', 'chapter02', 'chapter03', 'chapter04', 'chapter05'] as const;

    const update = useCallback(<K extends keyof StoryIntakeData>(key: K, value: StoryIntakeData[K]) => {
        if (CHAPTER_KEYS.includes(key as any)) {
            const words = (value as string).trim().split(/\s+/).filter(Boolean);
            if (words.length > 50) {
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
        setData(prev => ({ ...prev, selectedAnchors: [...prev.selectedAnchors, trimmed], customAnchor: '' }));
    };

    const fullStory = [data.chapter01, data.chapter02, data.chapter03, data.chapter04, data.chapter05]
        .filter(Boolean).join('\n\n');

    const syntheticClient = {
        id: null,
        realtorId,
        firstName: data.name.split(' ')[0] || '',
        lastName: data.name.split(' ').slice(1).join(' ') || '',
        email: data.email,
        phone: data.phone,
        primaryContact: { email: data.email, phone: data.phone, preferredMethod: data.preferredMethod },
        financialVitals: { budgetMax: data.budget.replace(/[^0-9]/g, ''), preApprovalStatus: false, isAllCash: false },
        searchCriteria: {
            locations: data.targetLocations,
            targetTimeline: data.targetTimeline,
            personaProfile: data.personaProfile,
            mustHaves: [data.chapter01, data.chapter03].filter(Boolean).join('\n'),
            dealBreakers: '',
        },
        leadInfo: { customerMessage: fullStory },
        motivation: data.chapter02,
    };

    const totalWords = fullStory.split(/\s+/).filter(Boolean).length;
    const isReady = fullStory.length > 30 || data.selectedAnchors.length > 0;
    const chaptersCompleted = CHAPTER_KEYS.filter(k => wordCount(data[k]) >= 5).length;

    const handleSaveToProfile = async () => {
        if (!data.email && !data.phone) {
            setSaveFeedback('Please provide at least email or phone to save your profile.');
            return;
        }
        setSynthesizing(true);
        setSaveFeedback(null);
        try {
            const result = await upsertStoryLead(realtorId, { ...data, story: fullStory });
            if (result) {
                setSaveFeedback(result.action === 'updated' ? 'Profile updated successfully' : 'Profile saved successfully');
                setSaved(true);
            }
        } catch (err) {
            console.error('[StoryIntake] Failed to save profile:', err);
            setSaveFeedback('Error saving profile. Please try again.');
        } finally {
            setSynthesizing(false);
        }
    };

    const handleDiscover = async () => {
        if (!isReady) return;
        setSynthesizing(false);
        setSaved(false);

        const cities = data.targetLocations.split(',').map(c => c.trim()).filter(Boolean);
        const anchors = data.selectedAnchors;
        const storyWithTags = anchors.length > 0
            ? `${fullStory}\n\nBudget: $${data.budget}\nImportant priorities: ${anchors.join(', ')}.`
            : `${fullStory}\n\nBudget: $${data.budget}`;

        if (onStoryDiscover && cities.length > 0) {
            onStoryDiscover(storyWithTags, cities, {
                personaProfile: data.personaProfile || undefined,
                whoYouAre: data.chapter01 || undefined,
                dailyRituals: data.chapter02 || undefined,
                dreamSpace: data.chapter03 || undefined,
                whatElseMatters: [data.chapter04, data.chapter05].filter(Boolean).join('\n') || undefined,
                selectedAnchors: data.selectedAnchors.length > 0 ? data.selectedAnchors : undefined,
                homeType: data.homeType || undefined,
            });
        }

        onMatchRequest?.(fullStory, {
            budgetMin: '',
            budgetMax: data.budget.replace(/[^0-9]/g, ''),
            beds: '',
            baths: '',
        });
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <>
            <div style={{ fontFamily: 'var(--font-sans, Inter, -apple-system, sans-serif)', maxWidth: '1200px', margin: '0 auto', padding: '0 32px 80px', width: '100%', boxSizing: 'border-box' }}>

                {/* ── Hero ── */}
                <div style={{ paddingTop: 32 }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #1a1330 0%, #2d1b5e 50%, #4338CA 100%)',
                        color: '#fff', borderRadius: 22, padding: '40px 44px', marginBottom: 28,
                        position: 'relative', overflow: 'hidden',
                    }}>
                        <div style={{ position: 'absolute', top: -120, right: -100, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.35), transparent 70%)', pointerEvents: 'none' }}></div>
                        <div style={{ position: 'absolute', bottom: -60, left: 240, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,114,182,0.18), transparent 70%)', pointerEvents: 'none' }}></div>
                        <div style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    fontSize: 10.5, letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase',
                                    background: 'rgba(167,139,250,0.18)', color: '#c7b8ff',
                                    padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(167,139,250,0.3)',
                                }}>✦ AI-powered</span>
                                <span style={{ fontSize: 10.5, letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase', color: '#a78bfa' }}>Step 1 of 2 · Tell us your story</span>
                            </div>
                            <h1 style={{
                                fontFamily: 'var(--font-serif, "Instrument Serif", Georgia, serif)',
                                fontSize: 52, lineHeight: 1.04, margin: '0 0 14px',
                                fontWeight: 400, letterSpacing: '-0.025em', maxWidth: 880,
                            }}>
                                Tell us your story.<br />
                                We'll find the <em style={{ fontStyle: 'italic', color: '#c7b8ff' }}>home that fits.</em>
                            </h1>
                            <p style={{ fontSize: 15.5, color: 'rgba(255,255,255,0.78)', lineHeight: 1.55, maxWidth: 720, margin: 0 }}>
                                Describe your life — your household, your rituals, your must-haves —
                                and our AI will surface homes scored to <em style={{ fontStyle: 'italic', color: '#fff' }}>your</em> definition of fit, not a generic algorithm.
                            </p>

                        </div>
                    </div>
                </div>

                {/* ── Persona starters ── */}
                <div style={{ paddingBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 14 }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: ACCENT, padding: '2px 7px', borderRadius: 4, background: ACCENT_SOFT, fontWeight: 700 }}>★</span>
                                <span style={{ fontSize: 10.5, letterSpacing: '0.18em', fontWeight: 700, color: ACCENT, textTransform: 'uppercase' }}>Quick start · pick a story</span>
                            </div>
                            <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 21, color: '#1a1330', letterSpacing: '-0.01em', fontWeight: 500 }}>
                                Sound like someone? <em style={{ fontStyle: 'italic', color: ACCENT }}>Tap to auto-fill</em> — then edit.
                            </div>
                        </div>
                        <button
                            onClick={() => setShowExamples(s => !s)}
                            style={{
                                background: 'transparent', border: '1px solid oklch(91% 0.01 260)',
                                borderRadius: 999, padding: '7px 14px', fontSize: 11.5,
                                color: 'oklch(40% 0.02 260)', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                            }}
                        >{showExamples ? '▴ Hide examples' : '▾ Show examples'}</button>
                    </div>

                    {showExamples && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                            {STORY_PERSONAS.map(p => {
                                const isActive = activePersona === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            const ex = EXAMPLE_STORIES.find(e => e.personaId === p.id);
                                            if (ex) loadExample(ex);
                                        }}
                                        style={{
                                            background: isActive ? p.tint : '#fff',
                                            border: isActive ? `1.5px solid ${p.ink}` : '1px solid oklch(91% 0.01 260)',
                                            borderRadius: 12, padding: 14, cursor: 'pointer', textAlign: 'left',
                                            display: 'flex', flexDirection: 'column', gap: 8,
                                            boxShadow: isActive ? `0 0 0 4px ${p.tint}` : 'none',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <div style={{
                                            width: 30, height: 30, borderRadius: 8, background: p.tint, color: p.ink,
                                            display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 700,
                                        }}>{p.icon}</div>
                                        <div>
                                            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1a1330', letterSpacing: '-0.01em', marginBottom: 3 }}>{p.name}</div>
                                            <div style={{ fontSize: 10.5, color: 'oklch(58% 0.015 260)', lineHeight: 1.4 }}>{p.sub}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Main grid ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>

                    {/* Left column */}
                    <div style={{ position: 'sticky', top: 20, alignSelf: 'flex-start' }}>

                        {/* Profile card */}
                        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid oklch(91% 0.01 260)', padding: 20, marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid oklch(91% 0.01 260)' }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 10, background: ACCENT_SOFT, color: ACCENT,
                                    display: 'grid', placeItems: 'center', fontSize: 16,
                                }}>◑</div>
                                <div>
                                    <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 18, color: '#1a1330', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.1 }}>Your profile</div>
                                    <div style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>Step 1 · Contact</div>
                                </div>
                            </div>

                            {/* Full name */}
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>
                                    {isRealtor ? 'Client Name' : 'Full Name'}
                                </div>
                                <input
                                    type="text"
                                    value={data.name}
                                    onChange={e => update('name', e.target.value)}
                                    placeholder={isRealtor ? 'e.g. Eleanor & James Vance' : 'e.g. Alexander Sterling'}
                                    style={{
                                        width: '100%', padding: '9px 12px', background: 'oklch(96.5% 0.006 80)',
                                        border: '1px solid oklch(91% 0.01 260)', borderRadius: 8,
                                        fontSize: 13, color: '#1a1330', outline: 'none', boxSizing: 'border-box',
                                        fontFamily: 'inherit',
                                    }}
                                />
                            </div>

                            {/* Email */}
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <div style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700 }}>Email</div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9.5, letterSpacing: '0.12em', color: ACCENT, textTransform: 'uppercase', fontWeight: 700 }}>
                                        <input type="checkbox" checked={data.preferredMethod === 'Email'} onChange={() => update('preferredMethod', 'Email')}
                                            style={{ width: 11, height: 11, accentColor: ACCENT }} />
                                        Preferred
                                    </label>
                                </div>
                                <input
                                    type="email"
                                    value={data.email}
                                    onChange={e => update('email', e.target.value)}
                                    placeholder="e.g. alex@example.com"
                                    style={{
                                        width: '100%', padding: '9px 12px', background: 'oklch(96.5% 0.006 80)',
                                        border: '1px solid oklch(91% 0.01 260)', borderRadius: 8,
                                        fontSize: 13, color: '#1a1330', outline: 'none', boxSizing: 'border-box',
                                        fontFamily: 'inherit',
                                    }}
                                />
                            </div>

                            {/* Phone */}
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <div style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700 }}>Phone</div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9.5, letterSpacing: '0.12em', color: ACCENT, textTransform: 'uppercase', fontWeight: 700 }}>
                                        <input type="checkbox" checked={data.preferredMethod === 'Phone'} onChange={() => update('preferredMethod', 'Phone')}
                                            style={{ width: 11, height: 11, accentColor: ACCENT }} />
                                        Preferred
                                    </label>
                                </div>
                                <input
                                    type="tel"
                                    value={data.phone}
                                    onChange={e => update('phone', e.target.value)}
                                    placeholder="e.g. (555) 000-0000"
                                    style={{
                                        width: '100%', padding: '9px 12px', background: 'oklch(96.5% 0.006 80)',
                                        border: '1px solid oklch(91% 0.01 260)', borderRadius: 8,
                                        fontSize: 13, color: '#1a1330', outline: 'none', boxSizing: 'border-box',
                                        fontFamily: 'inherit',
                                    }}
                                />
                            </div>

                            {/* Budget */}
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>Budget preference</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'oklch(96.5% 0.006 80)', border: '1px solid oklch(91% 0.01 260)', borderRadius: 8, padding: '9px 12px' }}>
                                    <span style={{ fontSize: 13, color: 'oklch(58% 0.015 260)', fontWeight: 600 }}>$</span>
                                    <input
                                        type="text"
                                        value={data.budget}
                                        onChange={e => update('budget', e.target.value)}
                                        placeholder="1,800,000"
                                        style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 13, color: '#1a1330', outline: 'none', fontFamily: 'inherit' }}
                                    />
                                </div>
                            </div>

                            {/* Target locations */}
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>Target locations</div>
                                <input
                                    type="text"
                                    value={data.targetLocations}
                                    onChange={e => update('targetLocations', e.target.value)}
                                    placeholder="e.g. Pleasanton, Dublin, San Ramon"
                                    style={{
                                        width: '100%', padding: '9px 12px', background: 'oklch(96.5% 0.006 80)',
                                        border: '1px solid oklch(91% 0.01 260)', borderRadius: 8,
                                        fontSize: 13, color: '#1a1330', outline: 'none', boxSizing: 'border-box',
                                        fontFamily: 'inherit',
                                    }}
                                />
                            </div>

                            {/* Move-in window */}
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>Move-in window</div>
                                <input
                                    type="text"
                                    value={data.targetTimeline}
                                    onChange={e => update('targetTimeline', e.target.value)}
                                    placeholder="e.g. Q2 2026"
                                    style={{
                                        width: '100%', padding: '9px 12px', background: 'oklch(96.5% 0.006 80)',
                                        border: '1px solid oklch(91% 0.01 260)', borderRadius: 8,
                                        fontSize: 13, color: '#1a1330', outline: 'none', boxSizing: 'border-box',
                                        fontFamily: 'inherit',
                                    }}
                                />
                            </div>

                            {/* Privacy note */}
                            <div style={{ padding: 12, background: ACCENT_SOFT, borderRadius: 10, fontSize: 11.5, color: ACCENT, lineHeight: 1.55 }}>
                                <strong>🔒 Private.</strong> Only your matched agent sees this. We never sell or share contact info.
                            </div>

                            <button
                                onClick={() => setEditModalOpen(true)}
                                style={{
                                    marginTop: 12, background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: 11.5, color: ACCENT, fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 5,
                                }}
                            >
                                <i className="fa-solid fa-pen-to-square" style={{ fontSize: 10 }}></i>
                                Add more details
                            </button>
                        </div>

                        {/* Progress card */}
                        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid oklch(91% 0.01 260)', padding: 18 }}>
                            <div style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>Story progress</div>
                            {CHAPTERS.map((ch, i) => {
                                const wc = wordCount(data[ch.key]);
                                const done = wc >= 5;
                                return (
                                    <div key={ch.num} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                        <div style={{
                                            width: 22, height: 22, borderRadius: 99,
                                            background: done ? ACCENT : 'oklch(96.5% 0.006 80)',
                                            color: done ? '#fff' : 'oklch(58% 0.015 260)',
                                            display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700,
                                            border: '1px solid ' + (done ? ACCENT : 'oklch(91% 0.01 260)'),
                                            flexShrink: 0,
                                        }}>{done ? '✓' : ch.num}</div>
                                        <div style={{ fontSize: 12.5, color: done ? '#1a1330' : 'oklch(58% 0.015 260)', fontWeight: done ? 600 : 500, flex: 1 }}>{ch.label}</div>
                                        {wc > 0 && !done && <div style={{ fontSize: 9.5, color: 'oklch(58% 0.015 260)', fontFamily: 'var(--font-mono, monospace)' }}>{wc}w</div>}
                                    </div>
                                );
                            })}
                            {chaptersCompleted > 0 && (
                                <div style={{ marginTop: 12, height: 4, background: 'oklch(91% 0.01 260)', borderRadius: 999, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: ACCENT, borderRadius: 999, width: `${(chaptersCompleted / 5) * 100}%`, transition: 'width 0.4s' }}></div>
                                </div>
                            )}
                        </div>

                        {/* Realtor synthesize button */}
                        {isRealtor && (
                            <button
                                onClick={handleDiscover}
                                disabled={synthesizing || !isReady}
                                style={{
                                    marginTop: 14, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    padding: '12px 20px', background: ACCENT_600, color: '#fff', border: 'none', borderRadius: 12,
                                    fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
                                    opacity: (synthesizing || !isReady) ? 0.4 : 1,
                                }}
                            >
                                {synthesizing ? <><i className="fa-solid fa-spinner fa-spin"></i>Running match…</> : <><i className="fa-solid fa-bolt"></i>Synthesize Match</>}
                            </button>
                        )}
                    </div>

                    {/* Right column: chapters + anchors + submit */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                        {CHAPTERS.map((ch, i) => {
                            const value = data[ch.key];
                            const wc = wordCount(value);
                            const hasContent = wc > 0;
                            const nearLimit = wc >= 40 && wc < 50;
                            const atLimit = wc >= 50;
                            return (
                                <div key={ch.num} style={{
                                    background: '#fff', borderRadius: 16, border: '1px solid oklch(91% 0.01 260)',
                                    padding: 24, position: 'relative', overflow: 'hidden',
                                }}>
                                    {/* Left accent bar */}
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: 4, bottom: 0, background: ACCENT, borderRadius: '16px 0 0 16px' }}></div>

                                    {/* Header row */}
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
                                        <div style={{
                                            fontFamily: 'var(--font-serif, Georgia, serif)',
                                            fontSize: 38, fontWeight: 400, color: ACCENT,
                                            letterSpacing: '-0.02em', lineHeight: 1, minWidth: 56, paddingTop: 2,
                                        }}>{ch.num}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 10.5, letterSpacing: '0.18em', color: ACCENT, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{ch.label}</div>
                                            <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 19, color: '#1a1330', letterSpacing: '-0.01em', lineHeight: 1.3, fontWeight: 500 }}>
                                                {ch.title}
                                            </div>
                                        </div>
                                        <button style={{
                                            background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}40`, borderRadius: 999,
                                            padding: '6px 12px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em',
                                            textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0,
                                            display: 'inline-flex', alignItems: 'center', gap: 5,
                                        }}>✦ AI hint</button>
                                    </div>

                                    {/* Textarea */}
                                    <div style={{ position: 'relative' }}>
                                        <textarea
                                            value={value}
                                            onChange={e => update(ch.key, e.target.value)}
                                            placeholder={ch.placeholder}
                                            rows={4}
                                            style={{
                                                width: '100%', padding: '14px 14px 32px', boxSizing: 'border-box',
                                                background: hasContent ? '#fff' : 'oklch(96.5% 0.006 80)',
                                                border: `1px solid ${atLimit ? '#f59e0b' : hasContent ? ACCENT + '40' : 'oklch(91% 0.01 260)'}`,
                                                borderRadius: 10, resize: 'none',
                                                fontSize: 13.5, lineHeight: 1.6,
                                                color: hasContent ? '#1a1330' : 'oklch(72% 0.01 260)',
                                                fontStyle: hasContent ? 'normal' : 'italic',
                                                outline: 'none', fontFamily: 'inherit',
                                            }}
                                        />
                                        <div style={{
                                            position: 'absolute', bottom: 8, right: 10,
                                            fontSize: 9.5, letterSpacing: '0.12em',
                                            color: atLimit ? '#ef4444' : nearLimit ? '#f59e0b' : 'oklch(58% 0.015 260)',
                                            fontWeight: 700, textTransform: 'uppercase',
                                            background: '#fff', padding: '2px 7px', borderRadius: 4,
                                            border: '1px solid oklch(91% 0.01 260)',
                                        }}>{wc}/50 words</div>
                                    </div>

                                    {/* Inline example chips */}
                                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700 }}>Try one:</span>
                                        {ch.examples.map((ex, j) => (
                                            <span
                                                key={j}
                                                onClick={() => update(ch.key, ex)}
                                                style={{
                                                    fontSize: 11, color: ACCENT, background: ACCENT_SOFT,
                                                    padding: '4px 10px', borderRadius: 999, border: `1px solid ${ACCENT}20`,
                                                    cursor: 'pointer', fontWeight: 600,
                                                }}
                                            >{ex}</span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Atmospheric anchors (collapsible) */}
                        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid oklch(91% 0.01 260)', overflow: 'hidden' }}>
                            <button
                                onClick={() => setShowAnchors(s => !s)}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 10.5, letterSpacing: '0.18em', color: ACCENT, textTransform: 'uppercase', fontWeight: 700 }}>Atmospheric anchors</span>
                                    {data.selectedAnchors.length > 0 && (
                                        <span style={{ background: ACCENT, color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{data.selectedAnchors.length}</span>
                                    )}
                                </div>
                                <span style={{ fontSize: 11, color: 'oklch(58% 0.015 260)', fontWeight: 600 }}>{showAnchors ? '▴ Collapse' : '▾ Add tags'}</span>
                            </button>

                            {showAnchors && (
                                <div style={{ padding: '0 20px 20px' }}>
                                    <p style={{ fontSize: 11.5, color: 'oklch(58% 0.015 260)', marginTop: 0, marginBottom: 14 }}>
                                        Quick-select lifestyle priorities that matter to you.
                                    </p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {ATMOSPHERIC_ANCHORS.map(anchor => {
                                            const sel = data.selectedAnchors.includes(anchor);
                                            return (
                                                <button
                                                    key={anchor}
                                                    onClick={() => toggleAnchor(anchor)}
                                                    style={{
                                                        padding: '6px 14px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                                                        background: sel ? '#1a1330' : '#fff',
                                                        color: sel ? '#fff' : 'oklch(40% 0.02 260)',
                                                        border: `1px solid ${sel ? '#1a1330' : 'oklch(91% 0.01 260)'}`,
                                                        transition: 'all 0.12s',
                                                    }}
                                                >{anchor}</button>
                                            );
                                        })}
                                        {data.selectedAnchors.filter(a => !ATMOSPHERIC_ANCHORS.includes(a)).map(a => (
                                            <button
                                                key={a}
                                                onClick={() => toggleAnchor(a)}
                                                style={{
                                                    padding: '6px 14px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                                                    background: ACCENT, color: '#fff', border: `1px solid ${ACCENT}`,
                                                }}
                                            >{a}</button>
                                        ))}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px dashed oklch(91% 0.01 260)', borderRadius: 999, padding: '5px 12px' }}>
                                            <input
                                                type="text"
                                                value={data.customAnchor}
                                                onChange={e => update('customAnchor', e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomAnchor(); } }}
                                                placeholder="Add your own…"
                                                style={{ background: 'transparent', border: 'none', fontSize: 11.5, color: 'oklch(40% 0.02 260)', outline: 'none', width: 110, fontFamily: 'inherit' }}
                                            />
                                            {data.customAnchor.trim() && (
                                                <button
                                                    onClick={addCustomAnchor}
                                                    style={{ padding: '2px 8px', background: '#1a1330', color: '#fff', border: 'none', borderRadius: 999, fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
                                                >+</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Submit ribbon */}
                        <div style={{
                            marginTop: 8,
                            background: 'linear-gradient(135deg, #4338CA 0%, #7c3aed 100%)',
                            borderRadius: 16, padding: 24, color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
                        }}>
                            <div>
                                <div style={{ fontSize: 10.5, letterSpacing: '0.18em', fontWeight: 700, color: '#c7b8ff', textTransform: 'uppercase', marginBottom: 6 }}>Step 2 · Let AI work</div>
                                <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.25 }}>
                                    Ready when you are. We'll match <em style={{ fontStyle: 'italic' }}>your</em> story to homes in ~30 seconds.
                                </div>
                                {saveFeedback && (
                                    <div style={{ marginTop: 8, fontSize: 11.5, color: saveFeedback.includes('Error') || saveFeedback.includes('Please') ? '#fca5a5' : '#a7f3d0' }}>
                                        {saveFeedback}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                                <button
                                    onClick={handleDiscover}
                                    disabled={synthesizing || !isReady}
                                    style={{
                                        background: '#fff', color: ACCENT_600, border: 'none', borderRadius: 999,
                                        padding: '14px 26px', fontSize: 12, fontWeight: 800, letterSpacing: '0.14em',
                                        textTransform: 'uppercase', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
                                        opacity: (synthesizing || !isReady) ? 0.5 : 1,
                                        transition: 'opacity 0.15s',
                                    }}
                                >
                                    {synthesizing
                                        ? <><i className="fa-solid fa-spinner fa-spin"></i>Finding homes…</>
                                        : <>✦ Find my homes <span>→</span></>
                                    }
                                </button>
                                <button
                                    onClick={handleSaveToProfile}
                                    disabled={synthesizing || (!data.email && !data.phone)}
                                    style={{
                                        background: 'rgba(255,255,255,0.12)', color: '#fff',
                                        border: '1px solid rgba(255,255,255,0.25)', borderRadius: 999,
                                        padding: '9px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                                        textTransform: 'uppercase', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        opacity: (synthesizing || (!data.email && !data.phone)) ? 0.4 : 1,
                                    }}
                                >
                                    <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: 10 }}></i>
                                    {saved ? 'Saved ✓' : 'Save to Profile'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Story history ── */}
                {history.length > 0 && (
                    <div style={{ paddingTop: 40, borderTop: '1px solid oklch(91% 0.01 260)', marginTop: 40 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: ACCENT_SOFT, display: 'grid', placeItems: 'center', color: ACCENT, fontSize: 14 }}>
                                    <i className="fa-solid fa-clock-rotate-left"></i>
                                </div>
                                <div>
                                    <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 20, fontWeight: 500, color: '#1a1330' }}>Story History</div>
                                    <div style={{ fontSize: 10, letterSpacing: '0.14em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700 }}>Evolution of your vision</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                style={{
                                    padding: '7px 14px', background: '#fff', border: '1px solid oklch(91% 0.01 260)',
                                    borderRadius: 10, fontSize: 10.5, fontWeight: 700, color: 'oklch(58% 0.015 260)',
                                    textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer',
                                }}
                            >{showHistory ? 'Collapse' : `View ${history.length} versions`}</button>
                        </div>
                        {showHistory && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {history.map((h, i) => (
                                    <div key={i} style={{ background: '#fff', border: '1px solid oklch(91% 0.01 260)', borderRadius: 14, padding: 20 }}>
                                        <div style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>
                                            {(() => { const d = h.timestamp?.toDate ? h.timestamp.toDate() : new Date(h.timestamp); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); })()}
                                        </div>
                                        <div style={{ fontSize: 13, color: 'oklch(40% 0.02 260)', lineHeight: 1.6 }}>{h.story}</div>
                                        <button
                                            onClick={() => {
                                                update('chapter01', '');
                                                update('chapter02', h.story);
                                                update('chapter03', '');
                                                update('chapter04', '');
                                                update('chapter05', '');
                                            }}
                                            style={{
                                                marginTop: 12, background: 'none', border: 'none', cursor: 'pointer',
                                                fontSize: 10.5, color: ACCENT, fontWeight: 700, letterSpacing: '0.1em',
                                                textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6, padding: 0,
                                            }}
                                        >
                                            <i className="fa-solid fa-reply-all" style={{ fontSize: 10 }}></i>
                                            Restore this version
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>{/* max-width wrapper */}

            <ClientEditModal
                client={syntheticClient}
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                onSave={async (updates) => {
                    if (updates.firstName || updates.lastName) update('name', [updates.firstName, updates.lastName].filter(Boolean).join(' '));
                    if ((updates as any).financialVitals?.budgetMax) update('budget', String((updates as any).financialVitals.budgetMax));
                    if ((updates as any).searchCriteria?.locations) update('targetLocations', (updates as any).searchCriteria.locations);
                    if ((updates as any).searchCriteria?.targetTimeline) update('targetTimeline', (updates as any).searchCriteria.targetTimeline);
                    if ((updates as any).searchCriteria?.personaProfile) update('personaProfile', (updates as any).searchCriteria.personaProfile);
                    if (updates.email) update('email', updates.email);
                    if (updates.phone) update('phone', updates.phone);
                    if ((updates as any).primaryContact?.preferredMethod) update('preferredMethod', (updates as any).primaryContact.preferredMethod);
                    setEditModalOpen(false);
                }}
            />
        </>
    );
};

export default StoryIntakeTab;
