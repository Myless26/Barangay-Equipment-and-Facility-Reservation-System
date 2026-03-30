import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Calendar, Package, Clock, User, ClipboardList,
    Send, CheckCircle2, ChevronRight, Info, AlertTriangle,
    ShieldCheck, Smartphone, MapPin, DollarSign
} from 'lucide-react';
import { NotificationContext, TenantContext } from '../contexts/AppContext';
import { supabase } from '../supabaseClient';

const BookingModal = ({ isOpen, onClose, type = 'Facility', targetName = "Selected Item" }) => {
    const { notify } = useContext(NotificationContext);
    const { currentTenant } = useContext(TenantContext);
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        date: '',
        duration: '2-4 Hours',
        purpose: '',
        terms: false
    });

    const handleNext = () => {
        if (step === 1 && !formData.date) {
            notify('Please select a preferred date', 'error');
            return;
        }
        setStep(prev => prev + 1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const { error } = await supabase
                .from('reservations')
                .insert([{
                    title: `${type} Booking: ${targetName}`,
                    facility: targetName,
                    reservation_date: formData.date,
                    reservation_time: formData.duration,
                    resident: formData.name,
                    fee: 1200,
                    payment: 'Pending',
                    status: 'Pending',
                    tenant_id: currentTenant?.id
                }]);

            if (error) throw error;

            setIsSubmitting(false);
            setIsSuccess(true);
            notify('Permit request queued for official review', 'success');
            setTimeout(() => {
                onClose();
                setStep(1);
                setIsSuccess(false);
                setFormData({ name: '', date: '', duration: '2-4 Hours', purpose: '', terms: false });
            }, 3000);
        } catch (err) {
            console.error('Booking submission error:', err);
            setIsSubmitting(false);
            notify('Failed to submit booking request', 'error');
        }
    };

    if (!isOpen) return null;

    const steps = [
        { id: 1, label: 'Schedule', icon: <Calendar size={14} /> },
        { id: 2, label: 'Details', icon: <ClipboardList size={14} /> },
        { id: 3, label: 'Review', icon: <ShieldCheck size={14} /> }
    ];

    return (
        <AnimatePresence mode="wait">
            <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl"
                />

                <motion.div
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className="relative w-full max-w-xl bg-[#0B1120] sm:rounded-[2.5rem] rounded-t-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] border-t sm:border border-white/10"
                >
                    {/* Header Section */}
                    <div className="p-8 pb-4">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                                    {type === 'Facility' ? <MapPin className="text-primary" size={24} /> : <Package className="text-primary" size={24} />}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black tracking-tight text-white">{targetName}</h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em]">{type} Permit Application</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl transition-all text-slate-500 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Progress Stepper */}
                        {!isSuccess && (
                            <div className="flex items-center justify-between px-2 mb-4">
                                {steps.map((s, idx) => (
                                    <React.Fragment key={s.id}>
                                        <div className="flex flex-col items-center gap-2">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${step >= s.id ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'border-white/10 text-slate-600'
                                                }`}>
                                                {s.icon}
                                            </div>
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${step >= s.id ? 'text-white' : 'text-slate-600'}`}>{s.label}</span>
                                        </div>
                                        {idx < steps.length - 1 && (
                                            <div className={`flex-1 h-[2px] mb-6 mx-4 rounded-full transition-all duration-700 ${step > idx + 1 ? 'bg-primary' : 'bg-white/5'}`} />
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="px-8 pb-10">
                        {isSuccess ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="py-12 text-center"
                            >
                                <div className="relative inline-block">
                                    <div className="w-24 h-24 bg-secondary/20 rounded-full flex items-center justify-center border-4 border-secondary/30 relative z-10">
                                        <CheckCircle2 size={48} className="text-secondary" />
                                    </div>
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0] }}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                        className="absolute inset-0 bg-secondary/50 rounded-full"
                                    />
                                </div>
                                <h4 className="text-3xl font-black mt-8 text-white">Application Sent</h4>
                                <p className="text-slate-400 mt-4 max-w-sm mx-auto font-medium leading-relaxed">
                                    Your digital permit request for <span className="text-white">{targetName}</span> has been broadcast to the Barangay Secretariat.
                                </p>
                                <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-white/5 py-3 rounded-2xl border border-white/5">
                                    <Smartphone size={14} className="text-primary" /> SMS Notification will be sent upon approval
                                </div>
                            </motion.div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <motion.div
                                    key={step}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {step === 1 && (
                                        <div className="space-y-6">
                                            <div className="p-5 rounded-[2rem] bg-amber-500/5 border border-amber-500/20 flex gap-4">
                                                <Info className="text-amber-500 shrink-0" size={24} />
                                                <p className="text-xs text-amber-200/70 font-bold leading-relaxed">
                                                    Official schedules are updated in real-time. Please select a date at least 3 days in advance for proper processing.
                                                </p>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Preferred Timeline</label>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="relative group">
                                                        <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-primary" size={18} />
                                                        <input
                                                            required
                                                            type="date"
                                                            value={formData.date}
                                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                                            className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 pl-14 pr-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-black text-white outline-none"
                                                        />
                                                    </div>
                                                    <div className="relative">
                                                        <Clock className="absolute left-5 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                                                        <select
                                                            value={formData.duration}
                                                            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                                            className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 pl-14 pr-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-black text-white outline-none appearance-none cursor-pointer"
                                                        >
                                                            <option className="bg-slate-900">2-4 Hours</option>
                                                            <option className="bg-slate-900">Whole Day</option>
                                                            <option className="bg-slate-900">Multi-Day</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {step === 2 && (
                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Applicant Identity</label>
                                                <div className="relative">
                                                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-primary" size={18} />
                                                    <input
                                                        required
                                                        type="text"
                                                        placeholder="Certified Full Name"
                                                        value={formData.name}
                                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                        className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 pl-14 pr-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-black text-white outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Purpose of Request</label>
                                                <div className="relative">
                                                    <ClipboardList className="absolute left-5 top-6 text-secondary" size={18} />
                                                    <textarea
                                                        required
                                                        rows="3"
                                                        placeholder="Describe your event or usage context..."
                                                        value={formData.purpose}
                                                        onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                                                        className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 pl-14 pr-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-black text-white outline-none resize-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {step === 3 && (
                                        <div className="space-y-6">
                                            <div className="p-6 rounded-[2.5rem] bg-white/5 border border-white/5 space-y-4">
                                                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                                    <div className="flex items-center gap-3">
                                                        <DollarSign className="text-secondary" size={18} />
                                                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Processing Fee</span>
                                                    </div>
                                                    <span className="text-lg font-black text-white">P1,200.00</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-xs font-bold">
                                                    <div>
                                                        <p className="text-slate-500 uppercase tracking-tighter mb-1">Schedule</p>
                                                        <p className="text-white">{formData.date || 'To be selected'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-500 uppercase tracking-tighter mb-1">Duration</p>
                                                        <p className="text-white">{formData.duration}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <label className="flex items-start gap-4 p-5 bg-primary/5 rounded-[2rem] border border-primary/20 cursor-pointer group transition-all">
                                                <div className="pt-1">
                                                    <input
                                                        type="checkbox"
                                                        required
                                                        checked={formData.terms}
                                                        onChange={(e) => setFormData({ ...formData, terms: e.target.checked })}
                                                        className="w-5 h-5 rounded-lg bg-slate-900 border-white/20 text-primary focus:ring-offset-slate-900"
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-slate-300 leading-relaxed">
                                                    I certify that all provided info is accurate and I agree to the <span className="text-primary underline">Barangay Usage Policy</span>.
                                                </span>
                                            </label>
                                        </div>
                                    )}
                                </motion.div>

                                <div className="flex gap-4">
                                    {step > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setStep(prev => prev - 1)}
                                            className="px-8 py-5 border border-white/10 rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                                        >
                                            Back
                                        </button>
                                    )}
                                    <button
                                        type={step === 3 ? 'submit' : 'button'}
                                        onClick={step < 3 ? handleNext : undefined}
                                        disabled={isSubmitting}
                                        className="flex-1 py-5 bg-primary text-white rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all group"
                                    >
                                        {isSubmitting ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                {step === 3 ? 'Broadcast Request' : 'Advance'}
                                                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default BookingModal;
