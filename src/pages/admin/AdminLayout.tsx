import { Bell, CalendarDays, ExternalLink, Scissors, Settings, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { cn } from "@/components/ui";
import { useStore } from "@/lib/store";

const NAV = [
  { to: "/equipo/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/equipo/clientas", label: "Clientas", icon: Users },
  { to: "/equipo/servicios", label: "Servicios", icon: Scissors },
  { to: "/equipo/avisos", label: "Avisos", icon: Bell },
  { to: "/equipo/ajustes", label: "Ajustes", icon: Settings },
];

export default function AdminLayout() {
  const { state } = useStore();
  return (
    <div className="flex h-[100dvh] flex-col bg-neutral-50 text-ink">
      <header className="shrink-0 border-b border-neutral-200 bg-white">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <Link to="/equipo/agenda" className="font-display text-base font-extrabold uppercase tracking-tight">
            Corto <span className="text-flamingo">y</span> Cambio <span className="ml-1 font-sans text-xs font-medium normal-case text-neutral-500">Equipo</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn("rounded-lg px-3 py-2 text-sm font-medium", isActive ? "bg-ink text-white" : "text-neutral-600 hover:bg-neutral-100")
                }
              >
                {n.label}
                {n.label === "Avisos" && state.outbox.length > 0 && <span className="ml-1.5 text-xs opacity-70">{state.outbox.length}</span>}
              </NavLink>
            ))}
          </nav>
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
            <span className="hidden sm:inline">Web pública</span> <ExternalLink size={16} aria-label="Web pública" />
          </Link>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="shrink-0 border-t border-neutral-200 bg-white pb-safe md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", isActive ? "text-ink" : "text-neutral-500")
              }
            >
              {({ isActive }) => (
                <>
                  <n.icon size={22} strokeWidth={isActive ? 2.4 : 1.8} className={isActive ? "text-flamingo" : undefined} />
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** Cabecera estándar de las páginas internas con desplazamiento normal. */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
