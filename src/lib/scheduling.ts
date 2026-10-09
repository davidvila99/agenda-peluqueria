/**
 * Motor de disponibilidad por tramos.
 *
 * Un servicio no es un bloque: es una secuencia de tramos A (activo), P (pose) y L (lavado).
 * - La estilista está ocupada en los tramos A y L; en P queda libre para otra clienta.
 * - Cada tramo L ocupa uno de los lavacabezas (recurso compartido por todo el salón).
 * - La clienta ocupa una cabina durante todo su servicio (incluida la pose).
 * - Primera vez con color: exige una prueba de alergia con fecha ≤ fecha del turno − 48 h.
 */
import { SALON } from "./catalog";
import type { Booking, Client, Segment, SegmentKind, Stylist } from "./types";
import { MS_HOUR, fmtDateLong, fmtTime, salonEpoch, salonNow, weekday } from "./time";

export interface Interval {
  start: number;
  end: number;
}

export interface TimedSegment extends Segment, Interval {
  index: number;
}

export interface SchedulingContext {
  bookings: Booking[];
  clients: Client[];
  stylists: Stylist[];
  washbasins: number;
  cabins: number;
}

export type ConflictKind = "closed" | "hours" | "past" | "stylist" | "washbasin" | "cabin" | "client" | "allergy";

export interface Conflict {
  kind: ConflictKind;
  message: string;
}

export interface SlotRequest {
  segments: Segment[];
  stylistId: string;
  date: string;
  start: number;
  clientId?: string;
  /** Turnos a ignorar (p. ej. el propio turno al moverlo) */
  excludeBookingIds?: string[];
}

export interface CheckOptions {
  /** Si se indica, los horarios que empiezan antes de este instante se rechazan. */
  nowMs?: number;
}

const WEEKDAYS = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];

export const busyForStylist = (k: SegmentKind) => k === "A" || k === "L";

export function totalMinutes(segments: Segment[]): number {
  return segments.reduce((sum, s) => sum + s.min, 0);
}

export function stylistMinutes(segments: Segment[]): number {
  return segments.filter((s) => busyForStylist(s.kind)).reduce((sum, s) => sum + s.min, 0);
}

