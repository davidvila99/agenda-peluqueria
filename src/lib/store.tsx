import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ALLERGY_TEST_ID, SALON, STYLISTS, getService } from "./catalog";
import { cancellationMessage, confirmationMessages, makeBooking, newId, normalizePhone, rescheduleMessage } from "./bookings";
import { checkAllergy, checkSlot, type Conflict, type SchedulingContext } from "./scheduling";
import { STATE_VERSION, createSeed } from "./seed";
import { salonEpoch } from "./time";
import type { AppState, Booking, BookingStatus, Client, Settings } from "./types";

export const STORAGE_KEY = "corto-y-cambio:agenda";

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === STATE_VERSION && Array.isArray(parsed.bookings) && Array.isArray(parsed.clients)) return parsed;
    }
  } catch {
    // Sin acceso a localStorage (modo privado, bloqueado…): seguimos con datos de ejemplo en memoria.
  }
  return createSeed().state;
}

function persist(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignorado: la app sigue funcionando en memoria.
  }
}

export interface SlotInput {
  stylistId: string;
  date: string;
  start: number;
}

export interface BookInput extends SlotInput {
  /** Clienta existente (id) o datos de una nueva */
  client: { id: string } | Omit<Client, "id" | "createdAt">;
  serviceId: string;
  source: Booking["source"];
  notes?: string;
  /** Prueba de alergia que se reserva junto al color */
  allergyTest?: SlotInput;
  /** Rechazar horarios pasados (reserva pública) */
  rejectPast?: boolean;
}

export type BookResult = { ok: true; booking: Booking; test?: Booking } | { ok: false; conflicts: Conflict[] };

export type UpdateResult = { ok: true; booking: Booking } | { ok: false; conflicts: Conflict[] };

interface Store {
  state: AppState;
  ctx: SchedulingContext;
  book(input: BookInput): BookResult;
  moveBooking(id: string, changes: SlotInput & { serviceId?: string; notes?: string }): UpdateResult;
  setStatus(id: string, status: BookingStatus): UpdateResult;
  saveClient(client: Client): { ok: true } | { ok: false; message: string };
  findClientByPhone(phone: string): Client | undefined;
  updateSettings(settings: Settings): void;
  clearOutbox(): void;
  resetDemo(): void;
}

const StoreContext = createContext<Store | null>(null);

