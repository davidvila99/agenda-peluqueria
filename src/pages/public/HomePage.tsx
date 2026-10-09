import { ArrowRight, FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";
import { SegmentBar, SegmentLegend, durationSummary } from "@/components/SegmentBar";
import { PUBLIC_SERVICES, STYLISTS, getService } from "@/lib/catalog";
import { Initials } from "@/components/ui";
import PublicShell from "./PublicShell";

const GROUPS = [
  { title: "Corte y peinado", ids: ["corte-mujer", "corte-brushing", "corte-hombre", "peinado"] },
  { title: "Color", ids: ["color-raiz", "balayage", "mechas"] },
  { title: "Tratamientos", ids: ["keratina"] },
];

export default function HomePage() {
  const balayage = getService("balayage")!;
  return (
    <PublicShell>
      <main>
        {/* Portada tipográfica: sin fotos de stock */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-flamingo/25 blur-3xl sm:h-96 sm:w-96" />
          <div className="relative mx-auto max-w-5xl px-4 pb-14 pt-12 sm:pb-20 sm:pt-20">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-flamingo">Peluquería en Malasaña</p>
            <h1 className="mt-4 text-[2.6rem] font-extrabold uppercase leading-[0.95] tracking-tight sm:text-7xl">
              Tu pelo,
              <br />
              alto y <span className="text-flamingo">claro.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/80">
              Cortes, color y balayage con gente que sabe lo que hace. Eliges hora en un minuto y te confirmamos al momento.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/reservar"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-flamingo px-7 py-4 text-base font-bold text-ink hover:bg-white"
              >
                Reservar cita <ArrowRight size={18} />
              </Link>
              <Link
                to="/mis-citas"
                className="inline-flex items-center justify-center rounded-full border border-white/30 px-7 py-4 text-base font-semibold hover:border-white"
              >
                Ya tengo cita
              </Link>
            </div>
          </div>
        </section>

        {/* Cómo trabajamos el color */}
        <section className="border-y border-white/10 bg-graphite">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-3xl font-bold leading-tight">
                El color necesita tiempo.
                <br />
                <span className="text-flamingo">Tú no tienes que esperar por una cita.</span>
              </h2>
              <p className="mt-4 text-white/75">
                Mientras tu color hace pose, tu estilista atiende un corte rápido y vuelve contigo justo a tiempo para el lavado.
                Así la agenda no se bloquea entera y hay más horas libres para todo el mundo, sin prisas para nadie.
              </p>
            </div>
            <div className="rounded-2xl bg-ink p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-display text-lg font-semibold">Un balayage, por dentro</p>
                <p className="text-sm text-white/60">{durationSummary(balayage.segments)}</p>
              </div>
              <SegmentBar segments={balayage.segments} variant="public" showLabels className="mt-4" />
              <SegmentLegend variant="public" className="mt-3 text-white/70" />
            </div>
          </div>
        </section>

        {/* Servicios */}
        <section className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-3xl font-bold">Servicios</h2>
          <div className="mt-8 grid gap-10 md:grid-cols-3">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-flamingo">{g.title}</h3>
                <ul className="mt-3 divide-y divide-white/10">
                  {g.ids.map((id) => {
                    const s = PUBLIC_SERVICES.find((x) => x.id === id)!;
                    return (
                      <li key={id}>
                        <Link to={`/reservar?servicio=${id}`} className="group flex items-start justify-between gap-3 py-4">
                          <span className="min-w-0">
                            <span className="block font-semibold group-hover:text-flamingo">{s.name}</span>
                            <span className="block text-sm text-white/60">{durationSummary(s.segments)}</span>
                          </span>
                          <span className="shrink-0 font-display text-lg font-semibold">{s.price} €</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex gap-3 rounded-2xl border border-flamingo/40 bg-flamingo/10 p-5">
            <FlaskConical className="mt-0.5 shrink-0 text-flamingo" size={22} />
            <p className="text-sm text-white/85">
              <strong className="text-white">¿Primera vez con color aquí?</strong> Necesitamos hacerte una prueba de alergia de 10 minutos al
              menos 48 horas antes. La reservas en el mismo paso que tu cita, sin coste.
            </p>
          </div>
        </section>

        {/* Equipo */}
        <section className="border-t border-white/10">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <h2 className="text-3xl font-bold">El equipo</h2>
            <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              {STYLISTS.map((st) => (
                <li key={st.id} className="rounded-2xl bg-graphite p-5">
                  <Initials name={st.name} className="h-12 w-12 bg-flamingo text-lg text-ink" />
                  <p className="mt-4 font-display text-lg font-semibold">{st.name}</p>
                  <p className="text-sm text-white/60">{st.role}</p>
                </li>
              ))}
            </ul>
            <Link
              to="/reservar"
              className="mt-10 inline-flex w-full items-center justify-center gap-2 rounded-full bg-flamingo px-7 py-4 text-base font-bold text-ink hover:bg-white sm:w-auto"
            >
              Reservar cita <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
