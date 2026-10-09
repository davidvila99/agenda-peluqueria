import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { SALON } from "@/lib/catalog";
import { useStore } from "@/lib/store";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`whitespace-nowrap font-display font-extrabold uppercase tracking-tight ${className}`}>
      Corto <span className="text-flamingo">y</span> Cambio
    </span>
  );
}

export default function PublicShell({ children, hideFooter }: { children: ReactNode; hideFooter?: boolean }) {
  const { state } = useStore();
  return (
    <div className="min-h-[100dvh] bg-ink text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-base sm:text-lg" aria-label={`${SALON.name}, inicio`}>
            <Wordmark />
          </Link>
          <nav className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm">
            <Link to="/mis-citas" className="rounded-full px-2 py-2 text-white/80 hover:text-white sm:px-3">
              Mis citas
            </Link>
            <Link to="/reservar" className="rounded-full bg-flamingo px-4 py-2 font-semibold text-ink hover:bg-white">
              Reservar
            </Link>
          </nav>
        </div>
      </header>
      {children}
      {!hideFooter && (
        <footer className="border-t border-white/10">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 text-sm text-white/70 sm:grid-cols-3">
            <div>
              <Wordmark className="text-base text-white" />
              <p className="mt-2">{SALON.tagline}</p>
            </div>
            <div>
              <p className="font-semibold text-white">Dónde</p>
              <p className="mt-1">{state.settings.address}</p>
            </div>
            <div>
              <p className="font-semibold text-white">Cuándo</p>
              <p className="mt-1">Martes a viernes · 10:00–20:00</p>
              <p>Sábados · 9:30–15:00</p>
              <Link to="/equipo/agenda" className="mt-4 inline-block text-white/50 underline-offset-4 hover:text-white hover:underline">
                Acceso equipo
              </Link>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
