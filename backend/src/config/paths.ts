import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));

const repoRootCandidate = resolve(moduleDir, '..', '..', '..');

const APPDATA_ROOT =
  process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');

const APP_FOLDER_NAME = 'LocalSoundboardServer';

export interface AppPaths {
  readonly appData: string;
  readonly database: string;
  readonly databaseFile: string;
  readonly mediaAudio: string;
  readonly mediaThumbnails: string;
  readonly mediaTemp: string;
  readonly logs: string;
  readonly logFile: string;
  readonly bin: string;
  readonly ffmpegExe: string;
  readonly ffprobeExe: string;
  readonly ffplayExe: string;
  readonly ytDlpExe: string;
  readonly configFile: string;
  readonly frontendDist: string;
}

export function resolvePaths(): AppPaths {
  const appData = join(APPDATA_ROOT, APP_FOLDER_NAME);
  const database = join(appData, 'database');
  const mediaAudio = join(appData, 'media', 'audio');
  const mediaThumbnails = join(appData, 'media', 'thumbnails');
  const mediaTemp = join(appData, 'media', 'temp');
  const logs = join(appData, 'logs');

  const bin = join(repoRootCandidate, 'bin');
  const configFile = join(repoRootCandidate, 'config', 'config.json');
  const frontendDist = join(repoRootCandidate, 'frontend', 'dist');

  return {
    appData,
    database,
    databaseFile: join(database, 'storage.db'),
    mediaAudio,
    mediaThumbnails,
    mediaTemp,
    logs,
    logFile: join(logs, 'latest.log'),
    bin,
    ffmpegExe: join(bin, 'ffmpeg.exe'),
    ffprobeExe: join(bin, 'ffprobe.exe'),
    ffplayExe: join(bin, 'ffplay.exe'),
    ytDlpExe: join(bin, 'yt-dlp.exe'),
    configFile,
    frontendDist,
  };
}

export function ensureAppDataDirs(paths: AppPaths): void {
  for (const dir of [
    paths.appData,
    paths.database,
    paths.mediaAudio,
    paths.mediaThumbnails,
    paths.mediaTemp,
    paths.logs,
  ]) {
    mkdirSync(dir, { recursive: true });
  }
}
