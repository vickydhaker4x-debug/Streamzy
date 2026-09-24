package com.vdmusic.player;

import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Robust stream resolver utility for native Android playback.
 * Resolves direct playable audio streams (MP4/WebM) from Invidious and Piped endpoints
 * without requiring the WebView to be awake.
 */
public class StreamResolver {
    private static final String TAG = "StreamResolver";
    private static final ExecutorService executor = Executors.newFixedThreadPool(6);

    private static final List<String> INVIDIOUS_ENDPOINTS = Arrays.asList(
        "https://inv.tux.pizza/api/v1/videos/",
        "https://invidious.nerdvpn.de/api/v1/videos/",
        "https://yewtu.be/api/v1/videos/",
        "https://invidious.no-valat.net/api/v1/videos/",
        "https://vid.priv.au/api/v1/videos/",
        "https://invidious.flokinet.to/api/v1/videos/"
    );

    private static final List<String> PIPED_ENDPOINTS = Arrays.asList(
        "https://api.piped.privacydev.net/streams/",
        "https://pipedapi.ducks.party/streams/",
        "https://pipedapi.nosebs.ru/streams/",
        "https://piped-api.garudalinux.org/streams/"
    );

    public static class ResolvedStream {
        public String url;
        public String mimeType;
        public String rawMimeType;
        public String codec;
        public int bitrate;
        public String container;

        public ResolvedStream(String url, String rawMimeType, int bitrate) {
            this.url = url;
            this.rawMimeType = rawMimeType;
            this.bitrate = bitrate;
            this.mimeType = rawMimeType;
            this.codec = "";
            this.container = "";

            if (rawMimeType != null && !rawMimeType.isEmpty()) {
                if (rawMimeType.contains(";")) {
                    String[] parts = rawMimeType.split(";");
                    this.mimeType = parts[0].trim();
                    for (String part : parts) {
                        part = part.trim();
                        if (part.startsWith("codecs=")) {
                            this.codec = part.substring("codecs=".length()).replace("\"", "").replace("'", "").trim();
                        }
                    }
                }
                String lower = rawMimeType.toLowerCase();
                if (lower.contains("mp4") || lower.contains("m4a")) {
                    this.container = "mp4";
                } else if (lower.contains("webm") || lower.contains("opus")) {
                    this.container = "webm";
                } else if (lower.contains("mpeg") || lower.contains("mp3")) {
                    this.container = "mp3";
                }
            }
        }
    }

    private static int getStreamScore(String mimeType, int bitrate) {
        String mime = (mimeType != null ? mimeType : "").toLowerCase();
        int containerScore = 0;
        if (mime.contains("audio/mp4") || mime.contains("mp4a") || mime.contains("m4a")) {
            containerScore = 3000000;
        } else if (mime.contains("audio/mpeg") || mime.contains("mp3")) {
            containerScore = 2000000;
        } else if (mime.contains("audio/webm") || mime.contains("opus")) {
            containerScore = 1000000;
        }
        return containerScore + Math.min(bitrate, 1000000);
    }

    public interface StreamCallback {
        void onResolved(ResolvedStream stream);
        void onError(String error);
    }

    public static void resolveAsync(final String videoId, final StreamCallback callback) {
        if (videoId == null || videoId.trim().isEmpty()) {
            callback.onError("Invalid videoId");
            return;
        }

        final AtomicBoolean hasResolved = new AtomicBoolean(false);
        final java.util.concurrent.atomic.AtomicInteger pendingTasks = new java.util.concurrent.atomic.AtomicInteger(0);

        List<String> allEndpoints = new ArrayList<>();
        allEndpoints.addAll(INVIDIOUS_ENDPOINTS);
        allEndpoints.addAll(PIPED_ENDPOINTS);
        pendingTasks.set(allEndpoints.size());

        for (final String endpoint : allEndpoints) {
            executor.execute(() -> {
                if (hasResolved.get()) return;

                ResolvedStream stream = null;
                if (endpoint.contains("piped")) {
                    stream = queryPipedEndpoint(endpoint, videoId);
                } else {
                    stream = queryInvidiousEndpoint(endpoint, videoId);
                }

                if (stream != null && stream.url != null && !stream.url.isEmpty()) {
                    if (hasResolved.compareAndSet(false, true)) {
                        Log.d(TAG, "Fast parallel resolve succeeded via: " + endpoint);
                        callback.onResolved(stream);
                    }
                } else {
                    int remaining = pendingTasks.decrementAndGet();
                    if (remaining == 0 && !hasResolved.get()) {
                        callback.onError("Could not resolve stream for video: " + videoId);
                    }
                }
            });
        }
    }

