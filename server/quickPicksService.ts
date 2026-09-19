import { accountDatabase, PlaybackEvent } from './accountDatabase.ts';
import { telemetryService } from './telemetryService.ts';

export interface CatalogTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationSec: number;
  coverUrl: string;
  videoId?: string;
  genre?: string;
  year?: string;
  plays?: string;
  quality?: string;
  isFavorite?: boolean;
}

// Master server-side music catalog
export const SERVER_TRACKS_CATALOG: CatalogTrack[] = [
  {
    id: 'track-sauda-iss-dil-ka',
    title: 'Sauda Iss Dil Ka (From "Sharma Ji Ki Shaadi")',
    artist: 'Shikhar Saxena',
    album: 'Sharma Ji Ki Shaadi',
    duration: '3:27',
    durationSec: 207,
    coverUrl: 'https://i.ytimg.com/vi/Hc-rc1-hcco/mqdefault.jpg',
    videoId: 'Hc-rc1-hcco',
    plays: '1.8 lakh plays',
    year: '2024',
    genre: 'Romance',
    quality: 'Lossless Hi-Res'
  },
  {
    id: 'track-lofi-lovee',
    title: 'Lofi Lovee',
    artist: 'Asees Kaur, Ved Sharma & Harsh Likhi',
    album: 'Lofi Lovee',
    duration: '3:15',
    durationSec: 195,
    coverUrl: 'https://i.ytimg.com/vi/vIQAt0eIu2k/mqdefault.jpg',
    videoId: 'vIQAt0eIu2k',
    plays: '12 lakh plays',
    year: '2024',
    genre: 'Relax',
    quality: 'Lossless Hi-Res'
  },
  {
    id: 'track-preet-re',
    title: 'Preet Re - Darshan Raval & Jonita Gandhi',
    artist: 'Darshan Raval, Jonita Gandhi & Rochak Kohli',
    album: 'Dhadak 2',
    duration: '3:45',
    durationSec: 225,
    coverUrl: 'https://i.ytimg.com/vi/l8Z3azp_qK8/mqdefault.jpg',
    videoId: 'l8Z3azp_qK8',
    plays: '45 lakh plays',
    year: '2024',
    genre: 'Romance',
    quality: 'Lossless Hi-Res'
  },
  {
    id: 'track-kinna-sohna',
    title: 'Kinna Sohna',
    artist: 'Akbar Wasif & Sumit Nandi',
    album: 'Kinna Sohna',
    duration: '3:32',
    durationSec: 212,
    coverUrl: 'https://i.ytimg.com/vi/J_CD7rFH-O0/mqdefault.jpg',
    videoId: 'J_CD7rFH-O0',
    plays: '8.4 lakh plays',
    year: '2024',
    genre: 'Soulful',
    quality: 'Lossless Hi-Res'
  },
  {
    id: 'track-kesariya',
    title: 'Kesariya (From "Brahmastra")',
    artist: 'Arijit Singh, Pritam & Amitabh Bhattacharya',
    album: 'Brahmastra',
    duration: '4:28',
    durationSec: 268,
    coverUrl: 'https://i.ytimg.com/vi/BddP6PYo2gs/mqdefault.jpg',
    videoId: 'BddP6PYo2gs',
    plays: '485M plays',
    year: '2022',
    genre: 'Romance',
    quality: 'Lossless Hi-Res'
  },
  {
    id: 'track-chaleya',
    title: 'Chaleya (From "Jawan")',
    artist: 'Arijit Singh, Shilpa Rao & Anirudh Ravichander',
    album: 'Jawan',
    duration: '3:20',
    durationSec: 200,
    coverUrl: 'https://i.ytimg.com/vi/VAdGW7QDJiU/mqdefault.jpg',
    videoId: 'VAdGW7QDJiU',
    plays: '430M plays',
    year: '2023',
    genre: 'Romance',
    quality: 'Lossless Hi-Res'
  },
  {
    id: 'track-295',
    title: '295',
    artist: 'Sidhu Moose Wala',
    album: 'Moosetape',
    duration: '4:30',
    durationSec: 270,
    coverUrl: 'https://i.ytimg.com/vi/n_FCrCQ6-9U/mqdefault.jpg',
    videoId: 'n_FCrCQ6-9U',
    plays: '495M plays',
    year: '2021',
    genre: 'Punjabi',
    quality: 'Lossless Hi-Res'
  },
  {
    id: 'track-brown-munde',
    title: 'Brown Munde',
    artist: 'AP Dhillon, Gurinder Gill & Shinda Kahlon',
    album: 'Brown Munde',
    duration: '4:06',
    durationSec: 246,
    coverUrl: 'https://i.ytimg.com/vi/VNs_cCtdbPc/mqdefault.jpg',
    videoId: 'VNs_cCtdbPc',
    plays: '415M plays',
    year: '2020',
    genre: 'Punjabi',
    quality: 'Lossless Hi-Res'
  },
  {
    id: 'track-starboy',
    title: 'Starboy',
    artist: 'The Weeknd ft. Daft Punk',
    album: 'Starboy',
    duration: '3:50',
    durationSec: 230,
    coverUrl: 'https://i.ytimg.com/vi/34Na4j8AVgA/mqdefault.jpg',
    videoId: '34Na4j8AVgA',
    plays: '3.2B plays',
    year: '2016',
    genre: 'Electronic',
    quality: 'Lossless Hi-Res'
  },
  {
    id: 'track-softly',
    title: 'Softly',
    artist: 'Karan Aujla & Ikky',
    album: 'Making Memories',
    duration: '2:36',
    durationSec: 156,
    coverUrl: 'https://i.ytimg.com/vi/cWMxCE2HTag/mqdefault.jpg',
    videoId: 'cWMxCE2HTag',
    plays: '280M plays',
    year: '2023',
    genre: 'Punjabi',
    quality: 'Lossless Hi-Res'
  },
  {
    id: 'track-apna-bana-le',
    title: 'Apna Bana Le',
    artist: 'Arijit Singh & Sachin-Jigar',
    album: 'Bhediya',
    duration: '4:21',
    durationSec: 261,
    coverUrl: 'https://i.ytimg.com/vi/ElZfdU54Cp8/mqdefault.jpg',
    videoId: 'ElZfdU54Cp8',
    plays: '345M plays',
    year: '2022',
    genre: 'Romance',
    quality: 'Lossless Hi-Res'
  },
  {
    id: 'track-cheques',
    title: 'Cheques',
    artist: 'Shubh',
    album: 'Still Rollin',
    duration: '3:04',
    durationSec: 184,
    coverUrl: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/mqdefault.jpg',
    videoId: '4NRXx6U8ABQ',
    plays: '310M plays',
    year: '2023',
    genre: 'Punjabi',
    quality: 'Lossless Hi-Res'
  },
  {
    id: 'track-with-you',
    title: 'With You',
    artist: 'AP Dhillon',
    album: 'With You',
    duration: '2:34',
    durationSec: 154,
    coverUrl: 'https://i.ytimg.com/vi/qfZm277B1iI/mqdefault.jpg',
    videoId: 'qfZm277B1iI',
    plays: '265M plays',
    year: '2023',
    genre: 'Romance',
    quality: 'Lossless Hi-Res'
  },
  {
    id: 'track-blinding-lights',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    duration: '3:20',
    durationSec: 200,
    coverUrl: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/mqdefault.jpg',
    videoId: 'fHI8X4PCU71',
    plays: '4.2B plays',
    year: '2020',
    genre: 'Pop',
    quality: 'Lossless Hi-Res'
  },
  {
    id: 'track-tum-hi-ho',
    title: 'Tum Hi Ho',
    artist: 'Arijit Singh & Mithoon',
    album: 'Aashiqui 2',
    duration: '4:22',
    durationSec: 262,
    coverUrl: 'https://i.ytimg.com/vi/IJq0yyWug1k/mqdefault.jpg',
    videoId: 'IJq0yyWug1k',
    plays: '520M plays',
    year: '2013',
    genre: 'Romance',
    quality: 'Lossless Hi-Res'
  },
  {
    id: 'track-raataan-lambiyan',
    title: 'Raataan Lambiyan',
    artist: 'Jubin Nautiyal & Asees Kaur',
    album: 'Shershaah',
    duration: '3:50',
    durationSec: 230,
    coverUrl: 'https://i.ytimg.com/vi/gvyUuxdRdR4/mqdefault.jpg',
    videoId: 'gvyUuxdRdR4',
    plays: '780M plays',
    year: '2021',
    genre: 'Romance',
    quality: 'Lossless Hi-Res'
  }
];

