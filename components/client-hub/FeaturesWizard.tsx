import React, { useState, useCallback } from 'react';
import { tagsByZone, type TagZone } from '../../utils/propertyTaxonomy';

// ─── Design tokens (match StoryIntakeTab) ─────────────────────────────────────

const ACCENT = '#4F46E5';
const ACCENT_600 = '#4338CA';
const ACCENT_SOFT = '#EEF0FF';

// ─── Zone definitions ─────────────────────────────────────────────────────────

interface Zone {
    id: string;
    num: string;
    label: string;
    question: string;
    placeholder: string;
    contextTags: string[];
    taxonomyZone: TagZone;
}

// UI metadata only — chips come directly from the taxonomy
const ZONES: Zone[] = [
    {
        id: 'zone1', num: '01', label: 'First Impression',
        question: 'Describe the architecture, entry experience, and curb appeal that makes you stop in your tracks.',
        placeholder: 'A Victorian with a dramatic foyer, statement door with designer hardware, and mature trees lining the stone pathway…',
        contextTags: ['Architecture', 'Style', 'Curb appeal', 'Entry', 'Facade', 'Lighting'],
        taxonomyZone: 'architecture_entry',
    },
    {
        id: 'zone2', num: '02', label: 'Culinary Space',
        question: 'Walk us through your ideal kitchen. How do you cook, gather, and entertain?',
        placeholder: 'An open-concept layout with a waterfall island, Sub-Zero appliances, and a walk-in pantry…',
        contextTags: ['Kitchen', 'Appliances', 'Surfaces', 'Flow', 'Layout'],
        taxonomyZone: 'culinary',
    },
    {
        id: 'zone3', num: '03', label: 'Living & Entertaining',
        question: 'Describe your living areas and bonus spaces. How do you relax or host guests?',
        placeholder: 'Vaulted ceilings, a statement fireplace, floor-to-ceiling windows, and a dedicated home theater…',
        contextTags: ['Living room', 'Entertaining', 'Bonus rooms', 'Views', 'Smart home'],
        taxonomyZone: 'living_entertaining',
    },
    {
        id: 'zone4', num: '04', label: 'Primary Sanctuary',
        question: 'Describe your ideal primary suite. How does it feel to wake up and unwind there?',
        placeholder: 'A king-size suite with a seating area, private balcony, and a boutique walk-in closet…',
        contextTags: ['Primary suite', 'Bedroom', 'Closet', 'Storage', 'Privacy'],
        taxonomyZone: 'primary_sanctuary',
    },
    {
        id: 'zone5', num: '05', label: 'Shower & Wellness',
        question: 'What features make up your perfect spa bathroom and wellness areas?',
        placeholder: 'A steam shower, freestanding soaking tub, heated floors, and a home gym…',
        contextTags: ['Bathroom', 'Spa', 'Wellness', 'Finishes', 'Fixtures'],
        taxonomyZone: 'shower_wellness',
    },
    {
        id: 'zone6', num: '06', label: 'Outdoor Oasis',
        question: 'Paint a picture of your outdoor life. What does your ideal backyard look, feel, and function like?',
        placeholder: 'A resort-style infinity pool, outdoor kitchen with a fire pit, and a fully secluded yard with lush landscaping…',
        contextTags: ['Backyard', 'Pool', 'Landscaping', 'Outdoor kitchen', 'Entertaining', 'Views'],
        taxonomyZone: 'outdoor_grounds',
    },
];

const TOTAL_STEPS = 6; // 6 zones

// ─── State ────────────────────────────────────────────────────────────────────

