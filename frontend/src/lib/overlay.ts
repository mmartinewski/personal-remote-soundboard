/** Browser overlay page path (OBS / Streamlabs Browser Source). */
export const BROWSER_OVERLAY_PATH = '/overlay/browser';

export function getBrowserOverlayUrl(origin = window.location.origin): string {
  return `${origin.replace(/\/$/, '')}${BROWSER_OVERLAY_PATH}`;
}
