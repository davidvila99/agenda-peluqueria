/**
 * Datos de ejemplo. Se generan relativos a la fecha de hoy para que la demo siempre
 * tenga días pasados, el día de hoy y semanas siguientes con citas.
 * Cada turno pasa por el mismo motor de reglas que una reserva real.
 */
import { ALLERGY_TEST_ID, SALON, STYLISTS, getService } from "./catalog";
import { confirmationMessages, makeBooking, newCode } from "./bookings";
import { availableStartsAny, checkAllergy, checkSlot, type SchedulingContext } from "./scheduling";
import { addDays, diffDays, parseTime, salonNow, weekday } from "./time";
import type { AppState, Booking, Client, OutboxMessage } from "./types";

export const STATE_VERSION = 1;

type Row = [stylistId: string, serviceId: string, time: string];

/** Martes y jueves */
const DAY_A: Row[] = [
  ["lucia", "balayage", "10:00"],
  ["lucia", "corte-mujer", "10:45"], // en la pose del balayage
  ["lucia", "mechas", "12:30"],
  ["lucia", "corte-hombre", "13:30"], // en la pose de las mechas
  ["lucia", "color-raiz", "16:00"],
  ["lucia", "peinado", "16:20"], // en la pose del color
  ["lucia", "corte-brushing", "18:00"],
  ["irene", "corte-brushing", "10:00"],
  ["irene", "corte-mujer", "11:00"],
  ["irene", "keratina", "12:00"],
  ["irene", "corte-hombre", "12:30"], // en la pose de la keratina
  ["irene", "corte-mujer", "16:30"],
  ["irene", "peinado", "17:30"],
  ["marco", "corte-hombre", "10:30"],
  ["marco", "corte-hombre", "11:00"],
  ["marco", "corte-mujer", "12:00"],
  ["marco", "corte-hombre", "17:00"],
  ["marco", "corte-hombre", "18:30"],
  ["sara", "mechas", "11:00"],
  ["sara", "peinado", "12:00"], // en la pose de las mechas
  ["sara", "color-raiz", "15:30"],
  ["sara", "corte-brushing", "17:30"],
];

/** Miércoles y viernes: los tres balayages de Lucía, con cortes dentro de cada pose */
const DAY_B: Row[] = [
  ["lucia", "balayage", "10:00"],
  ["lucia", "corte-mujer", "10:45"],
  ["lucia", "balayage", "12:30"],
  ["lucia", "corte-hombre", "13:15"],
  ["lucia", "balayage", "15:00"],
  ["lucia", "corte-mujer", "15:45"],
  ["lucia", "peinado", "18:00"],
  ["irene", "color-raiz", "10:00"],
  ["irene", "peinado", "10:20"],
  ["irene", "corte-brushing", "12:00"],
  ["irene", "corte-mujer", "13:00"],
  ["irene", "mechas", "17:00"],
  ["irene", "corte-hombre", "18:00"],
  ["marco", "corte-hombre", "10:00"],
  ["marco", "corte-mujer", "11:30"],
  ["marco", "corte-hombre", "13:00"],
  ["marco", "corte-hombre", "16:00"],
  ["marco", "corte-hombre", "19:00"],
  ["sara", "keratina", "10:30"],
  ["sara", "corte-hombre", "11:00"],
  ["sara", "balayage", "16:00"],
  ["sara", "corte-mujer", "16:45"],
];

/** Sábado (9:30–15:00): los dos lavacabezas coinciden de 11:10 a 11:20 */
const DAY_SAT: Row[] = [
  ["lucia", "balayage", "09:30"],
  ["lucia", "corte-mujer", "10:15"],
  ["lucia", "balayage", "12:00"],
  ["lucia", "corte-hombre", "12:45"],
  ["lucia", "peinado", "14:30"],
  ["irene", "corte-brushing", "09:30"],
  ["irene", "peinado", "10:30"],
  ["irene", "color-raiz", "11:00"],
  ["irene", "corte-hombre", "11:20"],
  ["irene", "corte-mujer", "13:00"],
  ["irene", "peinado", "14:00"],
  ["marco", "corte-hombre", "10:00"],
  ["marco", "corte-hombre", "11:00"],
  ["marco", "corte-hombre", "11:30"],
  ["marco", "corte-mujer", "13:30"],
  ["sara", "mechas", "09:30"],
  ["sara", "corte-hombre", "10:30"],
  ["sara", "color-raiz", "12:15"],
  ["sara", "peinado", "12:35"],
];

