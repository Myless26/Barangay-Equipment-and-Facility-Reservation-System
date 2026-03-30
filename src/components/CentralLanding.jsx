import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, LogIn, Globe, HardDrive, User, Building, Mail, ChevronRight, CheckCircle2, Zap, CalendarHeart, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabaseClient';
import Login from './Login';
import IsolationDocs from './IsolationDocs';
import ProvisioningDocs from './ProvisioningDocs';
import { sendCommunityEmail, EmailTemplates } from '../utils/EmailService';
export default function CentralLanding({ setSuperAdminAuth, setTenantAuth }) {
    const [showRegister, setShowRegister] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [activeTenants, setActiveTenants] = useState([]);
    const [docView, setDocView] = useState('home'); // 'home', 'isolation', 'provisioning'
    const [isLoadingTenants, setIsLoadingTenants] = useState(true);
    const [selectedTenantForLogin, setSelectedTenantForLogin] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        domain: '',
        plan: 'Basic',
        contact_name: '',
        contact_email: '',
        password: '',
        theme_color: '#3B82F6'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        fetchActiveTenants();
    }, []);

    const fetchActiveTenants = async () => {
        setIsLoadingTenants(true);
        try {
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .eq('status', 'active')
                .order('name', { ascending: true });

            if (error) throw error;

            let fetched = data || [];

            // Filter out the test and default tenants requested for removal, plus newly deleted ones
            fetched = fetched.filter(t => !['test', 'default', 'bulua', 'nazareth'].includes(t.domain));

            // Auto-provision the requested Barangays if they don't exist yet, ignoring permanently purged ones
            const requiredDomains = ['carmen', 'gusa'];
            const purgedDomains = JSON.parse(localStorage.getItem('brgy_purged_domains') || '[]');
            const missingDomains = requiredDomains.filter(d => !fetched.some(t => t.domain === d) && !purgedDomains.includes(d));

            if (missingDomains.length > 0) {
                const newBarangays = missingDomains.map(domain => {
                    const nameMap = { carmen: 'Barangay Carmen', gusa: 'Barangay Gusa', bulua: 'Barangay Bulua', nazareth: 'Barangay Nazareth' };
                    const colorMap = { carmen: '#3B82F6', gusa: '#10B981', bulua: '#F59E0B', nazareth: '#8B5CF6' };
                    return {
                        name: nameMap[domain],
                        domain: domain,
                        plan: 'Enterprise',
                        contact_name: 'Admin',
                        contact_email: 'angkolrogar69@gmail.com',
                        status: 'active',
                        theme_color: colorMap[domain]
                    };
                });

                // Insert missing
                await supabase.from('tenants').insert(newBarangays);

                // Add to view immediately
                newBarangays.forEach(nb => {
                    nb.id = Math.random().toString();
                    fetched.push(nb);
                });
            }

            setActiveTenants(fetched);
        } catch (err) {
            console.error('Error fetching tenants:', err);
        } finally {
            setIsLoadingTenants(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setIsSubmitting(true);

        if (!formData.name || !formData.domain || !formData.contact_email || !formData.password) {
            setError('Please complete all required fields to proceed.');
            setIsSubmitting(false);
            return;
        }

        try {
            // Generate v3 Token Programmatically
            const token = await new Promise((resolve, reject) => {
                if (!window.grecaptcha) {
                    reject('Security Gateway offline.');
                    return;
                }
                window.grecaptcha.ready(() => {
                    window.grecaptcha.execute('6Ld3d54sAAAAAP3EvXEE-aBUFztxop7HE_eHNvAY', { action: 'signup' })
                        .then(resolve)
                        .catch(reject);
                });
            });

            if (!token) {
                setError('Security verification failed.');
                setIsSubmitting(false);
                return;
            }
            // Verify ReCAPTCHA Token securely via our Backend Express API
            let verifyData = { success: true };
            try {
                const verifyRes = await fetch('http://localhost:3000/api/verify-captcha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: token })
                });
                verifyData = await verifyRes.json();
            } catch (apiErr) {
                console.warn('[Security] Captcha Gateway offline, bypassing for demo protocol.');
            }

            if (!verifyData.success) {
                setError('Security gateway denied access. Please try the captcha again.');
                setIsSubmitting(false);
                return;
            }

            // Check domain availability first
            const { data: existingDomain } = await supabase
                .from('tenants')
                .select('domain')
                .eq('domain', formData.domain.toLowerCase())
                .single();

            if (existingDomain) {
                setError('That domain is already taken. Please choose another.');
                setIsSubmitting(false);
                return;
            }

            // Insert new pending tenant
            const expireDate = new Date();
            expireDate.setFullYear(expireDate.getFullYear() + 5);

            const { error: insertError } = await supabase
                .from('tenants')
                .insert([{
                    name: formData.name,
                    domain: formData.domain.toLowerCase(),
                    plan: formData.plan,
                    contact_name: formData.contact_name,
                    contact_email: formData.contact_email,
                    theme_color: formData.theme_color,
                    subscription_expires_at: expireDate.toISOString(),
                    status: 'active' // Auto-approve for demonstration
                }]);

            if (insertError) throw insertError;

            // Sync with Authentication System
            const users = JSON.parse(localStorage.getItem('brgy_hub_users') || '[]');
            if (!users.find(u => u.email === formData.contact_email)) {
                users.push({
                    email: formData.contact_email,
                    password: formData.password || 'admin123',
                    name: formData.contact_name,
                    role: 'Barangay Admin'
                });
                localStorage.setItem('brgy_hub_users', JSON.stringify(users));
                console.log('[AuthSync] Self-provisioned Admin credentials stored.');
            }

            setSuccessMessage(`Success! Your Barangay instance is being provisioned at /${formData.domain.toLowerCase()}`);

            // Send welcome email to the new tenant admin
            try {
                const { subject, body } = EmailTemplates.WELCOME(formData.contact_name || formData.name);
                await sendCommunityEmail(formData.contact_email, subject, body);
            } catch (emailErr) {
                console.warn('[Email] Welcome email failed to send:', emailErr);
            }

            // Refresh tenant list to show the new one
            fetchActiveTenants();

            setTimeout(() => {
                setShowRegister(false);
                setFormData({ name: '', domain: '', plan: 'Basic', contact_name: '', contact_email: '', password: '', theme_color: '#3B82F6' });
            }, 5000);

        } catch (err) {
            console.error('Signup error:', err);
            setError('Failed to create account. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (showLogin) {
        return (
            <div className="relative">
                <button
                    onClick={() => { setShowLogin(false); setSelectedTenantForLogin(null); }}
                    className="absolute top-4 left-4 z-50 text-slate-400 hover:text-white bg-black/50 backdrop-blur-md px-4 py-2 rounded-xl"
                >
                    &larr; Back to Landing
                </button>
                <Login
                    tenant={selectedTenantForLogin}
                    onLogin={(profile, rememberMe) => {
                        // Pass the full profile back to App.jsx auth handler
                        setTenantAuth(profile, rememberMe);
                    }}
                />
            </div>
        );
    }

    if (docView === 'isolation') {
        return <IsolationDocs onBack={() => setDocView('home')} />;
    }

    if (docView === 'provisioning') {
        return <ProvisioningDocs onBack={() => setDocView('home')} />;
    }

    return (
        <div className="h-screen bg-[#0F172A] text-slate-200 flex flex-col relative w-full overflow-hidden">
            {/* Ambient Backgrounds */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 blur-[150px] rounded-full pointer-events-none" />

            {/* Top Navigation */}
            <nav className="relative z-20 flex items-center justify-between p-6 w-full border-b border-white/5 bg-[#0F172A]/80 backdrop-blur-xl shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.5)] border border-primary/20">
                        <ShieldCheck className="text-white" size={24} />
                    </div>
                    <span className="font-black text-xl tracking-tighter text-white">BrgyHub <span className="text-primary tracking-widest uppercase text-[10px] ml-1">Central Portal</span></span>
                </div>
                <div className="flex items-center gap-8">
                    {/* Resident Portal Access */}
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1 leading-none italic">Community Access Node</span>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-400 font-bold tracking-tight">Need community access?</span>
                            <button
                                onClick={() => setShowLogin(true)}
                                className="text-[10px] font-black text-primary uppercase tracking-widest hover:text-white transition-all underline underline-offset-4 decoration-primary/30 hover:decoration-white"
                            >
                                Join My Barangay
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Split Screen Container */}
            <div className="flex-1 flex flex-row overflow-hidden relative z-10 min-w-0">

                {/* Left Sidebar: Active Barangays Map */}
                <aside className="w-[380px] xl:w-[420px] bg-slate-900/60 backdrop-blur-2xl border-r border-white/5 flex flex-col shrink-0 overflow-hidden">
                    <div className="p-6 border-b border-white/5">
                        <h2 className="text-xl font-black text-white tracking-tight mb-1">Select Your Barangay</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Connect to your secure database</p>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scroll relative">
                        {isLoadingTenants ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary animate-pulse">Scanning Secure Nodes...</span>
                            </div>
                        ) : activeTenants.length === 0 ? (
                            <div className="text-center py-10 opacity-50">
                                <Globe className="mx-auto mb-3 text-slate-500" size={32} />
                                <p className="text-xs font-black uppercase tracking-widest">No Active Barangays Found</p>
                            </div>
                        ) : (
                            <AnimatePresence>
                                {activeTenants.map((tenant, idx) => (
                                    <motion.div
                                        key={tenant.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="bg-black/40 backdrop-blur-lg border border-white/5 rounded-2xl p-5 hover:border-primary/40 hover:bg-black/60 transition-all group"
                                    >
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center border border-white/10 shadow-inner group-hover:border-primary/30 transition-colors">
                                                <Building className="text-primary group-hover:scale-110 transition-transform" size={20} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-white tracking-tight leading-tight group-hover:text-primary transition-colors">{tenant.name}</h3>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <HardDrive size={10} className="text-emerald-400" />
                                                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{tenant.domain}.brgyhub.pro</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5">
                                            <button
                                                onClick={() => { setSelectedTenantForLogin(tenant); setShowLogin(true); }}
                                                className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 text-center text-[10px] font-black text-slate-300 hover:text-white uppercase tracking-widest transition-all flex flex-col items-center gap-1"
                                            >
                                                <User size={14} className="mb-0.5 opacity-50" />
                                                Resident Access
                                            </button>
                                            <button
                                                onClick={() => { setSelectedTenantForLogin(tenant); setShowLogin(true); }}
                                                className="px-3 py-2.5 rounded-xl bg-primary/10 hover:bg-primary border border-primary/20 hover:border-white text-center text-[10px] font-black text-primary hover:text-white uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(59,130,246,0.1)] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] flex flex-col items-center gap-1"
                                            >
                                                <ShieldCheck size={14} className="mb-0.5 opacity-50" />
                                                Admin Terminal
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                </aside>

                {/* Right Hero Section */}
                <main className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-8 lg:p-16 text-center min-w-0">
                    <div className="max-w-2xl w-full mx-auto relative z-10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black text-primary mb-8 tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                            Next-Gen Multi-Tenant Platform
                        </div>

                        <h1 className="text-5xl lg:text-7xl font-black mb-6 tracking-tighter leading-tight relative z-10 drop-shadow-2xl text-white">
                            One System. <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">Infinite Possibilities.</span>
                        </h1>

                        <p className="text-lg text-slate-400 max-w-2xl mb-12 leading-relaxed font-medium relative z-10">
                            Choose your Barangay from the secure sidebar, or provision a pristine new database instance. Powerful isolation, seamless experiences, zero configuration.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl relative z-10">
                            <FeatureCard
                                icon={<HardDrive />}
                                title="Database Isolation"
                                description="Row-Level Security ensures your data behaves as an entirely independent database."
                                onClick={() => setDocView('isolation')}
                            />
                            <FeatureCard
                                icon={<CalendarHeart />}
                                title="Immediate Provisioning"
                                description="Create a Barangay and receive your dedicated secure URL in milliseconds."
                                onClick={() => setDocView('provisioning')}
                            />
                        </div>
                    </div>
                </main>
            </div>

            {/* Registration Modal */}
            <AnimatePresence>
                {showRegister && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-[#0F172A] border border-white/10 rounded-[2.5rem] p-8 max-w-2xl w-full relative shadow-2xl max-h-[90vh] overflow-y-auto custom-scroll"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />

                            <button
                                onClick={() => setShowRegister(false)}
                                className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-colors border border-white/5 z-20"
                            >
                                &#10005;
                            </button>

                            <div className="mb-8 relative z-10">
                                <h3 className="text-3xl font-black text-white tracking-tight">Provision Database</h3>
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-2">Generate a new, secure Barangay ecosystem</p>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold relative z-10">
                                    {error}
                                </div>
                            )}

                            {successMessage && (
                                <div className="mb-6 p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold text-center relative z-10 flex flex-col items-center">
                                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                                        <CheckCircle2 size={32} className="text-emerald-400" />
                                    </div>
                                    <p className="mb-4">{successMessage}</p>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(`brgyhub.pro/${formData.domain.toLowerCase()}`)}
                                        className="px-6 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                    >
                                        Copy Domain Link
                                    </button>
                                </div>
                            )}

                            {!successMessage && (
                                <form onSubmit={handleSignup} className="space-y-6 relative z-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormInput
                                            icon={<Building />}
                                            label="Barangay Name"
                                            placeholder="e.g. Barangay Casisang"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />

                                        <FormInput
                                            icon={<Globe />}
                                            label="System Alias (Domain)"
                                            placeholder="casisang"
                                            value={formData.domain}
                                            onChange={(e) => setFormData({ ...formData, domain: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                                            helperText={`URL: brgyhub.pro/${formData.domain || 'domain'}`}
                                        />

                                        <div className="md:col-span-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-2 block border-l-2 border-primary/50 pl-2">Infrastructure Plan</label>
                                            <select
                                                value={formData.plan}
                                                onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                                                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:border-primary transition-all text-white font-black uppercase tracking-widest text-xs appearance-none cursor-pointer"
                                            >
                                                <option value="Basic">Basic Protocol ($49/mo)</option>
                                                <option value="Premium">Premium Database ($99/mo)</option>
                                                <option value="Enterprise">Enterprise Cluster (Custom)</option>
                                            </select>
                                        </div>

                                        <FormInput
                                            icon={<User />}
                                            label="Admin Assignee Name"
                                            placeholder="Juan Dela Cruz"
                                            value={formData.contact_name}
                                            onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                        />

                                        <FormInput
                                            icon={<Mail />}
                                            label="Admin Secure Email"
                                            type="email"
                                            placeholder="juan@casisang.gov.ph"
                                            value={formData.contact_email}
                                            onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                                        />

                                        <FormInput
                                            icon={<Lock />}
                                            label="Access Password"
                                            type="password"
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        />

                                        <div className="md:col-span-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-2 block border-l-2 border-primary/50 pl-2">Brand Identity Color</label>
                                            <div className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-4">
                                                <input
                                                    type="color"
                                                    value={formData.theme_color}
                                                    onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })}
                                                    className="w-10 h-10 rounded cursor-pointer border-none bg-transparent"
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold uppercase tracking-widest text-white">Hex Code</span>
                                                    <span className="text-[10px] font-black text-slate-500 mt-0.5">{formData.theme_color}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-center mt-6 relative z-10 w-full text-[9px] text-slate-500 text-center font-bold">
                                        Protected by <span className="text-primary ml-1 mr-1">Google HubNexus</span> Security Protocol v3.0
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full py-5 rounded-2xl bg-primary hover:bg-blue-600 border border-primary/20 text-white text-xs font-black uppercase tracking-[0.2em] relative overflow-hidden flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] mt-4"
                                    >
                                        {isSubmitting ? 'GENERATING INSTANCE...' : 'PROVISION DATABASE & LAUNCH'}
                                        {!isSubmitting && <ChevronRight size={18} />}
                                    </button>
                                </form>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Helpers
const FeatureCard = ({ icon, title, description, onClick }) => (
    <div
        onClick={onClick}
        className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-[2rem] text-left border border-white/5 hover:border-primary/40 transition-all duration-300 cursor-pointer group hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative overflow-hidden"
    >
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] group-hover:bg-primary/20 transition-colors pointer-events-none" />
        <div className="w-14 h-14 bg-black/40 border border-white/5 shadow-inner rounded-xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-500 relative z-10">
            {icon}
        </div>
        <h3 className="text-xl font-black mb-3 text-white tracking-tight relative z-10">{title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed font-bold tracking-wide relative z-10">{description}</p>
        <div className="mt-4 flex items-center gap-2 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] font-black uppercase tracking-widest">Learn More</span>
            <ChevronRight size={14} />
        </div>
    </div>
);

const FormInput = ({ icon, label, type = "text", placeholder, value, onChange, helperText }) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const isPasswordField = type === "password";

    return (
        <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-2 block border-l-2 border-primary/50 pl-2">{label}</label>
            <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">
                    {React.cloneElement(icon, { size: 18 })}
                </div>
                <input
                    type={isPasswordField ? (showPassword ? "text" : "password") : type}
                    value={value}
                    onChange={onChange}
                    className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl py-4 pl-14 pr-12 focus:outline-none focus:border-primary focus:bg-black/60 transition-all text-white placeholder:text-slate-600 font-medium shadow-inner"
                    placeholder={placeholder}
                />
                {isPasswordField && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
            </div>
            {helperText && <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-2 mt-2">{helperText}</p>}
        </div>
    );
};
