/**
 * Fechas como "YYYY-MM-DD" y horas como minutos desde medianoche, siempre en hora local
 * del salón (Europe/Madrid). Así la agenda no depende de la zona horaria del navegador.
 */
export const SALON_TZ = "Europe/Madrid";

export const MS_MIN = 60_000;
export const MS_HOUR = 60 * MS_MIN;

function parts(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function toDateStr(utc: Date): string {
  return utc.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const { y, m, d } = parts(date);
  return toDateStr(new Date(Date.UTC(y, m - 1, d + n)));
}

/** 0 = domingo … 6 = sábado */
export function weekday(date: string): number {
  const { y, m, d } = parts(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function diffDays(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  return Math.round((Date.UTC(pa.y, pa.m - 1, pa.d) - Date.UTC(pb.y, pb.m - 1, pb.d)) / 86_400_000);
}

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function utcDate(date: string): Date {
  const { y, m, d } = parts(date);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

const longFmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const weekdayShortFmt = new Intl.DateTimeFormat("es-ES", { weekday: "short", timeZone: "UTC" });
const dayMonthFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });

/** "sábado, 17 de octubre" */
export function fmtDateLong(date: string): string {
  return longFmt.format(utcDate(date));
}

/** "sáb, 17 oct" */
export function fmtDateShort(date: string): string {
  return shortFmt.format(utcDate(date));
}

export function fmtWeekdayShort(date: string): string {
  return weekdayShortFmt.format(utcDate(date)).replace(".", "");
}

export function fmtDayMonth(date: string): string {
  return dayMonthFmt.format(utcDate(date)).replace(".", "");
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const tzFormatters = new Map<string, Intl.DateTimeFormat>();
function tzFormatter(tz: string) {
  let f = tzFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    tzFormatters.set(tz, f);
  }
  return f;
}

function wallClock(ms: number, tz: string) {
  const p: Record<string, number> = {};
  for (const part of tzFormatter(tz).formatToParts(new Date(ms))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return { y: p.year, m: p.month, d: p.day, h: p.hour % 24, mi: p.minute, s: p.second };
}

/** Diferencia (ms) entre la hora de pared de `tz` y UTC en el instante `ms`. */
export function tzOffsetMs(ms: number, tz = SALON_TZ): number {
  const w = wallClock(ms, tz);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Instante real (epoch ms) de una fecha + minutos en hora local del salón. Tiene en cuenta el cambio de hora. */
export function salonEpoch(date: string, minutes: number, tz = SALON_TZ): number {
  const { y, m, d } = parts(date);
  const wall = Date.UTC(y, m - 1, d, 0, minutes);
  const off1 = tzOffsetMs(wall, tz);
  let t = wall - off1;
  const off2 = tzOffsetMs(t, tz);
  if (off2 !== off1) t = wall - off2;
  return t;
}

/** Fecha y minuto actuales en el salón. */
export function salonNow(nowMs = Date.now(), tz = SALON_TZ): { date: string; minutes: number } {
  const w = wallClock(nowMs, tz);
  const date = `${w.y}-${String(w.m).padStart(2, "0")}-${String(w.d).padStart(2, "0")}`;
  return { date, minutes: w.h * 60 + w.mi };
}
