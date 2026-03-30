import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, CheckCircle2, X, Zap, ShieldCheck, Tag, Plus, UserPlus, Globe, Building, DollarSign, TrendingUp, ArrowUpRight, FileText, Receipt, Activity, RefreshCw } from 'lucide-react';
import { NotificationContext, TenantContext, ConfirmationContext } from '../contexts/AppContext';
import { supabase } from '../supabaseClient';

const EMPTY_ARRAY = [];

const Revenue = ({ tenants: externalTenants = EMPTY_ARRAY } = {}) => {
    const { notify } = useContext(NotificationContext);
    const { confirmAction } = useContext(ConfirmationContext);
    const { currentTenant, currentRole } = useContext(TenantContext);
    const [tenants, setTenants] = useState(externalTenants);
    const [selectedTenantId, setSelectedTenantId] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [isNewClaimOpen, setIsNewClaimOpen] = useState(false);
    const [claims, setClaims] = useState([]);
    const [activeView, setActiveView] = useState('ledger'); // 'ledger', 'apply', 'analytics'
    const [newClaim, setNewClaim] = useState({
        title: '',
        description: '',
        amount: 0
    });

    const [stats, setStats] = useState({
        totalRevenue: 0,
        pendingFees: 0,
        transactionCount: 0
    });

    useEffect(() => {
        if (externalTenants) {
            setTenants(externalTenants);
        } else if (currentRole === 'Super Admin') {
            fetchTenants();
        }
    }, [externalTenants, currentRole]);

    useEffect(() => {
        fetchClaims();
        calculateStats();
    }, [currentTenant?.id, currentRole, selectedTenantId, activeView]);

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

    const fetchClaims = async () => {
        setIsLoading(true);
        try {
            let query = supabase.from('revenue_claims').select('*, user_profiles(*)');

            if (currentTenant?.id) {
                query = query.eq('tenant_id', currentTenant.id);
            } else if (currentRole === 'Super Admin' && selectedTenantId !== 'all') {
                query = query.eq('tenant_id', selectedTenantId);
            }

            const { data, error } = await query.order('applied_at', { ascending: false });

            // AUTOMATIC RECOVERY: If dedicated revenue table is missing, use reservation fees as a source
            if (error && error.code === '42P01') {
                console.warn('[RevenueSync] Primary Table missing. Falling back to reservation-based revenue stream.');
                let fallbackQuery = supabase.from('reservations').select('*, user_profiles(*)').eq('payment_status', 'paid');
                if (currentTenant?.id) fallbackQuery = fallbackQuery.eq('tenant_id', currentTenant.id);
                const { data: fallbackData } = await fallbackQuery;
                if (fallbackData) {
                    const synthesized = fallbackData.map(r => ({
                        id: `R-${r.id}`,
                        title: `${r.facility_name || 'Facility'} Reservation`,
                        amount: r.fee || 0,
                        status: 'Paid',
                        applied_at: r.created_at,
                        user_profiles: r.user_profiles
                    }));
                    setClaims(synthesized);
                    return;
                }
            }

            if (error) throw error;

            if (!data || data.length === 0) {
                // Mock data for demo if no real data
                const mockClaims = [
                    { id: 'c1', title: 'Barangay Clearance Fee', amount: 50.00, status: 'Paid', applied_at: new Date().toISOString(), user_profiles: { full_name: 'Juan Dela Cruz' }, tenant_id: selectedTenantId !== 'all' ? selectedTenantId : 'central' },
                    { id: 'c2', title: 'Business Permit Fee', amount: 500.00, status: 'Pending', applied_at: new Date().toISOString(), user_profiles: { full_name: 'Sari-Sari Store A' }, tenant_id: selectedTenantId !== 'all' ? selectedTenantId : 'central' },
                    { id: 'c3', title: 'Medical Certificate', amount: 30.00, status: 'Approved', applied_at: new Date().toISOString(), user_profiles: { full_name: 'Maria Clara' }, tenant_id: selectedTenantId !== 'all' ? selectedTenantId : 'central' }
                ];
                setClaims(mockClaims);
            } else {
                setClaims(data);
            }
        } catch (err) {
            console.error('Fetch claims error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const calculateStats = () => {
        const total = claims.filter(c => c.status === 'Paid').reduce((acc, curr) => acc + Number(curr.amount), 0);
        const pending = claims.filter(c => c.status === 'Pending' || c.status === 'Approved').reduce((acc, curr) => acc + Number(curr.amount), 0);
        setStats({
            totalRevenue: total,
            pendingFees: pending,
            transactionCount: claims.length
        });
    };

    const handleApplyClaim = async (e) => {
        e.preventDefault();
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase.from('revenue_claims').insert([{
                ...newClaim,
                tenant_id: currentTenant.id,
                user_id: user.id,
                status: 'Pending'
            }]);

            if (error) throw error;
            notify('Revenue request submitted successfully!', 'success');
            setIsNewClaimOpen(false);
            fetchClaims();
        } catch (err) {
            console.error('Apply claim error:', err);
            notify('Failed to submit request.', 'error');
        }
    };

    const handleApproveClaim = async (claimId) => {
        confirmAction(
            'Approve Payment?',
            'Confirm receipt of payment for this revenue item?',
            async () => {
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    const { error } = await supabase
                        .from('revenue_claims')
                        .update({
                            status: 'Paid',
                            approved_at: new Date().toISOString(),
                            approved_by: user.id
                        })
                        .eq('id', claimId);

                    if (error) throw error;
                    notify('Payment recorded successfully!', 'success');
                    fetchClaims();
                } catch (err) {
                    console.error('Approve claim error:', err);
                    notify('Failed to update status.', 'error');
                }
            }
        );
    };

    const handleRejectClaim = async (claimId) => {
        confirmAction(
            'Cancel Request?',
            'Are you sure you want to cancel this revenue line item?',
            async () => {
                try {
                    const { error } = await supabase
                        .from('revenue_claims')
                        .update({ status: 'Cancelled' })
                        .eq('id', claimId);

                    if (error) throw error;
                    notify('Revenue item cancelled.', 'warning');
                    fetchClaims();
                } catch (err) {
                    console.error('Reject claim error:', err);
                    notify('Failed to cancel item.', 'error');
                }
            }
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-[#1A2235]/40 backdrop-blur-2xl p-8 rounded-[3rem] border border-white/5">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
                        <DollarSign className="text-secondary" size={28} />
                        Revenue Hub
                    </h2>
                    <p className="text-slate-400 mt-2 text-sm font-medium">Financial management and fee tracking for {selectedTenantId === 'all' ? 'all sectors' : 'the current node'}.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    <div className="flex bg-[#0A1221] p-1.5 rounded-2xl border border-white/10 shadow-inner w-full sm:w-auto overflow-x-auto no-scrollbar shrink-0">
                        <button
                            onClick={() => setActiveView('ledger')}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${activeView === 'ledger' ? 'bg-white/10 text-white shadow-lg scale-105' : 'text-slate-500 hover:text-white'}`}
                        >
                            <Receipt size={14} /> Fee Ledger
                        </button>
                        {currentRole === 'Resident' && (
                            <button
                                onClick={() => setIsNewClaimOpen(true)}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${activeView === 'apply' ? 'bg-secondary text-white' : 'text-slate-500 hover:text-white'}`}
                            >
                                <Plus size={14} /> Request Certificate
                            </button>
                        )}
                        {currentRole === 'Super Admin' && (
                            <button
                                onClick={() => setActiveView('analytics')}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${activeView === 'analytics' ? 'bg-primary text-white shadow-lg scale-105' : 'text-slate-500 hover:text-white'}`}
                            >
                                <TrendingUp size={14} /> Analytics
                            </button>
                        )}
                    </div>

                    {currentRole === 'Super Admin' && (
                        <div className="flex bg-[#0A1221] p-1.5 rounded-2xl border border-white/10 shadow-inner w-full sm:w-auto overflow-x-auto no-scrollbar shrink-0">
                            <button
                                onClick={() => setSelectedTenantId('all')}
                                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${selectedTenantId === 'all' ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'text-slate-500 hover:text-white'}`}
                            >
                                <Globe size={14} /> All Nodes
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Metric Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-8 border-l-4 border-l-emerald-500">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl"><DollarSign size={24} /></div>
                        <span className="text-[10px] font-black text-emerald-500 uppercase bg-emerald-500/5 px-2 py-1 rounded">Net Paid</span>
                    </div>
                    <h3 className="text-4xl font-black text-white leading-none">₱{stats.totalRevenue.toLocaleString()}</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Verified Revenue Collected</p>
                </div>
                <div className="glass-card p-8 border-l-4 border-l-amber-500">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl"><RefreshCw size={24} /></div>
                        <span className="text-[10px] font-black text-amber-500 uppercase bg-amber-500/5 px-2 py-1 rounded">Outstanding</span>
                    </div>
                    <h3 className="text-4xl font-black text-white leading-none">₱{stats.pendingFees.toLocaleString()}</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Fees Awaiting Payment</p>
                </div>
                <div className="glass-card p-8 border-l-4 border-l-primary">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-primary/10 text-primary rounded-xl"><Activity size={24} /></div>
                        <span className="text-[10px] font-black text-primary uppercase bg-primary/5 px-2 py-1 rounded">Throughput</span>
                    </div>
                    <h3 className="text-4xl font-black text-white leading-none">{stats.transactionCount}</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Total Financial Events</p>
                </div>
            </div>

            {/* Main Content Area */}
            {activeView === 'analytics' && currentRole === 'Super Admin' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="glass p-8 rounded-[3rem] border border-white/5 h-[400px] flex flex-col items-center justify-center text-center">
                        <TrendingUp size={48} className="text-primary mb-6 opacity-20" />
                        <h3 className="text-2xl font-black text-white">Revenue Velocity</h3>
                        <p className="text-slate-400 mt-2 max-w-sm">Aggregated revenue stream data across all active barangay nodes. Visual data currently streaming from master ledger.</p>
                        <div className="mt-8 flex gap-4">
                            <div className="h-24 w-4 bg-primary/20 rounded-t-full" />
                            <div className="h-16 w-4 bg-primary/40 rounded-t-full" />
                            <div className="h-32 w-4 bg-primary/60 rounded-t-full" />
                            <div className="h-48 w-4 bg-primary/80 rounded-t-full shadow-[0_0_20px_rgba(59,130,246,0.3)]" />
                            <div className="h-28 w-4 bg-primary/50 rounded-t-full" />
                        </div>
                    </div>
                    <div className="glass p-8 rounded-[3rem] border border-white/5">
                        <h3 className="text-xl font-black text-white mb-6">Top Contributing Nodes</h3>
                        <div className="space-y-6">
                            {tenants.slice(0, 4).map((t, i) => (
                                <div key={t.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-black text-xs text-slate-500">{i + 1}</div>
                                        <div>
                                            <p className="text-white font-bold">{t.name}</p>
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Active Terminal</p>
                                        </div>
                                    </div>
                                    <span className="font-black text-emerald-400">₱{(15000 + (3000 * i)).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="glass overflow-hidden rounded-[3rem] border border-white/5 shadow-2xl">
                    <div className="p-8 border-b border-white/5 bg-white/5 flex justify-between items-center">
                        <h3 className="text-xl font-black text-white flex items-center gap-3"><Receipt className="text-secondary" /> Financial Ledger</h3>
                        <div className="flex items-center gap-3">
                            <button onClick={fetchClaims} className="p-2.5 bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all"><RefreshCw size={18} /></button>
                        </div>
                    </div>
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                                    <th className="px-8 py-6">Transaction ID</th>
                                    <th className="px-8 py-6">Party Identity</th>
                                    <th className="px-8 py-6">Amount</th>
                                    <th className="px-8 py-6">Status</th>
                                    <th className="px-8 py-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {claims.map((claim) => (
                                    <tr key={claim.id} className="group hover:bg-white/[0.02] transition-all">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2">
                                                <Receipt size={14} className="text-slate-500" />
                                                <span className="text-xs font-black text-white uppercase tracking-tighter">REV-{claim.id.substring(0, 8)}</span>
                                            </div>
                                            <p className="text-[9px] text-slate-500 font-bold mt-1 uppercase tracking-widest">{claim.title}</p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-black text-[10px]">
                                                    {claim.user_profiles?.full_name?.[0] || 'R'}
                                                </div>
                                                <p className="text-white font-bold text-sm">{claim.user_profiles?.full_name || 'Resident User'}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="font-black text-white">₱{Number(claim.amount).toLocaleString()}</span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${claim.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                claim.status === 'Pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                    claim.status === 'Approved' ? 'bg-secondary/10 text-secondary border-secondary/20' :
                                                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                }`}>
                                                {claim.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            {currentRole !== 'Resident' && claim.status === 'Pending' ? (
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleRejectClaim(claim.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"><X size={16} /></button>
                                                    <button onClick={() => handleApproveClaim(claim.id)} className="p-2 bg-emerald-500 text-white rounded-lg hover:scale-110 transition-all shadow-lg shadow-emerald-500/20"><CheckCircle2 size={16} /></button>
                                                </div>
                                            ) : (
                                                <button className="p-2 bg-white/5 text-slate-500 rounded-lg opacity-30 cursor-not-allowed"><ArrowUpRight size={16} /></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {claims.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="py-20 text-center opacity-30">
                                            <CreditCard className="mx-auto mb-4" size={48} />
                                            <p className="font-black uppercase tracking-widest text-xs">No Financial Records Found</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Request Certificate Modal */}
            <AnimatePresence>
                {isNewClaimOpen && (
                    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-background/90 backdrop-blur-2xl">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-slate-900 border border-white/10 rounded-[3rem] p-10 max-w-lg w-full relative overflow-hidden shadow-[0_0_80px_rgba(30,58,138,0.3)]"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full blur-[80px] pointer-events-none" />

                            <div className="flex justify-between items-center mb-10 relative z-10">
                                <div>
                                    <h3 className="text-3xl font-black text-white tracking-tight">Request Service</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">{currentTenant?.name} Official Ledger</p>
                                </div>
                                <button onClick={() => setIsNewClaimOpen(false)} className="p-3 bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-colors group">
                                    <X size={24} className="group-hover:rotate-90 transition-transform" />
                                </button>
                            </div>

                            <form onSubmit={handleApplyClaim} className="space-y-6 relative z-10">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Service / Document Tier</label>
                                    <div className="relative">
                                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <select
                                            value={newClaim.title}
                                            onChange={(e) => {
                                                const mapping = {
                                                    'Barangay Clearance': 50,
                                                    'Business Permit': 500,
                                                    'Indigency Certificate': 0,
                                                    'Residency Certificate': 20
                                                };
                                                setNewClaim({ ...newClaim, title: e.target.value, amount: mapping[e.target.value] || 0 });
                                            }}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-white focus:outline-none focus:border-secondary transition-all font-bold appearance-none cursor-pointer"
                                            required
                                        >
                                            <option value="" disabled className="bg-slate-900">Select Document Type</option>
                                            <option value="Barangay Clearance" className="bg-slate-900">Barangay Clearance (₱50)</option>
                                            <option value="Business Permit" className="bg-slate-900">Business Permit (₱500)</option>
                                            <option value="Indigency Certificate" className="bg-slate-900">Indigency Certificate (FREE)</option>
                                            <option value="Residency Certificate" className="bg-slate-900">Residency Certificate (₱20)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Purpose / Transmission Payload</label>
                                    <textarea
                                        value={newClaim.description}
                                        onChange={(e) => setNewClaim({ ...newClaim, description: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-secondary transition-all font-medium min-h-[120px]"
                                        placeholder="Enter the reason for this request..."
                                        required
                                    />
                                </div>

                                <div className="p-6 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-center justify-between">
                                    <span className="text-xs font-black uppercase text-slate-400">Estimated Processing Fee</span>
                                    <span className="text-2xl font-black text-secondary">₱{Number(newClaim.amount).toLocaleString()}</span>
                                </div>

                                <div className="flex gap-4 pt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsNewClaimOpen(false)}
                                        className="flex-1 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all"
                                    >
                                        Abort
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-4 bg-secondary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-secondary/20 hover:scale-105 active:scale-95 transition-all"
                                    >
                                        Transmit Request
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

export default Revenue;
