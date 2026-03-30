import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Lock, Database, Zap, HardDrive, ArrowLeft, Network, EyeOff } from 'lucide-react';

const IsolationDocs = ({ onBack }) => {
    return (
        <div className="min-h-full w-full bg-[#060D1A] text-slate-200 p-8 lg:p-16 relative overflow-hidden flex flex-col items-center">
            {/* Ambient Backgrounds */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-4xl w-full relative z-10">
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors mb-12 group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
                </button>

                <div className="flex items-center gap-6 mb-12">
                    <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                        <HardDrive size={40} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black text-white tracking-tighter leading-tight">
                            Database <span className="text-primary">Isolation</span>
                        </h1>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2 italic">Zero-Trust Multitenancy Protocols</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                    <div className="glass p-8 rounded-[2.5rem] border-white/5 relative overflow-hidden group">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-primary mb-6">
                            <Lock size={24} />
                        </div>
                        <h3 className="text-xl font-black text-white mb-4">Row-Level Security</h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                            Every single database query is automatically restricted at the engine level. A "Tenant ID" is injected into every request, ensuring that one Barangay's data is mathematically invisible to any other.
                        </p>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                                animate={{ x: ['-100%', '100%'] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                className="h-full w-1/3 bg-primary"
                            />
                        </div>
                    </div>

                    <div className="glass p-8 rounded-[2.5rem] border-white/5">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-emerald-400 mb-6">
                            <EyeOff size={24} />
                        </div>
                        <h3 className="text-xl font-black text-white mb-4">Cryptographic Tunnels</h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                            Data in transit is wrapped in AES-256 encryption. Our infrastructure treats each Barangay's domain as a dedicated secure tunnel, preventing cross-talk or leakage.
                        </p>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="h-1 w-full bg-emerald-500/20 rounded-full" />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-10 md:p-14 mb-16 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <ShieldCheck size={120} />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-8 tracking-tight">The Multi-Tenant Architecture</h2>
                    
                    <div className="space-y-8">
                        <StepItem 
                            number="01" 
                            title="Infrastructure Level" 
                            desc="We use a unified high-performance PostgreSQL cluster, optimized for tenant throughput."
                        />
                        <StepItem 
                            number="02" 
                            title="Middleware Filters" 
                            desc="The application automatically identifies the Barangay via URL domain and locks all session contexts."
                        />
                        <StepItem 
                            number="03" 
                            title="Database Enforcement" 
                            desc="Supabase RLS policies act as the final, unbreakable barrier, rejecting any data access without a valid tenant match."
                        />
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-8">Infrastructure powered by Zero-Trust protocols</p>
                    <button 
                        onClick={onBack}
                        className="px-10 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:scale-105 transition-all"
                    >
                        Return to Central Command
                    </button>
                </div>
            </div>
        </div>
    );
};

const StepItem = ({ number, title, desc }) => (
    <div className="flex gap-6 items-start group">
        <div className="text-primary font-black text-xl italic opacity-50 group-hover:opacity-100 transition-opacity">{number}</div>
        <div>
            <h4 className="font-black text-white text-lg mb-1">{title}</h4>
            <p className="text-slate-400 text-sm leading-relaxed font-medium">{desc}</p>
        </div>
    </div>
);

export default IsolationDocs;
