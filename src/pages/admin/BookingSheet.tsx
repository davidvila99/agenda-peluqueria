import { AlertTriangle, CalendarPlus, Check, FlaskConical, Pencil, RotateCcw, UserRound, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ConfirmDialog, Sheet, cn, useToast } from "@/components/ui";
import { SALON, getStylist } from "@/lib/catalog";
import { STATUS_LABEL, bookingIcsEvent, formatPhone } from "@/lib/bookings";
import { buildIcs, downloadIcs } from "@/lib/ics";
import {
  assignWashbasins,
  bookingEnd,
  bookingEpoch,
  findValidAllergyTest,
  isFirstTimeColor,
  liveBookingsOn,
  timeline,
} from "@/lib/scheduling";
import { useStore } from "@/lib/store";
import { capitalize, fmtDateLong, fmtDateShort, fmtTime } from "@/lib/time";
import type { Booking, BookingStatus } from "@/lib/types";

const KIND_NAME = { A: "Activo", P: "Pose · libre", L: "Lavado" } as const;

export default function BookingSheet({ booking, onClose }: { booking: Booking | undefined; onClose: () => void }) {
  const { state, ctx, setStatus } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!booking) return null;
  const client = state.clients.find((c) => c.id === booking.clientId);
  const stylist = getStylist(booking.stylistId);
  const linked = booking.linkedBookingId ? state.bookings.find((b) => b.id === booking.linkedBookingId) : undefined;
  const basins = assignWashbasins(liveBookingsOn(ctx, booking.date), SALON.washbasins);

  const change = (status: BookingStatus, message: string) => {
    const result = setStatus(booking.id, status);
    if (result.ok) toast(message);
    else toast(result.conflicts[0]?.message ?? "No se pudo cambiar.", "error");
  };

  let allergy: { ok: boolean; text: string } | null = null;
  if (booking.isColor) {
    const epoch = bookingEpoch(booking);
    if (!isFirstTimeColor(ctx, booking.clientId, epoch, [booking.id])) {
      allergy = { ok: true, text: "Tiene historial de color: no necesita prueba." };
    } else {
      const test = findValidAllergyTest(ctx, booking.clientId, epoch, [booking.id]);
      allergy = test
        ? { ok: true, text: `Prueba de alergia el ${fmtDateShort(test.date)} a las ${fmtTime(test.start)} (${STATUS_LABEL[test.status].toLowerCase()}).` }
        : { ok: false, text: "Primera vez con color y sin prueba de alergia válida (48 h antes). No se puede hacer el color." };
    }
  }

  const isLiveStatus = booking.status === "confirmada" || booking.status === "completada";

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={
          <div>
            <p className="text-xs font-medium text-neutral-500">
              {booking.code} · {booking.source === "online" ? "Reserva online" : "Reserva en salón"}
            </p>
            <h2 className="truncate text-lg font-semibold">{client?.name ?? "Clienta"}</h2>
            <p className="text-sm text-neutral-600">{booking.serviceName}</p>
          </div>
        }
        footer={
          booking.status === "confirmada" ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate(`/equipo/agenda/cita/${booking.id}`)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 py-3 text-sm font-semibold hover:bg-neutral-50"
              >
                <Pencil size={16} /> Mover o editar
              </button>
              <button
                onClick={() => change("completada", "Marcada como completada.")}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink py-3 text-sm font-semibold text-white hover:bg-graphite"
              >
                <Check size={16} /> Completada
              </button>
              <button
                onClick={() => change("no_presentada", "Marcada como no presentada: el hueco queda libre.")}
                className="rounded-xl border border-neutral-300 py-3 text-sm font-semibold hover:bg-neutral-50"
              >
                No se presentó
              </button>
              <button
                onClick={() => setConfirmCancel(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-300 py-3 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                <X size={16} /> Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => change("confirmada", "Cita reactivada.")}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-300 py-3 text-sm font-semibold hover:bg-neutral-50"
            >
              <RotateCcw size={16} /> {booking.status === "completada" ? "Volver a confirmada" : "Reactivar cita"}
            </button>
          )
        }
      >
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-semibold",
                booking.status === "confirmada" && "bg-ink text-white",
                booking.status === "completada" && "bg-emerald-100 text-emerald-800",
                booking.status === "cancelada" && "bg-neutral-200 text-neutral-700",
                booking.status === "no_presentada" && "bg-amber-100 text-amber-800",
              )}
            >
              {STATUS_LABEL[booking.status]}
            </span>
            {booking.price > 0 && <span className="font-semibold">{booking.price} €</span>}
          </div>

          <div>
            <p className="font-semibold">
              {capitalize(fmtDateLong(booking.date))} · {fmtTime(booking.start)}–{fmtTime(bookingEnd(booking))}
            </p>
            <p className="text-neutral-600">Con {stylist?.name}</p>
          </div>

          <ol className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {timeline(booking.segments, booking.start).map((s) => (
              <li key={s.index} className="flex items-center gap-3 px-3 py-2">
                <span className={cn(booking.isAllergyTest ? "seg-T" : `seg-${s.kind}`, "h-6 w-1.5 shrink-0 rounded-full")} />
                <span className="w-24 shrink-0 tabular-nums text-neutral-600">
                  {fmtTime(s.start)}–{fmtTime(s.end)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{s.label}</span>
                  <span className="block text-xs text-neutral-500">
                    {KIND_NAME[s.kind]}
                    {s.kind === "L" && isLiveStatus && ` · Lavacabezas ${(basins.get(`${booking.id}:${s.index}`) ?? 0) + 1}`}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          {allergy && (
            <div className={cn("flex gap-2 rounded-xl p-3", allergy.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800")}>
              {allergy.ok ? <FlaskConical size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}
              <p>{allergy.text}</p>
            </div>
          )}

          {linked && (
            <Link
              to={`/equipo/agenda?fecha=${linked.date}&cita=${linked.id}`}
              className="block rounded-xl border border-neutral-200 p-3 hover:bg-neutral-50"
              onClick={onClose}
            >
              <span className="text-xs text-neutral-500">{linked.isAllergyTest ? "Prueba de alergia vinculada" : "Color vinculado a esta prueba"}</span>
              <span className="block font-medium">
                {linked.serviceName} · {fmtDateShort(linked.date)} {fmtTime(linked.start)} · {STATUS_LABEL[linked.status]}
              </span>
            </Link>
          )}

          {booking.notes && <p className="rounded-xl bg-neutral-100 p-3 italic">“{booking.notes}”</p>}

          {client && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-3">
              <div className="min-w-0">
                <p className="font-medium">{client.name}</p>
                <p className="text-neutral-600">{formatPhone(client.phone)}</p>
                {client.notes && <p className="mt-1 text-xs text-neutral-500">{client.notes}</p>}
              </div>
              <Link
                to={`/equipo/clientas/${client.id}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium hover:bg-neutral-100"
              >
                <UserRound size={16} /> Ficha
              </Link>
            </div>
          )}

          {isLiveStatus && (
            <button
              onClick={() => downloadIcs(`corto-y-cambio-${booking.code}.ics`, buildIcs([bookingIcsEvent(booking, state.settings.address)]))}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-700 underline-offset-4 hover:underline"
            >
              <CalendarPlus size={16} /> Descargar archivo de calendario
            </button>
          )}
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="¿Cancelar esta cita?"
        message={`${client?.name ?? "La clienta"} · ${booking.serviceName} · ${fmtDateShort(booking.date)} ${fmtTime(booking.start)}. Se enviará un aviso de cancelación (simulado).`}
        confirmLabel="Cancelar cita"
        danger
        onConfirm={() => change("cancelada", "Cita cancelada.")}
      />
    </>
  );
}
