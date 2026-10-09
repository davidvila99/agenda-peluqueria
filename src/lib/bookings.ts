import { SALON, getStylist } from "./catalog";
import type { IcsEvent } from "./ics";
import { bookingEnd } from "./scheduling";
import { fmtDateLong, fmtTime } from "./time";
import type { Booking, BookingStatus, Client, OutboxMessage, Service } from "./types";

export const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_presentada: "No se presentó",
};

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < 5; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return `CYC-${code}`;
}

export function makeBooking(
  service: Service,
  fields: Pick<Booking, "clientId" | "stylistId" | "date" | "start" | "source"> &
    Partial<Pick<Booking, "id" | "code" | "status" | "notes" | "linkedBookingId" | "createdAt">>,
): Booking {
  return {
    id: fields.id ?? newId("b"),
    code: fields.code ?? newCode(),
    clientId: fields.clientId,
    serviceId: service.id,
    serviceName: service.name,
    price: service.price,
    segments: service.segments.map((s) => ({ ...s })),
    isColor: service.isColor,
    isAllergyTest: Boolean(service.isAllergyTest),
    stylistId: fields.stylistId,
    date: fields.date,
    start: fields.start,
    status: fields.status ?? "confirmada",
    source: fields.source,
    notes: fields.notes,
    linkedBookingId: fields.linkedBookingId,
    createdAt: fields.createdAt ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Teléfonos (España)
// ---------------------------------------------------------------------------

export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0034")) digits = digits.slice(4);
  else if (digits.length === 11 && digits.startsWith("34")) digits = digits.slice(2);
  return digits;
}

export function isValidPhone(digits: string): boolean {
  return /^[6789]\d{8}$/.test(digits);
}

export function formatPhone(digits: string): string {
  return digits.length === 9 ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}` : digits;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------------------------------------------------------------------------
// Calendario y avisos
// ---------------------------------------------------------------------------

export function bookingIcsEvent(b: Booking, address: string): IcsEvent {
  const stylist = getStylist(b.stylistId)?.name ?? "el equipo";
  const description = b.isAllergyTest
    ? `Prueba de alergia con ${stylist}. Dura 10 minutos y es obligatoria antes de tu primer color.\nCódigo de reserva: ${b.code}`
    : `${b.serviceName} con ${stylist}.\nCódigo de reserva: ${b.code}\nPrecio: ${b.price} €`;
  return {
    uid: `${b.id}@cortoycambio`,
    date: b.date,
    start: b.start,
    end: bookingEnd(b),
    summary: `${b.serviceName} · ${SALON.name}`,
    description,
    location: `${SALON.name}, ${address}`,
  };
}

function when(b: Booking) {
  return `${fmtDateLong(b.date)} a las ${fmtTime(b.start)}`;
}

export function confirmationMessages(
  client: Client,
  booking: Booking,
  address: string,
  allergyTest?: Booking,
  createdAt = new Date().toISOString(),
): OutboxMessage[] {
  const firstName = client.name.split(" ")[0];
  const stylist = getStylist(booking.stylistId)?.name ?? "el equipo";
  const lines = [
    `¡Hola, ${firstName}! Tu cita en ${SALON.name} está confirmada.`,
    `${booking.serviceName} con ${stylist}, el ${when(booking)}.`,
  ];
  if (allergyTest) lines.push(`Antes, tu prueba de alergia: ${when(allergyTest)} (10 min).`);
  lines.push(`Te esperamos en ${address}. Código: ${booking.code}.`);
  const body = lines.join("\n");
  const messages: OutboxMessage[] = [
    {
      id: newId("m"),
      channel: "whatsapp",
      to: `+34 ${formatPhone(client.phone)}`,
      subject: "Confirmación de cita",
      body,
      bookingId: booking.id,
      createdAt,
    },
  ];
  if (client.email) {
    messages.push({
      id: newId("m"),
      channel: "email",
      to: client.email,
      subject: `Tu cita del ${fmtDateLong(booking.date)} · ${SALON.name}`,
      body: `${body}\n\nAdjuntamos el archivo de calendario (.ics).`,
      bookingId: booking.id,
      createdAt,
    });
  }
  return messages;
}

export function cancellationMessage(client: Client, booking: Booking): OutboxMessage {
  return {
    id: newId("m"),
    channel: "whatsapp",
    to: `+34 ${formatPhone(client.phone)}`,
    subject: "Cita cancelada",
    body: `Hola, ${client.name.split(" ")[0]}. Hemos cancelado tu cita de ${booking.serviceName} del ${when(booking)}. Si quieres otro día, reserva de nuevo cuando quieras.`,
    bookingId: booking.id,
    createdAt: new Date().toISOString(),
  };
}

export function rescheduleMessage(client: Client, booking: Booking): OutboxMessage {
  return {
    id: newId("m"),
    channel: "whatsapp",
    to: `+34 ${formatPhone(client.phone)}`,
    subject: "Cita modificada",
    body: `Hola, ${client.name.split(" ")[0]}. Tu cita de ${booking.serviceName} ha cambiado: ahora es el ${when(booking)} con ${getStylist(booking.stylistId)?.name ?? "el equipo"}.`,
    bookingId: booking.id,
    createdAt: new Date().toISOString(),
  };
}
