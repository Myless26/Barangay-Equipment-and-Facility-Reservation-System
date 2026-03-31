import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, CheckCircle2, X, Zap, ShieldCheck, Tag, Plus, UserPlus, Globe, Building, RefreshCw, Activity, Clock, ArrowRight, Smartphone, Wallet, Star, Users } from 'lucide-react';
import { NotificationContext, TenantContext, ConfirmationContext } from '../contexts/AppContext';
import { supabase } from '../supabaseClient';
import { sendCommunityEmail, EmailTemplates } from '../utils/EmailService';

const EMPTY_ARRAY = [];

const PAYMENT_METHODS = [
    { id: 'gcash', label: 'GCash', icon: '📱', color: 'from-blue-500 to-blue-600', hint: 'Pay via GCash mobile wallet' },
    { id: 'paymaya', label: 'PayMaya', icon: '💳', color: 'from-green-500 to-emerald-600', hint: 'Pay via PayMaya / Maya' },
    { id: 'bank', label: 'Bank Transfer', icon: '🏦', color: 'from-slate-500 to-slate-600', hint: 'BDO, BPI, Metrobank, UnionBank' },
    { id: 'cash', label: 'Cash (On-site)', icon: '💵', color: 'from-amber-500 to-yellow-600', hint: 'Visit the barangay hall to pay' },
];

