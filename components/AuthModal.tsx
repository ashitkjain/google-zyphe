import React, { useState } from 'react';
import { 
  auth, 
  googleProvider, 
  saveUserProfile, 
  getUserProfile 
} from '../services/firebaseService.ts';
import { 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import Logo from './Logo.tsx';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState<'buyer' | 'seller' | 'realtor'>('buyer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorLink, setErrorLink] = useState<{ url: string, label: string } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  const getTargetDomain = () => {
    return window.location.hostname || window.location.origin.replace(/^https?:\/\//, '');
  };

  const copyHostname = () => {
    const target = getTargetDomain();
    if (target) {
      navigator.clipboard.writeText(target);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleFirebaseError = (err: any) => {
    console.error("Auth Error Object:", err);
    const code = err.code || "";
    const message = err.message || "";

    if (code === "auth/email-already-in-use" || message.includes("email-already-in-use")) {
      setError("An account with this email already exists. Would you like to sign in instead?");
      setErrorLink({
        url: "#",
        label: "Switch to Sign In"
      });
    } else if (code === "auth/unauthorized-domain" || message.includes("unauthorized-domain")) {
      const hostname = getTargetDomain();
      setError(`Domain "${hostname}" is not authorized. You must add it to your Firebase Console 'Authorized Domains' list.`);
      setErrorLink({
        url: "https://console.firebase.google.com/project/zyphe-af0bf/authentication/settings",
        label: "Go to Firebase Console"
      });
    } else if (message.includes("getprojectconfig-are-blocked") || message.includes("projectconfigservice")) {
      setError("Firebase Project Config is blocked. The Identity Toolkit API must be enabled and unrestricted in Google Cloud Console.");
      setErrorLink({
        url: "https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com",
        label: "Enable Identity Toolkit API"
      });
    } else if (code === "auth/weak-password") {
      setError("Password is too weak. Please use at least 6 characters.");
    } else if (code === "auth/invalid-email") {
      setError("Please enter a valid email address.");
    } else if (code === "auth/popup-closed-by-user") {
      setError("Login window was closed.");
    } else if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
      setError("Invalid email or password.");
    } else {
      setError(err.message.replace("Firebase: ", ""));
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setErrorLink(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const existing = await getUserProfile(user.uid);
      if (!existing) {
        await saveUserProfile(user.uid, {
          email: user.email || '',
          displayName: user.displayName || 'User',
          role: 'buyer',
          createdAt: new Date()
        });
      }
      onClose();
    } catch (err: any) {
      handleFirebaseError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    setErrorLink(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });
        await saveUserProfile(result.user.uid, {
          email,
          displayName: name,
          role,
          address: address || undefined,
          createdAt: new Date()
        });
      }
      onClose();
    } catch (err: any) {
      handleFirebaseError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (e: React.MouseEvent) => {
    if (errorLink?.label === "Switch to Sign In") {
      e.preventDefault();
      setIsLogin(true);
      setError(null);
      setErrorLink(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
        <div className="p-8 pb-4 flex flex-col items-center text-center">
          <Logo size={80} className="mb-6" />
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {isLogin ? 'Welcome Back' : 'Join Zyphe AI'}
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">
            {isLogin ? 'Access your saved property insights.' : 'Start your intelligent property journey.'}
          </p>
        </div>

        <div className="px-8 pb-8 overflow-y-auto max-h-[70vh] no-scrollbar">
          {error && (
            <div className="mb-6 p-5 bg-rose-50 border border-rose-100 rounded-[2rem] text-rose-600 text-xs font-bold space-y-4 animate-in slide-in-from-top-2 shadow-sm">
              <div className="flex items-start gap-3">
                <i className="fa-solid fa-circle-exclamation mt-0.5 text-rose-500 text-sm"></i>
                <div className="flex-1 space-y-3">
                  <span className="block leading-relaxed">{error}</span>
                  {(error.includes("unauthorized") || error.includes("preview")) && (
                    <div className="space-y-2">
                      <button 
                        onClick={copyHostname}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-rose-200 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all text-rose-700 w-fit"
                      >
                        <i className={`fa-solid ${copySuccess ? 'fa-check text-emerald-500' : 'fa-copy'}`}></i>
                        {copySuccess ? 'Copied Hostname!' : 'Copy Hostname'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {errorLink && (
                <div className="pt-1">
                  <a 
                    href={errorLink.url} 
                    target={errorLink.url === "#" ? "_self" : "_blank"} 
                    rel="noopener noreferrer"
                    onClick={handleActionClick}
                    className="w-full flex items-center justify-center gap-2 text-white font-black uppercase tracking-widest text-[10px] bg-rose-600 px-4 py-3 rounded-xl shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95"
                  >
                    {errorLink.label} <i className={`fa-solid ${errorLink.url === "#" ? 'fa-arrow-right' : 'fa-arrow-up-right-from-square'}`}></i>
                  </a>
                </div>
              )}
            </div>
          )}

          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 border-2 border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-slate-200 transition-all font-bold text-slate-700 mb-6 active:scale-[0.98] disabled:opacity-50"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-slate-100"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">or email</span>
            <div className="flex-1 h-px bg-slate-100"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Full Name</label>
                  <input 
                    type="text" 
                    required 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl outline-none text-sm font-medium transition-all"
                    placeholder="John Doe"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">I am a...</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'buyer', label: 'Buyer', icon: 'fa-shopping-cart' },
                      { id: 'seller', label: 'Seller', icon: 'fa-house-user' },
                      { id: 'realtor', label: 'Realtor', icon: 'fa-briefcase' }
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id as any)}
                        className={`py-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                          role === r.id 
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                            : 'border-slate-100 text-slate-400 hover:border-slate-200'
                        }`}
                      >
                        <i className={`fa-solid ${r.icon} text-xs`}></i>
                        <span className="text-[9px] font-black uppercase tracking-widest">{r.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Current Address (Optional)</label>
                  <input 
                    type="text" 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl outline-none text-sm font-medium transition-all"
                    placeholder="123 Home St, City, State"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Email Address</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3.5 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl outline-none text-sm font-medium transition-all"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Password</label>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3.5 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl outline-none text-sm font-medium transition-all"
                placeholder="••••••••"
              />
              {!isLogin && <p className="text-[9px] text-slate-400 mt-1.5 ml-1">Minimum 6 characters required.</p>}
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-indigo-700 to-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-98 transition-all mt-4 disabled:opacity-50"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-slate-50 pt-6">
            <button 
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setErrorLink(null);
              }}
              className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              {isLogin ? "Don't have an account? Create one" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;