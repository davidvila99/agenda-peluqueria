import { Database, RotateCcw } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog, Field, inputClass, useToast } from "@/components/ui";
import { SALON } from "@/lib/catalog";
import { STORAGE_KEY, useStore } from "@/lib/store";
import { PageHeader } from "./AdminLayout";

const dateTime = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Madrid" });

export default function SettingsPage() {
  const { state, updateSettings, resetDemo } = useStore();
  const toast = useToast();
  const [address, setAddress] = useState(state.settings.address);
  const [confirmReset, setConfirmReset] = useState(false);

  const saveAddress = () => {
    if (address.trim().length < 5) return toast("Escribe una dirección completa.", "error");
    updateSettings({ ...state.settings, address: address.trim() });
    toast("Dirección guardada.");
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-5">
      <PageHeader title="Ajustes" />

      <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="font-semibold">{SALON.name}</h2>
        <div className="mt-3">
          <Field label="Dirección" hint="Aparece en la web, en los avisos y en el archivo de calendario (.ics).">
            <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
        </div>
        <button
          onClick={saveAddress}
          disabled={address.trim() === state.settings.address}
          className="mt-3 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Guardar dirección
        </button>
      </section>

      <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
        <h2 className="flex items-center gap-2 font-semibold">
          <Database size={18} /> Datos de esta demo
        </h2>
        <p className="mt-2 text-neutral-600">
          Todo se guarda en este navegador (localStorage, clave <code className="rounded bg-neutral-100 px-1">{STORAGE_KEY}</code>). Sobrevive a
          recargas y a cerrar la pestaña.
        </p>
        <ul className="mt-3 grid grid-cols-3 gap-2 text-center">
          <li className="rounded-xl bg-neutral-100 p-2">
            <p className="font-display text-xl font-semibold">{state.bookings.length}</p>
            <p className="text-xs text-neutral-500">citas</p>
          </li>
          <li className="rounded-xl bg-neutral-100 p-2">
            <p className="font-display text-xl font-semibold">{state.clients.length}</p>
            <p className="text-xs text-neutral-500">clientas</p>
          </li>
          <li className="rounded-xl bg-neutral-100 p-2">
            <p className="font-display text-xl font-semibold">{state.outbox.length}</p>
            <p className="text-xs text-neutral-500">avisos</p>
          </li>
        </ul>
        <p className="mt-3 text-xs text-neutral-500">Datos de ejemplo generados el {dateTime.format(new Date(state.seededAt))}.</p>
        <button
          onClick={() => setConfirmReset(true)}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 py-3 font-semibold text-red-700 hover:bg-red-50"
        >
          <RotateCcw size={18} /> Reiniciar datos de ejemplo
        </button>
      </section>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="¿Reiniciar datos de ejemplo?"
        message="Se borran las citas, clientas y avisos de este navegador y se generan de nuevo los de ejemplo, con fechas a partir de hoy."
        confirmLabel="Reiniciar"
        danger
        onConfirm={() => {
          resetDemo();
          setAddress(SALON.defaultAddress);
          toast("Datos de ejemplo restaurados.");
        }}
      />
    </div>
  );
}
