// Espelho da implementação do backend (backend/src/services/timeFormat.ts).
// Formato único: HH:MM:SS.mmm. Ver §6.2 da especificação.

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
  if (!m) throw new Error(`Tempo inválido (esperado HH:MM:SS.mmm): "${value}"`);
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  const ms = Number(m[4]);
  return hh * 3600 + mm * 60 + ss + ms / 1000;
}

export function secondsToTimeString(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '00:00:00.000';
  }
  const totalMs = Math.round(totalSeconds * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const ss = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const mm = totalMin % 60;
  const hh = Math.floor(totalMin / 60);
  return (
    String(hh).padStart(2, '0') +
    ':' +
    String(mm).padStart(2, '0') +
    ':' +
    String(ss).padStart(2, '0') +
    '.' +
    String(ms).padStart(3, '0')
  );
}
