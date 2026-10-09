import { ArrowLeft, Check, FlaskConical, MapPin, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SegmentBar, durationSummary } from "@/components/SegmentBar";
import { cn } from "@/components/ui";
import { ALLERGY_TEST_ID, PUBLIC_SERVICES, STYLISTS, getService, getStylist } from "@/lib/catalog";
import { formatPhone, isValidEmail, isValidPhone, normalizePhone } from "@/lib/bookings";
import {
  ALLERGY_LEAD_MS,
  allergyDeadline,
  availableStarts,
  availableStartsAny,
  bookingEpoch,
  checkAllergy,
  findValidAllergyTest,
  isFirstTimeColor,
  isLive,
  pickLeastLoaded,
  totalMinutes,
  type OpenSlot,
} from "@/lib/scheduling";
import { useNow, useStore } from "@/lib/store";
import {
  addDays,
  capitalize,
  fmtDateLong,
  fmtDayMonth,
  fmtTime,
  fmtWeekdayShort,
  salonEpoch,
  salonNow,
  weekday,
} from "@/lib/time";
import PublicShell from "./PublicShell";

type Step = "servicio" | "color" | "profesional" | "horario" | "prueba" | "datos" | "resumen";

interface Chosen {
  date: string;
  start: number;
  stylistId: string;
}

const DAYS_AHEAD = 21;
const ALL_STYLISTS = STYLISTS.map((s) => s.id);

