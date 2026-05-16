import { spawn, type ChildProcess } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import { logger } from '../lib/logger.js';

let activeProcess: ChildProcess | null = null;
let activeCleanupFile: string | null = null;

export interface PlayOptions {
  ffplayExe: string;
  audioFile: string;
  /** Volume 0-300. 100 is ffplay's neutral volume. */
  volume: number;
  /** Applies perceptual normalization to the preview. */
  normalizeAudio?: boolean;
  /** Start in seconds (decimal); when omitted, plays from the beginning. */
  startSeconds?: number;
  /** Duration in seconds (decimal); when omitted, plays until the end. */
  durationSeconds?: number;
  /** Removes this file when playback finishes or is interrupted. */
  cleanupFileOnExit?: string;
}

export function playAudio(options: PlayOptions): void {
  stopActivePlayback();
  const volume = clampVolume(options.volume);

  const args: string[] = [
    '-nodisp',
    '-autoexit',
    '-loglevel',
    'error',
    '-volume',
    String(Math.min(volume, 100)),
  ];

  const filters = buildAudioFilters({
    normalizeAudio: options.normalizeAudio === true,
    volume,
  });
  if (filters.length > 0) {
    args.push('-af', filters.join(','));
  }

  if (typeof options.startSeconds === 'number') {
    args.push('-ss', formatSeconds(options.startSeconds));
  }
  if (typeof options.durationSeconds === 'number') {
    args.push('-t', formatSeconds(options.durationSeconds));
  }
  args.push(options.audioFile);

  const child = spawn(options.ffplayExe, args, {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });

  child.on('exit', (code, signal) => {
    if (activeProcess === child) activeProcess = null;
    cleanupActiveFile(child);
    logger.debug('ffplay exited', { code, signal });
  });

  child.on('error', (err) => {
    if (activeProcess === child) activeProcess = null;
    cleanupActiveFile(child);
    logger.error('failed to run ffplay', err);
  });

  activeProcess = child;
  activeCleanupFile = options.cleanupFileOnExit ?? null;
}

export function stopActivePlayback(): void {
  if (!activeProcess) return;
  try {
    activeProcess.kill();
  } catch (err) {
    logger.warn('error stopping active playback', err);
  }
  cleanupActiveFile(activeProcess);
  activeProcess = null;
}

export function isPlaying(): boolean {
  return activeProcess !== null;
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 75;
  return Math.max(0, Math.min(300, Math.round(value)));
}

function buildAudioFilters(options: {
  normalizeAudio: boolean;
  volume: number;
}): string[] {
  const filters: string[] = [];
  if (options.normalizeAudio) {
    filters.push('loudnorm=I=-14:TP=-1.0:LRA=11');
  }
  if (options.volume > 100) {
    filters.push(`volume=${(options.volume / 100).toFixed(2)}`);
  }
  return filters;
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0';
  return value.toFixed(3);
}

function cleanupActiveFile(child: ChildProcess): void {
  if (activeProcess && activeProcess !== child) return;
  const filePath = activeCleanupFile;
  activeCleanupFile = null;
  if (!filePath) return;
  try {
    unlinkSync(filePath);
  } catch (err) {
    logger.warn('error removing temporary preview', err);
  }
}
