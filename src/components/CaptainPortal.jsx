import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck, Star, Clock, CheckCircle2,
    XCircle, BarChart3, TrendingUp, Zap,
    Target, Crown, Fingerprint, UserPlus, Key
} from 'lucide-react';
import { NotificationContext, TenantContext } from '../contexts/AppContext';
import { supabase } from '../supabaseClient';

const CaptainPortal = () => {
    const { notify } = useContext(NotificationContext);
    const { currentTenant } = useContext(TenantContext);

    const [specialRequests, setSpecialRequests] = useState([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(true);
    const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'Secretary' });
    const [isProvisioning, setIsProvisioning] = useState(false);

    useEffect(() => {
        if (currentTenant?.id) {
            fetchSpecialRequests();
        }
    }, [currentTenant?.id]);

    const fetchSpecialRequests = async () => {
        setIsLoadingRequests(true);
        try {
            const { data, error } = await supabase
                .from('reservations')
                .select('*')
                .eq('tenant_id', currentTenant.id)
                .eq('status', 'Pending')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSpecialRequests(data || []);
        } catch (error) {
            console.error('Error fetching requests:', error);
            notify('Failed to load mission directives', 'error');
        } finally {
            setIsLoadingRequests(false);
        }
    };

    const handleAction = async (id, action) => {
        const newStatus = action === 'approve' ? 'Approved' : 'Declined';
        try {
            const { error } = await supabase
                .from('reservations')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            setSpecialRequests(prev => prev.filter(r => r.id !== id));
            notify(
                action === 'approve' ? 'Request authorized by Captain' : 'Request declined for security review',
                action === 'approve' ? 'success' : 'error'
            );
        } catch (error) {
            console.error('Error processing request:', error);
            notify('Authentication Failure: Manual override required.', 'error');
        }
    };

    const handleAddStaff = async (e) => {
        e.preventDefault();
        setIsProvisioning(true);

        try {
            // Insert into residents table with role
            const { data, error } = await supabase
                .from('residents')
                .insert([{
                    name: newStaff.name,
                    email: newStaff.email,
                    phone: '',
                    address: '',
                    status: 'Verified',
                    role: newStaff.role,
                    tenant_id: currentTenant.id
                }])
                .select();

            if (error) throw error;

            // Sync with Auth System (localStorage for demo)
            const users = JSON.parse(localStorage.getItem('brgy_hub_users') || '[]');
            if (!users.find(u => u.email === newStaff.email)) {
                users.push({
                    email: newStaff.email,
                    password: newStaff.password || 'staff123',
                    name: newStaff.name,
                    role: newStaff.role
                });
                localStorage.setItem('brgy_hub_users', JSON.stringify(users));
                console.log('[AuthSync] Staff credentials provisioned in local vault.');
            }

            notify(`Successfully provisioned ${newStaff.role} access for ${newStaff.name}`, 'success');
            setNewStaff({ name: '', email: '', password: '', role: 'Secretary' });
        } catch (error) {
            console.error('Error adding staff:', error);
            notify('Provisioning Error: Identity conflict detected.', 'error');
        } finally {
            setIsProvisioning(false);
        }
    };

    return (
        <div className="space-y-10 pb-10 relative">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-amber-500/10 blur-[150px] rounded-full pointer-events-none" />

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-amber-500/20 to-orange-600/10 flex items-center justify-center border border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.15)] relative overflow-hidden z-10 backdrop-blur-xl group-hover:shadow-[0_0_50px_rgba(245,158,11,0.3)] transition-all duration-500">
                            <Crown className="text-amber-400 group-hover:scale-110 transition-transform duration-500 relative z-20 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" size={40} />
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(245,158,11,0.4)_360deg)]"
                            />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-5xl font-black tracking-tighter text-white drop-shadow-md">Captain's <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Command</span></h2>
                        <p className="text-slate-400 mt-2 font-medium italic text-sm tracking-wide">Strategic oversight and executive mission approvals.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-6 py-3.5 rounded-2xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                    <div className="relative flex items-center justify-center">
                        <Fingerprint className="text-amber-400 relative z-10" size={18} />
                        <span className="absolute w-full h-full bg-amber-400/50 blur-[10px] rounded-full animate-pulse" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Biometric Session Locked</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
                {/* Special Requests Flow */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="flex items-center gap-3 px-2">
                        <Target size={22} className="text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]" />
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-amber-400 border-b border-amber-500/20 pb-1">Priority Directives</h3>
                    </div>

                    <div className="space-y-5">
                        {isLoadingRequests ? (
                            <div className="py-32 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5">
                                <div className="relative">
                                    <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Target size={20} className="text-amber-500/50" />
                                    </div>
                                </div>
                                <div className="mt-6 text-amber-500 font-black tracking-[0.3em] uppercase text-[10px] animate-pulse">Scanning Decision Matrix...</div>
                            </div>
                        ) : specialRequests.length === 0 ? (
                            <div className="py-32 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 border-dashed group hover:border-white/10 transition-colors cursor-crosshair">
                                <ShieldCheck size={48} className="text-slate-700 mb-4 group-hover:text-amber-500/30 transition-colors" />
                                <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">No pending directives found in current sector.</p>
                            </div>
                        ) : (
                            <AnimatePresence>
                                {specialRequests.map((req, idx) => (
                                    <motion.div
                                        key={req.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="bg-slate-900/60 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/5 relative group overflow-hidden hover:border-amber-500/30 transition-all duration-500 flex flex-col md:flex-row md:items-center justify-between gap-8 shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
                                    >
                                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-400 to-orange-600 opacity-50 group-hover:opacity-100 transition-opacity" />

                                        <div className="space-y-5 relative z-10 flex-1">
                                            <div className="flex items-center gap-4">
                                                <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-inner">
                                                    <Zap size={18} />
                                                    <div className="absolute top-[-2px] right-[-2px] w-2.5 h-2.5 bg-red-500 rounded-full animate-ping opacity-75" />
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-amber-400 mb-1 block drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">HQ Override Protocol</span>
                                                    <h4 className="text-3xl font-black text-white tracking-tighter leading-none">{req.title || 'Classified Request'}</h4>
                                                </div>
                                            </div>

                                            <div className="p-4 bg-black/40 rounded-2xl border border-white/5 shadow-inner">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em]">Context Report</p>
                                                    <span className="text-[9px] text-slate-400 font-bold bg-white/5 px-2 py-0.5 rounded uppercase tracking-widest">{req.facility || 'LOGISTICS'} Core</span>
                                                </div>
                                                <p className="text-sm text-slate-300 font-medium leading-relaxed max-w-lg">Resident <strong className="text-white">{req.resident || 'Unknown Entity'}</strong> requires executive clearance for utilization.</p>
                                            </div>

                                            <div className="flex items-center gap-6 p-1">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                                                    <Clock size={14} className="text-secondary" /> {req.reservation_date || req.date}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 relative z-10 shrink-0">
                                            <button
                                                onClick={() => handleAction(req.id, 'decline')}
                                                className="w-16 h-16 rounded-2xl bg-black/50 text-slate-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border border-white/5 group/btn shadow-inner hover:shadow-[0_0_30px_rgba(239,68,68,0.4)]"
                                            >
                                                <XCircle size={28} className="group-hover/btn:scale-110 transition-transform" />
                                            </button>
                                            <button
                                                onClick={() => handleAction(req.id, 'approve')}
                                                className="px-8 py-0 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-black text-[11px] uppercase tracking-[0.2em] flex flex-col items-center justify-center gap-1 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_40px_rgba(245,158,11,0.5)] hover:scale-105 active:scale-95 transition-all group/approve"
                                            >
                                                <CheckCircle2 size={24} className="group-hover/approve:-translate-y-1 transition-transform" />
                                                <span>Authorize</span>
                                            </button>
                                        </div>
                                        <div className="absolute -right-20 -top-20 w-80 h-80 bg-amber-500/5 rounded-full blur-[80px] group-hover:bg-amber-500/10 transition-colors pointer-events-none" />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>

                    {/* Staff Management Section */}
                    <div className="mt-16 relative">
                        <div className="flex items-center gap-3 px-2 mb-6">
                            <ShieldCheck size={22} className="text-secondary drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-secondary border-b border-secondary/20 pb-1">Personnel Provisioning</h3>
                        </div>

                        <div className="bg-slate-900/60 backdrop-blur-2xl p-8 lg:p-10 rounded-[2.5rem] border border-white/5 relative overflow-hidden shadow-2xl">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 blur-[100px] rounded-full pointer-events-none" />

                            <div className="relative z-10 mb-8">
                                <h4 className="text-3xl font-black text-white tracking-tighter mb-2">Deploy Field Operative</h4>
                                <p className="text-sm text-slate-400 max-w-lg font-medium">Generate encrypted credentials for local administrators and secretaries. Isolation protocols restrict them to this domain node.</p>
                            </div>

                            <form onSubmit={handleAddStaff} className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2 mb-2 block border-l-2 border-secondary/50 pl-2">Operative Designation</label>
                                    <input required type="text" value={newStaff.name} onChange={e => setNewStaff({ ...newStaff, name: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-5 focus:border-secondary focus:bg-black/60 transition-all text-white font-medium focus:outline-none focus:ring-1 focus:ring-secondary/50" placeholder="Juan Dela Cruz" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2 mb-2 block border-l-2 border-secondary/50 pl-2">Clearance Level</label>
                                    <select value={newStaff.role} onChange={e => setNewStaff({ ...newStaff, role: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-5 focus:border-secondary focus:bg-black/60 transition-all text-white font-black uppercase text-xs tracking-widest appearance-none focus:outline-none focus:ring-1 focus:ring-secondary/50 cursor-pointer">
                                        <option value="Secretary">Level 1: Secretary</option>
                                        <option value="Barangay Admin">Level 2: Administrator</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2 mb-2 block border-l-2 border-secondary/50 pl-2">Secure Link (Email)</label>
                                    <input required type="email" value={newStaff.email} onChange={e => setNewStaff({ ...newStaff, email: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-5 focus:border-secondary focus:bg-black/60 transition-all text-white font-medium focus:outline-none focus:ring-1 focus:ring-secondary/50" placeholder="secure.node@casisang.gov.ph" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2 mb-2 block border-l-2 border-secondary/50 pl-2">Encryption Key (Password)</label>
                                    <div className="relative">
                                        <input required type="password" value={newStaff.password} onChange={e => setNewStaff({ ...newStaff, password: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-5 focus:border-secondary focus:bg-black/60 transition-all text-white font-medium focus:outline-none focus:ring-1 focus:ring-secondary/50 pr-12" placeholder="••••••••" />
                                        <Key size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-600" />
                                    </div>
                                </div>

                                <div className="md:col-span-2 pt-4">
                                    <button
                                        type="submit"
                                        disabled={isProvisioning}
                                        className="py-4 bg-secondary hover:bg-emerald-500 text-slate-900 text-xs font-black uppercase tracking-[0.3em] rounded-2xl flex items-center justify-center gap-3 w-full transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] hover:scale-[1.01] active:scale-[0.99] border hover:border-white/50"
                                    >
                                        {isProvisioning ? 'PROVISIONING LINK...' : 'Generate Node Access'} <UserPlus size={18} />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Strategic Metrics */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="flex items-center gap-3 px-2">
                        <BarChart3 size={22} className="text-secondary drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-secondary border-b border-secondary/20 pb-1">System Pulse</h3>
                    </div>

                    <div className="bg-slate-900/60 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/5 space-y-8 relative overflow-hidden shadow-2xl group hover:border-white/10 transition-colors">
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Bandwidth Load</span>
                                <span className="text-xl font-black text-secondary drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">88% CAP</span>
                            </div>
                            <div className="w-full bg-black/50 h-4 rounded-full overflow-hidden p-[2px] border border-white/5 shadow-inner">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: '88%' }}
                                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                                    className="h-full bg-gradient-to-r from-secondary to-emerald-400 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.8)] relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[shimmer_1s_linear_infinite]" />
                                </motion.div>
                            </div>
                        </div>

                        <div className="space-y-4 relative z-10">
                            <div className="flex items-center gap-5 p-5 rounded-2xl bg-black/40 border border-white/5 hover:border-secondary/30 hover:bg-secondary/5 transition-all group/stat cursor-crosshair">
                                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20 shadow-inner group-hover/stat:scale-110 transition-transform">
                                    <TrendingUp size={24} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mb-1">Vector Trend</p>
                                    <p className="text-lg font-black text-white">+14.2% Peak</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-5 p-5 rounded-2xl bg-black/40 border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all group/stat cursor-crosshair">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner group-hover/stat:scale-110 transition-transform">
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mb-1">Defense Array</p>
                                    <p className="text-lg font-black text-white">92.4% Optimal</p>
                                </div>
                            </div>
                        </div>

                        <button className="w-full py-4 bg-black/40 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white/10 hover:text-white transition-all text-slate-500 relative z-10 active:scale-95">
                            Extract Audit Logs
                        </button>

                        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-secondary/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-secondary/20 transition-colors" />
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes shimmer {
                    from { background-position: 1rem 0; }
                    to { background-position: 0 0; }
                }
            `}</style>
        </div>
    );
};

export default CaptainPortal;
