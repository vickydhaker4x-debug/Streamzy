import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface BootSplashScreenProps {
  onComplete?: () => void;
}

export const BootSplashScreen: React.FC<BootSplashScreenProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Quick, responsive startup display (600ms total)
    const t1 = setTimeout(() => {
      setIsVisible(false);
    }, 600);

    const t2 = setTimeout(() => {
      onComplete?.();
    }, 900);

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
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[99999] bg-[#131317] flex flex-col items-center justify-center select-none overflow-hidden"
        >
          {/* Logo container with minimal breathing */}
          <div className="relative flex flex-col items-center justify-center gap-6">
            <motion.div
              animate={{ 
                scale: [1, 1.03, 1],
                opacity: [0.92, 1, 0.92]
              }}
              transition={{
                duration: 2, repeat: Infinity, ease: 'easeInOut'
              }}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-[24px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
            >
              <img
                src="/streamzy_logo.jpg"
                alt="Streamzy Logo"
                className="w-full h-full object-cover"
              />
            </motion.div>

            {/* Typography */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.4 }}
              className="flex items-center tracking-tight"
            >
              <h1 className="text-2xl font-extrabold tracking-tight text-white/95">
                Stream<span className="bg-gradient-to-r from-[#f87171] via-[#ec4899] to-[#06b6d4] bg-clip-text text-transparent">zy</span>
              </h1>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
