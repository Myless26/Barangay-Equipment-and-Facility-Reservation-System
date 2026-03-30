import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const icons = {
    success: <CheckCircle2 className="text-secondary" size={20} />,
    error: <AlertCircle className="text-red-400" size={20} />,
    info: <Info className="text-primary" size={20} />,
};

const colors = {
    success: 'border-secondary/20 bg-secondary/5',
    error: 'border-red-500/20 bg-red-500/5',
    info: 'border-primary/20 bg-primary/5',
};

const NotificationToast = ({ message, type = 'info', isVisible, onClose }) => {
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(onClose, 5000);
            return () => clearTimeout(timer);
        }
    }, [isVisible, onClose]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                    className={`fixed bottom-8 right-8 z-[200] flex items-center gap-4 p-4 pr-12 rounded-2xl glass border ${colors[type]} shadow-2xl min-w-[320px] max-w-md`}
                >
                    <div className={`p-2 rounded-xl bg-white/5`}>
                        {icons[type]}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white leading-tight">{message}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">{type}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default NotificationToast;