export function timeline(segments: Segment[], start: number): TimedSegment[] {
  let t = start;
  return segments.map((s, index) => {
    const seg = { ...s, index, start: t, end: t + s.min };
    t += s.min;
    return seg;
  });
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function bookingEnd(b: Pick<Booking, "segments" | "start">): number {
  return b.start + totalMinutes(b.segments);
}

/** Los turnos cancelados o en los que la clienta no vino liberan sus recursos. */
export function isLive(b: Booking): boolean {
  return b.status === "confirmada" || b.status === "completada";
}

export function bookingEpoch(b: Pick<Booking, "date" | "start">): number {
  return salonEpoch(b.date, b.start);
}

/** Máximo de intervalos simultáneos dentro de `window`. */
export function maxConcurrent(intervals: Interval[], window: Interval): number {
  const events: [number, number][] = [];
  for (const iv of intervals) {
    const s = Math.max(iv.start, window.start);
    const e = Math.min(iv.end, window.end);
    if (s < e) events.push([s, 1], [e, -1]);
  }
  // A igual instante, primero los finales: un intervalo que termina a las 11:00 no choca con otro que empieza a las 11:00.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let current = 0;
  let max = 0;
  for (const [, delta] of events) {
    current += delta;
    max = Math.max(max, current);
  }
  return max;
}

export function liveBookingsOn(ctx: Pick<SchedulingContext, "bookings">, date: string, exclude: string[] = []): Booking[] {
  return ctx.bookings.filter((b) => b.date === date && isLive(b) && !exclude.includes(b.id));
}

function clientName(ctx: SchedulingContext, id: string): string {
  return ctx.clients.find((c) => c.id === id)?.name ?? "otra clienta";
}

export function checkSlot(ctx: SchedulingContext, req: SlotRequest, opts: CheckOptions = {}): Conflict[] {
  const stylist = ctx.stylists.find((s) => s.id === req.stylistId);
  if (!stylist) return [{ kind: "closed", message: "Profesional no encontrada." }];

  const hours = stylist.schedule[weekday(req.date)];
  if (!hours) {
    return [{ kind: "closed", message: `${stylist.name} no trabaja los ${WEEKDAYS[weekday(req.date)]}.` }];
  }

  const conflicts: Conflict[] = [];
  const end = req.start + totalMinutes(req.segments);

  if (req.start < hours.open) {
    conflicts.push({ kind: "hours", message: `${stylist.name} empieza a las ${fmtTime(hours.open)}.` });
  } else if (end > hours.close) {
    conflicts.push({
      kind: "hours",
      message: `El servicio terminaría a las ${fmtTime(end)} y ${stylist.name} sale a las ${fmtTime(hours.close)}.`,
    });
  }

  if (opts.nowMs !== undefined && salonEpoch(req.date, req.start) <= opts.nowMs) {
    conflicts.push({ kind: "past", message: "Ese horario ya ha pasado." });
  }

  const day = liveBookingsOn(ctx, req.date, req.excludeBookingIds);
  const mine = timeline(req.segments, req.start);
  const myBusy = mine.filter((s) => busyForStylist(s.kind));

  // Estilista: ninguno de mis tramos A/L puede pisar un tramo A/L de otro turno suyo.
  for (const b of day) {
    if (b.stylistId !== req.stylistId) continue;
    for (const seg of timeline(b.segments, b.start)) {
      if (!busyForStylist(seg.kind)) continue;
      if (myBusy.some((m) => overlaps(m, seg))) {
        conflicts.push({
          kind: "stylist",
          message: `${stylist.name} está con ${clientName(ctx, b.clientId)} (${seg.label.toLowerCase()} · ${b.serviceName}) de ${fmtTime(seg.start)} a ${fmtTime(seg.end)}.`,
        });
      }
    }
  }

  // Lavacabezas: en cada tramo L tiene que quedar al menos uno libre.
  const washes = day.flatMap((b) => timeline(b.segments, b.start).filter((s) => s.kind === "L"));
  for (const m of mine) {
    if (m.kind !== "L") continue;
    if (maxConcurrent(washes, m) >= ctx.washbasins) {
      conflicts.push({
        kind: "washbasin",
        message: `Los ${ctx.washbasins} lavacabezas están ocupados durante el lavado (${fmtTime(m.start)}–${fmtTime(m.end)}).`,
      });
    }
  }

  // Cabinas: la clienta ocupa una durante todo el servicio.
  const spans = day.map((b) => ({ start: b.start, end: bookingEnd(b) }));
  if (maxConcurrent(spans, { start: req.start, end }) >= ctx.cabins) {
    conflicts.push({ kind: "cabin", message: `Las ${ctx.cabins} cabinas están ocupadas en parte de ese horario.` });
  }

  // La misma clienta no puede estar en dos sitios a la vez.
  if (req.clientId) {
    const clash = day.find(
      (b) => b.clientId === req.clientId && overlaps({ start: b.start, end: bookingEnd(b) }, { start: req.start, end }),
    );
    if (clash) {
      conflicts.push({
        kind: "client",
        message: `Esta clienta ya tiene ${clash.serviceName} de ${fmtTime(clash.start)} a ${fmtTime(bookingEnd(clash))}.`,
      });
    }
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// Prueba de alergia
// ---------------------------------------------------------------------------

export const ALLERGY_LEAD_MS = SALON.allergyLeadHours * MS_HOUR;

/** ¿Es la primera vez con color de esta clienta en el salón antes de `beforeEpoch`? */
export function isFirstTimeColor(
  ctx: Pick<SchedulingContext, "bookings" | "clients">,
  clientId: string | undefined,
  beforeEpoch: number,
  excludeIds: string[] = [],
): boolean {
  if (!clientId) return true;
  const client = ctx.clients.find((c) => c.id === clientId);
  if (!client) return true;
  if (client.colorHistory) return false;
  return !ctx.bookings.some(
    (b) =>
      b.clientId === clientId && b.isColor && isLive(b) && !excludeIds.includes(b.id) && bookingEpoch(b) < beforeEpoch,
  );
}

export function findValidAllergyTest(
  ctx: Pick<SchedulingContext, "bookings">,
  clientId: string,
  colorEpoch: number,
  excludeIds: string[] = [],
): Booking | undefined {
  const limit = colorEpoch - ALLERGY_LEAD_MS;
  return ctx.bookings
    .filter((b) => b.clientId === clientId && b.isAllergyTest && isLive(b) && !excludeIds.includes(b.id))
    .find((b) => bookingEpoch(b) <= limit);
}

/** Fecha y hora límite (hora del salón) para hacer la prueba antes de un color. */
export function allergyDeadline(date: string, start: number) {
  const epoch = salonEpoch(date, start) - ALLERGY_LEAD_MS;
  return { epoch, ...salonNow(epoch) };
}

export interface AllergyRequest {
  clientId?: string;
  isColor: boolean;
  date: string;
  start: number;
  excludeBookingIds?: string[];
  /** Prueba que se va a reservar junto con el color (reserva pública). */
  plannedTestEpoch?: number;
}

export function checkAllergy(ctx: SchedulingContext, req: AllergyRequest): Conflict | null {
  if (!req.isColor) return null;
  const epoch = salonEpoch(req.date, req.start);
  if (!isFirstTimeColor(ctx, req.clientId, epoch, req.excludeBookingIds)) return null;
  const deadline = allergyDeadline(req.date, req.start);
  if (req.plannedTestEpoch !== undefined && req.plannedTestEpoch <= deadline.epoch) return null;
  if (req.clientId && findValidAllergyTest(ctx, req.clientId, epoch, req.excludeBookingIds)) return null;
  return {
    kind: "allergy",
    message: `Primera vez con color: necesita una prueba de alergia como muy tarde el ${fmtDateLong(deadline.date)} a las ${fmtTime(deadline.minutes)} (48 h antes).`,
  };
}

// ---------------------------------------------------------------------------
// Disponibilidad
// ---------------------------------------------------------------------------

/**
 * Horas de inicio a probar: una rejilla cada `step` minutos más los finales de cada tramo
 * ocupado de la estilista, para que los huecos de pose que no caen en la rejilla también aparezcan.
 */
export function candidateStarts(
  ctx: SchedulingContext,
  stylistId: string,
  date: string,
  duration: number,
  step = 15,
  exclude: string[] = [],
): number[] {
  const stylist = ctx.stylists.find((s) => s.id === stylistId);
  const hours = stylist?.schedule[weekday(date)];
  if (!hours) return [];
  const latest = hours.close - duration;
  if (latest < hours.open) return [];
  const starts = new Set<number>();
  for (let t = hours.open; t <= latest; t += step) starts.add(t);
  for (const b of liveBookingsOn(ctx, date, exclude)) {
    if (b.stylistId !== stylistId) continue;
    for (const seg of timeline(b.segments, b.start)) {
      if (busyForStylist(seg.kind) && seg.end >= hours.open && seg.end <= latest) starts.add(seg.end);
    }
  }
  return [...starts].sort((a, b) => a - b);
}

export function availableStarts(
  ctx: SchedulingContext,
  req: Omit<SlotRequest, "start">,
  opts: CheckOptions & { step?: number } = {},
): number[] {
  const duration = totalMinutes(req.segments);
  return candidateStarts(ctx, req.stylistId, req.date, duration, opts.step, req.excludeBookingIds).filter(
    (start) => checkSlot(ctx, { ...req, start }, opts).length === 0,
  );
}

export interface OpenSlot {
  start: number;
  stylistIds: string[];
}

/** Horarios libres con cualquiera de las profesionales indicadas. */
export function availableStartsAny(
  ctx: SchedulingContext,
  req: Omit<SlotRequest, "start" | "stylistId">,
  stylistIds: string[],
  opts: CheckOptions & { step?: number } = {},
): OpenSlot[] {
  const byStart = new Map<number, string[]>();
  for (const stylistId of stylistIds) {
    for (const start of availableStarts(ctx, { ...req, stylistId }, opts)) {
      const list = byStart.get(start) ?? [];
      list.push(stylistId);
      byStart.set(start, list);
    }
  }
  return [...byStart.entries()].sort((a, b) => a[0] - b[0]).map(([start, ids]) => ({ start, stylistIds: ids }));
}

/** Minutos activos que ya tiene cada profesional ese día: para repartir sin sobrecargar a nadie. */
export function stylistLoad(ctx: SchedulingContext, date: string, stylistId: string): number {
  return liveBookingsOn(ctx, date)
    .filter((b) => b.stylistId === stylistId)
    .reduce((sum, b) => sum + stylistMinutes(b.segments), 0);
}

export function pickLeastLoaded(ctx: SchedulingContext, date: string, stylistIds: string[]): string {
  return [...stylistIds].sort((a, b) => stylistLoad(ctx, date, a) - stylistLoad(ctx, date, b))[0];
}

// ---------------------------------------------------------------------------
// Ayudas para la agenda visual
// ---------------------------------------------------------------------------

/** Lavacabezas asignado a cada tramo L, clave `${bookingId}:${segmentIndex}` → 0, 1… */
export function assignWashbasins(bookings: Booking[], count: number): Map<string, number> {
  const washes = bookings
    .flatMap((b) => timeline(b.segments, b.start).filter((s) => s.kind === "L").map((s) => ({ key: `${b.id}:${s.index}`, ...s })))
    .sort((a, b) => a.start - b.start);
  const freeAt = new Array<number>(count).fill(-Infinity);
  const result = new Map<string, number>();
  for (const w of washes) {
    let basin = freeAt.findIndex((t) => t <= w.start);
    if (basin === -1) basin = 0; // no debería ocurrir: el motor lo impide
    freeAt[basin] = w.end;
    result.set(w.key, basin);
  }
  return result;
}

/** Reparte turnos solapados en carriles para dibujarlos lado a lado. */
export function layoutLanes(items: { id: string; start: number; end: number }[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const result = new Map<string, { lane: number; lanes: number }>();
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    for (const c of cluster) result.set(c.id, { lane: c.lane, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };
  for (const it of sorted) {
    if (it.start >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    let lane = laneEnds.findIndex((end) => end <= it.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.end);
    } else {
      laneEnds[lane] = it.end;
    }
    cluster.push({ id: it.id, lane });
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  flush();
  return result;
}

/** Turnos que empiezan dentro de la pose de otro turno de la misma profesional. */
export function bookingsInPose(bookings: Booking[]): Set<string> {
  const result = new Set<string>();
  for (const b of bookings) {
    const poses = timeline(b.segments, b.start).filter((s) => s.kind === "P");
    for (const other of bookings) {
      if (other.id === b.id || other.stylistId !== b.stylistId) continue;
      if (poses.some((p) => other.start >= p.start && other.start < p.end)) result.add(other.id);
    }
  }
  return result;
}