function contextOf(state: AppState): SchedulingContext {
  return {
    bookings: state.bookings,
    clients: state.clients,
    stylists: STYLISTS,
    washbasins: SALON.washbasins,
    cabins: SALON.cabins,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const ref = useRef(state);

  const commit = useCallback((next: AppState) => {
    ref.current = next;
    setState(next);
    persist(next);
  }, []);

  // Guardar el estado inicial (datos de ejemplo recién generados)
  useEffect(() => persist(ref.current), []);

  // Sincroniza pestañas: una reserva hecha en la web pública aparece en la agenda abierta en otra pestaña.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = e.newValue ? (JSON.parse(e.newValue) as AppState) : createSeed().state;
      ref.current = next;
      setState(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const store = useMemo<Store>(() => {
    const findClientByPhone = (phone: string) => {
      const digits = normalizePhone(phone);
      return ref.current.clients.find((c) => c.phone === digits);
    };

    const book = (input: BookInput): BookResult => {
      const current = ref.current;
      const service = getService(input.serviceId);
      if (!service) return { ok: false, conflicts: [{ kind: "closed", message: "Servicio no encontrado." }] };

      let clients = current.clients;
      let client: Client | undefined;
      if ("id" in input.client) {
        const id = input.client.id;
        client = clients.find((c) => c.id === id);
      } else {
        client = clients.find((c) => c.phone === normalizePhone((input.client as Client).phone));
        if (!client) {
          client = { ...input.client, phone: normalizePhone(input.client.phone), id: newId("c"), createdAt: new Date().toISOString() };
          clients = [...clients, client];
        }
      }
      if (!client) return { ok: false, conflicts: [{ kind: "client", message: "Clienta no encontrada." }] };

      const ctx = { ...contextOf(current), clients };
      const nowMs = input.rejectPast ? Date.now() : undefined;
      const conflicts: Conflict[] = [];

      let test: Booking | undefined;
      if (input.allergyTest) {
        const testService = getService(ALLERGY_TEST_ID)!;
        conflicts.push(
          ...checkSlot(ctx, { segments: testService.segments, ...input.allergyTest, clientId: client.id }, { nowMs }).map((c) => ({
            ...c,
            message: `Prueba de alergia: ${c.message}`,
          })),
        );
        test = makeBooking(testService, { ...input.allergyTest, clientId: client.id, source: input.source });
      }

      const ctxWithTest = test ? { ...ctx, bookings: [...ctx.bookings, test] } : ctx;
      conflicts.push(
        ...checkSlot(
          ctxWithTest,
          { segments: service.segments, stylistId: input.stylistId, date: input.date, start: input.start, clientId: client.id },
          { nowMs },
        ),
      );
      const allergy = checkAllergy(ctxWithTest, { clientId: client.id, isColor: service.isColor, date: input.date, start: input.start });
      if (allergy) conflicts.push(allergy);
      if (conflicts.length) return { ok: false, conflicts };

      const booking = makeBooking(service, {
        clientId: client.id,
        stylistId: input.stylistId,
        date: input.date,
        start: input.start,
        source: input.source,
        notes: input.notes?.trim() || undefined,
        linkedBookingId: test?.id,
      });
      if (test) test.linkedBookingId = booking.id;

      commit({
        ...current,
        clients,
        bookings: [...current.bookings, ...(test ? [test] : []), booking],
        outbox: [...confirmationMessages(client, booking, current.settings.address, test), ...current.outbox],
      });
      return { ok: true, booking, test };
    };

    const moveBooking: Store["moveBooking"] = (id, changes) => {
      const current = ref.current;
      const original = current.bookings.find((b) => b.id === id);
      if (!original) return { ok: false, conflicts: [{ kind: "closed", message: "Cita no encontrada." }] };
      const service = changes.serviceId && changes.serviceId !== original.serviceId ? getService(changes.serviceId) : undefined;
      const updated: Booking = {
        ...(service ? makeBooking(service, { ...original, source: original.source }) : original),
        id: original.id,
        code: original.code,
        stylistId: changes.stylistId,
        date: changes.date,
        start: changes.start,
        notes: changes.notes?.trim() || undefined,
      };
      const ctx = contextOf(current);
      const conflicts = checkSlot(ctx, { ...updated, clientId: updated.clientId, excludeBookingIds: [id] });
      const allergy = checkAllergy(ctx, { ...updated, excludeBookingIds: [id] });
      if (allergy) conflicts.push(allergy);
      if (conflicts.length) return { ok: false, conflicts };
      const client = current.clients.find((c) => c.id === updated.clientId);
      const changed = updated.date !== original.date || updated.start !== original.start || updated.stylistId !== original.stylistId;
      commit({
        ...current,
        bookings: current.bookings.map((b) => (b.id === id ? updated : b)),
        outbox: client && changed ? [rescheduleMessage(client, updated), ...current.outbox] : current.outbox,
      });
      return { ok: true, booking: updated };
    };

    const setStatus: Store["setStatus"] = (id, status) => {
      const current = ref.current;
      const original = current.bookings.find((b) => b.id === id);
      if (!original) return { ok: false, conflicts: [{ kind: "closed", message: "Cita no encontrada." }] };
      const wasLive = original.status === "confirmada" || original.status === "completada";
      const willBeLive = status === "confirmada" || status === "completada";
      // Reactivar una cita cancelada solo si su hueco sigue libre.
      if (!wasLive && willBeLive) {
        const ctx = contextOf(current);
        const conflicts = checkSlot(ctx, { ...original, clientId: original.clientId, excludeBookingIds: [id] });
        if (conflicts.length) return { ok: false, conflicts };
      }
      const updated = { ...original, status };
      const client = current.clients.find((c) => c.id === original.clientId);
      commit({
        ...current,
        bookings: current.bookings.map((b) => (b.id === id ? updated : b)),
        outbox: status === "cancelada" && client ? [cancellationMessage(client, updated), ...current.outbox] : current.outbox,
      });
      return { ok: true, booking: updated };
    };

    const saveClient: Store["saveClient"] = (client) => {
      const current = ref.current;
      const phone = normalizePhone(client.phone);
      const dup = current.clients.find((c) => c.phone === phone && c.id !== client.id);
      if (dup) return { ok: false, message: `Ese teléfono ya es de ${dup.name}.` };
      const next = { ...client, phone };
      const exists = current.clients.some((c) => c.id === client.id);
      commit({
        ...current,
        clients: exists ? current.clients.map((c) => (c.id === client.id ? next : c)) : [...current.clients, next],
      });
      return { ok: true };
    };

    return {
      state,
      ctx: contextOf(state),
      book,
      moveBooking,
      setStatus,
      saveClient,
      findClientByPhone,
      updateSettings: (settings) => commit({ ...ref.current, settings }),
      clearOutbox: () => commit({ ...ref.current, outbox: [] }),
      resetDemo: () => commit(createSeed().state),
    };
  }, [state, commit]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore fuera de StoreProvider");
  return store;
}

/** Instante actual que se refresca cada minuto (para la línea de "ahora" y los horarios pasados). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function bookingStartEpoch(b: Pick<Booking, "date" | "start">) {
  return salonEpoch(b.date, b.start);
}
