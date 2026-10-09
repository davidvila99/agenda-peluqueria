import { ChevronRight, Search, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Initials, cn, inputClass } from "@/components/ui";
import { formatPhone } from "@/lib/bookings";
import { bookingEpoch } from "@/lib/scheduling";
import { useNow, useStore } from "@/lib/store";
import { fmtDateShort, fmtTime } from "@/lib/time";
import { PageHeader } from "./AdminLayout";
import { TONE_CLASS, colorStatus } from "./clientStatus";

export default function ClientsPage() {
  const { state, ctx } = useStore();
  const nowMs = useNow();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const digits = query.replace(/\D/g, "");
  const clients = state.clients
    .filter((c) => !q || c.name.toLowerCase().includes(q) || (digits && c.phone.includes(digits)))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <PageHeader
        title="Clientas"
        subtitle={`${state.clients.length} fichas`}
        action={
          <Link to="/equipo/clientas/nueva" className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2.5 text-sm font-semibold text-white">
            <UserPlus size={16} /> Nueva
          </Link>
        }
      />
      <div className="relative mt-4">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input className={cn(inputClass, "pl-10")} placeholder="Buscar por nombre o móvil" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar" />
      </div>
      {clients.length === 0 ? (
        <p className="mt-6 text-center text-neutral-500">Ninguna clienta coincide con “{query}”.</p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {clients.map((c) => {
            const next = state.bookings
              .filter((b) => b.clientId === c.id && b.status === "confirmada" && bookingEpoch(b) > nowMs)
              .sort((a, b) => bookingEpoch(a) - bookingEpoch(b))[0];
            const status = colorStatus(ctx, c);
            return (
              <li key={c.id}>
                <Link to={`/equipo/clientas/${c.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-neutral-50">
                  <Initials name={c.name} className="h-10 w-10 bg-neutral-100 text-sm text-ink" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="block truncate text-sm text-neutral-500">
                      {formatPhone(c.phone)}
                      {next && ` · próxima: ${fmtDateShort(next.date)} ${fmtTime(next.start)}`}
                    </span>
                  </span>
                  <span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-medium sm:inline", TONE_CLASS[status.tone])}>{status.label}</span>
                  <ChevronRight size={18} className="shrink-0 text-neutral-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
