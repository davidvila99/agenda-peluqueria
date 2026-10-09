import { describe, expect, it } from "vitest";
import { ALLERGY_TEST_ID, SALON, STYLISTS, getService } from "./catalog";
import { bookingIcsEvent, makeBooking } from "./bookings";
import { buildIcs } from "./ics";
import {
  availableStarts,
  checkAllergy,
  checkSlot,
  totalMinutes,
  type SchedulingContext,
} from "./scheduling";
import { createSeed } from "./seed";
import { addDays, parseTime, salonEpoch } from "./time";
import type { Booking, Client } from "./types";

const TUESDAY = "2026-10-13";
const SUNDAY = "2026-10-11";

const ana: Client = { id: "ana", name: "Ana", phone: "600000001", colorHistory: true, createdAt: "" };
const bea: Client = { id: "bea", name: "Bea", phone: "600000002", colorHistory: false, createdAt: "" };

function ctxWith(bookings: Booking[] = [], clients: Client[] = [ana, bea]): SchedulingContext {
  return { bookings, clients, stylists: STYLISTS, washbasins: SALON.washbasins, cabins: SALON.cabins };
}

function book(serviceId: string, stylistId: string, time: string, date = TUESDAY, clientId = "ana"): Booking {
  return makeBooking(getService(serviceId)!, { clientId, stylistId, date, start: parseTime(time), source: "salon" });
}

function check(ctx: SchedulingContext, serviceId: string, stylistId: string, time: string, date = TUESDAY) {
  return checkSlot(ctx, { segments: getService(serviceId)!.segments, stylistId, date, start: parseTime(time) });
}

describe("tramos activos y de pose", () => {
  // Balayage 10:00 → A 10:00–10:45 · P 10:45–11:35 · L 11:35–11:50 · A 11:50–12:30
  const ctx = ctxWith([book("balayage", "lucia", "10:00")]);

  it("el color bloquea a la estilista solo en sus tramos activos", () => {
    expect(check(ctx, "corte-mujer", "lucia", "10:45")).toEqual([]); // 10:45–11:30 dentro de la pose
    expect(check(ctx, "peinado", "lucia", "11:05")).toEqual([]); // 11:05–11:35 termina justo al acabar la pose
    expect(check(ctx, "peinado", "lucia", "12:30")).toEqual([]);
    expect(check(ctx, "corte-mujer", "lucia", "10:30").map((c) => c.kind)).toContain("stylist");
    expect(check(ctx, "peinado", "lucia", "12:10").map((c) => c.kind)).toContain("stylist");
  });

  it("solo entra en la pose si todos sus tramos activos caben en ella", () => {
    // Corte y brushing (60 min) no cabe en una pose de 50 min
    expect(check(ctx, "corte-brushing", "lucia", "10:45").map((c) => c.kind)).toEqual(["stylist"]);
    // Peinado 11:10–11:40 pisa el lavado de 11:35
    expect(check(ctx, "peinado", "lucia", "11:10").map((c) => c.kind)).toEqual(["stylist"]);
  });

  it("otra estilista no se ve afectada", () => {
    expect(check(ctx, "corte-brushing", "irene", "10:00")).toEqual([]);
  });

  it("un color puede empezar su aplicación en la pose de otro si sus tramos activos no chocan", () => {
    // Color raíz 10:45: A 10:45–11:05 (pose) · P 11:05–11:40 · L 11:40–11:55 ✗ choca con lavado 11:35–11:50
    expect(check(ctx, "color-raiz", "lucia", "10:45").map((c) => c.kind)).toContain("stylist");
  });
});

describe("lavacabezas", () => {
  it("dos turnos no pueden usar el mismo lavacabezas a la vez", () => {
    const ctx = ctxWith([book("balayage", "lucia", "10:00"), book("balayage", "irene", "10:00", TUESDAY, "bea")]);
    // Los dos lavacabezas están en uso de 11:35 a 11:50
    expect(check(ctx, "balayage", "sara", "10:00").map((c) => c.kind)).toEqual(["washbasin"]);
    expect(check(ctx, "balayage", "sara", "10:05").map((c) => c.kind)).toEqual(["washbasin"]);
    // Su lavado empieza 11:50, cuando los otros dos ya han terminado
    expect(check(ctx, "balayage", "sara", "10:15")).toEqual([]);
  });

  it("con un solo lavado en curso queda otro lavacabezas libre", () => {
    const ctx = ctxWith([book("balayage", "lucia", "10:00")]);
    expect(check(ctx, "balayage", "irene", "10:00")).toEqual([]);
  });
});

describe("cabinas", () => {
  it("no admite más clientas a la vez que cabinas", () => {
    const ctx = ctxWith([
      book("balayage", "lucia", "10:00"),
      book("corte-mujer", "lucia", "10:45"),
      book("mechas", "irene", "10:00"),
      book("peinado", "irene", "11:00"),
      book("corte-mujer", "marco", "10:45"),
    ]);
    expect(check(ctx, "corte-hombre", "sara", "11:00").map((c) => c.kind)).toEqual(["cabin"]);
    expect(check(ctx, "corte-hombre", "sara", "12:30")).toEqual([]);
  });
});

