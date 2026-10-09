import { AlertTriangle, ArrowLeft, CheckCircle2, FlaskConical, Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { SegmentBar, durationSummary } from "@/components/SegmentBar";
import { Field, cn, inputClass, useToast } from "@/components/ui";
import { ALLERGY_TEST_ID, SERVICES, STYLISTS, getService, getStylist } from "@/lib/catalog";
import { formatPhone, isValidEmail, isValidPhone, normalizePhone } from "@/lib/bookings";
import {
  allergyDeadline,
  availableStarts,
  availableStartsAny,
  checkAllergy,
  checkSlot,
  liveBookingsOn,
  pickLeastLoaded,
  timeline,
  totalMinutes,
} from "@/lib/scheduling";
import { useNow, useStore } from "@/lib/store";
import { capitalize, fmtDateLong, fmtDateShort, fmtTime, parseTime, salonEpoch, salonNow } from "@/lib/time";

interface NewClientForm {
  name: string;
  phone: string;
  email: string;
  colorHistory: boolean;
}

export default function BookingFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { state, ctx, book, moveBooking } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const nowMs = useNow();
  const today = salonNow(nowMs).date;

  const editing = id ? state.bookings.find((b) => b.id === id) : undefined;

  const [clientId, setClientId] = useState<string | null>(editing?.clientId ?? params.get("clienta"));
  const [newClient, setNewClient] = useState<NewClientForm | null>(null);
  const [query, setQuery] = useState("");
  const [serviceId, setServiceId] = useState(editing?.serviceId ?? params.get("servicio") ?? "corte-mujer");
  const [stylistId, setStylistId] = useState(editing?.stylistId ?? params.get("estilista") ?? STYLISTS[0].id);
  const [date, setDate] = useState(editing?.date ?? params.get("fecha") ?? today);
  const [time, setTime] = useState(editing ? fmtTime(editing.start) : params.get("hora") ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [testDate, setTestDate] = useState<string | null>(null);
  const [testPick, setTestPick] = useState<{ date: string; start: number; stylistId: string } | null>(null);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const service = getService(serviceId)!;
  const start = /^\d{2}:\d{2}$/.test(time) ? parseTime(time) : null;
  const exclude = editing ? [editing.id] : [];
  const client = clientId ? state.clients.find((c) => c.id === clientId) : undefined;
  const phoneMatch = newClient && isValidPhone(normalizePhone(newClient.phone)) ? state.clients.find((c) => c.phone === normalizePhone(newClient.phone)) : undefined;

  const conflicts =
    start === null
      ? []
      : checkSlot(ctx, { segments: service.segments, stylistId, date, start, clientId: clientId ?? undefined, excludeBookingIds: exclude });

  // Se evalúa cuando ya hay clienta elegida (o una nueva sin historial de color declarado)
  const allergyApplies = service.isColor && (clientId !== null || (newClient !== null && !newClient.colorHistory));
  const allergy =
    start !== null && allergyApplies
      ? checkAllergy(ctx, {
          clientId: clientId ?? undefined,
          isColor: true,
          date,
          start,
          excludeBookingIds: exclude,
          plannedTestEpoch: testPick ? salonEpoch(testPick.date, testPick.start) : undefined,
        })
      : null;
  const needsPlannedTest = start !== null && allergyApplies && (allergy !== null || testPick !== null) && !editing;

  const isPast = start !== null && salonEpoch(date, start) < nowMs;

  // Huecos libres: rejilla de 15 min + finales de tramos ocupados (huecos de pose)
  const freeStarts = useMemo(
    () =>
      availableStarts(
        ctx,
        { segments: service.segments, stylistId, date, clientId: clientId ?? undefined, excludeBookingIds: exclude },
        date === today ? { nowMs } : {},
      ),
    [ctx, service, stylistId, date, clientId, editing?.id, today, nowMs],
  );
  const poseStarts = useMemo(() => {
    const poses = liveBookingsOn(ctx, date, exclude)
      .filter((b) => b.stylistId === stylistId)
      .flatMap((b) => timeline(b.segments, b.start).filter((s) => s.kind === "P"));
    return new Set(freeStarts.filter((t) => poses.some((p) => t >= p.start && t < p.end)));
  }, [ctx, date, stylistId, freeStarts, editing?.id]);

  // Prueba de alergia: días entre hoy y el límite de 48 h
  const deadline = start !== null ? allergyDeadline(date, start) : null;
  const testDay = testDate ?? (deadline && deadline.date >= today ? deadline.date : null);
  const testSlots =
    needsPlannedTest && deadline && testDay
      ? availableStartsAny(ctx, { segments: getService(ALLERGY_TEST_ID)!.segments, date: testDay, clientId: clientId ?? undefined }, STYLISTS.map((s) => s.id), {
          nowMs,
        }).filter((s) => salonEpoch(testDay, s.start) <= deadline.epoch)
      : [];

  const results = query.trim()
    ? state.clients
        .filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()) || c.phone.includes(query.replace(/\D/g, "") || "—"))
        .slice(0, 6)
    : [];

  const blocking = conflicts.length > 0 || allergy !== null;

  const save = () => {
    setSaveErrors([]);
    if (start === null) return setSaveErrors(["Elige una hora."]);
    if (editing) {
      const result = moveBooking(editing.id, { stylistId, date, start, serviceId, notes });
      if (!result.ok) return setSaveErrors(result.conflicts.map((c) => c.message));
      toast("Cita actualizada.");
      return navigate(`/equipo/agenda?fecha=${date}&cita=${editing.id}`);
    }
    let clientInput: Parameters<typeof book>[0]["client"];
    if (clientId) {
      clientInput = { id: clientId };
    } else if (newClient) {
      const e: Record<string, string> = {};
      if (newClient.name.trim().length < 2) e.name = "Escribe nombre y apellido.";
      if (!isValidPhone(normalizePhone(newClient.phone))) e.phone = "Móvil español de 9 cifras.";
      if (newClient.email.trim() && !isValidEmail(newClient.email.trim())) e.email = "Correo no válido.";
      setClientErrors(e);
      if (Object.keys(e).length) return;
      clientInput = {
        name: newClient.name.trim(),
        phone: normalizePhone(newClient.phone),
        email: newClient.email.trim() || undefined,
        colorHistory: newClient.colorHistory,
      };
    } else {
      return setSaveErrors(["Elige una clienta o crea una nueva."]);
    }
    const result = book({
      client: clientInput,
      serviceId,
      stylistId,
      date,
      start,
      source: "salon",
      notes,
      allergyTest: needsPlannedTest && testPick ? testPick : undefined,
    });
    if (!result.ok) return setSaveErrors(result.conflicts.map((c) => c.message));
    toast(result.test ? "Cita y prueba de alergia creadas." : "Cita creada.");
    navigate(`/equipo/agenda?fecha=${date}&cita=${result.booking.id}`);
  };

  if (id && !editing) {
    return (
      <div className="p-6 text-center">
        <p className="font-semibold">Esta cita no existe.</p>
        <Link to="/equipo/agenda" className="mt-4 inline-block rounded-xl bg-ink px-4 py-2.5 font-semibold text-white">
          Volver a la agenda
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-6 pt-4">
      <button onClick={() => navigate(-1)} className="-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100">
        <ArrowLeft size={16} /> Volver
      </button>
      <h1 className="mt-2 text-2xl font-bold">{editing ? "Mover o editar cita" : "Nueva cita"}</h1>

      <div className="mt-5 space-y-5">
        {/* Clienta */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Clienta</h2>
          {client ? (
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{client.name}</p>
                <p className="text-sm text-neutral-600">
                  {formatPhone(client.phone)}
                  {client.colorHistory && " · historial de color"}
                </p>
              </div>
              {!editing && (
                <button onClick={() => setClientId(null)} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-neutral-100">
                  Cambiar
                </button>
              )}
            </div>
          ) : newClient ? (
            <div className="mt-3 space-y-3">
              <Field label="Nombre y apellido" error={clientErrors.name}>
                <input className={inputClass} value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
              </Field>
              <Field label="Móvil" error={clientErrors.phone}>
                <input
                  className={inputClass}
                  inputMode="tel"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                />
              </Field>
              {phoneMatch && (
                <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                  Ese móvil ya es de <strong>{phoneMatch.name}</strong>.{" "}
                  <button
                    className="font-semibold underline"
                    onClick={() => {
                      setClientId(phoneMatch.id);
                      setNewClient(null);
                    }}
                  >
                    Usar su ficha
                  </button>
                </p>
              )}
              <Field label="Correo (opcional)" error={clientErrors.email}>
                <input
                  className={inputClass}
                  inputMode="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-ink"
                  checked={newClient.colorHistory}
                  onChange={(e) => setNewClient({ ...newClient, colorHistory: e.target.checked })}
                />
                Ya se ha hecho color en el salón antes (no necesita prueba de alergia)
              </label>
              <button onClick={() => setNewClient(null)} className="text-sm text-neutral-600 underline">
                Buscar una clienta existente
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <div className="relative">
                <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  className={cn(inputClass, "pl-10")}
                  placeholder="Buscar por nombre o móvil"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Buscar clienta"
                />
              </div>
              {results.length > 0 && (
                <ul className="mt-2 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
                  {results.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => {
                          setClientId(c.id);
                          setQuery("");
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-neutral-50"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-sm text-neutral-500">{formatPhone(c.phone)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim() && results.length === 0 && <p className="mt-2 text-sm text-neutral-500">Sin resultados.</p>}
              <button
                onClick={() => setNewClient({ name: query.replace(/\d/g, "").trim(), phone: query.replace(/\D/g, ""), email: "", colorHistory: false })}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                <UserPlus size={16} /> Nueva clienta
              </button>
            </div>
          )}
        </section>

        {/* Servicio y profesional */}
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4">
          <Field label="Servicio">
            <select
              className={inputClass}
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setTestPick(null);
              }}
            >
              {SERVICES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {totalMinutes(s.segments)} min{s.price ? ` · ${s.price} €` : ""}
                </option>
              ))}
            </select>
          </Field>
          <div>
            <SegmentBar segments={service.segments} showLabels />
            <p className="mt-1 text-xs text-neutral-500">{durationSummary(service.segments)}</p>
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium">Profesional</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STYLISTS.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setStylistId(st.id)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-semibold",
                    stylistId === st.id ? "border-ink bg-ink text-white" : "border-neutral-300 hover:bg-neutral-50",
                  )}
                >
                  {st.name}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Fecha y hora */}
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha">
              <input
                type="date"
                className={inputClass}
                value={date}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setDate(e.target.value);
                  setTestPick(null);
                  setTestDate(null);
                }}
              />
            </Field>
            <Field label="Hora">
              <input
                type="time"
                step={300}
                className={inputClass}
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  setTestPick(null);
                  setTestDate(null);
                }}
              />
            </Field>
          </div>
          <div>
            <p className="text-sm font-medium">
              Huecos libres de {getStylist(stylistId)?.name} · {fmtDateShort(date)}
            </p>
            {freeStarts.length === 0 ? (
              <p className="mt-1 text-sm text-neutral-500">No hay huecos para este servicio ese día.</p>
            ) : (
              <>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {freeStarts.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTime(fmtTime(t));
                        setTestPick(null);
                        setTestDate(null);
                      }}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-sm tabular-nums",
                        start === t ? "border-ink bg-ink text-white" : poseStarts.has(t) ? "border-flamingo bg-flamingo-soft" : "border-neutral-300 hover:bg-neutral-50",
                      )}
                    >
                      {fmtTime(t)}
                    </button>
                  ))}
                </div>
                {poseStarts.size > 0 && (
                  <p className="mt-2 text-xs text-neutral-500">
                    <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-flamingo bg-flamingo-soft align-middle" />
                    Empieza dentro de la pose de otra clienta.
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {/* Prueba de alergia */}
        {needsPlannedTest && deadline && (
          <section className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex gap-2">
              <FlaskConical size={20} className="shrink-0 text-amber-700" />
              <div className="text-sm">
                <p className="font-semibold">Primera vez con color: hay que reservar la prueba de alergia</p>
                <p className="text-amber-900">
                  Como muy tarde el {fmtDateLong(deadline.date)} a las {fmtTime(deadline.minutes)}.
                </p>
              </div>
            </div>
            {deadline.epoch <= nowMs ? (
              <p className="text-sm font-medium text-red-700">
                Ya no da tiempo: elige para el color una fecha al menos 48 h después de hoy.
              </p>
            ) : testPick ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm">
                <span>
                  <CheckCircle2 size={16} className="mr-1 inline text-emerald-600" />
                  Prueba: {capitalize(fmtDateShort(testPick.date))} · {fmtTime(testPick.start)} con {getStylist(testPick.stylistId)?.name}
                </span>
                <button onClick={() => setTestPick(null)} className="font-medium underline">
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <Field label="Día de la prueba">
                  <input
                    type="date"
                    className={inputClass}
                    min={today}
                    max={deadline.date}
                    value={testDay ?? ""}
                    onChange={(e) => e.target.value && setTestDate(e.target.value)}
                  />
                </Field>
                {testSlots.length === 0 ? (
                  <p className="text-sm text-amber-900">Sin huecos ese día: prueba con otro.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {testSlots.map((s) => (
                      <button
                        key={s.start}
                        onClick={() => setTestPick({ date: testDay!, start: s.start, stylistId: pickLeastLoaded(ctx, testDay!, s.stylistIds) })}
                        className="rounded-lg border border-amber-400 bg-white px-2.5 py-1.5 text-sm tabular-nums hover:bg-amber-100"
                      >
                        {fmtTime(s.start)}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        <Field label="Notas (opcional)">
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Fórmula, preferencias…" />
        </Field>

        {/* Validación en vivo */}
        {start !== null && (
          <div
            className={cn("rounded-2xl p-4 text-sm", blocking ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900")}
            role="status"
          >
            {blocking ? (
              <>
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle size={16} /> No se puede reservar a las {fmtTime(start)}
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {conflicts.map((c, i) => (
                    <li key={i}>{c.message}</li>
                  ))}
                  {allergy && (
                    <li>
                      {allergy.message}
                      {editing && clientId && (
                        <>
                          {" "}
                          <Link
                            className="font-semibold underline"
                            to={`/equipo/agenda/nueva?servicio=${ALLERGY_TEST_ID}&clienta=${clientId}&fecha=${deadline && deadline.date >= today ? deadline.date : today}`}
                          >
                            Crear prueba de alergia
                          </Link>
                        </>
                      )}
                    </li>
                  )}
                </ul>
              </>
            ) : (
              <>
                <p className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 size={16} /> Libre: {getStylist(stylistId)?.name} queda ocupada en
                </p>
                <ul className="mt-1 space-y-0.5 pl-5">
                  {timeline(service.segments, start)
                    .filter((s) => s.kind !== "P")
                    .map((s) => (
                      <li key={s.index}>
                        {fmtTime(s.start)}–{fmtTime(s.end)} · {s.label}
                        {s.kind === "L" && " (lavacabezas)"}
                      </li>
                    ))}
                </ul>
                {timeline(service.segments, start).some((s) => s.kind === "P") && (
                  <p className="mt-1 text-emerald-800">Durante la pose queda libre para otra clienta.</p>
                )}
              </>
            )}
            {isPast && <p className="mt-2 text-amber-800">Esta hora ya ha pasado: se registrará igualmente.</p>}
          </div>
        )}

        {saveErrors.length > 0 && (
          <ul className="list-disc rounded-2xl bg-red-50 p-4 pl-8 text-sm text-red-800" role="alert">
            {saveErrors.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-neutral-200 bg-neutral-50/95 px-4 py-3 backdrop-blur">
        <button
          onClick={save}
          disabled={start === null || blocking}
          className="w-full rounded-xl bg-ink py-3.5 font-semibold text-white hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-40"
        >
          {editing ? "Guardar cambios" : needsPlannedTest && testPick ? "Crear cita y prueba" : "Crear cita"}
        </button>
      </div>
    </div>
  );
}
