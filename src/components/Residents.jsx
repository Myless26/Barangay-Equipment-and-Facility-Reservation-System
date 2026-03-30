import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Mail, Phone, MapPin, MoreVertical, ShieldCheck, FileCheck, CheckCircle2, X, Plus, UserPlus, Zap, Edit2, Trash2, ChevronRight, Building } from 'lucide-react';
import { NotificationContext, TenantContext, ConfirmationContext } from '../contexts/AppContext';
import { supabase } from '../supabaseClient';
import { sendCommunityEmail, EmailTemplates } from '../utils/EmailService';

const MOCK_RESIDENTS = [
    { id: 'mock-1', name: 'Ricardo Dalisay', email: 'cardodalisay@brgyhub.pro', phone: '0917-123-4567', address: 'Phase 1, Block 2, Lot 3', status: 'Verified', role: 'Resident', vaxStatus: 'Fully Vaccinated' },
    { id: 'mock-2', name: 'Niana Guerrero', email: 'niana@brgyhub.pro', phone: '0918-765-4321', address: 'Purok 4, Riverside', status: 'Pending', role: 'Resident', vaxStatus: 'Partial' },
    { id: 'mock-3', name: 'Jose Rizal', email: 'pepe@brgyhub.pro', phone: '0919-000-1111', address: 'Bagumbayan St.', status: 'Verified', role: 'Staff', vaxStatus: 'Fully Vaccinated' },
    { id: 'mock-4', name: 'Liza Soberano', email: 'liza@brgyhub.pro', phone: '0920-222-3333', address: 'Emerald Heights', status: 'Verified', role: 'Resident', vaxStatus: 'Booster' },
    { id: 'mock-5', name: 'Manny Pacquiao', email: 'pacman@brgyhub.pro', phone: '0921-444-5555', address: 'General Santos Ave', status: 'Pending', role: 'Resident', vaxStatus: 'N/A' }
];

