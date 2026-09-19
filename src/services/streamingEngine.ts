import { Track } from '../types';
import { audioEngine } from '../utils/audioPlayer';

export interface StreamSession {
  trackId: string;
  durationSec: number;
  currentChunkIndex: number;
  totalChunks: number;
  isBuffering: boolean;
}

/**
 * StreamingEngine facade delegating directly to the unified centralized AudioEngine
 */
class StreamingEngine {
  public async playTrack(
    track: Track,
    queue: Track[] = [],
    onTimeUpdate?: (timeSec: number) => void,
    onEnded?: () => void,
    onError?: (err: string) => void
  ): Promise<boolean> {
    await audioEngine.play(track, onTimeUpdate, onEnded, onError, queue);
    return true;
  }

  public async prefetchNextInQueue(currentTrack: Track, queue: Track[]) {
    await audioEngine.prefetchNextInQueue(currentTrack, queue);
  }

  public pause() {
    audioEngine.pause();
  }

  public resume() {
    audioEngine.resume();
  }

  public seek(seconds: number) {
    audioEngine.seek(seconds);
  }

  public setVolume(vol: number) {
    audioEngine.setVolume(vol);
  }

  public getPrebufferedTrack(): Track | null {
    return audioEngine.getPrebufferedTrack();
  }
}

export const streamingEngine = new StreamingEngine();
