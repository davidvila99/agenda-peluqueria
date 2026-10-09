import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Field, inputClass, useToast } from "@/components/ui";
import { formatPhone, isValidEmail, isValidPhone, newId, normalizePhone } from "@/lib/bookings";
import { useStore } from "@/lib/store";

export default function ClientFormPage() {
  const { id } = useParams();
  const { state, saveClient } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = id ? state.clients.find((c) => c.id === id) : undefined;

  const [form, setForm] = useState({
    name: existing?.name ?? "",
    phone: existing ? formatPhone(existing.phone) : "",
    email: existing?.email ?? "",
    notes: existing?.notes ?? "",
    colorHistory: existing?.colorHistory ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Escribe nombre y apellido.";
    if (!isValidPhone(normalizePhone(form.phone))) e.phone = "Móvil español de 9 cifras.";
    if (form.email.trim() && !isValidEmail(form.email.trim())) e.email = "Correo no válido.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const clientId = existing?.id ?? newId("c");
    const result = saveClient({
      id: clientId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      name: form.name.trim(),
      phone: form.phone,
      email: form.email.trim() || undefined,
      notes: form.notes.trim() || undefined,
      colorHistory: form.colorHistory,
    });
    if (!result.ok) {
      setErrors({ phone: result.message });
      return;
    }
    toast(existing ? "Ficha actualizada." : "Clienta creada.");
    navigate(`/equipo/clientas/${clientId}`, { replace: true });
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-5">
      <button onClick={() => navigate(-1)} className="-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100">
        <ArrowLeft size={16} /> Volver
      </button>
      <h1 className="mt-2 text-2xl font-bold">{existing ? "Editar ficha" : "Nueva clienta"}</h1>
      <div className="mt-5 space-y-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <Field label="Nombre y apellido" error={errors.name}>
          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="Móvil" error={errors.phone}>
          <input className={inputClass} inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Correo (opcional)" error={errors.email}>
          <input className={inputClass} inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Notas (opcional)" hint="Fórmulas de color, preferencias, sensibilidades…">
          <textarea className={inputClass} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-ink"
            checked={form.colorHistory}
            onChange={(e) => setForm({ ...form, colorHistory: e.target.checked })}
          />
          <span>
            Ya se ha hecho color en el salón antes de usar esta agenda
            <span className="block text-xs text-neutral-500">Si no está marcado y nunca ha tenido color aquí, el primer color exige prueba de alergia 48 h antes.</span>
          </span>
        </label>
      </div>
      <button onClick={submit} className="mt-5 w-full rounded-xl bg-ink py-3.5 font-semibold text-white hover:bg-graphite">
        {existing ? "Guardar cambios" : "Crear clienta"}
      </button>
    </div>
  );
}