export interface AlgorithmicBreakdown {
  recencyScore: number;
  frequencyScore: number;
  contextScore: number;
  telemetryScore: number;
  telemetryMultiplier: number;
  totalScore: number;
  lastPlayedDaysAgo: number | null;
  loopCount: number;
  playCount: number;
  skipRate?: number;
  completionRate?: number;
  matchedHabits: string[];
  reasonBadge: string;
}

export interface QuickPickResultItem extends CatalogTrack {
  algorithmBreakdown: AlgorithmicBreakdown;
  isFavorite: boolean;
}

export interface QuickPicksResponse {
  status: 'ok';
  userId: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  clientHour: number;
  metrics: {
    totalEventsAnalyzed: number;
    sevenDayPlaysCount: number;
    highestLoopCount: number;
    contextVibe: string;
  };
  quickPicks: QuickPickResultItem[];
}

export class QuickPicksService {
  private readonly SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  /**
   * Determine time of day based on provided hour or system clock
   */
  public getTimeOfDay(hour?: number): 'morning' | 'afternoon' | 'evening' | 'night' {
    const h = typeof hour === 'number' ? hour : new Date().getHours();
    if (h >= 5 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
  }

  /**
   * Generate Quick Picks based on the 3 core algorithmic pillars:
   * 1. Recency: Played in the last 7 days
   * 2. Frequency: High loop counts & repeat plays
   * 3. Context: Time of day matching & learned habitual listening
   */
  public generateQuickPicks(
    userId = 'default_user',
    requestedTimeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night',
    clientHour?: number,
    limit = 16
  ): QuickPicksResponse {
    const account = accountDatabase.getAccount(userId);
    const now = Date.now();
    const effectiveHour = typeof clientHour === 'number' ? clientHour : new Date().getHours();
    const timeOfDay = requestedTimeOfDay || this.getTimeOfDay(effectiveHour);

    const likedSet = new Set(account.likedTrackIds);
    const playbackEvents = account.playbackEvents || [];

    // 1. Analyze recency and frequency from playback events in last 7 days
    const statsByTrack = new Map<
      string,
      {
        totalPlays: number;
        sevenDayPlays: number;
        totalLoops: number;
        lastPlayedTimestamp: number;
        playsByTimeOfDay: Record<string, number>;
      }
    >();

    playbackEvents.forEach((ev) => {
      const isWithin7Days = now - ev.timestamp <= this.SEVEN_DAYS_MS;
      if (!statsByTrack.has(ev.trackId)) {
        statsByTrack.set(ev.trackId, {
          totalPlays: 0,
          sevenDayPlays: 0,
          totalLoops: 0,
          lastPlayedTimestamp: 0,
          playsByTimeOfDay: { morning: 0, afternoon: 0, evening: 0, night: 0 }
        });
      }

      const st = statsByTrack.get(ev.trackId)!;
      st.totalPlays += 1;
      if (isWithin7Days) {
        st.sevenDayPlays += 1;
      }
      st.totalLoops += ev.loopCount || 0;
      if (ev.timestamp > st.lastPlayedTimestamp) {
        st.lastPlayedTimestamp = ev.timestamp;
      }

      const tod = ev.timeOfDay || this.getTimeOfDay(ev.hour);
      st.playsByTimeOfDay[tod] = (st.playsByTimeOfDay[tod] || 0) + 1;
    });

    let maxLoopsFound = 0;
    let total7DayPlays = 0;

    // 2. Score every track in catalog
    const scoredTracks: QuickPickResultItem[] = SERVER_TRACKS_CATALOG.map((track) => {
      const stats = statsByTrack.get(track.id);
      const isFavorite = likedSet.has(track.id);

      let recencyScore = 0;
      let frequencyScore = 0;
      let contextScore = 0;
      const matchedHabits: string[] = [];
      let lastPlayedDaysAgo: number | null = null;
      let loopCount = 0;
      let playCount = 0;

      // ==========================================
      // PILLAR 1: RECENCY (Played in last 7 days)
      // ==========================================
      if (stats && stats.lastPlayedTimestamp > 0) {
        const diffMs = now - stats.lastPlayedTimestamp;
        lastPlayedDaysAgo = Math.floor(diffMs / (24 * 3600 * 1000));
        playCount = stats.totalPlays;
        loopCount = stats.totalLoops;

        if (diffMs <= this.SEVEN_DAYS_MS) {
          total7DayPlays += stats.sevenDayPlays;
          const hoursAgo = diffMs / (3600 * 1000);

          if (hoursAgo < 12) {
            recencyScore = 60; // Played very recently today
            matchedHabits.push('Played recently today');
          } else if (hoursAgo < 24) {
            recencyScore = 50;
            matchedHabits.push('Played yesterday');
          } else if (hoursAgo < 72) {
            recencyScore = 38;
            matchedHabits.push(`Played ${Math.floor(hoursAgo / 24)}d ago`);
          } else {
            recencyScore = 24;
            matchedHabits.push(`Active this week (${lastPlayedDaysAgo}d ago)`);
          }

          // Bonus for repeat plays in 7 days
          if (stats.sevenDayPlays > 1) {
            recencyScore += Math.min(stats.sevenDayPlays * 6, 24);
          }
        }
      }

      // ==========================================
      // PILLAR 2: FREQUENCY (Loops & Repeat Plays)
      // ==========================================
      if (loopCount > 0) {
        maxLoopsFound = Math.max(maxLoopsFound, loopCount);
        // High loop count is the ultimate signal of deep engagement
        frequencyScore += loopCount * 22;
        matchedHabits.push(`${loopCount}x On Repeat / Looped`);
      }

      if (playCount > 0) {
        frequencyScore += Math.min(playCount * 8, 48);
      }

      if (isFavorite) {
        frequencyScore += 30;
        matchedHabits.push('Saved in Library ❤️');
      }

      // ==========================================
      // PILLAR 3: CONTEXT (Time of Day & Habits)
      // ==========================================
      // A. Learned historical habits for this time-of-day
      if (stats && stats.playsByTimeOfDay[timeOfDay] > 0) {
        const habitPlays = stats.playsByTimeOfDay[timeOfDay];
        const habitBoost = Math.min(habitPlays * 14, 42);
        contextScore += habitBoost;
        matchedHabits.push(`Learned ${timeOfDay} habit (${habitPlays}x)`);
      }

      // B. Sonic & Genre alignment with current daypart
      const genre = (track.genre || '').toLowerCase();
      const title = track.title.toLowerCase();
      const artist = track.artist.toLowerCase();

      // Language detection
      let trackLang = 'hindi';
      if (genre.includes('punjabi') || artist.includes('sidhu') || artist.includes('dhillon') || artist.includes('shubh') || artist.includes('aujla')) {
        trackLang = 'punjabi';
      } else if (genre.includes('electronic') || artist.includes('weeknd') || artist.includes('daft')) {
        trackLang = 'english';
      }

      // Popularity score calculation
      let popScore = 50;
      if (track.plays) {
        const p = track.plays.toLowerCase();
        if (p.includes('b')) popScore = 95;
        else if (p.includes('m')) popScore = 85;
        else if (p.includes('lakh')) popScore = 70;
      }

      // Cold start popularity & language weight
      if (playbackEvents.length === 0 && likedSet.size === 0) {
        recencyScore = popScore * 0.45;
        if (trackLang === 'hindi' || trackLang === 'punjabi' || trackLang === 'english') {
          frequencyScore += 20;
        }
        matchedHabits.push('Popular Hit');
      }

      switch (timeOfDay) {
        case 'morning':
          // Morning favors uplifting, fresh romance, acoustic chords and wake-up melodies
          if (genre.includes('romance') || genre.includes('soulful') || genre.includes('melodic') || title.includes('sauda') || title.includes('dil')) {
            contextScore += 26;
            matchedHabits.push('Morning Melodic Rhythm');
          } else if (genre.includes('pop')) {
            contextScore += 18;
          }
          break;

        case 'afternoon':
          // Afternoon favors driving Punjabi beats, upbeat energy, focus and electronic
          if (genre.includes('punjabi') || genre.includes('electronic') || title.includes('295') || title.includes('brown') || title.includes('cheques')) {
            contextScore += 30;
            matchedHabits.push('High-Energy Afternoon Pace');
          } else if (genre.includes('pop')) {
            contextScore += 20;
          }
          break;

        case 'evening':
          // Evening favors romantic singalongs, Bollywood golden hour, soulful anthems
          if (genre.includes('romance') || genre.includes('soulful') || title.includes('preet') || title.includes('chaleya') || title.includes('kesariya')) {
            contextScore += 28;
            matchedHabits.push('Evening Romance & Sunset Vibe');
          } else if (genre.includes('punjabi')) {
            contextScore += 16;
          }
          break;

        case 'night':
          // Night favors chillout, Lo-Fi, slow ambient, dark pop and acoustic warmth
          if (genre.includes('relax') || genre.includes('lofi') || genre.includes('chill') || title.includes('lofi') || title.includes('starboy')) {
            contextScore += 34;
            matchedHabits.push('Midnight Chill & Lo-Fi Match');
          } else if (genre.includes('soulful')) {
            contextScore += 22;
          }
          break;
      }

      // ==========================================
      // PILLAR 4: TELEMETRY FEEDBACK (Module 5 ML Loop)
      // ==========================================
      const mlFeedback = telemetryService.getMLRecommendationFeedback(track.id);
      const trackTelemetry = telemetryService.getSummaryForTrack(track.id);
      const telemetryScore = mlFeedback.scoreBonus;
      const telemetryMultiplier = mlFeedback.multiplier;

      if (mlFeedback.isHighRetention) {
        matchedHabits.push(mlFeedback.reasonBadge || 'High Completion Rate');
      } else if (mlFeedback.isHighSkipRisk) {
        matchedHabits.push('Elevated Skip Risk Warning');
      }

      // Compute final score using raw pillars + telemetry bonus, scaled by multiplier
      const rawScore = recencyScore + frequencyScore + contextScore + telemetryScore;
      const totalScore = Math.max(0, Math.round(rawScore * telemetryMultiplier));

      // Select most appropriate badge for UI display
      let reasonBadge = 'Quick Pick';
      if (mlFeedback.isHighRetention && (trackTelemetry.completionRate >= 0.8 || trackTelemetry.totalCompletions > 500)) {
        reasonBadge = `${Math.round(trackTelemetry.completionRate * 100)}% Completion`;
      } else if (loopCount >= 3) {
        reasonBadge = `${loopCount}x Looped`;
      } else if (recencyScore >= 45) {
        reasonBadge = '7d Recent';
      } else if (contextScore >= 25) {
        reasonBadge = `${timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1)} Pick`;
      } else if (isFavorite) {
        reasonBadge = 'Favorite';
      }

      return {
        ...track,
        isFavorite,
        algorithmBreakdown: {
          recencyScore,
          frequencyScore,
          contextScore,
          telemetryScore,
          telemetryMultiplier,
          totalScore,
          lastPlayedDaysAgo,
          loopCount,
          playCount,
          skipRate: trackTelemetry.skipRate,
          completionRate: trackTelemetry.completionRate,
          matchedHabits,
          reasonBadge
        }
      };
    });

    // 3. Sort by total algorithmic score descending
    scoredTracks.sort((a, b) => b.algorithmBreakdown.totalScore - a.algorithmBreakdown.totalScore);

    const contextVibes: Record<string, string> = {
      morning: 'Acoustic Calm, Melodic Romance & Fresh Wakeup',
      afternoon: 'Driving Punjabi Drill, High-Tempo Beats & Focus',
      evening: 'Golden Hour Bollywood Romance & Soulful Chords',
      night: 'Midnight Lo-Fi, Downtempo Chill & Ambient Acoustics'
    };

    return {
      status: 'ok',
      userId,
      timeOfDay,
      clientHour: effectiveHour,
      metrics: {
        totalEventsAnalyzed: playbackEvents.length,
        sevenDayPlaysCount: total7DayPlays,
        highestLoopCount: maxLoopsFound,
        contextVibe: contextVibes[timeOfDay] || 'Personalized Adaptive Rotation'
      },
      quickPicks: scoredTracks.slice(0, limit)
    };
  }
}

export const quickPicksService = new QuickPicksService();