const TEMPLATES: Record<number, Row[]> = { 2: DAY_A, 3: DAY_B, 4: DAY_A, 5: DAY_B, 6: DAY_SAT };

const CLIENT_SEED: [name: string, phone: string, email: string | null, notes: string | null][] = [
  ["Carmen Ortiz", "612408731", "carmen.ortiz@example.com", "Tono 7.1 con matiz ceniza."],
  ["Alba Serrano", "634129870", null, null],
  ["Marina Gil", "655302118", "marina.gil@example.com", "Cuero cabelludo sensible: sin masaje fuerte."],
  ["Inés Calvo", "678215549", null, "Prefiere con Lucía."],
  ["Lola Herrera", "620771034", "lola.h@example.com", null],
  ["Rocío Méndez", "691450223", null, "Flequillo cortina, mantener largo."],
  ["Julia Navarro", "647908312", "julia.navarro@example.com", null],
  ["Claudia Pastor", "633581947", null, null],
  ["Noelia Rubio", "689014576", "noelia.rubio@example.com", "Balayage frío, evitar tonos dorados."],
  ["Valeria Soto", "622347805", null, null],
  ["Sofía Lozano", "675230981", "sofia.lozano@example.com", null],
  ["Aitana Ferrer", "618904327", null, "Viene con su hija los sábados."],
  ["Celia Romero", "657112093", "celia.romero@example.com", null],
  ["Martina Vega", "699830214", null, null],
  ["Irene Montes", "641276508", "irene.montes@example.com", "Rizo natural: cortar en seco."],
  ["Laura Cano", "626913470", null, null],
  ["Ana Belén Ruiz", "683045712", "anabelen.ruiz@example.com", null],
  ["Patricia León", "650378926", null, "Mechas finas, papel cada 1 cm."],
  ["Teresa Molina", "614502867", "teresa.molina@example.com", null],
  ["Daniela Rey", "697241380", null, null],
  ["Jorge Santos", "629870153", "jorge.santos@example.com", "Degradado bajo, nuca recta."],
  ["Pablo Iglesias Mora", "673014298", null, null],
  ["Héctor Blanco", "645789012", "hector.blanco@example.com", null],
  ["Iván Delgado", "618337490", null, "Barba incluida en el corte."],
  ["Mateo Ramos", "692156734", null, null],
  ["Sergio Peña", "636408125", "sergio.pena@example.com", null],
  ["Nico Fuentes", "684920317", null, null],
  ["Raúl Campos", "611872046", "raul.campos@example.com", null],
];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeedResult {
  state: AppState;
  /** Turnos de plantilla que el motor rechazó (debería estar vacío). */
  dropped: string[];
}

