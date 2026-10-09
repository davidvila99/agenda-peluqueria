import { Link } from "react-router-dom";
import PublicShell from "./public/PublicShell";

export default function NotFound() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="font-display text-7xl font-extrabold text-flamingo">404</p>
        <h1 className="mt-4 text-2xl font-bold">Esta página no existe</h1>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/" className="rounded-full bg-flamingo px-6 py-3 font-bold text-ink">
            Ir al inicio
          </Link>
          <Link to="/equipo/agenda" className="rounded-full border border-white/30 px-6 py-3 font-semibold">
            Agenda del equipo
          </Link>
        </div>
      </main>
    </PublicShell>
  );
}
