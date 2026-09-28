import { useState, FC, useEffect, useRef } from 'react';
import { thumbnailService } from '../services/thumbnailService';

// In-memory cache for fast instant rendering without network flicker
const verifiedImageCache = new Set<string>();

interface TrackImageProps {
  src?: string;
  alt?: string;
  className?: string;
  videoId?: string;
  loading?: 'lazy' | 'eager';
  showCornerGlow?: boolean;
}

export const TrackImage: FC<TrackImageProps> = ({
  src,
  alt = 'Music Artwork',
  className = 'w-full h-full object-cover',
  videoId,
  loading = 'eager',
  showCornerGlow = false
}) => {
  const [hasError, setHasError] = useState(false);
  const [retryStage, setRetryStage] = useState(0);

  // Compute best image source based on fallback stages
  const getImageSource = () => {
    // 1. Check if we have a fast cached iTunes or verified cover
    if (videoId) {
      const cached = thumbnailService.getCachedCover({ videoId });
      if (cached) return cached;
    }

    let target = src;
    if (retryStage === 1 && videoId) {
      target = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    } else if (retryStage === 2 && videoId) {
      target = `https://images.weserv.nl/?url=i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    } else if (retryStage >= 3) {
      return '/streamzy_logo.jpg';
    }

    if (target) {
      // YouTube hqdefault.jpg has black letterbox strips on top and bottom.
      // mqdefault.jpg is 16:9 with NO black bars and loads in ~25ms.
      return target.replace('/hqdefault.jpg', '/mqdefault.jpg');
    }
    if (videoId) {
      return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    }
    return '/streamzy_logo.jpg';
  };

  const imageSrc = getImageSource();
  const isPrecached = imageSrc ? verifiedImageCache.has(imageSrc) : false;
  const [isLoaded, setIsLoaded] = useState<boolean>(isPrecached);

  useEffect(() => {
    // Reset error state and loading state if image source changes
    setHasError(false);
    setRetryStage(0);
    const precached = imageSrc ? verifiedImageCache.has(imageSrc) : false;
    setIsLoaded(precached);
    if (imageSrc && !precached) {
      thumbnailService.preloadImageUrl(imageSrc);
    }
  }, [src, videoId, imageSrc]);

  const handleError = () => {
    if (retryStage < 2 && videoId) {
      setRetryStage((prev) => prev + 1);
    } else {
      setHasError(true);
      setIsLoaded(true);
    }
  };

  const handleLoad = () => {
    if (imageSrc) {
      verifiedImageCache.add(imageSrc);
    }
    setIsLoaded(true);
  };

  if (hasError) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-[#1f1f25] to-[#121216] border border-white/[0.06] ${className}`}>
        <img 
          src="/streamzy_logo.jpg" 
          alt="Streamzy" 
          className="w-2/3 h-2/3 object-contain opacity-70"
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-[#141419]">
      {/* Sleek Shimmer Skeleton while loading non-cached images */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03] animate-pulse pointer-events-none flex items-center justify-center">
          <span className="material-symbols-outlined text-[18px] text-white/20 animate-spin">
            progress_activity
          </span>
        </div>
      )}

      <img
        src={imageSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        decoding="async"
        loading={loading}
        {...({ fetchPriority: loading === 'eager' ? 'high' : 'auto' })}
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full object-cover transform scale-105 transition-opacity duration-200 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
      />
      {/* Corner Glow Effect directly on the thumbnail corners */}
      {showCornerGlow && (
        <>
          <div className="absolute -top-2 -left-2 w-10 h-10 bg-[var(--color-primary)]/40 rounded-full blur-lg pointer-events-none" />
          <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-[var(--color-primary)]/50 rounded-full blur-lg pointer-events-none" />
        </>
      )}
    </div>
  );
};