const ResidentsManagement = () => {
    const { notify } = useContext(NotificationContext);
    const { confirmAction } = useContext(ConfirmationContext);
    const { currentTenant } = useContext(TenantContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedResident, setSelectedResident] = useState(null);
    const [isClearanceOpen, setIsClearanceOpen] = useState(false);
    const [residents, setResidents] = useState([]);
    const [pendingUsers, setPendingUsers] = useState([]);
    const [availablePlans, setAvailablePlans] = useState([]);
    const [isAssignPlanOpen, setIsAssignPlanOpen] = useState(false);
    const [selectedUserForPlan, setSelectedUserForPlan] = useState(null);
    const [activeTab, setActiveTab] = useState('directory'); // 'directory' or 'approvals'
    const [isLoading, setIsLoading] = useState(true);
    const [isNewResidentOpen, setIsNewResidentOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingResident, setEditingResident] = useState(null);
    const [newResident, setNewResident] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        password: '',
        status: 'Verified'
    });


    useEffect(() => {
        fetchResidents();
        fetchPendingUsers();
        fetchPlans();
    }, [currentTenant?.id]);

    const fetchResidents = async () => {
        setIsLoading(true);
        console.log(`[Sync] Accessing Residents Registry: ${currentTenant?.id ? currentTenant.name : '(GLOBAL HUB)'}`);
        try {
            let query = supabase.from('residents').select('*');
            if (currentTenant?.id) {
                query = query.eq('tenant_id', currentTenant.id);
            }
            const { data, error } = await query.order('name', { ascending: true });

            if (error) throw error;
            setResidents(data || []);
        } catch (error) {
            console.error('Error fetching residents:', error);
            setResidents(MOCK_RESIDENTS);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPendingUsers = async () => {
        try {
            let query = supabase.from('user_profiles').select('*').eq('status', 'Pending Approval');
            if (currentTenant?.id) {
                query = query.eq('tenant_id', currentTenant.id);
            }
            const { data, error } = await query;

            if (error) throw error;
            setPendingUsers(data || []);
        } catch (err) {
            console.error('Pending Users Error:', err);
        }
    };

    const handleApproveUser = async (profileId) => {
        confirmAction(
            'Approve Access?',
            'This user will be granted standard resident privileges.',
            async () => {
                try {
                    const { error } = await supabase
                        .from('user_profiles')
                        .update({ status: 'Approved' })
                        .eq('id', profileId);

                    if (error) throw error;
                    notify('User approved successfully.', 'success');

                    // 2. Sync with Residents Directory (physical table)
                    const approvedUser = pendingUsers.find(u => u.id === profileId);
                    if (approvedUser) {
                        try {
                            await supabase.from('residents').insert([{
                                user_id: profileId,
                                name: approvedUser.full_name,
                                email: approvedUser.email,
                                tenant_id: approvedUser.tenant_id,
                                status: 'Verified',
                                role: approvedUser.role || 'Resident'
                            }]);
                        } catch (syncErr) {
                            console.error('[Sync] Registry update deferred:', syncErr);
                        }

                        // 3. Dispatch Real Email
                        const { subject, body } = EmailTemplates.APPROVED(approvedUser.full_name);
                        sendCommunityEmail(approvedUser.email, subject, body);
                    }

                    fetchPendingUsers();
                    fetchResidents();
                } catch (err) {
                    console.error('Approval Error:', err);
                    notify('Failed to approve user.', 'error');
                }
            }
        );
    };

    const handleRejectUser = async (profileId) => {
        confirmAction(
            'Reject Registration?',
            'This user will be denied access to the platform.',
            async () => {
                try {
                    const { error } = await supabase
                        .from('user_profiles')
                        .update({ status: 'Rejected' })
                        .eq('id', profileId);

                    if (error) throw error;
                    notify('User registration rejected.', 'warning');
                    fetchPendingUsers();
                } catch (err) {
                    console.error('Rejection Error:', err);
                    notify('Failed to reject user.', 'error');
                }
            }
        );
    };

    const fetchPlans = async () => {
        try {
            const { data, error } = await supabase.from('plans').select('*').eq('tenant_id', currentTenant.id);
            if (error) throw error;
            setAvailablePlans(data || []);
        } catch (err) {
            console.error('Fetch Plans Error:', err);
        }
    };

    const handleAssignPlan = async (userEmail, planId) => {
        confirmAction(
            'Confirm Plan Assignment?',
            'This will grant the user active subscription privileges for the selected plan.',
            async () => {
                try {
                    // Find actual DB user_id from profiles
                    const { data: profile } = await supabase.from('user_profiles').select('id').eq('email', userEmail).maybeSingle();
                    if (!profile) throw new Error('User profile not found in system.');

                    const { error } = await supabase.from('resident_plans').upsert([{
                        tenant_id: currentTenant.id,
                        user_id: profile.id,
                        plan_id: planId,
                        status: 'Active'
                    }], { onConflict: 'user_id' });

                    if (error) throw error;
                    notify('Plan assigned successfully.', 'success');
                    setIsAssignPlanOpen(false);

                    // Dispatch Real Email
                    const { data: planData } = await supabase.from('plans').select('name').eq('id', planId).single();
                    const { data: p } = await supabase.from('user_profiles').select('full_name').eq('email', userEmail).single();
                    const { subject, body } = EmailTemplates.PLAN_APPROVED(p?.full_name || 'Resident', planData?.name || 'Benefit Plan');
                    sendCommunityEmail(userEmail, subject, body);
                } catch (err) {
                    console.error('Plan Assignment Error:', err);
                    notify(`Failed to assign plan: ${err.message}`, 'error');
                }
            }
        );
    };

    const handleEditResident = async (e) => {
        e.preventDefault();
        notify('Updating identity...', 'info');

        try {
            // If mock data, just update local state
            if (editingResident.id.startsWith('mock-')) {
                setResidents(prev => prev.map(r => r.id === editingResident.id ? editingResident : r));
                setIsEditModalOpen(false);
                notify('Mock resident updated.', 'success');
                return;
            }

            const { error } = await supabase
                .from('residents')
                .update({
                    name: editingResident.name,
                    email: editingResident.email,
                    phone: editingResident.phone,
                    address: editingResident.address
                })
                .eq('id', editingResident.id);

            if (error) throw error;

            // Sync password update to Auth system
            if (editingResident.password) {
                const users = JSON.parse(localStorage.getItem('brgy_hub_users') || '[]');
                const updatedUsers = users.map(u => u.email === editingResident.email ? { ...u, password: editingResident.password } : u);
                localStorage.setItem('brgy_hub_users', JSON.stringify(updatedUsers));
            }

            setResidents(prev => prev.map(r => r.id === editingResident.id ? editingResident : r));
            setIsEditModalOpen(false);
            notify('Identity and credentials updated.', 'success');
        } catch (error) {
            console.error('Error updating resident:', error);
            notify('Failed to update identity.', 'error');
        }
    };

    const handleDeleteResident = (id) => {
        confirmAction(
            'Purge Identity?',
            'Are you sure you want to delete this resident from the registry? This action is irreversible.',
            async () => {
                try {
                    // If mock data, just update local state
                    if (id.startsWith('mock-')) {
                        setResidents(prev => prev.filter(r => r.id !== id));
                        notify('Mock resident purged.', 'success');
                        return;
                    }

                    const { error } = await supabase
                        .from('residents')
                        .delete()
                        .eq('id', id);

                    if (error) throw error;

                    setResidents(prev => prev.filter(r => r.id !== id));

                    // Sync with Auth System (Purge)
                    const deletedResident = residents.find(r => r.id === id);
                    if (deletedResident) {
                        const users = JSON.parse(localStorage.getItem('brgy_hub_users') || '[]');
                        const updatedUsers = users.filter(u => u.email !== deletedResident.email);
                        localStorage.setItem('brgy_hub_users', JSON.stringify(updatedUsers));
                        console.log('[AuthSync] Identity purged from local vault.');
                    }

                    notify('Identity purged from registry.', 'success');
                } catch (error) {
                    console.error('Error deleting resident:', error);
                    notify('Failed to purge identity.', 'error');
                }
            },
            'Purge'
        );
    };

    const handleCreateResident = async (e) => {
        e.preventDefault();
        notify('Processing registration...', 'info');

        try {
            const { data, error } = await supabase
                .from('residents')
                .insert([
                    {
                        ...newResident,
                        tenant_id: currentTenant.id
                    }
                ])
                .select();

            if (error) throw error;

            if (data && data.length > 0) {
                setResidents([data[0], ...residents]);
            } else {
                fetchResidents();
            }

            // Sync with Authentication System (localStorage for demo)
            const users = JSON.parse(localStorage.getItem('brgy_hub_users') || '[]');
            if (!users.find(u => u.email === newResident.email)) {
                users.push({
                    email: newResident.email,
                    password: newResident.password || 'resident123',
                    name: newResident.name,
                    role: 'Resident'
                });
                localStorage.setItem('brgy_hub_users', JSON.stringify(users));
                console.log('[AuthSync] Resident credentials provisioned in local vault.');
            }

            setIsNewResidentOpen(false);
            setNewResident({
                name: '',
                email: '',
                phone: '',
                address: '',
                password: '',
                status: 'Verified'
            });
            notify(`Resident ${newResident.name} registered and credentials assigned.`, 'success');
        } catch (error) {
            console.error('Error creating resident:', error);
            notify('Failed to register resident', 'error');
        }
    };

    const handleVerify = (id) => {
        confirmAction(
            'Confirm Official Verification?',
            'Are you sure you want to verify this resident? This confirms their identity in the barangay registry.',
            async () => {
                try {
                    const { error } = await supabase
                        .from('residents')
                        .update({ status: 'Verified' })
                        .eq('id', id);

                    if (error) throw error;

                    setResidents(prev => prev.map(r => r.id === id ? { ...r, status: 'Verified' } : r));
                    notify('Resident status updated to Verified', 'success');
                } catch (error) {
                    console.error('Error verifying resident:', error);
                    notify('Failed to update resident status', 'error');
                }
            },
            'Verify'
        );
    };

    const handleUpdateRole = (id, newRole) => {
        confirmAction(
            'Change Identity Role?',
            `Are you sure you want to change this resident's role to ${newRole}? This grants them additional sector permissions.`,
            async () => {
                try {
                    const { error } = await supabase
                        .from('residents')
                        .update({ role: newRole })
                        .eq('id', id);

                    if (error) throw error;
                    setResidents(prev => prev.map(r => r.id === id ? { ...r, role: newRole } : r));

                    // Sync with Auth System
                    const resident = residents.find(r => r.id === id);
                    if (resident) {
                        const users = JSON.parse(localStorage.getItem('brgy_hub_users') || '[]');
                        const updatedUsers = users.map(u => u.email === resident.email ? { ...u, role: newRole } : u);
                        localStorage.setItem('brgy_hub_users', JSON.stringify(updatedUsers));
                        console.log('[AuthSync] Identity role updated in local vault.');
                    }

                    notify(`Identity role updated to ${newRole}`, 'success');
                } catch (error) {
                    console.error('Error updating role:', error);
                    notify('Failed to update identity role', 'error');
                }
            },
            'Update Role'
        );
    };

    const filteredResidents = residents.filter(r =>
        (r.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (r.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-gradient">Identity Nexus</h2>
                    <p className="text-slate-400 mt-1">Manage official community records and access protocols.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setActiveTab('directory')}
                        className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${activeTab === 'directory' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                    >
                        Registry
                    </button>
                    <button
                        onClick={() => setActiveTab('approvals')}
                        className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'approvals' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                    >
                        Pending {pendingUsers.length > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] animate-pulse">{pendingUsers.length}</span>}
                    </button>
                    <button className="btn-primary" onClick={() => setIsNewResidentOpen(true)}>
                        <Plus size={18} /> Register Resident
                    </button>
                </div>
            </div>

            {activeTab === 'directory' ? (
                <>
                    <div className="glass p-2 rounded-[2rem] border-white/5">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                            <input
                                type="text"
                                placeholder="Search residents by identity, digital footprint, or address..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-background/50 border-none rounded-[1.5rem] py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium outline-none"
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="py-20 text-center text-slate-500 font-bold uppercase tracking-widest text-xs animate-pulse">
                            Decrypting Local Registry...
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {filteredResidents.map((resident, idx) => (
                                <motion.div
                                    key={resident.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="glass-card p-6 flex flex-col gap-6 relative overflow-hidden group border border-white/5 hover:border-primary/20 transition-all duration-500 shadow-xl"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
                                    <div className="flex flex-col md:flex-row gap-6 relative z-10">
                                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-[2rem] bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center border border-white/10 group-hover:border-primary/30 transition-all duration-500 overflow-hidden shadow-xl shrink-0">
                                            <Users size={40} className="text-slate-500 group-hover:text-primary transition-colors" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <h3 className="text-xl font-black text-white">{resident.name}</h3>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${resident.status === 'Verified' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-500'}`}>{resident.status}</span>
                                            </div>
                                            <p className="text-slate-400 text-xs mb-4">{resident.address || 'No registered address'}</p>
                                            <div className="flex flex-wrap gap-2">
                                                <button onClick={() => { setSelectedResident(resident); setIsClearanceOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all border border-white/5"><FileCheck size={12} /> Clearance</button>
                                                <button onClick={() => { setSelectedUserForPlan(resident); setIsAssignPlanOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all border border-primary/20"><Zap size={12} /> Assign Plan</button>
                                                <button onClick={() => { setEditingResident(resident); setIsEditModalOpen(true); }} className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-primary transition-all border border-white/5"><Edit2 size={12} /></button>
                                                <button onClick={() => handleDeleteResident(resident.id)} className="p-2 rounded-xl bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/10"><Trash2 size={12} /></button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5 relative z-10">
                                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold truncate"><Mail size={14} className="text-primary" /> {resident.email}</div>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold"><Phone size={14} className="text-primary" /> {resident.phone || 'N/A'}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {pendingUsers.length === 0 ? (
                        <div className="col-span-full py-32 text-center glass rounded-[2.5rem] border-white/5">
                            <ShieldCheck className="mx-auto text-slate-600 mb-4" size={48} />
                            <h3 className="text-xl font-bold text-white">No pending applications</h3>
                            <p className="text-slate-400">All recent registration requests have been processed.</p>
                        </div>
                    ) : (
                        pendingUsers.map((user, idx) => (
                            <motion.div
                                key={user.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.05 }}
                                className="glass-card p-10 relative overflow-hidden group border border-amber-500/20 hover:border-amber-500 transition-all duration-500 shadow-2xl"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl" />
                                <div className="flex items-center justify-between relative z-10 mb-8">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-inner">
                                            <UserPlus size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-white">{user.full_name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{user.email}</p>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${user.role === 'Barangay Admin' ? 'bg-secondary/20 text-secondary border border-secondary/20' : 'bg-primary/20 text-primary border border-primary/20'}`}>
                                                    {user.role} Access
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">Identity Request</p>
                                        <p className="text-xs font-bold text-amber-500 animate-pulse">Pending Audit</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 relative z-10">
                                    <button
                                        onClick={() => handleRejectUser(user.id)}
                                        className="flex-1 py-4 rounded-2xl bg-red-500/10 text-red-500 font-black uppercase text-[10px] tracking-widest border border-red-500/20 hover:bg-red-500 hover:text-white transition-all outline-none"
                                    >
                                        Deny Audit
                                    </button>
                                    <button
                                        onClick={() => handleApproveUser(user.id)}
                                        className="flex-1 py-4 rounded-2xl bg-amber-500 text-white font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-amber-500/20 outline-none"
                                    >
                                        Authorize Identity
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            )}

            {/* Clearance Modal Mockup */}
            <AnimatePresence>
                {isClearanceOpen && selectedResident && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 max-w-lg w-full relative overflow-hidden shadow-2xl"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-secondary to-accent" />

                            <div className="flex justify-between items-start mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                        <ShieldCheck size={32} />
                                    </div>
                                    <div>
                                        <h4 className="text-2xl font-black text-gradient">System Clearance</h4>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Digital Audit Trail • BRGY-{selectedResident.id?.substring(0, 5) || 'NEW'}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsClearanceOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Reservation Score</p>
                                        <p className="text-2xl font-black text-secondary">98 / 100</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Return Reliability</p>
                                        <p className="text-2xl font-black text-primary">Ultra-High</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Background Check</label>
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/10 border border-secondary/20">
                                        <CheckCircle2 size={16} className="text-secondary" />
                                        <p className="text-sm font-bold text-secondary">Community-Verified Resident</p>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
                                        <CheckCircle2 size={16} className="text-primary" />
                                        <p className="text-sm font-bold text-primary">No Outstanding Liabilities</p>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                        <CheckCircle2 size={16} className="text-slate-500" />
                                        <p className="text-sm font-bold text-slate-300">Vaccination Status: {selectedResident.vax_status || selectedResident.vaxStatus || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setIsClearanceOpen(false)}
                                className="w-full mt-8 btn-primary"
                            >
                                Close Clearance Terminal
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* New Resident Modal */}
            <AnimatePresence>
                {isNewResidentOpen && (
                    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-background/80 backdrop-blur-xl">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 max-w-lg w-full relative shadow-2xl"
                        >
                            <button onClick={() => setIsNewResidentOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors">
                                <X size={20} />
                            </button>

                            <div className="flex items-center gap-4 mb-8 border-b-2 border-dashed border-white/10 pb-6">
                                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white">Register Resident</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Manual Identity Provisioning</p>
                                </div>
                            </div>

                            <form onSubmit={handleCreateResident} className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Full Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={newResident.name}
                                        onChange={(e) => setNewResident({ ...newResident, name: e.target.value })}
                                        placeholder="e.g. Juan De La Cruz"
                                        className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Email Identity</label>
                                        <input
                                            required
                                            type="email"
                                            value={newResident.email}
                                            onChange={(e) => setNewResident({ ...newResident, email: e.target.value })}
                                            placeholder="resident@brgyhub.pro"
                                            className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Phone Link</label>
                                        <input
                                            required
                                            type="tel"
                                            value={newResident.phone}
                                            onChange={(e) => setNewResident({ ...newResident, phone: e.target.value })}
                                            placeholder="0917-XXX-XXXX"
                                            className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Permanent Address</label>
                                    <input
                                        required
                                        type="text"
                                        value={newResident.address}
                                        onChange={(e) => setNewResident({ ...newResident, address: e.target.value })}
                                        placeholder="Specific Phase/Block/Lot"
                                        className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Access Password</label>
                                    <input
                                        required
                                        type="password"
                                        value={newResident.password}
                                        onChange={(e) => setNewResident({ ...newResident, password: e.target.value })}
                                        placeholder="Min. 8 characters"
                                        className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                    />
                                </div>

                                <div className="mt-8 pt-6 border-t border-white/5 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsNewResidentOpen(false)}
                                        className="flex-1 py-4 bg-white/5 border border-white/10 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-4 bg-primary text-white rounded-[1.25rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all"
                                    >
                                        Complete Entry
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Resident Modal */}
            <AnimatePresence>
                {isEditModalOpen && (
                    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-background/80 backdrop-blur-xl">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 max-w-lg w-full relative shadow-2xl"
                        >
                            <button onClick={() => setIsEditModalOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors">
                                <X size={20} />
                            </button>

                            <div className="flex items-center gap-4 mb-8 border-b-2 border-dashed border-white/10 pb-6">
                                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                                    <Edit2 size={24} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white">Modify Identity</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Updating Sector Registry</p>
                                </div>
                            </div>

                            <form onSubmit={handleEditResident} className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Full Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={editingResident.name}
                                        onChange={(e) => setEditingResident({ ...editingResident, name: e.target.value })}
                                        className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Email Identity</label>
                                        <input
                                            required
                                            type="email"
                                            value={editingResident.email}
                                            onChange={(e) => setEditingResident({ ...editingResident, email: e.target.value })}
                                            className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Phone Link</label>
                                        <input
                                            required
                                            type="tel"
                                            value={editingResident.phone}
                                            onChange={(e) => setEditingResident({ ...editingResident, phone: e.target.value })}
                                            className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Permanent Address</label>
                                    <input
                                        required
                                        type="text"
                                        value={editingResident.address}
                                        onChange={(e) => setEditingResident({ ...editingResident, address: e.target.value })}
                                        className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Update Password</label>
                                    <input
                                        type="password"
                                        value={editingResident.password || ''}
                                        onChange={(e) => setEditingResident({ ...editingResident, password: e.target.value })}
                                        placeholder="Leave blank to keep current"
                                        className="w-full mt-1 bg-white/5 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-white outline-none"
                                    />
                                </div>

                                <div className="mt-8 pt-6 border-t border-white/5 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="flex-1 py-4 bg-white/5 border border-white/10 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-4 bg-primary text-white rounded-[1.25rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isAssignPlanOpen && selectedUserForPlan && (
                    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-background/80 backdrop-blur-xl">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-10 max-w-md w-full relative shadow-2xl"
                        >
                            <button onClick={() => setIsAssignPlanOpen(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                            <Zap className="text-primary mb-4" size={48} />
                            <h3 className="text-3xl font-black text-white mb-2">Assign Privilege Plan</h3>
                            <p className="text-slate-400 mb-8 font-medium text-sm">Selecting a plan for <span className="text-white font-bold">{selectedUserForPlan.name}</span> will override any existing subscription.</p>

                            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                {availablePlans.length === 0 ? (
                                    <p className="text-center py-6 bg-white/5 rounded-2xl text-slate-500 font-bold border border-dashed border-white/10">No active plans detected.</p>
                                ) : (
                                    availablePlans.map(plan => (
                                        <button
                                            key={plan.id}
                                            onClick={() => handleAssignPlan(selectedUserForPlan.email, plan.id)}
                                            className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-primary hover:bg-primary/5 transition-all text-left flex items-center justify-between group"
                                        >
                                            <div>
                                                <p className="font-black text-white group-hover:text-primary transition-colors">{plan.name}</p>
                                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">₱{plan.price} / Month</p>
                                            </div>
                                            <ChevronRight className="text-slate-600 group-hover:text-primary transition-colors" size={20} />
                                        </button>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default ResidentsManagement;
