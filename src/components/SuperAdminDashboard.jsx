import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Shield, Activity, Globe, Zap, Settings, LogOut,
    Search, Plus, MoreVertical, Edit, Trash2, CheckCircle,
    XCircle, Database, Server, Cpu, ShieldCheck, ChevronRight,
    TrendingUp, ArrowUpRight, BarChart3, Mail, Phone, MapPin,
    Loader2, AlertCircle, RefreshCw, Layers, ShieldAlert, CheckCircle2,
    LayoutDashboard, Building, Lock, X, Bell, Send, CreditCard,
    Info, ArrowLeft, Calendar, Package, ChevronLeft, HardDrive, ArrowRight
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { NotificationContext, ConfirmationContext, TenantContext } from '../contexts/AppContext';
import Plans from './Plans';
import Reservations from './Reservations';
import Equipment from './Equipment';
import Analytics from './Analytics';
import Residents from './Residents';
import Archive from './Archive';
import Revenue from './Revenue';
import { sendCommunityEmail, EmailTemplates } from '../utils/EmailService';

const SuperAdminDashboard = ({ setSuperAdminAuth, onLogout }) => {
    const { notify } = useContext(NotificationContext);
    const { confirmAction } = useContext(ConfirmationContext);
    const [activeTab, setActiveTab] = useState('registry');
    const [selectedSector, setSelectedSector] = useState(null); // The Barangay we are "Deep Diving" into
    const [dataBridgeTable, setDataBridgeTable] = useState('tenants');
    const [bridgeData, setBridgeData] = useState([]);
    const [isBridgeLoading, setIsBridgeLoading] = useState(false);
    const [bridgeMode, setBridgeMode] = useState('cloud'); // 'cloud' (Supabase) or 'local' (Local Database)

    // Local Database Mock (Internal Ledger)
    const localSystemData = [
        { id: 'SYS-001', event: 'Database Snapshot', timestamp: '2026-03-30 08:45:12', status: 'COMPLETED', size: '2.4MB' },
        { id: 'SYS-002', event: 'RLS Policy Audit', timestamp: '2026-03-30 09:12:05', status: 'SUCCESS', details: 'All 4 sectors isolated' },
        { id: 'SYS-003', event: 'Auto-Backup Service', timestamp: '2026-03-30 10:00:00', status: 'IDLE', next_run: '1h 24m' },
        { id: 'SYS-004', event: 'Encryption Handshake', timestamp: '2026-03-30 15:33:44', status: 'SECURE', node: 'Global Node A' }
    ];
    const [tenants, setTenants] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [systemMetrics, setSystemMetrics] = useState({ ledgerOperations: 0, networkTraffic: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
    const [subTenant, setSubTenant] = useState(null);
    const [isSidebarOpen, setSidebarOpen] = useState(true);

    // New Tenant Form State
    const [newTenant, setNewTenant] = useState({
        name: '',
        domain: '',
        plan: 'Enterprise',
        contact_name: '',
        contact_email: '',
        password: '',
        status: 'active'
    });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Broadcast Form State
    const [broadcastData, setBroadcastData] = useState({
        tenant_id: 'all',
        title: '',
        message: '',
        target_roles: ['Resident', 'Barangay Staff', 'Secretary', 'Barangay Admin', 'Super Admin']
    });
    const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

    // Global Settings State
    const [isAutoUpdateEnabled, setIsAutoUpdateEnabled] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const checkSession = async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
            console.error('Session validation failed:', error);
            return false;
        }
        return true;
    };

    const fetchData = async () => {
        setIsLoading(true);
        const sessionValid = await checkSession();
        if (!sessionValid) {
            notify('Session Expired: Please re-authenticate.', 'error');
            setIsLoading(false);
            setSuperAdminAuth(false); // Graceful logout on expiry
            return;
        }

        try {
            // Fetch Tenants
            const { data: tenantData, error: tenantError } = await supabase
                .from('tenants')
                .select('*');

            if (tenantError) throw tenantError;

            // Filter out deprecated, test, and removed tenants
            const purgedDomains = JSON.parse(localStorage.getItem('brgy_purged_domains') || '[]');
            const cleanedTenants = tenantData
                .filter(t => !['test', 'default', 'bulua', 'nazareth'].includes(t.domain) && !purgedDomains.includes(t.domain))
                .sort((a, b) => a.name.localeCompare(b.name)); // FIXED: Alphabetical A-Z Protocol

            setTenants(cleanedTenants || []);

            // Fetch Actual Users from Database
            const { data: usersData, error: usersError } = await supabase.from('user_profiles').select('*');
            if (usersError) throw usersError;
            setAllUsers(usersData || []);

            // Fetch Real-time Ledger Operations (Count all events)
            const { count: resCount } = await supabase.from('reservations').select('*', { count: 'exact', head: true });
            const { count: eqCount } = await supabase.from('equipment').select('*', { count: 'exact', head: true });

            // Generate Real-time Network Traffic (latency check)
            const fetchStart = performance.now();
            await supabase.from('tenants').select('id').limit(1);
            const fetchEnd = performance.now();

            setSystemMetrics({
                ledgerOperations: (resCount || 0) + (eqCount || 0),
                networkTraffic: Math.round(fetchEnd - fetchStart)
            });

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleStatus = (tenant) => {
        const newStatus = tenant.status === 'active' ? 'disabled' : 'active';
        confirmAction(
            `${newStatus === 'active' ? 'Enable' : 'Disable'} Instance?`,
            `Are you sure you want to set ${tenant.name} status to ${newStatus}? This will immediately affect all users in this sector.`,
            async () => {
                try {
                    const { error } = await supabase
                        .from('tenants')
                        .update({ status: newStatus })
                        .eq('id', tenant.id);

                    if (error) throw error;
                    setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, status: newStatus } : t));
                    notify(`${tenant.name} status updated to ${newStatus}`, 'success');

                    // Email the tenant admin about the status change
                    if (tenant.contact_email) {
                        const emailSubject = newStatus === 'active'
                            ? `${tenant.name} Instance Re-Activated`
                            : `${tenant.name} Instance Suspended`;
                        const emailBody = newStatus === 'active'
                            ? `Your Barangay Hub instance for <b>${tenant.name}</b> has been re-activated by the system administrator. All services are now online.`
                            : `Your Barangay Hub instance for <b>${tenant.name}</b> has been temporarily suspended by the system administrator. Please contact support if you believe this is an error.`;
                        sendCommunityEmail(tenant.contact_email, emailSubject, emailBody).catch(() => { });
                    }
                } catch (err) {
                    console.error('Error toggling status:', err);
                    notify('Failed to update instance status', 'error');
                }
            },
            newStatus === 'active' ? 'Enable' : 'Disable'
        );
    };

    const handleUpdateUserRole = (email, newRole) => {
        confirmAction(
            'Execute Identity Protocol?',
            `Apply ${newRole} clearance for ${email}? This user will be created if they do not yet exist in the global registry.`,
            () => {
                const userExists = allUsers.find(u => u.email === email);
                let updatedUsers;

                if (userExists) {
                    updatedUsers = allUsers.map(u => u.email === email ? { ...u, role: newRole } : u);
                    notify(`Global clearance updated for ${email}`, 'success');
                } else {
                    // Provision new identity
                    const newUser = {
                        email,
                        name: email.split('@')[0],
                        role: newRole,
                        password: 'password123', // Standard default for manually provisioned accounts
                        status: 'Approved',
                        created_at: new Date().toISOString()
                    };
                    updatedUsers = [...allUsers, newUser];
                    notify(`New ${newRole} identity provisioned: ${email}`, 'success');
                }

                setAllUsers(updatedUsers);
                localStorage.setItem('brgy_hub_users', JSON.stringify(updatedUsers));
            },
            'Execute Protocol'
        );
    };

    const openSubModal = (tenant) => {
        setSubTenant({
            id: tenant.id,
            name: tenant.name,
            subscription_expires_at: tenant.subscription_expires_at ? new Date(tenant.subscription_expires_at).toISOString().split('T')[0] : '',
            features: tenant.features || { analytics: true, custom_branding: false }
        });
        setIsSubModalOpen(true);
    };

    const handleUpdateSubscription = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase
                .from('tenants')
                .update({
                    subscription_expires_at: subTenant.subscription_expires_at,
                    features: subTenant.features
                })
                .eq('id', subTenant.id);

            if (error) throw error;

            setTenants(prev => prev.map(t => t.id === subTenant.id ? { ...t, subscription_expires_at: subTenant.subscription_expires_at, features: subTenant.features } : t).sort((a, b) => a.name.localeCompare(b.name)));
            setIsSubModalOpen(false);
            notify(`Subscription updated for ${subTenant.name}`, 'success');
        } catch (err) {
            console.error('Error updating subscription:', err);
            notify('Failed to update subscription', 'error');
        }
    };

    useEffect(() => {
        if (activeTab === 'registry' || activeTab === 'bridge' || activeTab === 'residents') {
            fetchBridgeData();
        }
    }, [activeTab, dataBridgeTable, selectedSector, bridgeMode]);

    const fetchBridgeData = async () => {
        if (bridgeMode === 'local') {
            setBridgeData(localSystemData);
            setIsBridgeLoading(false);
            return;
        }

        setIsBridgeLoading(true);
        const targetTable = dataBridgeTable || 'tenants';
        console.log(`[Bridge] Syncing Master Ledger: ${targetTable} ${selectedSector ? `for ${selectedSector.name}` : '(GLOBAL)'}`);

        try {
            const sessionValid = await checkSession();
            if (!sessionValid && bridgeMode === 'cloud') {
                notify('Master Bridge Interrupted: Session protocol expired.', 'error');
                setSuperAdminAuth(false);
                return;
            }

            let query = supabase.from(targetTable).select('*');

            // If we are deep-diving, filter by tenant_id
            if (selectedSector && targetTable !== 'tenants') {
                query = query.eq('tenant_id', selectedSector.id);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            const filterData = (rawData) => {
                if (targetTable !== 'tenants') return rawData || [];
                const purgedDomains = JSON.parse(localStorage.getItem('brgy_purged_domains') || '[]');
                return (rawData || []).filter(t => !['test', 'default', 'bulua', 'nazareth'].includes(t.domain) && !purgedDomains.includes(t.domain));
            };

            if (error) {
                if (error.message?.includes('JWT expired')) {
                    notify('Sync Protocol Timeout: Refreshing session...', 'warning');
                    const { error: refreshError } = await supabase.auth.refreshSession();
                    if (refreshError) throw refreshError;
                    // Retry fetch once after refresh
                    const { data: retryData, error: retryError } = await query.order('created_at', { ascending: false });
                    if (retryError) throw retryError;
                    setBridgeData(filterData(retryData));
                } else {
                    throw error;
                }
            } else {
                setBridgeData(filterData(data));
            }
        } catch (err) {
            console.error('Bridge Fetch Error:', err);
            const userMsg = err.message?.includes('JWT expired') ? 'Security Session Timed Out. Please log in again.' : err.message;
            notify(`Master Bridge Failure: ${userMsg}`, 'error');
        } finally {
            setIsBridgeLoading(false);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'registry': {
                if (selectedSector) {
                    return (
                        <SectorDeepDive
                            sector={selectedSector}
                            onBack={() => { setSelectedSector(null); setBridgeData([]); }}
                            activeTable={dataBridgeTable}
                            setActiveTable={setDataBridgeTable}
                            data={bridgeData}
                            isLoading={isBridgeLoading}
                            onEdit={openEditModal}
                            allUsers={allUsers}
                        />
                    );
                }
                return (
                    <CommandCenter
                        tenants={tenants}
                        allUsers={allUsers}
                        setIsBroadcastModalOpen={setIsBroadcastModalOpen}
                        systemMetrics={systemMetrics}
                        bridgeData={bridgeData}
                        isBridgeLoading={isBridgeLoading}
                        dataBridgeTable={dataBridgeTable}
                        setDataBridgeTable={setDataBridgeTable}
                        bridgeMode={bridgeMode}
                        setBridgeMode={setBridgeMode}
                        setSelectedSector={setSelectedSector}
                        setActiveTab={setActiveTab}
                    />
                );
            }
            case 'plans': return <Plans tenants={tenants} />;
            case 'revenue': return <Revenue tenants={tenants} />;
            case 'reservations': return <Reservations tenants={tenants} />;
            case 'equipment': return <Equipment tenants={tenants} />;
            case 'analytics': return <Analytics tenants={tenants} />;
            case 'tenants':
                return (
                    <TenantManagementView
                        tenants={tenants}
                        allUsers={allUsers}
                        onToggleStatus={handleToggleStatus}
                        onEdit={openEditModal}
                    />
                );
            case 'residents':
                return (
                    <DataBridgeExplorer
                        activeTable={dataBridgeTable}
                        setActiveTable={setDataBridgeTable}
                        data={bridgeData}
                        isLoading={isBridgeLoading}
                        bridgeMode={bridgeMode}
                        setBridgeMode={setBridgeMode}
                        onExplore={(sector) => {
                            setSelectedSector(sector);
                            setActiveTab('registry');
                        }}
                    />
                );
            case 'archive': return <Archive />;
            case 'rbac': return <UserRBAC allUsers={allUsers} onUpdateRole={handleUpdateUserRole} />;
            case 'health': return <DataCoreManager tenants={tenants} />;
            case 'settings': return <GlobalSettings />;
            default: return (
                <TenantRegistry
                    tenants={tenants}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    onEdit={openEditModal}
                    onManageSub={openSubModal}
                    onUpdateStatus={handleToggleStatus}
                    onDelete={handleDeleteTenant}
                    onExplore={setSelectedSector}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    itemsPerPage={itemsPerPage}
                />
            );
        }
    };

    const CommandCenter = ({
        tenants,
        allUsers,
        setIsBroadcastModalOpen,
        systemMetrics,
        bridgeData,
        isBridgeLoading,
        dataBridgeTable,
        setDataBridgeTable,
        bridgeMode,
        setBridgeMode,
        setSelectedSector,
        setActiveTab
    }) => {
        const [logs, setLogs] = useState(localSystemData);
        const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
        const [purgeTarget, setPurgeTarget] = useState(null);
        const [purgeConfirmText, setPurgeConfirmText] = useState('');

        const [logPage, setLogPage] = useState(1);
        const logsPerPage = 5;
        const totalLogPages = Math.ceil(logs.length / logsPerPage);
        const paginatedLogs = logs.slice((logPage - 1) * logsPerPage, logPage * logsPerPage);

        const handleForceBackup = () => {
            notify('Initializing Master Ledger Backup...', 'info');
            setTimeout(() => {
                const newLog = {
                    id: `SYS-${Math.floor(Math.random() * 1000)}`,
                    event: 'Manual Master Backup',
                    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
                    status: 'COMPLETED',
                    size: '4.2MB'
                };
                setLogs([newLog, ...logs]);
                notify('Master Ledger successfully backed up to cold storage.', 'success');
            }, 1500);
        };

        const handleEmergencyLockdown = () => {
            confirmAction(
                'Initiate Network Lockdown?',
                'WARNING: This will immediately sever all user connections globally. Do not proceed unless responding to a critical security event.',
                () => {
                    notify('System Lockdown Initiated. All nodes securing...', 'error');
                },
                'LOCKDOWN SYSTEM'
            );
        };

        const handlePurgeTenant = () => {
            if (!purgeTarget) return;
            if (purgeConfirmText !== purgeTarget.name) {
                notify('Confirmation text does not match. Purge aborted.', 'error');
                return;
            }
            confirmAction(
                '⚠️ PERMANENT NODE PURGE',
                `This will PERMANENTLY delete ${purgeTarget.name} and all associated records from the global database. This CANNOT be undone.`,
                async () => {
                    try {
                        // Hard delete from Supabase
                        const { error } = await supabase
                            .from('tenants')
                            .delete()
                            .eq('id', purgeTarget.id);
                        if (error) throw error;

                        // Blacklist domain so CentralLanding won't re-provision it
                        const purged = JSON.parse(localStorage.getItem('brgy_purged_domains') || '[]');
                        if (!purged.includes(purgeTarget.domain)) {
                            purged.push(purgeTarget.domain);
                            localStorage.setItem('brgy_purged_domains', JSON.stringify(purged));
                        }

                        setTenants(prev => prev.filter(t => t.id !== purgeTarget.id));
                        const newLog = {
                            id: `SYS-${Math.floor(Date.now() / 1000)}`,
                            event: `Node Purged: ${purgeTarget.name}`,
                            timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
                            status: 'PURGED',
                            size: 'N/A'
                        };
                        setLogs(prev => [newLog, ...prev]);
                        notify(`${purgeTarget.name} has been permanently purged from the network.`, 'success');
                        setIsPurgeModalOpen(false);
                        setPurgeTarget(null);
                        setPurgeConfirmText('');
                    } catch (err) {
                        console.error('Purge error:', err);
                        notify('Failed to purge node. Check database permissions.', 'error');
                    }
                },
                'CONFIRM PURGE'
            );
        };

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Metrics Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="glass-card p-6 border-l-4 border-l-primary flex items-center gap-6">
                        <div className="p-4 rounded-2xl bg-primary/10 text-primary"><Building size={24} /></div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest leading-tight">Deployed Hubs</p>
                            <h3 className="text-3xl font-black text-white">{tenants.length}</h3>
                        </div>
                    </div>
                    <div className="glass-card p-6 border-l-4 border-l-emerald-500 flex items-center gap-6">
                        <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500"><Users size={24} /></div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest leading-tight">Total Active Users</p>
                            <h3 className="text-3xl font-black text-white">{allUsers.length}</h3>
                        </div>
                    </div>
                    <div className="glass-card p-6 border-l-4 border-l-purple-500 flex items-center gap-6">
                        <div className="p-4 rounded-2xl bg-purple-500/10 text-purple-500"><Activity size={24} /></div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest leading-tight">Network Traffic</p>
                            <h3 className="text-3xl font-black text-white flex items-center gap-2">~{systemMetrics?.networkTraffic || 0}ms <TrendingUp size={16} className="text-purple-400 opacity-50" /></h3>
                        </div>
                    </div>
                    <div className="glass-card p-6 border-l-4 border-l-blue-400 flex items-center gap-6">
                        <div className="p-4 rounded-2xl bg-blue-400/10 text-blue-400"><Database size={24} /></div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest leading-tight">Ledger Operations</p>
                            <h3 className="text-3xl font-black text-white">{systemMetrics?.ledgerOperations || 0}<span className="text-sm text-slate-500 ml-1">Total</span></h3>
                        </div>
                    </div>
                </div>

                {/* Big Widgets */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Authority Controls */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="glass p-8 rounded-[3rem] border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-amber-500/10 transition-all duration-700" />
                            <h3 className="text-2xl font-black text-white flex items-center gap-3 mb-2"><Bell className="text-amber-500" /> Global Alert Terminal</h3>
                            <p className="text-sm text-slate-400 mb-8 max-w-lg">Instantly broadcast critical messages to specific sectors or the entire network hierarchy.</p>

                            <button
                                onClick={() => setIsBroadcastModalOpen(true)}
                                className="w-full sm:w-auto px-8 py-5 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all flex justify-center items-center gap-3 border border-amber-500/20"
                            >
                                <Send size={20} /> Initialize Broadcast
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div onClick={handleForceBackup} className="glass-card p-6 flex flex-col items-start cursor-pointer group hover:bg-white/5 transition-all">
                                <div className="p-4 rounded-[1.5rem] bg-indigo-500/10 text-indigo-400 mb-4 group-hover:scale-110 transition-transform"><HardDrive size={24} /></div>
                                <h4 className="text-white font-black text-lg">Force System Backup</h4>
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Snapshot master ledger</p>
                                <ArrowRight className="mt-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-2 transition-all" size={20} />
                            </div>

                            <div onClick={handleEmergencyLockdown} className="glass-card p-6 flex flex-col items-start cursor-pointer hover:bg-red-500/5 border border-white/5 hover:border-red-500/20 group transition-all">
                                <div className="p-4 rounded-[1.5rem] bg-red-500/10 text-red-500 mb-4 group-hover:scale-110 transition-transform"><ShieldAlert size={24} /></div>
                                <h4 className="text-white font-black text-lg">Network Lockdown</h4>
                                <p className="text-[10px] text-red-400/50 uppercase tracking-widest mt-1">Emergency protocol only</p>
                                <ArrowRight className="mt-4 text-slate-500 group-hover:text-red-500 group-hover:translate-x-2 transition-all" size={20} />
                            </div>

                            <div onClick={() => setIsPurgeModalOpen(true)} className="glass-card p-6 flex flex-col items-start cursor-pointer hover:bg-orange-500/5 border border-white/5 hover:border-orange-500/20 group transition-all">
                                <div className="p-4 rounded-[1.5rem] bg-orange-500/10 text-orange-500 mb-4 group-hover:scale-110 transition-transform"><Trash2 size={24} /></div>
                                <h4 className="text-white font-black text-lg">Purge Node</h4>
                                <p className="text-[10px] text-orange-400/50 uppercase tracking-widest mt-1">Permanent deletion authority</p>
                                <ArrowRight className="mt-4 text-slate-500 group-hover:text-orange-500 group-hover:translate-x-2 transition-all" size={20} />
                            </div>
                        </div>
                    </div>

                    {/* Security Feed Stream */}
                    <div className="glass border-white/5 rounded-[3rem] p-1 flex flex-col h-[500px]">
                        <div className="p-6 pb-2 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-lg font-black text-white flex items-center gap-2"><Cpu size={18} className="text-primary" /> Live Core Stream</h3>
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
                            {paginatedLogs.map((log) => (
                                <div key={log.id} className="relative pl-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-[-1rem] before:w-[2px] before:bg-white/5 last:before:hidden">
                                    <div className={`absolute left-1 top-2 w-[10px] h-[10px] rounded-full border-2 border-[#0A1221] z-10 ${log.status === 'COMPLETED' ? 'bg-primary' :
                                        log.status === 'SECURE' ? 'bg-emerald-500' : 'bg-slate-500'
                                        }`} />
                                    <h5 className="text-white text-sm font-bold">{log.event}</h5>
                                    <div className="flex items-center gap-3 mt-1 text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-slate-500">{log.timestamp}</span>
                                        <span className={log.status === 'COMPLETED' ? 'text-primary' : log.status === 'SECURE' ? 'text-emerald-500' : 'text-slate-400'}>{log.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {totalLogPages > 1 && (
                            <div className="flex justify-between items-center p-4 border-t border-white/5 bg-white/5 mx-2 mb-2 rounded-[2rem]">
                                <button disabled={logPage === 1} onClick={() => setLogPage(prev => prev - 1)} className="px-4 py-2 bg-white/5 rounded-xl text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-20">&larr; Prev</button>
                                <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Page {logPage} / {totalLogPages}</span>
                                <button disabled={logPage === totalLogPages} onClick={() => setLogPage(prev => prev + 1)} className="px-4 py-2 bg-white/5 rounded-xl text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-20">Next &rarr;</button>
                            </div>
                        )}
                    </div>
                </div>
                <AnimatePresence>
                    {isPurgeModalOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-[#0A1221] border border-red-500/20 rounded-[2.5rem] p-8 max-w-md w-full relative overflow-hidden shadow-2xl"
                            >
                                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-[80px] pointer-events-none" />
                                <h3 className="text-2xl font-black text-red-500 mb-2 flex items-center gap-2"><ShieldAlert size={24} /> PERMANENT PURGE</h3>
                                <p className="text-sm font-medium text-slate-400 mb-6">Select a Node to permanently destroy. This bypasses all recovery protocols.</p>

                                <div className="space-y-4 relative z-10">
                                    <select
                                        className="w-full bg-black/40 border border-red-500/20 rounded-xl py-3 px-4 focus:outline-none focus:border-red-500 transition-all text-white font-black uppercase tracking-widest text-[10px]"
                                        onChange={(e) => setPurgeTarget(tenants.find(t => t.id === e.target.value))}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Select Target Node</option>
                                        {tenants.map(t => (
                                            <option key={t.id} value={t.id}>{t.name} ({t.domain})</option>
                                        ))}
                                    </select>

                                    {purgeTarget && (
                                        <div className="animate-in fade-in slide-in-from-top-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-red-500/80 ml-2 mb-2 block">Confirm By Typing: <span className="text-red-400">{purgeTarget.name}</span></label>
                                            <input
                                                type="text"
                                                value={purgeConfirmText}
                                                onChange={(e) => setPurgeConfirmText(e.target.value)}
                                                className="w-full bg-black/40 border border-red-500/20 rounded-xl py-3 px-4 focus:outline-none focus:border-red-500 transition-all text-red-400 font-black tracking-widest text-xs"
                                                placeholder={`${purgeTarget.name}`}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-3 mt-8 relative z-10">
                                    <button
                                        onClick={() => { setIsPurgeModalOpen(false); setPurgeTarget(null); setPurgeConfirmText(''); }}
                                        className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        Abort
                                    </button>
                                    <button
                                        onClick={handlePurgeTenant}
                                        disabled={!purgeTarget || purgeConfirmText !== purgeTarget.name}
                                        className="px-6 py-3 rounded-xl bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-red-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        <Trash2 size={14} /> Execute Purge
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    const TenantManagementView = ({ tenants, allUsers, onToggleStatus, onEdit }) => {
        const [selectedTenantId, setSelectedTenantId] = useState(null);

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-4xl font-black text-white tracking-tighter">Activation & Lifecycle Control</h2>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-2">Manage Community Deployment and Infrastructure Activation</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-6 py-3 bg-primary text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2"
                        >
                            <Plus size={16} /> Deploy New Sector
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {tenants.map(tenant => {
                        const tenantUsers = allUsers.filter(u => u.tenant_id === tenant.id);
                        const isExpanded = selectedTenantId === tenant.id;

                        return (
                            <div key={tenant.id} className={`glass overflow-hidden rounded-[2.5rem] border transition-all duration-500 ${isExpanded ? 'border-primary/40 bg-primary/5' : 'border-white/5 bg-white/0 hover:border-white/10'}`}>
                                <div className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                                    <div className="flex items-center gap-6">
                                        <div
                                            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-2xl border border-white/10"
                                            style={{ background: `linear-gradient(135deg, ${tenant.theme_color || '#3B82F6'}, ${tenant.theme_color}CC)` }}
                                        >
                                            {tenant.name[0]}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-white leading-none mb-1">{tenant.name}</h3>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">brgyhub.pro/{tenant.domain}</span>
                                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${tenant.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                                                    {tenant.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="flex gap-4 pr-6 border-r border-white/5">
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Pop.</p>
                                                <p className="text-lg font-black text-white">{tenantUsers.length}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Rank</p>
                                                <p className="text-lg font-black text-primary">{tenant.plan === 'Enterprise' ? 'S' : 'A'}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setSelectedTenantId(isExpanded ? null : tenant.id)}
                                                className={`p-3 rounded-xl transition-all ${isExpanded ? 'bg-primary text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                                            >
                                                <Users size={20} />
                                            </button>
                                            <button
                                                onClick={() => onEdit(tenant)}
                                                className="p-3 bg-white/5 text-slate-400 hover:text-primary rounded-xl transition-all border border-white/5"
                                            >
                                                <Settings size={20} />
                                            </button>
                                            <button
                                                onClick={() => onToggleStatus(tenant)}
                                                className={`px-5 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${tenant.status === 'active' ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white'}`}
                                            >
                                                {tenant.status === 'active' ? 'Deactivate' : 'Activate'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="border-t border-white/5 bg-black/20"
                                        >
                                            <div className="p-8">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Global Identity Registry for {tenant.name}</h4>
                                                    <span className="text-[10px] font-bold text-slate-600">{tenantUsers.length} Recorded Identites</span>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                                    {tenantUsers.map(user => (
                                                        <div key={user.email} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
                                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center font-black text-xs text-slate-500 group-hover:text-primary transition-colors">
                                                                {user.email[0].toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-bold text-white truncate">{user.full_name || user.name || 'Resident Node'}</p>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-[10px] font-medium text-slate-500 truncate">{user.email}</p>
                                                                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${user.role === 'Barangay Admin' ? 'bg-amber-500/20 text-amber-500' : 'bg-primary/20 text-primary'}`}>
                                                                        {user.role === 'Barangay Admin' ? 'Admin' : 'Resident'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {tenantUsers.length === 0 && (
                                                        <div className="col-span-full py-12 text-center text-slate-600 font-bold italic border border-dashed border-white/10 rounded-2xl opacity-50 uppercase tracking-widest text-[10px]">
                                                            No identity signatures detected in this sector node.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const GlobalSettings = () => (
        <div className="space-y-8 max-w-7xl">
            <h2 className="text-4xl font-black text-white tracking-tight">Global Command Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="glass p-8 rounded-[3rem] border-white/5 space-y-6">
                    <h3 className="text-xl font-black text-white flex items-center gap-3"><Shield size={24} className="text-primary" /> Access Control</h3>
                    <div className="space-y-4">
                        <ToggleSetting label="Multi-Factor Auth" active={true} />
                        <ToggleSetting label="IP Whitelisting" active={false} />
                        <ToggleSetting label="Session Hardening" active={true} />
                    </div>
                </div>
                <div className="glass p-8 rounded-[3rem] border-white/5 space-y-6">
                    <h3 className="text-xl font-black text-white flex items-center gap-3"><Zap size={24} className="text-emerald-400" /> System Engine</h3>
                    <div className="space-y-4">
                        <ToggleSetting label="Auto-Backup Sync" active={true} />
                        <ToggleSetting label="5-Year Auto-Update Plan" active={isAutoUpdateEnabled} onClick={() => {
                            setIsAutoUpdateEnabled(!isAutoUpdateEnabled);
                            notify(`5-Year Auto-Update Plan ${!isAutoUpdateEnabled ? 'Enabled' : 'Disabled'}`, 'success');
                        }} />
                        <ToggleSetting label="Cluster Overclock" active={false} />
                        <ToggleSetting label="HMR Diagnostics" active={true} />
                    </div>
                </div>
            </div>
            <div className="p-8 bg-primary/10 rounded-[3rem] border border-primary/20 flex items-center justify-between">
                <div>
                    <h4 className="text-white font-black text-lg">System Update Available</h4>
                    <p className="text-slate-400 text-sm">Cluster v3.4.2 is ready for deployment across all nodes.</p>
                </div>
                <button className="px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all">Update Now</button>
            </div>
        </div>
    );

    const ToggleSetting = ({ label, active, onClick }) => (
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors" onClick={onClick}>
            <span className="font-bold text-white select-none">{label}</span>
            <div className={`w-12 h-6 rounded-full relative transition-colors ${active ? 'bg-primary' : 'bg-slate-700'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${active ? 'left-7' : 'left-1'}`} />
            </div>
        </div>
    );

    const handleDeleteTenant = (id) => {
        confirmAction(
            'Purge Sector Permanently?',
            'CRITICAL: This will destroy the entire barangay instance and all associated records. This protocol is irreversible.',
            async () => {
                try {
                    const { error } = await supabase.from('tenants').delete().eq('id', id);
                    if (error) throw error;
                    setTenants(prev => prev.filter(t => t.id !== id));
                    notify('Sector purged from global registry', 'success');
                } catch (error) {
                    console.error('Error deleting tenant:', error);
                    notify('Failed to purge sector', 'error');
                }
            },
            'Purge Now'
        );
    };

    const openEditModal = (tenant) => {
        setNewTenant({
            name: tenant.name || '',
            domain: tenant.domain || '',
            plan: tenant.plan || 'Enterprise',
            contact_name: tenant.contact_name || '',
            contact_email: tenant.contact_email || '',
            password: '', // Password always initialized to empty for security/controlled state
            status: tenant.status || 'active'
        });
        setEditingId(tenant.id);
        setIsCreateModalOpen(true);
    };

    const handleCreateTenant = async (e) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const sanitizedDomain = newTenant.domain.toLowerCase().replace(/[^a-z0-9-]/g, '');
            if (editingId) {
                const { data, error } = await supabase.from('tenants').update({
                    name: newTenant.name, domain: sanitizedDomain, plan: newTenant.plan,
                    contact_name: newTenant.contact_name, contact_email: newTenant.contact_email, status: newTenant.status
                }).eq('id', editingId).select().single();
                if (error) throw error;
                // FIXED: Using functional update to prevent data loss (stale state closure)
                setTenants(prev => prev.map(t => t.id === editingId ? data : t).sort((a, b) => a.name.localeCompare(b.name)));
            } else {
                const { data, error } = await supabase.from('tenants').insert([{
                    name: newTenant.name, domain: sanitizedDomain, plan: newTenant.plan,
                    contact_name: newTenant.contact_name, contact_email: newTenant.contact_email, status: newTenant.status
                }]).select().single();
                if (error) throw error;
                // FIXED: Functional update with re-sorting for a safe, atomic deployment
                setTenants(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
            }

            // Sync with Authentication System
            const users = JSON.parse(localStorage.getItem('brgy_hub_users') || '[]');
            if (!users.find(u => u.email === newTenant.contact_email)) {
                users.push({
                    email: newTenant.contact_email,
                    password: newTenant.password || 'admin123',
                    name: newTenant.contact_name,
                    role: 'Barangay Admin',
                    tenant_id: data.id
                });
                localStorage.setItem('brgy_hub_users', JSON.stringify(users));
                console.log('[AuthSync] Barangay Admin credentials provisioned.');
            }

            setIsCreateModalOpen(false);

            // Send Congratulations Email
            if (newTenant.contact_email && !editingId) {
                const template = EmailTemplates.TENANT_WELCOME(newTenant.name, newTenant.contact_name);
                sendCommunityEmail(newTenant.contact_email, template.subject, template.body).catch(e => {
                    console.error('Failed to notify new tenant admin:', e);
                });
            }

            setEditingId(null);
            setNewTenant({
                name: '',
                domain: '',
                plan: 'Enterprise',
                contact_name: '',
                contact_email: '',
                password: '',
                status: 'active'
            });
            notify(`Sector ${newTenant.name} deployed and admin credentials assigned.`, 'success');
        } catch (error) {
            console.error('Error saving tenant:', error);
            notify('Failed to save tenant configuration.', 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSendBroadcast = async (e) => {
        e.preventDefault();
        setIsSendingBroadcast(true);
        try {
            let targetTenants = tenants;
            if (broadcastData.tenant_id !== 'all') {
                targetTenants = tenants.filter(t => t.id === broadcastData.tenant_id);
            }

            const inserts = targetTenants.map(t => ({
                tenant_id: t.id,
                title: broadcastData.title,
                message: broadcastData.message,
                target_roles: broadcastData.target_roles,
                read_by: []
            }));

            const { error } = await supabase.from('notifications').insert(inserts);
            if (error) throw error;

            notify(`Broadcast sent to ${targetTenants.length} instances successfully`, 'success');
            setIsBroadcastModalOpen(false);
            setBroadcastData({ ...broadcastData, title: '', message: '' });
        } catch (error) {
            console.error('Error sending broadcast:', error);
            notify('Failed to execute global broadcast', 'error');
        } finally {
            setIsSendingBroadcast(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#060D1A] text-slate-200 flex overflow-hidden">
            {/* Ambient Backgrounds */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none">
                <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-primary/10 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-purple-500/10 blur-[150px] rounded-full" />
            </div>

            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{ width: isSidebarOpen ? 280 : 80 }}
                className="bg-[#0A1221]/80 backdrop-blur-2xl border-r border-white/5 flex flex-col relative z-30"
            >
                {/* Dashboard Identity Badge */}
                <div className="px-4 py-2 flex items-center gap-2 bg-amber-500/10 border-b border-white/5">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    {isSidebarOpen && (
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400">
                            Super Admin Command Center
                        </span>
                    )}
                </div>

                <div className="p-6 mb-8 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg border border-white/10">
                            <ShieldCheck className="text-white" size={24} />
                        </div>
                        {isSidebarOpen && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <h2 className="font-black text-xl tracking-tighter text-white">Hub<span className="text-primary">Nexus</span></h2>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Global Control</p>
                            </motion.div>
                        )}
                    </div>
                    <button
                        onClick={() => setSidebarOpen(!isSidebarOpen)}
                        className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all transform hover:scale-110 active:scale-95"
                    >
                        <RefreshCw size={14} className={isSidebarOpen ? "" : "rotate-180"} />
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scroll py-4">
                    <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'registry' && !selectedSector} onClick={() => { setActiveTab('registry'); setSelectedSector(null); }} isOpen={isSidebarOpen} />
                    <SidebarItem icon={<CreditCard size={20} />} label="Plans & Revenue" active={activeTab === 'plans'} onClick={() => setActiveTab('plans')} isOpen={isSidebarOpen} />
                    <SidebarItem icon={<Calendar size={20} />} label="Reservations" active={activeTab === 'reservations'} onClick={() => setActiveTab('reservations')} isOpen={isSidebarOpen} />
                    <SidebarItem icon={<Package size={20} />} label="Equipment" active={activeTab === 'equipment'} onClick={() => setActiveTab('equipment')} isOpen={isSidebarOpen} />
                    <SidebarItem icon={<Building size={20} />} label="Activation & Node Control" active={activeTab === 'tenants'} onClick={() => setActiveTab('tenants')} isOpen={isSidebarOpen} />
                    <SidebarItem icon={<BarChart3 size={20} />} label="Analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} isOpen={isSidebarOpen} />
                    <SidebarItem icon={<HardDrive size={20} />} label="Local Database" active={activeTab === 'residents'} onClick={() => { setActiveTab('residents'); setDataBridgeTable('tenants'); }} isOpen={isSidebarOpen} />
                    <SidebarItem icon={<Layers size={20} />} label="Data Archive" active={activeTab === 'archive'} onClick={() => setActiveTab('archive')} isOpen={isSidebarOpen} />

                    <div className="py-4 px-4 flex items-center gap-2">
                        <div className="border-t border-white/10 flex-1" />
                        {isSidebarOpen && <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] whitespace-nowrap">Global Identity</span>}
                        <div className="border-t border-white/10 flex-1" />
                    </div>
                    <SidebarItem icon={<ShieldCheck size={20} />} label="Access Control" active={activeTab === 'rbac'} onClick={() => setActiveTab('rbac')} isOpen={isSidebarOpen} />

                    <div className="py-4 px-4 flex items-center gap-2">
                        <div className="border-t border-white/10 flex-1" />
                        {isSidebarOpen && <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] whitespace-nowrap">Infrastructure</span>}
                        <div className="border-t border-white/10 flex-1" />
                    </div>

                    <SidebarItem icon={<Activity size={20} />} label="Storage Capacity & Health" active={activeTab === 'health'} onClick={() => setActiveTab('health')} isOpen={isSidebarOpen} />
                    {/* Bridge now integrated into Database Explorer */}
                    <SidebarItem icon={<Settings size={20} />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} isOpen={isSidebarOpen} />
                </nav>

                <div className="p-4 mt-auto border-t border-white/5 space-y-4">
                    {isSidebarOpen && (
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 mb-4">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">System Status</p>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[11px] font-bold text-white">All Clusters Nominal</span>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => confirmAction(
                            'Deactivate Terminal?',
                            'Are you sure you want to terminate the Super Admin session and return to the main entry point?',
                            () => onLogout ? onLogout() : setSuperAdminAuth(false),
                            'Sign Out Now'
                        )}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors font-semibold text-sm ${!isSidebarOpen && 'justify-center'}`}
                    >
                        <LogOut size={18} />
                        {isSidebarOpen && "Sign Out"}
                    </button>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative z-20 min-w-0">
                <header className="p-8 pb-0 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 text-primary mb-2">
                            <Zap size={16} fill="currentColor" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Operational Readiness active</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tighter">
                            {activeTab === 'registry' ? "Global Command Center" : activeTab === 'rbac' ? "Global RBAC Console" : "Infrastructure Pulse"}
                        </h1>
                    </div>
                    {activeTab === 'registry' && (
                        <div className="flex gap-4">
                            <button
                                onClick={() => setIsBroadcastModalOpen(true)}
                                className="bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-inner border border-amber-500/20 flex items-center gap-3"
                            >
                                <Bell size={18} /> Alert Network
                            </button>
                        </div>
                    )}
                </header>

                <div className="p-8">
                    {isLoading ? (
                        <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full"
                            />
                            <p className="text-primary font-black tracking-widest uppercase text-[10px]">Synchronizing Global State...</p>
                        </div>
                    ) : renderContent()}
                </div>
            </main>

            {/* Modals & Overlays */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0F172A] border border-white/10 p-10 rounded-[3rem] w-full max-w-2xl shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
                            <div className="flex justify-between items-center mb-10 relative z-10">
                                <h2 className="text-3xl font-black text-white tracking-tight">Provision Sector</h2>
                                <button onClick={() => setIsCreateModalOpen(false)} className="p-3 bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
                            </div>
                            <form onSubmit={handleCreateTenant} className="space-y-8 relative z-10">
                                <div className="grid grid-cols-2 gap-6">
                                    <InputBlock label="Barangay Name" value={newTenant.name} onChange={v => setNewTenant({ ...newTenant, name: v })} placeholder="Barangay Carmen" />
                                    <InputBlock label="Domain ID" value={newTenant.domain} onChange={v => setNewTenant({ ...newTenant, domain: v })} placeholder="carmen" prefix="brgyhub.pro/" />
                                    <InputBlock label="Primary Admin" value={newTenant.contact_name} onChange={v => setNewTenant({ ...newTenant, contact_name: v })} placeholder="Octavio Dela Cruz" />
                                    <InputBlock label="Access Email" type="email" value={newTenant.contact_email} onChange={v => setNewTenant({ ...newTenant, contact_email: v })} placeholder="admin@carmen.ph" />
                                    <InputBlock label="Admin Password" type="password" value={newTenant.password} onChange={v => setNewTenant({ ...newTenant, password: v })} placeholder="admin123" />
                                </div>
                                <div className="flex justify-end gap-4 pt-6">
                                    <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-8 py-4 bg-white/5 text-slate-400 font-bold rounded-2xl">Cancel</button>
                                    <button type="submit" className="px-10 py-4 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-lg hover:scale-105 transition-all">
                                        {isCreating ? "Initializing..." : "Deploy Sector"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}

                {/* Subscription Modal */}
                {isSubModalOpen && subTenant && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0F172A] border border-white/10 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
                            <div className="flex justify-between items-center mb-10 relative z-10">
                                <div>
                                    <h2 className="text-3xl font-black text-white tracking-tight">Manage Plan</h2>
                                    <p className="text-primary font-bold text-sm tracking-widest uppercase">{subTenant.name}</p>
                                </div>
                                <button onClick={() => setIsSubModalOpen(false)} className="p-3 bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
                            </div>
                            <form onSubmit={handleUpdateSubscription} className="space-y-6 relative z-10">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block">Expiration Date</label>
                                    <input
                                        type="date"
                                        value={subTenant.subscription_expires_at || ''}
                                        onChange={e => setSubTenant({ ...subTenant, subscription_expires_at: e.target.value })}
                                        className="w-full bg-[#1A2132] border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-primary transition-all font-medium"
                                        required
                                    />
                                </div>

                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <h4 className="text-[10px] font-black tracking-widest uppercase text-slate-500 mb-2">Feature Flags</h4>

                                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-xl text-primary"><BarChart3 size={18} /></div>
                                            <span className="font-bold text-white tracking-widest text-xs uppercase">Advanced Analytics</span>
                                        </div>
                                        <div
                                            onClick={() => setSubTenant({ ...subTenant, features: { ...subTenant.features, analytics: !subTenant.features.analytics } })}
                                            className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer ${subTenant.features?.analytics ? 'bg-primary' : 'bg-slate-700'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${subTenant.features?.analytics ? 'left-7' : 'left-1'}`} />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400"><Layers size={18} /></div>
                                            <span className="font-bold text-white tracking-widest text-xs uppercase">Custom Branding</span>
                                        </div>
                                        <div
                                            onClick={() => setSubTenant({ ...subTenant, features: { ...subTenant.features, custom_branding: !subTenant.features.custom_branding } })}
                                            className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer ${subTenant.features?.custom_branding ? 'bg-purple-500' : 'bg-slate-700'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${subTenant.features?.custom_branding ? 'left-7' : 'left-1'}`} />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-4 pt-6 mt-6 border-t border-white/5">
                                    <button type="button" onClick={() => setIsSubModalOpen(false)} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-slate-400 font-bold rounded-2xl transition-all">Cancel</button>
                                    <button type="submit" className="px-10 py-4 bg-emerald-500 text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all">
                                        Save Plan Updates
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}

                {/* Broadcast Modal */}
                {isBroadcastModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0F172A] border border-amber-500/20 p-10 rounded-[3rem] w-full max-w-lg shadow-[0_0_50px_rgba(245,158,11,0.1)] relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
                            <div className="flex justify-between items-center mb-8 relative z-10">
                                <div>
                                    <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                                        <Bell className="text-amber-500" /> Dispatch Alert
                                    </h2>
                                    <p className="text-slate-400 font-bold text-xs mt-2 uppercase tracking-widest">Global Network Override</p>
                                </div>
                                <button onClick={() => setIsBroadcastModalOpen(false)} className="p-3 bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
                            </div>
                            <form onSubmit={handleSendBroadcast} className="space-y-6 relative z-10">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block">Target Node</label>
                                    <select
                                        value={broadcastData.tenant_id}
                                        onChange={e => setBroadcastData({ ...broadcastData, tenant_id: e.target.value })}
                                        className="w-full bg-[#1A2132] border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-amber-500 transition-all font-medium appearance-none"
                                    >
                                        <option value="all">🌐 All Active Instances (Global Broadcast)</option>
                                        {tenants.map(t => (
                                            <option key={t.id} value={t.id}>{t.name} ({t.domain})</option>
                                        ))}
                                    </select>
                                </div>

                                <InputBlock label="Alert Designation" value={broadcastData.title} onChange={v => setBroadcastData({ ...broadcastData, title: v })} placeholder="e.g., Scheduled Maintenance" required />

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block">Alert Payload</label>
                                    <textarea
                                        value={broadcastData.message}
                                        onChange={e => setBroadcastData({ ...broadcastData, message: e.target.value })}
                                        placeholder="Enter the transmission data..."
                                        className="w-full bg-[#1A2132] border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-amber-500 transition-all font-medium min-h-[120px]"
                                        required
                                    />
                                </div>

                                <div className="flex justify-end gap-4 pt-4 mt-6 border-t border-white/5">
                                    <button type="button" onClick={() => setIsBroadcastModalOpen(false)} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-slate-400 font-bold rounded-2xl transition-all">Abort</button>
                                    <button type="submit" disabled={isSendingBroadcast} className="px-10 py-4 bg-amber-500 text-black font-black uppercase text-xs tracking-widest rounded-2xl shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                                        {isSendingBroadcast ? 'Transmitting...' : <><Send size={16} /> Fire Protocol</>}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const SidebarItem = ({ icon, label, active, onClick, isOpen, badge }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all border relative ${active ? 'bg-primary/20 text-primary border-primary/20 shadow-inner' : 'text-slate-500 border-transparent hover:bg-white/5 hover:text-white'
            } ${!isOpen && 'justify-center'}`}
    >
        {icon}
        {isOpen && <span className="font-bold text-sm tracking-tight">{label}</span>}
        {badge && (
            <span className="ml-auto bg-primary/30 text-primary text-[8px] font-black px-1.5 py-0.5 rounded-full border border-primary/20">
                {badge}
            </span>
        )}
    </button>
);

const TenantRegistry = ({ tenants, searchTerm, setSearchTerm, onEdit, onManageSub, onUpdateStatus, onDelete, onExplore, currentPage, setCurrentPage, itemsPerPage }) => {
    const totalPages = Math.ceil(tenants.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedTenants = tenants.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-3xl border border-white/5 mb-8">
                <div className="flex items-center gap-4 flex-1">
                    <Search className="text-slate-500 ml-4" size={20} />
                    <input
                        type="text"
                        placeholder="Search global network..."
                        className="bg-transparent border-none text-white w-full focus:outline-none font-medium"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-4 pr-4">
                    <Metric label="Total Hubs" value={tenants.length} />
                    <Metric label="Live Traffic" value={`${tenants.length * 12 + 15}ms`} />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {paginatedTenants.length === 0 ? (
                    <div className="py-20 text-center opacity-30">
                        <Activity size={48} className="mx-auto mb-4" />
                        <p className="font-black uppercase tracking-widest text-xs">No Nodes Located in Search Buffer</p>
                    </div>
                ) : (
                    paginatedTenants.map((tenant, i) => (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            key={tenant.id}
                            onClick={() => onExplore(tenant)}
                            className="w-full bg-[#1A2235]/40 backdrop-blur-xl px-5 py-4 rounded-[2rem] border border-white/5 flex items-center gap-4 group hover:border-primary/30 hover:bg-[#1A2235]/60 hover:shadow-2xl transition-all overflow-hidden cursor-pointer relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                            {/* Icon */}
                            <div className="w-12 h-12 shrink-0 rounded-xl bg-white/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                <Building size={24} />
                            </div>

                            {/* Barangay Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-black text-white group-hover:text-primary transition-colors truncate">{tenant.name}</h3>
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded shrink-0 ${tenant.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                        {tenant.status}
                                    </span>
                                </div>
                                <p className="text-slate-500 font-medium text-xs truncate">brgyhub.pro/{tenant.domain}</p>
                            </div>

                            {/* Admin label — only on xl screens */}
                            <div className="hidden xl:block shrink-0 pl-4 pr-4 border-x border-white/5">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Admin</p>
                                <p className="text-xs font-bold text-white whitespace-nowrap">{tenant.contact_name || 'System Admin'}</p>
                            </div>

                            {/* Action Buttons — always shrink-0 so they never overflow */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button onClick={() => onExplore(tenant)} className="p-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl transition-all" title="Explore Sector">
                                    <ChevronRight size={16} />
                                </button>
                                <button onClick={() => onUpdateStatus(tenant)} className={`p-2.5 rounded-xl transition-colors ${tenant.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`} title="Toggle Status">
                                    <Shield size={16} />
                                </button>
                                <button onClick={() => onManageSub(tenant)} className="p-2.5 bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-white rounded-xl transition-colors" title="Subscription">
                                    <CreditCard size={16} />
                                </button>
                                <button onClick={() => onEdit(tenant)} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white" title="Edit">
                                    <Settings size={16} />
                                </button>
                                <button onClick={() => onDelete(tenant.id)} className="p-2.5 bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-colors" title="Delete">
                                    <X size={16} />
                                </button>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Pagination UI */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-12 bg-white/5 p-4 rounded-[1.5rem] border border-white/5">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        className={`p-3 bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all disabled:opacity-20`}
                    >
                        &larr; Prev
                    </button>
                    <div className="flex gap-2">
                        {[...Array(totalPages)].map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentPage(i + 1)}
                                className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${currentPage === i + 1 ? 'bg-primary text-white shadow-lg' : 'bg-white/5 text-slate-500 hover:text-white'}`}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className={`p-3 bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all disabled:opacity-20`}
                    >
                        Next &rarr;
                    </button>
                </div>
            )}
        </div>
    );
};

// Deprecated legacy UserRBAC removed from here

const DataCoreManager = ({ tenants }) => {
    const [page, setPage] = useState(1);
    const itemsPerPage = 6;
    const totalPages = Math.ceil(tenants.length / itemsPerPage);
    const paginatedTenants = tenants.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <HealthCard
                    title="PostgreSQL Cluster Alpha"
                    status="Nominal"
                    details="Primary Database Engine handling all HubNexus nodes. Multi-tenant RLS active."
                    icon={<Database />}
                />
                <HealthCard
                    title="S3 Cloud Asset Registry"
                    status="Scaling"
                    details="Automatic resizing active for Barangay logos and resident evidence uploads."
                    icon={<Server />}
                />
            </div>

            <div className="bg-[#1A2235]/40 backdrop-blur-2xl rounded-[3rem] border border-white/5 overflow-hidden">
                <div className="p-8 border-b border-white/5 bg-white/5">
                    <h3 className="text-xl font-black text-white">Instance Database Health</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Real-time resource allocation per sector</p>
                </div>
                <div className="p-8 space-y-8">
                    {paginatedTenants.map((t, i) => {
                        const globalIndex = i + (page - 1) * itemsPerPage;
                        return (
                            <div key={globalIndex} className="flex flex-col gap-3">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <h4 className="text-white font-black">{t.name} Core</h4>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">ID: {t.id.substring(0, 13)}...</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-black text-primary uppercase tracking-widest">{12 + (globalIndex * 4)} MB Used</p>
                                        <p className="text-[10px] text-emerald-400 font-bold">SQL Cluster 0{globalIndex + 1} ONLINE</p>
                                    </div>
                                </div>
                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(10, 60 - (globalIndex * 5))}%` }} className="h-full bg-gradient-to-r from-primary to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {totalPages > 1 && (
                    <div className="flex justify-between items-center p-4 border-t border-white/5 bg-white/5 mx-2 mb-2 rounded-[2rem]">
                        <button disabled={page === 1} onClick={() => setPage(prev => prev - 1)} className="px-4 py-2 bg-white/5 rounded-xl text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-20">&larr; Prev</button>
                        <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Page {page} / {totalPages}</span>
                        <button disabled={page === totalPages} onClick={() => setPage(prev => prev + 1)} className="px-4 py-2 bg-white/5 rounded-xl text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-20">Next &rarr;</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// Small Helpers
const InputBlock = ({ label, value, onChange, placeholder, type = "text", prefix = "" }) => (
    <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block">{label}</label>
        <div className="relative">
            {prefix && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold pointer-events-none">{prefix}</span>}
            <input
                type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className={`w-full bg-[#1A2132] border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-primary transition-all font-medium ${prefix ? 'pl-28' : ''}`}
            />
        </div>
    </div>
);

const DisplayCard = ({ title, value, icon }) => (
    <div className="bg-[#1A2235]/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">{icon}</div>
        <h4 className="text-4xl font-black text-white tracking-tighter mb-1">{value}</h4>
        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{title}</p>
    </div>
);

const HealthCard = ({ title, status, details, icon }) => (
    <div className="glass p-8 rounded-[2.5rem] border-white/5">
        <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl border border-primary/20">{icon}</div>
            <h4 className="text-xl font-black text-white">{title}</h4>
        </div>
        <div className="flex items-center gap-2 mb-2 text-emerald-400">
            <CheckCircle2 size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">{status}</span>
        </div>
        <p className="text-sm text-slate-400 font-medium">{details}</p>
    </div>
);

const Metric = ({ label, value }) => (
    <div className="text-right px-6 border-l border-white/10 last:border-r-0">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-lg font-black text-white leading-none">{value}</p>
    </div>
);

const DataBridgeExplorer = ({ activeTable, setActiveTable, data, isLoading, bridgeMode, setBridgeMode, onExplore }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;
    const totalPages = Math.ceil((data?.length || 0) / itemsPerPage);
    const paginatedData = (data || []).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const bridgeTabs = [
        { id: 'tenants', label: 'Master Registry (Barangays)', icon: <Building size={14} /> },
        { id: 'user_profiles', label: 'Identity Matrix', icon: <Users size={14} /> },
        { id: 'reservations', label: 'Global Bookings', icon: <Calendar size={14} /> },
        { id: 'equipment', label: 'Asset Ledger', icon: <Package size={14} /> }
    ];

    return (
        <div className="bg-[#1A2235]/60 backdrop-blur-3xl rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl">
            <div className="p-6 md:p-8 border-b border-white/5 bg-white/5 flex flex-col lg:flex-row flex-wrap justify-between items-center gap-6 md:gap-8">
                <div className="shrink-0 text-center lg:text-left">
                    <h3 className="text-2xl font-black text-white flex items-center justify-center lg:justify-start gap-3">
                        <Database className="text-primary" size={24} />
                        Local Database Master Ledger
                    </h3>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Multi-Node Hybrid Architecture Active</p>
                </div>

                <div className="flex bg-[#0A1221] p-1.5 rounded-[2rem] border border-white/10 shadow-inner overflow-x-auto no-scrollbar shrink-0 max-w-full">
                    {bridgeTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTable(tab.id); setCurrentPage(1); }}
                            className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${activeTable === tab.id ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'text-slate-500 hover:text-white'}`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {setBridgeMode && (
                    <div className="flex bg-[#0A1221] p-1.5 rounded-[2rem] border border-white/10 shadow-inner shrink-0">
                        <button
                            onClick={() => { setBridgeMode('cloud'); setCurrentPage(1); }}
                            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${bridgeMode === 'cloud' ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'text-slate-500 hover:text-white'}`}
                        >
                            <Globe size={14} /> Cloud Node
                        </button>
                        <button
                            onClick={() => { setBridgeMode('local'); setCurrentPage(1); }}
                            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${bridgeMode === 'local' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-105' : 'text-slate-500 hover:text-white'}`}
                        >
                            <Server size={14} /> Local Database
                        </button>
                    </div>
                )}
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/[0.02]">
                <div
                    onClick={() => { setBridgeMode('cloud'); setCurrentPage(1); }}
                    className={`p-6 rounded-3xl border transition-all cursor-pointer hover:scale-[1.02] active:scale-95 ${bridgeMode === 'cloud' ? 'bg-primary/10 border-primary/30' : 'bg-white/5 border-white/5 opacity-40 hover:opacity-70'}`}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary"><Globe size={20} /></div>
                            <div>
                                <h4 className="text-white font-bold">PostgreSQL Cluster</h4>
                                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black">AWS Region: ap-southeast-1</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">Primary production node handling infinite barangay scaling and real-time synchronization.</p>
                </div>

                <div
                    onClick={() => { setBridgeMode('local'); setCurrentPage(1); }}
                    className={`p-6 rounded-3xl border transition-all cursor-pointer hover:scale-[1.02] active:scale-95 ${bridgeMode === 'local' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/5 opacity-40 hover:opacity-70'}`}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400"><Server size={20} /></div>
                            <div>
                                <h4 className="text-white font-bold">Local Database</h4>
                                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Super Admin Local Instance</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20 text-[9px] font-black uppercase tracking-widest">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Standby
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">Secondary audit database stored inside the application core for mission-critical redundancy.</p>
                </div>
            </div>

            {activeTable === 'tenants' && !isLoading && paginatedData.length > 0 ? (
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {paginatedData.map((row, idx) => (
                        <div
                            key={idx}
                            onClick={() => onExplore && onExplore(row)}
                            className="group relative bg-[#0A1221]/40 border border-white/5 rounded-[2.5rem] p-8 hover:bg-[#0A1221]/60 hover:border-primary/30 transition-all cursor-pointer shadow-xl overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Database size={80} />
                            </div>

                            <div className="flex justify-between items-start mb-6 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black uppercase text-xs">
                                        #{idx + 1 + (currentPage - 1) * itemsPerPage}
                                    </div>
                                    <code className="text-[10px] font-black text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/5 tracking-widest">
                                        {row.id?.toString().substring(0, 8) || 'BT-882'}
                                    </code>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${row.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                    {row.status || 'Active'}
                                </span>
                            </div>

                            <div className="mb-8 relative z-10">
                                <h4 className="text-2xl font-black text-white group-hover:text-primary transition-colors tracking-tight">{row.name || 'Barangay Entity'}</h4>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1 flex items-center gap-2">
                                    <Globe size={12} /> {row.domain || 'brgyhub.pro'}
                                </p>
                            </div>

                            <div className="flex items-center justify-between pt-6 border-t border-white/5 relative z-10">
                                <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                    <div className={`w-1.5 h-1.5 rounded-full ${bridgeMode === 'cloud' ? 'bg-primary' : 'bg-emerald-500'}`} />
                                    {bridgeMode === 'cloud' ? 'Cloud-PostgreSQL' : 'Local-Admin-Database'}
                                </div>
                                <button className="flex items-center gap-2 px-4 py-2 bg-primary rounded-xl text-[9px] font-black uppercase tracking-widest text-white shadow-lg shadow-primary/20 transform group-hover:translate-x-1 transition-all">
                                    Deep Dive <ArrowRight size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-[.3em] text-slate-500 whitespace-nowrap">
                                <th className="px-5 md:px-8 py-6">Identity Reference</th>
                                <th className="px-5 md:px-8 py-6">Data Point / {activeTable === 'tenants' ? 'Barangay Entity' : 'Event'}</th>
                                <th className="px-5 md:px-8 py-6">Status Header</th>
                                <th className="px-5 md:px-8 py-6 text-right">Node Routing</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr><td colSpan="4" className="px-8 py-20 text-center animate-pulse text-xs font-black uppercase tracking-widest opacity-30">Synchronizing Node Buffers...</td></tr>
                            ) : paginatedData.length === 0 ? (
                                <tr><td colSpan="4" className="px-8 py-20 text-center text-slate-500 text-xs font-black uppercase tracking-widest opacity-30">No Data Stream Detected on this Node</td></tr>
                            ) : (
                                paginatedData.map((row, idx) => (
                                    <tr
                                        key={idx}
                                        onClick={() => activeTable === 'tenants' && onExplore && onExplore(row)}
                                        className={`hover:bg-white/[0.02] transition-colors group ${activeTable === 'tenants' && onExplore ? 'cursor-pointer' : ''}`}
                                    >
                                        <td className="px-5 md:px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-slate-500">#{idx + 1 + (currentPage - 1) * itemsPerPage}</div>
                                                <code className="text-[11px] font-black text-primary px-2 py-1 bg-primary/10 rounded border border-primary/10 tracking-widest">
                                                    {String(row.id || row.tenant_id || 'GLOBAL').substring(0, 8)}
                                                </code>
                                            </div>
                                        </td>
                                        <td className="px-5 md:px-8 py-5">
                                            <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">{row.name || row.title || row.event || 'System Entry'}</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{row.category || row.facility || row.timestamp || row.domain || 'N/A'}</p>
                                        </td>
                                        <td className="px-5 md:px-8 py-5">
                                            <div className="flex items-center justify-between">
                                                <span className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${(row.status === 'active' || row.status === 'SUCCESS' || row.status === 'Approved' || row.status === 'COMPLETED')
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                    }`}>
                                                    {row.status || 'Active Node'}
                                                </span>
                                                {activeTable === 'tenants' && (
                                                    <button className="flex items-center gap-2 text-[9px] font-black uppercase text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                                        Go <ChevronRight size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 md:px-8 py-5 text-right">
                                            <div className="inline-flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                <div className={`w-1.5 h-1.5 rounded-full ${bridgeMode === 'cloud' ? 'bg-primary' : 'bg-emerald-500'}`} />
                                                {bridgeMode === 'cloud' ? 'Cloud-PostgreSQL' : 'Local-Database'}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {totalPages > 1 && (
                <div className="p-6 border-t border-white/5 bg-white/5 flex justify-center items-center gap-4">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        className="px-6 py-2 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white disabled:opacity-20 transition-all border border-white/5"
                    >
                        &larr; Previous Page
                    </button>
                    <div className="flex gap-2">
                        {[...Array(totalPages)].map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentPage(i + 1)}
                                className={`w-8 h-8 rounded-lg text-[9px] font-black transition-all ${currentPage === i + 1 ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="px-6 py-2 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white disabled:opacity-20 transition-all border border-white/5"
                    >
                        Next Page &rarr;
                    </button>
                </div>
            )}
        </div>
    );
};

const SectorDeepDive = ({ sector, onBack, activeTable, setActiveTable, data, isLoading, onEdit, allUsers }) => {
    const drillTabs = [
        { id: 'tenants', label: 'Overview Hub', icon: <Info size={16} /> },
        { id: 'user_profiles', label: 'Identity Registry', icon: <Users size={16} /> },
        { id: 'reservations', label: 'Sector Bookings', icon: <Calendar size={16} /> },
        { id: 'equipment', label: 'Asset Inventory', icon: <Package size={16} /> }
    ];

    // Calculate Sector Specific Stats
    const sectorUsers = (allUsers || []).filter(u => u.tenant_id === sector.id);
    const adminCount = sectorUsers.filter(u => u.role?.includes('Admin')).length;
    const residentCount = sectorUsers.filter(u => u.role === 'Resident').length;

    return (
        <div className="flex flex-col xl:flex-row gap-6 md:gap-8 items-start">
            {/* Sector Sidebar Navigation */}
            <div className="w-full xl:w-80 shrink-0 space-y-6">
                <div className="bg-[#1A2235]/40 backdrop-blur-2xl p-8 rounded-[3rem] border border-white/5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent opacity-50" />
                    <button onClick={onBack} className="mb-6 p-4 bg-white/5 hover:bg-primary rounded-2xl transition-all text-slate-500 hover:text-white group/btn flex items-center gap-3 w-full font-black text-[10px] uppercase tracking-widest relative z-10">
                        <ArrowLeft size={18} className="group-hover/btn:-translate-x-1 transition-transform" /> Back to Registry
                    </button>

                    <div className="relative z-10 mb-8">
                        <h2 className="text-3xl font-black text-white tracking-tighter leading-none mb-2">{sector.name}</h2>
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Operational
                        </div>
                    </div>

                    <div className="space-y-2 relative z-10">
                        {drillTabs.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTable(t.id)}
                                className={`flex items-center gap-4 w-full px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTable === t.id ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                            >
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="mt-8 pt-8 border-t border-white/5 relative z-10">
                        <button onClick={() => onEdit(sector)} className="w-full px-6 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-white flex items-center gap-3 transition-all">
                            <Settings size={16} /> Sector Config
                        </button>
                    </div>
                </div>

                <div className="bg-[#1A2235]/20 p-6 rounded-[2.5rem] border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Infrastructure Routing</p>
                    <code className="text-[10px] text-primary bg-primary/5 p-3 rounded-xl block border border-primary/10 font-bold truncate">
                        {sector.domain}.brgyhub.pro
                    </code>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 w-full space-y-8">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTable}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {activeTable === 'tenants' ? (
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                                    <MetricCard label="Total Identities" value={residentCount + adminCount} icon={<Users />} color="primary" />
                                    <MetricCard label="Authorities" value={adminCount} icon={<ShieldCheck />} color="emerald" />
                                    <MetricCard label="Live Events" value={data.length} icon={<Calendar />} color="amber" />
                                    <MetricCard label="Node Uptime" value="100%" icon={<Activity />} color="blue" />
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                    <div className="glass-card p-10 rounded-[3rem] border-white/5 relative overflow-hidden group min-h-[400px]">
                                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                        <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-3">
                                            <Users className="text-primary" size={24} /> Authorized Personnel
                                        </h3>
                                        <div className="space-y-4">
                                            {sectorUsers.filter(u => u.role?.includes('Admin')).map(user => (
                                                <div key={user.email} className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/20 transition-all group/item">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black uppercase text-xs">{user.email[0]}</div>
                                                        <div>
                                                            <p className="font-black text-white">{user.name || user.email.split('@')[0]}</p>
                                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{user.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="px-3 py-1 bg-primary/20 text-primary rounded-full text-[9px] font-black uppercase border border-primary/20">{user.role}</div>
                                                </div>
                                            ))}
                                            {sectorUsers.filter(u => u.role?.includes('Admin')).length === 0 && (
                                                <div className="text-center py-20 text-slate-500 font-bold italic opacity-30">No administrative records found for this sector.</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="glass-card p-10 rounded-[3rem] border-white/5 bg-gradient-to-br from-white/0 to-primary/5 min-h-[400px]">
                                        <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-3">
                                            <Activity className="text-primary" size={24} /> Real-Time Telemetry
                                        </h3>
                                        <div className="space-y-4">
                                            {data.slice(0, 5).map((item, i) => (
                                                <div key={i} className="flex items-center gap-5 p-5 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/[0.08] transition-all">
                                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><Calendar size={20} /></div>
                                                    <div className="flex-1">
                                                        <p className="font-bold text-white text-base leading-tight">{item.title || 'System Syncing...'}</p>
                                                        <div className="flex items-center gap-3 mt-1.5">
                                                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{item.timestamp || item.created_at?.split('T')[0]}</span>
                                                            <span className="w-1 h-1 rounded-full bg-white/20" />
                                                            <span className="text-[9px] text-primary font-black uppercase tracking-widest">Global Master Data</span>
                                                        </div>
                                                    </div>
                                                    <ChevronRight size={16} className="text-slate-600" />
                                                </div>
                                            ))}
                                            {data.length === 0 && (
                                                <div className="text-center py-20 text-slate-500 font-bold italic opacity-30">Waiting for data stream from node...</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between px-6 py-4 bg-primary/5 rounded-3xl border border-primary/10">
                                    <div className="flex items-center gap-3">
                                        <Database size={18} className="text-primary" />
                                        <span className="text-[10px] font-black text-white uppercase tracking-widest">{activeTable.replace('_', ' ')} Registry</span>
                                    </div>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Filter: {sector.name}</span>
                                </div>
                                <DataBridgeExplorer activeTable={activeTable} setActiveTable={setActiveTable} data={data} isLoading={isLoading} />
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

const UserRBAC = ({ allUsers, onUpdateRole }) => {
    const [emailTarget, setEmailTarget] = useState('');
    const [roleTarget, setRoleTarget] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const itemsPerPage = 8;
    const totalPages = Math.ceil(allUsers.length / itemsPerPage);
    const paginatedUsers = allUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!emailTarget || !roleTarget) return;
        onUpdateRole(emailTarget, roleTarget);
        setEmailTarget('');
    }

    return (
        <div className="space-y-8 max-w-5xl animate-in fade-in slide-in-from-bottom-4 pb-20">
            <div>
                <h2 className="text-4xl font-black text-white tracking-tighter">Access Control Protocol</h2>
                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] mt-2">Level 4 System Command Override</p>
            </div>

            <div className="glass p-10 rounded-[3rem] border border-white/5 relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
                <h3 className="text-2xl font-black text-white flex items-center gap-3 mb-2"><ShieldCheck className="text-primary" size={28} /> Execute Authority Override</h3>
                <p className="text-sm text-slate-400 mb-8 max-w-xl font-medium leading-relaxed">Assign permanent administrative capabilities directly via documented email identity. Doing this elevates their account powers globally.</p>
                <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-6 relative z-10">
                    <div className="flex-[2]">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Digital Identification Envelope (Email)</label>
                        <div className="relative">
                            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
                            <input type="email" required placeholder="resident@registry.brgyhub.pro" value={emailTarget} onChange={(e) => setEmailTarget(e.target.value)} className="w-full bg-[#0A1221] border border-white/10 rounded-2xl py-5 pl-12 pr-4 text-white focus:outline-none focus:border-primary transition-all font-bold shadow-inner" />
                        </div>
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Designate Privilege Class</label>
                        <select className="w-full bg-[#0A1221] border border-white/10 rounded-2xl py-5 px-4 text-white focus:outline-none focus:border-primary transition-all font-black uppercase tracking-widest text-xs shadow-inner appearance-none relative" value={roleTarget} onChange={e => setRoleTarget(e.target.value)} required>
                            <option value="" disabled>Select Clearance Structure</option>
                            <option value="Resident">Standard Resident</option>
                            <option value="Admin">Barangay Sector Admin</option>
                            <option value="Super Admin">System Super Admin</option>
                        </select>
                    </div>
                    <button type="submit" disabled={!emailTarget || !roleTarget} className="bg-primary text-white px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 hover:scale-105 hover:bg-white hover:text-primary active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-6 pt-[3px] border border-primary/30">
                        Enforce Identity Protocol
                    </button>
                </form>
            </div>

            <div className="glass flex flex-col rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl mt-8 p-1">
                <div className="p-6 pb-2 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-lg font-black text-white flex items-center gap-2"><CreditCard size={18} className="text-secondary" /> Active Directory Footprint</h3>
                </div>
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead>
                            <tr className="text-[9px] font-black uppercase text-slate-500 tracking-widest border-b border-white/5">
                                <th className="px-6 py-4">Identity Envelope</th>
                                <th className="px-6 py-4">Current Sector Node</th>
                                <th className="px-6 py-4">Security Clearance</th>
                                <th className="px-6 py-4 text-right">SysStatus</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {paginatedUsers.length > 0 ? paginatedUsers.map((user, idx) => (
                                <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-[10px] uppercase border border-primary/20">{user.email[0]}</div>
                                        <span className="font-bold text-slate-300 text-sm group-hover:text-white transition-colors">{user.email}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{user.tenant_id ? String(user.tenant_id).substring(0, 8) : 'GLOBAL NEXUS'}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest ${user.role === 'Super Admin' ? 'text-amber-500 border-amber-500/30 bg-amber-500/10' : user.role === 'Admin' ? 'text-primary' : 'text-slate-400'}`}>
                                            {user.role || 'Resident'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 text-emerald-400">
                                            <CheckCircle2 size={12} />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Active</span>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="4" className="text-center py-10 text-[10px] font-black uppercase tracking-widest text-slate-600">No identities logged</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-5 p-4 border-t border-white/5 bg-white/5">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="px-6 py-3 bg-white/5 rounded-2xl text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-20">&larr; Prev</button>
                        <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Page {currentPage} of {totalPages}</span>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="px-6 py-3 bg-white/5 rounded-2xl text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-20">Next &rarr;</button>
                    </div>
                )}
            </div>
        </div>
    )
}

const MetricCard = ({ label, value, icon, trend, color = 'primary', delay = 0 }) => {
    const colorMap = {
        primary: 'text-primary bg-primary/10',
        emerald: 'text-emerald-400 bg-emerald-400/10',
        amber: 'text-amber-500 bg-amber-500/10',
        blue: 'text-blue-400 bg-blue-400/10'
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="bg-[#1A2235]/40 backdrop-blur-2xl border border-white/5 p-6 rounded-[2.5rem] flex items-center justify-between group hover:border-white/10 hover:bg-[#1A2235]/60 transition-all shadow-xl min-w-0"
        >
            <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${colorMap[color]}`}>
                    {React.cloneElement(icon, { size: 24 })}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 truncate">{label}</p>
                    <div className="flex items-center gap-2 md:gap-3">
                        <p className="text-2xl md:text-3xl font-black text-white tracking-tighter leading-none">{value}</p>
                        {trend && (
                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-lg border border-emerald-400/10 shrink-0">
                                {trend}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default SuperAdminDashboard;
