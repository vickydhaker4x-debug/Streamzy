package com.vdmusic.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import androidx.media.session.MediaButtonReceiver;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;

import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Dedicated Foreground Media Playback Service for VD Music on Android.
 * Uses AndroidX Media3 ExoPlayer, MediaSessionCompat, and AndroidX MediaStyle Notification.
 * Survives app backgrounding, screen locks, and app switching.
 * Manages native queue transitions automatically without requiring WebView execution.
 */
public class MediaNotificationService extends Service implements Player.Listener {
    private static final String TAG = "VDMediaService";

    public static final String CHANNEL_ID = "vd_music_playback_channel";
    public static final int NOTIFICATION_ID = 2001;

    public static final String ACTION_PLAY = "com.vdmusic.player.ACTION_PLAY";
    public static final String ACTION_PAUSE = "com.vdmusic.player.ACTION_PAUSE";
    public static final String ACTION_NEXT = "com.vdmusic.player.ACTION_NEXT";
    public static final String ACTION_PREV = "com.vdmusic.player.ACTION_PREV";
    public static final String ACTION_STOP = "com.vdmusic.player.ACTION_STOP";

    private final IBinder binder = new LocalBinder();

    // Media and Playback Components
    private ExoPlayer exoPlayer;
    private MediaSessionCompat mediaSession;
    private NotificationManager notificationManager;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    // Queue and State Management
    private final List<NativeTrack> queue = new ArrayList<>();
    private final List<NativeTrack> originalQueue = new ArrayList<>();
    private int currentIndex = 0;
    private NativeTrack currentTrack = null;
    private String repeatMode = "all"; // "off", "all", "one"
    private boolean isShuffle = false;
    private boolean isForegroundRunning = false;
    private long playbackGeneration = 0;
    private String lastFailedTrackId = null;

    // Artwork Cache
    private String lastCoverUrl = null;
    private Bitmap cachedBitmap = null;

    private final Handler playerHandler = new Handler(Looper.getMainLooper());
    private final Handler mainHandler = playerHandler;
    private boolean isTrackingPosition = false;