const Plans = ({ tenants: externalTenants = EMPTY_ARRAY, onPlanUpdate = () => { } } = {}) => {
    const { notify } = useContext(NotificationContext);
    const { confirmAction } = useContext(ConfirmationContext);
    const { currentTenant, currentRole } = useContext(TenantContext);
    const [plans, setPlans] = useState([]);
    const [tenants, setTenants] = useState(externalTenants);
    const [selectedTenantId, setSelectedTenantId] = useState('all');
    const [isLoading, setIsLoading] = useState(false);
    const [isNewPlanOpen, setIsNewPlanOpen] = useState(false);
    const [userPlan, setUserPlan] = useState(null);
    const [newPlan, setNewPlan] = useState({ name: '', description: '', price: 0, features: '' });
    const [pendingRequests, setPendingRequests] = useState([]);
    const [subscribers, setSubscribers] = useState([]);
    const [residents, setResidents] = useState([]);
    const [activeView, setActiveView] = useState((currentRole === 'Barangay Admin' || currentRole === 'Super Admin') ? 'requests' : 'plans');

    // Payment modal state
    const [paymentModal, setPaymentModal] = useState({ open: false, plan: null });
    const [paymentMethod, setPaymentMethod] = useState('gcash');
    const [paymentRef, setPaymentRef] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [paymentStep, setPaymentStep] = useState(1); // 1=method, 2=details, 3=confirm

    useEffect(() => {
        if (externalTenants && externalTenants.length > 0) {
            setTenants(externalTenants);
        }
    }, [externalTenants]);

    useEffect(() => {
        fetchPlans();
        fetchUserPlan();
        if (currentRole === 'Barangay Admin' || currentRole === 'Super Admin' || currentRole === 'Barangay Captain') {
            fetchPendingRequests();
            fetchSubscribers();
            fetchResidents();
        }
    }, [currentTenant?.id, currentRole, selectedTenantId]);

    const fetchTenants = async () => {
        try {
            const { data, error } = await supabase.from('tenants').select('id, name, domain').order('name');
            if (error) throw error;
            const purgedDomains = JSON.parse(localStorage.getItem('brgy_purged_domains') || '[]');
            const cleanedTenants = data.filter(t => !['test', 'default', 'bulua', 'nazareth'].includes(t.domain) && !purgedDomains.includes(t.domain));
            setTenants(cleanedTenants || []);
        } catch (err) {
            console.error('Fetch tenants error:', err);
        }
    };

    const fetchPlans = async () => {
        setIsLoading(true);
        try {
            let query = supabase.from('plans').select('*');
            if (currentTenant?.id) query = query.eq('tenant_id', currentTenant.id);
            else if (currentRole === 'Super Admin' && selectedTenantId !== 'all') query = query.eq('tenant_id', selectedTenantId);
            const { data, error } = await query;
            if (error) throw error;
            if (!data || data.length === 0) {
                // If DB is empty, use samples but mark them as mock
                const samplePlans = [
                    { id: 'p1', name: 'Standard Resident', price: 99, description: 'Basic access to community facilities.', features: JSON.stringify(['Facility Access', 'Standard Booking']), tenant_id: selectedTenantId !== 'all' ? selectedTenantId : null },
                    { id: 'p2', name: 'Premium Resident', price: 199, description: 'Priority booking and 24/7 support.', features: JSON.stringify(['Priority Booking', 'Strategic Alerts']), tenant_id: selectedTenantId !== 'all' ? selectedTenantId : null }
                ];
                setPlans(samplePlans);
            } else {
                // Harden against missing columns in older schemas
                const hardenedData = data.map(p => ({
                    ...p,
                    description: p.description || 'Access to barangay services and community assets.',
                    features: p.features || JSON.stringify(['Standard Access', 'Digital Ledger Sync'])
                }));
                setPlans(hardenedData);
            }
        } catch (err) {
            console.error('Fetch plans error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPendingRequests = async () => {
        try {
            // First try DB
            let dbRequests = [];
            const { data, error } = await supabase
                .from('resident_plans')
                .select('*, plans(*), user_profiles(*)')
                .eq('status', 'Pending')
                .order('applied_at', { ascending: false });
            if (!error && data) dbRequests = data;

            // Also load local pending requests
            const localRequests = JSON.parse(localStorage.getItem('brgy_plan_requests') || '[]')
                .filter(r => r.status === 'Pending');

            setPendingRequests([...dbRequests, ...localRequests]);
        } catch (err) {
            const localRequests = JSON.parse(localStorage.getItem('brgy_plan_requests') || '[]').filter(r => r.status === 'Pending');
            setPendingRequests(localRequests);
        }
    };

    const fetchSubscribers = async () => {
        try {
            let dbSubscribers = [];
            let query = supabase
                .from('resident_plans')
                .select('*, plans(*), user_profiles(*)')
                .eq('status', 'Active')
                .order('applied_at', { ascending: false });

            if (currentTenant?.id) {
                query = query.eq('tenant_id', currentTenant.id);
            }

            const { data, error } = await query;
            if (!error && data) dbSubscribers = data;

            // Also load local active subscribers
            const localRequests = JSON.parse(localStorage.getItem('brgy_plan_requests') || '[]')
                .filter(r => r.status === 'Active');

            setSubscribers([...dbSubscribers, ...localRequests]);
        } catch (err) {
            console.error('Fetch Subscribers Error:', err);
            const localRequests = JSON.parse(localStorage.getItem('brgy_plan_requests') || '[]').filter(r => r.status === 'Active');
            setSubscribers(localRequests);
        }
    };

    const fetchResidents = async () => {
        try {
            let query = supabase.from('user_profiles').select('*').eq('role', 'Resident');
            if (currentTenant?.id) query = query.eq('tenant_id', currentTenant.id);
            else if (currentRole === 'Super Admin' && selectedTenantId !== 'all') query = query.eq('tenant_id', selectedTenantId);

            const { data, error } = await query.order('full_name');
            if (error) throw error;
            setResidents(data || []);
        } catch (err) {
            console.error('Fetch Residents Error:', err);
        }
    };

    const fetchUserPlan = async () => {
        try {
            const activeEmail = localStorage.getItem('active_user_email');

            // Check local plan requests for mock users
            if (activeEmail) {
                const localRequests = JSON.parse(localStorage.getItem('brgy_plan_requests') || '[]');
                const myRequest = localRequests.filter(r => r.user_email === activeEmail).pop();
                if (myRequest) {
                    const matchedPlan = plans.find(p => p.id === myRequest.plan_id) || { name: myRequest.plan_name };
                    setUserPlan({ ...myRequest, plans: matchedPlan });
                    return;
                }
            }

            // Try cloud auth
            const { data: authData } = await supabase.auth.getUser();
            if (!authData?.user) return;

            const { data, error } = await supabase
                .from('resident_plans')
                .select('*, plans(*)')
                .eq('user_id', authData.user.id)
                .order('applied_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (!error && data) setUserPlan(data);
        } catch (err) {
            console.error('Fetch user plan error:', err);
        }
    };

    const openPaymentModal = (plan) => {
        if (userPlan && (userPlan.status === 'Pending' || userPlan.status === 'Active')) {
            notify('You already have an active or pending subscription.', 'warning');
            return;
        }
        setPaymentModal({ open: true, plan });
        setPaymentStep(1);
        setPaymentMethod('gcash');
        setPaymentRef('');
    };

    const handleSubmitPayment = async () => {
        if (!paymentRef.trim() && paymentMethod !== 'cash') {
            notify('Please enter a reference number.', 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            const activeEmail = localStorage.getItem('active_user_email');
            const users = JSON.parse(localStorage.getItem('brgy_hub_users') || '[]');
            const localUser = users.find(u => u.email === activeEmail);

            const requestData = {
                id: `local-plan-${Date.now()}`,
                plan_id: paymentModal.plan.id,
                plan_name: paymentModal.plan.name,
                plan_price: paymentModal.plan.price,
                user_email: activeEmail,
                user_name: localUser?.name || activeEmail,
                tenant_id: currentTenant?.id || null,
                status: 'Pending',
                payment_method: paymentMethod,
                payment_ref: paymentRef,
                applied_at: new Date().toISOString(),
                plans: paymentModal.plan,
                user_profiles: { email: activeEmail, full_name: localUser?.name || activeEmail }
            };

            // Try Supabase first
            const { data: authData } = await supabase.auth.getUser();
            if (authData?.user) {
                await supabase.from('resident_plans').insert([{
                    tenant_id: currentTenant?.id,
                    user_id: authData.user.id,
                    plan_id: paymentModal.plan.id,
                    status: 'Pending',
                    payment_method: paymentMethod,
                    payment_ref: paymentRef,
                }]);
            }

            // Always save locally for reliability
            const existing = JSON.parse(localStorage.getItem('brgy_plan_requests') || '[]');
            existing.push(requestData);
            localStorage.setItem('brgy_plan_requests', JSON.stringify(existing));

            setUserPlan({ ...requestData, plans: paymentModal.plan });
            setPaymentModal({ open: false, plan: null });

            // Dispatch Payment Received Email
            const { subject, body } = EmailTemplates.PAYMENT_RECEIVED(
                localUser?.name || activeEmail,
                paymentModal.plan.name,
                paymentModal.plan.price
            );
            sendCommunityEmail(activeEmail, subject, body);

            notify('✅ Payment submitted! Awaiting Super Admin approval.', 'success');
            fetchPendingRequests();
            onPlanUpdate();
        } catch (err) {
            console.error('Submit payment error:', err);
            notify('Failed to submit. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleApprovePlan = async (requestId) => {
        confirmAction('Approve This Plan?', 'Do you want to ACTIVATE this resident\'s subscription? They will be notified via email immediately.', async () => {
            try {
                // Update local requests
                const localRequests = JSON.parse(localStorage.getItem('brgy_plan_requests') || '[]');
                const idx = localRequests.findIndex(r => r.id === requestId);
                if (idx !== -1) {
                    localRequests[idx].status = 'Active';
                    localRequests[idx].approved_at = new Date().toISOString();
                    localStorage.setItem('brgy_plan_requests', JSON.stringify(localRequests));
                }
                // Also try DB
                const { data, error: dbError } = await supabase.from('resident_plans').update({ status: 'Active', approved_at: new Date().toISOString() }).eq('id', requestId).select('*, user_profiles(*), plans(*)').single();

                // If it worked, send activation email
                const req = (idx !== -1) ? localRequests[idx] : data;
                if (req) {
                    const email = req.user_email || req.user_profiles?.email;
                    const name = req.user_name || req.user_profiles?.full_name || 'Resident';
                    const planName = req.plan_name || req.plans?.name || 'Benefit Plan';

                    if (email) {
                        const { subject, body } = EmailTemplates.PLAN_APPROVED(name, planName);
                        sendCommunityEmail(email, subject, body);
                    }
                }

                notify('Subscription approved successfully!', 'success');
                fetchPendingRequests();
                onPlanUpdate();
            } catch (err) {
                notify('Approval failed. Please try again.', 'error');
            }
        });
    };

    const handleRejectPlan = async (requestId) => {
        confirmAction('Reject Application?', 'Deny this subscriber the requested plan tier?', async () => {
            try {
                const localRequests = JSON.parse(localStorage.getItem('brgy_plan_requests') || '[]');
                const idx = localRequests.findIndex(r => r.id === requestId);
                if (idx !== -1) {
                    localRequests[idx].status = 'Cancelled';
                    localStorage.setItem('brgy_plan_requests', JSON.stringify(localRequests));
                }
                await supabase.from('resident_plans').update({ status: 'Cancelled' }).eq('id', requestId);
                notify('Application rejected.', 'warning');
                fetchPendingRequests();
            } catch (err) {
                notify('Rejection failed.', 'error');
            }
        });
    };

    const handleCreatePlan = async (e) => {
        e.preventDefault();
        try {
            const tenantId = currentTenant?.id || selectedTenantId;
            if (tenantId === 'all') {
                notify('Please select a specific sector to deploy a plan.', 'error');
                return;
            }

            const { error } = await supabase.from('plans').insert([{
                ...newPlan,
                tenant_id: tenantId,
                features: JSON.stringify(newPlan.features.split('\n'))
            }]);

            if (error) throw error;
            notify('Plan created successfully!', 'success');
            setIsNewPlanOpen(false);
            fetchPlans();
        } catch (err) {
            console.error('Create plan error:', err);
            notify('Failed to create plan.', 'error');
        }
    };

    const handleDeletePlan = async (planId) => {
        confirmAction(
            'Delete Plan?',
            'Are you sure you want to permanently remove this benefit plan? This action cannot be undone.',
            async () => {
                try {
                    const { error } = await supabase
                        .from('plans')
                        .update({ is_active: false }) // Soft delete for safety
                        .eq('id', planId);

                    if (error) throw error;
                    notify('Plan removed successfully!', 'success');
                    fetchPlans();
                } catch (err) {
                    console.error('Delete plan error:', err);
                    notify('Failed to remove plan.', 'error');
                }
            }
        );
    };

    return (
        <div className="space-y-8">
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-[#1A2235]/40 backdrop-blur-2xl p-8 rounded-[3rem] border border-white/5">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
                        <Tag className="text-primary" size={28} />
                        Plans Hub
                    </h2>
                    <p className="text-slate-400 mt-2 text-sm font-medium">Manage premium access protocols across {selectedTenantId === 'all' ? 'all registered sectors' : 'the selected sector'}.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    {(currentRole === 'Barangay Admin' || currentRole === 'Super Admin') && (
                        <div className="flex bg-[#0A1221] p-1.5 rounded-2xl border border-white/10 shadow-inner w-full sm:w-auto shrink-0">
                            <button
                                onClick={() => setActiveView('plans')}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${activeView === 'plans' ? 'bg-white/10 text-white shadow-lg scale-105' : 'text-slate-500 hover:text-white'}`}
                            >
                                <Tag size={14} /> Catalog
                            </button>
                            <button
                                onClick={() => setActiveView('requests')}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 relative ${activeView === 'requests' ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'text-slate-500 hover:text-white'}`}
                            >
                                <ShieldCheck size={14} /> Approval Terminal
                                {pendingRequests.length > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center animate-pulse border-2 border-[#0A1221]">
                                        {pendingRequests.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveView('subscribers')}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${activeView === 'subscribers' ? 'bg-secondary text-white shadow-lg shadow-secondary/20 scale-105' : 'text-slate-500 hover:text-white'}`}
                            >
                                <Users size={14} /> Resident Manager
                            </button>
                        </div>
                    )}

                    {currentRole === 'Super Admin' && (
                        <div className="flex bg-[#0A1221] p-1.5 rounded-2xl border border-white/10 shadow-inner w-full sm:w-auto overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setSelectedTenantId('all')}
                                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${selectedTenantId === 'all' ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'text-slate-500 hover:text-white'}`}
                            >
                                <Globe size={14} /> All Sectors
                            </button>
                        </div>
                    )}

                    {(currentRole === 'Barangay Admin' || (currentRole === 'Super Admin' && selectedTenantId !== 'all')) && activeView === 'plans' && (
                        <button
                            onClick={() => setIsNewPlanOpen(true)}
                            className="bg-primary hover:bg-blue-600 text-white px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all hover:scale-105 shadow-xl shadow-primary/20 flex items-center gap-3 w-full sm:w-auto justify-center shrink-0"
                        >
                            <Plus size={18} /> Provision Plan
                        </button>
                    )}
                </div>
            </header>

            {/* BARANGAY SUBSCRIPTION (TENANT LEVEL) - Visible to Admins */}
            {(currentRole === 'Barangay Admin' || currentRole === 'Captain') && currentTenant && activeView === 'plans' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 glass p-8 rounded-[2.5rem] border-primary/20 bg-primary/5 relative overflow-hidden"
                >
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-8 relative z-10 text-center lg:text-left">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest mb-4 border border-primary/20">
                                <ShieldCheck size={14} /> BARANGAY PROTOCOL ACTIVE
                            </div>
                            <h2 className="text-3xl font-black text-white mb-2">{currentTenant.name} Node</h2>
                            <p className="text-slate-400 text-sm max-w-xl">
                                Your sector is currently operating on the <span className="text-primary font-bold">{currentTenant.plan || 'Professional'} Tier</span>.
                                High-volume communities can upgrade to Enterprise for dedicated support and custom RLS protocols.
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 shrink-0">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 min-w-[120px]">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Current Plan</p>
                                <p className="text-lg font-black text-white">{currentTenant.plan || 'Professional'}</p>
                            </div>
                            <button
                                onClick={() => notify('Subscription Upgrade protocol initiated. Our command center will contact you shortly.', 'info')}
                                className="px-8 py-4 bg-gradient-to-r from-primary to-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 hover:scale-105 transition-all"
                            >
                                Upgrade Plan
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {userPlan && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-8 rounded-[2.5rem] border relative overflow-hidden ${userPlan.status === 'Active' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}
                >
                    <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none ${userPlan.status === 'Active' ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`} />
                    <div className="flex items-center gap-6 relative z-10">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${userPlan.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-500'}`}>
                            {userPlan.status === 'Active' ? <Zap size={32} /> : <Activity size={32} />}
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-white">{userPlan.status === 'Active' ? 'Active Subscription' : 'Pending Authorization'}: {userPlan.plans.name}</h3>
                            <p className={`${userPlan.status === 'Active' ? 'text-emerald-400/70' : 'text-amber-500/70'} font-bold uppercase tracking-widest text-[10px] mt-1`}>Status: {userPlan.status === 'Active' ? 'Fully Operational' : 'Awaiting Review by System Command'}</p>
                        </div>
                        {userPlan.status === 'Pending' && (
                            <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 text-slate-400 animate-pulse">
                                <RefreshCw className="animate-spin text-amber-500" size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Syncing...</span>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {activeView === 'requests' ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-8">
                        <h3 className="text-2xl font-black text-white flex items-center gap-3">
                            <ShieldCheck className="text-primary" /> Pending Application Ledger
                        </h3>
                        <span className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                            {pendingRequests.length} Total Requests
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pendingRequests.map((req) => (
                            <motion.div
                                key={req.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-[#1A2235]/60 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-8 flex flex-col justify-between hover:border-primary/40 transition-all group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] pointer-events-none" />

                                <div>
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl shadow-inner border border-primary/20">
                                            {(req.user_profiles?.email || req.user_email || 'R')[0].toUpperCase()}
                                        </div>
                                        <div className="overflow-hidden">
                                            <h3 className="text-xl font-black text-white truncate">{req.user_profiles?.full_name || req.user_name || 'Resident'}</h3>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate">{req.user_profiles?.email || req.user_email}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4 mb-8">
                                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Requested Tier</p>
                                            <div className="flex items-center gap-2">
                                                <Zap size={16} className="text-amber-500" />
                                                <span className="text-white font-black">{req.plans?.name || req.plan_name}</span>
                                            </div>
                                        </div>

                                        {req.payment_method && (
                                            <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                                                <p className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1">Payment Method</p>
                                                <p className="text-xs font-bold text-slate-300">💳 {req.payment_method.toUpperCase()} {req.payment_ref ? `· Ref: ${req.payment_ref}` : ''}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mt-auto">
                                    <button
                                        onClick={() => handleRejectPlan(req.id)}
                                        className="py-4 rounded-2xl bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-slate-400 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        Deny
                                    </button>
                                    <button
                                        onClick={() => handleApprovePlan(req.id)}
                                        className="py-4 rounded-2xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all"
                                    >
                                        Approve
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            ) : activeView === 'subscribers' ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-8">
                        <h3 className="text-2xl font-black text-white flex items-center gap-3">
                            <Users className="text-secondary" /> Resident Manager
                        </h3>
                        <span className="bg-secondary/10 text-secondary border border-secondary/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                            {residents.length} Total Registered
                        </span>
                    </div>

                    <div className="glass overflow-hidden rounded-[3rem] border border-white/5 shadow-2xl">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/5 text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">
                                    <th className="px-8 py-6">Resident Hub</th>
                                    <th className="px-8 py-6">Current Plan Hub</th>
                                    <th className="px-8 py-6">Verification Link</th>
                                    <th className="px-8 py-6 text-right">Access Controls</th>
                                </tr>
                            </thead>
                            <tbody>
                                {residents.map((res) => {
                                    // Merge with plan data
                                    const activePlan = subscribers.find(s => s.user_email === res.email || s.user_id === res.user_id);
                                    const pendingPlan = pendingRequests.find(p => p.user_email === res.email || p.user_id === res.user_id);

                                    return (
                                        <tr key={res.id} className="border-b border-white/5 hover:bg-white/5 transition-all group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary font-black uppercase text-xs">
                                                        {(res.name || 'R')[0]}
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-bold">{res.name}</p>
                                                        <p className="text-[10px] text-slate-500 font-bold tracking-tight">{res.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                {activePlan ? (
                                                    <div className="flex items-center gap-2">
                                                        <Zap size={14} className="text-emerald-500" />
                                                        <span className="text-emerald-400 font-black text-sm">{activePlan.plans?.name || activePlan.plan_name}</span>
                                                    </div>
                                                ) : pendingPlan ? (
                                                    <div className="flex items-center gap-2 animate-pulse">
                                                        <Clock size={14} className="text-amber-500" />
                                                        <span className="text-amber-500 font-black text-sm">Awaiting Authorization</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-600 font-bold text-xs italic tracking-widest">NO ACTIVE PROTOCOL</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border w-fit ${res.status === 'Verified' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                                        {res.status || 'UNVERIFIED'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                {pendingPlan ? (
                                                    <button
                                                        onClick={() => handleApprovePlan(pendingPlan.id)}
                                                        className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-110 transition-all shadow-lg shadow-emerald-500/20"
                                                    >
                                                        Express Authorize
                                                    </button>
                                                ) : activePlan ? (
                                                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Verified Subscriber</span>
                                                ) : (
                                                    <button
                                                        onClick={() => notify('Direct Plan Provisioning protocol initiated.', 'info')}
                                                        className="px-4 py-2 border border-primary/30 text-primary hover:bg-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                                                    >
                                                        Provision Plan
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {residents.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="py-20 text-center text-slate-600 font-bold italic opacity-30">
                                            No residents detected in the sector registry.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {currentRole === 'Super Admin' && selectedTenantId === 'all' ? (
                        tenants.length === 0 ? (
                            <div className="col-span-full py-20 text-center glass rounded-[2.5rem] border-white/5">
                                <Building className="mx-auto text-slate-600 mb-4" size={48} />
                                <h3 className="text-xl font-bold text-white">No Sectors Registered</h3>
                                <p className="text-slate-400">Add a barangay physical node first to assign plans.</p>
                            </div>
                        ) : (
                            tenants.map((tenant, idx) => (
                                <motion.div
                                    key={tenant.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: idx * 0.1 }}
                                    onClick={() => setSelectedTenantId(tenant.id)}
                                    className="glass-card p-10 flex flex-col items-center text-center relative group cursor-pointer hover:-translate-y-2 transition-transform duration-300"
                                >
                                    <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-8 border border-white/10 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-500">
                                        <Building className="text-primary" size={32} />
                                    </div>
                                    <h3 className="text-2xl font-black text-white mb-2">{tenant.name}</h3>
                                    <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-auto">
                                        Manage Plans
                                    </div>
                                </motion.div>
                            ))
                        )
                    ) : (
                        isLoading ? (
                            [1, 2, 3].map(i => (
                                <div key={i} className="h-96 rounded-[2.5rem] bg-white/5 animate-pulse" />
                            ))
                        ) : plans.length === 0 ? (
                            <div className="col-span-full py-20 text-center glass rounded-[2.5rem] border-white/5">
                                <Tag className="mx-auto text-slate-600 mb-4" size={48} />
                                <h3 className="text-xl font-bold text-white">No plans available yet</h3>
                                <p className="text-slate-400">Check back later for community offerings.</p>
                            </div>
                        ) : (
                            plans.map((plan, idx) => (
                                <motion.div
                                    key={plan.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="glass-card p-10 flex flex-col items-center text-center relative group"
                                >
                                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-secondary transition-all opacity-0 group-hover:opacity-100" />
                                    <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-8 border border-white/10 group-hover:scale-110 transition-all duration-500">
                                        <CreditCard className="text-primary" size={32} />
                                    </div>
                                    <h3 className="text-2xl font-black text-white mb-2">{plan.name}</h3>
                                    <div className="text-4xl font-black text-white mb-6">₱{plan.price}<span className="text-sm text-slate-500 font-bold">/mo</span></div>
                                    <p className="text-slate-400 text-sm mb-8 leading-relaxed">{plan.description}</p>

                                    <ul className="w-full space-y-4 mb-10">
                                        {JSON.parse(plan.features || '[]').map((f, i) => (
                                            <li key={i} className="flex items-center gap-3 text-sm text-slate-300 font-medium bg-white/5 p-3 rounded-xl border border-white/5">
                                                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                                                <span>{f}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {currentRole === 'Super Admin' ? (
                                        <div className="w-full flex gap-3">
                                            <button
                                                onClick={() => handleDeletePlan(plan.id)}
                                                className="flex-1 py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500 hover:text-white transition-all"
                                            >
                                                Delete Plan
                                            </button>
                                        </div>
                                    ) : (
                                        (() => {
                                            const isThisPlan = userPlan?.plan_id === plan.id || userPlan?.id === plan.id;
                                            const isActive = isThisPlan && userPlan?.status === 'Active';
                                            const isPending = isThisPlan && userPlan?.status === 'Pending';
                                            return (
                                                <button
                                                    onClick={() => !isActive && !isPending && openPaymentModal(plan)}
                                                    disabled={isActive || isPending}
                                                    className={`w-full py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 ${isActive
                                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed'
                                                        : isPending
                                                            ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30 cursor-not-allowed animate-pulse'
                                                            : 'bg-gradient-to-r from-primary to-blue-600 text-white shadow-xl shadow-primary/30 hover:scale-105 hover:shadow-primary/50 active:scale-95'
                                                        }`}
                                                >
                                                    {isActive ? <><CheckCircle2 size={16} /> Active Subscription</> :
                                                        isPending ? <><Clock size={16} /> Pending Approval...</> :
                                                            <><CreditCard size={16} /> Subscribe & Pay</>}
                                                </button>
                                            );
                                        })()
                                    )}

                                    {/* Admin also gets Subscribe, plus manage buttons */}
                                    {currentRole === 'Barangay Admin' && (
                                        <div className="w-full flex gap-2 mt-2">
                                            <button
                                                onClick={() => handleDeletePlan(plan.id)}
                                                className="flex-1 py-2.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-black uppercase tracking-widest text-[8px] hover:bg-red-500 hover:text-white transition-all"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            ))
                        )
                    )}
                </div>
            )}

            {/* ===== PAYMENT MODAL ===== */}
            <AnimatePresence>
                {paymentModal.open && paymentModal.plan && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl"
                        onClick={(e) => e.target === e.currentTarget && setPaymentModal({ open: false, plan: null })}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.85, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.85, y: 40 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            className="bg-[#0D1526] border border-white/10 rounded-[2.5rem] p-8 max-w-lg w-full relative shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden"
                        >
                            {/* Glow */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />

                            {/* Header */}
                            <div className="flex items-center justify-between mb-6 relative z-10">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary mb-1">Secure Checkout</p>
                                    <h3 className="text-2xl font-black text-white">{paymentModal.plan.name}</h3>
                                    <p className="text-4xl font-black text-white mt-1">₱{paymentModal.plan.price}<span className="text-sm text-slate-500 font-bold">/mo</span></p>
                                </div>
                                <button onClick={() => setPaymentModal({ open: false, plan: null })} className="p-3 rounded-2xl bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Step indicator */}
                            <div className="flex items-center gap-2 mb-8 relative z-10">
                                {[1, 2, 3].map(s => (
                                    <div key={s} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${paymentStep >= s ? 'bg-primary' : 'bg-white/10'}`} />
                                ))}
                            </div>

                            <div className="relative z-10 space-y-4">
                                {paymentStep === 1 && (
                                    <>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Choose Payment Method</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            {PAYMENT_METHODS.map(m => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => setPaymentMethod(m.id)}
                                                    className={`p-4 rounded-2xl border text-left transition-all ${paymentMethod === m.id ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                                                >
                                                    <div className="text-2xl mb-2">{m.icon}</div>
                                                    <p className="text-xs font-black text-white">{m.label}</p>
                                                    <p className="text-[9px] text-slate-500 mt-0.5 font-medium">{m.hint}</p>
                                                    {paymentMethod === m.id && <CheckCircle2 size={14} className="text-primary mt-2" />}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => setPaymentStep(2)}
                                            className="w-full py-4 bg-gradient-to-r from-primary to-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/30 hover:scale-105 transition-all flex items-center justify-center gap-2 mt-4"
                                        >
                                            Continue <ArrowRight size={16} />
                                        </button>
                                    </>
                                )}

                                {paymentStep === 2 && (
                                    <>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
                                            {paymentMethod === 'cash' ? 'Confirm Cash Payment' : 'Enter Reference Number'}
                                        </p>
                                        {paymentMethod !== 'cash' ? (
                                            <div className="space-y-3">
                                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-sm text-slate-400 font-medium">
                                                    <p className="text-white font-black text-xs uppercase tracking-widest mb-1">
                                                        {PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label} Instructions
                                                    </p>
                                                    <p>Send <strong className="text-primary">₱{paymentModal.plan.price}</strong> to account <strong className="text-white">09XX-XXX-XXXX</strong> (BrgyHub Pro). Then enter your reference number below.</p>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. 2024031512345678"
                                                    value={paymentRef}
                                                    onChange={e => setPaymentRef(e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold focus:outline-none focus:border-primary transition-all placeholder-slate-600"
                                                />
                                            </div>
                                        ) : (
                                            <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center">
                                                <div className="text-3xl mb-2">🏛️</div>
                                                <p className="text-amber-400 font-black text-sm">Visit the Barangay Hall</p>
                                                <p className="text-slate-400 text-xs mt-1 font-medium">Your subscription will be activated after the barangay treasurer confirms your cash payment of <strong className="text-white">₱{paymentModal.plan.price}</strong>.</p>
                                            </div>
                                        )}
                                        <div className="flex gap-3 pt-2">
                                            <button onClick={() => setPaymentStep(1)} className="flex-1 py-4 bg-white/5 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-white/10">Back</button>
                                            <button onClick={() => setPaymentStep(3)} className="flex-1 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 hover:scale-105 transition-all">Review Order</button>
                                        </div>
                                    </>
                                )}

                                {paymentStep === 3 && (
                                    <>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Confirm Subscription</p>
                                        <div className="space-y-3 p-5 bg-white/5 rounded-2xl border border-white/10 text-sm">
                                            <div className="flex justify-between"><span className="text-slate-400">Plan</span><span className="text-white font-black">{paymentModal.plan.name}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-400">Amount</span><span className="text-white font-black">₱{paymentModal.plan.price}/mo</span></div>
                                            <div className="flex justify-between"><span className="text-slate-400">Method</span><span className="text-white font-black capitalize">{paymentMethod}</span></div>
                                            {paymentRef && <div className="flex justify-between"><span className="text-slate-400">Reference</span><span className="text-primary font-black text-xs">{paymentRef}</span></div>}
                                            <div className="pt-2 border-t border-white/10">
                                                <p className="text-[9px] text-slate-500 font-medium">Your subscription will be <strong className="text-amber-400">Pending</strong> until a Super Admin reviews and approves your payment.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 pt-2">
                                            <button onClick={() => setPaymentStep(2)} className="flex-1 py-4 bg-white/5 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-white/10">Edit</button>
                                            <button
                                                onClick={handleSubmitPayment}
                                                disabled={isSubmitting}
                                                className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-emerald-500/30 hover:scale-105 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {isSubmitting ? <><RefreshCw size={14} className="animate-spin" /> Submitting...</> : <><CheckCircle2 size={14} /> Confirm Payment</>}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>


            <AnimatePresence>
                {isNewPlanOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-background/80 backdrop-blur-xl">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-10 max-w-xl w-full relative shadow-2xl"
                        >
                            <h3 className="text-3xl font-black text-white mb-8">Architect New Plan</h3>
                            <form onSubmit={handleCreatePlan} className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-2 block">Plan Identity</label>
                                    <input
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-primary transition-all"
                                        placeholder="e.g. Gold Resident Tier"
                                        value={newPlan.name}
                                        onChange={e => setNewPlan({ ...newPlan, name: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-2 block">Monthly Protocol (PHP)</label>
                                        <input
                                            required
                                            type="number"
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-primary transition-all"
                                            placeholder="99.00"
                                            value={newPlan.price}
                                            onChange={e => setNewPlan({ ...newPlan, price: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-2 block">Accessibility</label>
                                        <div className="flex items-center gap-2 p-4 bg-white/5 rounded-2xl border border-white/10 text-emerald-400">
                                            <ShieldCheck size={18} />
                                            <span className="text-xs font-black uppercase">Live Instance</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-2 block">Executive Summary</label>
                                    <textarea
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-medium outline-none focus:border-primary transition-all h-32"
                                        placeholder="Briefly describe the value proposition..."
                                        value={newPlan.description}
                                        onChange={e => setNewPlan({ ...newPlan, description: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-2 block">Capabilities (One per line)</label>
                                    <textarea
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-medium outline-none focus:border-primary transition-all h-32"
                                        placeholder="Clearance Level 4&#10;Priority Reservation&#10;24/7 Logistics Support"
                                        value={newPlan.features}
                                        onChange={e => setNewPlan({ ...newPlan, features: e.target.value })}
                                    />
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsNewPlanOpen(false)}
                                        className="flex-1 py-4 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px]"
                                    >
                                        Abort
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20"
                                    >
                                        Deploy Plan
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Plans;
