import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// Symmetrical Modern Streamzy Audio Waveform Icon SVG (512x512)
const LOGO_SVG = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Dark Squircle Background -->
  <rect x="24" y="24" width="464" height="464" rx="112" fill="#141318"/>
  <rect x="24" y="24" width="464" height="464" rx="112" stroke="#25242F" stroke-width="8"/>
  
  <!-- Symmetrical Modern Waveform Bars -->
  <!-- 1. Left Outer Bar -->
  <rect x="116" y="216" width="36" height="80" rx="18" fill="#FE385E"/>
  
  <!-- 2. Left Inner Bar -->
  <rect x="178" y="156" width="36" height="200" rx="18" fill="#FE385E"/>
  
  <!-- 3. Center White Master Bar -->
  <rect x="238" y="106" width="36" height="300" rx="18" fill="#FFFFFF"/>
  
  <!-- 4. Right Inner Bar -->
  <rect x="298" y="156" width="36" height="200" rx="18" fill="#FE385E"/>
  
  <!-- 5. Right Outer Bar -->
  <rect x="360" y="216" width="36" height="80" rx="18" fill="#FE385E"/>
</svg>
`;

async function buildLogos() {
  console.log('Generating crisp modern Streamzy logo assets...');
  
  // Save SVG
  fs.writeFileSync(path.join(PUBLIC_DIR, 'streamzy_logo.svg'), LOGO_SVG, 'utf8');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), LOGO_SVG, 'utf8');

  const svgBuffer = Buffer.from(LOGO_SVG);

  // 1024x1024 Master PNG
  await sharp(svgBuffer, { density: 300 })
    .resize(1024, 1024)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'streamzy_logo.png'));

  // 1024x1024 Master JPG
  await sharp(svgBuffer, { density: 300 })
    .resize(1024, 1024)
    .jpeg({ quality: 98 })
    .toFile(path.join(PUBLIC_DIR, 'streamzy_logo.jpg'));

  // Also update vd_music_logo.jpg for backwards compatibility
  await sharp(svgBuffer, { density: 300 })
    .resize(1024, 1024)
    .jpeg({ quality: 98 })
    .toFile(path.join(PUBLIC_DIR, 'vd_music_logo.jpg'));

  // 512x512 PWA Icon
  await sharp(svgBuffer, { density: 300 })
    .resize(512, 512)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'icon-512.png'));

  // 192x192 PWA Icon
  await sharp(svgBuffer, { density: 300 })
    .resize(192, 192)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'icon-192.png'));

  // Apple Touch Icon (180x180)
  await sharp(svgBuffer, { density: 300 })
    .resize(180, 180)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));

  // Maskable Icon (512x512 with safe area)
  const innerMaskable = await sharp(svgBuffer, { density: 300 })
    .resize(380, 380)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 20, g: 19, b: 24, alpha: 1 }
    }
  })
    .composite([{ input: innerMaskable, gravity: 'center' }])
    .png()
    .toFile(path.join(PUBLIC_DIR, 'icon-maskable.png'));

  console.log('Web & PWA logo assets generated successfully!');
}

buildLogos().catch(console.error);
