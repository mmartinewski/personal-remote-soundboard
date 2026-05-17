import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const YOUTUBE_URL_REGEX =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)[\w-]{6,}([&?][^\s]*)?$/i;

export function isValidYoutubeUrl(url: string): boolean {
  return YOUTUBE_URL_REGEX.test(url.trim());
}

export function getYoutubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./i, '').replace(/^m\./i, '');
  if (host === 'youtu.be') {
    return normalizeVideoId(parsed.pathname.split('/').filter(Boolean)[0]);
  }

  if (host !== 'youtube.com') return null;
  const watchId = normalizeVideoId(parsed.searchParams.get('v'));
  if (watchId) return watchId;

  const [kind, id] = parsed.pathname.split('/').filter(Boolean);
  if (kind === 'shorts' || kind === 'embed' || kind === 'live') {
    return normalizeVideoId(id);
  }
  return null;
}

export function getYoutubeThumbnailCandidates(url: string): string[] {
  const videoId = getYoutubeVideoId(url);
  if (!videoId) return [];
  return [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  ];
}

function normalizeVideoId(value: string | null | undefined): string | null {
  if (!value || !/^[\w-]{6,}$/.test(value)) return null;
  return value;
}

export interface DownloadAudioOptions {
  ytDlpExe: string;
  ffmpegExe: string;
  url: string;
  /** Final path without extension; yt-dlp adds the downloaded format extension. */
  outputBase: string;
}

export async function getYoutubeTitle(
  ytDlpExe: string,
  url: string,
): Promise<string> {
  const { stdout } = await execFileAsync(ytDlpExe, [
    '--no-playlist',
    '--no-warnings',
    '--skip-download',
    '--print',
    'title',
    url,
  ]);
  return stdout.trim().split(/\r?\n/).filter(Boolean).pop() ?? '';
}

/**
 * Downloads only the best available audio stream.
 * Returns the generated file path, with the extension chosen by yt-dlp.
 */
export async function downloadBestAudio(options: DownloadAudioOptions): Promise<string> {
  const { stdout } = await execFileAsync(options.ytDlpExe, [
    '-f',
    'bestaudio',
    '--no-playlist',
    '--no-warnings',
    '--ffmpeg-location',
    options.ffmpegExe,
    '--print',
    'after_move:filepath',
    '-o',
    `${options.outputBase}.%(ext)s`,
    options.url,
  ]);
  const filePath = stdout.trim().split(/\r?\n/).pop() ?? '';
  if (!filePath) {
    throw new Error('yt-dlp did not return the downloaded file path.');
  }
  return filePath;
}
