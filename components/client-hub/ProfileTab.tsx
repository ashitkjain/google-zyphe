import React, { useState } from 'react';
import { UserProfile } from '../../types';

interface ProfileTabProps {
    profile: UserProfile | null;
    onUpdateProfile: (updates: Partial<UserProfile>) => void;
}

const ProfileTab: React.FC<ProfileTabProps> = ({ profile, onUpdateProfile }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<UserProfile>>(profile || {});

    // Mock Stats
    const stats = [
        { label: 'Total Sales', value: '142', icon: 'fa-house-circle-check' },
        { label: 'Experience', value: `${profile?.yearsExperience || 12} Years`, icon: 'fa-certificate' },
        { label: 'Avg Price', value: '$1.2M', icon: 'fa-sack-dollar' },
        { label: 'Clients', value: '350+', icon: 'fa-users' },
    ];

    if (!profile) return <div className="p-10 text-center text-slate-400">Loading Profile...</div>;

    const handleSave = () => {
        onUpdateProfile(editForm);
        setIsEditing(false);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
            {/* Hero Header */}
            <div className="relative bg-white pb-8">
                {/* Cover Image */}
                <div className="h-48 bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-900 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] opacity-10 bg-cover bg-center"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>

                    {/* Edit Button */}
                    <div className="absolute top-6 right-8">
                        {isEditing ? (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/20 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-6 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all"
                                >
                                    Save Changes
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    setEditForm(profile);
                                    setIsEditing(true);
                                }}
                                className="px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/20 transition-all flex items-center gap-2"
                            >
                                <i className="fa-solid fa-pen text-[10px]"></i>
                                Edit Profile
                            </button>
                        )}
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-8 relative">
                    <div className="flex flex-col md:flex-row items-end -mt-16 gap-8 mb-6">
                        {/* Avatar */}
                        <div className="w-40 h-40 rounded-[2rem] border-4 border-white shadow-xl bg-white overflow-hidden relative group">
                            {profile.photoURL ? (
                                <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
                                    <i className="fa-solid fa-user text-5xl"></i>
                                </div>
                            )}
                            {/* Upload overlay would go here */}
                        </div>

                        {/* Basic Info */}
                        <div className="flex-1 pb-2">
                            {isEditing ? (
                                <div className="space-y-3 max-w-md">
                                    <input
                                        type="text"
                                        value={editForm.displayName || ''}
                                        onChange={e => setEditForm({ ...editForm, displayName: e.target.value })}
                                        className="w-full text-3xl font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2"
                                        placeholder="Full Name"
                                    />
                                    <input
                                        type="text"
                                        value={editForm.brokerage || ''} // Assuming we add this field or reuse address
                                        onChange={e => setEditForm({ ...editForm, brokerage: e.target.value })}
                                        className="w-full text-base font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2"
                                        placeholder="Brokerage / Company"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-1">
                                        {profile.displayName}
                                    </h1>
                                    <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm uppercase tracking-wide opacity-80 mb-4">
                                        <i className="fa-solid fa-building"></i>
                                        {profile.brokerage || 'Real Estate Professional'}
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        {profile.serviceAreas?.map(area => (
                                            <span key={area} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
                                                <i className="fa-solid fa-location-dot text-[10px] mr-1.5 opacity-50"></i>
                                                {area}
                                            </span>
                                        )) || (
                                                <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-lg text-xs font-bold italic">No service areas listed</span>
                                            )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Stats Row (Desktop) */}
                        <div className="hidden md:flex gap-6 pb-2">
                            {stats.map((stat, i) => (
                                <div key={i} className="text-center">
                                    <div className="w-12 h-12 mx-auto bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-2 shadow-sm">
                                        <i className={`fa-solid ${stat.icon} text-lg`}></i>
                                    </div>
                                    <div className="text-2xl font-black text-slate-800 leading-none mb-1">{stat.value}</div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-8 py-10 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-10">

                    {/* Left Column */}
                    <div className="space-y-10">

                        {/* About Section */}
                        <section>
                            <h2 className="flex items-center gap-3 text-lg font-black text-slate-800 uppercase tracking-wide mb-6">
                                <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                    <i className="fa-solid fa-user-tie text-xs"></i>
                                </span>
                                About Me
                            </h2>
                            <div className="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[4rem] -mr-8 -mt-8 opacity-50 pointer-events-none"></div>

                                {isEditing ? (
                                    <textarea
                                        value={editForm.bio || ''}
                                        onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
                                        className="w-full h-64 p-4 border border-slate-200 rounded-xl bg-slate-50 text-slate-600 leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium resize-none"
                                        placeholder="Tell potential clients about your experience, philosophy, and what makes you unique..."
                                    />
                                ) : (
                                    <div className="prose prose-slate max-w-none prose-p:font-medium prose-p:text-slate-600 prose-headings:font-bold prose-headings:text-slate-800">
                                        {profile.bio ? (
                                            profile.bio.split('\n').map((p, i) => <p key={i}>{p}</p>)
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                                                    <i className="fa-solid fa-pen-nib text-2xl"></i>
                                                </div>
                                                <h3 className="text-slate-900 font-bold mb-1">No Bio Added Yet</h3>
                                                <p className="text-slate-400 text-sm max-w-xs mx-auto">Click "Edit Profile" to verify your professional bio and help clients get to know you.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Recent Reviews (Mock) */}
                        <section>
                            <h2 className="flex items-center justify-between gap-3 text-lg font-black text-slate-800 uppercase tracking-wide mb-6">
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                        <i className="fa-solid fa-star text-xs"></i>
                                    </span>
                                    Client Reviews
                                </div>
                                <span className="text-xs font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200">25 Verified Reviews</span>
                            </h2>

                            <div className="grid gap-4">
                                {[1, 2, 3].map((r) => (
                                    <div key={r} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-white flex items-center justify-center text-indigo-700 font-bold text-sm">
                                                    {['JD', 'SM', 'RK'][r - 1]}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">Satisfied Client</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Bought a Single Family home in 2024</div>
                                                </div>
                                            </div>
                                            <div className="flex text-emerald-400 text-xs gap-0.5">
                                                <i className="fa-solid fa-star"></i>
                                                <i className="fa-solid fa-star"></i>
                                                <i className="fa-solid fa-star"></i>
                                                <i className="fa-solid fa-star"></i>
                                                <i className="fa-solid fa-star"></i>
                                            </div>
                                        </div>
                                        <p className="text-slate-600 text-sm leading-relaxed font-medium">
                                            "Absolutely wonderful experience! The attention to detail and market knowledge was impressive. We felt supported every step of the way."
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>

                    </div>

                    {/* Right Column / Sidebar */}
                    <div className="space-y-8">

                        {/* Contact Card */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-indigo-900/5 border border-slate-100">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Contact Information</h3>

                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                                        <i className="fa-solid fa-phone text-sm"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Phone</div>
                                        {isEditing ? (
                                            <input
                                                type="tel"
                                                value={editForm.phoneNumber || ''}
                                                onChange={e => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-800"
                                            />
                                        ) : (
                                            <div className="text-sm font-black text-slate-800 truncate">{profile.phoneNumber || '--'}</div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                                        <i className="fa-solid fa-envelope text-sm"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Email</div>
                                        {isEditing ? (
                                            <input
                                                type="email"
                                                value={editForm.email || ''}
                                                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-800"
                                            />
                                        ) : (
                                            <div className="text-sm font-black text-slate-800 truncate">{profile.email || '--'}</div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                                        <i className="fa-solid fa-globe text-sm"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Website</div>
                                        {isEditing ? (
                                            <input
                                                type="url"
                                                value={editForm.website || ''}
                                                onChange={e => setEditForm({ ...editForm, website: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-800"
                                                placeholder="https://"
                                            />
                                        ) : (
                                            <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-indigo-600 hover:underline truncate block">
                                                {profile.website ? new URL(profile.website).hostname : '--'}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100 my-6" />

                            <div className="flex justify-center gap-4">
                                {['linkedin', 'facebook', 'instagram', 'twitter'].map(network => (
                                    <button key={network} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center">
                                        <i className={`fa-brands fa-${network} text-lg`}></i>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Specialties */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Specialties</h3>
                            {isEditing ? (
                                <textarea
                                    className="w-full h-24 p-2 text-xs border border-slate-200 rounded-lg bg-slate-50"
                                    placeholder="Enter comma separated specialties (e.g. Luxury, First Time Buyers)"
                                    value={editForm.specialties?.join(', ') || ''}
                                    onChange={e => setEditForm({ ...editForm, specialties: e.target.value.split(',').map(s => s.trim()) })}
                                />
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {profile.specialties?.map(s => (
                                        <span key={s} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-bold border border-emerald-100">
                                            {s}
                                        </span>
                                    )) || <span className="text-xs text-slate-400 italic">No specialties listed</span>}
                                </div>
                            )}
                        </div>

                        {/* Languages */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Languages Spoken</h3>
                            {isEditing ? (
                                <textarea
                                    className="w-full h-20 p-2 text-xs border border-slate-200 rounded-lg bg-slate-50"
                                    placeholder="Enter comma separated languages"
                                    value={editForm.languages?.join(', ') || ''}
                                    onChange={e => setEditForm({ ...editForm, languages: e.target.value.split(',').map(s => s.trim()) })}
                                />
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {profile.languages?.map(l => (
                                        <span key={l} className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold">
                                            {l}
                                        </span>
                                    )) || <span className="text-xs text-slate-400 italic">English</span>}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileTab;
