import React, { useState, useEffect, useContext } from 'react';
import {
    Plus,
    Search,
    Filter,
    MoreVertical,
    CheckCircle2,
    Clock,
    AlertCircle,
    Calendar as CalendarIcon,
    MapPin,
    Users,
    CreditCard,
    FileText,
    Download,
    ShieldCheck,
    Receipt,
    Globe,
    Building,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NotificationContext, TenantContext } from '../contexts/AppContext';
import { supabase } from '../supabaseClient';

const EMPTY_ARRAY = [];

const Reservations = ({ tenants: externalTenants = EMPTY_ARRAY } = {}) => {
    const { notify } = useContext(NotificationContext);
    const { currentTenant, currentRole } = useContext(TenantContext);
    const [filter, setFilter] = useState('all');
    const [tenants, setTenants] = useState(externalTenants || []);
    const [selectedTenantId, setSelectedTenantId] = useState('all');
    const [selectedRes, setSelectedRes] = useState(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [isNewReservationOpen, setIsNewReservationOpen] = useState(false);
    const [newReservation, setNewReservation] = useState({
        title: '',
        facility: 'Multi Purpose Hall',
        date: '',
        time: '',
        resident: '',
        fee: 0,
        payment: 'Pending'
    });

    const [reservations, setReservations] = useState([]);
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
            fetchReservations();
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

    const fetchReservations = async () => {
        setIsLoading(true);
        console.log(`[Sync] Syncing Ledger for: ${selectedTenantId !== 'all' ? selectedTenantId : currentTenant?.id || '(GLOBAL HUB)'}`);

        try {
            let query = supabase.from('reservations').select('*');

            if (currentTenant?.id) {
                query = query.eq('tenant_id', currentTenant.id);
            } else if (currentRole === 'Super Admin' && selectedTenantId !== 'all') {
                query = query.eq('tenant_id', selectedTenantId);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) {
                console.error('Supabase Reservations Error:', error);

                // Handle type mismatch (e.g. string 'carmen' vs UUID)
                if (error.code === '22P02') {
                    console.error('Schema Mismatch: Provided tenant_id is not a valid UUID format.');
                    notify('Database Sync Error: Invalid Tenant Identity Format.', 'error');
                } else {
                    notify(`Failed to load reservations: ${error.message}`, 'error');
                }
                setReservations([]);
            } else {
                setReservations(data || []);
            }
        } catch (err) {
            console.error('Critical Reservations Exception:', err);
            notify('System Error: Registry uplink failed.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGrantApproval = async (id) => {
        const { error } = await supabase
            .from('reservations')
            .update({ status: 'Approved' })
            .eq('id', id);

        if (error) {
            console.error('Error granting approval:', error);
            notify('Failed to grant approval', 'error');
        } else {
            setReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'Approved' } : r));
            notify('Reservation granted. Digital permit issued.', 'success');
        }
    };

    const handleGenerateReceipt = (res) => {
        setSelectedRes(res);
        setIsReceiptOpen(true);
        notify('Digital receipt generated successfully', 'info');
    };

    const handleCreateReservation = async (e) => {
        e.preventDefault();

        const { data, error } = await supabase
            .from('reservations')
            .insert([
                {
                    title: newReservation.title,
                    facility: newReservation.facility,
                    reservation_date: newReservation.date,
                    reservation_time: newReservation.time,
                    resident: newReservation.resident,
                    fee: newReservation.fee,
                    payment: newReservation.payment,
                    status: 'Pending',
                    tenant_id: currentTenant.id
                }
            ])
            .select();

        if (error) {
            console.error('Error creating reservation:', error);
            notify('Failed to create reservation', 'error');
        } else {
            // Re-map the inserted data to handle any DB-specific returning structure if needed
            // But usually just re-fetching is safer or appending the returned data
            if (data && data.length > 0) {
                // Formatting data date/time back to match existing structure 
                const newRes = {
                    ...data[0],
                    date: data[0].reservation_date,
                    time: data[0].reservation_time
                };
                setReservations([newRes, ...reservations]);
            } else {
                fetchReservations();
            }
            setIsNewReservationOpen(false);
            setNewReservation({
                title: '',
                facility: 'Multi Purpose Hall',
                date: '',
                time: '',
                resident: '',
                fee: 0,
                payment: 'Pending'
            });
            notify('New reservation request broadcasted to the network.', 'success');
        }
    };

    const filteredReservations = reservations.filter(r =>
        filter === 'all' || r.status.toLowerCase() === filter.toLowerCase()
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-gradient">Booking Registry</h2>
                    <p className="text-slate-400 mt-1">Official permit ledger and fiscal tracking terminal.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    {currentRole === 'Super Admin' && (
                        <div className="flex bg-[#0A1221] p-1.5 rounded-2xl border border-white/10 shadow-inner w-full sm:w-auto overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setSelectedTenantId('all')}
                                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${selectedTenantId === 'all' ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'text-slate-500 hover:text-white'}`}
                            >
                                <Globe size={14} /> All Sectors (Grid View)
                            </button>
                        </div>
                    )}

                    {currentRole === 'Resident' && (
                        <button onClick={() => setIsNewReservationOpen(true)} className="btn-primary">
                            <Plus size={18} /> New Reservation
                        </button>
                    )}
                </div>
            </div>

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
                                    View Ledger
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            ) : (
                <>
                    <div className="glass p-2 rounded-[2rem] border-white/5 flex flex-col lg:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                            <input
                                type="text"
                                placeholder="Scan permit ID or search registry..."
                                className="w-full bg-background/50 border-none rounded-[1.5rem] py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                            />
                        </div>
                        <div className="flex bg-white/5 p-1 rounded-[1.5rem] border border-white/5 overflow-x-auto no-scrollbar">
                            {['all', 'pending', 'approved', 'completed'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-6 py-2 rounded-2xl text-[10px] uppercase font-black tracking-widest transition-all shrink-0 ${filter === f ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-500 hover:text-white'
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {filteredReservations.map((res, idx) => (
                            <motion.div
                                key={res.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                onClick={() => handleGenerateReceipt(res)}
                                className="glass-card p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative group cursor-pointer hover:bg-white/5 transition-all"
                            >
                                <div className="flex flex-col md:flex-row gap-6 items-center flex-1 w-full">
                                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center border transition-all duration-500 ${res.status === 'Approved' ? 'bg-secondary/10 text-secondary border-secondary/20 shadow-lg shadow-secondary/5' :
                                        res.status === 'Pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-slate-800 text-slate-500 border-white/5'
                                        }`}>
                                        {res.status === 'Approved' ? <CheckCircle2 size={32} /> :
                                            res.status === 'Pending' ? <Clock size={32} /> : <AlertCircle size={32} />}
                                    </div>
                                    <div className="text-center md:text-left flex-1 min-w-0">
                                        <h4 className="text-xl font-black text-gradient group-hover:text-white transition-colors truncate">{res.title}</h4>
                                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">
                                            <span className="flex items-center gap-1.5"><MapPin size={12} className="text-primary" /> {res.facility}</span>
                                            <span className="flex items-center gap-1.5"><CalendarIcon size={12} className="text-secondary" /> {res.date || res.reservation_date}</span>
                                            <span className="flex items-center gap-1.5"><Users size={12} className="text-amber-500" /> {res.resident}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-center gap-6 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-white/5">
                                    <div className="text-center sm:text-right">
                                        <p className="text-[10px] text-primary uppercase font-black tracking-widest mb-1">Fiscal Status</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-black text-white">P{res.fee}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${res.payment === 'Paid' ? 'bg-secondary text-white' : 'bg-amber-500 text-black'
                                                }`}>
                                                {res.payment}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {res.status === 'Pending' && (currentRole === 'Super Admin' || currentRole === 'Barangay Admin' || currentRole === 'Admin') && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleGrantApproval(res.id); }}
                                                className="p-3 bg-secondary/10 text-secondary hover:bg-secondary hover:text-white rounded-xl transition-all shadow-lg shadow-secondary/5"
                                                title="Grant Approval"
                                            >
                                                <CheckCircle2 size={20} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleGenerateReceipt(res); }}
                                            className="p-3 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl transition-all shadow-lg shadow-primary/5"
                                            title="View Receipt"
                                        >
                                            <Receipt size={20} />
                                        </button>
                                        <button className="p-3 bg-white/5 text-slate-500 hover:text-white rounded-xl transition-all">
                                            <MoreVertical size={20} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Receipt Modal */}
                    <AnimatePresence>
                        {isReceiptOpen && selectedRes && (
                            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="bg-white text-slate-900 rounded-[2.5rem] p-8 max-w-md w-full relative shadow-3xl overflow-hidden"
                                >
                                    {/* Receipt Pattern Background */}
                                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '12px 12px' }} />

                                    <button onClick={() => setIsReceiptOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                                        <X size={20} />
                                    </button>

                                    <div className="text-center mb-8 border-b-2 border-dashed border-slate-200 pb-8">
                                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4 border-2 border-primary/20">
                                            <ShieldCheck size={40} />
                                        </div>
                                        <h3 className="text-2xl font-black uppercase tracking-tight">Official Receipt</h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1 text-center truncate">CDO Barangay Hub Pro • Terminal {selectedRes.id}A</p>
                                    </div>

                                    <div className="space-y-6 relative z-10">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Billed To</p>
                                                <p className="font-black text-lg">{selectedRes.resident}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Date Issued</p>
                                                <p className="font-bold text-sm">{selectedRes.date || selectedRes.reservation_date}</p>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-3">Line Items</p>
                                            <div className="flex justify-between mb-2">
                                                <span className="text-sm font-bold">{selectedRes.facility}</span>
                                                <span className="text-sm font-black text-slate-900">P{selectedRes.fee}.00</span>
                                            </div>
                                            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                                                <span>System & Processing Fee</span>
                                                <span>Inculded</span>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                                                <span className="text-xs font-black uppercase tracking-widest">Total Amount</span>
                                                <span className="text-2xl font-black text-primary">P{selectedRes.fee}.00</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-secondary/10 border border-secondary/20">
                                            <CheckCircle2 size={24} className="text-secondary" />
                                            <div>
                                                <p className="text-[10px] text-secondary font-black uppercase tracking-widest">Payment Success</p>
                                                <p className="text-xs font-bold text-secondary/80 truncate">TXN: {Math.random().toString(36).substring(7).toUpperCase()}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mt-8">
                                        <button className="flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-slate-800 transition-all">
                                            <Download size={14} /> Download PDF
                                        </button>
                                        <button
                                            onClick={() => notify('Receipt sent to resident email', 'success')}
                                            className="flex items-center justify-center gap-2 py-4 border-2 border-slate-200 text-slate-900 rounded-2xl font-black text-xs hover:bg-slate-50 transition-all"
                                        >
                                            <FileText size={14} /> Email Copy
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* New Reservation Modal */}
                    <AnimatePresence>
                        {isNewReservationOpen && (
                            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 max-w-lg w-full relative shadow-2xl"
                                >
                                    <button onClick={() => setIsNewReservationOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors">
                                        <X size={20} />
                                    </button>

                                    <div className="flex items-center gap-4 mb-8 border-b-2 border-dashed border-white/10 pb-6">
                                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                                            <Plus size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-white">New Booking</h3>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Manual Terminal Entry</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleCreateReservation} className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Event Title</label>
                                            <input
                                                required
                                                type="text"
                                                value={newReservation.title}
                                                onChange={(e) => setNewReservation({ ...newReservation, title: e.target.value })}
                                                placeholder="e.g. Birthday Party"
                                                className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Facility</label>
                                                <select
                                                    value={newReservation.facility}
                                                    onChange={(e) => setNewReservation({ ...newReservation, facility: e.target.value })}
                                                    className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none appearance-none"
                                                >
                                                    <option className="bg-slate-900">Multi Purpose Hall</option>
                                                    <option className="bg-slate-900">Covered Court</option>
                                                    <option className="bg-slate-900">Barangay Hall</option>
                                                    <option className="bg-slate-900">Health Center</option>
                                                    <option className="bg-slate-900">Sound System</option>
                                                    <option className="bg-slate-900">Chairs & Tables</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Resident Name</label>
                                                <input
                                                    required
                                                    type="text"
                                                    value={newReservation.resident}
                                                    onChange={(e) => setNewReservation({ ...newReservation, resident: e.target.value })}
                                                    placeholder="Full Name"
                                                    className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Date</label>
                                                <input
                                                    required
                                                    type="date"
                                                    value={newReservation.date}
                                                    onChange={(e) => setNewReservation({ ...newReservation, date: e.target.value })}
                                                    className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Time</label>
                                                <input
                                                    required
                                                    type="time"
                                                    value={newReservation.time}
                                                    onChange={(e) => setNewReservation({ ...newReservation, time: e.target.value })}
                                                    className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Fee (PHP)</label>
                                                <input
                                                    required
                                                    type="number"
                                                    min="0"
                                                    value={newReservation.fee}
                                                    onChange={(e) => setNewReservation({ ...newReservation, fee: Number(e.target.value) })}
                                                    className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Payment</label>
                                                <select
                                                    value={newReservation.payment}
                                                    onChange={(e) => setNewReservation({ ...newReservation, payment: e.target.value })}
                                                    className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none appearance-none"
                                                >
                                                    <option className="bg-slate-900">Pending</option>
                                                    <option className="bg-slate-900">Paid</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="mt-8 pt-6 border-t border-white/5 flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setIsNewReservationOpen(false)}
                                                className="flex-1 py-4 bg-white/5 border border-white/10 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="flex-1 py-4 bg-primary text-white rounded-[1.25rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all"
                                            >
                                                Create Booking
                                            </button>
                                        </div>
                                    </form>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </div>
    );
};

export default Reservations;
