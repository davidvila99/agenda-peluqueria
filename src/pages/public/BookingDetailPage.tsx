import { CalendarPlus, CheckCircle2, FlaskConical, MapPin, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { SegmentBar } from "@/components/SegmentBar";
import { ConfirmDialog, cn, useToast } from "@/components/ui";
import { getStylist } from "@/lib/catalog";
import { STATUS_LABEL, bookingIcsEvent } from "@/lib/bookings";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { bookingEnd, bookingEpoch, timeline } from "@/lib/scheduling";
import { useNow, useStore } from "@/lib/store";
import { capitalize, fmtDateLong, fmtTime } from "@/lib/time";
import type { Booking } from "@/lib/types";
import PublicShell from "./PublicShell";

const KIND_PUBLIC = { A: "Contigo", P: "Pose", L: "Lavado" } as const;

export default function BookingDetailPage() {
  const { code } = useParams();
  const [params] = useSearchParams();
  const { state, setStatus } = useStore();
  const nowMs = useNow();
  const toast = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const booking = state.bookings.find((b) => b.code === code);
  const linked = booking?.linkedBookingId ? state.bookings.find((b) => b.id === booking.linkedBookingId) : undefined;

  if (!booking) {
    return (
      <PublicShell>
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="text-3xl font-bold">No encontramos esa reserva</h1>
          <p className="mt-3 text-white/70">Revisa el código o búscala con tu móvil.</p>
          <Link to="/mis-citas" className="mt-8 inline-block rounded-full bg-flamingo px-6 py-3 font-bold text-ink">
            Buscar mis citas
          </Link>
        </main>
      </PublicShell>
    );
  }

  const isNew = params.get("nueva") === "1";
  const upcoming = booking.status === "confirmada" && bookingEpoch(booking) > nowMs;
  const events = [booking, ...(linked && linked.status === "confirmada" ? [linked] : [])];

  const downloadCalendar = () => {
    const ics = buildIcs(events.map((b) => bookingIcsEvent(b, state.settings.address)));
    downloadIcs(`corto-y-cambio-${booking.code}.ics`, ics);
  };

  return (
    <PublicShell>
      <main className="mx-auto max-w-xl px-4 pb-16 pt-8">
        {isNew && booking.status === "confirmada" ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto text-flamingo" size={52} />
            <h1 className="mt-4 text-4xl font-extrabold uppercase leading-none">¡Reserva confirmada!</h1>
            <p className="mt-3 text-white/75">
              Código <strong className="text-white">{booking.code}</strong>. Te hemos enviado la confirmación por WhatsApp
              {state.clients.find((c) => c.id === booking.clientId)?.email ? " y por correo" : ""}.
            </p>
            <p className="mt-1 text-xs text-white/45">(Envío simulado en esta demo.)</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-flamingo">Tu reserva · {booking.code}</p>
            <h1 className="mt-1 text-3xl font-bold">{booking.serviceName}</h1>
            <StatusPill booking={booking} />
          </div>
        )}

        <BookingCard booking={booking} address={state.settings.address} />

        {linked && (
          <div className="mt-3 flex gap-3 rounded-2xl border border-flamingo/40 bg-flamingo/10 p-4 text-sm">
            <FlaskConical className="mt-0.5 shrink-0 text-flamingo" size={20} />
            <div>
              <p className="font-semibold">{linked.isAllergyTest ? "Prueba de alergia" : `Cita vinculada: ${linked.serviceName}`}</p>
              <p className="text-white/75">
                {capitalize(fmtDateLong(linked.date))} a las {fmtTime(linked.start)} con {getStylist(linked.stylistId)?.name} ·{" "}
                {STATUS_LABEL[linked.status].toLowerCase()}
              </p>
              {linked.isAllergyTest && <p className="mt-1 text-white/60">Pasa 10 minutos por el salón. Sin ella no podemos hacerte el color.</p>}
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-3">
          {booking.status === "confirmada" && (
            <button
              onClick={downloadCalendar}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-flamingo px-6 py-4 font-bold text-ink hover:bg-white"
            >
              <CalendarPlus size={20} /> Añadir al calendario
            </button>
          )}
          {upcoming && (
            <button
              onClick={() => setConfirmCancel(true)}
              className="rounded-full border border-white/30 px-6 py-4 font-semibold hover:border-white"
            >
              Cancelar cita
            </button>
          )}
          <Link to="/" className="py-2 text-center text-sm text-white/60 underline-offset-4 hover:text-white hover:underline">
            Volver a la web
          </Link>
        </div>

        <ConfirmDialog
          open={confirmCancel}
          onClose={() => setConfirmCancel(false)}
          title="¿Cancelar tu cita?"
          message={
            <>
              Vas a cancelar {booking.serviceName} del {fmtDateLong(booking.date)} a las {fmtTime(booking.start)}. El hueco quedará libre para
              otra persona.
            </>
          }
          confirmLabel="Sí, cancelar"
          danger
          onConfirm={() => {
            setStatus(booking.id, "cancelada");
            toast("Cita cancelada.");
          }}
        />
      </main>
    </PublicShell>
  );
}

function StatusPill({ booking }: { booking: Booking }) {
  return (
    <span
      className={cn(
        "mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold",
        booking.status === "confirmada" ? "bg-flamingo text-ink" : "bg-white/15 text-white",
      )}
    >
      {STATUS_LABEL[booking.status]}
    </span>
  );
}

function BookingCard({ booking, address }: { booking: Booking; address: string }) {
  return (
    <div className="mt-8 rounded-2xl bg-graphite p-5">
      <p className="font-display text-xl font-semibold">{booking.serviceName}</p>
      <p className="mt-1 text-white/75">
        {capitalize(fmtDateLong(booking.date))} · {fmtTime(booking.start)}–{fmtTime(bookingEnd(booking))}
      </p>
      <p className="text-white/75">Con {getStylist(booking.stylistId)?.name}</p>
      {booking.segments.length > 1 && (
        <>
          <SegmentBar segments={booking.segments} variant="public" showLabels className="mt-4" />
          <ol className="mt-4 space-y-1.5 text-sm">
            {timeline(booking.segments, booking.start).map((s) => (
              <li key={s.index} className="flex justify-between gap-3">
                <span className="text-white/80">
                  {fmtTime(s.start)} · {s.label}
                </span>
                <span className="text-white/50">{KIND_PUBLIC[s.kind]}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-white/55">Durante la pose puedes relajarte: tu estilista vuelve contigo justo a tiempo para el lavado.</p>
        </>
      )}
      {booking.price > 0 && (
        <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
          <span className="text-white/75">Total (se paga en el salón)</span>
          <span className="font-display text-2xl font-semibold">{booking.price} €</span>
        </div>
      )}
      <div className="mt-4 flex gap-2 border-t border-white/10 pt-4 text-sm text-white/80">
        <MapPin size={18} className="shrink-0 text-flamingo" />
        {address}
      </div>
      {booking.notes && (
        <div className="mt-3 flex gap-2 text-sm text-white/70">
          <MessageCircle size={18} className="shrink-0 text-flamingo" />
          {booking.notes}
        </div>
      )}
    </div>
  );
}