interface WizardData {
    zone1: string;
    zone2: string;
    zone3: string;
    zone4: string;
    zone5: string;
    zone6: string;
    ownerName: string;
    phone: string;
    email: string;
    preferredMethod: 'Phone' | 'Email' | '';
    budget: string;
    targetLocations: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

// ─── Tag selection state ──────────────────────────────────────────────────────

type TagState = 'nice_to_have' | 'must_have';

// ─── Component ────────────────────────────────────────────────────────────────

export const FeaturesWizard: React.FC = () => {
    const [data, setData] = useState<WizardData>({
        zone1: '', zone2: '', zone3: '', zone4: '', zone5: '', zone6: '',
        ownerName: '', phone: '', email: '', preferredMethod: '', budget: '', targetLocations: '',
    });
    // tagId → 'nice_to_have' | 'must_have'
    const [tagStates, setTagStates] = useState<Record<string, TagState>>({});
    // pending single-click timer per tag (to distinguish single vs double click)
    const clickTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const [currentStep, setCurrentStep] = useState(0);
    const [slideDir, setSlideDir] = useState<'forward' | 'back'>('forward');
    const [animKey, setAnimKey] = useState(0);

    const goToStep = useCallback((step: number, dir: 'forward' | 'back') => {
        if (step < 0 || step >= TOTAL_STEPS) return;
        setSlideDir(dir);
        setAnimKey(k => k + 1);
        setCurrentStep(step);
    }, []);

    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Enter' || e.shiftKey) return;
            if (e.target instanceof HTMLTextAreaElement) return;
            if (e.target instanceof HTMLInputElement) return;
            if (currentStep < TOTAL_STEPS - 1) goToStep(currentStep + 1, 'forward');
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [currentStep, goToStep]);

    // Clean up timers on unmount
    React.useEffect(() => {
        return () => { Object.values(clickTimers.current).forEach(clearTimeout); };
    }, []);

