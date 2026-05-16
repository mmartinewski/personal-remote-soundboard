// Single v1 format: HH:MM:SS.mmm, always exactly 12 characters.
// See section 6.2 of the specification.

const TIME_REGEX = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/;

export function isValidTimeString(value: string): boolean {
  const m = TIME_REGEX.exec(value);
  if (!m) return false;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  return hh >= 0 && hh <= 99 && mm >= 0 && mm < 60 && ss >= 0 && ss < 60;
}

export function timeStringToSeconds(value: string): number {
  const m = TIME_REGEX.exec(value);
  if (!m) {
    throw new Error(
      `Invalid time (expected HH:MM:SS.mmm): "${value}"`,
    );
  }
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  const ms = Number(m[4]);
  return hh * 3600 + mm * 60 + ss + ms / 1000;
}

export function secondsToTimeString(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    throw new Error(`Invalid seconds: ${totalSeconds}`);
  }
  const totalMs = Math.round(totalSeconds * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const ss = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const mm = totalMin % 60;
  const hh = Math.floor(totalMin / 60);
  return (
    pad(hh, 2) + ':' + pad(mm, 2) + ':' + pad(ss, 2) + '.' + pad(ms, 3)
  );
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, '0');
}
