import { spawn, type ChildProcess } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import { logger } from '../lib/logger.js';

let activeProcess: ChildProcess | null = null;
let activeCleanupFile: string | null = null;

export interface PlayOptions {
  ffplayExe: string;
  audioFile: string;
  /** Volume 0–300. 100 é o volume neutro do ffplay. */
  volume: number;
  /** Aplica normalização perceptual na pré-escuta. */
  normalizeAudio?: boolean;
  /** Início em segundos (decimal); se omitido, toca do princípio. */
  startSeconds?: number;
  /** Duração em segundos (decimal); se omitido, toca até ao fim. */
  durationSeconds?: number;
  /** Remove este ficheiro quando a reprodução terminar ou for interrompida. */
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
    logger.debug('ffplay encerrou', { code, signal });
  });

  child.on('error', (err) => {
    if (activeProcess === child) activeProcess = null;
    cleanupActiveFile(child);
    logger.error('falha a executar ffplay', err);
  });

  activeProcess = child;
  activeCleanupFile = options.cleanupFileOnExit ?? null;
}

export function stopActivePlayback(): void {
  if (!activeProcess) return;
  try {
    activeProcess.kill();
  } catch (err) {
    logger.warn('erro a parar reprodução activa', err);
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
    logger.warn('erro a remover preview temporário', err);
  }
}