    const update = useCallback((key: keyof WizardData, value: string) => {
        setData(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleTagClick = useCallback((tagId: string) => {
        // If a double-click timer is already pending for this tag, this is the 2nd click — cancel
        // the single-click timer and upgrade to must_have
        if (clickTimers.current[tagId]) {
            clearTimeout(clickTimers.current[tagId]);
            delete clickTimers.current[tagId];
            setTagStates(prev => {
                const next = { ...prev };
                if (prev[tagId] === 'must_have') {
                    delete next[tagId]; // double-click on must_have → deselect
                } else {
                    next[tagId] = 'must_have';
                }
                return next;
            });
            return;
        }
        // First click — wait 250ms to see if a second click comes
        clickTimers.current[tagId] = setTimeout(() => {
            delete clickTimers.current[tagId];
            setTagStates(prev => {
                const next = { ...prev };
                if (prev[tagId] === 'nice_to_have') {
                    delete next[tagId]; // single-click on nice_to_have → deselect
                } else if (prev[tagId] === 'must_have') {
                    next[tagId] = 'nice_to_have'; // single-click on must_have → downgrade
                } else {
                    next[tagId] = 'nice_to_have';
                }
                return next;
            });
        }, 250);
    }, []);

    const currentZone = currentStep < TOTAL_STEPS ? ZONES[currentStep] : null;
    const nextLabel = currentStep < TOTAL_STEPS - 1 ? ZONES[currentStep + 1].label : null;

    return (
        <>
            <style>{`
                @keyframes wizardSlideFromRight {
                    from { opacity: 0; transform: translateX(56px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                @keyframes wizardSlideFromLeft {
                    from { opacity: 0; transform: translateX(-56px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
            `}</style>

            <div style={{ fontFamily: 'var(--font-sans, Inter, -apple-system, sans-serif)', maxWidth: '1200px', margin: '0 auto', padding: '0 32px 80px', width: '100%', boxSizing: 'border-box' }}>

                {/* ── Two-column grid ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, paddingTop: 32 }}>

                    {/* ── Left: Profile + Progress ── */}
                    <div style={{ position: 'sticky', top: 20, alignSelf: 'flex-start' }}>

                        {/* Profile card */}
                        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid oklch(91% 0.01 260)', padding: 20, marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid oklch(91% 0.01 260)' }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: ACCENT_SOFT, color: ACCENT, display: 'grid', placeItems: 'center', fontSize: 16 }}>◑</div>
                                <div>
                                    <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 18, color: '#1a1330', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.1 }}>Profile.</div>
                                    <div style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>Step 1 · Contact</div>
                                </div>
                            </div>

                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>Full Name</div>
                                <input
                                    type="text" value={data.ownerName} onChange={e => update('ownerName', e.target.value)}
                                    placeholder="e.g. Alexander Sterling"
                                    style={{ width: '100%', padding: '9px 12px', background: 'oklch(96.5% 0.006 80)', border: '1px solid oklch(91% 0.01 260)', borderRadius: 8, fontSize: 13, color: '#1a1330', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                />
                            </div>

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
                                    type="tel" value={data.phone} onChange={e => update('phone', e.target.value)}
                                    placeholder="e.g. (555) 000-0000"
                                    style={{ width: '100%', padding: '9px 12px', background: 'oklch(96.5% 0.006 80)', border: '1px solid oklch(91% 0.01 260)', borderRadius: 8, fontSize: 13, color: '#1a1330', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                />
                            </div>

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
                                    type="email" value={data.email} onChange={e => update('email', e.target.value)}
                                    placeholder="e.g. alex@example.com"
                                    style={{ width: '100%', padding: '9px 12px', background: 'oklch(96.5% 0.006 80)', border: '1px solid oklch(91% 0.01 260)', borderRadius: 8, fontSize: 13, color: '#1a1330', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                />
                            </div>

                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>Budget Preference</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'oklch(96.5% 0.006 80)', border: '1px solid oklch(91% 0.01 260)', borderRadius: 8, padding: '9px 12px' }}>
                                    <span style={{ fontSize: 13, color: 'oklch(58% 0.015 260)', fontWeight: 600 }}>$</span>
                                    <input
                                        type="text" value={data.budget} onChange={e => update('budget', e.target.value)}
                                        placeholder="1,800,000"
                                        style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 13, color: '#1a1330', outline: 'none', fontFamily: 'inherit' }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>Target Locations</div>
                                <input
                                    type="text" value={data.targetLocations} onChange={e => update('targetLocations', e.target.value)}
                                    placeholder="e.g. Pleasanton, Dublin, San Ramon"
                                    style={{ width: '100%', padding: '9px 12px', background: 'oklch(96.5% 0.006 80)', border: '1px solid oklch(91% 0.01 260)', borderRadius: 8, fontSize: 13, color: '#1a1330', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                />
                            </div>

                            <div style={{ padding: 12, background: ACCENT_SOFT, borderRadius: 10, fontSize: 11.5, color: ACCENT, lineHeight: 1.55 }}>
                                <strong>🔒 Private.</strong> Only your matched agent sees this. We never sell or share contact info.
                            </div>

                            <button
                                style={{
                                    marginTop: 12, background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: 11.5, color: ACCENT, fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 5,
                                }}
                            >
                                <i className="fa-solid fa-pen-to-square" style={{ fontSize: 10 }}></i>
                                Add more details
                            </button>
                        </div>

                        {/* Zone progress */}
                        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid oklch(91% 0.01 260)', padding: '18px 12px' }}>
                            <div style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 12, paddingLeft: 6 }}>Vision Progress</div>
                            {ZONES.map((z, i) => ({ label: z.label, key: z.id, i })).map(item => {
                                const isActive = currentStep === item.i;
                                const done = wordCount(data[item.key as keyof WizardData]) >= 3;
                                return (
                                    <button
                                        key={item.i}
                                        onClick={() => goToStep(item.i, item.i > currentStep ? 'forward' : 'back')}
                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', width: '100%', background: isActive ? ACCENT_SOFT : 'transparent', border: 'none', borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', marginBottom: 2 }}
                                    >
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: isActive ? '#3b82f6' : done ? ACCENT : 'transparent', border: done || isActive ? 'none' : '1.5px solid oklch(80% 0.01 260)', boxShadow: isActive ? '0 0 8px rgba(59,130,246,0.4)' : 'none' }} />
                                        <div style={{ fontSize: 12.5, color: isActive ? ACCENT : done ? '#1a1330' : 'oklch(58% 0.015 260)', fontWeight: done || isActive ? 700 : 500, flex: 1 }}>{item.label}</div>
                                        {done && !isActive && <i className="fa-solid fa-check" style={{ fontSize: 9, color: ACCENT, opacity: 0.7 }}></i>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Right: Step nav + animated card + nav ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                        {/* Step indicator */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, padding: '4px 0 8px' }}>
                            {ZONES.map(z => z.label).map((label, i) => {
                                const isActive = i === currentStep;
                                const isComplete = i < currentStep;
                                return (
                                    <React.Fragment key={i}>
                                        <button
                                            onClick={() => goToStep(i, i > currentStep ? 'forward' : 'back')}
                                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}
                                        >
                                            <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, transition: 'all 0.2s', background: isActive || isComplete ? ACCENT : '#fff', color: isActive || isComplete ? '#fff' : 'oklch(58% 0.015 260)', border: `1.5px solid ${isActive || isComplete ? ACCENT : 'oklch(88% 0.01 260)'}`, boxShadow: isActive ? `0 0 0 3px ${ACCENT}22` : 'none' }}>
                                                {isComplete ? '✓' : i + 1}
                                            </div>
                                            <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 500, maxWidth: 68, textAlign: 'center', lineHeight: 1.3, color: isActive ? ACCENT : isComplete ? 'oklch(45% 0.02 260)' : 'oklch(65% 0.01 260)', whiteSpace: 'normal' }}>
                                                {label}
                                            </span>
                                        </button>
                                        {i < ZONES.length - 1 && (
                                            <div style={{ flex: 1, height: 1.5, marginTop: 12, background: i < currentStep ? ACCENT : 'oklch(90% 0.01 260)', transition: 'background 0.3s' }} />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            <div style={{ marginLeft: 'auto', flexShrink: 0, paddingLeft: 12, paddingTop: 2 }}>
                                <span style={{ fontSize: 9.5, letterSpacing: '0.16em', fontWeight: 700, color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                    Q {currentStep + 1} / {TOTAL_STEPS}
                                </span>
                            </div>
                        </div>

                        {/* Animated card */}
                        <div key={animKey} style={{ animation: `${slideDir === 'forward' ? 'wizardSlideFromRight' : 'wizardSlideFromLeft'} 0.32s cubic-bezier(0.25,0.46,0.45,0.94) both` }}>
                            {currentZone && (() => {
                                const zone = currentZone;
                                const zoneKey = zone.id as keyof WizardData;
                                const value = data[zoneKey];
                                const wc = wordCount(value);
                                const hasContent = wc > 0;
                                const atLimit = wc >= 50;
                                const nearLimit = wc >= 40 && wc < 50;
                                return (
                                    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid oklch(91% 0.01 260)', overflow: 'hidden' }}>
                                        {/* Dark header */}
                                        <div style={{ background: 'linear-gradient(135deg, #1a1330 0%, #2d1b5e 100%)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                            <span style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 28, fontWeight: 400, color: '#a78bfa', letterSpacing: '-0.02em', lineHeight: 1, flexShrink: 0 }}>{zone.num}</span>
                                            <span style={{ fontSize: 10.5, letterSpacing: '0.2em', fontWeight: 700, color: '#c7b8ff', textTransform: 'uppercase' }}>{zone.label}</span>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 4 }}>
                                                {zone.contextTags.map(tag => (
                                                    <span key={tag} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.9)', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)', padding: '2px 8px', borderRadius: 4 }}>{tag}</span>
                                                ))}
                                                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(244,114,182,0.9)', background: 'rgba(244,114,182,0.1)', border: '1px solid rgba(244,114,182,0.2)', padding: '2px 8px', borderRadius: 4 }}>+ AI hint</span>
                                            </div>
                                        </div>

                                        {/* Body */}
                                        <div style={{ padding: 24 }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
                                                <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 20, color: '#1a1330', letterSpacing: '-0.01em', lineHeight: 1.35, fontWeight: 500 }}>
                                                    {zone.question}
                                                </div>
                                                <button
                                                    onClick={() => update(zoneKey, '')}
                                                    title="Clear"
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', opacity: 0.35, padding: '4px 6px', borderRadius: 8, flexShrink: 0, transition: 'all 0.15s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = '#fee2e2'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.35'; e.currentTarget.style.background = 'none'; }}
                                                >
                                                    <i className="fa-solid fa-trash-can" />
                                                </button>
                                            </div>

                                            <div style={{ position: 'relative' }}>
                                                <textarea
                                                    value={value}
                                                    onChange={e => update(zoneKey, e.target.value)}
                                                    placeholder={zone.placeholder}
                                                    rows={5}
                                                    autoFocus
                                                    style={{ width: '100%', padding: '14px 14px 36px', boxSizing: 'border-box', background: '#fff', border: `1px solid ${atLimit ? '#f59e0b' : hasContent ? ACCENT + '40' : 'oklch(91% 0.01 260)'}`, borderRadius: 10, resize: 'none', fontSize: 14, lineHeight: 1.65, color: '#1a1330', outline: 'none', fontFamily: 'inherit' }}
                                                />
                                                <div style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 9.5, letterSpacing: '0.12em', color: atLimit ? '#ef4444' : nearLimit ? '#f59e0b' : 'oklch(58% 0.015 260)', fontWeight: 700, textTransform: 'uppercase', background: '#fff', padding: '2px 7px', borderRadius: 4, border: '1px solid oklch(91% 0.01 260)' }}>
                                                    {wc}/50 words
                                                </div>
                                            </div>
                                            {/* Tag Selection Row */}
                                            <div style={{ marginTop: 18 }}>
                                                <div style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>Select features to target:</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 10px' }}>
                                                    {tagsByZone(zone.taxonomyZone).map(tag => {
                                                        const tagState = tagStates[tag.id];
                                                        const isMust = tagState === 'must_have';
                                                        const isNice = tagState === 'nice_to_have';
                                                        return (
                                                            <span
                                                                key={tag.id}
                                                                onClick={() => handleTagClick(tag.id)}
                                                                title="Click = nice to have · Double-click = must have"
                                                                style={{
                                                                    fontSize: 11, fontWeight: 600, padding: '4px 10px',
                                                                    borderRadius: 999, cursor: 'pointer',
                                                                    userSelect: 'none', transition: 'all 0.15s',
                                                                    ...(isMust ? {
                                                                        background: ACCENT, color: '#fff',
                                                                        border: `1px solid ${ACCENT}`,
                                                                        boxShadow: `0 0 0 3px ${ACCENT}33`,
                                                                    } : isNice ? {
                                                                        background: ACCENT_SOFT, color: ACCENT,
                                                                        border: `1.5px solid ${ACCENT}60`,
                                                                    } : {
                                                                        background: '#fff', color: 'oklch(45% 0.015 260)',
                                                                        border: '1px solid oklch(88% 0.01 260)',
                                                                    }),
                                                                }}
                                                            >
                                                                {isMust && <span style={{ marginRight: 4, fontSize: 9 }}>★</span>}
                                                                {tag.label}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, color: 'oklch(55% 0.01 260)' }}>
                                                    <span style={{ background: ACCENT_SOFT, color: ACCENT, padding: '2px 8px', borderRadius: 4, border: `1px solid ${ACCENT}30`, fontWeight: 600 }}>Click</span>
                                                    <span>Nice to have</span>
                                                    <span style={{ marginLeft: 8, background: ACCENT, color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>★ Double-click</span>
                                                    <span>Must have</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Prev / Next navigation */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
                            <button
                                onClick={() => goToStep(currentStep - 1, 'back')}
                                disabled={currentStep === 0}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 999, background: '#fff', border: '1px solid oklch(91% 0.01 260)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'oklch(40% 0.02 260)', cursor: currentStep === 0 ? 'default' : 'pointer', opacity: currentStep === 0 ? 0.3 : 1, transition: 'opacity 0.15s' }}
                            >← Previous</button>

                            <span style={{ flex: 1, fontSize: 10.5, color: 'oklch(65% 0.01 260)', textAlign: 'center' }}>
                                Press Enter or click Next to continue
                            </span>

                            {currentStep < TOTAL_STEPS - 1 ? (
                                <button
                                    onClick={() => goToStep(currentStep + 1, 'forward')}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 999, background: ACCENT, border: 'none', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff', cursor: 'pointer', boxShadow: `0 4px 14px ${ACCENT}44` }}
                                >Next · {nextLabel} →</button>
                            ) : (
                                <button
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 999, background: '#1a1330', border: 'none', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff', cursor: 'pointer' }}
                                >
                                    <i className="fa-solid fa-wand-magic-sparkles"></i> Save My Vision
                                </button>
                            )}
                        </div>

                        {/* Bottom CTA */}
                        <div style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #6D28D9 100%)', borderRadius: 16, padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', marginBottom: 8 }}>Step 2 · Let AI Work</div>
                                <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 26, color: '#fff', fontWeight: 400, lineHeight: 1.25 }}>
                                    Ready when you are. We'll match <em style={{ fontStyle: 'italic', color: '#c7b8ff' }}>your vision</em> to homes.
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <button style={{ padding: '12px 24px', background: '#fff', color: ACCENT_600, borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    ✦ Find My Homes →
                                </button>
                                <button style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: 999, border: '1px solid rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    ☁ Save to Profile
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </>
    );
};

export default FeaturesWizard;
