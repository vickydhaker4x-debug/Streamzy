const STORAGE_KEY = 'vd_music_subscribed_artists_v1';

type Listener = () => void;

class SubscriptionService {
  constructor() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }

  public subscribeListener(_listener: Listener): () => void {
    return () => {};
  }

  public isSubscribed(_artistName: string): boolean {
    return false;
  }

  public subscribe(_artistName: string): void {}

  public unsubscribe(_artistName: string): void {}

  public toggleSubscription(_artistName: string): boolean {
    return false;
  }

  public getAllSubscribed(): string[] {
    return [];
  }
}

export const subscriptionService = new SubscriptionService();
