import { bookingEpoch, isLive, type SchedulingContext } from "@/lib/scheduling";
import { fmtDateShort } from "@/lib/time";
import type { Client } from "@/lib/types";

export type ColorStatus = { tone: "ok" | "info" | "warn"; label: string };

/** Estado de color/alergia de una clienta, para fichas y listados. */
export function colorStatus(ctx: Pick<SchedulingContext, "bookings">, client: Client): ColorStatus {
  if (client.colorHistory) return { tone: "ok", label: "Historial de color" };
  const mine = ctx.bookings.filter((b) => b.clientId === client.id && isLive(b));
  if (mine.some((b) => b.isColor && b.status === "completada")) return { tone: "ok", label: "Historial de color" };
  const tests = mine.filter((b) => b.isAllergyTest).sort((a, b) => bookingEpoch(b) - bookingEpoch(a));
  if (tests.length) return { tone: "info", label: `Prueba de alergia ${fmtDateShort(tests[0].date)}` };
  return { tone: "warn", label: "Sin prueba de alergia" };
}

export const TONE_CLASS: Record<ColorStatus["tone"], string> = {
  ok: "bg-emerald-50 text-emerald-800",
  info: "bg-sky-50 text-sky-800",
  warn: "bg-amber-50 text-amber-800",
};
