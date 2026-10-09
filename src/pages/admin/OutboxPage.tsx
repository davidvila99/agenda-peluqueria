import { Mail, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@/components/ui";
import { useStore } from "@/lib/store";
import { PageHeader } from "./AdminLayout";

const dateTime = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" });

export default function OutboxPage() {
  const { state, clearOutbox } = useStore();
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <PageHeader
        title="Avisos"
        subtitle="Confirmaciones, cambios y cancelaciones que se enviarían a las clientas."
        action={
          state.outbox.length > 0 && (
            <button onClick={() => setConfirm(true)} className="shrink-0 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium">
              Vaciar
            </button>
          )
        }
      />
      <p className="mt-4 rounded-xl bg-flamingo-soft p-3 text-sm text-flamingo-dark">
        <strong>Simulado:</strong> no se envía nada. Los mensajes quedan aquí con el texto exacto que recibiría la clienta, listos para conectar
        WhatsApp y correo.
      </p>

      {state.outbox.length === 0 ? (
        <p className="mt-8 text-center text-neutral-500">No hay avisos. Aparecerán al crear, mover o cancelar citas.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {state.outbox.map((m) => {
            const booking = m.bookingId ? state.bookings.find((b) => b.id === m.bookingId) : undefined;
            return (
              <li key={m.id} className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-2 font-semibold">
                    {m.channel === "whatsapp" ? (
                      <MessageCircle size={16} className="shrink-0 text-emerald-600" />
                    ) : (
                      <Mail size={16} className="shrink-0 text-sky-600" />
                    )}
                    <span className="truncate">{m.subject}</span>
                  </p>
                  <span className="shrink-0 text-xs text-neutral-500">{dateTime.format(new Date(m.createdAt))}</span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {m.channel === "whatsapp" ? "WhatsApp" : "Correo"} · {m.to}
                </p>
                <p className="mt-2 whitespace-pre-line text-neutral-800">{m.body}</p>
                {booking && (
                  <Link to={`/equipo/agenda?fecha=${booking.date}&cita=${booking.id}`} className="mt-2 inline-block text-sm font-medium underline">
                    Ver cita
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="¿Vaciar avisos?"
        message="Se borrará el historial de avisos simulados. Las citas no cambian."
        confirmLabel="Vaciar"
        danger
        onConfirm={clearOutbox}
      />
    </div>
  );
}
