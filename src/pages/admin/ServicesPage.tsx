import { Armchair, Droplets, FlaskConical } from "lucide-react";
import { SegmentBar, SegmentLegend } from "@/components/SegmentBar";
import { Initials } from "@/components/ui";
import { SALON, SERVICES, STYLISTS } from "@/lib/catalog";
import { stylistMinutes, totalMinutes } from "@/lib/scheduling";
import { fmtTime } from "@/lib/time";
import { PageHeader } from "./AdminLayout";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <PageHeader title="Servicios y equipo" subtitle="Cada servicio es una secuencia de tramos: la estilista solo está ocupada en los activos." />
      <SegmentLegend className="mt-4 text-neutral-700" />

      <ul className="mt-4 space-y-3">
        {SERVICES.map((s) => {
          const total = totalMinutes(s.segments);
          const busy = stylistMinutes(s.segments);
          return (
            <li key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {s.name}
                    {s.isColor && <span className="ml-2 rounded-full bg-flamingo-soft px-2 py-0.5 text-xs font-medium text-flamingo-dark">Color</span>}
                    {s.isAllergyTest && <FlaskConical size={16} className="ml-2 inline text-amber-600" />}
                  </p>
                  <p className="text-sm text-neutral-500">{s.description}</p>
                </div>
                <p className="shrink-0 font-display text-lg font-semibold">{s.price ? `${s.price} €` : "Gratis"}</p>
              </div>
              <SegmentBar segments={s.segments} showLabels className="mt-3" />
              <p className="mt-2 text-xs text-neutral-600">
                {s.segments.map((seg) => `${seg.kind} ${seg.min}`).join(" · ")} — total {total} min, estilista ocupada {busy} min
                {total > busy && <strong className="text-flamingo-dark">, libre {total - busy} min en pose</strong>}
                {!s.public && " · solo desde la agenda o junto a un primer color"}
              </p>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-8 text-lg font-bold">Equipo</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {STYLISTS.map((st) => (
          <li key={st.id} className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
            <Initials name={st.name} className="h-10 w-10 bg-ink text-sm text-white" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{st.name}</p>
              <p className="text-neutral-500">{st.role}</p>
              <ul className="mt-2 space-y-0.5 text-neutral-700">
                {[2, 3, 4, 5, 6].map((d) => {
                  const h = st.schedule[d];
                  return (
                    <li key={d} className="flex justify-between gap-4">
                      <span>{DAY_NAMES[d]}</span>
                      <span className="tabular-nums">{h ? `${fmtTime(h.open)}–${fmtTime(h.close)}` : "Libre"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-bold">Recursos compartidos</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
          <Droplets className="shrink-0 text-sky-600" />
          <div>
            <p className="font-semibold">{SALON.washbasins} lavacabezas</p>
            <p className="text-neutral-500">Cada tramo de lavado ocupa uno. Nunca hay más lavados a la vez que lavacabezas.</p>
          </div>
        </div>
        <div className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
          <Armchair className="shrink-0 text-neutral-600" />
          <div>
            <p className="font-semibold">{SALON.cabins} cabinas de trabajo</p>
            <p className="text-neutral-500">La clienta ocupa una durante todo su servicio, también en la pose.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
