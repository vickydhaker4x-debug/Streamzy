import { Router, Request, Response } from 'express';
import { accountDatabase } from './accountDatabase.ts';

export const syncRouter = Router();

/**
 * GET /api/sync/stream
 * Server-Sent Events (SSE) endpoint for real-time continuous state synchronization across devices.
 * If a user likes a song on their phone, this stream pushes the update to their other devices instantly (< 50ms).
 */
syncRouter.get('/stream', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'default_user';
  const deviceId = (req.query.deviceId as string) || 'unknown-device';
  const deviceName = (req.query.deviceName as string) || 'Connected Client';

  // Configure headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  console.log(`[SSE Sync] Client connected: deviceId=${deviceId}, userId=${userId}`);

  // Register device presence
  accountDatabase.registerDevice(userId, deviceId, deviceName);

  // Send initial connected event with current state
  const account = accountDatabase.getAccount(userId);
  res.write(`event: initial_state\ndata: ${JSON.stringify({
    userId,
    account,
    timestamp: Date.now()
  })}\n\n`);

  // Subscribe to real-time account updates
  const unsubscribe = accountDatabase.subscribe(userId, (event) => {
    // Send event to this client
    res.write(`event: ${event.type.toLowerCase()}\ndata: ${JSON.stringify({
      ...event,
      timestamp: Date.now()
    })}\n\n`);
  });

  // Keep-alive heartbeat every 15 seconds
  const heartbeatInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  // Handle client disconnection
  req.on('close', () => {
    console.log(`[SSE Sync] Client disconnected: deviceId=${deviceId}`);
    clearInterval(heartbeatInterval);
    unsubscribe();
  });
});

/**
 * GET /api/sync/state
 * Retrieves complete current account database snapshot for a user
 */
syncRouter.get('/state', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'default_user';
  const account = accountDatabase.getAccount(userId);
  res.json({
    status: 'ok',
    account,
    syncedAt: Date.now()
  });
});

/**
 * POST /api/sync/action
 * Executes an atomic action on the user's account database and broadcasts to all connected devices in real-time
 */
syncRouter.post('/action', (req: Request, res: Response) => {
  try {
    const { userId = 'default_user', type, deviceId, payload } = req.body;

    switch (type) {
      case 'LIKE_TRACK': {
        const { trackId, isLiked } = payload;
        const result = accountDatabase.likeTrack(userId, trackId, Boolean(isLiked), deviceId);
        return res.json({ status: 'ok', action: type, result });
      }

      case 'UPDATE_QUEUE': {
        const { currentTrackId, currentTrack, queueTrackIds, queueTracks, isPlaying, progressSec } = payload;
        const updated = accountDatabase.updateQueue(
          userId,
          { currentTrackId, currentTrack, queueTrackIds, queueTracks, isPlaying, progressSec },
          deviceId
        );
        return res.json({ status: 'ok', action: type, queue: updated.upNextQueue });
      }

      case 'UPDATE_PLAYLISTS': {
        const { playlists } = payload;
        const updated = accountDatabase.updatePlaylists(userId, playlists, deviceId);
        return res.json({ status: 'ok', action: type, playlists: updated.playlists });
      }

      case 'RECORD_PLAY': {
        const { trackId, loopCount, durationSec, timeOfDay } = payload;
        const updated = accountDatabase.recordPlayback(userId, {
          trackId,
          loopCount,
          durationSec,
          timeOfDay,
          deviceId
        });
        return res.json({ status: 'ok', action: type, recentEventCount: updated.playbackEvents.length });
      }

      case 'REGISTER_DEVICE': {
        const { deviceName, platform } = payload;
        const updated = accountDatabase.registerDevice(userId, deviceId, deviceName, platform);
        return res.json({ status: 'ok', action: type, devices: updated.devices });
      }

      default:
        return res.status(400).json({ error: `Unknown action type: ${type}` });
    }
  } catch (err: any) {
    console.error('[syncRouter] Action failure:', err);
    res.status(500).json({ error: 'Failed to process sync action', details: err?.message });
  }
});

/**
 * POST /api/sync/state
 * Pushes full local state to merge into the account database
 */
syncRouter.post('/state', (req: Request, res: Response) => {
  try {
    const { userId = 'default_user', deviceId, likedTrackIds, playlists, upNextQueue } = req.body;

    const updated = accountDatabase.updateAccount(
      userId,
      (acc) => {
        if (Array.isArray(likedTrackIds)) {
          // Merge liked track IDs
          const merged = new Set([...acc.likedTrackIds, ...likedTrackIds]);
          acc.likedTrackIds = Array.from(merged);
        }
        if (Array.isArray(playlists)) {
          acc.playlists = playlists;
        }
        if (upNextQueue) {
          acc.upNextQueue = {
            ...acc.upNextQueue,
            ...upNextQueue,
            updatedAt: Date.now(),
            updatedByDeviceId: deviceId
          };
        }
      },
      deviceId,
      'FULL_SYNC_UPDATE'
    );

    res.json({ status: 'ok', account: updated });
  } catch (err: any) {
    console.error('[syncRouter] State push failure:', err);
    res.status(500).json({ error: 'Failed to push state', details: err?.message });
  }
});

/**
 * GET /api/sync/devices
 * Lists all registered devices connected to the account database
 */
syncRouter.get('/devices', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'default_user';
  const account = accountDatabase.getAccount(userId);
  res.json({
    status: 'ok',
    userId,
    devices: account.devices,
    totalDevices: account.devices.length
  });
});

/**
 * POST /api/sync/simulate-phone-action
 * High-utility testing endpoint: Simulates an action coming from the user's secondary mobile phone device.
 * For example: user clicks "Simulate Phone Like" -> instantly shows real-time SSE reflection!
 */
syncRouter.post('/simulate-phone-action', (req: Request, res: Response) => {
  try {
    const userId = (req.body.userId as string) || 'default_user';
    const actionType = req.body.actionType || 'LIKE_RANDOM';
    const simulatedDeviceId = 'simulated-phone-pixel';
    const simulatedDeviceName = 'Pixel 8 Phone (Mobile)';

    // Register simulated device
    accountDatabase.registerDevice(userId, simulatedDeviceId, simulatedDeviceName, 'mobile');

    if (actionType === 'LIKE_TRACK' || actionType === 'LIKE_RANDOM') {
      const targetTrackId = req.body.trackId || 'track-apna-bana-le';
      const isLiked = req.body.isLiked !== undefined ? Boolean(req.body.isLiked) : true;
      const result = accountDatabase.likeTrack(userId, targetTrackId, isLiked, simulatedDeviceId);

      return res.json({
        status: 'ok',
        simulatedFrom: simulatedDeviceName,
        action: 'LIKE_TRACK',
        trackId: targetTrackId,
        isLiked,
        likedTrackIds: result.likedTrackIds
      });
    }

    if (actionType === 'UPDATE_QUEUE') {
      const trackId = req.body.trackId || 'track-kesariya';
      const updated = accountDatabase.updateQueue(
        userId,
        {
          currentTrackId: trackId,
          queueTrackIds: ['track-chaleya', 'track-preet-re', 'track-lofi-lovee'],
          isPlaying: true
        },
        simulatedDeviceId
      );

      return res.json({
        status: 'ok',
        simulatedFrom: simulatedDeviceName,
        action: 'UPDATE_QUEUE',
        queue: updated.upNextQueue
      });
    }

    res.status(400).json({ error: 'Unknown simulated action type' });
  } catch (err: any) {
    console.error('[syncRouter] Simulate phone action failed:', err);
    res.status(500).json({ error: 'Simulation failed', details: err?.message });
  }
});
