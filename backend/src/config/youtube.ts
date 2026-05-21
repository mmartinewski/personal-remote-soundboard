import { existsSync, readFileSync } from 'node:fs';

const ALLOWED_COOKIE_BROWSERS = new Set([
  'brave',
  'chrome',
  'chromium',
  'edge',
  'firefox',
  'opera',
  'safari',
  'vivaldi',
  'whale',
]);

export interface YoutubeConfig {
  readonly cookiesFromBrowser?: string;
  readonly cookiesFile?: string;
}

export function resolveYoutubeConfig(
  configFilePath: string,
  defaultCookiesFile?: string,
): YoutubeConfig {
  let cookiesFile = defaultCookiesFile?.trim() || undefined;
  let cookiesFromBrowser: string | undefined;

  if (existsSync(configFilePath)) {
    try {
      const raw = readFileSync(configFilePath, 'utf8');
      const parsed = JSON.parse(raw) as {
        youtube_cookies_from_browser?: unknown;
        youtube_cookies_file?: unknown;
      };

      if (typeof parsed.youtube_cookies_file === 'string' && parsed.youtube_cookies_file.trim()) {
        cookiesFile = parsed.youtube_cookies_file.trim();
      }
      if (typeof parsed.youtube_cookies_from_browser === 'string') {
        cookiesFromBrowser = parsed.youtube_cookies_from_browser.trim().toLowerCase();
      }
    } catch (err) {
      console.warn(
        `[config] Failed to read YouTube settings from ${configFilePath}. Detail:`,
        err,
      );
    }
  }

  if (cookiesFromBrowser && !ALLOWED_COOKIE_BROWSERS.has(cookiesFromBrowser)) {
    console.warn(
      `[config] Ignoring unknown youtube_cookies_from_browser value: ${cookiesFromBrowser}`,
    );
    cookiesFromBrowser = undefined;
  }

  if (cookiesFile && existsSync(cookiesFile)) {
    return { cookiesFile };
  }

  if (cookiesFromBrowser) {
    return { cookiesFromBrowser };
  }

  return {};
}