    public static void resolveWithFallbackAsync(final String videoId, final String title, final String artist, final StreamCallback callback) {
        final AtomicBoolean hasResolved = new AtomicBoolean(false);
        final java.util.concurrent.atomic.AtomicInteger pendingTasks = new java.util.concurrent.atomic.AtomicInteger(0);

        List<String> allEndpoints = new ArrayList<>();
        allEndpoints.addAll(INVIDIOUS_ENDPOINTS);
        allEndpoints.addAll(PIPED_ENDPOINTS);
        pendingTasks.set(allEndpoints.size());

        for (final String endpoint : allEndpoints) {
            executor.execute(() -> {
                if (hasResolved.get()) return;

                ResolvedStream stream = null;
                if (endpoint.contains("piped")) {
                    stream = queryPipedEndpoint(endpoint, videoId);
                } else {
                    stream = queryInvidiousEndpoint(endpoint, videoId);
                }

                if (stream != null && stream.url != null && !stream.url.isEmpty()) {
                    if (hasResolved.compareAndSet(false, true)) {
                        Log.d(TAG, "Fast parallel resolve succeeded via: " + endpoint);
                        callback.onResolved(stream);
                    }
                } else {
                    int remaining = pendingTasks.decrementAndGet();
                    if (remaining == 0 && !hasResolved.get()) {
                        if (title != null && !title.trim().isEmpty()) {
                            queryItunesFallback(title, artist, callback, hasResolved);
                        } else {
                            callback.onError("Could not resolve stream for video: " + videoId);
                        }
                    }
                }
            });
        }
    }

    private static void queryItunesFallback(String title, String artist, StreamCallback callback, AtomicBoolean hasResolved) {
        executor.execute(() -> {
            try {
                String cleanTitle = title.replaceAll("\\(.*?\\)|\\[.*?\\]", "").trim();
                String cleanArtist = artist != null ? artist.split("[,&/]")[0].trim() : "";
                String query = java.net.URLEncoder.encode(cleanTitle + " " + cleanArtist, "UTF-8");
                URL url = new URL("https://itunes.apple.com/search?term=" + query + "&entity=song&limit=1");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(4000);
                conn.setReadTimeout(4000);
                conn.setRequestMethod("GET");
                conn.setRequestProperty("User-Agent", "Mozilla/5.0");

                if (conn.getResponseCode() == 200) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) sb.append(line);
                    reader.close();

                    JSONObject data = new JSONObject(sb.toString());
                    JSONArray results = data.optJSONArray("results");
                    if (results != null && results.length() > 0) {
                        JSONObject item = results.getJSONObject(0);
                        String previewUrl = item.optString("previewUrl", "");
                        if (!previewUrl.isEmpty() && hasResolved.compareAndSet(false, true)) {
                            Log.d(TAG, "Resolved via iTunes CDN fallback for: " + title);
                            callback.onResolved(new ResolvedStream(previewUrl, "audio/mp4", 256000));
                            return;
                        }
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "iTunes fallback query error: " + e.getMessage());
            }
            if (!hasResolved.get()) {
                callback.onError("Could not resolve stream for: " + title);
            }
        });
    }

    private static ResolvedStream queryInvidiousEndpoint(String endpoint, String videoId) {
        try {
            URL url = new URL(endpoint + videoId);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(3500);
            conn.setReadTimeout(3500);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Android; Streamzy/2.0)");

            int code = conn.getResponseCode();
            if (code == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();

                JSONObject data = new JSONObject(sb.toString());
                JSONArray adaptiveFormats = data.optJSONArray("adaptiveFormats");
                if (adaptiveFormats != null) {
                    ResolvedStream bestStream = null;
                    int bestScore = -1;
                    for (int i = 0; i < adaptiveFormats.length(); i++) {
                        JSONObject format = adaptiveFormats.getJSONObject(i);
                        String type = format.optString("type", "");
                        if (type.contains("audio")) {
                            int bitrate = format.optInt("bitrate", 0);
                            String streamUrl = format.optString("url", "");
                            if (!streamUrl.isEmpty()) {
                                int score = getStreamScore(type, bitrate);
                                if (score > bestScore) {
                                    bestScore = score;
                                    bestStream = new ResolvedStream(streamUrl, type, bitrate);
                                }
                            }
                        }
                    }
                    return bestStream;
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private static ResolvedStream queryPipedEndpoint(String endpoint, String videoId) {
        try {
            URL url = new URL(endpoint + videoId);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(3500);
            conn.setReadTimeout(3500);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Android; Streamzy/2.0)");

            int code = conn.getResponseCode();
            if (code == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();

                JSONObject data = new JSONObject(sb.toString());
                JSONArray audioStreams = data.optJSONArray("audioStreams");
                if (audioStreams != null) {
                    ResolvedStream bestStream = null;
                    int bestScore = -1;
                    for (int i = 0; i < audioStreams.length(); i++) {
                        JSONObject stream = audioStreams.getJSONObject(i);
                        int bitrate = stream.optInt("bitrate", 0);
                        String streamUrl = stream.optString("url", "");
                        String type = stream.optString("mimeType", "audio/mp4");
                        if (!streamUrl.isEmpty()) {
                            int score = getStreamScore(type, bitrate);
                            if (score > bestScore) {
                                bestScore = score;
                                bestStream = new ResolvedStream(streamUrl, type, bitrate);
                            }
                        }
                    }
                    return bestStream;
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    public static ResolvedStream resolveSyncStream(String videoId) {
        if (videoId == null || videoId.trim().isEmpty()) return null;

        // 1. Try Invidious instances
        for (String endpoint : INVIDIOUS_ENDPOINTS) {
            ResolvedStream s = queryInvidiousEndpoint(endpoint, videoId);
            if (s != null) return s;
        }

        // 2. Try Piped instances as secondary
        for (String endpoint : PIPED_ENDPOINTS) {
            ResolvedStream s = queryPipedEndpoint(endpoint, videoId);
            if (s != null) return s;
        }

        return null;
    }

    public static String resolveSync(String videoId) {
        ResolvedStream stream = resolveSyncStream(videoId);
        return stream != null ? stream.url : null;
    }
}
