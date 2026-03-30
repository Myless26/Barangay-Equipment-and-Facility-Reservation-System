import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardCheck, AlertTriangle, History, Wrench, Search, Gauge, Package, Zap, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { NotificationContext, TenantContext } from '../contexts/AppContext';
import { supabase } from '../supabaseClient';

const CustodianPortal = () => {
    const { notify } = useContext(NotificationContext);
    const { currentTenant } = useContext(TenantContext);

    const [maintenanceAlerts, setMaintenanceAlerts] = useState([]);
    const [recentReturns, setRecentReturns] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (currentTenant?.id) {
            fetchData();
        }
    }, [currentTenant?.id]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: equipData } = await supabase
                .from('equipment')
                .select('*')
                .eq('tenant_id', currentTenant.id)
                .gt('maintenance', 0);

            setMaintenanceAlerts(equipData || []);

            const { data: returnData } = await supabase
                .from('reservations')
                .select('*')
                .eq('tenant_id', currentTenant.id)
                .eq('status', 'Completed')
                .limit(5);

            setRecentReturns(returnData || []);

        } catch (error) {
            console.error('Error fetching custodian data:', error);
            notify('Failed to sync logistics terminal', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApproveReturn = async (id) => {
        try {
            const { error } = await supabase
                .from('reservations')
                .update({ status: 'Completed' })
                .eq('id', id);
            if (error) throw error;
            setRecentReturns(prev => prev.filter(r => r.id !== id));
            notify('Return validated and archived successfully.', 'success');
        } catch (err) {
            console.error('Error approving return:', err);
            notify('Return validation failed.', 'error');
        }
    };

    const handleFlagIssue = async (returnItem) => {
        try {
            const { error } = await supabase
                .from('reservations')
                .update({ status: 'Flagged' })
                .eq('id', returnItem.id);
            if (error) throw error;
            setRecentReturns(prev => prev.map(r => r.id === returnItem.id ? { ...r, status: 'Flagged' } : r));
            notify(`Issue flagged for ${returnItem.title || 'this return'}. Pending investigation.`, 'warning');
        } catch (err) {
            console.error('Error flagging issue:', err);
            notify('Failed to flag issue.', 'error');
        }
    };

    const handleDiagnose = async (alert) => {
        try {
            const { error } = await supabase
                .from('equipment')
                .update({ health: 'Under Maintenance' })
                .eq('id', alert.id);
            if (error) throw error;
            setMaintenanceAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, health: 'Under Maintenance' } : a));
            notify(`${alert.name} moved to active maintenance queue.`, 'info');
        } catch (err) {
            console.error('Error starting diagnosis:', err);
            notify('Failed to initiate diagnosis.', 'error');
        }
    };

    return (
        <div className="space-y-10 pb-10 relative">
            {/* Ambient Backgrounds */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-20 left-0 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-[2rem] bg-secondary/10 flex items-center justify-center border border-secondary/20 shadow-[-10px_-10px_30px_rgba(255,255,255,0.02),10px_10px_30px_rgba(16,185,129,0.1)] relative overflow-hidden group">
                        <Wrench className="text-secondary relative z-10" size={32} />
                        <motion.div
                            animate={{ rotate: -360 }}
                            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-0 bg-gradient-to-bl from-secondary/0 via-secondary/10 to-secondary/0"
                        />
                    </div>
                    <div>
                        <h2 className="text-4xl font-black tracking-tighter text-white">Logistics <span className="text-secondary">Nexus</span></h2>
                        <p className="text-slate-400 mt-1 font-medium italic text-sm">Advanced asset calibration and automated health protocols.</p>
                    </div>
                </div>
                
                <div className="flex gap-4">
                    <button
                        onClick={() => notify('Maintenance archives retrieved', 'info')}
                        className="px-6 py-3 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2 text-slate-300 shadow-xl"
                    >
                        <History size={16} /> Audit Logs
                    </button>
                    <button
                        onClick={() => notify('New diagnostic event initiated', 'warning')}
                        className="px-6 py-3 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:shadow-[0_0_30px_rgba(239,68,68,0.4)] hover:bg-red-500 hover:text-white transition-all group"
                    >
                        <AlertTriangle size={18} className="group-hover:animate-bounce" /> Report Critical Issue
                    </button>
                </div>
            </div>

            {/* Quick Diagnostic Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
                {[
                    { label: 'System Health', val: '98.2%', color: 'text-primary', glow: 'shadow-[0_0_20px_rgba(59,130,246,0.1)]', icon: <Gauge size={20} /> },
                    { label: 'Critical Errors', val: `${maintenanceAlerts.length} Units`, color: 'text-red-400', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]', icon: <AlertTriangle size={20} className="animate-pulse" /> },
                    { label: 'Cycles Validated', val: '42 Scans', color: 'text-secondary', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.1)]', icon: <ShieldCheck size={20} /> },
                    { label: 'Fleet Valuation', val: 'P1.24M', color: 'text-white', glow: 'shadow-[0_0_20px_rgba(255,255,255,0.05)]', icon: <Package size={20} /> },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`bg-slate-900/40 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all cursor-crosshair ${stat.glow}`}
                    >
                        <div className="flex items-center gap-3 mb-4 text-slate-500">
                            <div className="p-2 rounded-xl bg-white/5 border border-white/5 group-hover:bg-white/10 transition-colors">
                                {stat.icon}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{stat.label}</span>
                        </div>
                        <p className={`text-3xl font-black tracking-tighter ${stat.color} drop-shadow-lg`}>{stat.val}</p>
                        
                        <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
                {/* Maintenance Queue */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <Wrench size={20} className="text-secondary" />
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-secondary border-b border-secondary/20 pb-1">Calibration Queue</h3>
                        </div>
                        <span className="text-[10px] font-black bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl text-slate-400 tracking-widest uppercase shadow-inner">
                            {maintenanceAlerts.length} Active Alerts
                        </span>
                    </div>

                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="py-32 flex flex-col items-center justify-center bg-slate-900/30 rounded-[2rem] border border-white/5">
                                <div className="w-10 h-10 border-4 border-secondary/20 border-t-secondary rounded-full animate-spin mb-4" />
                                <span className="uppercase font-black text-[10px] tracking-[0.3em] text-secondary">Syncing Diagnostic Matrix</span>
                            </div>
                        ) : maintenanceAlerts.length === 0 ? (
                            <div className="py-32 flex flex-col items-center justify-center bg-slate-900/30 rounded-[2rem] border border-white/5 border-dashed">
                                <ShieldCheck size={48} className="text-secondary/50 mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">All equipment operating at peak efficiency.</p>
                            </div>
                        ) : (
                            <AnimatePresence>
                                {maintenanceAlerts.map((alert, idx) => (
                                    <motion.div
                                        key={alert.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 * idx }}
                                        className="bg-black/40 backdrop-blur-xl p-6 rounded-[2rem] border border-red-500/20 hover:border-red-500/40 border-l-[6px] border-l-red-500 transition-all cursor-pointer relative group overflow-hidden shadow-[0_0_20px_rgba(239,68,68,0.05)] hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]"
                                    >
                                        <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                                            <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                                        </div>

                                        <div className="flex items-start gap-4 mb-5 relative z-10">
                                            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 shadow-inner">
                                                <Zap size={20} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className="font-black text-white text-xl tracking-tight leading-none">{alert.name}</h4>
                                                    <span className="text-[8px] font-black tracking-[0.2em] bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/30 uppercase">
                                                        Code Red
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">{alert.category} Class</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-red-500/5 rounded-2xl border border-red-500/10 relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)]" />
                                                <p className="text-[10px] text-red-100 font-black uppercase tracking-widest">Health Grade: {alert.health || 'Critical'}</p>
                                            </div>
                                            <button onClick={() => handleDiagnose(alert)} className="text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center gap-2 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors">
                                                Diagnose <History size={14} />
                                            </button>
                                        </div>
                                        
                                        <div className="absolute right-[-20%] bottom-[-50%] w-64 h-64 bg-red-500/5 rounded-full blur-[40px] pointer-events-none group-hover:bg-red-500/10 transition-colors" />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                </div>

                {/* Return Inspections */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="flex items-center gap-3 px-2">
                        <ClipboardCheck size={20} className="text-primary" />
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary border-b border-primary/20 pb-1">Inbound Validation Logic</h3>
                    </div>

                    <div className="bg-slate-900/40 backdrop-blur-2xl shadow-2xl rounded-[2rem] overflow-hidden border border-white/5 relative">
                        <div className="bg-black/20 p-6 border-b border-white/5 flex items-center gap-4 relative z-20">
                            <Search size={20} className="text-slate-500" />
                            <input
                                type="text"
                                placeholder="Scan archived return protocols..."
                                className="bg-transparent border-none text-sm font-medium focus:outline-none w-full text-white placeholder-slate-600"
                            />
                            <div className="px-3 py-1 rounded bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
                                Live Feed
                            </div>
                        </div>

                        <div className="divide-y divide-white/5 relative z-10">
                            {isLoading ? (
                                <div className="py-32 flex flex-col items-center justify-center">
                                    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
                                    <span className="uppercase font-black text-[10px] tracking-[0.3em] text-primary">Polling Gateway...</span>
                                </div>
                            ) : recentReturns.length === 0 ? (
                                <div className="py-32 text-center flex flex-col items-center">
                                    <ClipboardCheck size={48} className="text-slate-700 mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">No inbound asset returns pending validation.</p>
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {recentReturns.map((log, idx) => (
                                        <motion.div
                                            key={log.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.1 * idx }}
                                            className="p-6 hover:bg-white/[0.03] transition-colors group cursor-default relative"
                                        >
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-primary/50 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                            
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-14 h-14 rounded-2xl bg-black/40 flex items-center justify-center text-primary group-hover:text-white group-hover:bg-primary transition-all duration-500 border border-white/5 shadow-inner group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] group-hover:scale-110">
                                                        <ShieldCheck size={28} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xl font-black text-white tracking-tight mb-1">{log.resident || 'Unknown Resident'}</p>
                                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{log.title}</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-8 bg-black/20 p-4 rounded-2xl border border-white/5">
                                                    <div className="text-center md:text-right">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1 group-hover:text-secondary transition-colors">Condition Target</p>
                                                        <span className="text-secondary font-black text-xs uppercase tracking-widest drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">Excellent</span>
                                                    </div>
                                                    <div className="w-[1px] h-8 bg-white/10" />
                                                    <div className="text-center md:text-right">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1 group-hover:text-primary transition-colors">Final Valid</p>
                                                        <span className="text-white font-black text-xs uppercase tracking-widest drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">Clean</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-end gap-3 mt-4 md:mt-0 md:absolute right-6 top-1/2 md:-translate-y-1/2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all">
                                                <button onClick={() => handleFlagIssue(log)} className="px-5 py-2.5 rounded-xl bg-black/40 border border-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white hover:bg-white/10 hover:border-white/20 transition-all">
                                                    Flag Issue
                                                </button>
                                                <button onClick={() => handleApproveReturn(log.id)} className="px-5 py-2.5 rounded-xl bg-primary hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] flex items-center gap-2 transition-all">
                                                    Approve Return <CheckCircle2 size={14} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-xl blur-[80px] pointer-events-none" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustodianPortal;