describe("disponibilidad pública", () => {
  it("no muestra horarios pasados", () => {
    const now = salonEpoch(TUESDAY, parseTime("12:07"));
    const starts = availableStarts(ctxWith(), { segments: getService("corte-mujer")!.segments, stylistId: "lucia", date: TUESDAY }, { nowMs: now });
    expect(starts.length).toBeGreaterThan(0);
    expect(Math.min(...starts)).toBeGreaterThan(parseTime("12:07"));
    const yesterday = availableStarts(ctxWith(), { segments: getService("corte-mujer")!.segments, stylistId: "lucia", date: addDays(TUESDAY, -1) }, { nowMs: now });
    expect(yesterday).toEqual([]);
  });

  it("no muestra horarios fuera del horario de la estilista", () => {
    const segments = getService("balayage")!.segments;
    const tuesday = availableStarts(ctxWith(), { segments, stylistId: "lucia", date: TUESDAY });
    expect(Math.min(...tuesday)).toBe(parseTime("10:00"));
    expect(Math.max(...tuesday) + totalMinutes(segments)).toBeLessThanOrEqual(parseTime("20:00"));
    const saturday = availableStarts(ctxWith(), { segments, stylistId: "lucia", date: "2026-10-17" });
    expect(Math.min(...saturday)).toBe(parseTime("09:30"));
    expect(Math.max(...saturday) + totalMinutes(segments)).toBeLessThanOrEqual(parseTime("15:00"));
    expect(availableStarts(ctxWith(), { segments, stylistId: "lucia", date: SUNDAY })).toEqual([]);
  });

  it("ofrece los huecos de pose aunque no caigan en la rejilla de 15 minutos", () => {
    // Color raíz 10:00 → pose 10:20–10:55: el peinado de 10:20 solo existe gracias a la pose
    const ctx = ctxWith([book("color-raiz", "lucia", "10:00")]);
    const starts = availableStarts(ctx, { segments: getService("peinado")!.segments, stylistId: "lucia", date: TUESDAY });
    expect(starts).toContain(parseTime("10:20"));
    expect(starts).not.toContain(parseTime("10:30"));
  });
});

describe("prueba de alergia", () => {
  const color = { clientId: "bea", isColor: true, date: TUESDAY, start: parseTime("10:00") };
  const test = (date: string, time: string) =>
    makeBooking(getService(ALLERGY_TEST_ID)!, { clientId: "bea", stylistId: "sara", date, start: parseTime(time), source: "salon" });

  it("primera vez con color sin prueba: se rechaza", () => {
    expect(checkAllergy(ctxWith(), color)?.kind).toBe("allergy");
  });

  it("prueba 48 h antes exactas: se acepta", () => {
    expect(checkAllergy(ctxWith([test("2026-10-11", "10:00")]), color)).toBeNull();
  });

  it("prueba 47 h 55 min antes: se rechaza", () => {
    expect(checkAllergy(ctxWith([test("2026-10-11", "10:05")]), color)?.kind).toBe("allergy");
  });

  it("prueba cancelada no cuenta", () => {
    const t = test("2026-10-08", "10:00");
    t.status = "cancelada";
    expect(checkAllergy(ctxWith([t]), color)?.kind).toBe("allergy");
  });

  it("una prueba planificada en la misma reserva cuenta", () => {
    expect(checkAllergy(ctxWith(), { ...color, plannedTestEpoch: salonEpoch("2026-10-10", 600) })).toBeNull();
  });

  it("clienta con historial de color o servicio sin color: no hace falta", () => {
    expect(checkAllergy(ctxWith(), { ...color, clientId: "ana" })).toBeNull();
    expect(checkAllergy(ctxWith(), { ...color, isColor: false })).toBeNull();
  });

  it("un color anterior en la agenda cuenta como historial", () => {
    const before = book("color-raiz", "lucia", "10:00", "2026-10-06", "bea");
    expect(checkAllergy(ctxWith([before]), color)).toBeNull();
  });

  it("las 48 h son reales aunque haya cambio de hora (25 oct 2026)", () => {
    // Sábado 24 a las 10:00 → lunes 26 a las 10:00 son 49 h reales
    expect(salonEpoch("2026-10-26", 600) - salonEpoch("2026-10-24", 600)).toBe(49 * 3_600_000);
  });
});

describe("archivo de calendario", () => {
  it("lleva fecha, hora y dirección correctas", () => {
    const b = book("balayage", "lucia", "10:00");
    const ics = buildIcs([bookingIcsEvent(b, "Calle del Espíritu Santo 23, 28004 Madrid")]);
    expect(ics).toContain("DTSTART;TZID=Europe/Madrid:20261013T100000");
    expect(ics).toContain("DTEND;TZID=Europe/Madrid:20261013T123000");
    expect(ics).toContain("LOCATION:Corto y Cambio\\, Calle del Espíritu Santo 23\\, 28004 Madrid");
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});

describe("datos de ejemplo", () => {
  it("todas las citas de ejemplo cumplen las reglas, empiece el día que empiece", () => {
    for (let i = 0; i < 14; i++) {
      const now = salonEpoch(addDays("2026-10-05", i), parseTime("09:00"));
      const { dropped, state } = createSeed(now);
      expect(dropped).toEqual([]);
      expect(state.bookings.some((b) => b.id === "b_paula_color")).toBe(true);
    }
  });
});
