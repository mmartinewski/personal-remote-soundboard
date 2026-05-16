import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface CutToMp3Options {
  ffmpegExe: string;
  inputFile: string;
  outputFile: string;
  startSeconds: number;
  durationSeconds: number;
  sourceDurationSeconds?: number;
  normalizeAudio?: boolean;
  /** Bitrate constante (ex.: "192k"). */
  bitrate?: string;
}

export async function cutToMp3(options: CutToMp3Options): Promise<void> {
  const bitrate = options.bitrate ?? '192k';
  const args = [
    '-y',
    '-loglevel',
    'error',
    '-i',
    options.inputFile,
    '-ss',
    options.startSeconds.toFixed(3),
    '-t',
    options.durationSeconds.toFixed(3),
    '-vn',
  ];

  if (options.normalizeAudio) {
    args.push('-af', 'loudnorm=I=-14:TP=-1.0:LRA=11');
  }

  args.push(
    '-acodec',
    'libmp3lame',
    '-b:a',
    bitrate,
    options.outputFile,
  );

  await execFileAsync(options.ffmpegExe, args);
}
