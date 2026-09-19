/**
 * Module 5: Analytics & Telemetry API Router
 * 
 * Endpoints:
 * - POST /api/telemetry/event  : Log silent playback event (skip, complete, progress, start)
 * - POST /api/telemetry/beacon : Lightweight endpoint for navigator.sendBeacon
 * - GET  /api/telemetry/stats  : Aggregate system telemetry (skip rates, avg duration, completion)
 * - GET  /api/telemetry/track/:trackId : Telemetry summary for a track
 */

import { Router, Request, Response } from 'express';
import { telemetryService, TelemetryEventPayload } from './telemetryService.ts';
import { optionalAuth } from './authRouter.ts';

export const telemetryRouter = Router();

/**
 * POST /api/telemetry/event
 * Silent event tracking
 */
telemetryRouter.post('/event', optionalAuth, async (req: Request & { user?: any }, res: Response) => {
  try {
    const body: TelemetryEventPayload = req.body;
    if (!body.trackId || !body.eventType) {
      return res.status(400).json({ error: 'trackId and eventType are required' });
    }

    // Attach authenticated userId if present
    if (req.user?.userId) {
      body.userId = req.user.userId;
    }

    const summary = await telemetryService.logEvent(body);
    res.json({
      status: 'ok',
      eventReceived: body.eventType,
      trackTelemetry: summary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/telemetry/beacon
 * Fast silent endpoint for page unload / track skipping
 */
telemetryRouter.post('/beacon', (req: Request, res: Response) => {
  try {
    const payload: TelemetryEventPayload = req.body;
    if (payload.trackId && payload.eventType) {
      telemetryService.logEvent(payload).catch((err) => {
        console.warn('[Telemetry] Beacon processing warning:', err);
      });
    }
    res.status(204).end();
  } catch {
    res.status(204).end();
  }
});

/**
 * GET /api/telemetry/stats
 * Global system telemetry
 */
telemetryRouter.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = telemetryService.getGlobalStats();
    res.json({
      status: 'ok',
      ...stats
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/telemetry/track/:trackId
 * Track specific telemetry
 */
telemetryRouter.get('/track/:trackId', (req: Request, res: Response) => {
  try {
    const { trackId } = req.params;
    const summary = telemetryService.getSummaryForTrack(trackId);
    const feedback = telemetryService.getMLRecommendationFeedback(trackId);
    res.json({
      status: 'ok',
      trackId,
      summary,
      mlFeedback: feedback
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
