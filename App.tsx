
import React, { useState, useEffect, useMemo, useRef } from 'react';
import DevMemoryMonitor from './components/dev/DevMemoryMonitor';
import {
  PropertyData,
  CustomAIAnalysisResult,
  ComprehensiveAnalysisResult,
  LogEntry,
  UserProfile
} from './types';
import {
  saveVisualAnalysisToCloud,
  auth,
  getUserProfile,
  getUserViewHistory,

  verifyFirestoreConnection,
  deleteUserAccount,
  toggleFavorite,
  getUserFavorites,
  saveContextGraphToCloud,
  getPropertyAssetsFromCloud,
  loadAddressIndex,
  setTenantContext,
  clearTenantContext,
} from './services/firebaseService';
import type { AddressIndexEntry } from './services/firebase/properties';
import { identifyUser as identifyPH } from './services/analytics/posthog';

import { saveUserProfile } from './services/firebase/user';
import { APP_CONFIG } from './config';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import PropertyHeader from './components/property/PropertyHeader';
import PropertyFacts from './components/property/PropertyFacts';
import CustomAIAnalysis from './components/analysis/CustomAIAnalysis';
import ComprehensiveAnalysis from './components/analysis/ComprehensiveAnalysis';
import PropertyImages from './components/property/PropertyImages';
import PropertyMaps from './components/property/PropertyMaps';
import ClimateRiskSection from './components/property/ClimateRiskSection';

import PreloadManager from './components/property/PreloadManager';
import ChatInterface from './components/shared/ChatInterface';
import MyZypheTab from './components/client-hub/MyZypheTab';
import CostDashboardTab from './components/client-hub/CostDashboardTab';
import Logo from './components/shared/Logo';
import AuthModal from './components/auth/AuthModal';
import AddClientModal from './components/client-hub/AddClientModal';
import ClientHub from './components/ClientHub';
import Footer from './components/shared/Footer';
import ExploreTab from './components/property/ExploreTab';
import GuidesTab from './components/client-hub/GuidesTab';
import LegalDisclaimer from './components/legal/LegalDisclaimer';
import TermsView from './components/legal/TermsView';
import PrivacyPolicy from './components/legal/PrivacyPolicy';
import { useInactivitySignout } from './hooks/useInactivitySignout';
import { usePropertyAnalysis } from './hooks/usePropertyAnalysis';
import { initClarity } from './services/analytics/clarity';
import { initPostHog } from './services/analytics/posthog';
const KnowledgeCenterTab = React.lazy(() => import('./components/client-hub/KnowledgeCenterTab'));

type ViewMode = 'main' | 'visual-report' | 'comprehensive-report' | 'dashboard' | 'guides' | 'legal-disclaimer' | 'terms' | 'privacy' | 'explore' | 'leads' | 'tasks' | 'settings' | 'whiteboard' | 'closing' | 'reactivate' | 'best_practices' | 'knowledge_center' | 'clients' | 'creative_studio' | 'realtor-landing' | 'industry_research' | 'industry_case_studies' | 'unit_economics' | 'product_market_fit' | 'post_close_intelligence' | 'technical_papers' | 'technical_papers_context_graph' | 'video_upload' | 'technical_media' | 'executive_summary' | 'ai_validation' | 'my_zyphe' | 'api_monitor';

// Initialize PostHog immediately (synchronous) so it's ready before any events fire
initPostHog();

// Dev helper: expose buildAddressIndex on window for seeding from console
// Usage: window.buildAddressIndex('Pleasanton') or window.buildAddressIndex('Dublin')
import { buildAddressIndex } from './services/firebaseService';
(window as any).buildAddressIndex = buildAddressIndex;

