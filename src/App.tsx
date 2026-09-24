import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2 } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import { Track, ActiveScreen, SettingsState, MusicMix, MusicVideoItem, PlaybackContext, RepeatMode } from './types';
import { TRACKS, INITIAL_SETTINGS } from './data/musicData';
import { audioEngine } from './utils/audioPlayer';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { MiniPlayer } from './components/MiniPlayer';
import { BootSplashScreen } from './components/BootSplashScreen';
import { MusicVideoModal } from './components/MusicVideoModal';
import { OnboardingModal } from './components/OnboardingModal';
import { NetworkOfflineBanner } from "./components/NetworkOfflineBanner";


const HomeScreen = lazy(() => import('./components/HomeScreen').then(m => ({ default: m.HomeScreen })));
const SettingsScreen = lazy(() => import('./components/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const NowPlayingScreen = lazy(() => import('./components/NowPlayingScreen').then(m => ({ default: m.NowPlayingScreen })));
const SearchScreen = lazy(() => import('./components/SearchScreen').then(m => ({ default: m.SearchScreen })));
const LibraryScreen = lazy(() => import('./components/LibraryScreen').then(m => ({ default: m.LibraryScreen })));
const PlanScreen = lazy(() => import('./components/PlanScreen').then(m => ({ default: m.PlanScreen })));
const PluginsScreen = lazy(() => import('./components/PluginsScreen').then(m => ({ default: m.PluginsScreen })));
import { SleepTimerModal } from './components/SleepTimerModal';

import { personalizationService, PersonalizedHomeData } from './services/personalizationService';
import { getSongDeduplicationKey, areTracksEqual, sanitizeTrackForPersistence } from './services/musicNormalizationService';
import { smartShuffle } from './utils/shuffleUtils';
import { historyService } from './services/historyService';
import { offlineService } from './services/offlineService';
import { streamingEngine } from './services/streamingEngine';
import { mediaSessionService } from './services/mediaSessionService';
import { networkMonitorService } from './services/networkMonitorService';
import { offlineDatabaseService } from './services/offlineDatabaseService';

import { realtimeSyncService } from './services/realtimeSyncService';
import { authClient } from './services/authClient';
import { telemetryClient } from './services/telemetryClient';
import { nativeAudioPlayerService } from './services/nativeAudioPlayerService';
import { extractAmbientPalette, applyPaletteToDocument } from './utils/colorExtractor';

export default function App() {
  const [userName, setUserName] = useState<string>(() => {
    try {
      return localStorage.getItem('vd_user_name') || '';
    } catch {
      return '';
    }
  });
  // Recommendation algorithm runs with built-in intelligent defaults; onboarding popup is never auto-opened on startup
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('home');
  const [activeVideo, setActiveVideo] = useState<MusicVideoItem | null>(null);
  const [favoriteTrackIds, setFavoriteTrackIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('vd_favorite_track_ids');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch {}
    return new Set<string>();
  });
  const [tracks, setTracks] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem('vd_favorite_track_ids');
      if (saved) {
        const favSet = new Set<string>(JSON.parse(saved));
        return TRACKS.map((t) => ({ ...t, isFavorite: favSet.has(t.id) }));
      }
    } catch {}
    return TRACKS;
  });
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState<boolean>(false);
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState<boolean>(false);
  const [showBackgroundPermission, setShowBackgroundPermission] = useState<boolean>(() => {
    try {
      return localStorage.getItem('vd_background_playback_permission') === null;
    } catch {
      return false;
    }
  });
  const [settings, setSettings] = useState<SettingsState>(() => {
    try {
      const saved = localStorage.getItem('vd_user_settings_v3');
      if (saved) {
        return { ...INITIAL_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {}
    return INITIAL_SETTINGS;
  });

  // Save settings whenever they update
  useEffect(() => {
    try {
      localStorage.setItem('vd_user_settings_v3', JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // Sync playback & streaming settings to AudioEngine
  useEffect(() => {
    audioEngine.configure({
      volumeNormalization: settings.volumeNormalization,
      skipSilence: settings.skipSilence,
      skipSponsor: settings.skipSponsor,
      audioQuality: settings.audioQuality,
      streamingInstance: settings.invidiousInstance,
      backgroundPlayback: settings.backgroundPlayback
    });
  }, [
    settings.volumeNormalization,
    settings.skipSilence,
    settings.skipSponsor,
    settings.audioQuality,
    settings.invidiousInstance,
    settings.backgroundPlayback
  ]);

  // Dynamic song color adaptation: dynamically changes UI colors with the playing song
  useEffect(() => {
    let isCancelled = false;
    const coverUrl = currentTrack?.coverUrl || TRACKS[0]?.coverUrl;
    const key = (currentTrack?.id || 'streamzy') + (currentTrack?.title || 'track');

    extractAmbientPalette(coverUrl, key).then((palette) => {
      if (!isCancelled) {
        applyPaletteToDocument(palette, settings.pureBlackAmoled);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.coverUrl, currentTrack?.title, settings.pureBlackAmoled]);

  // YouTube Music / Spotify-Style Personalization State
  const [originalQueue, setOriginalQueue] = useState<Track[]>([]);
  const [shuffledQueue, setShuffledQueue] = useState<Track[]>([]);
  const [isShuffle, setIsShuffle] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('vd_is_shuffle');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  // Save isShuffle preference to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('vd_is_shuffle', JSON.stringify(isShuffle));
    } catch {}
  }, [isShuffle]);

  // Active queue exposed to the rest of the app:
  const queue = isShuffle ? (shuffledQueue.length > 0 ? shuffledQueue : originalQueue) : originalQueue;

  const [pastQueue, setPastQueue] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem('vd_past_queue_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [playbackContext, setPlaybackContext] = useState<PlaybackContext>({
    type: 'all',
    title: 'All Tracks'
  });

  // Save pastQueue for continuous previous navigation
  useEffect(() => {
    try {
      const sanitizedPastQueue = pastQueue.map(t => sanitizeTrackForPersistence(t));
      localStorage.setItem('vd_past_queue_v1', JSON.stringify(sanitizedPastQueue));
    } catch {}
  }, [pastQueue]);

  const [playbackHistory, setPlaybackHistory] = useState<Track[]>(() => {
    return historyService.getHistoryTracks();
  });
  const [personalizedHome, setPersonalizedHome] = useState<PersonalizedHomeData | null>(null);
  const [activeVibe, setActiveVibe] = useState<string>('Bollywood Melody & Romance');
  const [vibeToast, setVibeToast] = useState<{ title: string; vibe: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchSource, setSearchSource] = useState<'all' | 'youtube' | 'piped' | 'jiosaavn'>('all');

  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const repeatModeRef = useRef<RepeatMode>(repeatMode);
  repeatModeRef.current = repeatMode;

  const [isInfiniteAutoPlay, setIsInfiniteAutoPlay] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('vd_infinite_autoplay');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const isInfiniteAutoPlayRef = useRef<boolean>(isInfiniteAutoPlay);
  isInfiniteAutoPlayRef.current = isInfiniteAutoPlay;

  const playbackContextRef = useRef<PlaybackContext>(playbackContext);
  playbackContextRef.current = playbackContext;

  const currentTrackRef = useRef<Track | null>(currentTrack);
  currentTrackRef.current = currentTrack;

  // Real-time synchronization with native media player & ExoPlayer bridge
  useEffect(() => {
    const unsubNative = nativeAudioPlayerService.registerHandler({
      onTimeUpdate: (positionSec, durationSec) => {
        const flooredSec = Math.floor(positionSec);
        setCurrentTimeSec(flooredSec);
        if (currentTrackRef.current) {
          const totalDur = durationSec || currentTrackRef.current.durationSec || 0;
          telemetryClient.onTimeUpdate(flooredSec, totalDur);
          historyService.recordPlayProgress(currentTrackRef.current, flooredSec, totalDur, playbackContextRef.current);
        }
      },
      onStateChanged: (playing) => {
        setIsPlaying(playing);
      },
      onTrackChanged: (trackPayload) => {
        if (trackPayload) {
          setCurrentTimeSec(0);
          setIsPlaying(true);
        }
      }
    });

    // Re-sync position and playing state when app returns to foreground from lockscreen / background
    const syncPlaybackFromNative = async () => {
      if (nativeAudioPlayerService.isNative()) {
        try {
          const state = await nativeAudioPlayerService.getPlaybackState();
          if (state) {
            if (typeof state.isPlaying === 'boolean') {
              setIsPlaying(state.isPlaying);
            }
            if (typeof state.positionSec === 'number') {
              setCurrentTimeSec(Math.floor(state.positionSec));
            }
          }
        } catch {}
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncPlaybackFromNative();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', syncPlaybackFromNative);

    return () => {
      unsubNative();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', syncPlaybackFromNative);
    };
  }, []);

  // Listen to history updates
  useEffect(() => {
    const unsubHistory = historyService.subscribe(() => {
      setPlaybackHistory(historyService.getHistoryTracks());
    });
    return () => unsubHistory();
  }, []);

  const [radioTracks, setRadioTracks] = useState<Track[]>([]);

  const [isOfflineOnly, setIsOfflineOnly] = useState<boolean>(() => offlineService.isOfflineOnlyMode() || networkMonitorService.isOffline());
  const [offlineTracks, setOfflineTracks] = useState<Track[]>(() => offlineDatabaseService.getOfflineTracksSync());

  useEffect(() => {
    const handleUpdate = () => {
      setIsOfflineOnly(offlineService.isOfflineOnlyMode() || networkMonitorService.isOffline());
      setOfflineTracks(offlineDatabaseService.getOfflineTracksSync());
    };

    const unsubOff = offlineService.subscribe(handleUpdate);
    const unsubNet = networkMonitorService.subscribe(handleUpdate);

    return () => {
      unsubOff();
      unsubNet();
    };
  }, []);

  // When offline, active display tracks switch instantly to local database
  const activeDisplayTracks = isOfflineOnly && offlineTracks.length > 0 ? offlineTracks : tracks;

  const isReplenishingQueueRef = useRef(false);

  // Intelligent Autoplay / Radio Mode: When 2-3 songs remain, preload the next recommendation batch in advance
  useEffect(() => {
    if (!isInfiniteAutoPlay || !currentTrack || isReplenishingQueueRef.current) return;
    
    // Filter out any disliked tracks
    const eligibleRemaining = queue.filter((t) => !personalizationService.isDisliked(t.id));
    
    // Trigger proactive replenishment when remaining queue is 3 songs or fewer
    if (eligibleRemaining.length <= 3) {
      isReplenishingQueueRef.current = true;
      
      // Contextual seed: smoothly follow from the tail of the current queue or the current playing song
      const seedTrack = eligibleRemaining.length > 0 
        ? eligibleRemaining[eligibleRemaining.length - 1] 
        : currentTrack;
        
      const fullHistoryAndQueue = [currentTrack, ...queue, ...playbackHistory];

      personalizationService.generatePersonalizedQueue(seedTrack, tracks, fullHistoryAndQueue, playbackContext)
        .then((newBatch) => {
          if (newBatch && newBatch.length > 0) {
            const existingKeys = new Set([
              getSongDeduplicationKey(currentTrack),
              ...originalQueue.map((t) => getSongDeduplicationKey(t)),
              ...shuffledQueue.map((t) => getSongDeduplicationKey(t))
            ]);
            const freshTracks = newBatch.filter((t) => 
              !existingKeys.has(getSongDeduplicationKey(t)) && 
              !personalizationService.isDisliked(t.id)
            );
            if (freshTracks.length > 0) {
              setOriginalQueue((prev) => [...prev, ...freshTracks]);
              if (isShuffle) {
                setShuffledQueue((prev) => [...prev, ...smartShuffle(freshTracks, currentTrack)]);
              }
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          setTimeout(() => {
            isReplenishingQueueRef.current = false;
          }, 1500);
        });
    }
  }, [queue.length, isInfiniteAutoPlay, currentTrack?.id, tracks, isShuffle, playbackContext]);

  // Update dynamic upcoming radio recommendations whenever currentTrack changes
  useEffect(() => {
    if (currentTrack) {
      const instantRadio = personalizationService.getInstantPersonalizedQueue(currentTrack, tracks, playbackHistory, playbackContext);
      setRadioTracks(instantRadio.slice(0, 8));
      personalizationService.generatePersonalizedQueue(currentTrack, tracks, playbackHistory, playbackContext).then((pTracks) => {
        if (pTracks && pTracks.length > 0) {
          setRadioTracks(pTracks.slice(0, 8));
        }
      });
    }
  }, [currentTrack?.id]);

  // Initialize personalized home and queue on startup
  useEffect(() => {
    const initialHome = personalizationService.generatePersonalizedHome(TRACKS[0], tracks, playbackHistory, favoriteTrackIds);
    setPersonalizedHome(initialHome);
    setActiveVibe(initialHome.radioVibe);
    setOriginalQueue([]);
    setShuffledQueue([]);
  }, []);

  // Subscribe to personalization engine changes (likes, dislikes, loops, cold-start)
  useEffect(() => {
    const unsub = personalizationService.subscribe(() => {
      setPersonalizedHome(personalizationService.generatePersonalizedHome(currentTrack, tracks, playbackHistory, favoriteTrackIds));
    });
    return unsub;
  }, [currentTrack, tracks, playbackHistory, favoriteTrackIds]);

  // Module 4: Continuous Real-Time State Syncing across Devices (SSE + Cloud Account Database)
  useEffect(() => {
    realtimeSyncService.connect();

    // Pull initial cloud state if available to hydrate local state
    realtimeSyncService.fetchAccountState().then((acc) => {
      if (acc?.likedTrackIds && acc.likedTrackIds.length > 0) {
        const cloudFavs = new Set(acc.likedTrackIds);
        setFavoriteTrackIds((prev) => {
          const merged = new Set([...Array.from(prev), ...Array.from(cloudFavs)]);
          try {
            localStorage.setItem('vd_favorite_track_ids', JSON.stringify(Array.from(merged)));
          } catch {}
          return merged;
        });
      }
    });

    // 1. Cross-Device Like Sync: If user likes/unlikes a song on their phone, it reflects here instantly!
    const unsubLike = realtimeSyncService.onLikeUpdated((data) => {
      const { trackId, isLiked, sourceDeviceName } = data;
      setFavoriteTrackIds((prev) => {
        const next = new Set(prev);
        if (isLiked) {
          next.add(trackId);
        } else {
          next.delete(trackId);
        }
        try {
          localStorage.setItem('vd_favorite_track_ids', JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });

      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, isFavorite: isLiked } : t))
      );

      if (currentTrack?.id === trackId) {
        setCurrentTrack((prev) => (prev ? { ...prev, isFavorite: isLiked } : null));
      }

      setVibeToast({
        title: 'Cloud State Synced',
        vibe: `${sourceDeviceName || 'Mobile Phone'} ${isLiked ? 'liked' : 'unliked'} this song`
      });
      setTimeout(() => setVibeToast(null), 3200);
    });

    // 2. Cross-Device Queue Sync: Continuous "Up Next" queue sync across all devices
    const unsubQueue = realtimeSyncService.onQueueUpdated((data) => {
      const { queue: remoteQueue, sourceDeviceName } = data;
      if (Array.isArray(remoteQueue)) {
        setOriginalQueue(remoteQueue);
        if (isShuffle) {
          setShuffledQueue(smartShuffle(remoteQueue, currentTrack));
        } else {
          setShuffledQueue([]);
        }
        setVibeToast({
          title: 'Queue Synced',
          vibe: `Up Next synced from ${sourceDeviceName || 'Mobile Device'}`
        });
        setTimeout(() => setVibeToast(null), 3200);
      }
    });

    // Module 5: Initialize JWT Authentication & User Session
    authClient.init().then((user) => {
      if (user?.displayName) {
        setUserName(user.displayName);
      }
    });

    const unsubAuth = authClient.onAuthChange((user) => {
      if (user?.displayName) {
        setUserName(user.displayName);
      }
    });

    return () => {
      unsubLike();
      unsubQueue();
      unsubAuth();
      realtimeSyncService.disconnect();
    };
  }, [currentTrack?.id]);

  // Apply accent color and pure black mode to root document
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', settings.accentColor);
    if (settings.pureBlackAmoled) {
      document.documentElement.classList.add('pure-black');
      document.body.classList.add('pure-black');
    } else {
      document.documentElement.classList.remove('pure-black');
      document.body.classList.remove('pure-black');
    }
  }, [settings.accentColor, settings.pureBlackAmoled]);

  // Sleep timer countdown & auto-pause handler
  useEffect(() => {
    if (!settings.sleepTimerRemaining || settings.sleepTimerRemaining <= 0) return;

    const sleepTimerInterval = window.setInterval(() => {
      setSettings((prev) => {
        if (!prev.sleepTimerRemaining || prev.sleepTimerRemaining <= 1) {
          setIsPlaying(false);
          audioEngine.pause();
          return { ...prev, sleepTimerRemaining: null };
        }
        return { ...prev, sleepTimerRemaining: prev.sleepTimerRemaining - 1 };
      });
    }, 60000);

    return () => clearInterval(sleepTimerInterval);
  }, [settings.sleepTimerRemaining]);

  // Handle Android hardware back button and browser history
  useEffect(() => {
    let backButtonHandle: any = null;

    const setupBackButton = async () => {
      try {
        backButtonHandle = await CapApp.addListener('backButton', () => {
          if (isNowPlayingOpen) {
            setIsNowPlayingOpen(false);
          } else if (activeScreen !== 'home') {
            setActiveScreen('home');
          } else {
            CapApp.exitApp();
          }
        });
      } catch {
        // Not running in Capacitor environment
      }
    };

    setupBackButton();

    const handlePopState = () => {
      if (isNowPlayingOpen) {
        setIsNowPlayingOpen(false);
      } else if (activeScreen !== 'home') {
        setActiveScreen('home');
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      if (backButtonHandle && backButtonHandle.remove) {
        backButtonHandle.remove();
      }
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isNowPlayingOpen, activeScreen]);

  // Push history state whenever user enters a subview or modal
  useEffect(() => {
    window.history.pushState(
      { screen: activeScreen, nowPlaying: isNowPlayingOpen },
      ''
    );
  }, [activeScreen, isNowPlayingOpen]);

  // Handle equalizer preset updates
  useEffect(() => {
    audioEngine.setPreset(settings.equalizerPreset);
  }, [settings.equalizerPreset]);

  // Subscribe to authoritative AudioEngine playback state changes
  useEffect(() => {
    audioEngine.onIsPlayingChanged((playing) => {
      setIsPlaying(playing);
    });
  }, []);

  const handleTogglePlay = () => {
    if (!currentTrack) {
      if (tracks.length > 0) {
        handleSelectTrack(tracks[0]);
      }
      return;
    }
    const realPlaying = audioEngine.getIsPlaying();
    if (realPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.resume();
    }
  };

  const handleSelectTrack = async (
    track: Track,
    keepQueue = false,
    overrideQueue?: Track[],
    context?: PlaybackContext,
    options?: { isBackNavigation?: boolean }
  ) => {
    if (context) {
      setPlaybackContext(context);
    }
    const activeContext = context || playbackContext;

    // 1. Record listen and selection signals in personalization engine & update active vibe
    const { vibe } = personalizationService.recordTrackListen(track);
    personalizationService.recordPlayStarted(track, keepQueue ? 'autoplay' : 'user_selection');
    if (!keepQueue) {
      personalizationService.recordSongSelected(track);
    }
    setActiveVibe(vibe);

    // If switching track normally (forward), save the previous track into pastQueue stack
    if (!options?.isBackNavigation && currentTrack && !areTracksEqual(currentTrack, track)) {
      setPastQueue((prev) => [...prev.filter((t) => !areTracksEqual(t, currentTrack)), currentTrack].slice(-50));
    }

    // 2. Add current played track to listening history (deduped, bounded, stored with duration & context)
    const trackWithTimestamp: Track = {
      ...track,
      playedAt: Date.now()
    };
    historyService.recordPlayStart(track, activeContext);
    const newHistory = historyService.getHistoryTracks();
    setPlaybackHistory(newHistory);

    // 3. Show dynamic personalization toast badge
    if (!keepQueue) {
      setVibeToast({ title: track.title, vibe });
      setTimeout(() => {
        setVibeToast(null);
      }, 3200);
    }

    const enrichedTrack = {
      ...trackWithTimestamp,
      isFavorite: favoriteTrackIds.has(track.id) || Boolean(track.isFavorite)
    };
    setCurrentTrack(enrichedTrack);
    setCurrentTimeSec(0);
    setIsPlaying(true);

    const activeQ = keepQueue
      ? (overrideQueue || queue)
      : personalizationService.getInstantPersonalizedQueue(track, tracks, newHistory, activeContext);

    if (!keepQueue) {
      // 4. Update personalized Home data with full history and favorites
      const homeData = personalizationService.generatePersonalizedHome(track, tracks, newHistory, favoriteTrackIds);
      setPersonalizedHome(homeData);

      // 5. Generate INSTANT dynamic Up Next queue (exact same artist/genre/vibe & context)
      setOriginalQueue(activeQ);
      if (isShuffle) {
        setShuffledQueue(smartShuffle(activeQ, track));
      } else {
        setShuffledQueue([]);
      }

      // Background online recommendation enrichment
      personalizationService.generatePersonalizedQueue(track, tracks, newHistory, activeContext).then((personalizedQ) => {
        if (personalizedQ && personalizedQ.length > 0) {
          setOriginalQueue(personalizedQ);
          if (isShuffle) {
            setShuffledQueue(smartShuffle(personalizedQ, track));
          }
          // Keep pre-buffer standby deck synchronized with new queue head
          streamingEngine.prefetchNextInQueue(track, isShuffle ? smartShuffle(personalizedQ, track) : personalizedQ);
        }
      });
    } else if (overrideQueue) {
      setOriginalQueue(overrideQueue);
      if (isShuffle) {
        setShuffledQueue(smartShuffle(overrideQueue, track));
      }
    }

    // 6. Play real song directly via Universal Audio Engine with Zero-Latency Pre-buffering
    audioEngine.play(
      track,
      (sec) => {
        setCurrentTimeSec(Math.floor(sec));
        telemetryClient.onTimeUpdate(sec, track.durationSec);
        historyService.recordPlayProgress(track, sec, track.durationSec, activeContext);
      },
      () => {
        telemetryClient.onTrackEnded();
        personalizationService.recordPlayCompleted(enrichedTrack, track.durationSec || 200);
        historyService.recordPlayCompleted(enrichedTrack, track.durationSec || 200, activeContext);

        // Repeat One: replay track from start
        if (repeatModeRef.current === 'one') {
          telemetryClient.onTrackLooped();
          personalizationService.recordTrackLoop(enrichedTrack);
          realtimeSyncService.recordPlayback(enrichedTrack.id, 1, enrichedTrack.durationSec);
          audioEngine.seek(0);
          audioEngine.resume();
          setCurrentTimeSec(0);
          return;
        }

        handleNextTrack();
      },
      (err) => {
        console.warn(`[App] Playback error encountered: ${err}`);
        // Do NOT automatically skip track on temporary network/buffering hiccups
      },
      activeQ
    );

    // Module 5: Silent Telemetry Tracking
    telemetryClient.onTrackStart(enrichedTrack.id, enrichedTrack.title, enrichedTrack.durationSec);

    // Module 4: Sync Playback Event & Up Next Queue to Account Database
    realtimeSyncService.recordPlayback(track.id, 0, track.durationSec);
    realtimeSyncService.syncQueue(enrichedTrack, activeQ, true);
  };

  const handlePlayQueue = (trackList: Track[], startIndex = 0, context?: PlaybackContext) => {
    if (!trackList || trackList.length === 0) return;
    const startTrack = trackList[startIndex] || trackList[0];
    const remaining = trackList.slice(startIndex + 1);
    const newContext: PlaybackContext = context || {
      type: 'playlist',
      title: 'Queue',
      sourceTracks: trackList,
      sourceIndex: startIndex
    };
    setPlaybackContext(newContext);
    setOriginalQueue(remaining);
    if (isShuffle) {
      const randomized = smartShuffle(remaining, startTrack);
      setShuffledQueue(randomized);
      handleSelectTrack(startTrack, true, randomized, newContext);
    } else {
      setShuffledQueue([]);
      handleSelectTrack(startTrack, true, remaining, newContext);
    }
  };

  const handleNextTrack = (isErrorSkip: boolean = false) => {
    // 1. Listen History Weighting: Record skip penalty or completion based on play duration
    if (currentTrack && !isErrorSkip) {
      const dur = currentTrack.durationSec || 200;
      if (currentTimeSec < 25) {
        personalizationService.recordTrackSkip(currentTrack, currentTimeSec, dur);
        historyService.recordPlayProgress(currentTrack, currentTimeSec, dur, playbackContext);
      } else if (currentTimeSec >= dur * 0.85) {
        personalizationService.recordPlayCompleted(currentTrack, currentTimeSec);
        historyService.recordPlayCompleted(currentTrack, currentTimeSec, playbackContext);
      } else {
        personalizationService.recordListeningDuration(currentTrack, currentTimeSec);
        historyService.recordPlayProgress(currentTrack, currentTimeSec, dur, playbackContext);
      }
    }

    // 2. Repeat One: replay current track from 0:00
    if (repeatMode === 'one' && !isErrorSkip) {
      if (currentTrack) {
        telemetryClient.onTrackLooped();
        personalizationService.recordTrackLoop(currentTrack);
        realtimeSyncService.recordPlayback(currentTrack.id, 1, currentTrack.durationSec);
      }
      audioEngine.seek(0);
      audioEngine.resume();
      setCurrentTimeSec(0);
      setIsPlaying(true);
      return;
    }

    // Module 5: Record telemetry skip event on manual user skip
    if (currentTrack) {
      telemetryClient.recordSkip('user_next');
    }

    // Current active queue (shuffledQueue if shuffle active, else originalQueue)
    const activeQ = isShuffle ? (shuffledQueue.length > 0 ? shuffledQueue : originalQueue) : originalQueue;
    // Filter out any disliked songs from the remaining queue
    const eligibleQueue = activeQ.filter((t) => !personalizationService.isDisliked(t.id));

    if (eligibleQueue.length > 0) {
      // 1. Play next item in queue
      const nextTrack = eligibleQueue[0];
      const remainingActive = eligibleQueue.slice(1);

      // Save currentTrack into pastQueue stack
      if (currentTrack) {
        setPastQueue((prev) => [...prev.filter((t) => !areTracksEqual(t, currentTrack)), currentTrack].slice(-50));
      }
      
      // Update both originalQueue and shuffledQueue to maintain state
      if (isShuffle) {
        setShuffledQueue(remainingActive);
        setOriginalQueue((prev) => prev.filter((t) => !areTracksEqual(t, nextTrack)));
      } else {
        setOriginalQueue(remainingActive);
        setShuffledQueue([]);
      }

      // 2. If queue is nearly finished (<= 3 items), generate more recommendations
      // 3. Avoid duplicates
      // 4. Preserve playback context
      if (isInfiniteAutoPlay && remainingActive.length <= 3) {
        const fullHistory = [nextTrack, currentTrack, ...playbackHistory].filter(Boolean) as Track[];
        personalizationService.generatePersonalizedQueue(nextTrack, tracks, fullHistory, playbackContext).then((moreTracks) => {
          if (moreTracks && moreTracks.length > 0) {
            const existingKeys = new Set([
              getSongDeduplicationKey(nextTrack),
              getSongDeduplicationKey(currentTrack),
              ...pastQueue.map((t) => getSongDeduplicationKey(t)),
              ...originalQueue.map((t) => getSongDeduplicationKey(t)),
              ...shuffledQueue.map((t) => getSongDeduplicationKey(t))
            ]);
            const newTracks = moreTracks.filter((t) => 
              !existingKeys.has(getSongDeduplicationKey(t)) && 
              !personalizationService.isDisliked(t.id)
            );
            if (newTracks.length > 0) {
              setOriginalQueue((prev) => [...prev, ...newTracks]);
              if (isShuffle) {
                setShuffledQueue((prev) => [...prev, ...smartShuffle(newTracks, nextTrack)]);
              }
            }
          }
        });
      }
      
      handleSelectTrack(nextTrack, true, remainingActive, playbackContext);
    } else if (repeatMode === 'all') {
      // Repeat Queue: End of queue reached, restart queue from beginning!
      const sourceList = playbackContext.sourceTracks && playbackContext.sourceTracks.length > 0
        ? playbackContext.sourceTracks
        : (pastQueue.length > 0 ? [...pastQueue, ...(currentTrack ? [currentTrack] : [])] : tracks);

      if (sourceList.length > 0) {
        const startTrack = sourceList[0];
        const remaining = sourceList.slice(1);
        if (isShuffle) {
          const randomized = smartShuffle(remaining, startTrack);
          setShuffledQueue(randomized);
          setOriginalQueue(remaining);
          handleSelectTrack(startTrack, true, randomized, playbackContext);
        } else {
          setShuffledQueue([]);
          setOriginalQueue(remaining);
          handleSelectTrack(startTrack, true, remaining, playbackContext);
        }
        setVibeToast({
          title: 'Queue Restarted',
          vibe: 'Repeating queue from beginning (Repeat Queue)'
        });
        setTimeout(() => setVibeToast(null), 2500);
      }
    } else if (isInfiniteAutoPlay) {
      // Infinite Auto-Play Radio: Seamlessly generate next contextual batch avoiding duplicates
      const baseTrack = currentTrack || tracks[0];
      if (currentTrack) {
        setPastQueue((prev) => [...prev.filter((t) => !areTracksEqual(t, currentTrack)), currentTrack].slice(-50));
      }
      const fullHistory = [baseTrack, ...playbackHistory];
      const radioNext = personalizationService.getInstantPersonalizedQueue(baseTrack, tracks, fullHistory, playbackContext)
        .filter((t) => !personalizationService.isDisliked(t.id) && !areTracksEqual(t, baseTrack));
      
      if (radioNext.length > 0) {
        const nextTrack = radioNext[0];
        const remainingRadio = radioNext.slice(1);
        setOriginalQueue(remainingRadio);
        if (isShuffle) {
          setShuffledQueue(smartShuffle(remainingRadio, nextTrack));
        } else {
          setShuffledQueue([]);
        }
        handleSelectTrack(nextTrack, true, remainingRadio, playbackContext);
        setVibeToast({
          title: 'Autoplay Radio',
          vibe: `Playing tracks in context of "${playbackContext.title || baseTrack.title}"`
        });
        setTimeout(() => setVibeToast(null), 2500);
      } else {
        const currentIndex = currentTrack ? tracks.findIndex((t) => t.id === currentTrack.id) : -1;
        const nextIndex = (currentIndex + 1) % tracks.length;
        handleSelectTrack(tracks[nextIndex], false, undefined, playbackContext);
      }
    } else {
      // Repeat off and Autoplay off: stop playback
      setIsPlaying(false);
      audioEngine.pause();
    }
  };

  const handlePrevTrack = () => {
    // PREVIOUS action logic:
    // 1. If current song has played for more than a configurable threshold (e.g. 3s), restart current song first
    const thresholdSec = settings.prevRestartThresholdSec ?? 3;
    if (currentTimeSec > thresholdSec) {
      audioEngine.seek(0);
      setCurrentTimeSec(0);
      telemetryClient.onTrackLooped();
      return;
    }

    // 2. Otherwise return to previous queue item / previous song
    if (currentTrack) {
      telemetryClient.recordSkip('user_prev');
    }

    if (pastQueue.length > 0) {
      const prevTrack = pastQueue[pastQueue.length - 1];
      setPastQueue((prev) => prev.slice(0, -1));
      
      // Prepend current track to upcoming queue so clicking Next goes forward
      if (currentTrack) {
        setOriginalQueue((prev) => [currentTrack, ...prev.filter((t) => !areTracksEqual(t, currentTrack))]);
        if (isShuffle) {
          setShuffledQueue((prev) => [currentTrack, ...prev.filter((t) => !areTracksEqual(t, currentTrack))]);
        }
      }
      
      const updatedQueue = currentTrack ? [currentTrack, ...queue.filter((t) => !areTracksEqual(t, currentTrack))] : queue;
      handleSelectTrack(prevTrack, true, updatedQueue, playbackContext, { isBackNavigation: true });
    } else if (playbackHistory.length > 1) {
      // Fallback: previous item from playback history
      const prevTrack = playbackHistory.find((t) => !areTracksEqual(t, currentTrack)) || playbackHistory[1];
      if (prevTrack) {
        if (currentTrack) {
          setOriginalQueue((prev) => [currentTrack, ...prev.filter((t) => !areTracksEqual(t, currentTrack))]);
          if (isShuffle) {
            setShuffledQueue((prev) => [currentTrack, ...prev.filter((t) => !areTracksEqual(t, currentTrack))]);
          }
        }
        const updatedQueue = currentTrack ? [currentTrack, ...queue.filter((t) => !areTracksEqual(t, currentTrack))] : queue;
        handleSelectTrack(prevTrack, true, updatedQueue, playbackContext, { isBackNavigation: true });
      } else {
        audioEngine.seek(0);
        setCurrentTimeSec(0);
      }
    } else if (playbackContext.sourceTracks && playbackContext.sourceTracks.length > 0 && currentTrack) {
      const sourceList = playbackContext.sourceTracks;
      const currentIndex = sourceList.findIndex((t) => areTracksEqual(t, currentTrack));
      if (currentIndex > 0) {
        const prevTrack = sourceList[currentIndex - 1];
        if (currentTrack) {
          setOriginalQueue((prev) => [currentTrack, ...prev.filter((t) => !areTracksEqual(t, currentTrack))]);
          if (isShuffle) {
            setShuffledQueue((prev) => [currentTrack, ...prev.filter((t) => !areTracksEqual(t, currentTrack))]);
          }
        }
        const updatedQueue = currentTrack ? [currentTrack, ...queue.filter((t) => !areTracksEqual(t, currentTrack))] : queue;
        handleSelectTrack(prevTrack, true, updatedQueue, playbackContext, { isBackNavigation: true });
      } else {
        audioEngine.seek(0);
        setCurrentTimeSec(0);
      }
    } else {
      audioEngine.seek(0);
      setCurrentTimeSec(0);
    }
  };

  // Wire OS MediaSession Lockscreen Next / Prev / Favorite buttons to internal app state
  useEffect(() => {
    audioEngine.setExternalControls(
      () => handleNextTrack(),
      () => handlePrevTrack()
    );

    mediaSessionService.registerCallbacks({
      onNext: () => handleNextTrack(),
      onPrevious: () => handlePrevTrack(),
      onToggleFavorite: () => {
        if (currentTrack) {
          handleToggleFavorite(currentTrack.id);
        }
      }
    });
  }, [currentTrack, queue, pastQueue, playbackHistory, currentTimeSec, settings.prevRestartThresholdSec, playbackContext, isInfiniteAutoPlay, repeatMode, isShuffle]);

  const handlePlayFromQueue = (track: Track, index: number) => {
    if (isShuffle) {
      const remainingShuffled = shuffledQueue.slice(index + 1);
      setShuffledQueue(remainingShuffled);
      setOriginalQueue((prev) => prev.filter((t) => !areTracksEqual(t, track)));
      handleSelectTrack(track, true, remainingShuffled, playbackContext);
    } else {
      const remainingOriginal = originalQueue.slice(index + 1);
      setOriginalQueue(remainingOriginal);
      setShuffledQueue([]);
      handleSelectTrack(track, true, remainingOriginal, playbackContext);
    }
  };

  const handleRemoveFromQueue = (index: number) => {
    if (isShuffle) {
      const targetTrack = shuffledQueue[index];
      setShuffledQueue((prev) => prev.filter((_, i) => i !== index));
      if (targetTrack) {
        setOriginalQueue((prev) => prev.filter((t) => !areTracksEqual(t, targetTrack)));
      }
    } else {
      const targetTrack = originalQueue[index];
      setOriginalQueue((prev) => prev.filter((_, i) => i !== index));
      if (targetTrack) {
        setShuffledQueue((prev) => prev.filter((t) => !areTracksEqual(t, targetTrack)));
      }
    }
  };

  const handleReorderQueue = (startIndex: number, endIndex: number) => {
    if (isShuffle) {
      setShuffledQueue((prev) => {
        const updated = [...prev];
        const [moved] = updated.splice(startIndex, 1);
        updated.splice(endIndex, 0, moved);
        return updated;
      });
    } else {
      setOriginalQueue((prev) => {
        const updated = [...prev];
        const [moved] = updated.splice(startIndex, 1);
        updated.splice(endIndex, 0, moved);
        return updated;
      });
    }
  };

  const handlePlayNext = (track: Track) => {
    setOriginalQueue((prev) => [track, ...prev.filter((t) => !areTracksEqual(t, track))]);
    setShuffledQueue((prev) => [track, ...prev.filter((t) => !areTracksEqual(t, track))]);
    setVibeToast({
      title: 'Playing Next',
      vibe: `"${track.title}" placed at top of queue`
    });
    setTimeout(() => setVibeToast(null), 2200);
  };

  const handleAddToQueue = (track: Track) => {
    setOriginalQueue((prev) => [...prev.filter((t) => !areTracksEqual(t, track)), track]);
    setShuffledQueue((prev) => [...prev.filter((t) => !areTracksEqual(t, track)), track]);
    setVibeToast({
      title: 'Added to Queue',
      vibe: `"${track.title}" added to queue`
    });
    setTimeout(() => setVibeToast(null), 2200);
  };

  const handleClearQueue = () => {
    setOriginalQueue([]);
    setShuffledQueue([]);
    setVibeToast({
      title: 'Queue Cleared',
      vibe: 'All upcoming tracks removed'
    });
    setTimeout(() => setVibeToast(null), 2200);
  };

  const handleShuffleQueue = () => {
    const base = originalQueue.length > 0 ? originalQueue : queue;
    const randomized = smartShuffle(base, currentTrack);
    setShuffledQueue(randomized);
    setIsShuffle(true);
    setVibeToast({
      title: 'Queue Shuffled',
      vibe: 'Upcoming tracks randomized intelligently'
    });
    setTimeout(() => setVibeToast(null), 2200);
  };

  const handlePrioritizeQueue = () => {
    if (!currentTrack) return;
    const base = isShuffle ? shuffledQueue : originalQueue;
    if (base.length === 0) return;
    const prioritized = personalizationService.prioritizeQueue(base, currentTrack);
    if (isShuffle) {
      setShuffledQueue(prioritized);
    } else {
      setOriginalQueue(prioritized);
    }
    setVibeToast({
      title: 'Queue Prioritized',
      vibe: '1. Artist • 2. Genre • 3. Language'
    });
    setTimeout(() => setVibeToast(null), 2500);
  };

  const handleToggleShuffle = () => {
    setIsShuffle((prev) => {
      const next = !prev;
      if (next) {
        // Intelligently randomize originalQueue without destroying it
        const base = originalQueue.length > 0 ? originalQueue : queue;
        const randomized = smartShuffle(base, currentTrack);
        setShuffledQueue(randomized);
        setVibeToast({
          title: 'Shuffle On',
          vibe: 'Intelligently randomized queue'
        });
      } else {
        // Turning shuffle off restores predictable originalQueue
        setShuffledQueue([]);
        setVibeToast({
          title: 'Shuffle Off',
          vibe: 'Original queue order restored'
        });
      }
      setTimeout(() => setVibeToast(null), 2400);
      return next;
    });
  };

  const handleToggleInfiniteAutoPlay = () => {
    setIsInfiniteAutoPlay((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('vd_infinite_autoplay', JSON.stringify(next));
      } catch {}
      setVibeToast({
        title: next ? 'Infinite Auto-Play On' : 'Infinite Auto-Play Off',
        vibe: next ? 'Radio continues automatically when queue ends' : 'Playback stops when queue ends'
      });
      setTimeout(() => setVibeToast(null), 2400);
      return next;
    });
  };

  const handleSeek = (seconds: number) => {
    setCurrentTimeSec(seconds);
    audioEngine.seek(seconds);
  };

  const handlePlayMix = (mix: MusicMix) => {
    const mixTracks = tracks.filter((t) => mix.trackIds.includes(t.id));
    if (mixTracks.length > 0) {
      handlePlayQueue(mixTracks, 0, {
        type: 'mix',
        id: mix.id,
        title: mix.title,
        sourceTracks: mixTracks
      });
    }
  };

  const handlePlayVideoAudioOnly = (video: MusicVideoItem) => {
    const matchingTrack = tracks.find((t) => t.videoId === video.videoId || t.id === video.trackId);
    if (matchingTrack) {
      handleSelectTrack(matchingTrack);
    } else {
      const syntheticTrack: Track = {
        id: `vid-track-${video.videoId}`,
        title: video.title,
        artist: video.artist,
        album: 'YouTube Music Video',
        duration: video.duration,
        durationSec: 220,
        coverUrl: video.thumbnailUrl,
        videoId: video.videoId,
        quality: '320kbps High-Res Audio'
      };
      handleSelectTrack(syntheticTrack);
    }
  };

  const handleToggleFavorite = (trackId: string) => {
    let isNowFav = false;

    setFavoriteTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
        isNowFav = false;
      } else {
        next.add(trackId);
        isNowFav = true;
      }
      try {
        localStorage.setItem('vd_favorite_track_ids', JSON.stringify(Array.from(next)));
      } catch {}

      // Module 4: Instantly sync liked track to user account database in real-time
      realtimeSyncService.syncLike(trackId, isNowFav);
      return next;
    });

    setTracks((prev) => {
      const exists = prev.some((t) => t.id === trackId);
      if (!exists && currentTrack?.id === trackId) {
        return [{ ...currentTrack, isFavorite: isNowFav }, ...prev];
      }
      return prev.map((t) => (t.id === trackId ? { ...t, isFavorite: isNowFav } : t));
    });

    if (currentTrack?.id === trackId) {
      setCurrentTrack((prev) => (prev ? { ...prev, isFavorite: isNowFav } : null));
      mediaSessionService.updateFavoriteState(isNowFav);
    }

    // Weighting Algorithm: Record Like/Dislike in taste profile
    personalizationService.toggleLike(trackId, isNowFav);

    setPersonalizedHome((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        quickPicks: prev.quickPicks.map((t) => (t.id === trackId ? { ...t, isFavorite: isNowFav } : t)),
        basedOnSection: {
          ...prev.basedOnSection,
          tracks: prev.basedOnSection.tracks.map((t) => (t.id === trackId ? { ...t, isFavorite: isNowFav } : t))
        }
      };
    });

    setVibeToast({
      title: isNowFav ? 'Added to Favorites' : 'Removed from Favorites',
      vibe: isNowFav ? 'Song saved in your library ❤️' : 'Song removed from library'
    });
    setTimeout(() => setVibeToast(null), 2400);
  };

  const handleToggleDislike = (trackId: string) => {
    personalizationService.toggleDislike(trackId);
    setOriginalQueue((prev) => prev.filter((t) => t.id !== trackId));
    setShuffledQueue((prev) => prev.filter((t) => t.id !== trackId));
    setPersonalizedHome(personalizationService.generatePersonalizedHome(currentTrack, tracks));
  };

  const handleToggleRepeat = () => {
    setRepeatMode((prev) => {
      let next: RepeatMode = 'off';
      if (prev === 'off') next = 'all';
      else if (prev === 'all') next = 'one';
      else next = 'off';

      if (next === 'all') {
        setVibeToast({
          title: 'Repeat Queue',
          vibe: 'Queue will loop continuously after the last track'
        });
      } else if (next === 'one') {
        setVibeToast({
          title: 'Repeat One',
          vibe: 'Current track will loop continuously'
        });
      } else {
        setVibeToast({
          title: 'Repeat Off',
          vibe: 'Continuous normal queue progression'
        });
      }
      setTimeout(() => setVibeToast(null), 2400);
      return next;
    });
  };

  const handleClearHistory = () => {
    historyService.clearHistory();
    setPlaybackHistory([]);
    setVibeToast({
      title: 'History Cleared',
      vibe: 'Listening history removed from device'
    });
    setTimeout(() => setVibeToast(null), 2200);
  };

  const handleRemoveFromHistory = (trackId: string) => {
    historyService.removeEntry(trackId);
    setPlaybackHistory(historyService.getHistoryTracks());
  };

  const handleUpdateSettings = (newSettings: Partial<SettingsState>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  // MediaSession API Synchronization (Lock screen, notifications, and background media keys)
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    if (!currentTrack) {
      navigator.mediaSession.playbackState = 'none';
      return;
    }

    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || 'Streamzy',
        artwork: [
          { src: currentTrack.coverUrl || '/streamzy_logo.jpg', sizes: '96x96', type: 'image/jpeg' },
          { src: currentTrack.coverUrl || '/streamzy_logo.jpg', sizes: '128x128', type: 'image/jpeg' },
          { src: currentTrack.coverUrl || '/streamzy_logo.jpg', sizes: '192x192', type: 'image/jpeg' },
          { src: currentTrack.coverUrl || '/streamzy_logo.jpg', sizes: '512x512', type: 'image/jpeg' },
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        setIsPlaying(true);
        audioEngine.resume();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        setIsPlaying(false);
        audioEngine.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        handlePrevTrack();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        handleNextTrack();
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && !isNaN(details.seekTime)) {
          audioEngine.seek(details.seekTime);
          setCurrentTimeSec(Math.floor(details.seekTime));
        }
      });
    } catch (e) {
      console.warn('MediaSession sync issue:', e);
    }
  }, [currentTrack, isPlaying]);

  const handleAllowBackgroundPermission = async () => {
    try {
      localStorage.setItem('vd_background_playback_permission', 'granted');
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch {}
    await audioEngine.enableBackgroundPlayback();
    setSettings((prev) => ({ ...prev, backgroundPlayback: true }));
    setShowBackgroundPermission(false);
    setVibeToast({ title: 'Background Audio', vibe: 'Screen-Off Audio Enabled' });
    setTimeout(() => setVibeToast(null), 3000);
  };

  const handleDismissBackgroundPermission = () => {
    try {
      localStorage.setItem('vd_background_playback_permission', 'dismissed');
    } catch {}
    setShowBackgroundPermission(false);
  };

  return (
    <div className={`h-screen w-full flex flex-col overflow-hidden selection:bg-[var(--color-primary)]/20 selection:text-[var(--color-primary)] ${settings.pureBlackAmoled ? 'bg-black text-[#e4e1e7]' : 'bg-transparent text-[#e4e1e7]'}`}>
      {/* Global Transparent Glassmorphism Background */}
      {!settings.pureBlackAmoled && (
        <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden bg-black">
          <img 
            src={currentTrack?.coverUrl || TRACKS[0].coverUrl} 
            alt="Global Background" 
            className="w-full h-full object-cover blur-[140px] opacity-55 scale-125 saturate-[1.6] transition-all duration-1000 ease-in-out"
          />
          <div className="absolute inset-0 bg-black/60"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-transparent to-black/95"></div>
        </div>
      )}

      {/* Top Header with Glass Backdrop */}
      <Header
        activeScreen={activeScreen}
        userName={userName}
        onOpenSettings={() => setActiveScreen('settings')}
      />

      {/* Main Content Area - calculated padding ensures top content is never hidden behind header */}
      <main className="flex-1 w-full overflow-y-auto overflow-x-hidden pt-[calc(max(env(safe-area-inset-top,0px),36px)+64px)] pb-36">
        {/* Real-time Network Offline & Encrypted Vault Ribbon */}
        <NetworkOfflineBanner onOpenDownloads={() => setActiveScreen('library')} />

        <Suspense fallback={<div className="flex w-full h-full items-center justify-center pt-24"><Loader2 size={36} className="text-red-500 animate-spin" /></div>}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeScreen}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
              className="w-full min-h-full gpu-layer"
            >
              {activeScreen === 'home' && (
                <HomeScreen
                  tracks={activeDisplayTracks}
                  favoriteTrackIds={favoriteTrackIds}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  personalizedData={personalizedHome || undefined}
                  playbackHistory={playbackHistory}
                  userName={userName}
                  onSelectTrack={handleSelectTrack}
                  onTogglePlay={handleTogglePlay}
                  onToggleFavorite={handleToggleFavorite}
                  onOpenVideo={setActiveVideo}
                  onPlayMix={handlePlayMix}
                  onOpenColdStart={() => setIsOnboardingOpen(true)}
                  onNavigateToSearch={(query, source) => {
                    if (query !== undefined) setSearchQuery(query);
                    if (source) setSearchSource(source as any);
                    setActiveScreen('search');
                  }}
                />
              )}

              {activeScreen === 'search' && (
                <SearchScreen
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onSelectTrack={handleSelectTrack}
                  onPlayMix={handlePlayMix}
                  onPlayQueue={handlePlayQueue}
                  initialQuery={searchQuery}
                  initialSource={searchSource}
                  onAddToQueue={handleAddToQueue}
                  onPlayNext={handlePlayNext}
                  onToggleFavorite={handleToggleFavorite}
                  favoriteTrackIds={favoriteTrackIds}
                />
              )}

              {activeScreen === 'library' && (
                <LibraryScreen
                  tracks={activeDisplayTracks}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  settings={settings}
                  playbackHistory={playbackHistory}
                  onClearHistory={handleClearHistory}
                  onRemoveFromHistory={handleRemoveFromHistory}
                  onSelectTrack={handleSelectTrack}
                  onPlayQueue={handlePlayQueue}
                  onTogglePlay={handleTogglePlay}
                  onToggleFavorite={handleToggleFavorite}
                />
              )}

              {activeScreen === 'plugins' && (
                <PluginsScreen />
              )}

              {activeScreen === 'settings' && (
                <SettingsScreen
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onBack={() => setActiveScreen('home')}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  currentTimeSec={currentTimeSec}
                  onTogglePlay={handleTogglePlay}
                  onNextTrack={handleNextTrack}
                  onPrevTrack={handlePrevTrack}
                  onToggleFavorite={handleToggleFavorite}
                  onSeek={handleSeek}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </main>

      {/* Persistent Mini Player Dock */}
      <AnimatePresence>
        {currentTrack && (
          <MiniPlayer
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            currentTimeSec={currentTimeSec}
            onTogglePlay={handleTogglePlay}
            onNextTrack={handleNextTrack}
            onOpenNowPlaying={() => setIsNowPlayingOpen(true)}
          />
        )}
      </AnimatePresence>

      {/* Bottom Navigation with Frosted Blur */}
      <BottomNav
        activeScreen={activeScreen}
        onSelectScreen={(screen) => setActiveScreen(screen)}
      />

      {/* Fullscreen Now Playing Overlay */}
      <AnimatePresence>
        {isNowPlayingOpen && currentTrack && (
          <NowPlayingScreen
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            currentTimeSec={currentTimeSec}
            settings={settings}
            queue={queue}
            currentVibe={activeVibe}
            isShuffle={isShuffle}
            onToggleShuffle={handleToggleShuffle}
            repeatMode={repeatMode}
            onToggleRepeat={handleToggleRepeat}
            onSelectTrack={handleSelectTrack}
            onPlayFromQueue={handlePlayFromQueue}
            onRemoveFromQueue={handleRemoveFromQueue}
            onReorderQueue={handleReorderQueue}
            onPlayNext={handlePlayNext}
            onAddToQueue={handleAddToQueue}
            onClearQueue={handleClearQueue}
            onShuffleQueue={handleShuffleQueue}
            onPrioritizeQueue={handlePrioritizeQueue}
            isInfiniteAutoPlay={isInfiniteAutoPlay}
            onToggleInfiniteAutoPlay={handleToggleInfiniteAutoPlay}
            radioTracks={radioTracks}
            onTogglePlay={handleTogglePlay}
            onNextTrack={handleNextTrack}
            onPrevTrack={handlePrevTrack}
            onSeek={handleSeek}
            onClose={() => setIsNowPlayingOpen(false)}
            onToggleFavorite={handleToggleFavorite}
            onToggleDislike={handleToggleDislike}
            onUpdateSettings={handleUpdateSettings}
          />
        )}
      </AnimatePresence>

      {/* Cold Start Recommendation Algorithm Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={() => {
          setIsOnboardingOpen(false);
          const homeData = personalizationService.generatePersonalizedHome(currentTrack, tracks);
          setPersonalizedHome(homeData);
          setVibeToast({
            title: 'Algorithm Calibrated',
            vibe: 'Generated custom Supermix, Discover Mix & New Releases!'
          });
          setTimeout(() => setVibeToast(null), 3000);
        }}
      />

      {/* Bloomee Sleep Timer Modal */}
      <SleepTimerModal
        isOpen={isSleepTimerOpen}
        onClose={() => setIsSleepTimerOpen(false)}
        remainingMinutes={settings.sleepTimerRemaining || null}
        onSetTimer={(mins) => {
          handleUpdateSettings({ sleepTimerRemaining: mins });
        }}
        onCancelTimer={() => {
          handleUpdateSettings({ sleepTimerRemaining: 0 });
        }}
      />

      {/* YouTube Music Video Playback Modal */}
      {activeVideo && (
        <MusicVideoModal
          video={activeVideo}
          onClose={() => setActiveVideo(null)}
          onPlayAudioOnly={handlePlayVideoAudioOnly}
        />
      )}

      {!userName && (
        <PlanScreen 
          onComplete={(name) => {
            setUserName(name);
            localStorage.setItem('vd_user_name', name);
          }}
        />
      )}

      {/* Animated App Boot Splash Screen */}
      <BootSplashScreen />
    </div>
  );
}
