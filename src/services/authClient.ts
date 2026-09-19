/**
 * Module 5: Client-Side JWT Authentication Service
 * 
 * Manages:
 * - JWT storage in localStorage
 * - User login, registration, and logout
 * - Current user state & event listeners
 * - Authorization Bearer header injection
 */

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
  createdAt: number;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

type AuthListener = (user: AuthUser | null) => void;

class AuthClient {
  private currentToken: string | null = null;
  private currentUser: AuthUser | null = null;
  private listeners: Set<AuthListener> = new Set();
  private isInitialized = false;

  constructor() {
    this.restoreSession();
  }

  private restoreSession() {
    try {
      const storedToken = localStorage.getItem('vd_jwt_auth_token');
      const storedUser = localStorage.getItem('vd_jwt_auth_user');

      if (storedToken && storedUser) {
        this.currentToken = storedToken;
        this.currentUser = JSON.parse(storedUser);
      }
    } catch {
      // Ignore
    }
  }

  public async init(): Promise<AuthUser | null> {
    if (this.isInitialized) return this.currentUser;
    this.isInitialized = true;

    if (!this.currentToken) {
      // Auto-login to demo account if no session exists
      try {
        await this.login('vickydhaker4x@gmail.com', 'musicpass123');
      } catch {
        // Fallback demo user
      }
      return this.currentUser;
    }

    // Verify token with backend
    try {
      const res = await fetch('/api/auth/me', {
        headers: this.getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
        localStorage.setItem('vd_jwt_auth_user', JSON.stringify(data.user));
        this.notify();
      } else {
        // Token expired or invalid
        this.logout();
      }
    } catch {
      // Offline fallback
    }

    return this.currentUser;
  }

  public getAuthHeader(): Record<string, string> {
    if (this.currentToken) {
      return { Authorization: `Bearer ${this.currentToken}` };
    }
    return {};
  }

  public getUser(): AuthUser | null {
    return this.currentUser;
  }

  public getToken(): string | null {
    return this.currentToken;
  }

  public isAuthenticated(): boolean {
    return Boolean(this.currentToken && this.currentUser);
  }

  public async login(email: string, password: string): Promise<AuthUser> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Authentication failed');
    }

    this.currentToken = data.token;
    this.currentUser = data.user;
    localStorage.setItem('vd_jwt_auth_token', data.token);
    localStorage.setItem('vd_jwt_auth_user', JSON.stringify(data.user));
    this.notify();

    return this.currentUser!;
  }

  public async register(email: string, password: string, displayName: string): Promise<AuthUser> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    this.currentToken = data.token;
    this.currentUser = data.user;
    localStorage.setItem('vd_jwt_auth_token', data.token);
    localStorage.setItem('vd_jwt_auth_user', JSON.stringify(data.user));
    this.notify();

    return this.currentUser!;
  }

  public async logout(): Promise<void> {
    if (this.currentToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: this.getAuthHeader()
        });
      } catch {
        // Ignore network errors on logout
      }
    }

    this.currentToken = null;
    this.currentUser = null;
    localStorage.removeItem('vd_jwt_auth_token');
    localStorage.removeItem('vd_jwt_auth_user');
    this.notify();
  }

  public onAuthChange(cb: AuthListener): () => void {
    this.listeners.add(cb);
    cb(this.currentUser);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.currentUser));
  }
}

export const authClient = new AuthClient();
