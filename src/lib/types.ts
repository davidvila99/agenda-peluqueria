/** A = activo (estilista ocupada) · P = pose (estilista libre) · L = lavado (estilista + lavacabezas) */
export type SegmentKind = "A" | "P" | "L";

export interface Segment {
  kind: SegmentKind;
  min: number;
  label: string;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  segments: Segment[];
  description: string;
  isColor: boolean;
  isAllergyTest?: boolean;
  /** Visible en la reserva pública */
  public: boolean;
}

/** Horario por día de la semana (0 = domingo). Minutos desde medianoche. */
export type WeeklySchedule = Record<number, { open: number; close: number } | null>;

export interface Stylist {
  id: string;
  name: string;
  role: string;
  schedule: WeeklySchedule;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  /** Se ha hecho color en el salón antes de usar esta agenda */
  colorHistory: boolean;
  createdAt: string;
}

export type BookingStatus = "confirmada" | "completada" | "cancelada" | "no_presentada";

export interface Booking {
  id: string;
  code: string;
  clientId: string;
  serviceId: string;
  serviceName: string;
  price: number;
  /** Copia de los tramos del servicio al reservar: editar el catálogo no altera turnos ya dados */
  segments: Segment[];
  isColor: boolean;
  isAllergyTest: boolean;
  stylistId: string;
  /** YYYY-MM-DD, hora local del salón */
  date: string;
  /** Minutos desde medianoche, hora local del salón */
  start: number;
  status: BookingStatus;
  source: "online" | "salon";
  notes?: string;
  /** Prueba de alergia ↔ color que la requiere */
  linkedBookingId?: string;
  createdAt: string;
}

export interface OutboxMessage {
  id: string;
  channel: "whatsapp" | "email";
  to: string;
  subject: string;
  body: string;
  bookingId?: string;
  createdAt: string;
}

export interface Settings {
  address: string;
}

export interface AppState {
  version: number;
  seededAt: string;
  settings: Settings;
  clients: Client[];
  bookings: Booking[];
  outbox: OutboxMessage[];
}
