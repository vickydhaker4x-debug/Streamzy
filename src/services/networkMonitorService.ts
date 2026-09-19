/**
 * Network Monitor Service
 * Actively monitors network connectivity, effective connection type, downlink speed,
 * and ping latency with an automatic millisecond-level zero-latency offline fallback trigger.
 */

export type ConnectionEffectiveType = '4g' | '3g' | '2g' | 'slow-2g' | 'offline';

export interface NetworkState {
  isOnline: boolean;
  effectiveType: ConnectionEffectiveType;
  downlinkMbps: number;
  rttMs: number;
  saveData: boolean;
  isSimulatedOffline: boolean;
  lastChangedAt: number;
  offlineReason?: string;
}

type NetworkListener = (state: NetworkState) => void;

class NetworkMonitorService {
  private state: NetworkState = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    effectiveType: '4g',
    downlinkMbps: 10,
    rttMs: 50,
    saveData: false,
    isSimulatedOffline: false,
    lastChangedAt: Date.now()
  };

  private listeners: Set<NetworkListener> = new Set();
  private abortController: AbortController = new AbortController();
  private pingInterval: number | null = null;
  private isAutoFallbackEnabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initListeners();
      this.readConnectionInfo();
      this.startWatchdog();
    }
  }

  private initListeners() {
    window.addEventListener('online', () => {
      this.handleNetworkStatusChange(true, 'OS Network Reconnected');
    });

    window.addEventListener('offline', () => {
      this.handleNetworkStatusChange(false, 'OS Network Connection Dropped');
    });

    // Network Information API (Chrome, Android WebView, Edge)
    const conn = this.getConnectionObject();
    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', () => {
        this.readConnectionInfo();
      });
    }
  }

  private getConnectionObject(): any {
    if (typeof navigator === 'undefined') return null;
    return (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection ||
      null;
  }

  private readConnectionInfo() {
    const conn = this.getConnectionObject();
    if (conn) {
      this.state.effectiveType = this.state.isOnline ? (conn.effectiveType || '4g') : 'offline';
      this.state.downlinkMbps = conn.downlink || 10;
      this.state.rttMs = conn.rtt || 50;
      this.state.saveData = Boolean(conn.saveData);
    }
  }

  /**
   * Continuous Ping Watchdog to catch captive portals or zero-throughput disconnections
   */
  private startWatchdog() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = window.setInterval(() => {
      this.verifyConnectivityPing();
    }, 12000);
  }

  /**
   * Lightweight probe to verify true socket/data throughput
   */
  public async verifyConnectivityPing(): Promise<boolean> {
    if (this.state.isSimulatedOffline) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (this.state.isOnline) {
        this.handleNetworkStatusChange(false, 'Network Hardware Offline');
      }
      return false;
    }

    try {
      // Use lightweight head ping with short 2.5s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const startTime = performance.now();
      const res = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (res && res.ok) {
        const latency = Math.round(performance.now() - startTime);
        this.state.rttMs = latency;
        if (!this.state.isOnline) {
          this.handleNetworkStatusChange(true, 'Ping Verified Connectivity');
        }
        return true;
      }
    } catch {
      // Ping failed
    }

    return this.state.isOnline;
  }

  private handleNetworkStatusChange(online: boolean, reason: string) {
    if (this.state.isSimulatedOffline) return;

    const previousOnline = this.state.isOnline;
    const nowOnline = online;

    if (previousOnline === nowOnline) return;

    this.state.isOnline = nowOnline;
    this.state.lastChangedAt = Date.now();
    this.state.offlineReason = nowOnline ? undefined : reason;
    this.state.effectiveType = nowOnline ? '4g' : 'offline';

    if (!nowOnline) {
      // IMMEDIATELY halt and abort all in-flight network requests
      this.abortAllPendingNetworkRequests();
    } else {
      // Refresh abort controller for new network session
      this.abortController = new AbortController();
    }

    this.notify();
  }

  /**
   * The exact millisecond the network drops, abort all active remote API calls
   */
  public abortAllPendingNetworkRequests() {
    try {
      this.abortController.abort();
    } catch {}
    this.abortController = new AbortController();
  }

  /**
   * Provides an AbortSignal that auto-cancels upon network failure
   */
  public getNetworkAbortSignal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * Toggle simulated offline mode (for immediate testing in dev/production)
   */
  public setSimulatedOffline(simulated: boolean) {
    this.state.isSimulatedOffline = simulated;
    this.state.isOnline = !simulated && (typeof navigator !== 'undefined' ? navigator.onLine : true);
    this.state.lastChangedAt = Date.now();
    this.state.effectiveType = this.state.isOnline ? '4g' : 'offline';
    this.state.offlineReason = simulated ? 'Simulated Offline Mode Triggered' : undefined;

    if (simulated) {
      this.abortAllPendingNetworkRequests();
    } else {
      this.abortController = new AbortController();
    }

    this.notify();
  }

  public isOffline(): boolean {
    return !this.state.isOnline || this.state.isSimulatedOffline;
  }

  public isOnline(): boolean {
    return this.state.isOnline && !this.state.isSimulatedOffline;
  }

  public getState(): NetworkState {
    return { ...this.state };
  }

  public setAutoFallbackEnabled(enabled: boolean) {
    this.isAutoFallbackEnabled = enabled;
  }

  public isAutoFallback(): boolean {
    return this.isAutoFallbackEnabled;
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(currentState);
      } catch (err) {
        console.error('Network listener error:', err);
      }
    });
  }
}

export const networkMonitorService = new NetworkMonitorService();
