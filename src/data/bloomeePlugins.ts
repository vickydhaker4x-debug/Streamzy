import { BloomeePlugin } from '../types';

export const BLOOMEE_PLUGINS: BloomeePlugin[] = [
  {
    id: 'plugin-ytm',
    name: 'YouTube Music Streamer',
    version: '2.4.1',
    author: 'HemantKArya',
    description: 'Core streaming engine delivering high-bitrate audio from YouTube Music with smart stream caching.',
    icon: 'music_note',
    type: 'audio_streamer',
    isEnabled: true,
    priority: 1,
    capabilities: ['Streaming', 'Charts', 'Search', 'Recommendations'],
    isOfficial: true,
    sourceUrl: 'https://github.com/HemantKArya/BloomeeTunes'
  },
  {
    id: 'plugin-piped',
    name: 'Piped Audio Engine',
    version: '1.8.0',
    author: 'Bloomee Team',
    description: 'Privacy-first decentralized audio stream resolver with multi-instance automatic fallback.',
    icon: 'bolt',
    type: 'audio_streamer',
    isEnabled: true,
    priority: 2,
    capabilities: ['Decentralized Streams', 'No Ads', 'Short URLs'],
    isOfficial: true
  },
  {
    id: 'plugin-jiosaavn',
    name: 'JioSaavn Regional Music',
    version: '2.1.0',
    author: 'Bloomee Community',
    description: 'High-fidelity 320kbps regional audio streams for Bollywood, Hindi, Punjabi, and Asian hits.',
    icon: 'album',
    type: 'audio_streamer',
    isEnabled: true,
    priority: 3,
    capabilities: ['Regional Charts', '320kbps Audio', 'Lossless Tags'],
    isOfficial: false
  },
  {
    id: 'plugin-invidious',
    name: 'Invidious Mirror Resolver',
    version: '1.5.2',
    author: 'Invidious Project',
    description: 'Secondary fallback network for stream verification and redundant audio delivery.',
    icon: 'cloud_sync',
    type: 'audio_streamer',
    isEnabled: true,
    priority: 4,
    capabilities: ['Mirroring', 'Stream Failover'],
    isOfficial: true
  },
  {
    id: 'plugin-local',
    name: 'Local Filesystem Provider',
    version: '1.0.0',
    author: 'Bloomee Core',
    description: 'Indexes and streams offline music files stored on your local device without internet connection.',
    icon: 'folder',
    type: 'local',
    isEnabled: true,
    priority: 5,
    capabilities: ['Offline Playback', 'MP3/FLAC/M4A/WAV', 'ID3 Tags'],
    isOfficial: true
  },
  {
    id: 'plugin-spotify-meta',
    name: 'Spotify Metadata Importer',
    version: '1.2.0',
    author: 'Bloomee Extensions',
    description: 'Imports public Spotify playlists, albums, and artists, automatically pairing them with high-fidelity streams.',
    icon: 'sync_alt',
    type: 'metadata',
    isEnabled: true,
    priority: 6,
    capabilities: ['Playlist Import', 'Smart Cross-Resolve'],
    isOfficial: false
  }
];

export const BLOOMEE_CHARTS = [
  {
    id: 'chart-global-50',
    title: 'Streamzy Global Top 50',
    subtitle: 'Updated Daily • Global Trends',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    description: 'The hottest tracks trending across all Streamzy streaming nodes worldwide.',
    badge: 'TOP 1',
    gradient: 'from-pink-600 to-rose-900',
    trackIds: ['track-sauda-iss-dil-ka', 'track-lofi-lovee', 'track-preet-re', 'track-kinna-sohna', 'track-night-changes']
  },
  {
    id: 'chart-viral-hits',
    title: 'Viral 50 Worldwide',
    subtitle: 'Breakout Hits & Anthems',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    description: 'Social and streaming charts buzzing right now with maximum velocity.',
    badge: 'VIRAL',
    gradient: 'from-cyan-500 to-blue-900',
    trackIds: ['track-starboy', 'track-blinding-lights', 'track-espresso', 'track-heat-waves', 'track-shape-of-you']
  },
  {
    id: 'chart-india-bollywood',
    title: 'Trending Bollywood & Punjabi',
    subtitle: 'Indian Music Charts',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    description: 'Desi melodies, cinematic romance, and Punjabi energy topping the playlists.',
    badge: 'INDIA TOP',
    gradient: 'from-orange-500 to-amber-900',
    trackIds: ['track-preet-re', 'track-sauda-iss-dil-ka', 'track-kinna-sohna', 'track-lofi-lovee']
  },
  {
    id: 'chart-chill-lofi',
    title: 'Midnight Lo-Fi & Study Beats',
    subtitle: 'Relaxation & Focus',
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
    description: 'Mellow beats, soothing vinyl crackles, and gentle ambient piano keys.',
    badge: 'CHILL',
    gradient: 'from-purple-600 to-indigo-950',
    trackIds: ['track-lofi-lovee', 'track-golden-hour', 'track-birds-of-a-feather']
  }
];

export const EQUALIZER_PRESETS: { [key: string]: number[] } = {
  'Normal': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Rock': [4, 3, 2, 0, -1, -1, 1, 2, 3, 4],
  'Pop': [-1, 1, 3, 4, 3, 1, -1, -1, 1, 2],
  'Bass Boost': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  'Vocal Booster': [-2, -2, 0, 2, 4, 4, 3, 1, 0, -1],
  'Acoustic': [3, 2, 1, 1, 2, 2, 3, 3, 2, 1],
  'Electronic': [4, 4, 2, 0, -2, 1, 2, 3, 4, 4],
  'Hip Hop': [5, 4, 2, 1, -1, -1, 1, -1, 2, 3],
  'Jazz': [2, 2, 0, 1, 2, 2, 0, 1, 2, 3],
  'Classical': [3, 3, 2, 1, -1, -1, 0, 2, 3, 3]
};
