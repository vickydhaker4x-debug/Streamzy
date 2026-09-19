package com.vdmusic.player;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Capacitor bridge plugin connecting React with the native Android MediaNotificationService.
 * Dispatches playback commands to ExoPlayer / MediaSession and notifies listeners of state changes.
 */
@CapacitorPlugin(name = "NativeAudioPlayer")
public class NativeAudioPlayerPlugin extends Plugin implements MediaNotificationService.ServiceEventListener {
    private static final String TAG = "NativeAudioPlugin";

    private MediaNotificationService mediaService;
    private boolean isBound = false;
    private final List<Runnable> pendingActions = new ArrayList<>();

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            Log.d(TAG, "MediaNotificationService connected");
            MediaNotificationService.LocalBinder binder = (MediaNotificationService.LocalBinder) service;
            mediaService = binder.getService();
            mediaService.setEventListener(NativeAudioPlayerPlugin.this);
            isBound = true;

            // Execute any actions queued while service was binding
            synchronized (pendingActions) {
                for (Runnable action : pendingActions) {
                    action.run();
                }
                pendingActions.clear();
            }
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            Log.d(TAG, "MediaNotificationService disconnected");
            if (mediaService != null) {
                mediaService.setEventListener(null);
            }
            mediaService = null;
            isBound = false;
        }
    };

    @Override
    public void load() {
        super.load();
        Log.d(TAG, "Loading NativeAudioPlayerPlugin");
        bindMediaService();
    }

    private void bindMediaService() {
        if (!isBound && getContext() != null) {
            Intent intent = new Intent(getContext(), MediaNotificationService.class);
            try {
                getContext().startService(intent);
                getContext().bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);
            } catch (Exception e) {
                Log.e(TAG, "Failed to bind MediaNotificationService: " + e.getMessage(), e);
            }
        }
    }

    private void executeWhenBound(Runnable runnable) {
        if (isBound && mediaService != null) {
            runnable.run();
        } else {
            synchronized (pendingActions) {
                pendingActions.add(runnable);
            }
            bindMediaService();
        }
    }

    // ==========================================
    // Plugin Methods (React -> Android)
    // ==========================================

    @PluginMethod
    public void isNativePlaybackAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        ret.put("platform", "android");
        ret.put("engine", "AndroidX Media3 ExoPlayer");
        call.resolve(ret);
    }

    @PluginMethod
    public void play(PluginCall call) {
        JSObject trackObj = call.getObject("track");
        String streamUrl = call.getString("streamUrl");
        JSArray queueArray = call.getArray("queue");
        Integer currentIndex = call.getInt("currentIndex", 0);
        String repeatMode = call.getString("repeatMode", "all");
        Boolean isShuffle = call.getBoolean("isShuffle", false);
        String mimeType = call.getString("mimeType");

        if (trackObj == null) {
            call.reject("Track object is required");
            return;
        }

        final NativeTrack track = NativeTrack.fromJSObject(trackObj);
        final List<NativeTrack> queueList = parseQueue(queueArray);

        executeWhenBound(() -> {
            try {
                if (mediaService != null) {
                    if (!queueList.isEmpty()) {
                        mediaService.setQueue(queueList, currentIndex != null ? currentIndex : 0, repeatMode, Boolean.TRUE.equals(isShuffle));
                    }
                    mediaService.playTrack(track, streamUrl, queueList, currentIndex != null ? currentIndex : 0, mimeType);
                }
                JSObject res = new JSObject();
                res.put("success", true);
                call.resolve(res);
            } catch (Exception e) {
                Log.e("VDMusic-NativeAudio", "play() failed", e);
                call.reject("play() failed: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void PLAY(PluginCall call) {
        play(call);
    }

    @PluginMethod
    public void pause(PluginCall call) {
        executeWhenBound(() -> {
            if (mediaService != null) {
                mediaService.pausePlayback();
            }
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        });
    }

    @PluginMethod
    public void PAUSE(PluginCall call) {
        pause(call);
    }

    @PluginMethod
    public void resume(PluginCall call) {
        executeWhenBound(() -> {
            if (mediaService != null) {
                mediaService.resumePlayback();
            }
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        executeWhenBound(() -> {
            if (mediaService != null) {
                mediaService.stopPlayback();
            }
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        });
    }

    @PluginMethod
    public void STOP(PluginCall call) {
        stop(call);
    }

    @PluginMethod
    public void next(PluginCall call) {
        executeWhenBound(() -> {
            if (mediaService != null) {
                mediaService.playNext();
            }
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        });
    }

    @PluginMethod
    public void NEXT(PluginCall call) {
        next(call);
    }

    @PluginMethod
    public void previous(PluginCall call) {
        executeWhenBound(() -> {
            if (mediaService != null) {
                mediaService.playPrevious();
            }
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        });
    }

    @PluginMethod
    public void PREVIOUS(PluginCall call) {
        previous(call);
    }

    @PluginMethod
    public void seek(PluginCall call) {
        Double positionSec = call.getDouble("positionSec");
        if (positionSec == null) {
            positionSec = (double) call.getInt("positionSec", 0);
        }

        final long pos = positionSec.longValue();
        executeWhenBound(() -> {
            if (mediaService != null) {
                mediaService.seekTo(pos);
            }
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        });
    }

    @PluginMethod
    public void SEEK(PluginCall call) {
        seek(call);
    }

    @PluginMethod
    public void loadTrack(PluginCall call) {
        JSObject trackObj = call.getObject("track");
        String streamUrl = call.getString("streamUrl");
        if (trackObj == null) {
            call.reject("Track object is required");
            return;
        }

        final NativeTrack track = NativeTrack.fromJSObject(trackObj);
        executeWhenBound(() -> {
            if (mediaService != null) {
                mediaService.updateMetadata(track, track.isFavorite());
            }
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        });
    }

    @PluginMethod
    public void LOAD_TRACK(PluginCall call) {
        loadTrack(call);
    }

    @PluginMethod
    public void setQueue(PluginCall call) {
        JSArray queueArray = call.getArray("queue");
        Integer currentIndex = call.getInt("currentIndex", 0);
        String repeatMode = call.getString("repeatMode", "all");
        Boolean isShuffle = call.getBoolean("isShuffle", false);

        final List<NativeTrack> queueList = parseQueue(queueArray);
        executeWhenBound(() -> {
            if (mediaService != null) {
                mediaService.setQueue(queueList, currentIndex != null ? currentIndex : 0, repeatMode, Boolean.TRUE.equals(isShuffle));
            }
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        });
    }

    @PluginMethod
    public void SET_QUEUE(PluginCall call) {
        setQueue(call);
    }

    @PluginMethod
    public void setRepeatMode(PluginCall call) {
        String mode = call.getString("repeatMode", "all");
        executeWhenBound(() -> {
            if (mediaService != null) {
                mediaService.setRepeatMode(mode);
            }
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        });
    }

    @PluginMethod
    public void SET_REPEAT_MODE(PluginCall call) {
        setRepeatMode(call);
    }

    @PluginMethod
    public void setShuffleMode(PluginCall call) {
        Boolean shuffle = call.getBoolean("isShuffle", false);
        executeWhenBound(() -> {
            if (mediaService != null) {
                mediaService.setShuffleMode(Boolean.TRUE.equals(shuffle));
            }
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        });
    }

    @PluginMethod
    public void SET_SHUFFLE_MODE(PluginCall call) {
        setShuffleMode(call);
    }

    @PluginMethod
    public void updateMetadata(PluginCall call) {
        JSObject trackObj = call.getObject("track");
        Boolean isFavorite = call.getBoolean("isFavorite", false);
        if (trackObj != null) {
            final NativeTrack track = NativeTrack.fromJSObject(trackObj);
            executeWhenBound(() -> {
                if (mediaService != null) {
                    mediaService.updateMetadata(track, Boolean.TRUE.equals(isFavorite));
                }
                JSObject res = new JSObject();
                res.put("success", true);
                call.resolve(res);
            });
        } else {
            call.resolve();
        }
    }

    @PluginMethod
    public void UPDATE_METADATA(PluginCall call) {
        updateMetadata(call);
    }

    @PluginMethod
    public void getPlaybackState(PluginCall call) {
        executeWhenBound(() -> {
            JSObject state = new JSObject();
            if (mediaService != null) {
                state.put("isPlaying", mediaService.isPlaying());
                NativeTrack curr = mediaService.getCurrentTrack();
                state.put("currentTrack", curr != null ? curr.toJSObject() : null);
                state.put("positionSec", mediaService.getCurrentPositionMs() / 1000);
                state.put("durationSec", mediaService.getDurationMs() / 1000);
                state.put("currentIndex", mediaService.getCurrentIndex());
                state.put("repeatMode", mediaService.getRepeatMode());
                state.put("isShuffle", mediaService.isShuffle());
            } else {
                state.put("isPlaying", false);
                state.put("currentTrack", null);
                state.put("positionSec", 0);
                state.put("durationSec", 0);
                state.put("currentIndex", 0);
                state.put("repeatMode", "all");
                state.put("isShuffle", false);
            }
            call.resolve(state);
        });
    }

    private List<NativeTrack> parseQueue(JSArray array) {
        List<NativeTrack> list = new ArrayList<>();
        if (array == null) return list;

        for (int i = 0; i < array.length(); i++) {
            try {
                JSONObject obj = array.getJSONObject(i);
                list.add(NativeTrack.fromJSONObject(obj));
            } catch (JSONException e) {
                Log.w(TAG, "Error parsing queue item: " + e.getMessage());
            }
        }
        return list;
    }

    // ==========================================
    // Service Event Callbacks (Android -> React)
    // ==========================================

    @Override
    public void onPlaybackStarted(NativeTrack track, long positionSec, long durationSec) {
        JSObject data = new JSObject();
        data.put("track", track != null ? track.toJSObject() : null);
        data.put("positionSec", positionSec);
        data.put("durationSec", durationSec);
        notifyListeners("PLAYBACK_STARTED", data);
    }

    @Override
    public void onPlaybackPaused(NativeTrack track, long positionSec) {
        JSObject data = new JSObject();
        data.put("track", track != null ? track.toJSObject() : null);
        data.put("positionSec", positionSec);
        notifyListeners("PLAYBACK_PAUSED", data);
    }

    @Override
    public void onPlaybackStopped() {
        notifyListeners("PLAYBACK_STOPPED", new JSObject());
    }

    @Override
    public void onTrackChanged(NativeTrack track, int currentIndex, long durationSec) {
        JSObject data = new JSObject();
        data.put("track", track != null ? track.toJSObject() : null);
        data.put("currentIndex", currentIndex);
        data.put("durationSec", durationSec);
        notifyListeners("TRACK_CHANGED", data);
    }

    @Override
    public void onPlaybackPosition(long positionSec, long durationSec) {
        JSObject data = new JSObject();
        data.put("positionSec", positionSec);
        data.put("durationSec", durationSec);
        notifyListeners("PLAYBACK_POSITION", data);
    }

    @Override
    public void onPlaybackError(String message) {
        JSObject data = new JSObject();
        data.put("message", message);
        notifyListeners("PLAYBACK_ERROR", data);
    }

    @Override
    public void onQueueChanged(int currentIndex) {
        JSObject data = new JSObject();
        data.put("currentIndex", currentIndex);
        notifyListeners("QUEUE_CHANGED", data);
    }

    @Override
    public void onPlaybackCompleted(NativeTrack track) {
        JSObject data = new JSObject();
        data.put("track", track != null ? track.toJSObject() : null);
        notifyListeners("PLAYBACK_COMPLETED", data);
    }

    @Override
    protected void handleOnDestroy() {
        if (isBound && getContext() != null) {
            try {
                getContext().unbindService(serviceConnection);
            } catch (Exception e) {
                Log.w(TAG, "Error unbinding service: " + e.getMessage());
            }
            isBound = false;
        }
        super.handleOnDestroy();
    }
}
