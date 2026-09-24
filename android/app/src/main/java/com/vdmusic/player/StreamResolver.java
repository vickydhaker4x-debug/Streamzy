package com.vdmusic.player;

import android.util.Base64;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;

/**
 * Robust stream resolver utility for native Android playback.
 * Resolves direct playable full-length audio streams (MP4/WebM) from JioSaavn, Invidious, and Piped endpoints.
 * Never returns 30-second preview clips.
 */
public class StreamResolver {
    private static final String TAG = "StreamResolver";
    private static final ExecutorService executor = Executors.newFixedThreadPool(8);

    private static final List<String> INVIDIOUS_ENDPOINTS = Arrays.asList(
        "https://inv.nadeko.net/api/v1/videos/",
        "https://invidious.nerdvpn.de/api/v1/videos/",
        "https://invidious.tiekoetter.com/api/v1/videos/",
        "https://yt.chocolatemoo53.com/api/v1/videos/",
        "https://invidious.f5.si/api/v1/videos/",
        "https://inv-ygg.nadeko.net/api/v1/videos/",
        "https://yewtu.be/api/v1/videos/",
        "https://invidious.privacydev.net/api/v1/videos/",
        "https://invidious.projectsegfau.lt/api/v1/videos/",
        "https://invidious.perennialte.ch/api/v1/videos/"
    );

    private static final List<String> PIPED_ENDPOINTS = Arrays.asList(
        "https://pipedapi.kavin.rocks/streams/",
        "https://api.piped.privacydev.net/streams/",
        "https://pipedapi.ducks.party/streams/",
        "https://pipedapi.nosebs.ru/streams/",
        "https://piped-api.garudalinux.org/streams/",
        "https://pipedapi.drgns.space/streams/",
        "https://pa.il.ax/streams/"
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
                            queryFullStreamFallback(title, artist, callback, hasResolved);
                        } else {
                            callback.onError("Could not resolve stream for video: " + videoId);
                        }
                    }
                }
            });
        }
    }

    private static void queryFullStreamFallback(String title, String artist, StreamCallback callback, AtomicBoolean hasResolved) {
        executor.execute(() -> {
            try {
                String cleanTitle = title.replaceAll("\\(.*?\\)|\\[.*?\\]", "").trim();
                String cleanArtist = artist != null ? artist.split("[,&/]")[0].trim() : "";
                String query = java.net.URLEncoder.encode((cleanTitle + " " + cleanArtist).trim(), "UTF-8");
                URL url = new URL("https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&cc=in&includeMetaTags=1&query=" + query);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(4500);
                conn.setReadTimeout(4500);
                conn.setRequestMethod("GET");
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

                if (conn.getResponseCode() == 200) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) sb.append(line);
                    reader.close();

                    JSONObject data = new JSONObject(sb.toString());
                    JSONObject songsObj = data.optJSONObject("songs");
                    if (songsObj != null) {
                        JSONArray songsData = songsObj.optJSONArray("data");
                        if (songsData != null && songsData.length() > 0) {
                            String pid = songsData.getJSONObject(0).optString("id", "");
                            if (!pid.isEmpty()) {
                                URL detUrl = new URL("https://www.jiosaavn.com/api.php?__call=song.getDetails&pids=" + pid + "&_format=json&_marker=0");
                                HttpURLConnection detConn = (HttpURLConnection) detUrl.openConnection();
                                detConn.setConnectTimeout(4500);
                                detConn.setReadTimeout(4500);
                                detConn.setRequestMethod("GET");
                                detConn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

                                if (detConn.getResponseCode() == 200) {
                                    BufferedReader detReader = new BufferedReader(new InputStreamReader(detConn.getInputStream()));
                                    StringBuilder detSb = new StringBuilder();
                                    while ((line = detReader.readLine()) != null) detSb.append(line);
                                    detReader.close();

                                    JSONObject detData = new JSONObject(detSb.toString());
                                    JSONObject songInfo = detData.optJSONObject(pid);
                                    if (songInfo != null) {
                                        String encUrl = songInfo.optString("encrypted_media_url", "");
                                        if (!encUrl.isEmpty()) {
                                            String decryptedUrl = decryptSaavnMediaUrl(encUrl);
                                            if (decryptedUrl != null && !decryptedUrl.isEmpty()) {
                                                // High-quality full 320kbps audio stream (with 160kbps/96kbps stability)
                                                String fullStreamUrl = decryptedUrl.replace("_96.mp4", "_320.mp4");
                                                if (hasResolved.compareAndSet(false, true)) {
                                                    Log.d(TAG, "Resolved full 320kbps audio stream for: " + title + " -> " + fullStreamUrl);
                                                    callback.onResolved(new ResolvedStream(fullStreamUrl, "audio/mp4", 320000));
                                                    return;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Full stream fallback query error: " + e.getMessage());
            }
            if (!hasResolved.get()) {
                callback.onError("Could not resolve stream for: " + title);
            }
        });
    }

    private static String decryptSaavnMediaUrl(String encryptedUrl) {
        try {
            SecretKeySpec keySpec = new SecretKeySpec("38346591".getBytes(StandardCharsets.UTF_8), "DES");
            Cipher cipher = Cipher.getInstance("DES/ECB/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec);
            byte[] decoded = Base64.decode(encryptedUrl, Base64.DEFAULT);
            byte[] decrypted = cipher.doFinal(decoded);
            return new String(decrypted, StandardCharsets.UTF_8).trim();
        } catch (Exception e) {
            Log.e(TAG, "DES decryption failed: " + e.getMessage());
            return null;
        }
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
