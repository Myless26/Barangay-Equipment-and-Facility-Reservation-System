import React, { useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Archive as ArchiveIcon, RefreshCw, Trash2, Search, AlertCircle, Database, Shield } from 'lucide-react';
import { TenantContext, NotificationContext } from '../contexts/AppContext';
import { supabase } from '../supabaseClient';

const Archive = () => {
    const { currentTenant } = useContext(TenantContext);
    const { notify } = useContext(NotificationContext);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('All');
    const [archivedItems, setArchivedItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchArchive();
    }, [currentTenant?.id]);

    const fetchArchive = async () => {
        setIsLoading(true);
        console.log(`[Sync] Accessing Protocol Archive: ${currentTenant?.id ? currentTenant.name : '(GLOBAL HUB)'}`);
        try {
            let query = supabase.from('reservations').select('*').in('status', ['Completed', 'Cancelled', 'Declined']);

            if (currentTenant?.id) {
                query = query.eq('tenant_id', currentTenant.id);
            }

            const { data, error } = await query;

            if (error) throw error;
            setArchivedItems(data || []);
        } catch (error) {
            console.error('Error fetching archive:', error);
            notify('Failed to sync with secure vault', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const displayedItems = archivedItems.filter(item => {
        const matchesSearch = (item.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (item.resident?.toLowerCase() || '').includes(searchQuery.toLowerCase());
        const matchesType = filterType === 'All' || item.facility === filterType;
        return matchesSearch && matchesType;
    });

    const categories = ['All', 'Multi Purpose Hall', 'Covered Court', 'Barangay Hall', 'Tools'];

    const handleRestore = async (id) => {
        try {
            const { error } = await supabase
                .from('reservations')
                .update({ status: 'Pending' })
                .eq('id', id);

            if (error) throw error;
            setArchivedItems(prev => prev.filter(item => item.id !== id));
            notify('Record restored to active registry', 'success');
        } catch (error) {
            notify('Restoration failed: Checksum mismatch.', 'error');
        }
    };

    const handlePurge = async (id) => {
        try {
            const { error } = await supabase
                .from('reservations')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setArchivedItems(prev => prev.filter(item => item.id !== id));
            notify('Record permanently purged from secure vault.', 'success');
        } catch (error) {
            console.error('Error purging record:', error);
            notify('Purge failed: Integrity lock engaged.', 'error');
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-gradient flex items-center gap-4">
                        <ArchiveIcon className="text-primary" size={32} />
                        Protocol Archive
                    </h2>
                    <p className="text-slate-400 mt-2 font-medium">
                        Secure cold storage for <span className="text-white font-black uppercase tracking-widest">{currentTenant?.name || 'Local Instance'}</span>.
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-red-500/10 text-red-500 px-6 py-3 rounded-2xl border border-red-500/20 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-red-500/5">
                    <Shield size={16} /> Restricted Data Access
                </div>
            </div>

            <div className="glass p-2 rounded-[2rem] border-white/5 flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search encrypted records or deletion logic..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-background/50 border-none rounded-[1.5rem] py-4 pl-14 pr-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                    />
                </div>
                <div className="flex bg-white/5 p-1 rounded-[1.5rem] border border-white/5 overflow-x-auto no-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setFilterType(cat)}
                            className={`px-6 py-2 rounded-2xl text-[10px] uppercase font-black tracking-widest transition-all shrink-0 ${filterType === cat
                                ? 'bg-primary text-white shadow-xl shadow-primary/20'
                                : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="glass-card rounded-[2.5rem] overflow-hidden border-white/5 shadow-2xl">
                <div className="grid grid-cols-12 gap-4 p-6 bg-white/5 border-b border-white/5 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                    <div className="col-span-5 md:col-span-4">Vesting Protocol</div>
                    <div className="col-span-4 md:col-span-3">Archival Category</div>
                    <div className="col-span-3 hidden md:block">Status</div>
                    <div className="col-span-3 md:col-span-2 text-right">System Actions</div>
                </div>

                <div className="divide-y divide-white/5">
                    <AnimatePresence mode="popLayout">
                        {isLoading ? (
                            <div className="p-20 text-center uppercase font-black text-xs tracking-widest animate-pulse opacity-50">Syncing Secure Vault...</div>
                        ) : displayedItems.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="p-20 text-center flex flex-col items-center justify-center text-slate-500 space-y-4"
                            >
                                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                                    <ArchiveIcon size={32} className="opacity-20" />
                                </div>
                                <p className="font-black uppercase tracking-widest text-[10px]">Zero records found in secure storage</p>
                            </motion.div>
                        ) : (
                            displayedItems.map((item) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    layout
                                    className="grid grid-cols-12 gap-4 p-6 items-center hover:bg-white/[0.02] transition-colors group"
                                >
                                    <div className="col-span-5 md:col-span-4">
                                        <p className="font-black text-lg text-white tracking-tight leading-none mb-1 group-hover:text-primary transition-colors">{item.title}</p>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resident: {item.resident}</p>
                                    </div>
                                    <div className="col-span-4 md:col-span-3">
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-white/5 text-slate-400 border-white/5`}>
                                            {item.facility}
                                        </span>
                                    </div>
                                    <div className="col-span-3 hidden md:flex items-center gap-3">
                                        <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'Completed' ? 'bg-secondary shadow-secondary/50' : 'bg-red-500 shadow-red-500/50'} shadow-[0_0_10px_current]`} />
                                        <p className="text-xs text-slate-400 font-bold truncate">{item.status}</p>
                                    </div>
                                    <div className="col-span-3 md:col-span-2 flex justify-end gap-3">
                                        <button
                                            onClick={() => handleRestore(item.id)}
                                            className="p-3 rounded-2xl bg-secondary/10 text-secondary hover:bg-secondary hover:text-white transition-all shadow-lg shadow-secondary/5"
                                            title="Restore Record"
                                        >
                                            <RefreshCw size={18} />
                                        </button>
                                        <button
                                            className="p-3 rounded-2xl bg-white/5 text-slate-500 hover:bg-red-500 hover:text-white transition-all"
                                            title="Purge Record"
                                            onClick={() => handlePurge(item.id)}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default Archive;
