import { existsSync } from 'node:fs';
import type { AppPaths } from '../config/paths.js';
import { HttpError } from '../middleware/errorHandler.js';

export function assertBinaries(paths: AppPaths): void {
  const missing: string[] = [];
  for (const [label, p] of [
    ['ffmpeg.exe', paths.ffmpegExe],
    ['ffprobe.exe', paths.ffprobeExe],
    ['ffplay.exe', paths.ffplayExe],
    ['yt-dlp.exe', paths.ytDlpExe],
  ] as const) {
    if (!existsSync(p)) missing.push(label);
  }
  if (missing.length > 0) {
    throw new HttpError(
      503,
      `Binários em falta em /bin: ${missing.join(', ')}. Corra npm run fetch:bin.`,
      'binaries_missing',
    );
  }
}
