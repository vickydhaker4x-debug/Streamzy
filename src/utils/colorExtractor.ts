/**
 * Color Extractor Utility for Streamzy Player
 * Extracts dominant ambient colors from album artwork to create OpenTune-style
 * dynamic ambient backgrounds that adapt to every song.
 */

export interface AmbientPalette {
  topColor: string;       // Upper ambient glow (e.g., olive, teal, cool slate)
  bottomColor: string;    // Lower ambient tone (e.g., terracotta, amber, warm rust)
  accentColor: string;    // Highlight color for controls
  glowColor: string;      // Soft luminous aura
  gradientCss: string;    // Complete multi-stop radial & linear background CSS
}

// Fallback dynamic harmonic palettes based on string hashes
const HARMONIC_PRESETS: AmbientPalette[] = [
  // Terracotta / Olive Slate (matching the user's OpenTune screenshot)
  {
    topColor: 'rgba(54, 68, 58, 0.95)',
    bottomColor: 'rgba(158, 79, 58, 0.95)',
    accentColor: '#fb923c',
    glowColor: 'rgba(158, 79, 58, 0.45)',
    gradientCss: 'radial-gradient(ellipse at 20% 0%, rgba(54, 68, 58, 0.9) 0%, transparent 60%), radial-gradient(ellipse at 80% 10%, rgba(42, 59, 68, 0.85) 0%, transparent 55%), linear-gradient(180deg, rgba(30, 38, 33, 0.8) 0%, rgba(130, 62, 44, 0.95) 70%, rgba(100, 44, 30, 1) 100%)'
  },
  // Sunset Coral & Deep Midnight Purple
  {
    topColor: 'rgba(38, 48, 74, 0.95)',
    bottomColor: 'rgba(168, 62, 78, 0.95)',
    accentColor: '#f87171',
    glowColor: 'rgba(248, 113, 113, 0.45)',
    gradientCss: 'radial-gradient(ellipse at 25% 5%, rgba(46, 58, 90, 0.9) 0%, transparent 60%), radial-gradient(ellipse at 75% 15%, rgba(68, 42, 74, 0.85) 0%, transparent 55%), linear-gradient(180deg, rgba(28, 34, 52, 0.8) 0%, rgba(142, 50, 66, 0.95) 70%, rgba(108, 36, 48, 1) 100%)'
  },
  // Emerald Forest & Warm Amber Gold
  {
    topColor: 'rgba(32, 60, 50, 0.95)',
    bottomColor: 'rgba(146, 94, 36, 0.95)',
    accentColor: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.45)',
    gradientCss: 'radial-gradient(ellipse at 15% 5%, rgba(32, 60, 50, 0.9) 0%, transparent 60%), radial-gradient(ellipse at 85% 15%, rgba(40, 55, 68, 0.85) 0%, transparent 55%), linear-gradient(180deg, rgba(24, 44, 36, 0.8) 0%, rgba(126, 80, 30, 0.95) 70%, rgba(92, 58, 20, 1) 100%)'
  },
  // Deep Ocean Indigo & Cyan Glow
  {
    topColor: 'rgba(28, 44, 68, 0.95)',
    bottomColor: 'rgba(38, 92, 118, 0.95)',
    accentColor: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.45)',
    gradientCss: 'radial-gradient(ellipse at 20% 5%, rgba(36, 56, 88, 0.9) 0%, transparent 60%), radial-gradient(ellipse at 80% 15%, rgba(24, 52, 70, 0.85) 0%, transparent 55%), linear-gradient(180deg, rgba(20, 32, 48, 0.8) 0%, rgba(32, 78, 102, 0.95) 70%, rgba(22, 56, 74, 1) 100%)'
  },
  // Velvet Ruby & Smokey Charcoal
  {
    topColor: 'rgba(52, 38, 48, 0.95)',
    bottomColor: 'rgba(140, 40, 55, 0.95)',
    accentColor: '#fb7185',
    glowColor: 'rgba(251, 113, 133, 0.45)',
    gradientCss: 'radial-gradient(ellipse at 15% 5%, rgba(56, 40, 52, 0.9) 0%, transparent 60%), radial-gradient(ellipse at 85% 15%, rgba(68, 38, 50, 0.85) 0%, transparent 55%), linear-gradient(180deg, rgba(36, 26, 34, 0.8) 0%, rgba(120, 32, 46, 0.95) 70%, rgba(88, 22, 32, 1) 100%)'
  },
  // Warm Mocha Brown & Rust Orange
  {
    topColor: 'rgba(58, 46, 40, 0.95)',
    bottomColor: 'rgba(148, 72, 42, 0.95)',
    accentColor: '#f97316',
    glowColor: 'rgba(249, 115, 22, 0.45)',
    gradientCss: 'radial-gradient(ellipse at 20% 5%, rgba(62, 50, 42, 0.9) 0%, transparent 60%), radial-gradient(ellipse at 80% 15%, rgba(50, 44, 48, 0.85) 0%, transparent 55%), linear-gradient(180deg, rgba(40, 32, 28, 0.8) 0%, rgba(128, 60, 34, 0.95) 70%, rgba(94, 42, 22, 1) 100%)'
  }
];

