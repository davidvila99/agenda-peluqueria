import { ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { getStylist } from "@/lib/catalog";
import { isValidPhone, normalizePhone } from "@/lib/bookings";
import { bookingEpoch, bookingEnd } from "@/lib/scheduling";
import { useNow, useStore } from "@/lib/store";
import { capitalize, fmtDateLong, fmtTime } from "@/lib/time";
import PublicShell from "./PublicShell";

export default function MyBookingsPage() {
  const { state } = useStore();
  const nowMs = useNow();
  const [phone, setPhone] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [error, setError] = useState("");

  const search = () => {
    const digits = normalizePhone(phone);
    if (!isValidPhone(digits)) {
      setError("Introduce un móvil español de 9 cifras.");
      return;
    }
    setError("");
    setSearched(digits);
  };

  const client = searched ? state.clients.find((c) => c.phone === searched) : undefined;
  const upcoming = client
    ? state.bookings
        .filter((b) => b.clientId === client.id && b.status === "confirmada" && bookingEpoch(b) > nowMs)
        .sort((a, b) => bookingEpoch(a) - bookingEpoch(b))
    : [];

  return (
    <PublicShell>
      <main className="mx-auto max-w-xl px-4 pb-16 pt-10">
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-flamingo">Mis citas</p>
        <h1 className="mt-1 text-3xl font-bold">Busca tu reserva</h1>
        <p className="mt-2 text-white/70">Con el móvil que usaste al reservar.</p>
        <div className="mt-6 flex gap-2">
          <input
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="612 345 678"
            aria-label="Tu móvil"
            className="min-w-0 flex-1 rounded-xl border border-white/20 bg-graphite px-3 py-3 text-base text-white placeholder:text-white/40 focus:border-flamingo focus:outline-none"
          />
          <button onClick={search} className="inline-flex items-center gap-2 rounded-xl bg-flamingo px-4 font-bold text-ink">
            <Search size={18} /> Buscar
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

        {searched && (
          <div className="mt-8">
            {upcoming.length === 0 ? (
              <div className="rounded-2xl bg-graphite p-5 text-white/80">
                {client ? `${client.name.split(" ")[0]}, no tienes citas próximas.` : "No hay citas próximas con ese móvil."}
                <Link to="/reservar" className="mt-4 block rounded-full bg-flamingo py-3 text-center font-bold text-ink">
                  Reservar cita
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((b) => (
                  <li key={b.id}>
                    <Link to={`/reserva/${b.code}`} className="flex items-center justify-between gap-3 rounded-2xl bg-graphite p-4 hover:ring-1 hover:ring-flamingo">
                      <span className="min-w-0">
                        <span className="block font-display font-semibold">{b.serviceName}</span>
                        <span className="block text-sm text-white/70">
                          {capitalize(fmtDateLong(b.date))} · {fmtTime(b.start)}–{fmtTime(bookingEnd(b))}
                        </span>
                        <span className="block text-sm text-white/50">Con {getStylist(b.stylistId)?.name}</span>
                      </span>
                      <ChevronRight className="shrink-0 text-flamingo" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </PublicShell>
  );
}
