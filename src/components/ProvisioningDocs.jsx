import React from 'react';
import { motion } from 'framer-motion';
import { Zap, CalendarHeart, Globe, Box, Settings, ArrowLeft, RefreshCw, Cpu, Database } from 'lucide-react';

const ProvisioningDocs = ({ onBack }) => {
    return (
        <div className="min-h-full w-full bg-[#060D1A] text-slate-200 p-8 lg:p-16 relative overflow-hidden flex flex-col items-center">
            {/* Ambient Backgrounds */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-4xl w-full relative z-10">
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors mb-12 group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
                </button>

                <div className="flex items-center gap-6 mb-12">
                    <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                        <Zap size={40} className="text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black text-white tracking-tighter leading-tight">
                            Immediate <span className="text-emerald-400">Provisioning</span>
                        </h1>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2 italic">Millisecond Infrastructure Generation</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                    <div className="glass p-8 rounded-[2.5rem] border-white/5 relative overflow-hidden group">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-emerald-400 mb-6">
                            <RefreshCw size={24} className="animate-spin-slow" />
                        </div>
                        <h3 className="text-xl font-black text-white mb-4">Zero-Config Launch</h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                            Our architecture uses pre-warmed database schemas. When you register, a dedicated record is initialized instantly, bypassing traditional infrastructure cold starts.
                        </p>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5, 6, 7].map(i => (
                                <div key={i} className="h-1 w-full bg-emerald-500/30 rounded-full" />
                            ))}
                        </div>
                    </div>

                    <div className="glass p-8 rounded-[2.5rem] border-white/5">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-primary mb-6">
                            <Globe size={24} />
                        </div>
                        <h3 className="text-xl font-black text-white mb-4">Dynamic URL Routing</h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                            New domains are mapped in real-time. The moment you click 'Provision', your dedicated subdomain (e.g. `casisang.brgyhub.pro`) is live and ready for traffic globally.
                        </p>
                        <div className="text-[10px] font-black font-mono text-primary/50 text-center uppercase tracking-widest">
                            {'{ active_route: "mapping..." }'}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-10 md:p-14 mb-16 relative overflow-hidden">
                    <h2 className="text-3xl font-black text-white mb-8 tracking-tight">The 300ms Timeline</h2>
                    
                    <div className="relative border-l-2 border-white/5 pl-8 space-y-12 ml-4">
                        <TimelineStep 
                            title="Identity Verification" 
                            desc="Registration data is valided and sanitized against global security standards."
                            icon={<Cpu size={16} />}
                        />
                        <TimelineStep 
                            title="Database Indexing" 
                            desc="The core cluster receives the new Barangay identity and creates a unique cryptographic pointer."
                            icon={<Database size={16} />}
                        />
                        <TimelineStep 
                            title="Environment Initialization" 
                            desc="Personalized UI themes, inventory templates, and security rules are baked into the new instance."
                            icon={<Box size={16} />}
                        />
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-8">Next-generation infrastructure for next-generation villages.</p>
                    <button 
                        onClick={onBack}
                        className="px-10 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105 transition-all"
                    >
                        Return to Hub
                    </button>
                </div>
            </div>
        </div>
    );
};

const TimelineStep = ({ title, desc, icon }) => (
    <div className="relative">
        <div className="absolute -left-[41px] top-0 w-5 h-5 rounded-full bg-emerald-500 border-4 border-[#060D1A] shadow-[0_0_10px_rgba(16,185,129,0.5)] flex items-center justify-center" />
        <div className="flex items-center gap-3 mb-2">
            <div className="text-emerald-400 opacity-50">{icon}</div>
            <h4 className="font-black text-white text-lg leading-none">{title}</h4>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed font-medium">{desc}</p>
    </div>
);

export default ProvisioningDocs;
