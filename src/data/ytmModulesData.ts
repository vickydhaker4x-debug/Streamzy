import { MusicMix, MusicVideoItem, Track } from '../types';
import { TRACKS } from './musicData';

export const YTM_PERSONALIZED_MIXES: MusicMix[] = [
  {
    id: 'mix-supermix',
    title: 'My Supermix',
    subtitle: 'Arijit Singh, Sidhu Moosewala, AP Dhillon and more',
    description: 'An endless personalized blend combining all your favorite genres and daily repeats.',
    badge: 'SUPERMIX',
    gradient: 'from-[#ff0033]/80 via-[#990000]/60 to-[#121212]',
    coverGrid: [
      'https://i.ytimg.com/vi/BddP6PYo2gs/mqdefault.jpg',
      'https://i.ytimg.com/vi/n_FCrCQ6-9U/mqdefault.jpg',
      'https://i.ytimg.com/vi/VNs_cCtdbPc/mqdefault.jpg',
      'https://i.ytimg.com/vi/34Na4j8AVgA/mqdefault.jpg'
    ],
    trackIds: ['track-kesariya', 'track-295', 'track-brown-munde', 'track-starboy', 'track-chaleya', 'track-cheques']
  },
  {
    id: 'mix-chill',
    title: 'Chill Mix',
    subtitle: 'Darshan Raval, Asees Kaur, Pritam & more',
    description: 'Mellow melodies, acoustic chords, and relaxed evening warmth.',
    badge: 'CHILL',
    gradient: 'from-[#1e3c72]/80 via-[#2a5298]/60 to-[#121212]',
    coverGrid: [
      'https://i.ytimg.com/vi/vIQAt0eIu2k/mqdefault.jpg',
      'https://i.ytimg.com/vi/l8Z3azp_qK8/mqdefault.jpg',
      'https://i.ytimg.com/vi/J_CD7rFH-O0/mqdefault.jpg',
      'https://i.ytimg.com/vi/sK7riqg2mr4/mqdefault.jpg'
    ],
    trackIds: ['track-lofi-lovee', 'track-preet-re', 'track-kinna-sohna', 'track-agar-tum', 'track-shayad']
  },
  {
    id: 'mix-energy',
    title: 'Energy Mix',
    subtitle: 'Sidhu Moosewala, The Weeknd, Alan Walker',
    description: 'High-octane Punjabi drill, driving electronic kicks and upbeat tracks to fuel your grind.',
    badge: 'ENERGY',
    gradient: 'from-[#f12711]/80 via-[#f5af19]/60 to-[#121212]',
    coverGrid: [
      'https://i.ytimg.com/vi/n_FCrCQ6-9U/mqdefault.jpg',
      'https://i.ytimg.com/vi/60ItHLz5WEA/mqdefault.jpg',
      'https://i.ytimg.com/vi/4NRXx6U8ABQ/mqdefault.jpg',
      'https://i.ytimg.com/vi/34Na4j8AVgA/mqdefault.jpg'
    ],
    trackIds: ['track-295', 'track-starboy', 'track-faded', 'track-blinding-lights', 'track-elevated']
  },
  {
    id: 'mix-focus',
    title: 'Focus Mix',
    subtitle: 'Lo-Fi beats, soft acoustics & study flow',
    description: 'Minimal vocals and rhythmic downtempo sounds to lock in your concentration.',
    badge: 'FOCUS',
    gradient: 'from-[#11998e]/80 via-[#38ef7d]/50 to-[#121212]',
    coverGrid: [
      'https://i.ytimg.com/vi/vIQAt0eIu2k/mqdefault.jpg',
      'https://i.ytimg.com/vi/Hc-rc1-hcco/mqdefault.jpg',
      'https://i.ytimg.com/vi/gvyUuxdRdR4/mqdefault.jpg',
      'https://i.ytimg.com/vi/sK7riqg2mr4/mqdefault.jpg'
    ],
    trackIds: ['track-lofi-lovee', 'track-sauda-iss-dil-ka', 'track-raataan', 'track-agar-tum']
  },
  {
    id: 'mix-discover',
    title: 'Discover Mix',
    subtitle: 'Fresh songs matching your taste',
    description: 'Updated weekly with hidden gems and breakthrough releases tailored to your history.',
    badge: 'DISCOVER',
    gradient: 'from-[#8e2de2]/80 via-[#4a00e0]/60 to-[#121212]',
    coverGrid: [
      'https://i.ytimg.com/vi/p8gq-PqMv2c/mqdefault.jpg',
      'https://i.ytimg.com/vi/qfZm277B1iI/mqdefault.jpg',
      'https://i.ytimg.com/vi/ElZfdU54Cp8/mqdefault.jpg',
      'https://i.ytimg.com/vi/IJq0yyWug1k/mqdefault.jpg'
    ],
    trackIds: ['track-softly', 'track-cheques', 'track-apna-bana-le', 'track-tum-hi-ho', 'track-with-you']
  },
  {
    id: 'mix-new-release',
    title: 'New Release Mix',
    subtitle: 'Fresh drops from your favorite artists',
    description: 'Catch every newly released single, collaboration, and EP in one dynamic feed.',
    badge: 'NEW',
    gradient: 'from-[#ff416c]/80 via-[#ff4b2b]/60 to-[#121212]',
    coverGrid: [
      'https://i.ytimg.com/vi/BddP6PYo2gs/mqdefault.jpg',
      'https://i.ytimg.com/vi/VAdGW7QDJiU/mqdefault.jpg',
      'https://i.ytimg.com/vi/VNs_cCtdbPc/mqdefault.jpg',
      'https://i.ytimg.com/vi/l8Z3azp_qK8/mqdefault.jpg'
    ],
    trackIds: ['track-chaleya', 'track-kesariya', 'track-preet-re', 'track-brown-munde']
  }
];

