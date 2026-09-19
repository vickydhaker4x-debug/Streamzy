import { Router, Request, Response } from 'express';
import { streamService, BITRATE_TIERS } from './streamService.ts';

export const streamRouter = Router();

/**
 * GET /api/stream/:trackId/info
 * Returns stream capabilities, chunk counts, bitrates, and manifest URLs
 */
streamRouter.get('/:trackId/info', (req: Request, res: Response) => {
  const { trackId } = req.params;
  const durationSec = parseInt(req.query.duration as string) || 210;

  const meta = streamService.getStreamMeta(trackId, durationSec);
  res.json({
    status: 'ok',
    meta,
    endpoints: {
      hlsMaster: `/api/stream/${trackId}/master.m3u8`,
      dashMpd: `/api/stream/${trackId}/manifest.mpd`,
      prebuffer: `/api/stream/${trackId}/prebuffer`,
      chunkPattern: `/api/stream/${trackId}/chunk?chunkIndex={index}&bitrate={bitrate}`
    }
  });
});

/**
 * GET /api/stream/:trackId/master.m3u8
 * HLS Master Playlist for Adaptive Bitrate Streaming
 */
streamRouter.get('/:trackId/master.m3u8', (req: Request, res: Response) => {
  const { trackId } = req.params;
  const durationSec = parseInt(req.query.duration as string) || 210;

  const playlist = streamService.generateHlsMasterPlaylist(trackId, durationSec);
  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(playlist);
});

/**
 * GET /api/stream/:trackId/variant-:bitrate.m3u8
 * HLS Media Variant Playlist
 */
streamRouter.get('/:trackId/variant-:bitrate.m3u8', (req: Request, res: Response) => {
  const { trackId, bitrate } = req.params;
  const bitrateNum = parseInt(bitrate) || 256;
  const durationSec = parseInt(req.query.duration as string) || 210;

  const playlist = streamService.generateHlsVariantPlaylist(trackId, bitrateNum, durationSec);
  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(playlist);
});

/**
 * GET /api/stream/:trackId/manifest.mpd
 * MPEG-DASH XML Manifest
 */
streamRouter.get('/:trackId/manifest.mpd', (req: Request, res: Response) => {
  const { trackId } = req.params;
  const durationSec = parseInt(req.query.duration as string) || 210;

  const mpd = streamService.generateDashMpd(trackId, durationSec);
  res.setHeader('Content-Type', 'application/dash+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(mpd);
});

/**
 * GET /api/stream/:trackId/chunk
 * Delivers intelligent progressive audio chunks with HTTP 206 Partial Content Range support
 */
streamRouter.get('/:trackId/chunk', (req: Request, res: Response) => {
  const { trackId } = req.params;
  const chunkIndex = parseInt(req.query.chunkIndex as string) || 0;
  const durationSec = 5;

  const audioBuffer = streamService.generateAudioChunkBuffer(trackId, chunkIndex, durationSec);
  const totalSize = audioBuffer.length;

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
    const chunkSize = end - start + 1;

    const slice = audioBuffer.subarray(start, end + 1);

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'audio/wav',
      'Cache-Control': 'public, max-age=86400, immutable'
    });
    res.end(slice);
  } else {
    res.writeHead(200, {
      'Content-Length': totalSize,
      'Accept-Ranges': 'bytes',
      'Content-Type': 'audio/wav',
      'Cache-Control': 'public, max-age=86400, immutable'
    });
    res.end(audioBuffer);
  }
});

/**
 * GET /api/stream/:trackId/segment-:chunkIndex.:ext
 * HLS segment handler
 */
streamRouter.get('/:trackId/segment-:chunkIndex.:ext', (req: Request, res: Response) => {
  const { trackId, chunkIndex } = req.params;
  const chunkIdx = parseInt(chunkIndex) || 0;
  const audioBuffer = streamService.generateAudioChunkBuffer(trackId, chunkIdx, 5);

  res.writeHead(200, {
    'Content-Length': audioBuffer.length,
    'Accept-Ranges': 'bytes',
    'Content-Type': 'audio/wav',
    'Cache-Control': 'public, max-age=86400, immutable'
  });
  res.end(audioBuffer);
});

