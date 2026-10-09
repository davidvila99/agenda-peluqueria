import { ArrowLeft, CalendarPlus, FlaskConical, Mail, Pencil, Phone } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Initials, cn } from "@/components/ui";
import { ALLERGY_TEST_ID, getStylist } from "@/lib/catalog";
import { STATUS_LABEL, formatPhone } from "@/lib/bookings";
import { bookingEnd, bookingEpoch } from "@/lib/scheduling";
import { useNow, useStore } from "@/lib/store";
import { capitalize, fmtDateShort, fmtTime } from "@/lib/time";
import type { Booking } from "@/lib/types";
import { TONE_CLASS, colorStatus } from "./clientStatus";

export default function ClientDetailPage() {
  const { id } = useParams();
  const { state, ctx } = useStore();
  const nowMs = useNow();
  const navigate = useNavigate();
  const client = state.clients.find((c) => c.id === id);

  if (!client) {
    return (
      <div className="p-6 text-center">
        <p className="font-semibold">Esta ficha no existe.</p>
        <Link to="/equipo/clientas" className="mt-4 inline-block rounded-xl bg-ink px-4 py-2.5 font-semibold text-white">
          Ver clientas
        </Link>
      </div>
    );
  }

  const mine = state.bookings.filter((b) => b.clientId === client.id).sort((a, b) => bookingEpoch(a) - bookingEpoch(b));
  const upcoming = mine.filter((b) => b.status === "confirmada" && bookingEpoch(b) > nowMs);
  const past = mine.filter((b) => !upcoming.includes(b)).reverse();
  const status = colorStatus(ctx, client);
  const spent = mine.filter((b) => b.status === "completada").reduce((s, b) => s + b.price, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <button onClick={() => navigate(-1)} className="-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100">
        <ArrowLeft size={16} /> Volver
      </button>
      <div className="mt-3 flex items-center gap-4">
        <Initials name={client.name} className="h-14 w-14 bg-ink text-lg text-white" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{client.name}</h1>
          <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium", TONE_CLASS[status.tone])}>{status.label}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to={`/equipo/agenda/nueva?clienta=${client.id}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink py-3 text-sm font-semibold text-white"
        >
          <CalendarPlus size={16} /> Nueva cita
        </Link>
        <Link
          to={`/equipo/clientas/${client.id}/editar`}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white py-3 text-sm font-semibold"
        >
          <Pencil size={16} /> Editar ficha
        </Link>
      </div>

      <div className="mt-4 space-y-2 rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
        <p className="flex items-center gap-2">
          <Phone size={16} className="text-neutral-400" /> {formatPhone(client.phone)}
        </p>
        {client.email && (
          <p className="flex items-center gap-2">
            <Mail size={16} className="text-neutral-400" /> {client.email}
          </p>
        )}
        {client.notes && <p className="rounded-lg bg-neutral-100 p-2.5 italic">{client.notes}</p>}
        <p className="text-neutral-500">
          {mine.filter((b) => b.status === "completada").length} visitas completadas · {spent} € facturados
        </p>
      </div>

      {status.tone === "warn" && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <FlaskConical size={20} className="shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold">Si pide color, necesita prueba de alergia 48 h antes.</p>
            <Link to={`/equipo/agenda/nueva?clienta=${client.id}&servicio=${ALLERGY_TEST_ID}`} className="mt-1 inline-block font-semibold underline">
              Reservar prueba de alergia
            </Link>
          </div>
        </div>
      )}

      <BookingList title="Próximas citas" bookings={upcoming} empty="No tiene citas próximas." />
      <BookingList title="Historial" bookings={past} empty="Todavía no hay historial." />
    </div>
  );
}

function BookingList({ title, bookings, empty }: { title: string; bookings: Booking[]; empty: string }) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      {bookings.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {bookings.map((b) => (
            <li key={b.id}>
              <Link to={`/equipo/agenda?fecha=${b.date}&cita=${b.id}`} className="flex items-center justify-between gap-3 px-3 py-3 hover:bg-neutral-50">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{b.serviceName}</span>
                  <span className="block text-sm text-neutral-500">
                    {capitalize(fmtDateShort(b.date))} · {fmtTime(b.start)}–{fmtTime(bookingEnd(b))} · {getStylist(b.stylistId)?.name}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    b.status === "confirmada" && "bg-ink text-white",
                    b.status === "completada" && "bg-emerald-50 text-emerald-800",
                    b.status === "cancelada" && "bg-neutral-100 text-neutral-600",
                    b.status === "no_presentada" && "bg-amber-50 text-amber-800",
                  )}
                >
                  {STATUS_LABEL[b.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