export const RECOMMENDED_MUSIC_VIDEOS: MusicVideoItem[] = [
  {
    id: 'vid-kesariya',
    title: 'Kesariya - Brahmāstra | Ranbir Kapoor & Alia Bhatt | Arijit Singh',
    artist: 'Sony Music India',
    duration: '4:28',
    views: '540M views',
    thumbnailUrl: 'https://i.ytimg.com/vi/BddP6PYo2gs/maxresdefault.jpg',
    videoId: 'BddP6PYo2gs',
    releaseDate: '2 years ago',
    trackId: 'track-kesariya'
  },
  {
    id: 'vid-brown-munde',
    title: 'Brown Munde - AP Dhillon | Gurinder Gill | Shinda Kahlon',
    artist: 'Run-Up Records',
    duration: '4:07',
    views: '680M views',
    thumbnailUrl: 'https://i.ytimg.com/vi/VNs_cCtdbPc/maxresdefault.jpg',
    videoId: 'VNs_cCtdbPc',
    releaseDate: '3 years ago',
    trackId: 'track-brown-munde'
  },
  {
    id: 'vid-295',
    title: '295 (Official Video) - Sidhu Moosewala | Moosetape',
    artist: 'Sidhu Moose Wala',
    duration: '4:30',
    views: '710M views',
    thumbnailUrl: 'https://i.ytimg.com/vi/n_FCrCQ6-9U/maxresdefault.jpg',
    videoId: 'n_FCrCQ6-9U',
    releaseDate: '2 years ago',
    trackId: 'track-295'
  },
  {
    id: 'vid-chaleya',
    title: 'Chaleya (Hindi) | Jawan | Shah Rukh Khan | Nayanthara | Arijit Singh',
    artist: 'T-Series',
    duration: '3:20',
    views: '380M views',
    thumbnailUrl: 'https://i.ytimg.com/vi/VAdGW7QDJiU/maxresdefault.jpg',
    videoId: 'VAdGW7QDJiU',
    releaseDate: '1 year ago',
    trackId: 'track-chaleya'
  },
  {
    id: 'vid-starboy',
    title: 'The Weeknd - Starboy ft. Daft Punk (Official Music Video)',
    artist: 'The Weeknd',
    duration: '3:50',
    views: '2.4B views',
    thumbnailUrl: 'https://i.ytimg.com/vi/34Na4j8AVgA/maxresdefault.jpg',
    videoId: '34Na4j8AVgA',
    releaseDate: '7 years ago',
    trackId: 'track-starboy'
  },
  {
    id: 'vid-blinding-lights',
    title: 'The Weeknd - Blinding Lights (Official Video)',
    artist: 'The Weeknd',
    duration: '4:20',
    views: '890M views',
    thumbnailUrl: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/maxresdefault.jpg',
    videoId: '4NRXx6U8ABQ',
    releaseDate: '4 years ago',
    trackId: 'track-blinding-lights'
  }
];

