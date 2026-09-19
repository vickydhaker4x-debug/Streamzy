# 🎵 VD Music - v1.2.0 Release

<p align="center">
  <img src="public/screenshots/banner.jpg" alt="VD Music Banner" width="100%" style="border-radius: 14px;" />
</p>

### Modern Audiophile Music Player — Ad-Free, Lightweight & Pure OLED Dark

**VD Music v1.2.0** is here! This release brings the official native Android branding overhaul, fixed GitHub Actions automated APK builds with customized adaptive launcher icons, and a brand-new animated acoustic boot sequence.

---

## 📸 App Preview & UI Showcase

<p align="center">
  <img src="public/screenshots/ui-preview.jpg" alt="VD Music UI Showcase" width="85%" style="border-radius: 12px; box-shadow: 0 16px 40px rgba(0,0,0,0.6);" />
</p>

---

## 🌟 What's New in v1.2.0

### 1. 🚀 Native Android Icon & Branding Fix
- **Fixed Default Icon Issue**: Resolved the issue where automated GitHub Actions APK builds defaulted to the generic Capacitor icon.
- **Adaptive Icon Generation**: Implemented automated asset generation creating high-resolution adaptive launcher icons (`ic_launcher_foreground.png`), circular icons (`ic_launcher_round.png`), and dark splash screens across all Android pixel densities (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`).
- **Dark Mode Splash Matching**: Splash screens and launcher background configured to match the app's signature `#131317` OLED canvas.

### 2. ⚡ Cinematic Animated Boot Screen
- **Acoustic Pulse Waves**: Dual concentric audio radar rings expand and fade around the logo on cold launch.
- **Breathing Logo Motion**: The VD Music insignia floats with a gentle breathing scale motion and warm coral drop-shadow glow.
- **Live Soundwave Equalizer**: 7 dynamic audio frequency equalizer bars rhythmically oscillate beneath the logo as the audio stream engine initializes.
- **Fluid Transition**: Smooth blur and scale-out transition from the boot screen into the Home dashboard.

### 3. 📑 Local Playback History & Clean Slate
- Playback history is now strictly local to your device using `localStorage`. No more hardcoded tracks showing up on freshly installed devices.
- Single-tap track removal and full "Clear History" options added.

### 4. 🎶 Custom Playlist Manager
- Fully functional in-app playlist creation modal.
- Integrated **"+ Add Songs"** dialog with real-time search filtering.
- Fast local storage persistence.

---

## ✨ Core Features

- 🎧 **High-Fidelity Audio Streaming**: Stream millions of tracks ad-free with low-latency playback.
- 📱 **Background & Screen-Off Playback**: Audio continues playing with your screen off, complete with lock screen controls and Media Session notification integration.
- 🖤 **True OLED Dark Aesthetics**: Engineered for AMOLED displays with zero glare, minimal power consumption, and customizable accent themes.
- ⏱️ **Integrated Sleep Timer**: Fall asleep to your favorite music with automated countdown pause.
- 🔒 **Zero Tracking & Privacy First**: No accounts required, no telemetry, no third-party data tracking.

---

## 📥 How to Install on Android

1. Download **`VD-Music-Debug-APK`** or **`app-debug.apk`** from the **Assets** section below.
2. Open the downloaded `.apk` file on your Android device.
3. If prompted, allow **"Install unknown apps"** for your browser or file manager.
4. Tap **Install** and launch **VD Music**!

---

## 📦 Assets

- `app-debug.apk` — Complete standalone Android APK build
- Source code (zip & tar.gz)
