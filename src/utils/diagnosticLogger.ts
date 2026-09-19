import { diagnosticService } from '../services/diagnosticService';
import { StreamInfo } from './pipedApi';
import { Track } from '../types';

export function logPlaybackDiagnostics(
  track: Track, 
  streamInfo: StreamInfo | null, 
  directUrl: string | null,
  isNative: boolean
) {
  const isYoutube = track.videoId ? true : false;
  
  diagnosticService.update({
    songTitle: track.title,
    artist: track.artist || 'Unknown',
    songId: track.id,
    originalSourceUrl: track.videoId ? `youtube:${track.videoId}` : track.audioUrl || track.streamUrl || 'unknown',
    resolvedPlaybackUrl: directUrl || 'none',
    contentType: streamInfo?.mimeType || 'unknown',
    codecContainer: streamInfo?.mimeType ? (streamInfo.mimeType.includes('mp4') ? 'm4a/aac' : streamInfo.mimeType.includes('webm') ? 'webm/opus' : 'unknown') : 'unknown',
    player: isNative ? (diagnosticService.rawNativePlaybackEnabled ? 'Media3 (RAW)' : 'Media3') : 'WebAudio / HTML5',
    activePlayers: 1,
    activeMedia3Players: isNative ? 1 : 0,
    duration: track.duration,
  });
}
