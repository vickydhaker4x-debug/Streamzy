package com.vdmusic.player;

import com.getcapacitor.JSObject;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.Serializable;

/**
 * Clean data model representing a music track in the native Android player.
 */
public class NativeTrack implements Serializable {
    private String id;
    private String title;
    private String artist;
    private String album;
    private String coverUrl;
    private String videoId;
    private String audioUrl;
    private String streamUrl;
    private long durationSec;
    private boolean isFavorite;

    public NativeTrack() {
        this.id = "";
        this.title = "VD Music";
        this.artist = "Unknown Artist";
        this.album = "VD Music";
        this.coverUrl = "";
        this.videoId = "";
        this.audioUrl = "";
        this.streamUrl = "";
        this.durationSec = 0;
        this.isFavorite = false;
    }

    public static NativeTrack fromJSObject(JSObject obj) {
        NativeTrack track = new NativeTrack();
        if (obj == null) return track;

        track.id = obj.optString("id", "");
        track.title = obj.optString("title", "Unknown Title");
        track.artist = obj.optString("artist", "Unknown Artist");
        track.album = obj.optString("album", "VD Music");
        track.coverUrl = obj.optString("coverUrl", "");
        track.videoId = obj.optString("videoId", "");
        track.audioUrl = obj.optString("audioUrl", "");
        track.streamUrl = obj.optString("streamUrl", "");
        track.durationSec = obj.optLong("durationSec", 0);
        track.isFavorite = obj.optBoolean("isFavorite", false);

        return track;
    }

    public static NativeTrack fromJSONObject(JSONObject obj) {
        NativeTrack track = new NativeTrack();
        if (obj == null) return track;

        track.id = obj.optString("id", "");
        track.title = obj.optString("title", "Unknown Title");
        track.artist = obj.optString("artist", "Unknown Artist");
        track.album = obj.optString("album", "VD Music");
        track.coverUrl = obj.optString("coverUrl", "");
        track.videoId = obj.optString("videoId", "");
        track.audioUrl = obj.optString("audioUrl", "");
        track.streamUrl = obj.optString("streamUrl", "");
        track.durationSec = obj.optLong("durationSec", 0);
        track.isFavorite = obj.optBoolean("isFavorite", false);

        return track;
    }

    public JSObject toJSObject() {
        JSObject obj = new JSObject();
        obj.put("id", id);
        obj.put("title", title);
        obj.put("artist", artist);
        obj.put("album", album);
        obj.put("coverUrl", coverUrl);
        obj.put("videoId", videoId);
        obj.put("audioUrl", audioUrl);
        obj.put("streamUrl", streamUrl);
        obj.put("durationSec", durationSec);
        obj.put("isFavorite", isFavorite);
        return obj;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getArtist() { return artist; }
    public void setArtist(String artist) { this.artist = artist; }

    public String getAlbum() { return album; }
    public void setAlbum(String album) { this.album = album; }

    public String getCoverUrl() { return coverUrl; }
    public void setCoverUrl(String coverUrl) { this.coverUrl = coverUrl; }

    public String getVideoId() { return videoId; }
    public void setVideoId(String videoId) { this.videoId = videoId; }

    public String getAudioUrl() { return audioUrl; }
    public void setAudioUrl(String audioUrl) { this.audioUrl = audioUrl; }

    public String getStreamUrl() { return streamUrl; }
    public void setStreamUrl(String streamUrl) { this.streamUrl = streamUrl; }

    public long getDurationSec() { return durationSec; }
    public void setDurationSec(long durationSec) { this.durationSec = durationSec; }

    public boolean isFavorite() { return isFavorite; }
    public void setFavorite(boolean favorite) { isFavorite = favorite; }

    public String getPlayableUrl() {
        if (streamUrl != null && !streamUrl.trim().isEmpty()) {
            return streamUrl.trim();
        }
        if (audioUrl != null && !audioUrl.trim().isEmpty()) {
            return audioUrl.trim();
        }
        return null;
    }
}