export default function BookingWizard() {
  const { ctx, state, book } = useStore();
  const nowMs = useNow();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const preset = getService(params.get("servicio") ?? "");
  const presetOk = preset?.public ? preset : undefined;

  const [step, setStep] = useState<Step>(presetOk ? (presetOk.isColor ? "color" : "profesional") : "servicio");
  const [trail, setTrail] = useState<Step[]>(presetOk ? ["servicio"] : []);
  const [serviceId, setServiceId] = useState<string | null>(presetOk?.id ?? null);
  const [colorAnswer, setColorAnswer] = useState<"first" | "returning" | null>(null);
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookup, setLookup] = useState<{ status: "idle" | "found" | "notfound" | "invalid"; clientId?: string }>({ status: "idle" });
  const [stylistChoice, setStylistChoice] = useState<string>("any");
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Chosen | null>(null);
  const [testDate, setTestDate] = useState<string | null>(null);
  const [testSlot, setTestSlot] = useState<Chosen | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);

  const service = serviceId ? getService(serviceId) : undefined;
  const today = salonNow(nowMs).date;
  const knownClientId = colorAnswer === "returning" && lookup.status === "found" ? lookup.clientId : undefined;
  const knownClient = state.clients.find((c) => c.id === knownClientId);

  const needsTestAt = (d: string, start: number) =>
    Boolean(service?.isColor) && checkAllergy(ctx, { clientId: knownClientId, isColor: true, date: d, start }) !== null;

  const needsTest = slot ? needsTestAt(slot.date, slot.start) : false;

  const go = (next: Step) => {
    setTrail((t) => [...t, step]);
    setStep(next);
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    if (!trail.length) return navigate("/");
    setStep(trail[trail.length - 1]);
    setTrail((t) => t.slice(0, -1));
  };

  // Primera fecha posible para una prueba de alergia (para filtrar colores de primera vez)
  const testService = getService(ALLERGY_TEST_ID)!;
  const earliestTestEpoch = useMemo(() => {
    if (!service?.isColor) return Infinity;
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = addDays(today, i);
      const first = availableStartsAny(ctx, { segments: testService.segments, date: d, clientId: knownClientId }, ALL_STYLISTS, { nowMs })[0];
      if (first) return salonEpoch(d, first.start);
    }
    return Infinity;
  }, [ctx, service, today, knownClientId, nowMs, testService.segments]);

  const slotsFor = (d: string): OpenSlot[] => {
    if (!service) return [];
    const base =
      stylistChoice === "any"
        ? availableStartsAny(ctx, { segments: service.segments, date: d, clientId: knownClientId }, ALL_STYLISTS, { nowMs })
        : availableStarts(ctx, { segments: service.segments, stylistId: stylistChoice, date: d, clientId: knownClientId }, { nowMs }).map(
            (start) => ({ start, stylistIds: [stylistChoice] }),
          );
    if (!service.isColor) return base;
    return base.filter((s) => !needsTestAt(d, s.start) || earliestTestEpoch <= salonEpoch(d, s.start) - ALLERGY_LEAD_MS);
  };

  const steps: Step[] = [
    "servicio",
    ...(service?.isColor ? (["color"] as Step[]) : []),
    "profesional",
    "horario",
    ...(needsTest ? (["prueba"] as Step[]) : []),
    "datos",
    "resumen",
  ];
  const stepIndex = Math.max(0, steps.indexOf(step));

  const chooseService = (id: string) => {
    const s = getService(id)!;
    setServiceId(id);
    setColorAnswer(null);
    setLookup({ status: "idle" });
    setDate(null);
    setSlot(null);
    setTestSlot(null);
    go(s.isColor ? "color" : "profesional");
  };

  const runLookup = () => {
    const digits = normalizePhone(lookupPhone);
    if (!isValidPhone(digits)) return setLookup({ status: "invalid" });
    const client = state.clients.find((c) => c.phone === digits);
    if (!client) return setLookup({ status: "notfound" });
    setLookup({ status: "found", clientId: client.id });
    setForm((f) => ({ ...f, name: client.name, phone: formatPhone(client.phone), email: client.email ?? "" }));
  };

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Escribe tu nombre y apellido.";
    if (!isValidPhone(normalizePhone(form.phone))) e.phone = "Introduce un móvil español de 9 cifras.";
    if (form.email.trim() && !isValidEmail(form.email.trim())) e.email = "Revisa el correo.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const confirm = () => {
    if (!service || !slot) return;
    const phone = normalizePhone(form.phone);
    const existing = knownClientId ? { id: knownClientId } : state.clients.find((c) => c.phone === phone);
    const result = book({
      client: existing
        ? { id: existing.id }
        : { name: form.name.trim(), phone, email: form.email.trim() || undefined, colorHistory: false },
      serviceId: service.id,
      stylistId: slot.stylistId,
      date: slot.date,
      start: slot.start,
      source: "online",
      notes: form.notes,
      allergyTest: needsTest && testSlot ? testSlot : undefined,
      rejectPast: true,
    });
    if (result.ok) {
      navigate(`/reserva/${result.booking.code}?nueva=1`);
    } else {
      setSubmitErrors(result.conflicts.map((c) => c.message));
    }
  };

  return (
    <PublicShell hideFooter>
      <main className="mx-auto max-w-xl px-4 pb-32 pt-4">
        <div className="flex items-center gap-3">
          <button onClick={back} className="rounded-full p-2 text-white/80 hover:bg-white/10" aria-label="Volver">
            <ArrowLeft size={22} />
          </button>
          <div className="flex flex-1 gap-1" aria-label={`Paso ${stepIndex + 1} de ${steps.length}`}>
            {steps.map((s, i) => (
              <span key={s} className={cn("h-1.5 flex-1 rounded-full", i <= stepIndex ? "bg-flamingo" : "bg-white/15")} />
            ))}
          </div>
        </div>

        {step === "servicio" && (
          <section>
            <StepTitle kicker="Reserva" title="¿Qué te hacemos?" />
            <ul className="mt-6 space-y-3">
              {PUBLIC_SERVICES.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => chooseService(s.id)}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition hover:border-flamingo",
                      serviceId === s.id ? "border-flamingo bg-flamingo/10" : "border-white/15 bg-graphite",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-display text-lg font-semibold">{s.name}</span>
                        <span className="mt-0.5 block text-sm text-white/65">{s.description}</span>
                      </span>
                      <span className="shrink-0 font-display text-lg font-semibold">{s.price} €</span>
                    </span>
                    <SegmentBar segments={s.segments} variant="public" className="mt-3" />
                    <span className="mt-2 block text-xs text-white/60">{durationSummary(s.segments)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {step === "color" && service && (
          <section>
            <StepTitle kicker={service.name} title="¿Ya te hemos hecho color aquí?" />
            <p className="mt-3 text-white/75">
              Si es tu primera vez con color en Corto y Cambio, te haremos una prueba de alergia de 10 minutos al menos 48 horas antes. La reservas
              en el siguiente paso.
            </p>
            <div className="mt-6 grid gap-3">
              <ChoiceButton
                active={colorAnswer === "first"}
                onClick={() => {
                  setColorAnswer("first");
                  setLookup({ status: "idle" });
                  go("profesional");
                }}
                title="Es mi primera vez"
                subtitle="Reservo también la prueba de alergia"
              />
              <ChoiceButton
                active={colorAnswer === "returning"}
                onClick={() => setColorAnswer("returning")}
                title="Ya me he hecho color aquí"
                subtitle="Lo comprobamos con tu móvil"
              />
            </div>
            {colorAnswer === "returning" && (
              <div className="mt-5 rounded-2xl bg-graphite p-4">
                <label htmlFor="lookup" className="text-sm font-medium">
                  Tu móvil
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="lookup"
                    inputMode="tel"
                    autoComplete="tel"
                    value={lookupPhone}
                    onChange={(e) => {
                      setLookupPhone(e.target.value);
                      setLookup({ status: "idle" });
                    }}
                    onKeyDown={(e) => e.key === "Enter" && runLookup()}
                    placeholder="612 345 678"
                    className="min-w-0 flex-1 rounded-xl border border-white/20 bg-ink px-3 py-3 text-base text-white placeholder:text-white/40 focus:border-flamingo focus:outline-none"
                  />
                  <button onClick={runLookup} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 font-semibold text-ink">
                    <Search size={18} /> Buscar
                  </button>
                </div>
                {lookupMessage(lookup.status, lookup.clientId)}
                {(lookup.status === "found" || lookup.status === "notfound") && (
                  <button
                    onClick={() => {
                      if (lookup.status === "notfound") setColorAnswer("first");
                      go("profesional");
                    }}
                    className="mt-4 w-full rounded-full bg-flamingo py-3 font-bold text-ink"
                  >
                    Continuar
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {step === "profesional" && service && (
          <section>
            <StepTitle kicker={service.name} title="¿Con quién?" />
            <div className="mt-6 grid gap-3">
              <ChoiceButton
                active={stylistChoice === "any"}
                onClick={() => {
                  setStylistChoice("any");
                  setDate(null);
                  setSlot(null);
                  go("horario");
                }}
                title="Sin preferencia"
                subtitle="Te mostramos todos los huecos del equipo"
              />
              {STYLISTS.map((st) => (
                <ChoiceButton
                  key={st.id}
                  active={stylistChoice === st.id}
                  onClick={() => {
                    setStylistChoice(st.id);
                    setDate(null);
                    setSlot(null);
                    go("horario");
                  }}
                  title={st.name}
                  subtitle={st.role}
                />
              ))}
            </div>
          </section>
        )}

        {step === "horario" && service && (
          <TimeStep
            title="¿Cuándo te viene bien?"
            kicker={`${service.name} · ${stylistChoice === "any" ? "Sin preferencia" : getStylist(stylistChoice)?.name}`}
            today={today}
            days={DAYS_AHEAD}
            slotsFor={slotsFor}
            date={date}
            onDate={(d) => {
              setDate(d);
              setSlot(null);
            }}
            selected={slot}
            onPick={(d, s) => {
              const stylistId = s.stylistIds.length > 1 ? pickLeastLoaded(ctx, d, s.stylistIds) : s.stylistIds[0];
              const pick = { date: d, start: s.start, stylistId };
              setSlot(pick);
              setTestDate(null);
              setTestSlot(null);
              go(needsTestAt(d, s.start) ? "prueba" : "datos");
            }}
            note={
              service.isColor && colorAnswer !== "returning"
                ? "Solo te enseñamos horarios que dejan al menos 48 h para tu prueba de alergia."
                : undefined
            }
            duration={totalMinutes(service.segments)}
          />
        )}

        {step === "prueba" && service && slot && (
          <AllergyStep
            colorSlot={slot}
            today={today}
            ctxSlots={(d) => {
              const deadline = allergyDeadline(slot.date, slot.start).epoch;
              return availableStartsAny(ctx, { segments: testService.segments, date: d, clientId: knownClientId }, ALL_STYLISTS, { nowMs }).filter(
                (s) => salonEpoch(d, s.start) <= deadline,
              );
            }}
            date={testDate}
            onDate={(d) => {
              setTestDate(d);
              setTestSlot(null);
            }}
            selected={testSlot}
            onPick={(d, s) => {
              setTestSlot({ date: d, start: s.start, stylistId: pickLeastLoaded(ctx, d, s.stylistIds) });
              go("datos");
            }}
          />
        )}

        {step === "datos" && (
          <section>
            <StepTitle kicker="Casi está" title="Tus datos" />
            <div className="mt-6 space-y-4">
              <DarkField label="Nombre y apellido" error={errors.name}>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoComplete="name"
                  className={darkInput}
                  placeholder="Carmen Ortiz"
                />
              </DarkField>
              <DarkField
                label="Móvil"
                error={errors.phone}
                hint={knownClient ? "Es el móvil con el que te hemos encontrado." : "Para confirmarte la cita."}
              >
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  inputMode="tel"
                  autoComplete="tel"
                  readOnly={Boolean(knownClient)}
                  className={cn(darkInput, knownClient && "opacity-70")}
                  placeholder="612 345 678"
                />
              </DarkField>
              <DarkField label="Correo (opcional)" error={errors.email} hint="Te mandamos el archivo de calendario.">
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  inputMode="email"
                  autoComplete="email"
                  className={darkInput}
                  placeholder="carmen@correo.es"
                />
              </DarkField>
              <DarkField label="¿Algo que debamos saber? (opcional)">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className={darkInput}
                  placeholder="Por ejemplo: quiero cambiar bastante el largo."
                />
              </DarkField>
              <p className="text-xs text-white/50">Usamos tus datos solo para gestionar tu cita.</p>
            </div>
            <BottomBar>
              <button
                onClick={() => {
                  if (!validateForm()) return;
                  setSubmitErrors([]);
                  go("resumen");
                }}
                className="w-full rounded-full bg-flamingo py-4 text-base font-bold text-ink hover:bg-white"
              >
                Revisar reserva
              </button>
            </BottomBar>
          </section>
        )}

        {step === "resumen" && service && slot && (
          <section>
            <StepTitle kicker="Último paso" title="Revisa tu reserva" />
            <div className="mt-6 rounded-2xl bg-graphite p-5">
              <p className="font-display text-xl font-semibold">{service.name}</p>
              <p className="mt-1 text-white/75">
                {capitalize(fmtDateLong(slot.date))} · {fmtTime(slot.start)}–{fmtTime(slot.start + totalMinutes(service.segments))}
              </p>
              <p className="text-white/75">Con {getStylist(slot.stylistId)?.name}</p>
              <SegmentBar segments={service.segments} variant="public" showLabels className="mt-4" />
              <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
                <span className="text-white/75">Total</span>
                <span className="font-display text-2xl font-semibold">{service.price} €</span>
              </div>
            </div>
            {needsTest && testSlot && (
              <div className="mt-3 flex gap-3 rounded-2xl border border-flamingo/40 bg-flamingo/10 p-4">
                <FlaskConical className="mt-0.5 shrink-0 text-flamingo" size={20} />
                <div className="text-sm">
                  <p className="font-semibold">Prueba de alergia · 10 min · gratis</p>
                  <p className="text-white/75">
                    {capitalize(fmtDateLong(testSlot.date))} a las {fmtTime(testSlot.start)} con {getStylist(testSlot.stylistId)?.name}
                  </p>
                </div>
              </div>
            )}
            <div className="mt-3 flex gap-3 rounded-2xl bg-graphite p-4 text-sm">
              <MapPin className="mt-0.5 shrink-0 text-flamingo" size={20} />
              <p className="text-white/80">{state.settings.address}</p>
            </div>
            <div className="mt-3 rounded-2xl bg-graphite p-4 text-sm text-white/80">
              <p className="font-semibold text-white">{form.name.trim()}</p>
              <p>{formatPhone(normalizePhone(form.phone))}</p>
              {form.email.trim() && <p>{form.email.trim()}</p>}
              {form.notes.trim() && <p className="mt-2 italic">“{form.notes.trim()}”</p>}
            </div>
            {submitErrors.length > 0 && (
              <div className="mt-4 rounded-2xl border border-red-400 bg-red-500/10 p-4 text-sm" role="alert">
                <p className="font-semibold">Ese horario ya no está disponible:</p>
                <ul className="mt-1 list-disc pl-5 text-white/80">
                  {submitErrors.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    setSubmitErrors([]);
                    setSlot(null);
                    setTrail((t) => t.slice(0, Math.max(0, t.indexOf("horario"))));
                    setStep("horario");
                  }}
                  className="mt-3 rounded-full bg-white px-4 py-2 font-semibold text-ink"
                >
                  Elegir otro horario
                </button>
              </div>
            )}
            <BottomBar>
              <button onClick={confirm} className="w-full rounded-full bg-flamingo py-4 text-base font-bold text-ink hover:bg-white">
                Confirmar reserva
              </button>
            </BottomBar>
          </section>
        )}
      </main>
    </PublicShell>
  );

  function lookupMessage(status: string, clientId?: string) {
    if (status === "invalid") return <p className="mt-3 text-sm text-red-300">Introduce un móvil español de 9 cifras.</p>;
    if (status === "notfound")
      return (
        <p className="mt-3 text-sm text-white/80">
          No encontramos ese móvil. No pasa nada: reservaremos tu prueba de alergia junto a la cita.
        </p>
      );
    if (status !== "found" || !clientId) return null;
    const client = state.clients.find((c) => c.id === clientId)!;
    const firstName = client.name.split(" ")[0];
    const hasHistory = !isFirstTimeColor(ctx, clientId, nowMs);
    const upcomingTest = state.bookings.find((b) => b.clientId === clientId && b.isAllergyTest && isLive(b) && bookingEpoch(b) > nowMs);
    const anyTest = findValidAllergyTest(ctx, clientId, Infinity);
    return (
      <p className="mt-3 flex gap-2 text-sm text-white/85">
        <Check size={18} className="shrink-0 text-flamingo" />
        <span>
          ¡Hola, {firstName}!{" "}
          {hasHistory
            ? "Tienes historial de color con nosotras: no necesitas prueba de alergia."
            : upcomingTest
              ? `Tienes una prueba de alergia el ${fmtDateLong(upcomingTest.date)}: te enseñamos horarios a partir de 48 h después.`
              : anyTest
                ? "Ya tienes la prueba de alergia hecha."
                : "Aún no tenemos ningún color tuyo, así que reservaremos también la prueba de alergia."}
        </span>
      </p>
    );
  }
}

// ---------------------------------------------------------------------------

const darkInput =
  "w-full rounded-xl border border-white/20 bg-graphite px-3 py-3 text-base text-white placeholder:text-white/35 focus:border-flamingo focus:outline-none";

function DarkField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-red-300">{error}</span> : hint && <span className="mt-1 block text-xs text-white/50">{hint}</span>}
    </label>
  );
}

function StepTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mt-6">
      <p className="text-sm font-semibold uppercase tracking-[0.15em] text-flamingo">{kicker}</p>
      <h1 className="mt-1 text-3xl font-bold leading-tight">{title}</h1>
    </div>
  );
}

function ChoiceButton({ active, onClick, title, subtitle }: { active: boolean; onClick: () => void; title: string; subtitle: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition hover:border-flamingo",
        active ? "border-flamingo bg-flamingo/10" : "border-white/15 bg-graphite",
      )}
    >
      <span>
        <span className="block font-display text-lg font-semibold">{title}</span>
        <span className="block text-sm text-white/65">{subtitle}</span>
      </span>
      <span className={cn("h-5 w-5 shrink-0 rounded-full border-2", active ? "border-flamingo bg-flamingo" : "border-white/40")} />
    </button>
  );
}

function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-ink/95 backdrop-blur">
      <div className="mx-auto max-w-xl px-4 py-3 pb-safe">{children}</div>
    </div>
  );
}

