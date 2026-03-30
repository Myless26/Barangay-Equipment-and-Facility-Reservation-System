import React, { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, User, Lock, Palette, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { TenantContext, NotificationContext } from '../contexts/AppContext';

export default function Settings() {
    const { currentTenant } = useContext(TenantContext);
    const { notify } = useContext(NotificationContext);

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [themeColor, setThemeColor] = useState('#3B82F6');
    const [avatarUrl, setAvatarUrl] = useState('');

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // Load real values directly from localStorage to emulate backend for MVP
        const users = JSON.parse(localStorage.getItem('brgy_hub_users') || '[]');
        // Finding the current logged-in user relies on the active session. This assumes we had saved the active email somewhere or we just pick the first match (simplified).
        // Since we don't have a reliable context for ONLY the active user email here (App.jsx holds currentRole, not currentUser email), we'll do a robust check.
        // Actually, let's look up the "active_user_email" from localStorage if we added it during login. If not, we will rely on a new global state or just fetch it.
        const activeEmail = localStorage.getItem('active_user_email') || '';
        const user = users.find(u => u.email === activeEmail);
        
        if (user) {
            setName(user.name);
            setEmail(user.email);
            setPassword(user.password || 'admin123'); // Demo fallback
            setThemeColor(user.theme_color || currentTenant?.theme_color || '#3B82F6');
            setAvatarUrl(user.avatar_url || '');
        } else {
            // Demo fallback if `active_user_email` was not securely stored (i.e. older sessions)
            const fallbackUser = users[0] || { name: 'System User', email: 'user@brgyhub.pro', password: 'admin123' };
            setName(fallbackUser.name);
            setEmail(fallbackUser.email);
            setPassword(fallbackUser.password);
            setThemeColor(fallbackUser.theme_color || '#3B82F6');
            setAvatarUrl(fallbackUser.avatar_url || '');
            localStorage.setItem('active_user_email', fallbackUser.email); // Force sync
        }
    }, [currentTenant]);

    const handleAvatarUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarUrl(reader.result);
                // Also eagerly update the UI var for instant feedback
                const ls = JSON.parse(localStorage.getItem('brgy_hub_users') || '[]');
                const activeEmail = localStorage.getItem('active_user_email');
                const pIndex = ls.findIndex(u => u.email === activeEmail);
                if (pIndex !== -1) {
                    ls[pIndex].avatar_url = reader.result;
                    localStorage.setItem('brgy_hub_users', JSON.stringify(ls));
                    // Dispatch custom event so App.jsx header/sidebar updates live
                    window.dispatchEvent(new Event('userProfileUpdate'));
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = (e) => {
        e.preventDefault();
        setIsSaving(true);
        setTimeout(() => {
            const users = JSON.parse(localStorage.getItem('brgy_hub_users') || '[]');
            const activeEmail = localStorage.getItem('active_user_email');
            const userIndex = users.findIndex(u => u.email === activeEmail);
            
            if (userIndex !== -1) {
                users[userIndex].name = name;
                users[userIndex].theme_color = themeColor;
                if (newPassword) {
                    users[userIndex].password = newPassword;
                }
                localStorage.setItem('brgy_hub_users', JSON.stringify(users));
                
                // Update live app theme immediately
                document.documentElement.style.setProperty('--color-primary', themeColor);
                window.dispatchEvent(new Event('userProfileUpdate'));
                
                notify('Settings saved successfully. Changes applied system-wide.', 'success');
                setNewPassword(''); // clear new password field
            } else {
                notify('Failed to save settings. Session invalid.', 'error');
            }
            setIsSaving(false);
        }, 800);
    };

    return (
        <div className="space-y-6 pb-20">
            <header className="mb-8">
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <SettingsIcon className="text-primary" size={32} /> 
                    Preferences Matrix
                </h1>
                <p className="text-slate-400 mt-2 font-medium">Personalize your administrative dashboard, security credentials, and identity presence within the sector.</p>
            </header>

            <form onSubmit={handleSave} className="space-y-8 max-w-4xl">
                
                {/* Profile Identity */}
                <section className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none text-primary"><User size={120} /></div>
                    
                    <h2 className="text-xl font-black text-white flex items-center gap-3 border-b border-white/10 pb-4 relative z-10">
                        <ImageIcon size={20} className="text-primary" /> Visual Identity
                    </h2>
                    
                    <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                        <div className="relative group shrink-0">
                            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/10 shadow-[0_0_30px_rgba(59,130,246,0.2)] bg-[#0B1120] flex items-center justify-center relative">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={48} className="text-slate-600" />
                                )}
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                    <label className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-white hover:text-primary transition-colors">
                                        Change
                                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 space-y-4 w-full">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block mb-2">Display Name</label>
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    className="w-full bg-[#0A1121] border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-primary transition-all font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block mb-2">Registered Email (Immutable)</label>
                                <input 
                                    type="email" 
                                    value={email} 
                                    disabled
                                    className="w-full bg-[#0A1121]/50 border border-white/5 rounded-2xl p-4 text-slate-500 cursor-not-allowed font-medium"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Aesthetic Control */}
                <section className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none text-purple-400"><Palette size={120} /></div>
                    
                    <h2 className="text-xl font-black text-white flex items-center gap-3 border-b border-white/10 pb-4 relative z-10">
                        <Palette size={20} className="text-purple-400" /> Interface Customization
                    </h2>

                    <div className="space-y-4 relative z-10">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block">Primary Theme Override</label>
                        <p className="text-xs text-slate-400 mb-4 font-medium">Select a dynamic accent color for your personal dashboard. This overrides the overarching sector branding defined by the Super Admin.</p>
                        
                        <div className="flex items-center gap-6 bg-[#0A1121] border border-white/10 rounded-2xl p-4">
                            <input 
                                type="color" 
                                value={themeColor}
                                onChange={e => setThemeColor(e.target.value)}
                                className="w-16 h-16 rounded-xl cursor-pointer border-none bg-transparent"
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-black uppercase tracking-widest text-white mb-1">Live Hex Value</span>
                                <span className="text-xs font-bold text-slate-500">{themeColor}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Security Vault */}
                <section className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none text-emerald-400"><Lock size={120} /></div>
                    
                    <h2 className="text-xl font-black text-white flex items-center gap-3 border-b border-white/10 pb-4 relative z-10">
                        <Lock size={20} className="text-emerald-400" /> Security Credentials
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block">Current Access Code</label>
                            <input 
                                type="password" 
                                value={password} 
                                disabled
                                className="w-full bg-[#0A1121] border border-white/10 rounded-2xl p-4 text-white focus:outline-none transition-all font-bold opacity-50 cursor-not-allowed"
                            />
                            <p className="text-[9px] text-red-400 uppercase tracking-widest font-bold ml-1 flex items-center gap-1 mt-1"><AlertCircle size={10} /> Read-Only Display</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 block">New Access Code</label>
                            <input 
                                type="password" 
                                value={newPassword} 
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="Leave blank to keep current"
                                className="w-full bg-[#0A1121] border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-emerald-400 transition-all font-bold"
                            />
                        </div>
                    </div>
                </section>

                {/* Commit Actions */}
                <div className="flex justify-end pt-4 pb-12 w-full">
                    <button 
                        type="submit" 
                        disabled={isSaving}
                        className="bg-primary hover:bg-blue-600 text-white px-10 py-5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:scale-105 transition-all flex items-center gap-3 border border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto justify-center"
                    >
                        {isSaving ? 'Compiling Modifications...' : <><CheckCircle2 size={16} /> Deploy Preferences</>}
                    </button>
                </div>
            </form>
        </div>
    );
}
