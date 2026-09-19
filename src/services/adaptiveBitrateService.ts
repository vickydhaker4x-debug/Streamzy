import { AbrMetrics, BitrateTier } from '../types';

type AbrListener = (metrics: AbrMetrics) => void;

class AdaptiveBitrateService {
  private currentBitrate: number = 320; // default 320kbps
  private autoAbrEnabled: boolean = true;
  private networkSpeedKbps: number = 15000; // estimated initial speed (15 Mbps)
  private latencyMs: number = 18;
  private bufferHealthSec: number = 24;
  private protocol: string = 'HLS / Chunked ABR';
  private isPrebuffered: boolean = false;
  private prebufferedTrackId?: string;
  private prebufferedTrackTitle?: string;
  private listeners: Set<AbrListener> = new Set();
  private speedSamples: number[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.initNetworkObserver();
      // Perform initial light bandwidth probe in background
      setTimeout(() => this.runSpeedTest(), 1200);
    }
  }

  private initNetworkObserver() {
    const nav = navigator as any;
    if (nav.connection) {
      const conn = nav.connection;
      const updateConn = () => {
        if (conn.downlink) {
          // downlink is in Mbps, convert to kbps
          const kbps = Math.round(conn.downlink * 1000);
          this.addSpeedSample(kbps);
        }
        if (conn.rtt) {
          this.latencyMs = conn.rtt;
        }
        this.evaluateBitrate();
      };

      conn.addEventListener('change', updateConn);
      updateConn();
    }
  }

  public subscribe(listener: AbrListener): () => void {
    this.listeners.add(listener);
    listener(this.getMetrics());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const metrics = this.getMetrics();
    this.listeners.forEach((l) => {
      try {
        l(metrics);
      } catch (e) {
        console.error(e);
      }
    });
  }

  public getMetrics(): AbrMetrics {
    const tier = this.getTierForBitrate(this.currentBitrate);
    const tierLabel = this.getTierLabel(tier);
    return {
      currentBitrateKbps: this.currentBitrate,
      tier,
      tierLabel,
      networkSpeedKbps: this.networkSpeedKbps,
      latencyMs: this.latencyMs,
      bufferHealthSec: Number(this.bufferHealthSec.toFixed(1)),
      protocol: this.protocol,
      isPrebuffered: this.isPrebuffered,
      prebufferedTrackId: this.prebufferedTrackId,
      prebufferedTrackTitle: this.prebufferedTrackTitle
    };
  }

  private getTierForBitrate(bitrate: number): BitrateTier {
    if (bitrate <= 64) return 'dataSaver';
    if (bitrate <= 128) return 'standard';
    if (bitrate <= 256) return 'high';
    return 'audiophile';
  }

  private getTierLabel(tier: BitrateTier): string {
    switch (tier) {
      case 'dataSaver':
        return '64 kbps (Data Saver)';
      case 'standard':
        return '128 kbps (Standard)';
      case 'high':
        return '256 kbps (High Fidelity)';
      case 'audiophile':
        return '320 kbps (Audiophile Lossless)';
    }
  }

  public addSpeedSample(kbps: number) {
    if (kbps <= 0) return;
    this.speedSamples.push(kbps);
    if (this.speedSamples.length > 8) {
      this.speedSamples.shift();
    }
    // Exponential Moving Average
    const sum = this.speedSamples.reduce((a, b) => a + b, 0);
    this.networkSpeedKbps = Math.round(sum / this.speedSamples.length);
    if (this.autoAbrEnabled) {
      this.evaluateBitrate();
    }
  }

  public recordChunkDownload(bytes: number, durationMs: number) {
    if (durationMs <= 0 || bytes <= 0) return;
    const durationSec = durationMs / 1000;
    const bits = bytes * 8;
    const kbps = Math.round(bits / durationSec / 1000);
    this.addSpeedSample(kbps);
  }

  public updateBufferHealth(bufferSec: number) {
    this.bufferHealthSec = Math.max(0, bufferSec);
    if (this.autoAbrEnabled) {
      this.evaluateBitrate();
    }
  }

  public setPrebufferStatus(isPrebuffered: boolean, trackId?: string, trackTitle?: string) {
    this.isPrebuffered = isPrebuffered;
    this.prebufferedTrackId = trackId;
    this.prebufferedTrackTitle = trackTitle;
    this.notify();
  }

  public setAutoAbr(enabled: boolean) {
    this.autoAbrEnabled = enabled;
    if (enabled) {
      this.evaluateBitrate();
    } else {
      this.notify();
    }
  }

  public setManualBitrate(bitrateKbps: number) {
    this.autoAbrEnabled = false;
    this.currentBitrate = bitrateKbps;
    this.notify();
  }

  public setProtocol(proto: string) {
    this.protocol = proto;
    this.notify();
  }

  /**
   * Adaptive Bitrate Selection Algorithm
   * Balances real-time throughput with buffer health
   */
  private evaluateBitrate() {
    if (!this.autoAbrEnabled) return;

    let targetBitrate = 320;
    const speed = this.networkSpeedKbps;
    const buffer = this.bufferHealthSec;

    // Buffer starvation prevention: if buffer is under 4 seconds, downscale immediately to prevent stutter
    if (buffer < 4) {
      targetBitrate = 64; // Urgent data saver to keep audio continuously flowing
    } else if (buffer < 8 || speed < 750) {
      targetBitrate = 128; // Standard
    } else if (speed < 2000) {
      targetBitrate = 256; // High
    } else {
      targetBitrate = 320; // Audiophile
    }

    if (targetBitrate !== this.currentBitrate) {
      this.currentBitrate = targetBitrate;
      this.notify();
    }
  }

  /**
   * Run server-side precision bandwidth & RTT ping benchmark
   */
  public async runSpeedTest(): Promise<{ speedKbps: number; pingMs: number }> {
    const startTime = performance.now();
    try {
      const res = await fetch('/api/stream/speed-test?bytes=65536', {
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('Speed test failed');
      const blob = await res.blob();
      const endTime = performance.now();
      const durationMs = Math.max(1, endTime - startTime);
      const pingHeader = res.headers.get('X-Server-Timestamp');
      if (pingHeader) {
        this.latencyMs = Math.max(5, Math.round(durationMs / 2));
      } else {
        this.latencyMs = Math.round(durationMs / 2);
      }

      this.recordChunkDownload(blob.size, durationMs);
      return { speedKbps: this.networkSpeedKbps, pingMs: this.latencyMs };
    } catch {
      return { speedKbps: this.networkSpeedKbps, pingMs: this.latencyMs };
    }
  }
}

export const adaptiveBitrateService = new AdaptiveBitrateService();
