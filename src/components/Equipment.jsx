import React, { useState, useEffect, useContext } from 'react';
import {
    Package,
    Trash2,
    Edit3,
    Search,
    ShieldAlert,
    CheckCircle,
    Truck,
    Box,
    CornerDownLeft,
    Clock,
    Activity,
    History,
    X,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Globe,
    Building
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NotificationContext, TenantContext } from '../contexts/AppContext';
import BookingModal from './BookingModal';
import { supabase } from '../supabaseClient';

const EMPTY_ARRAY = [];

const Equipment = ({ tenants: externalTenants = EMPTY_ARRAY } = {}) => {
    const { notify } = useContext(NotificationContext);
    const { currentTenant, currentRole } = useContext(TenantContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [tenants, setTenants] = useState(externalTenants || []);
    const [selectedTenantId, setSelectedTenantId] = useState('all');
    const [selectedItem, setSelectedItem] = useState(null);
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    const [isBookingOpen, setIsBookingOpen] = useState(false);
    const [isNewAssetOpen, setIsNewAssetOpen] = useState(false);
    const [isEditAssetOpen, setIsEditAssetOpen] = useState(false);
    const [editAsset, setEditAsset] = useState(null);
    const [isReviewRequestsOpen, setIsReviewRequestsOpen] = useState(false);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [newAsset, setNewAsset] = useState({
        name: '',
        total: 1,
        category: 'Furniture',
        health: 'Excellent',
        penalty: 'P0/day'
    });

    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (externalTenants) {
            setTenants(externalTenants);
        } else if (currentRole === 'Super Admin') {
            fetchTenants();
        }
    }, [externalTenants, currentRole]);

    useEffect(() => {
        if (selectedTenantId !== 'all' || currentTenant?.id || currentRole !== 'Super Admin') {
            fetchEquipment();
        }
    }, [currentTenant?.id, currentRole, selectedTenantId]);

    const fetchTenants = async () => {
        try {
            const { data, error } = await supabase.from('tenants').select('id, name, domain').order('name');
            if (error) throw error;
            // Filter out deprecated, test, and removed tenants so they don't show
            const purgedDomains = JSON.parse(localStorage.getItem('brgy_purged_domains') || '[]');
            const cleanedTenants = data.filter(t => !['test', 'default', 'bulua', 'nazareth'].includes(t.domain) && !purgedDomains.includes(t.domain));
            setTenants(cleanedTenants || []);
        } catch (err) {
            console.error('Fetch tenants error:', err);
        }
    };

    const fetchEquipment = async () => {
        setIsLoading(true);
        console.log(`[Sync] Syncing Asset Registry for: ${selectedTenantId !== 'all' ? selectedTenantId : currentTenant?.id || '(GLOBAL HUB)'}`);

        try {
            let query = supabase.from('equipment').select('*');

            if (currentTenant?.id) {
                query = query.eq('tenant_id', currentTenant.id);
            } else if (currentRole === 'Super Admin' && selectedTenantId !== 'all') {
                query = query.eq('tenant_id', selectedTenantId);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) {
                console.error('Supabase Equipment Error:', error);

                // If it's a type mismatch (e.g. string 'carmen' vs UUID), handle gracefully
                if (error.code === '22P02') {
                    console.error('Schema Mismatch: Provided tenant_id is not a valid UUID format for this database.');
                    notify('Database Sync Error: Invalid Tenant Identity Format.', 'error');
                } else {
                    notify(`Failed to load equipment: ${error.message}`, 'error');
                }
                setItems([]);
            } else {
                setItems(data || []);
            }
        } catch (err) {
            console.error('Critical Fetch Exception:', err);
            notify('System Error: Connection to Asset Registry lost.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogDamage = async (item) => {
        try {
            const newHealth = item.health === 'Excellent' ? 'Mixed' : 'Critical';
            const { error } = await supabase
                .from('equipment')
                .update({ health: newHealth, maintenance: (item.maintenance || 0) + 1 })
                .eq('id', item.id);
            if (error) throw error;
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, health: newHealth, maintenance: (i.maintenance || 0) + 1 } : i));
            notify(`Damage report filed for ${item.name}. Health downgraded to ${newHealth}.`, 'warning');
        } catch (err) {
            console.error('Error logging damage:', err);
            notify('Failed to log damage report', 'error');
        }
    };

    const handleEditAsset = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase
                .from('equipment')
                .update({
                    name: editAsset.name,
                    total: Number(editAsset.total),
                    available: Number(editAsset.available),
                    category: editAsset.category,
                    health: editAsset.health,
                    penalty: editAsset.penalty
                })
                .eq('id', editAsset.id);
            if (error) throw error;
            setItems(prev => prev.map(i => i.id === editAsset.id ? { ...i, ...editAsset } : i));
            setIsEditAssetOpen(false);
            notify('Asset record updated successfully.', 'success');
        } catch (err) {
            console.error('Error updating asset:', err);
            notify('Failed to update asset record', 'error');
        }
    };

    const handleDeleteAsset = async (id) => {
        try {
            const { error } = await supabase
                .from('equipment')
                .delete()
                .eq('id', id);
            if (error) throw error;
            setItems(prev => prev.filter(i => i.id !== id));
            notify('Asset permanently removed from inventory.', 'success');
        } catch (err) {
            console.error('Error deleting asset:', err);
            notify('Failed to remove asset', 'error');
        }
    };

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyLogs, setHistoryLogs] = useState([]);

    const handleCreateAsset = async (e) => {
        e.preventDefault();

        const targetTenantId = currentTenant?.id || (selectedTenantId !== 'all' ? selectedTenantId : null);

        if (!targetTenantId) {
            notify('Please select a specific sector node before provisioning new assets.', 'error');
            return;
        }

        const { data, error } = await supabase
            .from('equipment')
            .insert([
                {
                    name: newAsset.name,
                    total: Number(newAsset.total),
                    available: Number(newAsset.total),
                    category: newAsset.category,
                    health: newAsset.health,
                    penalty: newAsset.penalty,
                    maintenance: 0,
                    retired: 0,
                    tenant_id: targetTenantId
                }
            ])
            .select();

        if (error) {
            console.error('Error creating asset:', error);
            notify('Failed to log new asset', 'error');
        } else {
            if (data && data.length > 0) {
                setItems([data[0], ...items]);
            } else {
                fetchEquipment();
            }
            setIsNewAssetOpen(false);
            setNewAsset({
                name: '',
                total: 1,
                category: 'Furniture',
                health: 'Excellent',
                penalty: 'P0/day'
            });
            notify('New asset logged into inventory system.', 'success');
        }
    };

    const fetchGlobalHistory = async () => {
        setIsHistoryOpen(true);
        notify('Accessing Global Asset Ledger...', 'info');
        try {
            const { data, error } = await supabase
                .from('reservations')
                .select('*')
                .limit(20)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setHistoryLogs(data || []);
        } catch (err) {
            console.error('Fetch history error:', err);
            notify('Failed to retrieve audit trail.', 'error');
        }
    };

    const fetchPendingRequests = async (itemName) => {
        notify('Scanning registry for pending requests...', 'info');
        const { data, error } = await supabase
            .from('reservations')
            .select('*')
            .eq('facility', itemName)
            .eq('status', 'Pending');

        if (!error && data) {
            setPendingRequests(data);
            setIsReviewRequestsOpen(true);
        } else {
            notify('Failed to scan registry.', 'error');
        }
    };

    const handleGrantApproval = async (resId) => {
        try {
            const { error } = await supabase
                .from('reservations')
                .update({ status: 'Approved' })
                .eq('id', resId);
            if (error) throw error;
            notify('Equipment request approved successfully.', 'success');
            setPendingRequests(prev => prev.filter(r => r.id !== resId));
        } catch (error) {
            notify('Approval action failed.', 'error');
        }
    };

    const handleDeclineRequest = async (resId) => {
        try {
            const { error } = await supabase
                .from('reservations')
                .update({ status: 'Declined' }) // Added generic declined status support
                .eq('id', resId);
            if (error) throw error;
            notify('Equipment request has been declined.', 'info');
            setPendingRequests(prev => prev.filter(r => r.id !== resId));
        } catch (error) {
            notify('Decline action failed.', 'error');
        }
    };

    const filteredItems = items.filter(i =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-gradient">Inventory Logistics</h2>
                    <p className="text-slate-400 mt-1">Real-time health monitoring and asset allocation.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    {currentRole === 'Super Admin' && selectedTenantId !== 'all' && (
                        <button
                            onClick={() => setSelectedTenantId('all')}
                            className="px-5 py-2.5 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all font-bold text-sm flex items-center gap-2 w-full sm:w-auto justify-center text-slate-400"
                        >
                            <CornerDownLeft size={18} /> Back to Hub
                        </button>
                    )}
                    {currentRole === 'Super Admin' && selectedTenantId === 'all' && (
                        <div className="flex bg-[#0A1221] p-1.5 rounded-2xl border border-white/10 shadow-inner w-full sm:w-auto overflow-x-auto no-scrollbar">
                            <button
                                className="px-4 py-2.5 rounded-xl text-[10px] bg-primary text-white shadow-lg shadow-primary/20 scale-105 font-black uppercase tracking-widest flex items-center gap-2 shrink-0 border border-primary/30"
                            >
                                <Globe size={14} /> All Sectors (Grid View)
                            </button>
                        </div>
                    )}
                    <button
                        onClick={fetchGlobalHistory}
                        className="px-5 py-2.5 rounded-2xl border border-white/5 bg-[#1A2235]/40 backdrop-blur-xl hover:bg-white/10 transition-all font-black uppercase text-[10px] tracking-widest flex items-center gap-2 w-full sm:w-auto justify-center text-slate-300"
                    >
                        <History size={16} /> Asset Ledger
                    </button>
                    {(currentRole === 'Super Admin' || currentRole === 'Barangay Admin' || currentRole === 'Admin') && (
                        <button onClick={() => setIsNewAssetOpen(true)} className="btn-primary w-full sm:w-auto justify-center py-3 px-8 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/30">
                            <Package size={16} /> Provision New Asset
                        </button>
                    )}
                </div>
            </div>

            {/* History Ledger Modal */}
            <AnimatePresence>
                {isHistoryOpen && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background/90 backdrop-blur-2xl">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 30 }}
                            className="bg-[#0A1221] border border-white/10 rounded-[3rem] p-10 max-w-4xl w-full relative overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)]"
                        >
                            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />

                            <div className="flex items-center justify-between mb-10 border-b-2 border-dashed border-white/5 pb-8 relative z-10">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center text-primary border border-primary/20">
                                        <History size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black text-white tracking-tighter">Global Asset Ledger</h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-1">Lifecycle Tracking & Deployment Audit</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsHistoryOpen(false)}
                                    className="p-4 hover:bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-all border border-white/10"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="max-h-[50vh] overflow-y-auto pr-2 custom-scroll space-y-4 relative z-10">
                                {historyLogs.length === 0 ? (
                                    <div className="py-24 text-center">
                                        <Activity size={64} className="mx-auto mb-6 text-slate-800 animate-pulse" />
                                        <p className="font-black text-slate-600 uppercase tracking-widest">Awaiting System Transactions...</p>
                                    </div>
                                ) : (
                                    historyLogs.map((log, i) => (
                                        <div key={i} className="glass-card p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-primary/30 transition-all border border-white/5 group">
                                            <div className="flex items-center gap-5">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${log.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400' :
                                                    log.status === 'Pending' ? 'bg-amber-500/10 text-amber-400' :
                                                        'bg-red-500/10 text-red-400'
                                                    }`}>
                                                    <Box size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-white font-black text-lg group-hover:text-primary transition-colors">{log.facility || 'Unknown Asset'}</p>
                                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Transaction Ref: <span className="text-slate-400">{String(log.id).substring(0, 8)}</span></p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-10">
                                                <div className="text-center">
                                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Identified In</p>
                                                    <p className="text-xs text-white font-bold">{log.tenant_name || 'System Hub'}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Timeline</p>
                                                    <p className="text-xs text-white font-bold">{new Date(log.created_at).toLocaleDateString()}</p>
                                                </div>
                                                <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border ${log.status === 'Approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                                    log.status === 'Pending' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                                        'bg-red-500/10 border-red-500/20 text-red-500'
                                                    }`}>
                                                    {log.status}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="mt-10 pt-8 border-t border-white/5 flex justify-end relative z-10">
                                <button
                                    onClick={() => setIsHistoryOpen(false)}
                                    className="px-10 py-4 bg-primary text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                                >
                                    Dismiss Ledger
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {currentRole === 'Super Admin' && selectedTenantId === 'all' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {tenants.length === 0 ? (
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
                                    Manage Inventory
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            ) : (
                <>
                    <div className="glass p-2 rounded-[2rem] border-white/5">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                            <input
                                type="text"
                                placeholder="Scan or search assets by name, SKU, or category..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-background/50 border-none rounded-[1.5rem] py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredItems.map((item, idx) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="glass-card p-6 flex flex-col group relative overflow-hidden"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-white/5 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500 border border-white/5`}>
                                        {item.category === 'Vehicle' ? <Truck size={28} /> :
                                            item.category === 'Electronics' ? <Box size={28} /> : <CornerDownLeft size={28} />}
                                    </div>
                                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {(currentRole === 'Super Admin' || currentRole === 'Barangay Admin' || currentRole === 'Admin') && (
                                            <>
                                                <button onClick={() => { setEditAsset({ ...item }); setIsEditAssetOpen(true); }} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all" title="Edit Asset"><Edit3 size={16} /></button>
                                                <button
                                                    onClick={() => handleLogDamage(item)}
                                                    className="p-2.5 bg-amber-500/10 hover:bg-amber-500 rounded-xl text-amber-400 hover:text-white transition-all"
                                                    title="Report Damage"
                                                >
                                                    <ShieldAlert size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAsset(item.id)}
                                                    className="p-2.5 bg-red-500/10 hover:bg-red-500 rounded-xl text-red-400 hover:text-white transition-all"
                                                    title="Delete Asset"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <h3 className="text-2xl font-black text-gradient group-hover:text-white transition-colors">{item.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                                            {item.category}
                                        </span>
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${item.health === 'Excellent' || item.health === 'Good' ? 'bg-secondary/20 text-secondary' :
                                            item.health === 'Mixed' ? 'bg-amber-500/20 text-amber-500' : 'bg-red-500/20 text-red-400'
                                            }`}>
                                            <Activity size={10} /> {item.health} Health
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-auto space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Available</p>
                                            <p className="text-xl font-black text-white">{item.available} <span className="text-[10px] text-slate-500">/ {item.total}</span></p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Maintenance</p>
                                            <p className="text-xl font-black text-amber-500">{item.maintenance}</p>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-0.5">Rental Fee</p>
                                            <span className="text-secondary font-black text-lg">{item.penalty}</span>
                                        </div>
                                        {currentRole === 'Resident' && (
                                            <button
                                                onClick={() => { setSelectedItem(item); setIsBookingOpen(true); }}
                                                className="px-4 py-2 bg-secondary text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-secondary/20 hover:scale-105 active:scale-95"
                                            >
                                                Reserve Now
                                            </button>
                                        )}
                                        {(currentRole === 'Super Admin' || currentRole === 'Barangay Admin' || currentRole === 'Admin') && (
                                            <button
                                                onClick={() => { setSelectedItem(item); fetchPendingRequests(item.name); }}
                                                className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
                                            >
                                                Review Requests
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setSelectedItem(item); setIsAuditOpen(true); }}
                                            className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-all"
                                        >
                                            Health Audit
                                        </button>
                                    </div>
                                </div>

                                {/* Background Decoration */}
                                <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-primary/5 rounded-full blur-[80px] group-hover:bg-primary/15 transition-all duration-700" />
                            </motion.div>
                        ))}
                    </div>

                    {/* Booking Modal */}
                    <BookingModal
                        isOpen={isBookingOpen}
                        onClose={() => setIsBookingOpen(false)}
                        type="Equipment"
                        targetName={selectedItem?.name}
                    />

                    {/* Health Audit Modal */}
                    <AnimatePresence>
                        {isAuditOpen && selectedItem && (
                            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 max-w-2xl w-full relative overflow-hidden shadow-2xl"
                                >
                                    <div className="absolute top-0 right-0 p-8">
                                        <button onClick={() => setIsAuditOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors">
                                            <X size={24} />
                                        </button>
                                    </div>

                                    <div className="flex items-start gap-6 mb-8">
                                        <div className="w-20 h-20 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                            <Activity size={40} />
                                        </div>
                                        <div>
                                            <h4 className="text-3xl font-black text-gradient">{selectedItem.name}</h4>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Audit Trail • Asset ID: AST-{selectedItem.id}00X</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                        <div className="p-4 rounded-2xl bg-secondary/5 border border-secondary/10">
                                            <TrendingUp className="text-secondary mb-2" size={20} />
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Utilization</p>
                                            <p className="text-2xl font-black text-white">84%</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                                            <Clock className="text-primary mb-2" size={20} />
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Last Inspection</p>
                                            <p className="text-lg font-black text-white">Mar 05, 2026</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                                            <AlertTriangle className="text-amber-500 mb-2" size={20} />
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Issues</p>
                                            <p className="text-2xl font-black text-white">{selectedItem.maintenance}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recent Maintenance Events</h5>
                                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scroll">
                                            {[1, 2, 3].map((_, i) => (
                                                <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2 h-2 rounded-full bg-secondary" />
                                                        <p className="text-sm font-bold">Standard Performance Test</p>
                                                    </div>
                                                    <span className="text-[10px] text-slate-500 font-black">Passed</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between items-center p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                                    <p className="text-sm font-bold text-red-200">Structural Damage Reported</p>
                                                </div>
                                                <span className="text-[10px] text-red-500 font-black">Major</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-8">
                                        <button className="px-6 py-4 rounded-[1.25rem] border border-white/10 font-bold hover:bg-white/5 transition-all text-sm">
                                            Print Audit Asset Tag
                                        </button>
                                        <button className="btn-primary">
                                            Initiate Repair Flow
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* New Asset Modal */}
                    <AnimatePresence>
                        {isNewAssetOpen && (
                            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 max-w-lg w-full relative shadow-2xl"
                                >
                                    <button onClick={() => setIsNewAssetOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors">
                                        <X size={20} />
                                    </button>

                                    <div className="flex items-center gap-4 mb-8 border-b-2 border-dashed border-white/10 pb-6">
                                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                                            <Package size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-white">Log Asset</h3>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Inventory receiving</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleCreateAsset} className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Asset Name</label>
                                            <input
                                                required
                                                type="text"
                                                value={newAsset.name}
                                                onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                                                placeholder="e.g. Monobloc Chair"
                                                className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Quantity</label>
                                                <input
                                                    required
                                                    type="number"
                                                    min="1"
                                                    value={newAsset.total}
                                                    onChange={(e) => setNewAsset({ ...newAsset, total: e.target.value })}
                                                    className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Category</label>
                                                <select
                                                    value={newAsset.category}
                                                    onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value })}
                                                    className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none appearance-none"
                                                >
                                                    <option className="bg-slate-900">Furniture</option>
                                                    <option className="bg-slate-900">Electronics</option>
                                                    <option className="bg-slate-900">Vehicle</option>
                                                    <option className="bg-slate-900">Tools</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Initial Health</label>
                                                <select
                                                    value={newAsset.health}
                                                    onChange={(e) => setNewAsset({ ...newAsset, health: e.target.value })}
                                                    className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none appearance-none"
                                                >
                                                    <option className="bg-slate-900">Excellent</option>
                                                    <option className="bg-slate-900">Good</option>
                                                    <option className="bg-slate-900">Mixed</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Penalty / Fee</label>
                                                <input
                                                    required
                                                    type="text"
                                                    value={newAsset.penalty}
                                                    onChange={(e) => setNewAsset({ ...newAsset, penalty: e.target.value })}
                                                    placeholder="P50/day"
                                                    className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-8 pt-6 border-t border-white/5 flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setIsNewAssetOpen(false)}
                                                className="flex-1 py-4 bg-white/5 border border-white/10 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="flex-1 py-4 bg-primary text-white rounded-[1.25rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all"
                                            >
                                                Save Asset
                                            </button>
                                        </div>
                                    </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Edit Asset Modal */}
                    <AnimatePresence>
                        {isEditAssetOpen && editAsset && (
                            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 max-w-lg w-full relative shadow-2xl"
                                >
                                    <button onClick={() => setIsEditAssetOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors">
                                        <X size={20} />
                                    </button>

                                    <div className="flex items-center gap-4 mb-8 border-b-2 border-dashed border-white/10 pb-6">
                                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                                            <Edit3 size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-white">Modify Asset</h3>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Inventory record update</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleEditAsset} className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Asset Name</label>
                                            <input required type="text" value={editAsset.name} onChange={(e) => setEditAsset({ ...editAsset, name: e.target.value })} className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Total Quantity</label>
                                                <input required type="number" min="1" value={editAsset.total} onChange={(e) => setEditAsset({ ...editAsset, total: e.target.value })} className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Available</label>
                                                <input required type="number" min="0" value={editAsset.available} onChange={(e) => setEditAsset({ ...editAsset, available: e.target.value })} className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Category</label>
                                                <select value={editAsset.category} onChange={(e) => setEditAsset({ ...editAsset, category: e.target.value })} className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none appearance-none">
                                                    <option className="bg-slate-900">Furniture</option>
                                                    <option className="bg-slate-900">Electronics</option>
                                                    <option className="bg-slate-900">Vehicle</option>
                                                    <option className="bg-slate-900">Tools</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Health Status</label>
                                                <select value={editAsset.health} onChange={(e) => setEditAsset({ ...editAsset, health: e.target.value })} className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none appearance-none">
                                                    <option className="bg-slate-900">Excellent</option>
                                                    <option className="bg-slate-900">Good</option>
                                                    <option className="bg-slate-900">Mixed</option>
                                                    <option className="bg-slate-900">Critical</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Penalty / Fee</label>
                                            <input required type="text" value={editAsset.penalty} onChange={(e) => setEditAsset({ ...editAsset, penalty: e.target.value })} className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none" />
                                        </div>
                                        <div className="mt-8 pt-6 border-t border-white/5 flex gap-3">
                                            <button type="button" onClick={() => setIsEditAssetOpen(false)} className="flex-1 py-4 bg-white/5 border border-white/10 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all">Cancel</button>
                                            <button type="submit" className="flex-1 py-4 bg-primary text-white rounded-[1.25rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all">Update Asset</button>
                                        </div>
                                    </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Review Requests Modal */}
                    <AnimatePresence>
                        {isReviewRequestsOpen && selectedItem && (
                            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 max-w-2xl w-full relative shadow-2xl"
                                >
                                    <button onClick={() => setIsReviewRequestsOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors">
                                        <X size={20} />
                                    </button>

                                    <div className="flex flex-col gap-2 mb-8 border-b-2 border-dashed border-white/10 pb-6">
                                        <h3 className="text-2xl font-black text-white">Pending Requests</h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{selectedItem.name}</p>
                                    </div>

                                    <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar">
                                        {pendingRequests.length === 0 ? (
                                            <div className="py-12 text-center text-slate-500">
                                                <CheckCircle2 size={48} className="mx-auto mb-4 opacity-20" />
                                                <p className="font-bold text-lg">No Pending Requests</p>
                                                <p className="text-sm">This asset is clear of any backlogged reservations.</p>
                                            </div>
                                        ) : (
                                            pendingRequests.map(req => (
                                                <div key={req.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                                                    <div>
                                                        <p className="text-white font-black text-sm">{req.title}</p>
                                                        <p className="text-xs text-slate-400 font-bold flex gap-3 mt-1">
                                                            <span>By: <span className="text-primary">{req.resident}</span></span>
                                                            <span>Date: {req.date || req.reservation_date}</span>
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleDeclineRequest(req.id)}
                                                            className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md"
                                                        >
                                                            Decline
                                                        </button>
                                                        <button
                                                            onClick={() => handleGrantApproval(req.id)}
                                                            className="px-4 py-2 bg-secondary text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-secondary/20 hover:scale-105"
                                                        >
                                                            Approve
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </div>
    );
};

export default Equipment;
