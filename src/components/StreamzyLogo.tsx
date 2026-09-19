import React from 'react';

interface StreamzyLogoProps {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}

export const StreamzyLogo: React.FC<StreamzyLogoProps> = ({
  size = 36,
  className = '',
  showWordmark = false
}) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Streamzy Emblem Icon */}
      <div 
        className="relative shrink-0 rounded-xl overflow-hidden flex items-center justify-center shadow-[0_0_20px_rgba(254,56,94,0.35)]"
        style={{ width: size, height: size }}
      >
        <img
          src="/streamzy_logo.jpg"
          alt="Streamzy"
          className="w-full h-full object-cover rounded-xl"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Optional Streamzy Wordmark */}
      {showWordmark && (
        <div className="flex items-center tracking-tight">
          <span className="font-extrabold text-[20px] text-white">Stream</span>
          <span className="font-extrabold text-[20px] bg-gradient-to-r from-[#D946EF] via-[#A855F7] to-[#06B6D4] bg-clip-text text-transparent">
            zy
          </span>
        </div>
      )}
    </div>
  );
};
