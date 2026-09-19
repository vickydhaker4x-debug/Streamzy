import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface BootSplashScreenProps {
  onComplete?: () => void;
}

export const BootSplashScreen: React.FC<BootSplashScreenProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Dismiss HTML-level splash immediately since React has mounted
    if (typeof window !== 'undefined' && (window as any).dismissStreamzyBootSplash) {
      (window as any).dismissStreamzyBootSplash();
    }

    const t1 = setTimeout(() => {
      setIsVisible(false);
    }, 1200);

    const t2 = setTimeout(() => {
      onComplete?.();
    }, 1600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          id="streamzy-react-boot-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center select-none overflow-hidden"
        >
          {/* Logo container with minimal breathing */}
          <div className="relative flex flex-col items-center justify-center gap-6">
            <motion.div
              animate={{ 
                scale: [1, 1.03, 1],
                opacity: [0.9, 1, 0.9]
              }}
              transition={{
                duration: 2, repeat: Infinity, ease: 'easeInOut'
              }}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-[22px] overflow-hidden shadow-2xl bg-black/20 border border-white/5"
            >
              <img
                src="/streamzy_logo.jpg"
                alt="Streamzy Logo"
                className="w-full h-full object-cover"
              />
            </motion.div>

            {/* Typography */}
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="flex items-center tracking-tight"
            >
              <h1 className="text-2xl font-extrabold tracking-tight text-white/90">
                Stream<span className="bg-gradient-to-r from-[#D946EF] via-[#A855F7] to-[#06B6D4] bg-clip-text text-transparent">zy</span>
              </h1>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
