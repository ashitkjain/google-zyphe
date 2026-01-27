import React, { useState } from 'react';
import { UserProfile, RealtorNode } from '../../types';

interface ProfileTabProps {
    profile: UserProfile | null;
    onUpdateProfile: (updates: Partial<UserProfile>) => void;
}

const ProfileTab: React.FC<ProfileTabProps> = ({ profile, onUpdateProfile }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [realtorForm, setRealtorForm] = useState<Partial<RealtorNode>>(profile?.realtor || {});
    // Top-level fields that are also editable here
    const [basicForm, setBasicForm] = useState({
        displayName: profile?.displayName || '',
        phoneNumber: profile?.phoneNumber || '',
        email: profile?.email || ''
    });

    const stats = [
        { label: 'Total Sales', value: profile?.realtor?.totalSales || '142', icon: 'fa-house-circle-check', key: 'totalSales' },
        { label: 'Experience', value: `${profile?.realtor?.yearsExperience || 10} Years`, icon: 'fa-certificate', key: 'yearsExperience' },
        { label: 'Avg Price', value: profile?.realtor?.avgPrice || '$1.2M', icon: 'fa-sack-dollar', key: 'avgPrice' },
        { label: 'Clients', value: profile?.realtor?.totalClients || '350+', icon: 'fa-users', key: 'totalClients' },
    ];
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    if (!profile) return <div className="p-10 text-center text-slate-400">Loading Profile...</div>;

    const handleSave = () => {
        onUpdateProfile({
            ...basicForm,
            realtor: {
                ...profile.realtor,
                ...realtorForm
            }
        });
        setIsEditing(false);
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const reader = new FileReader();
        reader.onloadend = () => {
            setRealtorForm(prev => ({ ...prev, photoURL: reader.result as string }));
            setUploading(false);
        };
        reader.onerror = () => {
            console.error("FileReader error");
            setUploading(false);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
            {/* Hero Header */}
            <div className="relative bg-white pb-8">
                {/* Cover Image */}
                <div className="h-48 bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-900 relative z-0">
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] opacity-10 bg-cover bg-center"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>

                    {/* Edit Button */}
                    <div className="absolute top-6 right-8 text-white z-10">
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
                                    className="px-6 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all border border-emerald-400"
                                >
                                    Save Changes
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    setRealtorForm(profile.realtor || {});
                                    setBasicForm({
                                        displayName: profile.displayName || '',
                                        phoneNumber: profile.phoneNumber || '',
                                        email: profile.email || ''
                                    });
                                    setIsEditing(true);
                                }}
                                className="px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/20 transition-all flex items-center gap-2 border border-white/20"
                            >
                                <i className="fa-solid fa-pen-to-square text-[10px]"></i>
                                Create / Edit Profile
                            </button>
                        )}
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-8 relative z-50">
                    <div className="flex flex-col md:flex-row items-end -mt-12 gap-8 mb-6 overflow-visible">
                        {/* Avatar */}
                        <div className="w-40 h-40 rounded-[2rem] border-4 border-white shadow-xl bg-white overflow-hidden relative group shrink-0">
                            {realtorForm.photoURL || profile.realtor?.photoURL ? (
                                <img src={realtorForm.photoURL || profile.realtor?.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
                                    <i className="fa-solid fa-user text-5xl"></i>
                                </div>
                            )}

                            {isEditing && (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]"
                                >
                                    {uploading ? (
                                        <i className="fa-solid fa-circle-notch fa-spin text-2xl mb-2"></i>
                                    ) : (
                                        <i className="fa-solid fa-camera text-2xl mb-2"></i>
                                    )}
                                    <span className="text-[10px] font-black uppercase tracking-widest">{uploading ? 'Uploading...' : 'Change Photo'}</span>
                                </div>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handlePhotoUpload}
                                className="hidden"
                                accept="image/*"
                            />
                        </div>

                        <div className="flex-1 pb-2 relative z-50 overflow-visible">
                            {isEditing ? (
                                <div className="space-y-3 max-w-md overflow-visible">
                                    <input
                                        type="text"
                                        value={basicForm.displayName}
                                        onChange={e => setBasicForm({ ...basicForm, displayName: e.target.value })}
                                        className="w-full text-3xl font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Full Name"
                                    />
                                    <input
                                        type="text"
                                        value={realtorForm.brokerage || ''}
                                        onChange={e => setRealtorForm({ ...realtorForm, brokerage: e.target.value })}
                                        className="w-full text-base font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Brokerage / Company"
                                    />
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 whitespace-nowrap overflow-hidden text-ellipsis block">Total Sales</label>
                                            <input
                                                type="text"
                                                value={realtorForm.totalSales || ''}
                                                onChange={e => setRealtorForm({ ...realtorForm, totalSales: e.target.value })}
                                                className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="e.g. 142"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 whitespace-nowrap overflow-hidden text-ellipsis block">Experience</label>
                                            <input
                                                type="number"
                                                value={realtorForm.yearsExperience || ''}
                                                onChange={e => setRealtorForm({ ...realtorForm, yearsExperience: parseInt(e.target.value) || 0 })}
                                                className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="Experience in Years"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 whitespace-nowrap overflow-hidden text-ellipsis block">Avg Price</label>
                                            <input
                                                type="text"
                                                value={realtorForm.avgPrice || ''}
                                                onChange={e => setRealtorForm({ ...realtorForm, avgPrice: e.target.value })}
                                                className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="e.g. $1.2M"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 whitespace-nowrap overflow-hidden text-ellipsis block">Clients</label>
                                            <input
                                                type="text"
                                                value={realtorForm.totalClients || ''}
                                                onChange={e => setRealtorForm({ ...realtorForm, totalClients: e.target.value })}
                                                className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="e.g. 350+"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative overflow-visible">
                                    <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-1 leading-tight py-2 overflow-visible">
                                        {profile.displayName}
                                    </h1>
                                    <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm uppercase tracking-wide opacity-80 mb-4">
                                        <i className="fa-solid fa-building"></i>
                                        {profile.realtor?.brokerage || 'Real Estate Professional'}
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        {profile.realtor?.serviceAreas?.map(area => (
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
                                        value={realtorForm.bio || ''}
                                        onChange={e => setRealtorForm({ ...realtorForm, bio: e.target.value })}
                                        className="w-full h-64 p-4 border border-slate-200 rounded-xl bg-slate-50 text-slate-600 leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium resize-none outline-none"
                                        placeholder="Tell potential clients about your experience, philosophy, and what makes you unique..."
                                    />
                                ) : (
                                    <div className="prose prose-slate max-w-none prose-p:font-medium prose-p:text-slate-600 prose-headings:font-bold prose-headings:text-slate-800">
                                        {profile.realtor?.bio ? (
                                            profile.realtor.bio.split('\n').map((p, i) => <p key={i}>{p}</p>)
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                                                    <i className="fa-solid fa-pen-nib text-2xl"></i>
                                                </div>
                                                <h3 className="text-slate-900 font-bold mb-1">No Professional Bio</h3>
                                                <p className="text-slate-400 text-sm max-w-xs mx-auto mb-6">Create your professional bio to help clients get to know your expertise and philosophy.</p>
                                                <button
                                                    onClick={() => setIsEditing(true)}
                                                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all"
                                                >
                                                    Set Up Profile
                                                </button>
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

                        {/* Quick Actions */}
                        {!isEditing && (
                            <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-indigo-900/5 border border-indigo-100">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Account Settings</h3>
                                <button
                                    onClick={() => {
                                        setRealtorForm(profile.realtor || {});
                                        setBasicForm({
                                            displayName: profile.displayName || '',
                                            phoneNumber: profile.phoneNumber || '',
                                            email: profile.email || ''
                                        });
                                        setIsEditing(true);
                                    }}
                                    className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                                >
                                    <i className="fa-solid fa-user-gear text-[10px]"></i>
                                    Create / Edit Profile
                                </button>
                            </div>
                        )}

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
                                                value={basicForm.phoneNumber}
                                                onChange={e => setBasicForm({ ...basicForm, phoneNumber: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
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
                                                value={basicForm.email}
                                                onChange={e => setBasicForm({ ...basicForm, email: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
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
                                                value={realtorForm.website || ''}
                                                onChange={e => setRealtorForm({ ...realtorForm, website: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
                                                placeholder="https://"
                                            />
                                        ) : (
                                            <a href={profile.realtor?.website} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-indigo-600 hover:underline truncate block">
                                                {profile.realtor?.website ? new URL(profile.realtor.website).hostname : '--'}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100 my-6" />

                            <div className="flex flex-col gap-4">
                                {isEditing ? (
                                    <div className="space-y-3">
                                        {[
                                            { id: 'linkedin', icon: 'fa-linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/username' },
                                            { id: 'facebook', icon: 'fa-facebook', label: 'Facebook', placeholder: 'facebook.com/username' },
                                            { id: 'instagram', icon: 'fa-instagram', label: 'Instagram', placeholder: 'instagram.com/username' },
                                            { id: 'twitter', icon: 'fa-twitter', label: 'Twitter', placeholder: 'twitter.com/username' }
                                        ].map(net => (
                                            <div key={net.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm">
                                                    <i className={`fa-brands ${net.icon}`}></i>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={realtorForm.socialLinks?.[net.id as keyof NonNullable<RealtorNode['socialLinks']>] || ''}
                                                    onChange={e => setRealtorForm({
                                                        ...realtorForm,
                                                        socialLinks: {
                                                            ...(realtorForm.socialLinks || {}),
                                                            [net.id]: e.target.value
                                                        }
                                                    })}
                                                    placeholder={net.placeholder}
                                                    className="flex-1 bg-transparent border-none text-xs font-bold text-slate-800 outline-none placeholder:text-slate-300"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex justify-center gap-4">
                                        {[
                                            { id: 'linkedin', icon: 'fa-linkedin' },
                                            { id: 'facebook', icon: 'fa-facebook' },
                                            { id: 'instagram', icon: 'fa-instagram' },
                                            { id: 'twitter', icon: 'fa-twitter' }
                                        ].map(net => {
                                            const url = profile.realtor?.socialLinks?.[net.id as keyof NonNullable<RealtorNode['socialLinks']>] || '';
                                            return (
                                                <a
                                                    key={net.id}
                                                    href={url ? (url.startsWith('http') ? url : `https://${url}`) : '#'}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={!url ? (e) => e.preventDefault() : undefined}
                                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${url ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white shadow-sm' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
                                                >
                                                    <i className={`fa-brands ${net.icon} text-lg`}></i>
                                                </a>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Specialties */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Specialties</h3>
                            {isEditing ? (
                                <textarea
                                    className="w-full h-24 p-2 text-xs border border-slate-200 rounded-lg bg-slate-50 outline-none focus:border-indigo-500"
                                    placeholder="Enter comma separated specialties (e.g. Luxury, First Time Buyers)"
                                    value={realtorForm.specialties?.join(', ') || ''}
                                    onChange={e => setRealtorForm({ ...realtorForm, specialties: e.target.value.split(',').map(s => s.trim()) })}
                                />
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {profile.realtor?.specialties?.map(s => (
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
                                    className="w-full h-20 p-2 text-xs border border-slate-200 rounded-lg bg-slate-50 outline-none focus:border-indigo-500"
                                    placeholder="Enter comma separated languages"
                                    value={realtorForm.languages?.join(', ') || ''}
                                    onChange={e => setRealtorForm({ ...realtorForm, languages: e.target.value.split(',').map(s => s.trim()) })}
                                />
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {profile.realtor?.languages?.map(l => (
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
