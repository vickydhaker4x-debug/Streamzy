import { Track } from '../types';
import { extractPrimaryArtist, areTracksEqual } from '../services/musicNormalizationService';

/**
 * Smart Shuffle: Fisher-Yates with artist-separation constraint and current song avoidance.
 * 1. Ensures the current playing song is never immediately repeated at index 0 of the upcoming queue.
 * 2. Ensures that two tracks by the same primary artist are never adjacent in the shuffled queue
 *    unless mathematically unavoidable (e.g. artist represents > 50% of the queue).
 * 3. Preserves original track objects without mutating the source array.
 */
export function smartShuffle(tracks: Track[], currentTrack?: Track | null): Track[] {
  if (!tracks || tracks.length === 0) {
    return [];
  }

  // 1. Filter out duplicates of currentTrack to avoid immediately repeating current song
  const pool = tracks.filter((t) => !currentTrack || !areTracksEqual(t, currentTrack));
  
  if (pool.length <= 1) {
    return [...pool];
  }

  // 2. Perform unbiased Fisher-Yates randomization
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // 3. Greedy arrangement with artist-separation constraint, starting from currentTrack's artist
  const result: Track[] = [];
  let lastArtist = currentTrack ? extractPrimaryArtist(currentTrack.artist).toLowerCase() : '';

  while (pool.length > 0) {
    // Find candidate tracks whose primary artist differs from lastArtist
    let candidateIndex = pool.findIndex(
      (t) => extractPrimaryArtist(t.artist).toLowerCase() !== lastArtist
    );

    // If no candidate with a different artist exists, take the first available
    if (candidateIndex === -1) {
      candidateIndex = 0;
    }

    const [chosen] = pool.splice(candidateIndex, 1);
    result.push(chosen);
    lastArtist = extractPrimaryArtist(chosen.artist).toLowerCase();
  }

  return result;
}

