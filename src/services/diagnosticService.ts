export interface DiagnosticData {
  songTitle?: string;
  artist?: string;
  songId?: string;
  originalSourceUrl?: string;
  resolvedPlaybackUrl?: string;
  httpStatus?: number | string;
  contentType?: string;
  contentLength?: string;
  redirectInfo?: string;
  extension?: string;
  codecContainer?: string;
  playerError?: string;
  activePlayers?: number;
  activeAudioContexts?: number;
  activeMedia3Players?: number;
  duration?: string;
  player?: string;
  decoder?: string;
  buffering?: string;
  audioSession?: string;
  audioEffects?: string;
}

class DiagnosticService {
  private data: DiagnosticData = {};
  private listeners: Set<(data: DiagnosticData) => void> = new Set();
  public isDiagnosticModeEnabled: boolean = false;
  public rawNativePlaybackEnabled: boolean = false;

  public update(newData: Partial<DiagnosticData>) {
    this.data = { ...this.data, ...newData };
    this.notify();
  }

  public getData() {
    return this.data;
  }

  public subscribe(listener: (data: DiagnosticData) => void) {
    this.listeners.add(listener);
    listener(this.data);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l(this.data));
  }

  public toggleDiagnosticMode() {
    this.isDiagnosticModeEnabled = !this.isDiagnosticModeEnabled;
    this.notify();
  }

  public toggleRawNativePlayback() {
    this.rawNativePlaybackEnabled = !this.rawNativePlaybackEnabled;
    this.notify();
  }
}

export const diagnosticService = new DiagnosticService();