const paletteCache = new Map<string, AmbientPalette>();

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function getFallbackPalette(key: string): AmbientPalette {
  const seed = stringToSeed(key);
  return HARMONIC_PRESETS[seed % HARMONIC_PRESETS.length];
}

/**
 * Extracts ambient colors from an image URL using canvas pixel sampling.
 * Falls back safely to seed-based harmonic presets if image fails or is blocked by CORS.
 */
export async function extractAmbientPalette(imageUrl?: string, fallbackKey: string = 'streamzy'): Promise<AmbientPalette> {
  const cacheKey = imageUrl || fallbackKey;
  if (paletteCache.has(cacheKey)) {
    return paletteCache.get(cacheKey)!;
  }

  const defaultPalette = getFallbackPalette(fallbackKey);

  if (!imageUrl || typeof window === 'undefined') {
    paletteCache.set(cacheKey, defaultPalette);
    return defaultPalette;
  }

  return new Promise<AmbientPalette>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => {
      paletteCache.set(cacheKey, defaultPalette);
      resolve(defaultPalette);
    }, 1500);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(defaultPalette);
          return;
        }

        const size = 32;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const imgData = ctx.getImageData(0, 0, size, size).data;

        // Sample top half and bottom half pixels separately
        let topR = 0, topG = 0, topB = 0, topCount = 0;
        let botR = 0, botG = 0, botB = 0, botCount = 0;

        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const a = imgData[i + 3];

            if (a < 128) continue; // skip transparent

            // Avoid pure black or pure white dominating the ambient wash
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            if (brightness < 15 || brightness > 245) continue;

            if (y < size / 2) {
              topR += r; topG += g; topB += b; topCount++;
            } else {
              botR += r; botG += g; botB += b; botCount++;
            }
          }
        }

        if (topCount === 0 || botCount === 0) {
          resolve(defaultPalette);
          return;
        }

        topR = Math.round(topR / topCount);
        topG = Math.round(topG / topCount);
        topB = Math.round(topB / topCount);

        botR = Math.round(botR / botCount);
        botG = Math.round(botG / botCount);
        botB = Math.round(botB / botCount);

        // Adjust saturation and darkness for audiophile atmospheric contrast
        const [topH, topS, topL] = rgbToHsl(topR, topG, topB);
        const [botH, botS, botL] = rgbToHsl(botR, botG, botB);

        // Keep ambient dark and rich (lightness 22% - 35%)
        const adjTopL = Math.max(16, Math.min(28, topL * 0.7));
        const adjBotL = Math.max(22, Math.min(36, botL * 0.85));

        const [finalTopR, finalTopG, finalTopB] = hslToRgb(topH, Math.max(25, topS), adjTopL);
        const [finalBotR, finalBotG, finalBotB] = hslToRgb(botH, Math.max(40, botS), adjBotL);

        const topRgba = `rgba(${finalTopR}, ${finalTopG}, ${finalTopB}, 0.95)`;
        const botRgba = `rgba(${finalBotR}, ${finalBotG}, ${finalBotB}, 0.95)`;
        const glowRgba = `rgba(${finalBotR}, ${finalBotG}, ${finalBotB}, 0.5)`;

        // Calculate a complementary top-right secondary tone
        const [secR, secG, secB] = hslToRgb((topH + 35) % 360, Math.max(25, topS), adjTopL * 0.9);
        const secRgba = `rgba(${secR}, ${secG}, ${secB}, 0.85)`;

        // Build OpenTune-style atmospheric gradient
        const gradientCss = `radial-gradient(ellipse at 18% 0%, ${topRgba} 0%, transparent 60%), radial-gradient(ellipse at 82% 8%, ${secRgba} 0%, transparent 55%), linear-gradient(180deg, rgba(${Math.round(finalTopR * 0.6)}, ${Math.round(finalTopG * 0.6)}, ${Math.round(finalTopB * 0.6)}, 0.85) 0%, ${botRgba} 68%, rgba(${Math.round(finalBotR * 0.75)}, ${Math.round(finalBotG * 0.75)}, ${Math.round(finalBotB * 0.75)}, 1) 100%)`;

        const palette: AmbientPalette = {
          topColor: topRgba,
          bottomColor: botRgba,
          accentColor: `rgb(${Math.min(255, finalBotR + 40)}, ${Math.min(255, finalBotG + 40)}, ${Math.min(255, finalBotB + 40)})`,
          glowColor: glowRgba,
          gradientCss
        };

        paletteCache.set(cacheKey, palette);
        resolve(palette);
      } catch {
        resolve(defaultPalette);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      paletteCache.set(cacheKey, defaultPalette);
      resolve(defaultPalette);
    };

    img.src = imageUrl;
  });
}
