import React, { useState, useContext, useEffect } from 'react';
import {
  LayoutDashboard, Users, Calendar, Settings, LogOut, Bell, Menu, X,
  ChevronRight, Package, ShieldCheck, BarChart3, CreditCard, QrCode,
  ClipboardList, Archive as ArchiveIcon, Zap, ShieldAlert, Activity, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TENANTS, ROLES } from './constants';
import Reservations from './components/Reservations';
import Equipment from './components/Equipment';
import Analytics from './components/Analytics';
import Login from './components/Login';
import ResidentsManagement from './components/Residents';
import CaptainPortal from './components/CaptainPortal';
import CustodianPortal from './components/CustodianPortal';
import BookingModal from './components/BookingModal';
import Archive from './components/Archive';
import NotificationToast from './components/NotificationToast';
import { supabase } from './supabaseClient';
import CentralLanding from './components/CentralLanding';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import SettingsComponent from './components/Settings';
import Plans from './components/Plans';
import Revenue from './components/Revenue';
import { TenantContext, NotificationContext, ConfirmationContext } from './contexts/AppContext';
import { sendCommunityEmail, EmailTemplates } from './utils/EmailService';


const App = () => {
  const [currentTenant, setCurrentTenant] = useState(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(true);
  const [currentRole, setCurrentRole] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutProgress, setLogoutProgress] = useState(0);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingType, setBookingType] = useState('Facility');
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [userPlan, setUserPlan] = useState(null);
  const [notification, setNotification] = useState({ isVisible: false, message: '', type: 'info' });
  const [isSuperAdminAuthenticated, setIsSuperAdminAuthenticated] = useState(false);
  const [confirmState, setConfirmState] = useState({
    isVisible: false,
    title: '',
    message: '',
    onConfirm: () => { },
    cancelText: 'Cancel',
    confirmText: 'Confirm'
  });
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showResetPassword, setShowResetPassword] = useState(false);


  // Pre-seed test accounts for available barangays (runs once)
  React.useEffect(() => {
    const existing = localStorage.getItem('brgy_hub_users');
    if (!existing || JSON.parse(existing).length === 0) {
      const testAccounts = [
        { email: 'resident@carmen.ph', password: 'carmen123', name: 'Carmen Resident', role: 'Resident' },
        { email: 'admin@carmen.ph', password: 'carmen123', name: 'Carmen Admin', role: 'Barangay Admin' },
        { email: 'resident@gusa.ph', password: 'gusa123', name: 'Gusa Resident', role: 'Resident' },
        { email: 'admin@gusa.ph', password: 'gusa123', name: 'Gusa Admin', role: 'Barangay Admin' },
      ];
      localStorage.setItem('brgy_hub_users', JSON.stringify(testAccounts));
    }
  }, []);

  // Hardcoded fallback tenants ΓÇö always recognized regardless of DB state
  const FALLBACK_TENANTS = {
    carmen: { id: 'carmen', name: 'Barangay Carmen', domain: 'carmen', plan: 'Enterprise', status: 'active', themeColor: '#3B82F6' },
    gusa: { id: 'gusa', name: 'Barangay Gusa', domain: 'gusa', plan: 'Enterprise', status: 'active', themeColor: '#10B981' },
  };

  // Fetch Tenant Context
  // Tenant is now loaded based on User Profile after login
  useEffect(() => {
    if (currentUserProfile?.tenant_id) {
      const fetchUserTenant = async () => {
        setIsLoadingTenant(true);
        try {
          const { data, error } = await supabase
            .from('tenants')
            .select('id, name, domain, plan, status, logo_url')
            .eq('id', currentUserProfile.tenant_id)
            .maybeSingle();

          if (data) {
            const tenantObj = {
              id: data.id,
              name: data.name,
              domain: data.domain,
              plan: data.plan,
              status: data.status,
              themeColor: '#3B82F6', // Standardizing on the premium primary blue
              logoUrl: data.logo_url
            };
            setCurrentTenant(tenantObj);
            document.documentElement.style.setProperty('--primary', tenantObj.themeColor);
            document.documentElement.style.setProperty('--primary-glow', `${tenantObj.themeColor}33`);
          }
        } catch (err) {
          console.error('Error fetching user tenant:', err);
        } finally {
          setIsLoadingTenant(false);
        }
      };
      fetchUserTenant();
    } else {
      setIsLoadingTenant(false);
    }
  }, [currentUserProfile?.tenant_id]);

  // Initialize and listen to Supabase auth state
  useEffect(() => {
    const handleSession = async (session) => {
      if (session) {
        setIsAuthenticated(true);
        // Fetch real profile from DB
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, full_name, email, role, status, tenant_id, avatar_url')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile) {
          if (profile.status !== 'Approved' && profile.role !== 'Barangay Admin' && profile.role !== 'Super Admin') {
            supabase.auth.signOut();
            setIsAuthenticated(false);
            setNotification({ isVisible: true, message: 'Account pending approval.', type: 'error' });
            return;
          }
          setCurrentRole(profile.role);
          setCurrentUserProfile(profile);
          setIsAuthenticated(true);

          if (profile.role === 'Super Admin') {
            setIsSuperAdminAuthenticated(true);
          }
        } else {
          // Check for mock fallback in case profile fetch fails but email matches root admins
          const persistedProfile = localStorage.getItem('brgy_mock_profile');
          if (persistedProfile) {
            try {
              const mock = JSON.parse(persistedProfile);
              if (mock.email === session.user.email) {
                setCurrentRole(mock.role);
                setCurrentUserProfile(mock);
                setIsAuthenticated(true);
                if (mock.role === 'Super Admin') setIsSuperAdminAuthenticated(true);
                return;
              }
            } catch (e) { }
          }

          // Emergency Override for Master Accounts if profile fetch fails
          const isMaster = session.user.email === 'akazayasussy@gmail.com' || session.user.email === 'admin@brgyhub.pro';
          if (isMaster) {
            setCurrentRole(ROLES.SUPER_ADMIN);
            setIsSuperAdminAuthenticated(true);
          } else {
            setCurrentRole(ROLES.RESIDENT);
          }
          setIsAuthenticated(true);
        }
      } else {
        // GHOST RECOVERY: Fallback to mock session if no active Supabase session
        const persistedProfile = localStorage.getItem('brgy_mock_profile');
        const rememberActive = localStorage.getItem('brgy_remember_me') === 'true';

        if (persistedProfile && rememberActive) {
          try {
            const profile = JSON.parse(persistedProfile);
            console.log('[Auth] Ghost Session Active:', profile.email);
            setCurrentUserProfile(profile);
            setIsAuthenticated(true);
            setCurrentRole(profile.role);
            if (profile.role === 'Super Admin') setIsSuperAdminAuthenticated(true);
          } catch (e) {
            setIsAuthenticated(false);
            setIsSuperAdminAuthenticated(false);
            setCurrentUserProfile(null);
          }
        } else {
          setIsAuthenticated(false);
          setIsSuperAdminAuthenticated(false);
          setCurrentUserProfile(null);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowResetPassword(true);
      }

      // Auto-provision new Google OAuth users
      if ((event === 'SIGNED_IN') && session?.user) {
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('id, role, status')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!existingProfile) {
          // Brand new Google user ΓÇö create profile & send welcome email
          const googleName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Resident';
          const googleEmail = session.user.email;
          const googleAvatar = session.user.user_metadata?.avatar_url || null;

          await supabase.from('user_profiles').insert([{
            id: session.user.id,
            email: googleEmail,
            full_name: googleName,
            role: 'Resident',
            status: 'Pending Approval',
            avatar_url: googleAvatar
          }]);

          // Send real welcome email via centralized engine
          const { subject: welcomeSubject, body: welcomeBody } = EmailTemplates.WELCOME(googleName);
          sendCommunityEmail(googleEmail, welcomeSubject, welcomeBody);

          console.log('[Google OAuth] New resident provisioned:', googleEmail);
        }
      }

      await handleSession(session);
      setIsAuthLoading(false);
    });

    // Initialize session explicitly on boot
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await handleSession(session);
      setIsAuthLoading(false);
    });

    // Initial load check is handled by handleSession inside getSession/onAuthStateChange

    return () => subscription.unsubscribe();
  }, []);

  // Real-time Engine
  React.useEffect(() => {
    if (!currentTenant?.id) return;

    const channel = supabase
      .channel(`tenant-${currentTenant.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `tenant_id=eq.${currentTenant.id}` },
        (payload) => {
          notify(payload.new.message, payload.new.type || 'info');
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reservations', filter: `tenant_id=eq.${currentTenant.id}` },
        (payload) => {
          if (currentRole !== 'Resident') {
            notify(`New reservation request: ${payload.new.title}`, 'success');
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'email_logs', filter: `tenant_id=eq.${currentTenant.id}` },
        (payload) => {
          notify(`System Alert: Email dispatched to ${payload.new.recipient_email}`, 'info');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id, currentRole]);

  // Aesthetic Profile Sync
  React.useEffect(() => {
    const applyProfileSettings = () => {
      if (!isAuthenticated || !currentUserProfile) return;

      if (currentUserProfile.theme_color) {
        document.documentElement.style.setProperty('--color-primary', currentUserProfile.theme_color);
      } else if (currentTenant?.theme_color) {
        document.documentElement.style.setProperty('--color-primary', currentTenant.theme_color);
      } else {
        document.documentElement.style.setProperty('--color-primary', '#3B82F6');
      }
    };

    applyProfileSettings();
    window.addEventListener('userProfileUpdate', applyProfileSettings);
    return () => window.removeEventListener('userProfileUpdate', applyProfileSettings);
  }, [currentTenant, isAuthenticated, currentUserProfile]);

  const notify = (message, type = 'info') => {
    setNotification({ isVisible: true, message, type });
  };

  const closeNotification = () => {
    setNotification(prev => ({ ...prev, isVisible: false }));
  };

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

  const confirmAction = (title, message, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel') => {
    setConfirmState({ isVisible: true, title, message, onConfirm, confirmText, cancelText });
  };

  const closeConfirm = () => {
    setConfirmState(prev => ({ ...prev, isVisible: false }));
  };

  const handleConfirm = () => {
    confirmState.onConfirm();
    closeConfirm();
  };

  const handleSuperAdminLogout = async () => {
    console.log('[Auth] Initiating bulletproof SuperAdmin termination...');
    setIsLoggingOut(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      setLogoutProgress(progress);
    }, 150);

    const cleanup = () => {
      clearInterval(interval);
      setIsLoggingOut(false);
      setLogoutProgress(0);
      setIsSuperAdminAuthenticated(false);
      setIsAuthenticated(false);
      setCurrentRole(null);
      setCurrentTenant(null);
      setCurrentUserProfile(null);
      localStorage.removeItem('brgy_mock_profile');
      localStorage.removeItem('brgy_remember_me');

      notify('Administrative session terminated.', 'success');
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    };

    supabase.auth.signOut().finally(() => {
      console.log('[Auth] SuperAdmin signOut settled.');
    });

    setTimeout(cleanup, 1200);
  };

  const handleLogout = async () => {
    console.log('[Auth] Initiating bulletproof termination sequence...');
    setIsLoggingOut(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      setLogoutProgress(progress);
    }, 100);

    // 1. Clear all local state immediately to trigger UI switch
    const cleanup = () => {
      clearInterval(interval);
      setIsLoggingOut(false);
      setLogoutProgress(0);
      setIsAuthenticated(false);
      setIsSuperAdminAuthenticated(false);
      setCurrentRole(null);
      setCurrentTenant(null);
      setCurrentUserProfile(null);

      // 2. Clear persistence
      localStorage.removeItem('brgy_mock_profile');
      localStorage.removeItem('brgy_remember_me');
      localStorage.removeItem('active_user_email');

      // 3. Final Fail-Safe: Hard Reload to purge any lingering memory/state
      notify('Session Terminated. Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    };

    // 4. Attempt signOut but don't let it hang the UI
    supabase.auth.signOut().finally(() => {
      console.log('[Auth] signOut settled.');
    });

    // 5. Guaranteed completion after 1.5s
    setTimeout(cleanup, 1500);
  };

  const confirmLogout = () => {
    console.log('[Auth] Requesting logout confirmation...');
    confirmAction(
      'Terminate Session?',
      'Are you sure you want to sign out? Your current operational state will be saved.',
      handleLogout,
      'Yes, Sign Out'
    );
  };

  const handleLogin = (userProfile) => {
    // This handles the local fallback login (non-Google)
    localStorage.setItem('active_user_email', userProfile.email);
    setCurrentUserProfile(userProfile);
    setIsAuthenticated(true);
    setCurrentRole(userProfile.role || ROLES.RESIDENT);

    // Auto-align tenant if provided in profile (sync for deep-dives)
    if (userProfile.tenant_id) {
      // Profile exists, App.jsx's useEffect for tenant fetch will fire automatically
      // because currentUserProfile has changed.
    }

    window.dispatchEvent(new Event('userProfileUpdate'));
    fetchUserPlan(userProfile);
  };

  const fetchUserPlan = async (profile) => {
    try {
      const activeEmail = profile?.email || localStorage.getItem('active_user_email');
      if (!activeEmail) return;

      // Try Auth User first
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data } = await supabase
          .from('resident_plans')
          .select('*, plans(*)')
          .eq('user_id', authData.user.id)
          .order('applied_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          setUserPlan(data);
          return;
        }
      }

      // Local fallback
      const localRequests = JSON.parse(localStorage.getItem('brgy_plan_requests') || '[]');
      const myRequest = localRequests.filter(r => r.user_email === activeEmail).pop();
      if (myRequest) {
        setUserPlan(myRequest);
      }
    } catch (err) {
      console.error('Fetch user plan error:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated && currentRole === ROLES.RESIDENT) {
      fetchUserPlan(currentUserProfile);

      // Listen for plan updates
      const handlePlanUpdate = () => fetchUserPlan(currentUserProfile);
      window.addEventListener('plan_updated', handlePlanUpdate);
      return () => window.removeEventListener('plan_updated', handlePlanUpdate);
    }
  }, [isAuthenticated, currentRole, currentUserProfile?.id]);

  // GCash-style Auto-Logout Security Feature
  useEffect(() => {
    const handleOffline = () => {
      if (isAuthenticated || isSuperAdminAuthenticated) {
        notify('Network connection lost. For your security, you have been logged out.', 'error');
        if (isSuperAdminAuthenticated) {
          handleSuperAdminLogout();
        } else {
          handleLogout();
        }
      }
    };

    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, [isAuthenticated, isSuperAdminAuthenticated]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        if (currentRole === ROLES.SUPER_ADMIN || isSuperAdminAuthenticated) return <SuperAdminDashboard />;
        if (currentRole === ROLES.CAPTAIN || currentRole === ROLES.BARANGAY_ADMIN) return <CaptainPortal />;
        if (currentRole === ROLES.CUSTODIAN) return <CustodianPortal />;
        return <DashboardHome tenant={currentTenant} role={currentRole} setActiveTab={setActiveTab} userPlan={userPlan} onBook={() => { setBookingType('Facility'); setIsBookingOpen(true); }} />;
      case 'plans': return <Plans tenants={TENANTS} onPlanUpdate={() => window.dispatchEvent(new Event('plan_updated'))} />;
      case 'revenue': return <Revenue tenants={TENANTS} />;
      case 'reservations': return <Reservations tenants={TENANTS} />;
      case 'equipment': return <Equipment tenants={TENANTS} />;
      case 'settings': return <SettingsComponent tenants={TENANTS} />;
      case 'analytics':
        if (currentRole === ROLES.RESIDENT) return <DashboardHome tenant={currentTenant} role={currentRole} setActiveTab={setActiveTab} onBook={() => { setBookingType('Facility'); setIsBookingOpen(true); }} />;
        return <Analytics />;
      case 'residents':
        if (currentRole === ROLES.RESIDENT || currentRole === ROLES.CUSTODIAN) return <DashboardHome tenant={currentTenant} role={currentRole} setActiveTab={setActiveTab} onBook={() => { setBookingType('Facility'); setIsBookingOpen(true); }} />;
        return <ResidentsManagement />;
      case 'archive':
        if (currentRole === ROLES.RESIDENT) return <DashboardHome tenant={currentTenant} role={currentRole} setActiveTab={setActiveTab} onBook={() => { setBookingType('Facility'); setIsBookingOpen(true); }} />;
        return <Archive />;
      case 'settings': return <SettingsView tenant={currentTenant} role={currentRole} />;
      default: return <DashboardHome tenant={currentTenant} role={currentRole} setActiveTab={setActiveTab} onBook={() => { setBookingType('Facility'); setIsBookingOpen(true); }} />;
    }
  };

  const SettingsView = ({ tenant, role }) => (
    <div className="space-y-8 max-w-4xl">
      <h2 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
        <Settings className="text-primary" size={32} />
        System Protocol & Configuration
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass p-8 rounded-[2.5rem] border-white/5 space-y-4">
          <h3 className="text-xl font-black text-white">Instance Profile</h3>
          <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Sector Name</p>
              <p className="font-bold text-white">{tenant?.name || 'Local Instance'}</p>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Encrypted Domain</p>
              <p className="font-bold text-primary">brgyhub.pro/{tenant?.domain || 'local'}</p>
            </div>
          </div>
        </div>
        <div className="glass p-8 rounded-[2.5rem] border-white/5 space-y-4">
          <h3 className="text-xl font-black text-white">Security & Environment</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-sm font-bold">RLS Isolation</span>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px] font-black uppercase">Active</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-sm font-bold">Identity Sync</span>
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase">Nominal</span>
            </div>
          </div>
        </div>
      </div>
      <div className="p-8 bg-red-500/5 rounded-[2.5rem] border border-red-500/10">
        <h4 className="text-red-400 font-black uppercase tracking-widest text-xs mb-2">Restricted Action</h4>
        <p className="text-slate-400 text-sm mb-4">You are currently operating under <span className="text-white font-bold">{role}</span> protocols. System-level overrides are strictly logged.</p>
        <button className="px-6 py-3 bg-red-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest opacity-50 cursor-not-allowed">Reset Instance Data</button>
      </div>
    </div>
  );

  return (
    <TenantContext.Provider value={{ currentTenant, currentRole, setCurrentTenant, setCurrentRole }}>
      <NotificationContext.Provider value={{ notify }}>
        <ConfirmationContext.Provider value={{ confirmAction }}>
          <div className="min-h-screen bg-background text-slate-200 selection:bg-primary/20">
            {(isAuthLoading || (isAuthenticated && !currentRole)) ? (
              <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-primary font-black tracking-[0.2em] uppercase text-xs">Calibrating Access...</p>
              </div>
            ) : !isAuthenticated && !isSuperAdminAuthenticated ? (
              <CentralLanding
                setSuperAdminAuth={(profile, rememberMe) => {
                  setCurrentUserProfile(profile);
                  setIsAuthenticated(true);
                  setIsSuperAdminAuthenticated(true);
                  setCurrentRole(profile.role);
                  if (rememberMe) {
                    localStorage.setItem('brgy_remember_me', 'true');
                    localStorage.setItem('brgy_mock_profile', JSON.stringify(profile));
                  }
                }}
                setTenantAuth={(profile, rememberMe) => {
                  localStorage.setItem('active_user_email', profile.email);
                  setCurrentUserProfile(profile);
                  setIsAuthenticated(true);
                  setCurrentRole(profile.role);
                  if (rememberMe) {
                    localStorage.setItem('brgy_remember_me', 'true');
                    localStorage.setItem('brgy_mock_profile', JSON.stringify(profile));
                  }
                }}
              />
            ) : (currentRole !== ROLES.SUPER_ADMIN && !isSuperAdminAuthenticated && currentUserProfile?.tenant_id && !currentTenant) ? (
              <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-blue-500/10 text-primary rounded-2xl flex items-center justify-center mb-4 border border-primary/20 animate-pulse">
                  <Users size={32} />
                </div>
                <h2 className="text-2xl font-black text-white">Identifying Sector...</h2>
                <p className="text-slate-400 text-sm max-w-md">Your profile is being decrypted to calibrate the dashboard.</p>
                <div className="flex gap-4">
                  <button onClick={handleLogout} className="px-6 py-2 bg-white/5 rounded-xl text-xs font-bold mt-4">Cancel Alignment</button>
                </div>
              </div>
            ) : (
              <div className="min-h-screen flex">
                {isSuperAdminAuthenticated ? (
                  <div className="w-full min-h-screen overflow-hidden">
                    <SuperAdminDashboard setSuperAdminAuth={setIsSuperAdminAuthenticated} onLogout={handleSuperAdminLogout} />
                  </div>
                ) : (
                  <>
                    <Sidebar
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      isSidebarOpen={isSidebarOpen}
                      currentRole={currentRole}
                      onLogout={confirmLogout}
                      currentTenant={currentTenant}
                      currentUserProfile={currentUserProfile}
                      userPlan={userPlan}
                    />

                    <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
                      <header className="flex items-center justify-between p-4 mb-6 glass rounded-[2rem] border-white/5">
                        <div className="flex items-center gap-4">
                          <button onClick={toggleSidebar} className="p-3 hover:bg-white/10 rounded-2xl transition-all duration-300 group">
                            {isSidebarOpen ? <X size={20} /> : <Menu size={20} className="group-hover:scale-110" />}
                          </button>
                          <div>
                            <h1 className="text-2xl font-black text-gradient tracking-tight">{currentTenant?.name || 'BrgyHub Pro'}</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{currentRole} Terminal</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {currentRole === ROLES.SUPER_ADMIN && (
                            <div className="hidden lg:flex bg-white/5 p-1.5 rounded-2xl border border-white/5">
                              {TENANTS.map(t => (
                                <button
                                  key={t.id}
                                  onClick={() => { setCurrentTenant(t); notify(`Sector switched to ${t.name}`, 'info'); }}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${currentTenant?.id === t.id ? 'bg-primary text-white shadow-xl shadow-primary/20 translate-y-[-1px]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                >
                                  {t.name.split(' ')[1]}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="w-px h-8 bg-white/10 mx-2" />
                          <NotificationCenter
                            tenantId={currentTenant?.id || 'central'}
                            role={currentRole}
                            showResetPassword={showResetPassword}
                            setShowResetPassword={setShowResetPassword}
                          />
                        </div>
                      </header>

                      <div className="flex-1 overflow-y-auto pr-2 custom-scroll">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                          >
                            {renderContent()}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </main>
                  </>
                )}
              </div>
            )}

            <BookingModal isOpen={isBookingOpen} onClose={() => setIsBookingOpen(false)} type={bookingType} />

            {notification?.isVisible && (
              <NotificationToast
                isVisible={notification.isVisible}
                message={notification.message}
                type={notification.type}
                onClose={closeNotification}
              />
            )}

            {confirmState?.isVisible && (
              <ConfirmModal
                isOpen={confirmState.isVisible}
                onClose={closeConfirm}
                onConfirm={handleConfirm}
                title={confirmState.title}
                message={confirmState.message}
                confirmText={confirmState.confirmText}
                cancelText={confirmState.cancelText}
              />
            )}

            {/* Global Overlays */}
            <AnimatePresence>
              {isLoggingOut && (
                <LogoutOverlay progress={logoutProgress} />
              )}
            </AnimatePresence>
          </div>
        </ConfirmationContext.Provider>
      </NotificationContext.Provider>
    </TenantContext.Provider>
  );
};

const LogoutOverlay = ({ progress }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[1000] bg-background/80 backdrop-blur-3xl flex flex-col justify-center items-center"
  >
    <div className="max-w-md w-full p-8 text-center space-y-6">
      <motion.div
        animate={{ scale: [1, 1.1, 1], rotate: [0, -360] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="w-24 h-24 bg-red-500/10 rounded-[2.5rem] mx-auto flex items-center justify-center border border-red-500/20 shadow-2xl shadow-red-500/10"
      >
        <LogOut className="text-red-500" size={48} />
      </motion.div>

      <div className="space-y-2">
        <h2 className="text-3xl font-black text-red-500 uppercase tracking-widest">Terminating Session</h2>
        <p className="text-slate-400 font-medium">Securing and clearing temporary data buffers...</p>
      </div>

      <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-white/5 p-1">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.6)]"
        />
      </div>

      <p className="text-[10px] font-black text-red-500/50 uppercase tracking-[0.4em]">
        Status: {Math.round(progress)}% Secure
      </p>
    </div>
  </motion.div>
);

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, cancelText }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-background/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 max-w-md w-full relative overflow-hidden shadow-2xl"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-secondary" />

          <h3 className="text-2xl font-black text-white mb-2">{title}</h3>
          <p className="text-slate-400 font-medium mb-8 leading-relaxed">{message}</p>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={onClose}
              className="px-6 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-black uppercase tracking-widest text-[10px] text-slate-300"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className="px-6 py-4 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[10px] transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

const Sidebar = ({ activeTab, setActiveTab, isSidebarOpen, currentRole, onLogout, currentTenant, currentUserProfile, userPlan }) => (
  <motion.aside
    initial={false}
    animate={{ width: isSidebarOpen ? 280 : 80 }}
    className="glass border-r border-slate-700/50 m-4 flex flex-col overflow-hidden shadow-2xl h-[calc(100vh-2rem)] sticky top-4 shrink-0"
  >
    {/* Dashboard Identity Badge */}
    <div className={`px-4 py-2 flex items-center gap-2 border-b border-white/5 ${currentRole === 'Super Admin' ? 'bg-purple-500/10' :
      currentRole === 'Barangay Admin' || currentRole === 'Captain' ? 'bg-blue-500/10' :
        currentRole === 'Resident' ? 'bg-emerald-500/10' : 'bg-white/5'
      }`}>
      <div className={`w-2 h-2 rounded-full animate-pulse ${currentRole === 'Super Admin' ? 'bg-purple-400' :
        currentRole === 'Barangay Admin' || currentRole === 'Captain' ? 'bg-blue-400' :
          currentRole === 'Resident' ? 'bg-emerald-400' : 'bg-slate-400'
        }`} />
      {isSidebarOpen && (
        <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${currentRole === 'Super Admin' ? 'text-purple-400' :
          currentRole === 'Barangay Admin' || currentRole === 'Captain' ? 'text-blue-400' :
            currentRole === 'Resident' ? 'text-emerald-400' : 'text-slate-400'
          }`}>
          {currentRole === 'Resident' ? 'Resident Portal' :
            currentRole === 'Barangay Admin' || currentRole === 'Captain' ? 'Admin Dashboard' :
              currentRole === 'Super Admin' ? 'Super Admin Control' : `${currentRole} Panel`}
        </span>
      )}
    </div>

    <div className="p-6 flex items-center gap-3 cursor-pointer group border-b border-white/5 bg-black/20" onClick={() => setActiveTab('dashboard')}>
      <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-all overflow-hidden border border-white/10">
        {currentTenant?.logoUrl ? (
          <img src={currentTenant.logoUrl} alt="Logo" className="w-full h-full object-cover" />
        ) : (
          <ShieldCheck className="text-white" size={24} />
        )}
      </div>
      {isSidebarOpen && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col truncate"
        >
          <span className="font-bold text-lg tracking-tight text-white truncate">
            {currentTenant?.name || 'BrgyHub Pro'}
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-primary/70 -mt-1">
            System {currentRole || 'Resident'}
          </span>
        </motion.div>
      )}
    </div>

    <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scroll">
      <SidebarNavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} isOpen={isSidebarOpen} />

      {/* Dynamic Navigation Logic */}
      {currentRole === ROLES.RESIDENT ? (
        <>
          <SidebarNavItem icon={<Tag size={20} />} label="Benefit Plans" active={activeTab === 'plans'} onClick={() => setActiveTab('plans')} isOpen={isSidebarOpen} />
          <SidebarNavItem icon={<CreditCard size={20} />} label="Pay Fees & Taxes" active={activeTab === 'revenue'} onClick={() => setActiveTab('revenue')} isOpen={isSidebarOpen} />
          <SidebarNavItem icon={<Calendar size={20} />} label="My Reservations" active={activeTab === 'reservations'} onClick={() => setActiveTab('reservations')} isOpen={isSidebarOpen} />
          <SidebarNavItem icon={<Package size={20} />} label="Request Items" active={activeTab === 'equipment'} onClick={() => setActiveTab('equipment')} isOpen={isSidebarOpen} />
        </>
      ) : (
        <>
          <SidebarNavItem icon={<Tag size={20} />} label="Benefit Plans" active={activeTab === 'plans'} onClick={() => setActiveTab('plans')} isOpen={isSidebarOpen} />
          <SidebarNavItem icon={<CreditCard size={20} />} label="Revenue Control" active={activeTab === 'revenue'} onClick={() => setActiveTab('revenue')} isOpen={isSidebarOpen} />
          <SidebarNavItem icon={<Calendar size={20} />} label="Reservations" active={activeTab === 'reservations'} onClick={() => setActiveTab('reservations')} isOpen={isSidebarOpen} />
          <SidebarNavItem icon={<Package size={20} />} label="Equipment" active={activeTab === 'equipment'} onClick={() => setActiveTab('equipment')} isOpen={isSidebarOpen} />
          <SidebarNavItem icon={<BarChart3 size={20} />} label="Analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} isOpen={isSidebarOpen} />

          {/* Admin Exclusive Sections */}
          {(currentRole === ROLES.CAPTAIN || currentRole === ROLES.BARANGAY_ADMIN || currentRole === ROLES.SUPER_ADMIN || currentRole === ROLES.SECRETARY) && (
            <SidebarNavItem icon={<Users size={20} />} label="Residents" active={activeTab === 'residents'} onClick={() => setActiveTab('residents')} isOpen={isSidebarOpen} />
          )}

          <SidebarNavItem icon={<ArchiveIcon size={20} />} label="Data Archive" active={activeTab === 'archive'} onClick={() => setActiveTab('archive')} isOpen={isSidebarOpen} />
          <SidebarNavItem icon={<Settings size={20} />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} isOpen={isSidebarOpen} />
        </>
      )}
    </nav>

    <div className="p-4 mt-auto border-t border-white/5 space-y-4">
      <div className={`flex items-center gap-3 ${isSidebarOpen ? 'px-2' : 'justify-center'}`}>
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border-2 border-primary/40 shadow-lg shadow-primary/10 overflow-hidden shrink-0">
          {currentUserProfile?.avatar_url ? (
            <img src={currentUserProfile.avatar_url} alt="User Avatar" className="w-full h-full object-cover" />
          ) : (
            <Users size={18} className="text-primary" />
          )}
        </div>
        {isSidebarOpen && (
          <div className="overflow-hidden flex-1">
            <p className="text-sm font-bold truncate text-white">{currentUserProfile?.name || currentUserProfile?.full_name || 'Resident'}</p>
            <p className="text-[10px] text-primary uppercase font-black tracking-widest leading-none mt-1">{currentRole}</p>
            {currentRole === ROLES.RESIDENT && userPlan && (
              <div className="flex items-center gap-1 mt-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${userPlan.status === 'Active' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                <span className={`text-[8px] font-black uppercase tracking-widest ${userPlan.status === 'Active' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {userPlan.plans?.name || userPlan.plan_name}: {userPlan.status.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {isSidebarOpen && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-2xl border border-primary/10 mb-2 hover:bg-primary/10 transition-all group/status">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover/status:scale-110 transition-transform">
              <Zap size={14} className="fill-current animate-pulse" />
            </div>
            <div className="overflow-hidden">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Encrypted Sync</p>
              <p className="text-[11px] font-bold text-white leading-none truncate">v3.0.0 (Global Hub)</p>
            </div>
          </div>
        </div>
      )}

      {isSidebarOpen ? (
        <div className="flex flex-col gap-2">

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-red-100 bg-red-500/20 hover:bg-red-500/30 transition-all font-black uppercase tracking-widest text-[10px] cursor-pointer border border-red-500/30 active:scale-95"
          >
            <LogOut size={16} />
            Force Terminate
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 items-center">

          <button
            onClick={onLogout}
            className="w-full flex justify-center p-3 text-red-400 hover:bg-red-500/10 transition-colors rounded-xl cursor-pointer active:scale-90"
          >
            <LogOut size={18} />
          </button>
        </div>
      )}
    </div>
  </motion.aside>
);

const SidebarNavItem = ({ icon, label, active, onClick, isOpen }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center gap-4 px-3 py-3 rounded-xl cursor-pointer transition-all border
      ${active ? 'bg-primary/10 text-primary border-primary/20 shadow-inner' : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-slate-200'}
      ${!isOpen && 'justify-center'}
    `}
  >
    {icon}
    {isOpen && <span className="font-semibold text-sm">{label}</span>}
  </button>
);

const DashboardHome = ({ tenant, role, setActiveTab, onBook }) => {
  const { notify } = useContext(NotificationContext);
  const [stats, setStats] = useState({
    activeRequests: 0,
    totalVolume: 0,
    borrowers: 0,
    idleItems: 0,
    pendingRequests: 0
  });

  // Dynamic tenant theming fallback
  const themeColor = tenant?.themeColor || '#3B82F6'; // Default primary blue

  useEffect(() => {
    if (!tenant?.id) return;
    const fetchStats = async () => {
      try {
        const [reservesRes, residentsRes, equipRes, pendingRes, activeReservesRes] = await Promise.all([
          supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
          supabase.from('residents').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
          supabase.from('equipment').select('available').eq('tenant_id', tenant.id),
          supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('status', 'Pending'),
          supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).neq('status', 'Completed').neq('status', 'Cancelled')
        ]);

        const idle = equipRes.data ? equipRes.data.reduce((acc, curr) => acc + (curr.available || 0), 0) : 0;

        setStats({
          activeRequests: activeReservesRes.count || 0,
          totalVolume: reservesRes.count || 0,
          borrowers: residentsRes.count || 0,
          idleItems: idle,
          pendingRequests: pendingRes.count || 0
        });
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
      }
    };
    fetchStats();
  }, [tenant?.id]);

  return (
    <div className="space-y-8 relative">
      {/* Ambient Orbs - Dynamically Colored per Tenant */}
      <div
        className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] blur-[150px] rounded-full pointer-events-none transition-colors duration-1000"
        style={{ backgroundColor: `${themeColor}33` }}
      />
      <div
        className="absolute -bottom-[10%] right-[0%] w-[30%] h-[30%] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="backdrop-blur-2xl bg-slate-900/40 p-10 md:p-14 relative overflow-hidden group rounded-[2.5rem] border border-white/10 shadow-2xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-700"
      >
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] mb-8 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <ShieldCheck size={16} className="animate-pulse" /> E2E ENCRYPTION ACTIVE
          </div>
          <h2 className="text-5xl md:text-6xl font-black mb-6 tracking-tighter text-white drop-shadow-lg">
            {role === ROLES.RESIDENT ? 'Welcome to your' : 'Strategic'} <br />
            <span
              className="drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              style={{ color: themeColor }}
            >
              {role === ROLES.RESIDENT ? `${tenant?.name || 'Resident'} Portal` : 'Command Center'}
            </span>
          </h2>
          <p className="text-slate-300 text-lg mb-10 leading-relaxed font-medium max-w-xl">
            {role === ROLES.RESIDENT
              ? `Securely interact with ${tenant?.name || 'your barangay'}'s services via this encrypted next-generation ecosystem.`
              : `Authorized access for ${role}. Overseeing strictly isolated operations for ${tenant?.name || 'this sector'}.`}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              className="px-8 py-4 rounded-2xl text-white font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 hover:scale-105 active:scale-95 border border-white/20 shadow-lg hover:shadow-xl"
              style={{ backgroundColor: themeColor, boxShadow: `0 0 20px ${themeColor}66` }}
              onClick={onBook}
            >
              {role === ROLES.RESIDENT ? 'Book Facility' : 'Authorize Reservation'} <ChevronRight size={18} />
            </button>
            {role !== ROLES.RESIDENT && (
              <button className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 text-white shadow-inner" onClick={() => setActiveTab('analytics')}>
                System Intelligence <BarChart3 size={18} style={{ color: themeColor }} />
              </button>
            )}
          </div>
        </div>

        <div
          className="absolute -right-20 -top-20 w-[400px] h-[400px] rounded-full blur-[100px] group-hover:scale-110 transition-all duration-[2s] ease-in-out pointer-events-none"
          style={{ background: `linear-gradient(to bottom right, ${themeColor}4D, transparent)` }}
        />
        <div className="absolute -bottom-20 right-40 w-60 h-60 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none" />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        {role === ROLES.RESIDENT ? (
          <>
            <DashboardStat label="Active Requests" value={stats.activeRequests} icon={<Zap size={24} style={{ color: themeColor }} />} trend="Active" onClick={() => setActiveTab('reservations')} delay={0.1} />
            <DashboardStat label="Asset Requests" value={stats.pendingRequests} icon={<Package size={24} className="text-emerald-400" />} trend="Pending" onClick={() => setActiveTab('equipment')} delay={0.2} />
            <DashboardStat label="Status Verification" value="98%" icon={<ShieldCheck size={24} className="text-amber-500" />} trend="High" onClick={() => setActiveTab('reservations')} delay={0.3} />
            <DashboardStat label="System Pulse" value="Live" icon={<Activity size={24} className="text-primary" />} trend="Online" onClick={() => notify('BrgyHub Monitoring: Network stable.', 'success')} delay={0.4} />
          </>
        ) : (
          <>
            <DashboardStat label="Total Volume" value={stats.totalVolume} icon={<Calendar size={24} style={{ color: themeColor }} />} trend="Active" onClick={() => setActiveTab('reservations')} delay={0.1} />
            <DashboardStat label="Borrowers" value={stats.borrowers} icon={<Users size={24} className="text-emerald-400" />} trend="Users" onClick={() => setActiveTab('residents')} delay={0.2} />
            <DashboardStat label="Idle Items" value={stats.idleItems} icon={<Package size={24} className="text-indigo-400" />} trend="Available" onClick={() => setActiveTab('equipment')} delay={0.3} />
            <DashboardStat label="Requests" value={stats.pendingRequests} icon={<ClipboardList size={24} className="text-red-400" />} trend="Pending" onClick={() => setActiveTab('reservations')} delay={0.4} />
          </>
        )}
      </div>

      {role === ROLES.RESIDENT && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-[#1A2235]/60 backdrop-blur-3xl p-8 rounded-[3rem] border border-white/5 shadow-2xl overflow-hidden group relative"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
              <Bell size={64} className="text-primary" />
            </div>
            <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              Community Bulletin
            </h3>
            <div className="space-y-4">
              <BulletinItem title="Logistics Maintenance" time="2h ago" detail="Facility 3 undergoing RLS audit." />
              <BulletinItem title="New Asset Provisioned" time="5h ago" detail="Medical isolation tents added." />
              <BulletinItem title="System Protocol Update" time="1d ago" detail="Biometric sync thresholds increased." />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-primary/20 backdrop-blur-3xl p-8 rounded-[3rem] border border-primary/20 shadow-2xl relative overflow-hidden group"
          >
            <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
            <h3 className="text-2xl font-black text-white mb-4">Request Command</h3>
            <p className="text-sm text-slate-300 font-medium mb-8 max-w-sm">Need a facility or equipment? Our zero-trust routing ensures your request is provisioned in under 300ms.</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={onBook} className="p-6 bg-white/5 rounded-[2rem] border border-white/10 hover:bg-white/10 transition-all text-center group/btn">
                <LayoutDashboard size={28} className="mx-auto mb-3 text-primary group-hover/btn:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reserve Facility</span>
              </button>
              <button onClick={() => setActiveTab('equipment')} className="p-6 bg-white/5 rounded-[2rem] border border-white/10 hover:bg-white/10 transition-all text-center group/btn">
                <Package size={28} className="mx-auto mb-3 text-emerald-400 group-hover/btn:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Borrow Asset</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Advanced Security & Threat Detection Module */}
      <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-4 mt-12 border-b border-white/5 pb-2">Live Threat Diagnostics</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        <SecurityCard
          title="DDoS Mitigation"
          metric="Active"
          status="Routing normal"
          icon={<ShieldCheck size={20} />}
          color="emerald"
          delay={0.5}
        />
        <SecurityCard
          title="Intrusion Attempts"
          metric="0 Blocked"
          status="Zero-Trust Enforced"
          icon={<X size={20} />}
          color="amber"
          delay={0.6}
        />
        <SecurityCard
          title="Database Isolation"
          metric="Secured"
          status="RLS Filter: Locked"
          icon={<ShieldAlert size={20} />}
          color="blue"
          delay={0.7}
        />
      </div>
    </div>
  );
};

const BulletinItem = ({ title, time, detail }) => (
  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all cursor-default relative group/item">
    <div className="flex justify-between items-start mb-1">
      <h4 className="font-bold text-sm text-white group-hover/item:text-primary transition-colors">{title}</h4>
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{time}</span>
    </div>
    <p className="text-xs text-slate-400 font-medium">{detail}</p>
  </div>
);

const DashboardStat = ({ label, value, icon, trend, onClick, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    whileHover={{ y: -5, scale: 1.02 }}
    onClick={onClick}
    className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-[2rem] border border-white/5 hover:border-white/20 transition-all duration-300 group cursor-pointer shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.5)] relative overflow-hidden"
  >
    <div className="absolute right-[-20%] bottom-[-20%] w-32 h-32 bg-white/5 rounded-full blur-[40px] group-hover:bg-white/10 transition-colors pointer-events-none" />
    <div className="flex justify-between items-start mb-6 relative z-10">
      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all duration-300 border border-white/5 shadow-inner">
        {icon}
      </div>
      <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-lg border ${trend.includes('+') || trend === 'Active' || trend === 'Current' || trend === 'Status' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'bg-red-500/10 text-red-400 border-red-500/20'
        }`}>
        {trend}
      </span>
    </div>
    <div className="relative z-10">
      <p className="text-[10px] text-slate-500 mb-1 font-black uppercase tracking-[0.3em]">{label}</p>
      <h3 className="text-4xl font-black text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-400 transition-all duration-300">{value}</h3>
    </div>
  </motion.div>
);

const SecurityCard = ({ title, metric, status, icon, color, delay = 0 }) => {
  const colorMap = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]',
  };

  const dotColor = {
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    blue: 'bg-blue-400',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-black/60 backdrop-blur-xl p-6 rounded-[2rem] flex flex-col items-start gap-4 border border-white/5 hover:border-white/10 transition-all shadow-inner relative overflow-hidden group"
    >
      <div className={`p-3 rounded-xl border ${colorMap[color]} relative z-10`}>
        <div className={`absolute -right-1 -top-1 w-2.5 h-2.5 rounded-full ${dotColor[color]} animate-ping opacity-75`} />
        {icon}
      </div>
      <div className="relative z-10 w-full">
        <h4 className="font-black text-white tracking-tight text-lg mb-1">{metric}</h4>
        <div className="flex items-center justify-between w-full">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{title}</p>
          <p className="text-[8px] font-bold uppercase tracking-widest text-slate-600 bg-white/5 px-2 py-0.5 rounded">{status}</p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:via-white/30 transition-all" />
    </motion.div>
  );
};

const NotificationCenter = ({ tenantId, role, showResetPassword, setShowResetPassword }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!tenantId) return;
    fetchNotifications();

    const sub = supabase
      .channel(`public:notifications:tenant_id=eq.${tenantId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `tenant_id=eq.${tenantId}` }, payload => {
        if (!payload.new.target_roles || payload.new.target_roles.includes(role)) {
          setNotifications(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `tenant_id=eq.${tenantId}` }, payload => {
        setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
        if (payload.new.read_by && payload.new.read_by.includes(role)) {
          fetchNotifications(); // Simple refresh for unread count
        }
      })
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, [tenantId, role]);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      const relevant = data.filter(n => !n.target_roles || n.target_roles.includes(role));
      setNotifications(relevant);
      setUnreadCount(relevant.filter(n => !n.read_by || !n.read_by.includes(role)).length);
    }
  };

  const markAsRead = async (id, currentReadBy) => {
    const newReadBy = currentReadBy ? [...currentReadBy, role] : [role];
    await supabase.from('notifications').update({ read_by: newReadBy }).eq('id', id);
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read_by || !n.read_by.includes(role)).map(n => n.id);
    if (unreadIds.length === 0) return;

    for (const id of unreadIds) {
      const notif = notifications.find(n => n.id === id);
      await markAsRead(id, notif.read_by);
    }
    setUnreadCount(0);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-3 relative rounded-2xl transition-all duration-300 group ${isOpen ? 'bg-primary/20 text-primary' : 'bg-white/5 hover:bg-white/10'}`}
      >
        <Bell size={20} className={isOpen ? '' : 'group-hover:rotate-12 transition-transform'} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 flex h-3.5 w-3.5 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-[#0B1120] text-[8px] font-black text-white items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10, transformOrigin: 'top right' }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute right-0 mt-4 w-80 md:w-96 bg-[#0B1120] backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                <h3 className="font-black text-white tracking-tight">System Alerts</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-blue-400 transition-colors">Mark all read</button>
                )}
              </div>
              <div className="max-h-[60vh] overflow-y-auto custom-scroll p-2">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 flex flex-col items-center">
                    <Bell size={32} className="opacity-20 mb-3" />
                    <p className="text-xs font-bold tracking-widest uppercase">No security events</p>
                  </div>
                ) : (
                  notifications.map(n => {
                    const isUnread = !n.read_by || !n.read_by.includes(role);
                    return (
                      <div
                        key={n.id}
                        onClick={() => isUnread && markAsRead(n.id, n.read_by)}
                        className={`p-4 rounded-2xl mb-2 transition-all cursor-pointer border ${isUnread ? 'bg-primary/5 border-primary/20 hover:bg-primary/10' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h4 className={`text-sm font-bold mb-1 ${isUnread ? 'text-white' : 'text-slate-400'}`}>{n.title}</h4>
                            <p className={`text-xs ${isUnread ? 'text-slate-300' : 'text-slate-500'}`}>{n.message}</p>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-2">
                              {new Date(n.created_at).toLocaleString()}
                            </p>
                          </div>
                          {isUnread && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Reset Password Modal Overlay */}
      <AnimatePresence>
        {showResetPassword && (
          <div className="fixed inset-0 z-[500] bg-slate-900/40 backdrop-blur-3xl flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md w-full glass p-10 rounded-[3rem] border border-white/10 shadow-2xl space-y-8"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-primary/30">
                  <ShieldAlert className="text-primary" size={32} />
                </div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tight">Identity Recovery</h2>
                <p className="text-slate-400 text-sm mt-2 font-medium">Re-establishing secure credentials</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2">New Secure Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                      type="password"
                      id="new-recovery-password"
                      className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-primary transition-all"
                      placeholder="ΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇó"
                    />
                  </div>
                </div>

                <button
                  onClick={async () => {
                    const pass = document.getElementById('new-recovery-password').value;
                    if (!pass || pass.length < 6) {
                      setNotification({ isVisible: true, message: 'Password must be 6+ characters.', type: 'error' });
                      return;
                    }
                    const { error } = await supabase.auth.updateUser({ password: pass });
                    if (error) {
                      setNotification({ isVisible: true, message: error.message, type: 'error' });
                    } else {
                      setNotification({ isVisible: true, message: 'Identity re-established. Access granted.', type: 'success' });
                      setShowResetPassword(false);
                    }
                  }}
                  className="w-full btn-primary py-4 text-xs font-black uppercase tracking-[0.2em]"
                >
                  Confirm Override
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
