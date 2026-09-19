const STORAGE_KEY = 'vd_music_subscribed_artists_v1';

type Listener = () => void;

class SubscriptionService {
  private subscribed: Set<string> = new Set();
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.load();
  }

  private load() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.subscribed = new Set(parsed);
          return;
        }
      }
      // Initial friendly defaults
      this.subscribed = new Set(['Arijit Singh', 'The Weeknd', 'AP Dhillon']);
      this.save();
    } catch {
      this.subscribed = new Set(['Arijit Singh', 'The Weeknd']);
    }
  }

  private save() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.subscribed)));
    } catch {}
  }

  private notify() {
    this.save();
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.error(e);
      }
    });
  }

  public subscribeListener(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public isSubscribed(artistName: string): boolean {
    if (!artistName) return false;
    // Check direct match or normalized match
    const norm = artistName.trim().toLowerCase();
    for (const sub of this.subscribed) {
      if (sub.trim().toLowerCase() === norm) return true;
    }
    return false;
  }

  public subscribe(artistName: string): void {
    if (!artistName) return;
    this.subscribed.add(artistName.trim());
    this.notify();
  }

  public unsubscribe(artistName: string): void {
    if (!artistName) return;
    const norm = artistName.trim().toLowerCase();
    for (const sub of this.subscribed) {
      if (sub.trim().toLowerCase() === norm) {
        this.subscribed.delete(sub);
      }
    }
    this.notify();
  }

  public toggleSubscription(artistName: string): boolean {
    if (this.isSubscribed(artistName)) {
      this.unsubscribe(artistName);
      return false;
    } else {
      this.subscribe(artistName);
      return true;
    }
  }

  public getAllSubscribed(): string[] {
    return Array.from(this.subscribed);
  }
}

export const subscriptionService = new SubscriptionService();