/**
 * GET /api/stream/:trackId/prebuffer
 * Dedicated high-speed zero-latency initial 10-second audio pre-buffer
 */
streamRouter.get('/:trackId/prebuffer', (req: Request, res: Response) => {
  const { trackId } = req.params;
  const bitrate = parseInt(req.query.bitrate as string) || 256;

  const prebuffer = streamService.getOrCreatePrebuffer(trackId, bitrate);

  res.writeHead(200, {
    'Content-Type': 'audio/wav',
    'Content-Length': prebuffer.length,
    'Accept-Ranges': 'bytes',
    'X-Prebuffer-Duration': '10',
    'X-Prebuffer-Track-Id': trackId,
    'X-Next-Track-Prefetched': 'true',
    'Cache-Control': 'public, max-age=604800, immutable'
  });
  res.end(prebuffer);
});

/**
 * GET /api/stream/:trackId/audio
 * Full audio stream with HTTP 206 Partial Content Range Support
 */
streamRouter.get('/:trackId/audio', (req: Request, res: Response) => {
  const { trackId } = req.params;
  const durationSec = parseInt(req.query.duration as string) || 210;

  const audioBuffer = streamService.getFullAudioBuffer(trackId, durationSec);
  const totalSize = audioBuffer.length;

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
    const chunkSize = end - start + 1;

    const slice = audioBuffer.subarray(start, end + 1);

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'audio/wav',
      'Cache-Control': 'public, max-age=86400, immutable'
    });
    res.end(slice);
  } else {
    res.writeHead(200, {
      'Content-Length': totalSize,
      'Accept-Ranges': 'bytes',
      'Content-Type': 'audio/wav',
      'Cache-Control': 'public, max-age=86400, immutable'
    });
    res.end(audioBuffer);
  }
});

/**
 * POST /api/stream/predict-next
 * Analyzes current playback and queue to direct client pre-buffering
 */
streamRouter.post('/predict-next', (req: Request, res: Response) => {
  const { currentTrackId, queueIds = [], networkSpeedKbps = 2500 } = req.body;

  let nextTrackId = '';
  if (Array.isArray(queueIds) && queueIds.length > 0) {
    nextTrackId = queueIds[0];
  } else if (currentTrackId) {
    nextTrackId = `auto-radio-${currentTrackId}`;
  } else {
    nextTrackId = 'track-kesariya';
  }

  // Calculate recommended bitrate based on user's current internet speed
  let recommendedBitrate: number = BITRATE_TIERS.standard;
  if (networkSpeedKbps >= 4000) {
    recommendedBitrate = BITRATE_TIERS.audiophile; // 320k
  } else if (networkSpeedKbps >= 1500) {
    recommendedBitrate = BITRATE_TIERS.high; // 256k
  } else if (networkSpeedKbps >= 600) {
    recommendedBitrate = BITRATE_TIERS.standard; // 128k
  } else {
    recommendedBitrate = BITRATE_TIERS.dataSaver; // 64k
  }

  res.json({
    status: 'ok',
    prediction: {
      nextTrackId,
      prebufferUrl: `/api/stream/${nextTrackId}/prebuffer?bitrate=${recommendedBitrate}`,
      prebufferDurationSec: 10,
      estimatedBytes: 10 * (recommendedBitrate * 128),
      recommendedBitrate,
      hlsManifestUrl: `/api/stream/${nextTrackId}/master.m3u8`,
      dashMpdUrl: `/api/stream/${nextTrackId}/manifest.mpd`,
      protocol: 'HLS-Intelligent-Chunked'
    }
  });
});

/**
 * GET /api/stream/speed-test
 * Ultra-lightweight endpoint for bandwidth calculation and round-trip ping
 */
streamRouter.get('/speed-test', (req: Request, res: Response) => {
  const payloadSize = parseInt(req.query.bytes as string) || 65536; // 64KB default test payload
  const buffer = Buffer.alloc(Math.min(payloadSize, 524288), 0xAA); // Cap at 512KB

  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': buffer.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Server-Timestamp': Date.now().toString()
  });
  res.end(buffer);
});
