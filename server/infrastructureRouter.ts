/**
 * Module 5: Infrastructure & Database API Router
 * 
 * Provides transparent visibility into:
 * - PostgreSQL Schema DDL and optimized table definitions
 * - Table row counts, indexes, and primary keys
 * - Redis Cache real-time hit rate, latency, and memory stats
 * - Cache management (flush, inspect keys)
 */

import { Router, Request, Response } from 'express';
import { db, POSTGRESQL_SCHEMA_DDL } from './databaseSchema.ts';
import { redis } from './redisCacheService.ts';

export const infrastructureRouter = Router();

/**
 * GET /api/infrastructure/overview
 * Comprehensive backend infrastructure health & metrics
 */
infrastructureRouter.get('/overview', async (req: Request, res: Response) => {
  try {
    const dbStats = db.getStats();
    const redisStats = redis.getInfo();

    res.json({
      status: 'ok',
      timestamp: Date.now(),
      architecture: {
        backend: 'Express TypeScript Ultra-Fast Music Server',
        databaseEngine: 'PostgreSQL Relational Storage Layer (Fast-Read Optimized)',
        cachingLayer: 'Redis In-Memory Key-Value Store (Sub-Millisecond Read Latency)',
        security: 'HMAC-SHA256 Cryptographic JWT Authentication & PBKDF2 Password Hashing',
        telemetry: 'Silent Listen Duration, Skip Rate & Completion ML Feedback Loop'
      },
      database: dbStats,
      cache: redisStats
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/infrastructure/schema
 * Return formal PostgreSQL DDL
 */
infrastructureRouter.get('/schema', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    dialect: 'PostgreSQL 16+',
    ddl: POSTGRESQL_SCHEMA_DDL
  });
});

/**
 * POST /api/infrastructure/cache/flush
 * Clear Redis cache
 */
infrastructureRouter.post('/cache/flush', async (req: Request, res: Response) => {
  try {
    await redis.flushdb();
    res.json({ status: 'ok', message: 'Redis cache flushed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
