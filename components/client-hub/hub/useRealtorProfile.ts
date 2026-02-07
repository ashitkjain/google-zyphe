import { useState, useEffect } from 'react';
import { getUserProfile, saveUserProfile, auth } from '../../../services/firebaseService';
import { UserProfile, RealtorNode } from '../../../types';

export const useRealtorProfile = (realtorId: string, realtorName: string, onUpdateProfile?: (updates: Partial<UserProfile>) => void) => {
    const [realtorProfile, setRealtorProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        const fetchRealtorProfile = async () => {
            if (!realtorId) return;

            let profile = await getUserProfile(realtorId);

            if (!profile) {
                profile = {
                    uid: realtorId,
                    displayName: realtorName,
                    role: 'realtor',
                    email: auth?.currentUser?.email || '',
                    createdAt: new Date()
                } as UserProfile;
            }

            if (profile && !profile.realtor && profile.role === 'realtor') {
                const defaultRealtor: RealtorNode = {
                    bio: "Real estate professional dedicated to providing exceptional service and market expertise.",
                    brokerage: "Zyphe Real Estate",
                    yearsExperience: 10,
                    specialties: ["Residential", "Luxury Properties"],
                    languages: ["English"],
                    serviceAreas: ["Major Metropolitan Area"],
                    socialLinks: { linkedin: "", facebook: "", instagram: "", twitter: "" },
                    totalSales: "142",
                    avgPrice: "$1.2M",
                    totalClients: "350+"
                };
                profile.realtor = defaultRealtor;
                await saveUserProfile(realtorId, { realtor: defaultRealtor });
            }
            setRealtorProfile(profile);
        };
        fetchRealtorProfile();
    }, [realtorId, realtorName]);

    const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
        if (!realtorId) return;

        setRealtorProfile(prev => {
            if (!prev) return null;
            const next = { ...prev, ...updates };
            if (updates.realtor && prev.realtor) {
                next.realtor = { ...prev.realtor, ...updates.realtor };
            }
            return next;
        });

        if (onUpdateProfile) onUpdateProfile(updates);

        try {
            const success = await saveUserProfile(realtorId, updates);
            if (!success) throw new Error("Database save operation returned false");
        } catch (err: any) {
            console.error("Failed to save profile:", err);
            const fresh = await getUserProfile(realtorId);
            setRealtorProfile(fresh);
            throw err;
        }
    };

    return { realtorProfile, handleUpdateProfile };
};
