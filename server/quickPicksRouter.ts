import { Router, Request, Response } from 'express';
import { quickPicksService } from './quickPicksService.ts';

export const quickPicksRouter = Router();

/**
 * GET /api/quick-picks
 * Dynamically computes and returns Quick Picks based on:
 * 1. Recency: Songs played in last 7 days
 * 2. Frequency: High loop count and repeat plays
 * 3. Context: Time of day habits (morning vs. night)
 */
quickPicksRouter.get('/', (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'default_user';
    const timeOfDay = req.query.timeOfDay as 'morning' | 'afternoon' | 'evening' | 'night' | undefined;
    const clientHour = req.query.clientHour ? parseInt(req.query.clientHour as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 16;

    const result = quickPicksService.generateQuickPicks(userId, timeOfDay, clientHour, limit);
    res.json(result);
  } catch (err: any) {
    console.error('[quickPicksRouter] Failed to generate quick picks:', err);
    res.status(500).json({ error: 'Failed to generate Quick Picks', details: err?.message });
  }
});

/**
 * POST /api/quick-picks
 * Allows passing client contextual filters and custom seed preferences
 */
quickPicksRouter.post('/', (req: Request, res: Response) => {
  try {
    const { userId = 'default_user', timeOfDay, clientHour, limit = 16 } = req.body;
    const result = quickPicksService.generateQuickPicks(userId, timeOfDay, clientHour, limit);
    res.json(result);
  } catch (err: any) {
    console.error('[quickPicksRouter] Failed to generate quick picks (POST):', err);
    res.status(500).json({ error: 'Failed to generate Quick Picks', details: err?.message });
  }
});

/**
 * GET /api/quick-picks/pillars
 * Explains the 3 pillars and current algorithmic weights
 */
quickPicksRouter.get('/pillars', (req: Request, res: Response) => {
  res.json({
    module: 'Module 4: Quick Picks & Library Algorithmic Logic',
    pillars: [
      {
        name: 'Recency',
        window: 'Last 7 Days',
        description: 'Analyzes user playback timestamps within the trailing 168-hour window with exponential time-decay bonus.',
        weight: 'Up to +60 pts'
      },
      {
        name: 'Frequency',
        window: 'All-Time & Sessions',
        description: 'Awards massive affinity multipliers to high loop counts (+22 pts/loop) and repeated song plays (+8 pts/play).',
        weight: 'Up to +100+ pts'
      },
      {
        name: 'Context (Time of Day)',
        window: 'Daypart Quad (Morning, Afternoon, Evening, Night)',
        description: 'Dynamically shifts acoustic profiles and aligns with learned personal listening habits for that specific hour.',
        weight: 'Up to +42 pts'
      }
    ]
  });
});
