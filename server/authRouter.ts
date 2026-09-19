/**
 * Module 5: Authentication API Routes
 * 
 * Endpoints:
 * - POST /api/auth/register : Register new user account
 * - POST /api/auth/login    : Login with email & password, returns JWT
 * - GET  /api/auth/me       : Verify JWT token & fetch profile
 * - POST /api/auth/refresh  : Refresh valid token
 * - POST /api/auth/logout   : Invalidate token in Redis
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authService, JWTPayload } from './authService.ts';

export const authRouter = Router();

// Middleware: Authenticate Bearer JWT
export async function requireAuth(req: Request & { user?: JWTPayload }, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
  }

  const token = authHeader.substring(7);
  const payload = await authService.verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized: Expired or invalid token signature' });
  }

  req.user = payload;
  next();
}

// Middleware: Optional JWT
export async function optionalAuth(req: Request & { user?: JWTPayload }, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = await authService.verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}

/**
 * POST /api/auth/register
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await authService.register(email, password, displayName || 'Music Lover');
    res.status(201).json({
      status: 'ok',
      message: 'Account registered successfully',
      ...result
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await authService.login(email, password);
    res.json({
      status: 'ok',
      message: 'Authentication successful',
      ...result
    });
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Invalid credentials' });
  }
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', requireAuth, async (req: Request & { user?: JWTPayload }, res: Response) => {
  try {
    const authHeader = req.headers.authorization!;
    const token = authHeader.substring(7);
    const user = await authService.getCurrentUser(token);

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json({
      status: 'ok',
      user,
      tokenClaims: req.user
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await authService.logout(token);
    }
    res.json({ status: 'ok', message: 'Logged out successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