export function createSeed(nowMs = Date.now()): SeedResult {
  const rng = mulberry32(20261009);
  const today = salonNow(nowMs).date;
  const iso = (daysAgo: number) => new Date(nowMs - daysAgo * 86_400_000).toISOString();

  const pool: Client[] = CLIENT_SEED.map(([name, phone, email, notes], i) => ({
    id: `c_${String(i + 1).padStart(2, "0")}`,
    name,
    phone,
    email: email ?? undefined,
    notes: notes ?? undefined,
    colorHistory: true,
    createdAt: iso(120 - i),
  }));

  // Clientas de los casos de prueba de la prueba de alergia
  const paula: Client = {
    id: "c_paula",
    name: "Paula Nieto",
    phone: "664218053",
    email: "paula.nieto@example.com",
    notes: "Primera vez con color: viene por un balayage.",
    colorHistory: false,
    createdAt: iso(6),
  };
  const nuria: Client = {
    id: "c_nuria",
    name: "Nuria Vidal",
    phone: "687530914",
    notes: "Solo se ha cortado aquí. Si pide color, necesita prueba de alergia.",
    colorHistory: false,
    createdAt: iso(30),
  };

  const clients = [...pool, paula, nuria];
  const ctx: SchedulingContext = {
    bookings: [],
    clients,
    stylists: STYLISTS,
    washbasins: SALON.washbasins,
    cabins: SALON.cabins,
  };
  const dropped: string[] = [];

  const tryAdd = (b: Booking): boolean => {
    const conflicts = checkSlot(ctx, {
      segments: b.segments,
      stylistId: b.stylistId,
      date: b.date,
      start: b.start,
      clientId: b.clientId,
    });
    const allergy = checkAllergy(ctx, { clientId: b.clientId, isColor: b.isColor, date: b.date, start: b.start });
    if (conflicts.length || allergy) {
      dropped.push(`${b.date} ${b.stylistId} ${b.serviceId} ${b.start}: ${[...conflicts, allergy].filter(Boolean).map((c) => c!.message).join(" | ")}`);
      return false;
    }
    ctx.bookings.push(b);
    return true;
  };

  // Días abiertos: 10 días atrás → 24 días adelante
  let openIndex = 0;
  let futureOpen = 0;
  for (let offset = -10; offset <= 24; offset++) {
    const date = addDays(today, offset);
    const template = TEMPLATES[weekday(date)];
    if (!template) continue;
    openIndex++;
    const isPast = offset < 0;
    if (offset > 0) futureOpen++;
    // Hoy y el próximo día abierto, agenda llena; más adelante, menos, como pasa en la vida real.
    // La agenda de Lucía se mantiene siempre completa (caso de los tres balayages).
    const rows = futureOpen > 1 ? template.filter(([stylistId], i) => stylistId === "lucia" || i % 3 !== 2) : template;
    rows.forEach(([stylistId, serviceId, time], i) => {
      const service = getService(serviceId)!;
      const client = pool[(openIndex * 5 + i) % pool.length];
      let status: Booking["status"] = isPast ? "completada" : "confirmada";
      if (isPast && i === 4) status = "no_presentada";
      tryAdd(
        makeBooking(service, {
          id: `b_${date.replace(/-/g, "")}_${i}`,
          code: newCode(rng),
          clientId: client.id,
          stylistId,
          date,
          start: parseTime(time),
          source: i % 3 === 0 ? "online" : "salon",
          status,
          createdAt: iso(Math.max(1, -offset + 7)),
        }),
      );
    });
  }

  // Nuria: un corte hace unas semanas (sin color)
  const nuriaPast = ctx.bookings.find((b) => b.date < today && b.serviceId === "corte-mujer");
  if (nuriaPast) nuriaPast.clientId = nuria.id;

  // Paula: prueba de alergia el próximo día abierto y balayage al menos 48 h después
  const outbox: OutboxMessage[] = [];
  const openDays = Array.from({ length: 24 }, (_, i) => addDays(today, i + 1)).filter((d) => TEMPLATES[weekday(d)]);
  const testDay = openDays[0];
  const allIds = STYLISTS.map((s) => s.id);
  const testService = getService(ALLERGY_TEST_ID)!;
  const testSlot = availableStartsAny(ctx, { segments: testService.segments, date: testDay, clientId: paula.id }, allIds)[0];
  if (testSlot) {
    const test = makeBooking(testService, {
      id: "b_paula_test",
      code: newCode(rng),
      clientId: paula.id,
      stylistId: testSlot.stylistIds.includes("sara") ? "sara" : testSlot.stylistIds[0],
      date: testDay,
      start: testSlot.start,
      source: "online",
      createdAt: iso(1),
    });
    if (tryAdd(test)) {
      const balayage = getService("balayage")!;
      for (const day of openDays.filter((d) => diffDays(d, testDay) >= 2)) {
        const slot = availableStartsAny(ctx, { segments: balayage.segments, date: day, clientId: paula.id }, allIds).find(
          (s) => s.start >= test.start,
        );
        if (!slot) continue;
        const color = makeBooking(balayage, {
          id: "b_paula_color",
          code: newCode(rng),
          clientId: paula.id,
          stylistId: slot.stylistIds.includes("lucia") ? "lucia" : slot.stylistIds[0],
          date: day,
          start: slot.start,
          source: "online",
          linkedBookingId: test.id,
          createdAt: iso(1),
        });
        if (tryAdd(color)) {
          test.linkedBookingId = color.id;
          outbox.push(...confirmationMessages(paula, color, SALON.defaultAddress, test, iso(1)));
        }
        break;
      }
    }
  }

  // Avisos simulados de las últimas reservas online
  ctx.bookings
    .filter((b) => b.source === "online" && b.date >= today && !b.id.startsWith("b_paula"))
    .slice(0, 4)
    .forEach((b) => {
      const client = clients.find((c) => c.id === b.clientId)!;
      outbox.push(...confirmationMessages(client, b, SALON.defaultAddress, undefined, iso(2)));
    });

  outbox.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    state: {
      version: STATE_VERSION,
      seededAt: new Date(nowMs).toISOString(),
      settings: { address: SALON.defaultAddress },
      clients,
      bookings: ctx.bookings,
      outbox,
    },
    dropped,
  };
}
