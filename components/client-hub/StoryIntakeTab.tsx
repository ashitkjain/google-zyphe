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
        examples: [
            { label: 'Growing family, outgrown rental', value: "We\'re a growing family with two young kids — both parents working in tech, outgrowing our rental, and ready for a real backyard and top schools." },
            { label: 'Empty nesters downsizing', value: "Our kids have moved out and we\'re ready to downsize to something single-story, low-maintenance, and easy to lock up when we travel." },
            { label: 'First-time buyer, single professional', value: "I\'m a first-time buyer in my late 20s — single, working in tech, tired of renting, and finally ready to put down roots." },
            { label: 'Relocating from SF / the city', value: "We\'re relocating from San Francisco — trading a small condo for space, a real yard, a quieter neighborhood, and better schools." },
            { label: 'Dual-income couple, no kids yet', value: "We\'re a dual-income couple in our early 30s with no kids yet, but buying for the long term — right schools, room to grow." },
            { label: 'Multi-gen family, parents moving in', value: "We\'re a multi-generational household — my elderly parents are moving in permanently and need ground-floor living with their own entrance." },
            { label: 'Remote worker, lifestyle-first move', value: "I work fully remotely and have real flexibility. This move is about quality of life — neighborhood, outdoor access, and a home that inspires me." },
            { label: 'Retired couple, aging in place', value: "We\'re in our early 60s looking for a forever home — single story, accessible layout, close to good medical care and the grandkids." },
            { label: 'Investor, not living here', value: "This is a pure investment decision — looking for strong rental income potential, ADU upside, and low deferred maintenance." },
            { label: 'Divorced parent, fresh chapter', value: "I\'m starting over after a divorce with two kids on 50/50 custody. I need stability — move-in ready, great school district, a neighborhood where they can feel settled." },
            { label: 'Upsizing from a starter home', value: "We bought our first home five years ago and have completely outgrown it. Two more kids later, we need more bedrooms, a bigger kitchen, and a real garage." },
            { label: 'Relocating for a new job', value: "I just accepted a new role and need to relocate within 60 days. I\'m prioritizing a quick close, low maintenance, and a neighborhood I can grow into." },
            { label: 'Returning from abroad', value: "We\'re moving back to California after several years overseas — re-establishing roots, finding the right school district, and settling somewhere we can stay for a decade." },
            { label: 'Buying with aging parents in mind', value: "We don\'t need them on-site yet, but our parents are in their 70s — a layout that could accommodate them later (or an ADU) is part of our long-term thinking." },
            { label: 'Tech equity event, ready to buy', value: "A liquidity event at work just made buying realistic for the first time. We\'re shifting from renting in the city to a long-term home in the suburbs." },
            { label: 'Newlyweds, planning a family soon', value: "We just got married and are buying our first home together. We\'re not parents yet but planning to be in the next year or two — buying for that future, not just today." },
            { label: 'High-income, lifestyle-driven', value: "Income isn\'t the constraint — fit is. We want a home that reflects how we live: design-forward, in a community that matches our values." },
            { label: 'Cultural fit & community matters', value: "Being near our cultural community — temple, grocery, language schools, family friends — is a real factor in where we want to land." },
        ],
        key: 'chapter01' as const,
    },
    {
        num: '02', label: 'Daily rituals & lifestyle', icon: '☼',
        title: 'Walk us through your day. Where do you drink your morning coffee? Do you need a dedicated workspace?',
        placeholder: 'I start my day with a quiet espresso looking over a garden… I work from home three days a week and need absolute silence for calls…',
        examples: [
            { label: 'WFH full-time, need a real office', value: "I work from home full-time and need a true, door-closing office — not a nook or a desk in the bedroom. Daily video calls are non-negotiable." },
            { label: 'Hybrid, commute 2–3 days/week', value: "I commute to the office 2–3 days a week, so being within 30–40 minutes of the highway or BART really matters." },
            { label: 'Morning coffee in the garden', value: "My morning ritual is a quiet coffee outside — a patio, a garden view, or a covered porch with morning light is something I\'d use every single day." },
            { label: 'Cook together every evening', value: "We cook together most nights, so a spacious kitchen with a big island and room for two people moving around matters a lot." },
            { label: 'Kids homework at the kitchen island', value: "Our evenings are cooking while the kids do homework at the kitchen island — an open floor plan is essential for how we actually live." },
            { label: 'Weekend entertaining & hosting', value: "We host friends and family almost every weekend. Great indoor-outdoor flow, a big dining area, and a backyard that works for a crowd are high on the list." },
            { label: 'Dog needs a fenced yard', value: "We have a large dog who needs daily outdoor time — a securely fenced yard is a genuine requirement, not a nice-to-have." },
            { label: 'Evening wine on the patio', value: "Our favorite ritual is unwinding on the patio or porch at sunset. Outdoor living space gets used year-round here." },
            { label: 'Home gym or workout space', value: "I work out at home every morning — a garage that could double as a gym, or a bonus room with good ventilation, is high on my list." },
            { label: 'Early riser, quiet street matters', value: "I\'m up at 5:30 most mornings. A quiet, low-traffic street and a peaceful neighborhood rhythm matter more than I expected." },
            { label: "Kids' activities drive the schedule", value: "Our days revolve around kids' soccer, swim, and music lessons — proximity to parks, fields, and rec centers keeps life sane." },
            { label: 'Creative work from home', value: "I do creative work from home — writing, design, music — and I need a space that feels inspiring and is acoustically separate from the rest of the house." },
            { label: 'Avid gardener or outdoor cook', value: "I spend most of my free time outdoors — gardening, grilling, or just being outside. A great backyard is as important to me as the interior." },
            { label: 'Two home offices needed', value: "Both of us work from home full-time and take calls simultaneously — we genuinely need two separate, acoustically isolated office spaces." },
            { label: 'Big family meals & extended hosting', value: "Sunday dinners with extended family are sacred — we need a dining space that seats 10+ comfortably and a kitchen that can handle real cooking volume." },
            { label: 'Frequent travel, lock-and-leave', value: "We travel often for work and pleasure — low-maintenance landscaping, good security, and a home we can lock up for weeks at a time really matter." },
            { label: 'Music, hobby, or maker space', value: "I need a dedicated space for my hobby — a music room, workshop, or studio that\'s separate enough that the rest of the house isn\'t affected." },
            { label: 'Walk to coffee, school, errands', value: "Our ideal day starts with walking the kids to school and grabbing coffee on the way home. Walkability isn\'t a nice-to-have — it\'s how we want to live." },
            { label: 'Indoor-outdoor flow is the lifestyle', value: "Sliding doors, a covered patio, an outdoor kitchen — we live with the doors open most of the year and want a home built for that." },
            { label: 'Quiet evenings, no noise tolerance', value: "Evenings are for reading, music, and winding down. A quiet street, low ambient noise, and good interior sound isolation matter a lot to us." },
        ],
        key: 'chapter02' as const,
    },
    {
        num: '03', label: 'Must-haves & deal-breakers', icon: '✓',
        title: 'What\'s non-negotiable? What would immediately disqualify a home for you?',
        placeholder: 'Must: 4+ beds, two-car garage, walk to top elementary. Avoid: north-facing backyards, busy roads, anything needing a major remodel…',
        examples: [
            { label: 'Must: 4+ bedrooms', value: "Must have at least 4 bedrooms — two kids each need their own room, and a dedicated home office is non-negotiable." },
            { label: 'Must: closed-door home office', value: "A dedicated, door-closing home office is a hard requirement. I have client calls all day and can\'t work in an open-plan space." },
            { label: 'Must: flat, usable backyard', value: "The backyard has to be flat and genuinely usable — no steep slopes or landscaping that makes it unusable for kids or a table and chairs." },
            { label: 'Must: top-rated elementary school', value: "We need to be in a top-rated elementary school district. This is the single biggest driver of where we\'re looking." },
            { label: 'Must: 2-car garage', value: "Two-car garage minimum — we have two cars plus bikes, gear, and storage needs that a one-car or tandem just can\'t handle." },
            { label: 'Must: single-story layout', value: "Single story only. My parents are moving in, and stairs are not an option for them now or in the coming years." },
            { label: 'Must: ADU or guest unit', value: "We need either an existing ADU, guest house, or a lot large enough to build one. It\'s either for rental income or for family." },
            { label: 'Must: pool or pool-ready lot', value: "Either an existing pool, or a large, south-facing lot where we could add one. This is a genuine priority for our lifestyle." },
            { label: 'Must: EV charging or large garage', value: "We drive EVs and need either existing Level 2 charging or a garage with panel capacity to add it." },
            { label: 'Avoid: busy or arterial road', value: "A home on a busy arterial road is a hard no — noise, safety for kids, and the overall feel of the neighborhood all suffer." },
            { label: 'Avoid: major renovation needed', value: "We don\'t have the time, bandwidth, or extra budget for a major renovation. Move-in ready, or very close to it." },
            { label: 'Avoid: HOA over $200/month', value: "High HOA fees are a dealbreaker — anything over $200/month, or with overly restrictive rules about rentals or modifications." },
            { label: 'Avoid: high fire or flood risk', value: "We will not buy in a high fire risk zone or FEMA flood zone — insurance costs and long-term safety matter too much." },
            { label: 'Avoid: north-facing backyard', value: "North-facing backyards get almost no sun — we\'ve learned our lesson and are filtering those out entirely." },
            { label: 'Avoid: deferred maintenance', value: "A home with obvious deferred maintenance — aging roof, old HVAC, outdated electrical — is something we want to avoid entirely." },
            { label: 'Must: walk to top middle/high school', value: "Walking distance to a top-rated middle or high school is the single biggest filter for us — we want our kids walking, not being driven." },
            { label: 'Must: solar or sustainable build', value: "Existing solar, energy efficiency, and sustainable construction are real priorities — we want a low-carbon home, not a retrofit project." },
            { label: 'Must: low-maintenance landscaping', value: "Drought-tolerant, low-maintenance landscaping is a must — we don\'t want a lawn we have to manage every weekend." },
            { label: 'Must: good orientation / Vastu', value: "Orientation matters to us — we\'re looking for east-facing entrances and a home aligned with Vastu principles where possible." },
            { label: 'Avoid: pool (safety, maintenance)', value: "We do not want a pool — young kids, ongoing maintenance, and insurance implications make it a hard no for us right now." },
            { label: 'Avoid: power lines or cell tower', value: "Visible power lines, cell towers, or major infrastructure near the property is a no — both for aesthetics and long-term resale." },
            { label: 'Avoid: poor school district', value: "School district is a hard filter — anything outside the top-rated boundaries is off the list, regardless of how good the home looks." },
            { label: 'Avoid: short-term rental restrictions', value: "We want flexibility to do short- or medium-term rentals down the road — strict HOA or city limits on that are a deal-breaker." },
        ],
        key: 'chapter03' as const,
    },
    {
        num: '04', label: 'Core priorities', icon: '✧',
        title: 'If you can\'t get everything, what are the 2–3 things you absolutely won\'t compromise on?',
        placeholder: 'School quality and a safe neighborhood are non-negotiable. I also need a dedicated office space for work…',
        examples: [
            { label: 'Schools above everything', value: "School district quality is my #1 non-negotiable. I\'d take a smaller home, a longer commute, or a tighter budget to stay in the right district." },
            { label: 'Commute is the hard constraint', value: "Commute time is my hard constraint. I\'d rather have less house, less yard, and fewer bedrooms than add 30 minutes to my daily drive." },
            { label: 'Neighborhood feel over finishes', value: "The neighborhood character matters more than interior finishes. I can renovate a kitchen — I can\'t change what\'s outside my front door." },
            { label: 'Move-in ready beats size', value: "I\'ll take smaller and move-in ready over larger and needing work every time. We just don\'t have the bandwidth for a project." },
            { label: 'Outdoor space over interior size', value: "Outdoor space is a bigger priority than interior square footage. A great yard with a smaller house beats a big house with no yard." },
            { label: 'Quiet street is non-negotiable', value: "A quiet, safe street matters more to me than walkability or proximity to cafes. I\'ll happily drive to the grocery store." },
            { label: 'Natural light over everything else', value: "Natural light and good orientation are my top filters. A dark house is a dealbreaker — I\'d take smaller and brighter any day." },
            { label: 'ADU potential for long-term value', value: "ADU potential is a top priority — whether for rental income, a family member, or just long-term resale value." },
            { label: 'Stretch budget for the right home', value: "I\'d rather stretch the budget and buy the right long-term home than save money now and want to move again in three years." },
            { label: 'Privacy over proximity', value: "Privacy and buffer from neighbors matters more than being close to shops. I want to feel like I have my own space." },
            { label: 'Layout and flow over size', value: "A well-thought-out layout beats raw square footage for us — how the home feels and flows matters more than the listing number." },
            { label: 'Long-term appreciation over condition', value: "I\'m willing to buy something that needs cosmetic work if the location and lot have strong long-term appreciation potential." },
            { label: 'Walkability over square footage', value: "We\'d rather have a smaller home in a truly walkable neighborhood than more space somewhere we have to drive everywhere." },
            { label: 'Energy efficiency is a top filter', value: "Solar, efficient HVAC, and low utility costs are top filters — we want a home that\'s cheap to run, not just cheap to buy." },
            { label: 'Lot and land over the structure', value: "We\'re buying the land and location more than the house. We\'d take a tear-down on a great lot over a perfect home on a mediocre one." },
            { label: 'Community and neighbors matter most', value: "The kind of neighbors and community we\'ll be part of matters more than the specific home — we want a place that feels like a real neighborhood." },
            { label: 'Safety and low-crime first', value: "A genuinely safe street and low-crime area is the top filter — everything else is negotiable around that." },
            { label: 'Investment upside over comfort now', value: "We\'re willing to compromise on comfort or finishes today if the home has clear ADU, expansion, or appreciation upside." },
        ],
        key: 'chapter04' as const,
    },
    {
        num: '05', label: 'Readiness', icon: '↗',
        title: 'If you found the right home this week, what would you do? (Pick one)',
        placeholder: 'Select your current readiness level...',
        examples: [
            { label: 'Ready to offer now', value: 'Make an offer immediately (financing ready)' },
            { label: 'Pre-approved, actively looking', value: 'Pre-approved with a lender and actively touring — ready to move on the right home' },
            { label: 'Cash buyer, fast close', value: 'Cash buyer, prepared to close quickly with minimal contingencies' },
            { label: 'Ready in 1-2 months', value: 'Move forward within 1–2 months' },
            { label: 'Ready in 3-6 months', value: 'Targeting a 3–6 month timeline — getting financing and logistics aligned' },
            { label: 'Contingent on selling current home', value: 'Need to sell our current home first — would move fast on the right one if timing aligns' },
            { label: 'Lease ending, hard deadline', value: 'Our lease ends in the next few months — we have a real move-out deadline driving us' },
            { label: 'Spouse / partner needs to align', value: 'I\'m ready, but we make this decision together — partner needs to see and align before we move' },
            { label: 'Just exploring', value: 'Still exploring, not ready yet' }
        ],
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

// Per-chapter context chips shown in the card header
const CHAPTER_CONTEXT_TAGS = [
    ['Household', 'Life stage', 'Income tier', 'Family size', 'Work situation', 'Relocation', 'Multi-gen', 'First-time buyer', 'Investor', 'Remote / hybrid', 'Pets', 'Cultural fit'],
    ['Routines', 'Workspace', 'Lifestyle', 'Cooking & hosting', 'Outdoor living', 'Fitness', 'Commute', 'Kids activities', 'Quiet hours', 'Hobbies', 'Indoor-outdoor flow', 'Entertainment'],
    ['Must-haves', 'Deal-breakers', 'Bedrooms', 'Garage', 'Yard', 'School district', 'Single story', 'ADU', 'Pool', 'EV charging', 'HOA limits', 'Fire / flood risk', 'Move-in ready', 'Orientation'],
    ['Values', 'Trade-offs', 'Schools first', 'Commute first', 'Neighborhood feel', 'Outdoor space', 'Natural light', 'Privacy', 'Layout & flow', 'Long-term value', 'Budget stretch', 'Move-in ready', 'Walkability'],
    ['Timeline', 'Readiness', 'Financing', 'Pre-approval', 'Offer-ready', '1–2 months', '3–6 months', 'Just exploring', 'Contingent on sale', 'Cash buyer', 'Lease ending', 'Decision makers'],
];

const TOTAL_STEPS = 6; // 5 chapters + 1 anchors step

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
            chapter04: 'We prioritize school quality and safety above all else. We\'d take a slightly smaller backyard if it means being in the right neighborhood for our kids.',
            chapter05: 'Make an offer immediately (financing ready)',
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
            chapter04: 'Privacy and a quiet street are our top priorities. We would compromise on being close to shops if the home offers total peace and quiet.',
            chapter05: 'Move forward within 1–2 months',
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
            chapter04: 'Commute and natural light are non-negotiable. I\'d rather have less space than spend an extra hour driving every day.',
            chapter05: 'Make an offer immediately (financing ready)',
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
            chapter04: 'ROI and ADU potential are the only things that matter. I\'d compromise on almost anything else for the right numbers.',
            chapter05: 'Make an offer immediately (financing ready)',
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
            chapter04: 'Accessibility and the ground-floor suite are essential for my parents. We\'d stretch the budget for a home that fits everyone safely.',
            chapter05: 'Move forward within 1–2 months',
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
            chapter04: 'Walkability and being near a dog park are my top 2 priorities. I\'d take a smaller condo to stay close to the action.',
            chapter05: 'Make an offer immediately (financing ready)',
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
            chapter04: 'Privacy and the architectural significance are my non-negotiables. We\'d compromise on location if the home itself is a true masterpiece.',
            chapter05: 'Still exploring, not ready yet',
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
            chapter04: 'Sustainability features and yard space for our garden are our core priorities. We\'d compromise on finishes for a home with better energy efficiency.',
            chapter05: 'Move forward within 1–2 months',
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
            chapter04: 'Privacy and trees are what we need. I\'d take a smaller house if it means having no backyard neighbors and a real sense of seclusion.',
            chapter05: 'Still exploring, not ready yet',
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
        preferredMethod: 'Phone',
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
    const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
    const [history, setHistory] = useState<{ story: string; timestamp: any }[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [activePersona, setActivePersona] = useState<string | null>(null);

    // ── Stepped navigation ────────────────────────────────────────────────────
    const [currentStep, setCurrentStep] = useState(0);
    const [slideDir, setSlideDir]       = useState<'forward' | 'back'>('forward');
    const [animKey, setAnimKey]         = useState(0);

    const goToStep = useCallback((step: number, dir: 'forward' | 'back') => {
        if (step < 0 || step >= TOTAL_STEPS) return;
        setSlideDir(dir);
        setAnimKey(k => k + 1);
        setCurrentStep(step);
    }, []);

    // Enter key advances to next step (not when typing in textarea/input)
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
    // ─────────────────────────────────────────────────────────────────────────

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
        setCurrentStep(0);
        setAnimKey(k => k + 1);
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

    const currentChapter  = currentStep < 5 ? CHAPTERS[currentStep] : null;
    const nextChapterLabel = currentStep < 4 ? CHAPTERS[currentStep + 1].label
        : currentStep === 4 ? 'Anchors & Priorities'
        : null;
    const heroStepLabel = currentStep < 5
        ? `QUESTION ${currentStep + 1} OF 6 · ${CHAPTERS[currentStep].label.toUpperCase()}`
        : 'QUESTION 6 OF 6 · ANCHORS & PRIORITIES';

    return (
        <>
            <style>{`
                @keyframes storySlideFromRight {
                    from { opacity: 0; transform: translateX(56px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                @keyframes storySlideFromLeft {
                    from { opacity: 0; transform: translateX(-56px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
            `}</style>
            <div style={{ fontFamily: 'var(--font-sans, Inter, -apple-system, sans-serif)', maxWidth: '1200px', margin: '0 auto', padding: '0 32px 80px', width: '100%', boxSizing: 'border-box' }}>
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
                                    <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 18, color: '#1a1330', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.1 }}>Profile.</div>
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
                        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid oklch(91% 0.01 260)', padding: '18px 12px' }}>
                            <div style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 12, paddingLeft: 6 }}>Story progress</div>
                            {CHAPTERS.map((ch, i) => ({ ...ch, type: 'chapter', i })).map((item, i) => {
                                const isActive = currentStep === i;
                                const isChapter = item.type === 'chapter';
                                const wc = isChapter ? wordCount(data[(item as any).key]) : 0;
                                const done = isChapter ? wc >= 5 : data.selectedAnchors.length > 0;
                                return (
                                    <button 
                                        key={item.num} 
                                        onClick={() => goToStep(i, i > currentStep ? 'forward' : 'back')}
                                        style={{ 
                                            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', 
                                            width: '100%', background: isActive ? ACCENT_SOFT : 'transparent',
                                            border: 'none', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                                            transition: 'all 0.2s', marginBottom: 2
                                        }}
                                    >
                                        <div style={{
                                            width: 6, height: 6, borderRadius: '50%',
                                            background: isActive ? '#3b82f6' : 'transparent',
                                            flexShrink: 0,
                                            boxShadow: isActive ? '0 0 8px rgba(59, 130, 246, 0.4)' : 'none'
                                        }} />
                                        <div style={{ 
                                            fontSize: 12.5, 
                                            color: isActive ? ACCENT : done ? '#1a1330' : 'oklch(58% 0.015 260)', 
                                            fontWeight: (done || isActive) ? 700 : 500, 
                                            flex: 1 
                                        }}>{item.label}</div>
                                        {wc > 0 && !done && <div style={{ fontSize: 9.5, color: 'oklch(58% 0.015 260)', fontFamily: 'var(--font-mono, monospace)' }}>{wc}w</div>}
                                    </button>
                                );
                            })}
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

                    {/* Right column: stepped chapters + anchors + submit */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                        {/* ── Step indicator ── */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, padding: '4px 0 8px' }}>
                            {[...CHAPTERS.map((ch, i) => ({ label: ch.label, short: ch.label })), { label: 'Anchors & Priorities', short: 'Anchors' }].map((step, i) => {
                                const isActive   = i === currentStep;
                                const isComplete = i < currentStep;
                                return (
                                    <React.Fragment key={i}>
                                        <button
                                            onClick={() => goToStep(i, i > currentStep ? 'forward' : 'back')}
                                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}
                                        >
                                            <div style={{
                                                width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
                                                fontSize: 10, fontWeight: 700, transition: 'all 0.2s',
                                                background: isActive ? ACCENT : isComplete ? ACCENT : '#fff',
                                                color: isActive || isComplete ? '#fff' : 'oklch(58% 0.015 260)',
                                                border: `1.5px solid ${isActive || isComplete ? ACCENT : 'oklch(88% 0.01 260)'}`,
                                                boxShadow: isActive ? `0 0 0 3px ${ACCENT}22` : 'none',
                                            }}>
                                                {isComplete ? '✓' : i + 1}
                                            </div>
                                            <span style={{
                                                fontSize: 9, fontWeight: isActive ? 700 : 500, maxWidth: 68, textAlign: 'center', lineHeight: 1.3,
                                                color: isActive ? ACCENT : isComplete ? 'oklch(45% 0.02 260)' : 'oklch(65% 0.01 260)',
                                                whiteSpace: 'normal',
                                            }}>{step.short}</span>
                                        </button>
                                        {i < 5 && (
                                            <div style={{
                                                flex: 1, height: 1.5, marginTop: 12,
                                                background: i < currentStep ? ACCENT : 'oklch(90% 0.01 260)',
                                                transition: 'background 0.3s',
                                            }} />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            <div style={{ marginLeft: 'auto', flexShrink: 0, paddingLeft: 12, paddingTop: 2 }}>
                                <span style={{ fontSize: 9.5, letterSpacing: '0.16em', fontWeight: 700, color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                    Q {currentStep + 1} / 6
                                </span>
                            </div>
                        </div>

                        {/* ── Animated card ── */}
                        <div
                            key={animKey}
                            style={{
                                animation: `${slideDir === 'forward' ? 'storySlideFromRight' : 'storySlideFromLeft'} 0.32s cubic-bezier(0.25,0.46,0.45,0.94) both`,
                            }}
                        >
                            {currentStep < 5 && currentChapter ? (() => {
                                const ch   = currentChapter;
                                const value     = data[ch.key];
                                const wc        = wordCount(value);
                                const hasContent = wc > 0;
                                const nearLimit  = wc >= 40 && wc < 50;
                                const atLimit    = wc >= 50;
                                const tags       = CHAPTER_CONTEXT_TAGS[currentStep] ?? [];
                                return (
                                    <div style={{
                                        background: '#fff', borderRadius: 16, border: '1px solid oklch(91% 0.01 260)',
                                        overflow: 'hidden',
                                    }}>
                                        {/* Card header bar */}
                                        <div style={{
                                            background: 'linear-gradient(135deg, #1a1330 0%, #2d1b5e 100%)',
                                            padding: '16px 24px',
                                            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                                        }}>
                                            <span style={{
                                                fontFamily: 'var(--font-serif, Georgia, serif)',
                                                fontSize: 28, fontWeight: 400, color: '#a78bfa',
                                                letterSpacing: '-0.02em', lineHeight: 1, flexShrink: 0,
                                            }}>{ch.num}</span>
                                            <span style={{ fontSize: 10.5, letterSpacing: '0.2em', fontWeight: 700, color: '#c7b8ff', textTransform: 'uppercase' }}>{ch.label}</span>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 4 }}>
                                                {tags.map(tag => (
                                                    <span key={tag} style={{
                                                        fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
                                                        textTransform: 'uppercase', color: 'rgba(167,139,250,0.9)',
                                                        background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)',
                                                        padding: '2px 8px', borderRadius: 4,
                                                    }}>{tag}</span>
                                                ))}
                                                <span style={{
                                                    fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
                                                    textTransform: 'uppercase', color: 'rgba(244,114,182,0.9)',
                                                    background: 'rgba(244,114,182,0.1)', border: '1px solid rgba(244,114,182,0.2)',
                                                    padding: '2px 8px', borderRadius: 4,
                                                }}>+ AI hint</span>
                                            </div>
                                        </div>

                                        {/* Card body */}
                                        <div style={{ padding: 24 }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
                                                <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 20, color: '#1a1330', letterSpacing: '-0.01em', lineHeight: 1.35, fontWeight: 500 }}>
                                                    {ch.title}
                                                </div>
                                                <button
                                                    onClick={() => update(ch.key, '')}
                                                    title="Clear"
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', opacity: 0.35, padding: '4px 6px', borderRadius: 8, flexShrink: 0, transition: 'all 0.15s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = '#fee2e2'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.35'; e.currentTarget.style.background = 'none'; }}
                                                >
                                                    <i className="fa-solid fa-trash-can" />
                                                </button>
                                            </div>

                                            {ch.key === 'chapter05' ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                    {ch.examples.map((ex, j) => {
                                                        const isSelected = value === ex.value;
                                                        return (
                                                            <label key={j} style={{
                                                                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                                                                padding: '12px 16px', borderRadius: 10,
                                                                background: isSelected ? ACCENT_SOFT : '#fff',
                                                                border: `1px solid ${isSelected ? ACCENT + '40' : 'oklch(91% 0.01 260)'}`,
                                                                transition: 'all 0.2s',
                                                            }}>
                                                                <input
                                                                    type="radio" name={ch.key}
                                                                    checked={isSelected}
                                                                    onChange={() => update(ch.key, ex.value)}
                                                                    style={{ width: 16, height: 16, accentColor: ACCENT, cursor: 'pointer' }}
                                                                />
                                                                <span style={{ fontSize: 13.5, color: '#1a1330', fontWeight: isSelected ? 600 : 400 }}>{ex.value}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ position: 'relative' }}>
                                                        <textarea
                                                            value={value}
                                                            onChange={e => update(ch.key, e.target.value)}
                                                            placeholder={ch.placeholder}
                                                            rows={5}
                                                            autoFocus
                                                            style={{
                                                                width: '100%', padding: '14px 14px 36px', boxSizing: 'border-box',
                                                                background: '#fff',
                                                                border: `1px solid ${atLimit ? '#f59e0b' : hasContent ? ACCENT + '40' : 'oklch(91% 0.01 260)'}`,
                                                                borderRadius: 10, resize: 'none',
                                                                fontSize: 14, lineHeight: 1.65, color: '#1a1330',
                                                                outline: 'none', fontFamily: 'inherit',
                                                            }}
                                                        />
                                                        <div style={{
                                                            position: 'absolute', bottom: 10, right: 12,
                                                            fontSize: 9.5, letterSpacing: '0.12em',
                                                            color: atLimit ? '#ef4444' : nearLimit ? '#f59e0b' : 'oklch(58% 0.015 260)',
                                                            fontWeight: 700, textTransform: 'uppercase',
                                                            background: '#fff', padding: '2px 7px', borderRadius: 4,
                                                            border: '1px solid oklch(91% 0.01 260)',
                                                        }}>{wc}/50 words</div>
                                                    </div>
                                                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'oklch(58% 0.015 260)', textTransform: 'uppercase', fontWeight: 700 }}>Try one:</span>
                                                        {ch.examples.map((ex, j) => (
                                                            <span
                                                                key={j}
                                                                onClick={() => update(ch.key, data[ch.key] ? `${data[ch.key]} ${ex.value}` : ex.value)}
                                                                style={{
                                                                    fontSize: 11, color: ACCENT, background: ACCENT_SOFT,
                                                                    padding: '4px 10px', borderRadius: 999, border: `1px solid ${ACCENT}20`,
                                                                    cursor: 'pointer', fontWeight: 600,
                                                                }}
                                                            >{ex.label}</span>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })() : (
                                /* ── Anchors step ── */
                                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid oklch(91% 0.01 260)', overflow: 'hidden' }}>
                                    <div style={{
                                        background: 'linear-gradient(135deg, #1a1330 0%, #2d1b5e 100%)',
                                        padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12,
                                    }}>
                                        <span style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 28, fontWeight: 400, color: '#a78bfa', letterSpacing: '-0.02em' }}>06</span>
                                        <span style={{ fontSize: 10.5, letterSpacing: '0.2em', fontWeight: 700, color: '#c7b8ff', textTransform: 'uppercase' }}>Anchors & Priorities</span>
                                        {data.selectedAnchors.length > 0 && (
                                            <span style={{ background: ACCENT, color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 700, marginLeft: 4 }}>{data.selectedAnchors.length} selected</span>
                                        )}
                                    </div>
                                    <div style={{ padding: 24 }}>
                                        <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 20, color: '#1a1330', letterSpacing: '-0.01em', lineHeight: 1.35, fontWeight: 500, marginBottom: 6 }}>
                                            Quick-select lifestyle priorities that matter most.
                                        </div>
                                        <p style={{ fontSize: 12, color: 'oklch(58% 0.015 260)', marginTop: 0, marginBottom: 18 }}>
                                            These feed directly into your AI match score. Pick in priority order — #1 counts most.
                                        </p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {ATMOSPHERIC_ANCHORS.map(anchor => {
                                                const selIndex = data.selectedAnchors.indexOf(anchor);
                                                const sel = selIndex !== -1;
                                                return (
                                                    <button key={anchor} onClick={() => toggleAnchor(anchor)} style={{
                                                        padding: '7px 14px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                                                        background: sel ? '#1a1330' : '#fff',
                                                        color: sel ? '#fff' : 'oklch(40% 0.02 260)',
                                                        border: `1px solid ${sel ? '#1a1330' : 'oklch(91% 0.01 260)'}`,
                                                        transition: 'all 0.12s',
                                                        display: 'flex', alignItems: 'center', gap: 6,
                                                    }}>
                                                        {sel && <span style={{ opacity: 0.6, fontSize: 9 }}>#{selIndex + 1}</span>}
                                                        {anchor}
                                                    </button>
                                                );
                                            })}
                                            {data.selectedAnchors.filter(a => !ATMOSPHERIC_ANCHORS.includes(a)).map(a => {
                                                const selIndex = data.selectedAnchors.indexOf(a);
                                                return (
                                                    <button key={a} onClick={() => toggleAnchor(a)} style={{
                                                        padding: '7px 14px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                                                        background: ACCENT, color: '#fff', border: `1px solid ${ACCENT}`,
                                                        display: 'flex', alignItems: 'center', gap: 6,
                                                    }}>
                                                        <span style={{ opacity: 0.8, fontSize: 9 }}>#{selIndex + 1}</span>
                                                        {a}
                                                    </button>
                                                );
                                            })}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px dashed oklch(91% 0.01 260)', borderRadius: 999, padding: '6px 12px' }}>
                                                <input
                                                    type="text"
                                                    value={data.customAnchor}
                                                    onChange={e => update('customAnchor', e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomAnchor(); } }}
                                                    placeholder="Add your own…"
                                                    style={{ background: 'transparent', border: 'none', fontSize: 11.5, color: 'oklch(40% 0.02 260)', outline: 'none', width: 110, fontFamily: 'inherit' }}
                                                />
                                                {data.customAnchor.trim() && (
                                                    <button onClick={addCustomAnchor} style={{ padding: '2px 8px', background: '#1a1330', color: '#fff', border: 'none', borderRadius: 999, fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>+</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Prev / Next navigation ── */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
                            <button
                                onClick={() => goToStep(currentStep - 1, 'back')}
                                disabled={currentStep === 0}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '10px 18px', borderRadius: 999,
                                    background: '#fff', border: '1px solid oklch(91% 0.01 260)',
                                    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                                    color: 'oklch(40% 0.02 260)', cursor: currentStep === 0 ? 'default' : 'pointer',
                                    opacity: currentStep === 0 ? 0.3 : 1, transition: 'opacity 0.15s',
                                }}
                            >
                                ← Previous
                            </button>

                            <span style={{ flex: 1, fontSize: 10.5, color: 'oklch(65% 0.01 260)', textAlign: 'center' }}>
                                Press Enter or click Next to continue
                            </span>

                            {currentStep < TOTAL_STEPS - 1 ? (
                                <button
                                    onClick={() => goToStep(currentStep + 1, 'forward')}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '10px 20px', borderRadius: 999,
                                        background: ACCENT, border: 'none',
                                        fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                                        color: '#fff', cursor: 'pointer',
                                        boxShadow: `0 4px 14px ${ACCENT}44`,
                                    }}
                                >
                                    Next · {nextChapterLabel} →
                                </button>
                            ) : (
                                <button
                                    onClick={handleDiscover}
                                    disabled={synthesizing || !isReady}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '10px 22px', borderRadius: 999,
                                        background: 'linear-gradient(135deg, #4338CA 0%, #7c3aed 100%)', border: 'none',
                                        fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                                        color: '#fff', cursor: 'pointer',
                                        boxShadow: '0 4px 14px rgba(79,70,229,0.45)',
                                        opacity: (!isReady || synthesizing) ? 0.5 : 1,
                                    }}
                                >
                                    {synthesizing ? <><i className="fa-solid fa-spinner fa-spin" />Finding homes…</> : <>✦ Find my homes →</>}
                                </button>
                            )}
                        </div>

                        {/* ── Submit ribbon (always visible at bottom) ── */}
                        <div style={{
                            marginTop: 8,
                            background: 'linear-gradient(135deg, #4338CA 0%, #7c3aed 100%)',
                            borderRadius: 16, padding: 24, color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
                        }}>
                            <div>
                                <div style={{ fontSize: 10.5, letterSpacing: '0.18em', fontWeight: 700, color: '#c7b8ff', textTransform: 'uppercase', marginBottom: 6 }}>Step 2 · Let AI work</div>
                                <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.25 }}>
                                    Ready when you are. We\'ll match <em style={{ fontStyle: 'italic' }}>your</em> story to homes.
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
                                    {synthesizing ? <><i className="fa-solid fa-spinner fa-spin" />Finding homes…</> : <>✦ Find my homes <span>→</span></>}
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
                                    <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: 10 }} />
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
