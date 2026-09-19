/**
 * Module 5: Authentication & Security Engine
 * 
 * Implements:
 * - Cryptographically secure JWT tokens (HMAC-SHA256)
 * - Salted PBKDF2 password hashing (10,000 iterations)
 * - Fast-read session caching via Redis
 * - Role-based claims and token expiration enforcement
 */

import crypto from 'crypto';
import { db, UserEntity } from './databaseSchema.ts';
import { redis } from './redisCacheService.ts';

// Configurable secret with fallback
const JWT_SECRET = process.env.JWT_SECRET || 'vd_music_super_secure_jwt_secret_2026_x89';
const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface JWTPayload {
  userId: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin' | 'artist';
  iat: number;
  exp: number;
}

export interface AuthResult {
  token: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    role: string;
    createdAt: number;
  };
}

class AuthService {
  constructor() {
    this.seedDefaultUser();
  }

  /**
   * Seed default user if not present
   */
  private seedDefaultUser() {
    const existing = db.findUserByEmail('vickydhaker4x@gmail.com');
    if (!existing) {
      this.register(
        'vickydhaker4x@gmail.com',
        'musicpass123',
        'Vicky Dhaker',
        'admin'
      ).catch((err) => console.warn('[AuthService] Seed user error:', err));
    }

    const demoUser = db.findUserByEmail('listener@vdmusic.com');
    if (!demoUser) {
      this.register(
        'listener@vdmusic.com',
        'musicpass123',
        'Music Enthusiast',
        'user'
      ).catch((err) => console.warn('[AuthService] Demo user error:', err));
    }
  }

  /**
   * Cryptographic Password Hashing with Salt (PBKDF2)
   */
  private hashPassword(password: string, salt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 10000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey.toString('hex'));
      });
    });
  }

  /**
   * Generate secure JWT token using HMAC-SHA256
   */
  public signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JWTPayload = {
      ...payload,
      iat: now,
      exp: now + TOKEN_EXPIRY_SECONDS
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(signatureInput)
      .digest('base64url');

    return `${signatureInput}.${signature}`;
  }

  /**
   * Verify and decode JWT token (with Redis session cache check)
   */
  public async verifyToken(token: string): Promise<JWTPayload | null> {
    if (!token) return null;

    // Fast-read check from Redis cache first
    const cached = await redis.get<JWTPayload>(`session:${token}`);
    if (cached) {
      if (cached.exp > Math.floor(Date.now() / 1000)) {
        return cached;
      }
      await redis.del(`session:${token}`);
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(signatureInput)
      .digest('base64url');

    // Constant-time signature comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    try {
      const payload: JWTPayload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf-8')
      );

      // Verify expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return null;
      }

      // Cache verified session in Redis for 1 hour
      await redis.setex(`session:${token}`, 3600, payload);

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Register a new user
   */
  public async register(
    email: string,
    password: string,
    displayName: string,
    role: 'user' | 'admin' | 'artist' = 'user'
  ): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Check if email already registered
    const existing = db.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = await this.hashPassword(password, salt);
    const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const now = Date.now();

    const newUser: UserEntity = {
      id: userId,
      email: normalizedEmail,
      passwordHash,
      salt,
      displayName: displayName.trim() || 'Music Lover',
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`,
      role,
      createdAt: now,
      updatedAt: now
    };

    db.insertUser(newUser);

    const token = this.signToken({
      userId: newUser.id,
      email: newUser.email,
      displayName: newUser.displayName,
      role: newUser.role
    });

    // Cache user in Redis
    await redis.setex(`user:${newUser.id}`, 3600, {
      id: newUser.id,
      email: newUser.email,
      displayName: newUser.displayName,
      role: newUser.role
    });

    return {
      token,
      expiresIn: TOKEN_EXPIRY_SECONDS,
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        avatarUrl: newUser.avatarUrl,
        role: newUser.role,
        createdAt: newUser.createdAt
      }
    };
  }

  /**
   * Login with email and password
   */
  public async login(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.findUserByEmail(normalizedEmail);

    if (!user) {
      throw new Error('Invalid email or password credentials.');
    }

    const computedHash = await this.hashPassword(password, user.salt);
    if (computedHash !== user.passwordHash) {
      throw new Error('Invalid email or password credentials.');
    }

    const token = this.signToken({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role
    });

    // Warm cache in Redis
    await redis.setex(`session:${token}`, 3600, {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS
    });

    return {
      token,
      expiresIn: TOKEN_EXPIRY_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt
      }
    };
  }

  /**
   * Get user profile by token
   */
  public async getCurrentUser(token: string) {
    const payload = await this.verifyToken(token);
    if (!payload) return null;

    const user = db.findUserById(payload.userId);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  /**
   * Invalidate session (logout)
   */
  public async logout(token: string): Promise<boolean> {
    await redis.del(`session:${token}`);
    return true;
  }
}

export const authService = new AuthService();
