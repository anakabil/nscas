// Format angka dan tanggal sesuai docs/05 bagian 4: 3,14 dan 3.000;
// "23 Oktober 2026"; "08.00 WIB". Pembulatan hanya untuk tampilan.

export const DISPLAY_LOCALE = "id-ID";
export const DEFAULT_TIME_ZONE = "Asia/Jakarta";

const TIME_ZONE_LABEL: Record<string, string> = {
  "Asia/Jakarta": "WIB",
  "Asia/Pontianak": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatDate(date: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(date);
}

export function formatTime(date: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  const time = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
  const label = TIME_ZONE_LABEL[timeZone];
  return label ? `${time} ${label}` : time;
}

export function formatDateTime(date: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  return `${formatDate(date, timeZone)}, ${formatTime(date, timeZone)}`;
}