    private void runOnPlayerThread(Runnable action) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            action.run();
        } else {
            playerHandler.post(action);
        }
    }

    // Event Listener for Capacitor Bridge
    public interface ServiceEventListener {
        void onPlaybackStarted(NativeTrack track, long positionSec, long durationSec);
        void onPlaybackPaused(NativeTrack track, long positionSec);
        void onPlaybackStopped();
        void onTrackChanged(NativeTrack track, int currentIndex, long durationSec);
        void onPlaybackPosition(long positionSec, long durationSec);
        void onPlaybackError(String message);
        void onQueueChanged(int currentIndex);
        void onPlaybackCompleted(NativeTrack track);
    }

    private ServiceEventListener eventListener;

    public class LocalBinder extends Binder {
        public MediaNotificationService getService() {
            return MediaNotificationService.this;
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Creating MediaNotificationService");

        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();

        initLocks();
        initExoPlayer();
        initMediaSession();
    }

    private void initLocks() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "vdmusic:playback_wakelock");
                wakeLock.setReferenceCounted(false);
            }
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "vdmusic:playback_wifilock");
                wifiLock.setReferenceCounted(false);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error acquiring wake/wifi locks: " + e.getMessage());
        }
    }

    private void acquireWakeLocks() {
        try {
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(12 * 60 * 60 * 1000L); // 12 hours max
            }
            if (wifiLock != null && !wifiLock.isHeld()) {
                wifiLock.acquire();
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to acquire locks: " + e.getMessage());
        }
    }

    private void releaseWakeLocks() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to release locks: " + e.getMessage());
        }
    }

    private void initExoPlayer() {
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA)
                .build();

        DefaultHttpDataSource.Factory httpDataSourceFactory = new DefaultHttpDataSource.Factory()
                .setUserAgent("Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36")
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(8000)
                .setReadTimeoutMs(10000);

        DefaultDataSource.Factory dataSourceFactory = new DefaultDataSource.Factory(this, httpDataSourceFactory);
        DefaultMediaSourceFactory mediaSourceFactory = new DefaultMediaSourceFactory(dataSourceFactory);

        exoPlayer = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(mediaSourceFactory)
                .setAudioAttributes(audioAttributes, true) // AudioFocus handled automatically!
                .setWakeMode(C.WAKE_MODE_NETWORK)
                .setHandleAudioBecomingNoisy(true) // Pauses automatically when headphones disconnected!
                .build();

        exoPlayer.addListener(this);
    }

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, "VDMusicMediaSession");
        mediaSession.setActive(true);

        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                resumePlayback();
            }

            @Override
            public void onPause() {
                pausePlayback();
            }

            @Override
            public void onSkipToNext() {
                playNext();
            }

            @Override
            public void onSkipToPrevious() {
                playPrevious();
            }

            @Override
            public void onSeekTo(long pos) {
                seekTo(pos / 1000);
            }

            @Override
            public void onStop() {
                stopPlayback();
            }

            @Override
            public boolean onMediaButtonEvent(Intent mediaButtonEvent) {
                return super.onMediaButtonEvent(mediaButtonEvent);
            }
        });

        updatePlaybackState(PlaybackStateCompat.STATE_NONE, 0);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "VD Music Playback",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows active playback controls on lockscreen and notification bar.");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            MediaButtonReceiver.handleIntent(mediaSession, intent);

            String action = intent.getAction();
            if (ACTION_PLAY.equals(action)) {
                resumePlayback();
            } else if (ACTION_PAUSE.equals(action)) {
                pausePlayback();
            } else if (ACTION_NEXT.equals(action)) {
                playNext();
            } else if (ACTION_PREV.equals(action)) {
                playPrevious();
            } else if (ACTION_STOP.equals(action)) {
                stopPlayback();
            }
        }
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        Log.d(TAG, "onTaskRemoved: user swiped app from Recents. Checking playback status...");
        // Keep foreground service playing music if user has not explicitly stopped
        if (isPlaying() || isForegroundRunning) {
            Log.d(TAG, "Playback active: maintaining foreground service across app swipe.");
        } else {
            stopPlayback();
            stopSelf();
        }
    }

    public boolean isNetworkConnected() {
        try {
            android.net.ConnectivityManager cm = (android.net.ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                android.net.NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
                return activeNetwork != null && activeNetwork.isConnected();
            }
        } catch (Exception ignored) {}
        return true;
    }

    public void setEventListener(ServiceEventListener listener) {
        this.eventListener = listener;
    }

    // ==========================================
    // Core Playback Controls
    // ==========================================

    public void playTrack(NativeTrack track, @Nullable String streamUrl, @Nullable List<NativeTrack> newQueue, int newIndex) {
        playTrack(track, streamUrl, newQueue, newIndex, null);
    }

    public void playTrack(NativeTrack track, @Nullable String streamUrl, @Nullable List<NativeTrack> newQueue, int newIndex, @Nullable String mimeType) {
        if (track == null) return;
        this.currentTrack = track;

        if (newQueue != null && !newQueue.isEmpty()) {
            this.originalQueue.clear();
            this.originalQueue.addAll(newQueue);
            this.queue.clear();
            this.queue.addAll(newQueue);
            this.currentIndex = Math.max(0, Math.min(newIndex, queue.size() - 1));
        }

        final long generation = ++playbackGeneration;

        // 1. Check if track exists in the native offline vault first!
        try {
            File offlineDir = new File(getFilesDir(), "offline_vault");
            String safeId = track.getId().replaceAll("[^a-zA-Z0-9_-]", "_");
            File offlineFile = new File(offlineDir, safeId + ".audio");
            if (offlineFile.exists() && offlineFile.length() > 1024) {
                String localUri = Uri.fromFile(offlineFile).toString();
                Log.d(TAG, "[VDMUSIC_PLAY] Found local offline vault audio: " + localUri + " (size: " + offlineFile.length() + ")");
                executePlayUrl(localUri, track, mimeType != null ? mimeType : "audio/mp4", generation);
                return;
            }
        } catch (Exception e) {
            Log.w(TAG, "Error checking offline vault file: " + e.getMessage());
        }

        // 2. If a direct streamUrl or audioUrl is already provided (remote https, file://, or content://)
        String directPlayable = (streamUrl != null && !streamUrl.trim().isEmpty())
                ? streamUrl
                : (track.getAudioUrl() != null && !track.getAudioUrl().trim().isEmpty())
                ? track.getAudioUrl()
                : (track.getStreamUrl() != null && !track.getStreamUrl().trim().isEmpty())
                ? track.getStreamUrl()
                : null;

        // Never treat an iTunes preview or 30-second sample as a full song
        if (directPlayable != null && (
                directPlayable.contains("AudioPreview") ||
                directPlayable.contains("previewUrl") ||
                directPlayable.contains("itunes.apple.com") ||
                directPlayable.contains("audio-ssl")
        )) {
            Log.w(TAG, "[VDMUSIC_PLAY] Detected 30-second preview URL, resolving full-length audio stream instead: " + directPlayable);
            directPlayable = null;
        }

        if (directPlayable != null) {
            Log.d(TAG, "[VDMUSIC_PLAY] generation=" + generation + " songId=" + track.getId() + " directPlayable provided: " + directPlayable);
            executePlayUrl(directPlayable, track, mimeType != null ? mimeType : "audio/mp4", generation);
            return;
        }

        // 3. If no stream URL, check if device is offline before attempting network
        if (!isNetworkConnected()) {
            Log.w(TAG, "[VDMUSIC_PLAY] Offline and no local cached file for track: " + track.getTitle());
            if (eventListener != null) {
                eventListener.onPlaybackError("This song is not available offline. Please download it or connect to the internet.");
            }
            return;
        }

        // 4. Resolve stream URL from online endpoints with fallback
        Log.d(TAG, "[VDMUSIC_PLAY] generation=" + generation + " songId=" + track.getId() + " resolving stream via parallel endpoints & fallback...");
        StreamResolver.resolveWithFallbackAsync(track.getVideoId(), track.getTitle(), track.getArtist(), new StreamResolver.StreamCallback() {
            @Override
            public void onResolved(StreamResolver.ResolvedStream stream) {
                mainHandler.post(() -> {
                    if (generation != playbackGeneration) {
                        Log.d(TAG, "[VDMUSIC_STALE] ignored=true generation=" + generation);
                        return;
                    }
                    track.setStreamUrl(stream.url);
                    Log.d(TAG, "[VDMUSIC_PLAY] generation=" + generation + " songId=" + track.getId() + " resolved mime=" + stream.mimeType);
                    executePlayUrl(stream.url, track, stream.mimeType, generation);
                });
            }

            @Override
            public void onError(String error) {
                Log.e(TAG, "Stream resolution failed: " + error);
                mainHandler.post(() -> {
                    if (generation != playbackGeneration) return;
                    if (eventListener != null) {
                        eventListener.onPlaybackError("Failed to resolve stream: " + error);
                    }
                });
            }
        });
    }

    private void executePlayUrl(String url, NativeTrack track, @Nullable String mimeType, long generation) {
        runOnPlayerThread(() -> {
            try {
                acquireWakeLocks();

                Log.d(TAG, "[VDMUSIC_MEDIA] newMediaItem=true generation=" + generation + " mimeType=" + mimeType);

                // Fully reset the previous decoder/source before attaching a new stream.
                // This avoids a bad decoder state surviving a restart/re-selection.
                if (exoPlayer != null) {
                    exoPlayer.pause();
                    exoPlayer.stop();
                    exoPlayer.clearMediaItems();
                    exoPlayer.seekTo(0, 0L);

                    MediaItem.Builder mediaBuilder = new MediaItem.Builder()
                            .setUri(Uri.parse(url));

                    if (mimeType != null && !mimeType.trim().isEmpty()) {
                        String cleanMime = mimeType.trim();
                        if (cleanMime.contains(";")) {
                            cleanMime = cleanMime.split(";")[0].trim();
                        }
                        mediaBuilder.setMimeType(cleanMime);
                    }

                    MediaItem mediaItem = mediaBuilder.build();
                    exoPlayer.setMediaItem(mediaItem, true);
                    exoPlayer.prepare();
                    exoPlayer.play();
                }

                updateMediaSessionMetadata(track);
                startForegroundWithNotification(true);
                startPositionTracker();

                if (eventListener != null) {
                    eventListener.onTrackChanged(track, currentIndex, track.getDurationSec());
                    eventListener.onPlaybackStarted(track, 0, track.getDurationSec());
                }
            } catch (Exception e) {
                Log.e(TAG, "Error playing media URL: " + e.getMessage(), e);
                if (eventListener != null) {
                    eventListener.onPlaybackError(e.getMessage());
                }
            }
        });
    }

    public void pausePlayback() {
        runOnPlayerThread(() -> {
            if (exoPlayer != null && exoPlayer.isPlaying()) {
                exoPlayer.pause();
            }
            stopPositionTracker();
            updatePlaybackState(PlaybackStateCompat.STATE_PAUSED, getCurrentPositionMs());
            startForegroundWithNotification(false);

            if (eventListener != null && currentTrack != null) {
                eventListener.onPlaybackPaused(currentTrack, getCurrentPositionMs() / 1000);
            }
        });
    }

    public void resumePlayback() {
        runOnPlayerThread(() -> {
            if (exoPlayer != null) {
                acquireWakeLocks();
                exoPlayer.play();
                updatePlaybackState(PlaybackStateCompat.STATE_PLAYING, getCurrentPositionMs());
                startForegroundWithNotification(true);
                startPositionTracker();

                if (eventListener != null && currentTrack != null) {
                    eventListener.onPlaybackStarted(currentTrack, getCurrentPositionMs() / 1000, currentTrack.getDurationSec());
                }
            }
        });
    }

    public void stopPlayback() {
        runOnPlayerThread(() -> {
            stopPositionTracker();
            if (exoPlayer != null) {
                exoPlayer.pause();
                exoPlayer.stop();
                exoPlayer.clearMediaItems();
            }
            releaseWakeLocks();
            updatePlaybackState(PlaybackStateCompat.STATE_STOPPED, 0);

            if (isForegroundRunning) {
                stopForeground(true);
                isForegroundRunning = false;
            }

            Log.d(TAG, "[VDMUSIC_STOP] mediaCleared=true");

            if (eventListener != null) {
                eventListener.onPlaybackStopped();
            }
        });
    }

    public void seekTo(long positionSec) {
        runOnPlayerThread(() -> {
            if (exoPlayer != null) {
                exoPlayer.seekTo(positionSec * 1000L);
                updatePlaybackState(exoPlayer.isPlaying() ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, positionSec * 1000L);
                if (eventListener != null) {
                    eventListener.onPlaybackPosition(positionSec, getDurationMs() / 1000);
                }
            }
        });
    }

    public void playNext() {
        if (queue.isEmpty()) return;

        if (currentIndex + 1 < queue.size()) {
            currentIndex++;
            playTrackAtIndex(currentIndex);
        } else if ("all".equalsIgnoreCase(repeatMode)) {
            currentIndex = 0;
            playTrackAtIndex(currentIndex);
        } else {
            stopPlayback();
        }
    }

    public void playPrevious() {
        if (queue.isEmpty()) return;

        // If played more than 3 seconds, replay current track
        if (getCurrentPositionMs() > 3000) {
            seekTo(0);
            return;
        }

        if (currentIndex - 1 >= 0) {
            currentIndex--;
            playTrackAtIndex(currentIndex);
        } else if ("all".equalsIgnoreCase(repeatMode)) {
            currentIndex = queue.size() - 1;
            playTrackAtIndex(currentIndex);
        } else {
            seekTo(0);
        }
    }

    private void playTrackAtIndex(int index) {
        if (index < 0 || index >= queue.size()) return;
        NativeTrack track = queue.get(index);
        this.currentIndex = index;
        // Pass null streamUrl so playTrack always resolves a fresh stream URL
        playTrack(track, null, null, index);

        if (eventListener != null) {
            eventListener.onQueueChanged(index);
        }
    }

    // ==========================================
    // Queue & Mode Management
    // ==========================================

    public void setQueue(List<NativeTrack> newQueue, int newIndex, String repeat, boolean shuffle) {
        this.originalQueue.clear();
        this.originalQueue.addAll(newQueue);
        this.repeatMode = (repeat != null) ? repeat : "all";
        this.isShuffle = shuffle;

        this.queue.clear();
        if (shuffle && !newQueue.isEmpty()) {
            NativeTrack current = (newIndex >= 0 && newIndex < newQueue.size()) ? newQueue.get(newIndex) : newQueue.get(0);
            List<NativeTrack> shuffled = new ArrayList<>(newQueue);
            shuffled.remove(current);
            Collections.shuffle(shuffled);
            shuffled.add(0, current);
            this.queue.addAll(shuffled);
            this.currentIndex = 0;
        } else {
            this.queue.addAll(newQueue);
            this.currentIndex = Math.max(0, Math.min(newIndex, this.queue.size() - 1));
        }

        if (eventListener != null) {
            eventListener.onQueueChanged(this.currentIndex);
        }
    }

    public void setRepeatMode(String mode) {
        this.repeatMode = (mode != null) ? mode : "all";
    }

    public void setShuffleMode(boolean shuffle) {
        this.isShuffle = shuffle;
        if (currentTrack == null || originalQueue.isEmpty()) return;

        this.queue.clear();
        if (shuffle) {
            List<NativeTrack> randomized = new ArrayList<>(originalQueue);
            randomized.remove(currentTrack);
            Collections.shuffle(randomized);
            randomized.add(0, currentTrack);
            this.queue.addAll(randomized);
            this.currentIndex = 0;
        } else {
            this.queue.addAll(originalQueue);
            for (int i = 0; i < originalQueue.size(); i++) {
                if (originalQueue.get(i).getId().equals(currentTrack.getId())) {
                    this.currentIndex = i;
                    break;
                }
            }
        }

        if (eventListener != null) {
            eventListener.onQueueChanged(this.currentIndex);
        }
    }

    public void updateMetadata(NativeTrack track, boolean isFavorite) {
        if (track != null) {
            this.currentTrack = track;
            track.setFavorite(isFavorite);
            updateMediaSessionMetadata(track);
            if (isForegroundRunning) {
                startForegroundWithNotification(isPlaying());
            }
        }
    }

    // ==========================================
    // State Accessors
    // ==========================================

    public boolean isPlaying() {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            return exoPlayer != null && exoPlayer.isPlaying();
        }
        final boolean[] result = new boolean[1];
        try {
            java.util.concurrent.CountDownLatch latch = new java.util.concurrent.CountDownLatch(1);
            playerHandler.post(() -> {
                if (exoPlayer != null) {
                    result[0] = exoPlayer.isPlaying();
                }
                latch.countDown();
            });
            latch.await(200, java.util.concurrent.TimeUnit.MILLISECONDS);
        } catch (Exception e) {
            Log.w(TAG, "Error in isPlaying: " + e.getMessage());
        }
        return result[0];
    }

    public long getCurrentPositionMs() {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            return (exoPlayer != null) ? exoPlayer.getCurrentPosition() : 0;
        }
        final long[] result = new long[1];
        try {
            java.util.concurrent.CountDownLatch latch = new java.util.concurrent.CountDownLatch(1);
            playerHandler.post(() -> {
                if (exoPlayer != null) {
                    result[0] = exoPlayer.getCurrentPosition();
                }
                latch.countDown();
            });
            latch.await(200, java.util.concurrent.TimeUnit.MILLISECONDS);
        } catch (Exception e) {
            Log.w(TAG, "Error in getCurrentPositionMs: " + e.getMessage());
        }
        return result[0];
    }

    public long getDurationMs() {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            if (exoPlayer != null && exoPlayer.getDuration() > 0) {
                return exoPlayer.getDuration();
            }
            return (currentTrack != null) ? currentTrack.getDurationSec() * 1000L : 0;
        }
        final long[] result = new long[1];
        try {
            java.util.concurrent.CountDownLatch latch = new java.util.concurrent.CountDownLatch(1);
            playerHandler.post(() -> {
                if (exoPlayer != null && exoPlayer.getDuration() > 0) {
                    result[0] = exoPlayer.getDuration();
                }
                latch.countDown();
            });
            latch.await(200, java.util.concurrent.TimeUnit.MILLISECONDS);
        } catch (Exception e) {
            Log.w(TAG, "Error in getDurationMs: " + e.getMessage());
        }
        if (result[0] > 0) return result[0];
        return (currentTrack != null) ? currentTrack.getDurationSec() * 1000L : 0;
    }

    public NativeTrack getCurrentTrack() {
        return currentTrack;
    }

    public int getCurrentIndex() {
        return currentIndex;
    }

    public String getRepeatMode() {
        return repeatMode;
    }

    public boolean isShuffle() {
        return isShuffle;
    }

    public List<NativeTrack> getQueue() {
        return queue;
    }

    // ==========================================
    // ExoPlayer Listener Implementation
    // ==========================================

    private void logDetailedDiagnostics(String context, PlaybackException error) {
        long curPos = getCurrentPositionMs();
        long dur = getDurationMs();
        long bufPos = exoPlayer != null ? exoPlayer.getBufferedPosition() : 0;
        boolean isPlay = exoPlayer != null && exoPlayer.isPlaying();
        int state = exoPlayer != null ? exoPlayer.getPlaybackState() : Player.STATE_IDLE;
        boolean pwr = exoPlayer != null ? exoPlayer.getPlayWhenReady() : false;
        boolean loading = exoPlayer != null && exoPlayer.isLoading();
        String stateStr = state == Player.STATE_IDLE ? "STATE_IDLE" :
                          state == Player.STATE_BUFFERING ? "STATE_BUFFERING" :
                          state == Player.STATE_READY ? "STATE_READY" :
                          state == Player.STATE_ENDED ? "STATE_ENDED" : "UNKNOWN";
        Log.i("VDMusic-Diagnostic", String.format(
            "[%s] SongID: %s | Title: %s | URL: %s | PlayerInstance: %s | pos: %d | dur: %d | buf: %d | isPlaying: %b | state: %s | playWhenReady: %b | loading: %b | error: %s",
            context,
            currentTrack != null ? currentTrack.getId() : "null",
            currentTrack != null ? currentTrack.getTitle() : "null",
            currentTrack != null ? currentTrack.getStreamUrl() : "null",
            exoPlayer != null ? Integer.toHexString(System.identityHashCode(exoPlayer)) : "null",
            curPos, dur, bufPos, isPlay, stateStr, pwr, loading,
            error != null ? error.getMessage() : "none"
        ));
    }

    @Override
    public void onIsPlayingChanged(boolean isPlaying) {
        logDetailedDiagnostics("onIsPlayingChanged(" + isPlaying + ")", null);
        if (isPlaying) {
            updatePlaybackState(PlaybackStateCompat.STATE_PLAYING, getCurrentPositionMs());
            startPositionTracker();
            long posSec = Math.max(0, getCurrentPositionMs() / 1000L);
            long durSec = Math.max(0, getDurationMs() / 1000L);
            if (eventListener != null) {
                eventListener.onPlaybackPosition(posSec, durSec);
                if (currentTrack != null) {
                    eventListener.onPlaybackStarted(currentTrack, posSec, durSec);
                }
            }
        } else {
            if (exoPlayer != null && exoPlayer.getPlaybackState() != Player.STATE_ENDED) {
                updatePlaybackState(PlaybackStateCompat.STATE_PAUSED, getCurrentPositionMs());
            }
        }
    }

    @Override
    public void onPlaybackStateChanged(int playbackState) {
        logDetailedDiagnostics("onPlaybackStateChanged(" + playbackState + ")", null);
        if (playbackState == Player.STATE_READY) {
            boolean playing = exoPlayer != null && exoPlayer.isPlaying();
            updatePlaybackState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, getCurrentPositionMs());
            if (playing) {
                startPositionTracker();
            }
            long posSec = Math.max(0, getCurrentPositionMs() / 1000L);
            long durSec = Math.max(0, getDurationMs() / 1000L);
            if (eventListener != null) {
                eventListener.onPlaybackPosition(posSec, durSec);
            }
        } else if (playbackState == Player.STATE_ENDED) {
            long curMs = getCurrentPositionMs();
            long durMs = getDurationMs();
            long expectedDurMs = (currentTrack != null && currentTrack.getDurationSec() > 0)
                    ? currentTrack.getDurationSec() * 1000L : durMs;

            boolean isAtGenuineEnd = (durMs > 0 && curMs >= durMs - 2000) ||
                                     (expectedDurMs > 0 && curMs >= expectedDurMs - 4000);

            if (!isAtGenuineEnd && curMs < 10000 && expectedDurMs > 30000) {
                // Buffer drop or network glitch within first 10s of a long track: attempt quick recovery
                Log.w(TAG, "ExoPlayer premature stream drop at " + curMs + "ms (expected " + expectedDurMs + "ms). Attempting resume...");
                if (exoPlayer != null) {
                    exoPlayer.seekTo(curMs);
                    exoPlayer.prepare();
                    exoPlayer.play();
                }
                return;
            }

            Log.d(TAG, "ExoPlayer track ended naturally: " + (currentTrack != null ? currentTrack.getTitle() : ""));
            handleTrackEnded();
        } else if (playbackState == Player.STATE_BUFFERING) {
            updatePlaybackState(PlaybackStateCompat.STATE_BUFFERING, getCurrentPositionMs());
        }
    }

    @Override
    public void onPositionDiscontinuity(Player.PositionInfo oldPosition, Player.PositionInfo newPosition, int reason) {
        long posSec = Math.max(0, newPosition.positionMs / 1000L);
        long durSec = Math.max(0, getDurationMs() / 1000L);
        if (eventListener != null) {
            eventListener.onPlaybackPosition(posSec, durSec);
        }
    }

    @Override
    public void onPlayerError(PlaybackException error) {
        logDetailedDiagnostics("onPlayerError", error);
        Log.e("VDMusic-ExoPlayer", "PLAYBACK ERROR: " + error.toString(), error);
        Log.e("VDMusic-ExoPlayer", "Error Code: " + error.errorCode);
        Log.e("VDMusic-ExoPlayer", "Error Message: " + error.getMessage());
        if (error.getCause() != null) {
            Log.e("VDMusic-ExoPlayer", "Error Cause: " + error.getCause().toString(), error.getCause());
        }

        if (eventListener != null) {
            eventListener.onPlaybackError(error.getMessage());
        }
    }

    private void handleTrackEnded() {
        if ("one".equalsIgnoreCase(repeatMode)) {
            seekTo(0);
            resumePlayback();
            if (eventListener != null && currentTrack != null) {
                eventListener.onPlaybackStarted(currentTrack, 0, currentTrack.getDurationSec());
            }
        } else {
            // When eventListener is active (UI is attached), notify React and let React manage the queue authoritative transition.
            // Only trigger native playNext() if no eventListener is attached (e.g. standalone background playback without UI).
            if (eventListener != null && currentTrack != null) {
                eventListener.onPlaybackCompleted(currentTrack);
            } else {
                playNext();
            }
        }
    }

    // ==========================================
    // Progress Tracker (Smooth 500ms interval)
    // ==========================================

    private final Runnable positionRunnable = new Runnable() {
        @Override
        public void run() {
            if (!isTrackingPosition) return;

            if (exoPlayer != null) {
                boolean playing = exoPlayer.isPlaying();
                long currentPosMs = exoPlayer.getCurrentPosition();
                long durationMs = exoPlayer.getDuration();
                if (durationMs <= 0 && currentTrack != null) {
                    durationMs = currentTrack.getDurationSec() * 1000L;
                }

                long posSec = Math.max(0, currentPosMs / 1000L);
                long durSec = Math.max(0, durationMs / 1000L);

                if (eventListener != null && playing) {
                    eventListener.onPlaybackPosition(posSec, durSec);
                }

                if (playing) {
                    updatePlaybackState(PlaybackStateCompat.STATE_PLAYING, currentPosMs);
                }
            }

            // Keep ticker scheduling alive while isTrackingPosition is true
            mainHandler.postDelayed(this, 500);
        }
    };

    private void startPositionTracker() {
        isTrackingPosition = true;
        mainHandler.removeCallbacks(positionRunnable);
        mainHandler.post(positionRunnable);
    }

    private void stopPositionTracker() {
        isTrackingPosition = false;
        mainHandler.removeCallbacks(positionRunnable);
    }

    // ==========================================
    // MediaSession & Notification Management
    // ==========================================

    private void updatePlaybackState(int state, long positionMs) {
        if (mediaSession == null) return;

        long actions = PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_SEEK_TO |
                PlaybackStateCompat.ACTION_STOP;

        float playbackSpeed = (state == PlaybackStateCompat.STATE_PLAYING) ? 1.0f : 0.0f;

        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
                .setActions(actions)
                .setState(state, positionMs, playbackSpeed);

        mediaSession.setPlaybackState(stateBuilder.build());
    }

    private void updateMediaSessionMetadata(NativeTrack track) {
        if (mediaSession == null || track == null) return;

        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, track.getId())
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, track.getTitle())
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, track.getArtist())
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, track.getAlbum())
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, track.getDurationSec() * 1000L);

        if (cachedBitmap != null) {
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, cachedBitmap);
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, cachedBitmap);
        }

        mediaSession.setMetadata(metaBuilder.build());
    }

    private void startForegroundWithNotification(boolean isPlaying) {
        Notification notification = buildNotification(isPlaying);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceCompat.startForeground(
                        this,
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                );
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            isForegroundRunning = true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to start foreground service: " + e.getMessage(), e);
        }

        loadArtworkAsync(currentTrack != null ? currentTrack.getCoverUrl() : null);
    }

    private Notification buildNotification(boolean isPlaying) {
        String title = (currentTrack != null) ? currentTrack.getTitle() : "VD Music";
        String artist = (currentTrack != null) ? currentTrack.getArtist() : "Playing Audio";

        // PendingIntent to launch the app UI
        Intent contentIntent = new Intent(this, MainActivity.class);
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pContentIntent = PendingIntent.getActivity(
                this,
                0,
                contentIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // Previous Action
        Intent prevIntent = new Intent(this, MediaNotificationService.class).setAction(ACTION_PREV);
        PendingIntent pPrevIntent = PendingIntent.getService(
                this,
                1,
                prevIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // Play / Pause Action
        Intent playPauseIntent = new Intent(this, MediaNotificationService.class)
                .setAction(isPlaying ? ACTION_PAUSE : ACTION_PLAY);
        PendingIntent pPlayPauseIntent = PendingIntent.getService(
                this,
                2,
                playPauseIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // Next Action
        Intent nextIntent = new Intent(this, MediaNotificationService.class).setAction(ACTION_NEXT);
        PendingIntent pNextIntent = PendingIntent.getService(
                this,
                3,
                nextIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // Stop Action
        Intent stopIntent = new Intent(this, MediaNotificationService.class).setAction(ACTION_STOP);
        PendingIntent pStopIntent = PendingIntent.getService(
                this,
                4,
                stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        int playPauseIcon = isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String playPauseTitle = isPlaying ? "Pause" : "Play";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle(title)
                .setContentText(artist)
                .setSubText("VD Music")
                .setContentIntent(pContentIntent)
                .setDeleteIntent(pStopIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(isPlaying)
                .setShowWhen(false)
                .addAction(android.R.drawable.ic_media_previous, "Previous", pPrevIntent)
                .addAction(playPauseIcon, playPauseTitle, pPlayPauseIntent)
                .addAction(android.R.drawable.ic_media_next, "Next", pNextIntent)
                .setStyle(new MediaStyle()
                        .setMediaSession(mediaSession.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2)
                        .setShowCancelButton(true)
                        .setCancelButtonIntent(pStopIntent));

        if (cachedBitmap != null) {
            builder.setLargeIcon(cachedBitmap);
        }

        return builder.build();
    }

    private void loadArtworkAsync(final String coverUrl) {
        if (coverUrl == null || coverUrl.isEmpty() || coverUrl.equals(lastCoverUrl)) {
            return;
        }

        lastCoverUrl = coverUrl;
        new Thread(() -> {
            try {
                URL url = new URL(coverUrl);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setDoInput(true);
                connection.setConnectTimeout(4000);
                connection.setReadTimeout(4000);
                connection.connect();
                InputStream input = connection.getInputStream();
                Bitmap bitmap = BitmapFactory.decodeStream(input);
                input.close();

                if (bitmap != null) {
                    cachedBitmap = bitmap;
                    mainHandler.post(() -> {
                        if (currentTrack != null) {
                            updateMediaSessionMetadata(currentTrack);
                        }
                        if (notificationManager != null && isForegroundRunning) {
                            notificationManager.notify(NOTIFICATION_ID, buildNotification(isPlaying()));
                        }
                    });
                }
            } catch (Exception e) {
                Log.w(TAG, "Failed to load artwork bitmap: " + e.getMessage());
            }
        }).start();
    }

    // ==========================================
    // Cleanup
    // ==========================================

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Destroying MediaNotificationService");

        stopPositionTracker();
        releaseWakeLocks();

        if (exoPlayer != null) {
            exoPlayer.removeListener(this);
            exoPlayer.release();
            exoPlayer = null;
        }

        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
    }
}
