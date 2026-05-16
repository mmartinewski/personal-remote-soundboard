export const YOUTUBE_URL_REGEX =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)[\w-]{6,}([&?][^\s]*)?$/i;

export function isValidYoutubeUrl(value: string): boolean {
  return YOUTUBE_URL_REGEX.test(value.trim());
}