const App: React.FC = () => {
  // Initialize session-recording tools that need the DOM
  useEffect(() => {
    initClarity('vj30ntkkl1');
  }, []);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [addClientModalOpen, setAddClientModalOpen] = useState(false);
  const [inviteData, setInviteData] = useState<{
    email: string, name: string, role: any, realtorId: string, realtorName: string
  } | null>(null);
  const [cloudHistory, setCloudHistory] = useState<any[]>([]);
  const [realtorName, setRealtorName] = useState<string | null>(null);

  const [searchHistory, setSearchHistory] = useState<{ address: string, timestamp: number }[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);

  const [address, setAddress] = useState('');

  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AddressIndexEntry[]>([]);
  const [addressIndex, setAddressIndex] = useState<AddressIndexEntry[]>([]);

  const addToHistory = (newAddress: string) => {
    setSearchHistory(prev => {
      const now = Date.now();
      const newItem = { address: newAddress, timestamp: now };
      const filtered = prev.filter(item => item.address.toLowerCase() !== newAddress.toLowerCase());
      const updated = [newItem, ...filtered].slice(0, 20); // Keep last 20
      localStorage.setItem('zyphe_search_history', JSON.stringify(updated));
      return updated;
    });
  };

  const {
    propertyData, setPropertyData,
    loading, setLoading,
    loadingSublabel, setLoadingSublabel,
    loadingTimer,
    imagesLoading,
    error, setError,
    customAnalysis, setCustomAnalysis,
    customAnalysisLoading,
    comprehensiveAnalysis, setComprehensiveAnalysis,
    comprehensiveLoading,
    logs, setLogs,
    envRefreshing,
    addLog,
    performSearch,
    handleRunCustomAnalysis,
    handleRunComprehensive,
    handleRefreshCommunityPulse,
    handleRefreshEnvironment: handleRefreshEnvironmentBase
  } = usePropertyAnalysis({
    currentUser,
    transitionToView: (view, addr) => transitionToView(view as ViewMode, addr),
    addToHistory,
    setAddress,
    setAddressIndex
  });

  // Dev memory monitor — tracks the heaviest React state for debugging
  const trackedState = useMemo(() => [
    { label: 'propertyData', value: propertyData },
    { label: 'customAnalysis', value: customAnalysis },
    { label: 'comprehensiveAnalysis', value: comprehensiveAnalysis },
    { label: 'logs', value: logs },
    { label: 'cloudHistory', value: cloudHistory },
    { label: 'favorites', value: favorites },
    { label: 'currentUser', value: currentUser },
  ], [propertyData, customAnalysis, comprehensiveAnalysis, logs, cloudHistory, favorites, currentUser]);
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [fromBrowse, setFromBrowse] = useState(false);
  const [contextGraphZpid, setContextGraphZpid] = useState<string>('');
  const [showPreload, setShowPreload] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Auto sign-out auditors after 15 min of inactivity
  useInactivitySignout(currentUser?.role, () => {
    setCurrentUser(null);
    setCloudHistory([]);
    setError(null);
  });

  const handleHistoryItemClick = (item: string) => {
    setAddress(item);
    setShowHistory(false);
    performSearch(item);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Handle Invites
    if (params.get('mode') === 'invite') {
      const email = params.get('email') || '';
      const name = params.get('name') || '';
      const role = params.get('role') as any || 'buyer';
      const realtorId = params.get('realtorId') || '';
      const realtorName = params.get('realtorName') || '';

      setInviteData({ email, name, role, realtorId, realtorName });
      setAuthModalOpen(true);

      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Handle Direct Property Search via Query Param
    const queryAddr = params.get('q');
    const queryZpid = params.get('zpid');

    if (queryZpid || queryAddr) {
      if (queryAddr) setAddress(queryAddr);

      // If we are already on a realtor path, we might want to stay there, 
      // but usually direct queries should land on the main explore view
      if (window.location.pathname.startsWith('/realtor')) {
        setViewMode('explore');
      } else {
        setViewMode('main');
      }

      if (queryZpid) {
        performSearch(queryZpid, false, queryAddr || undefined);
      } else {
        performSearch(queryAddr!);
      }

      // Clean URL to prevent re-triggering on refresh while keeping state
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [currentUser, performSearch]); // currentUser added since performSearch might need auth context

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        let profile = null;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            profile = await getUserProfile(user.uid);
            if (profile) {
              // Successfully got profile, clear temporary role storage
              localStorage.removeItem('zyphe_pending_role');
              break;
            }
          } catch (e: any) {
            if (e.code === 'permission-denied') {
              console.warn("Initial permission sync attempt failed, retrying...");
            }
          }
          attempts++;
          if (attempts < maxAttempts) {
            console.log(`Retrying profile fetch (attempt ${attempts})...`);
            await new Promise(resolve => setTimeout(resolve, 800 * attempts));
          }
        }

        if (profile) {
          if (user.email === 'tester@zyphe.ai') {
            console.log("⚡️ [Auditor Override] Granting auditor privileges to:", user.email);
            profile.role = 'auditor';
          }
          setCurrentUser(profile);
          // Set tenant context for multi-tenant subcollection paths
          const tenantId = (['realtor', 'admin', 'auditor'].includes(profile.role)) ? user.uid : (profile.realtorId || user.uid);
          setTenantContext(tenantId, profile.role || 'buyer');
          // Always identify the user in PostHog so events are attributed correctly
          // (even on session restore — not just explicit logins)
          identifyPH(user.uid, {
            email: user.email || '',
            name: profile.displayName || user.displayName || '',
            role: profile.role || 'buyer'
          });
        } else {
          // Fallback to localStorage role if available, otherwise default to buyer
          const pendingRole = (localStorage.getItem('zyphe_pending_role') as any) || 'buyer';
          console.log(`Profile not found in Firestore. Using role: ${pendingRole}`);

          setCurrentUser({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Guest User',
            role: pendingRole,
            createdAt: new Date()
          });
          // Set tenant context for fallback users too
          setTenantContext(user.uid, pendingRole);
        }

        // Fetch cloud data regardless of profile existence as long as we have a UID
        try {
          const [history, favs, indexEntries] = await Promise.all([
            getUserViewHistory(user.uid),
            getUserFavorites(user.uid),
            loadAddressIndex(['pleasanton', 'dublin']),
          ]);
          setCloudHistory(history);
          console.log("[Auth] Loaded favorites for user:", favs.length);
          setFavorites(favs);
          if (indexEntries.length > 0) setAddressIndex(indexEntries);
        } catch (e) {
          console.warn("Could not retrieve cloud data:", e);
        }
      } else {
        setCurrentUser(null);
        setCloudHistory([]);
        setFavorites([]);
        // Still load address index for non-authenticated users
        loadAddressIndex(['pleasanton', 'dublin']).then(entries => {
          if (entries.length > 0) setAddressIndex(entries);
        }).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser?.realtorId) {
      getUserProfile(currentUser.realtorId).then(profile => {
        if (profile) setRealtorName(profile.displayName);
      });
    } else {
      setRealtorName(null);
    }
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // Load local history
    try {
      const stored = localStorage.getItem('zyphe_search_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        const valid = parsed.filter((item: any) => (now - item.timestamp) < thirtyDays);
        setSearchHistory(valid);
      }
    } catch (e) {
      console.error("Failed to load search history", e);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Simple Routing Logic
  // Simple Routing Logic
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname;
      const parts = path.split('/').filter(Boolean);
      const isRealtorPath = parts[0] === 'realtor';
      const subPath = isRealtorPath ? parts.slice(1) : parts;

      // Escrow specific handling: if it's just /escrow, redirect to /realtor/escrow to maintain structure
      // But will be blocked if not signed in, per new rule.
      if (path === '/escrow' || (parts.length === 1 && parts[0] === 'escrow')) {
        window.history.replaceState({ mode: 'guides' }, '', '/realtor/escrow');
        // Fall through to authentication check
      }

      // If unauthenticated, protect all /realtor routes
      if (!currentUser) {
        if (isRealtorPath) {
          setViewMode('realtor-landing');
          return;
        }

        if (path === '/legal-disclaimer' || path === '/terms' || path === '/privacy') {
          setViewMode(path === '/legal-disclaimer' ? 'legal-disclaimer' : path === '/terms' ? 'terms' : 'privacy');
          return;
        }

        if (path === '/guides' || path.startsWith('/knowledge') || path.startsWith('/training') || path === '/') {
          setViewMode((path === '/guides' || path.startsWith('/knowledge') || path.startsWith('/training')) ? 'knowledge_center' : 'main');
          return;
        }
      }

      // Authenticated paths
      if (isRealtorPath) {
        if (subPath.length === 0) {
          setViewMode('main'); // Dashboard
        } else if (subPath[0] === 'guides' || subPath[0] === 'knowledge' || subPath[0] === 'training' || subPath[0] === 'playbooks' || subPath[0] === 'resources' || subPath[0] === 'best_practices' || subPath[0] === 'support' || subPath[0] === 'platform-technical-manual' || subPath.length === 2 || ['hoa', 'insurance', 'escrow', 'property-taxes', 'repairs-liability'].includes(subPath[0])) {
          setViewMode('knowledge_center');
        } else {
          // Dynamic tab matching
          setViewMode(subPath[0] as ViewMode);
        }
      } else if (path === '/legal-disclaimer' || path === '/terms' || path === '/privacy') {
        setViewMode(path === '/legal-disclaimer' ? 'legal-disclaimer' : path === '/terms' ? 'terms' : 'privacy');
      } else if (path.startsWith('/knowledge') || path.startsWith('/training') || path === '/guides' || path.startsWith('/support') || path.startsWith('/platform-technical-manual')) {
        // /knowledge/context-graph → open the Context Graph technical paper tab
        if (path === '/knowledge/context-graph') {
          setViewMode('technical_papers_context_graph');
        } else {
          setViewMode('knowledge_center');
        }
      } else {
        setViewMode('main');
      }
    };

    // Set initial view mode based on URL
    handleUrlChange();

    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [currentUser]); // Re-run when auth status changes

  // Wrapper for setViewMode to handle URL updates
  const transitionToView = (newMode: ViewMode, customPath?: string) => {
    // Prevent unauthenticated users from leaving educational areas
    // Prevent unauthenticated users from leaving educational areas
    if (!currentUser && newMode !== 'main' && newMode !== 'guides' && newMode !== 'knowledge_center' && newMode !== 'legal-disclaimer' && newMode !== 'terms' && newMode !== 'privacy') {
      setAuthModalOpen(true);
      return;
    }

    // Check if customPath is actually an address payload (doesn't start with /)
    const isAddress = customPath && !customPath.startsWith('/');
    if (newMode === 'explore' && isAddress) {
      setAddress(customPath);
      performSearch(customPath);
    }

    const isKnowledgeMode = newMode === 'knowledge_center' || newMode === 'guides' || newMode === 'best_practices' || newMode === 'training' || newMode === 'support' || newMode === 'platform-technical-manual';

    setViewMode(newMode);
    let path = '/';

    if (customPath && !isAddress) {
      path = customPath;
    } else if (isKnowledgeMode) {
      path = customPath || '/realtor/knowledge';
    } else if (newMode === 'legal-disclaimer' || newMode === 'terms' || newMode === 'privacy') {
      path = newMode === 'legal-disclaimer' ? '/legal-disclaimer' : newMode === 'terms' ? '/terms' : '/privacy';
    } else if (newMode === 'main' || newMode === 'explore' || newMode === 'dashboard') {
      path = (currentUser?.role === 'realtor' || currentUser?.role === 'investor' || currentUser?.role === 'admin') ? '/realtor' : '/';
    } else if (newMode === 'technical_papers_context_graph') {
      path = '/knowledge/context-graph';
    } else {
      path = `/realtor/${newMode}`;
    }

    if (window.location.pathname !== path) {
      window.history.pushState({ mode: newMode }, '', path);
      // Dispatch a synthetic popstate event so listeners in other components (like KnowledgeCenterTab) sync up
      window.dispatchEvent(new PopStateEvent('popstate', { state: { mode: newMode } }));
    }
  };

  const sessionId = useMemo(() => Math.random().toString(36).substring(2, 15), []);



  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Handle Invites
    if (params.get('mode') === 'invite') {
      const email = params.get('email') || '';
      const name = params.get('name') || '';
      const role = params.get('role') as any || 'buyer';
      const realtorId = params.get('realtorId') || '';
      const realtorName = params.get('realtorName') || '';

      setInviteData({ email, name, role, realtorId, realtorName });
      setAuthModalOpen(true);

      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Handle Direct Property Search via Query Param
    const queryAddr = params.get('q');
    const queryZpid = params.get('zpid');

    if (queryZpid || queryAddr) {
      if (queryAddr) setAddress(queryAddr);

      // If we are already on a realtor path, we might want to stay there, 
      // but usually direct queries should land on the main explore view
      if (window.location.pathname.startsWith('/realtor')) {
        setViewMode('explore');
      } else {
        setViewMode('main');
      }

      if (queryZpid) {
        performSearch(queryZpid, false, queryAddr || undefined);
      } else {
        performSearch(queryAddr!);
      }

      // Clean URL to prevent re-triggering on refresh while keeping state
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [currentUser]); // currentUser added since performSearch might need auth context

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        let profile = null;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            profile = await getUserProfile(user.uid);
            if (profile) {
              // Successfully got profile, clear temporary role storage
              localStorage.removeItem('zyphe_pending_role');
              break;
            }
          } catch (e: any) {
            if (e.code === 'permission-denied') {
              console.warn("Initial permission sync attempt failed, retrying...");
            }
          }
          attempts++;
          if (attempts < maxAttempts) {
            console.log(`Retrying profile fetch (attempt ${attempts})...`);
            await new Promise(resolve => setTimeout(resolve, 800 * attempts));
          }
        }

        if (profile) {
          if (user.email === 'tester@zyphe.ai') {
            console.log("⚡️ [Auditor Override] Granting auditor privileges to:", user.email);
            profile.role = 'auditor';
          }
          setCurrentUser(profile);
          // Set tenant context for multi-tenant subcollection paths
          const tenantId = (['realtor', 'admin', 'auditor'].includes(profile.role)) ? user.uid : (profile.realtorId || user.uid);
          setTenantContext(tenantId, profile.role || 'buyer');
          // Always identify the user in PostHog so events are attributed correctly
          // (even on session restore — not just explicit logins)
          identifyPH(user.uid, {
            email: user.email || '',
            name: profile.displayName || user.displayName || '',
            role: profile.role || 'buyer'
          });
        } else {
          // Fallback to localStorage role if available, otherwise default to buyer
          const pendingRole = (localStorage.getItem('zyphe_pending_role') as any) || 'buyer';
          console.log(`Profile not found in Firestore. Using role: ${pendingRole}`);

          setCurrentUser({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Guest User',
            role: pendingRole,
            createdAt: new Date()
          });
          // Set tenant context for fallback users too
          setTenantContext(user.uid, pendingRole);
        }

        // Fetch cloud data regardless of profile existence as long as we have a UID
        try {
          const [history, favs, indexEntries] = await Promise.all([
            getUserViewHistory(user.uid),
            getUserFavorites(user.uid),
            loadAddressIndex(['pleasanton', 'dublin']),
          ]);
          setCloudHistory(history);
          console.log("[Auth] Loaded favorites for user:", favs.length);
          setFavorites(favs);
          if (indexEntries.length > 0) setAddressIndex(indexEntries);
        } catch (e) {
          console.warn("Could not retrieve cloud data:", e);
        }
      } else {
        setCurrentUser(null);
        setCloudHistory([]);
        setFavorites([]);
        // Still load address index for non-authenticated users
        loadAddressIndex(['pleasanton', 'dublin']).then(entries => {
          if (entries.length > 0) setAddressIndex(entries);
        }).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser?.realtorId) {
      getUserProfile(currentUser.realtorId).then(profile => {
        if (profile) setRealtorName(profile.displayName);
      });
    } else {
      setRealtorName(null);
    }
  }, [currentUser]);




  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // Load local history
    try {
      const stored = localStorage.getItem('zyphe_search_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        const valid = parsed.filter((item: any) => (now - item.timestamp) < thirtyDays);
        setSearchHistory(valid);
      }
    } catch (e) {
      console.error("Failed to load search history", e);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  const handleSignOut = async () => {
    if (auth) {
      try {
        await signOut(auth);
        clearTenantContext();
        setCurrentUser(null);
        setCloudHistory([]);
        setError(null);
      } catch (err) {
        console.error("Sign out failed", err);
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) {
      console.warn("Delete account aborted: No current user in state.");
      return;
    }

    const input = window.prompt("WARNING: All your data and saved analysis will be permanently deleted.\n\nType DELETE to confirm.");
    if (input !== 'DELETE') {
      if (input !== null) alert("Account deletion cancelled. You must type DELETE exactly.");
      return;
    }

    setLoading(true);
    setError(null);
    console.log("Starting account deletion for UID:", currentUser.uid);

    try {
      await deleteUserAccount(currentUser.uid);
      console.log("Account deletion completed successfully.");
      setCurrentUser(null);
      setCloudHistory([]);
    } catch (err: any) {
      console.error("Account deletion failed:", err);
      setError(err.message || "An unexpected error occurred during account deletion.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshEnvironment = async () => {
    if (!propertyData) return;
    return handleRefreshEnvironmentBase(setLoadingSublabel);
  };

  const handleToggleFavorite = async () => {
    if (!currentUser || !propertyData || !propertyData.zpid) return;

    const currentZpid = String(propertyData.zpid);
    const wasFavorited = favorites.some(f => String(f.zpid) === currentZpid);

    // Optimistic Update
    setFavorites(prev => {
      if (wasFavorited) {
        return prev.filter(f => String(f.zpid) !== currentZpid);
      } else {
        return [{
          zpid: currentZpid,
          address: propertyData.address,
          price: propertyData.price || propertyData.zestimate || null,
          images: propertyData.images || [],
          timestamp: Date.now()
        }, ...prev];
      }
    });

    try {
      const res = await toggleFavorite(currentUser.uid, propertyData);
      if (!res.success) {
        // Rollback on failure
        const refreshed = await getUserFavorites(currentUser.uid);
        setFavorites(refreshed);
      }
    } catch (err) {
      const refreshed = await getUserFavorites(currentUser.uid);
      setFavorites(refreshed);
    }
  };
  const handleRemoveFavoriteItem = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    if (!currentUser || !item.zpid) return;

    // Optimistic Update
    setFavorites(prev => prev.filter(f => String(f.zpid) !== String(item.zpid)));

    try {
      const res = await toggleFavorite(currentUser.uid, item);
      if (!res.success) {
        const refreshed = await getUserFavorites(currentUser.uid);
        setFavorites(refreshed);
      }
    } catch (err) {
      const refreshed = await getUserFavorites(currentUser.uid);
      setFavorites(refreshed);
    }
  };

  const isFavorited = (propertyData?.zpid && favorites.length > 0)
    ? favorites.some(f => String(f.zpid) === String(propertyData.zpid))
    : false;

  /* ---------------------- Render Helpers ---------------------- */
  const searchBar = (
    <form onSubmit={(e) => { e.preventDefault(); setAutocompleteSuggestions([]); performSearch(address); }} className="flex-1 relative z-50 w-full">
      <div className="relative group">
        <input
          type="text"
          value={address}
          onFocus={() => setShowHistory(true)}
          onChange={(e) => {
            const val = e.target.value;
            setAddress(val);
            // Autocomplete: filter address index
            if (val.length >= 3 && addressIndex.length > 0) {
              const q = val.toLowerCase();
              const matches = addressIndex
                .filter(entry => entry.a.toLowerCase().includes(q))
                .slice(0, 8);
              setAutocompleteSuggestions(matches);
              if (matches.length > 0) setShowHistory(false);
            } else {
              setAutocompleteSuggestions([]);
            }
          }}
          placeholder="Enter property address..."
          className="w-full pl-12 pr-48 py-3 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl outline-none shadow-inner focus:shadow-lg transition-all text-xs font-medium"
        />
        <i className="fa-solid fa-house-laptop absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {propertyData && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleFavorite(); }}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isFavorited ? 'bg-rose-50 text-rose-500 shadow-inner' : 'bg-slate-200/50 text-slate-400 hover:text-rose-400 hover:bg-rose-50'}`}
              title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
            >
              <i className={`${isFavorited ? 'fa-solid' : 'fa-regular'} fa-heart text-xs`}></i>
            </button>
          )}
          <button type="submit" disabled={loading} className="bg-indigo-700 text-white px-4 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-lg shadow-indigo-200">Search</button>
          {propertyData?.city && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const city = propertyData.city;
                // Clear property state so BrowseHomeSection mounts
                setPropertyData(null);
                setCustomAnalysis(null);
                setComprehensiveAnalysis(null);
                setAddress('');
                transitionToView('main' as any);
                // Dispatch after BrowseHomeSection has mounted
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('browse-city', { detail: { city } }));
                }, 300);
              }}
              className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-all border border-emerald-200"
              title={`Browse all properties in ${propertyData.city}`}
            >
              <i className="fa-solid fa-city mr-1 text-[8px]"></i>Browse
            </button>
          )}
        </div>
      </div>

      {showHistory && (searchHistory.length > 0 || cloudHistory.length > 0 || favorites.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[60]">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50/50 border-b border-slate-100">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Search History</span>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowHistory(false); }}
              className="w-6 h-6 rounded-lg hover:bg-white hover:shadow-sm text-slate-400 hover:text-slate-600 transition-all flex items-center justify-center"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
          <div className="max-h-[300px] overflow-y-auto p-2">
            {favorites.length > 0 && (
              <div className="mb-2">
                <div className="px-3 py-2 text-[10px] font-black pointer-events-none select-none text-rose-500 uppercase tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-heart"></i>
                  Favorites
                </div>
                {favorites.map((item: any, idx) => (
                  <div key={`fav-wrapper-${idx}`} className="group relative">
                    <button
                      onClick={() => handleHistoryItemClick(item.address)}
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-rose-50/50 text-slate-700 text-sm font-medium transition-colors flex items-center justify-between"
                    >
                      <span className="truncate pr-8">{item.address}</span>
                      <i className="fa-solid fa-heart text-rose-500 text-xs"></i>
                    </button>
                    <button
                      onClick={(e) => handleRemoveFavoriteItem(e, item)}
                      className="absolute right-10 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                      title="Remove from favorites"
                    >
                      <i className="fa-solid fa-trash-can text-xs"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchHistory.length > 0 && (
              <div className="mb-2">
                <div className="px-3 py-2 text-[10px] font-black pointer-events-none select-none text-indigo-400 uppercase tracking-widest flex items-center gap-2 border-t border-gray-100 mt-2 pt-4 first:border-t-0 first:mt-0 first:pt-2">
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  Recent Searches
                </div>
                {searchHistory.map((item, idx) => (
                  <button
                    key={`local-${idx}`}
                    onClick={() => handleHistoryItemClick(item.address)}
                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors flex items-center justify-between group"
                  >
                    <span className="truncate">{item.address}</span>
                    <i className="fa-solid fa-arrow-right -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all text-indigo-500 text-xs"></i>
                  </button>
                ))}
              </div>
            )}

            {cloudHistory.length > 0 && (
              <div>
                <div className="px-3 py-2 text-[10px] font-black pointer-events-none select-none text-indigo-400 uppercase tracking-widest flex items-center gap-2 border-t border-gray-100 mt-2 pt-4">
                  <i className="fa-solid fa-cloud"></i>
                  Saved History
                </div>
                {cloudHistory.map((item: any, idx) => (
                  <button
                    key={`cloud-${idx}`}
                    onClick={() => handleHistoryItemClick(item.address)}
                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors flex items-center justify-between group"
                  >
                    <span className="truncate">{item.address}</span>
                    <i className="fa-solid fa-cloud-arrow-down -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all text-indigo-500 text-xs"></i>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Autocomplete suggestions from address index */}
      {autocompleteSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[60]">
          <div className="flex items-center justify-between px-4 py-2 bg-indigo-50/50 border-b border-indigo-100">
            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
              <i className="fa-solid fa-bolt"></i>
              Instant Match
            </span>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAutocompleteSuggestions([]); }}
              className="w-6 h-6 rounded-lg hover:bg-white hover:shadow-sm text-slate-400 hover:text-slate-600 transition-all flex items-center justify-center"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
          <div className="max-h-[300px] overflow-y-auto p-2">
            {autocompleteSuggestions.map((entry, idx) => (
              <button
                key={`ac-${idx}`}
                onClick={() => {
                  setAddress(entry.a);
                  setAutocompleteSuggestions([]);
                  setShowHistory(false);
                  // Search by ZPID → skips RapidAPI, hits Firestore cache directly
                  performSearch(entry.z);
                }}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-indigo-50 text-slate-700 text-sm font-medium transition-colors flex items-center justify-between group"
              >
                <span className="truncate">{entry.a}</span>
                <span className="flex items-center gap-1 text-[9px] font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <i className="fa-solid fa-bolt text-[8px]"></i>Cached
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );

  const exploreTab = (
    <ExploreTab
      propertyData={propertyData}
      loading={loading}
      loadingSublabel={loadingSublabel}
      viewMode={(viewMode === 'dashboard' || viewMode === 'guides' || viewMode === 'explore') ? 'main' : viewMode} // Fallback just in case
      setViewMode={transitionToView as any}
      imagesLoading={imagesLoading}
      isFavorited={isFavorited}
      onToggleFavorite={handleToggleFavorite}
      onRunCustomAnalysis={handleRunCustomAnalysis}
      customAnalysis={customAnalysis}
      customAnalysisLoading={customAnalysisLoading}
      onRunComprehensive={handleRunComprehensive}
      comprehensiveAnalysis={comprehensiveAnalysis}
      comprehensiveLoading={comprehensiveLoading}
      onUpdateAnalysis={async (updated) => {
        setCustomAnalysis(updated);
        if (propertyData?.zpid) {
          await saveVisualAnalysisToCloud(propertyData.zpid, updated);
        }
      }}
      onUpdatePropertyData={(updatedFields) => {
        setPropertyData(prev => prev ? ({ ...prev, ...updatedFields }) : prev);
      }}
      addLog={addLog}
      logs={logs}
      userRole={currentUser?.role}
      realtorId={currentUser?.role === 'buyer' ? currentUser?.realtorId : currentUser?.uid}
      onBack={fromBrowse ? () => {
          setFromBrowse(false);
          transitionToView('idx_search' as any);
      } : undefined}
      searchBar={searchBar}
      address={address}
      onRefreshEnvironment={handleRefreshEnvironment}
      environmentRefreshing={envRefreshing}
      onRefreshCommunityPulse={handleRefreshCommunityPulse}
    />
  );

  /* ------------------- Render Logic ------------------- */

  if (viewMode === 'legal-disclaimer') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="flex-1"><LegalDisclaimer /></div>
        <Footer onNavigate={transitionToView} />
      </div>
    );
  }

  if (viewMode === 'terms') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="flex-1"><TermsView /></div>
        <Footer onNavigate={transitionToView} />
      </div>
    );
  }

  if (viewMode === 'privacy') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="flex-1"><PrivacyPolicy /></div>
        <Footer onNavigate={transitionToView} />
      </div>
    );
  }

  // REALTOR/INVESTOR/AUDITOR LAYOUT: Merged ClientHub + Homepage
  if (currentUser?.role === 'realtor' || currentUser?.role === 'investor' || currentUser?.role === 'auditor' || currentUser?.role === 'admin') {
    return (
      <div className="min-h-screen bg-slate-50">
        {showPreload && <PreloadManager onClose={() => setShowPreload(false)} initialAddress={address} />}
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} inviteData={inviteData} />
        {currentUser && (
          <AddClientModal
            isOpen={addClientModalOpen}
            onClose={() => setAddClientModalOpen(false)}
            realtorName={currentUser.displayName}
            realtorId={currentUser.uid}
          />
        )}

        <ClientHub
          realtorId={currentUser.uid}
          realtorName={currentUser.displayName}
          onSignOut={handleSignOut}
          userRole={currentUser.role}
          onBack={() => transitionToView('main')} // This might be redundant now
          exploreContent={exploreTab}
          initialTab={(viewMode === 'main' || viewMode === 'visual-report' || viewMode === 'comprehensive-report' ? 'explore' : viewMode) as any}
          onNavigate={transitionToView}
          onBrowseNavigate={(address: string) => {
            setFromBrowse(true);
            transitionToView('explore', address);
          }}
          onUpdateProfile={(updates) => {
            setCurrentUser(prev => {
              if (!prev) return null;
              const next = { ...prev, ...updates };
              if (updates.realtor && prev.realtor) {
                next.realtor = { ...prev.realtor, ...updates.realtor };
              }
              return next;
            });
          }}
        />

        {/* Chat Interface needs to be rendered at top level if it's fixed? 
            Actually ClientHub is z-100. ChatInterface is usually z-50.
            Need to ensure ChatInterface works. It is fixed bottom right. 
            If ClientHub is fixed inset-0, ChatInterface might be hidden if z-index is lower. 
            Let's check ChatInterface z-index. Usually z-[60] or z-50.
            ClientHub is z-[100]. ChatInterface will be behind it.
            ExploreTab renders ChatInterface! So it will be INSIDE ClientHub content area.
            That area is 'flex-1 overflow-y-auto'.
            Fixed position inside a transformed/flex container can behave weirdly.
            But ClientHub main content is just a div.
            Actually, let's keep ChatInterface in ExploreTab (Line 869 of original App.tsx was OUTSIDE main).
            Wait, ExploreTab renders ChatInterface internally now.
            If ChatInterface uses 'fixed bottom-4', it will be relative to the viewport.
            But ClientHub is on top.
            If ChatInterface is rendered INSIDE ExploreTab, and ExploreTab is inside ClientHub,
            it should appear on top of ClientHub's white background.
            We should double check z-index of ChatInterface in the file if possible, or just trust ExploreTab.
        */}
      </div>
    );
  }

  // STANDARD LAYOUT (Non-Realtor / Guest)
  return (
    <div className={`${(viewMode === 'knowledge_center' || viewMode === 'guides') ? 'h-screen' : 'min-h-screen'} bg-slate-50 flex flex-col`}>
      {showPreload && <PreloadManager onClose={() => setShowPreload(false)} initialAddress={address} />}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} inviteData={inviteData} />

      {/* Consolidated Navigation Bar */}
      {((viewMode !== 'knowledge_center' && viewMode !== 'guides' && window.location.pathname !== '/') || currentUser) && (
        <div className="py-2 px-6 bg-slate-900 text-white border-b border-white/10 relative z-[60] shadow-2xl">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Left side: Logo + Account Info */}
            <div className="flex items-center gap-6">
              <Logo size={40} className="hover:opacity-80 transition-opacity cursor-pointer" onClick={() => transitionToView('main')} />
              <div className="h-6 w-px bg-white/10"></div>
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em]">
                <button
                  onClick={() => transitionToView('main')}
                  className={`transition-colors flex items-center gap-2 ${viewMode === 'main' || viewMode === 'explore' ? 'text-indigo-400' : 'text-white/60 hover:text-white'}`}
                >
                  <i className="fa-solid fa-compass text-[10px]"></i>
                  EXPLORE
                </button>
              </div>
            </div>

            {/* Right side: Navigation + Actions */}
            <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em]">
              {currentUser && (
                <button
                  onClick={() => transitionToView('my_zyphe')}
                  className={`transition-colors flex items-center gap-2 ${viewMode === 'my_zyphe' ? 'text-indigo-400' : 'text-white/60 hover:text-white'}`}
                >
                  <i className="fa-solid fa-chart-line text-[10px]"></i>
                  MY ZYPHE
                </button>
              )}
              <button
                onClick={() => transitionToView('knowledge_center')}
                className={`transition-colors flex items-center gap-2 ${viewMode === 'knowledge_center' ? 'text-indigo-400' : 'text-white/60 hover:text-white'}`}
              >
                <i className="fa-solid fa-book-open text-[10px]"></i>
                LEARN
              </button>
              
              {!currentUser && (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-indigo-100 transform active:scale-95"
                >
                  <i className="fa-solid fa-user-circle mr-2"></i>
                  Sign In
                </button>
              )}

              {currentUser && (
                <>
                  <div className="h-4 w-px bg-white/10 hidden sm:block"></div>
                  <div className="flex items-center gap-4">
                    {realtorName && (
                      <div className="hidden lg:flex flex-col items-end mr-3 border-r border-white/5 pr-4">
                        <span className="text-white tracking-[0.1em] font-black uppercase text-[9px] leading-none mb-1">{realtorName}</span>
                        <span className="text-indigo-400 tracking-[0.2em] font-black uppercase text-[7px] leading-none">Your Agent</span>
                      </div>
                    )}
                    <span className="text-indigo-400 tracking-[0.3em] font-black uppercase text-[10px] hidden lg:inline">{currentUser.displayName}</span>
                    <button onClick={handleSignOut} className="text-white hover:text-rose-400 transition-colors">SIGN OUT</button>
                    <button onClick={() => handleDeleteAccount()} className="text-slate-500 hover:text-rose-50 hover:bg-rose-500/10 p-1.5 rounded-lg transition-all"><i className="fa-solid fa-trash-can"></i></button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <main className={`flex-1 w-full ${(viewMode === 'knowledge_center' || viewMode === 'guides') ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-10 overflow-y-auto'}`}>
        {error && <div className="bg-rose-50 border border-rose-100 text-rose-700 p-4 rounded-2xl mb-8">{error}</div>}

        {viewMode === 'realtor-landing' ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="relative">
              <div className="absolute -inset-4 bg-indigo-500/20 blur-xl rounded-full"></div>
              <Logo size={96} className="relative drop-shadow-xl" />
            </div>
            <div className="max-w-md space-y-4">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Realtor Access</h1>
              <p className="text-slate-500 font-medium leading-relaxed text-lg">
                Sign in to access your professional dashboard, manage leads, and generate intelligent property reports.
              </p>
            </div>
            <div className="flex flex-col items-center gap-6">
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 text-lg"
              >
                <span>Sign In to Zyphe</span>
                <i className="fa-solid fa-arrow-right"></i>
              </button>


            </div>
          </div>
        ) : viewMode === 'my_zyphe' && currentUser ? (
          <div className="bg-white shadow-2xl overflow-hidden flex-1 min-h-0 flex flex-col animate-in fade-in duration-500 rounded-[2.5rem]">
            <MyZypheTab 
              userId={currentUser.uid} 
              displayName={currentUser.displayName} 
              email={currentUser.email} 
              role={currentUser.role}
              cloudHistory={cloudHistory}
              favorites={favorites}
            />
          </div>
        ) : viewMode === 'api_monitor' ? (
          <div className="bg-white shadow-2xl overflow-hidden flex-1 min-h-0 flex flex-col animate-in fade-in duration-500 rounded-[2.5rem]">
            <CostDashboardTab />
          </div>
        ) : (viewMode === 'knowledge_center' || viewMode === 'guides' || !currentUser ? (
          <div className="bg-white shadow-2xl overflow-hidden flex-1 min-h-0 flex flex-col animate-in fade-in duration-500">
            <React.Suspense fallback={
              <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Library...</p>
              </div>
            }>
              <KnowledgeCenterTab onNavigate={transitionToView} />
            </React.Suspense>
          </div>
        ) : exploreTab)}

        <Footer onNavigate={transitionToView} />
      </main>
      <DevMemoryMonitor trackedState={trackedState} />
    </div>
  );
};

export default App;
