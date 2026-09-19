import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ROOT_DIR = process.cwd();
const LOGO_PATH = path.join(ROOT_DIR, 'public', 'streamzy_logo.jpg');
const RES_DIR = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res');

async function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function createCircularMask(size) {
  const radius = size / 2;
  const svg = `<svg width="${size}" height="${size}">
    <circle cx="${radius}" cy="${radius}" r="${radius}" fill="#ffffff"/>
  </svg>`;
  return Buffer.from(svg);
}

async function generateWebAndPWAAssets() {
  console.log('Generating Web & PWA assets from streamzy_logo.jpg...');
  const publicDir = path.join(ROOT_DIR, 'public');

  // 192x192
  await sharp(LOGO_PATH)
    .resize(192, 192, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));

  // 512x512
  await sharp(LOGO_PATH)
    .resize(512, 512, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));

  // Apple touch icon (180x180)
  await sharp(LOGO_PATH)
    .resize(180, 180, { fit: 'cover' })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // Maskable icon with 20% safe padding for round icons
  const maskableInnerSize = Math.round(512 * 0.72);
  const maskableInner = await sharp(LOGO_PATH)
    .resize(maskableInnerSize, maskableInnerSize, { fit: 'cover' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 19, g: 19, b: 23, alpha: 1 } // #131317
    }
  })
    .composite([
      {
        input: maskableInner,
        gravity: 'center'
      }
    ])
    .png()
    .toFile(path.join(publicDir, 'icon-maskable.png'));

  console.log('Web & PWA assets generated successfully.');
}

async function generateAndroidAssets() {
  if (!fs.existsSync(RES_DIR)) {
    console.log('Android res directory not found at:', RES_DIR, '- skipping native assets');
    return;
  }

  console.log('Generating Android native launcher icons and splash screens...');

  // Update ic_launcher_background.xml to match #131317
  const valuesDir = path.join(RES_DIR, 'values');
  await ensureDir(valuesDir);
  const bgXmlPath = path.join(valuesDir, 'ic_launcher_background.xml');
  const bgXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#131317</color>
</resources>
`;
  fs.writeFileSync(bgXmlPath, bgXmlContent, 'utf8');

  // Mipmap configurations: [folderName, launcherSize, foregroundSize]
  const mipmaps = [
    { folder: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { folder: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { folder: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { folder: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { folder: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
  ];

  for (const item of mipmaps) {
    const dir = path.join(RES_DIR, item.folder);
    await ensureDir(dir);

    // 1. Standard ic_launcher.png (square with subtle rounded corner)
    await sharp(LOGO_PATH)
      .resize(item.size, item.size, { fit: 'cover' })
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    // 2. Circular ic_launcher_round.png
    const circleMask = await createCircularMask(item.size);
    const roundLogo = await sharp(LOGO_PATH)
      .resize(item.size, item.size, { fit: 'cover' })
      .png()
      .toBuffer();

    await sharp(roundLogo)
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    // 3. Adaptive foreground: ic_launcher_foreground.png
    // Android Adaptive Icon foreground spec: 108dp canvas, safe zone is 72dp circle in center (~66%-70%)
    const logoInnerSize = Math.round(item.fgSize * 0.70);
    const innerBuffer = await sharp(LOGO_PATH)
      .resize(logoInnerSize, logoInnerSize, { fit: 'cover' })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: item.fgSize,
        height: item.fgSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 } // transparent background for foreground layer
      }
    })
      .composite([
        {
          input: innerBuffer,
          gravity: 'center'
        }
      ])
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));
  }

  // Generate splash screen drawables
  const splashDirs = [
    { folder: 'drawable', w: 480, h: 800 },
    { folder: 'drawable-port-mdpi', w: 320, h: 480 },
    { folder: 'drawable-port-hdpi', w: 480, h: 800 },
    { folder: 'drawable-port-xhdpi', w: 720, h: 1280 },
    { folder: 'drawable-port-xxhdpi', w: 960, h: 1600 },
    { folder: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
    { folder: 'drawable-land-mdpi', w: 480, h: 320 },
    { folder: 'drawable-land-hdpi', w: 800, h: 480 },
    { folder: 'drawable-land-xhdpi', w: 1280, h: 720 },
    { folder: 'drawable-land-xxhdpi', w: 1600, h: 960 },
    { folder: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
  ];

  for (const item of splashDirs) {
    const dir = path.join(RES_DIR, item.folder);
    await ensureDir(dir);

    const logoSize = Math.min(Math.round(Math.min(item.w, item.h) * 0.35), 256);
    const logoBuffer = await sharp(LOGO_PATH)
      .resize(logoSize, logoSize, { fit: 'cover' })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: item.w,
        height: item.h,
        channels: 4,
        background: { r: 19, g: 19, b: 23, alpha: 1 } // #131317
      }
    })
      .composite([
        {
          input: logoBuffer,
          gravity: 'center'
        }
      ])
      .png()
      .toFile(path.join(dir, 'splash.png'));
  }

  console.log('All Android native icons and splash screens successfully generated!');
}

async function main() {
  try {
    if (!fs.existsSync(LOGO_PATH)) {
      console.error('Logo file not found at:', LOGO_PATH);
      process.exit(1);
    }
    await generateWebAndPWAAssets();
    await generateAndroidAssets();
    console.log('Asset generation completed without errors.');
  } catch (err) {
    console.error('Error generating assets:', err);
    process.exit(1);
  }
}

main();