function DateChips({
  dates,
  counts,
  value,
  onChange,
}: {
  dates: string[];
  counts: Map<string, number>;
  value: string | null;
  onChange: (d: string) => void;
}) {
  useEffect(() => {
    if (value) document.getElementById(`day-${value}`)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [value]);
  return (
    <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1">
      {dates.map((d) => {
        const count = counts.get(d) ?? 0;
        const closed = weekday(d) === 0 || weekday(d) === 1;
        const active = value === d;
        return (
          <button
            key={d}
            id={`day-${d}`}
            disabled={count === 0}
            onClick={() => onChange(d)}
            className={cn(
              "flex w-[4.5rem] shrink-0 flex-col items-center rounded-2xl border px-2 py-2.5 text-center",
              active ? "border-flamingo bg-flamingo text-ink" : "border-white/15 bg-graphite",
              count === 0 && "opacity-40",
            )}
          >
            <span className="text-xs font-semibold uppercase">{fmtWeekdayShort(d)}</span>
            <span className="font-display text-xl font-bold leading-tight">{Number(d.slice(8))}</span>
            <span className={cn("text-[11px]", active ? "text-ink/80" : "text-white/60")}>
              {closed ? "Cerrado" : count === 0 ? "Completo" : fmtDayMonth(d).split(" ")[1]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SlotGrid({ slots, selected, onPick }: { slots: OpenSlot[]; selected?: number; onPick: (s: OpenSlot) => void }) {
  const groups = [
    { label: "Mañana", items: slots.filter((s) => s.start < 14 * 60) },
    { label: "Tarde", items: slots.filter((s) => s.start >= 14 * 60) },
  ].filter((g) => g.items.length);
  return (
    <div className="mt-6 space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="text-sm font-semibold text-white/70">{g.label}</p>
          <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
            {g.items.map((s) => (
              <button
                key={s.start}
                onClick={() => onPick(s)}
                className={cn(
                  "rounded-xl border py-3 font-display text-base font-semibold transition",
                  selected === s.start ? "border-flamingo bg-flamingo text-ink" : "border-white/15 bg-graphite hover:border-flamingo",
                )}
              >
                {fmtTime(s.start)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimeStep({
  title,
  kicker,
  today,
  days,
  slotsFor,
  date,
  onDate,
  selected,
  onPick,
  note,
  duration,
  emptyText = "No quedan horarios libres en las próximas tres semanas con esta opción. Prueba con otra profesional o con",
}: {
  title: string;
  kicker: string;
  today: string;
  days: number;
  slotsFor: (d: string) => OpenSlot[];
  date: string | null;
  onDate: (d: string) => void;
  selected: Chosen | null;
  onPick: (d: string, s: OpenSlot) => void;
  note?: string;
  duration: number;
  emptyText?: string;
}) {
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(today, i)), [today, days]);
  const slotsByDate = useMemo(() => new Map(dates.map((d) => [d, slotsFor(d)])), [dates, slotsFor]);
  const counts = useMemo(() => new Map([...slotsByDate].map(([d, s]) => [d, s.length])), [slotsByDate]);
  const firstOpen = dates.find((d) => (counts.get(d) ?? 0) > 0) ?? null;
  const active = date ?? firstOpen;
  const slots = active ? slotsByDate.get(active) ?? [] : [];

  useEffect(() => {
    if (!date && firstOpen) onDate(firstOpen);
  }, [date, firstOpen, onDate]);

  return (
    <section>
      <StepTitle kicker={kicker} title={title} />
      <p className="mt-2 text-sm text-white/65">Duración total: {duration} min.</p>
      {note && <p className="mt-2 text-sm text-flamingo">{note}</p>}
      {firstOpen ? (
        <>
          <DateChips dates={dates} counts={counts} value={active} onChange={onDate} />
          {active && <p className="mt-5 font-semibold">{capitalize(fmtDateLong(active))}</p>}
          <SlotGrid slots={slots} selected={selected?.date === active ? selected.start : undefined} onPick={(s) => active && onPick(active, s)} />
        </>
      ) : (
        <div className="mt-6 rounded-2xl bg-graphite p-5 text-white/80">
          {emptyText}{" "}
          <Link to="/reservar" reloadDocument className="text-flamingo underline">
            otro servicio
          </Link>
          .
        </div>
      )}
    </section>
  );
}

function AllergyStep({
  colorSlot,
  today,
  ctxSlots,
  date,
  onDate,
  selected,
  onPick,
}: {
  colorSlot: Chosen;
  today: string;
  ctxSlots: (d: string) => OpenSlot[];
  date: string | null;
  onDate: (d: string) => void;
  selected: Chosen | null;
  onPick: (d: string, s: OpenSlot) => void;
}) {
  const deadline = allergyDeadline(colorSlot.date, colorSlot.start);
  const days = Math.max(1, Math.round((salonEpoch(deadline.date, 0) - salonEpoch(today, 0)) / 86_400_000) + 1);
  return (
    <>
      <div className="mt-6 flex gap-3 rounded-2xl border border-flamingo/40 bg-flamingo/10 p-4 text-sm">
        <FlaskConical className="mt-0.5 shrink-0 text-flamingo" size={20} />
        <p className="text-white/85">
          Tu color es el <strong className="text-white">{fmtDateLong(colorSlot.date)}</strong> a las {fmtTime(colorSlot.start)}. La prueba
          de alergia dura 10 minutos y tiene que ser como muy tarde el <strong className="text-white">{fmtDateLong(deadline.date)}</strong> a
          las {fmtTime(deadline.minutes)}.
        </p>
      </div>
      <TimeStep
        title="¿Cuándo pasas para la prueba?"
        kicker="Prueba de alergia"
        today={today}
        days={days}
        slotsFor={ctxSlots}
        date={date}
        onDate={onDate}
        selected={selected}
        onPick={onPick}
        duration={10}
        emptyText="No queda ningún hueco para la prueba antes de esa fecha. Vuelve atrás y elige un día más adelante para tu color, o empieza con"
      />
    </>
  );
}
