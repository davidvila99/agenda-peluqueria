import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/components/ui";
import { SALON, STYLISTS, salonHours } from "@/lib/catalog";
import {
  assignWashbasins,
  bookingEnd,
  bookingsInPose,
  layoutLanes,
  liveBookingsOn,
  stylistMinutes,
  timeline,
} from "@/lib/scheduling";
import { useNow, useStore } from "@/lib/store";
import { addDays, capitalize, fmtDateLong, fmtDuration, fmtTime, salonNow, weekday } from "@/lib/time";
import type { Booking } from "@/lib/types";
import BookingSheet from "./BookingSheet";

/** Píxeles por minuto */
const PX = 1.7;
const FILTER_KEY = "corto-y-cambio:agenda-filtro";
// Columnas de profesional: crecen para llenar el ancho; en móvil se desplazan en horizontal.
// Una sola profesional ocupa todo el ancho libre (menos horas y lavacabezas).
const COLUMN_SINGLE = "flex-1 min-w-[calc(100vw-3rem-7.5rem)] md:min-w-[24rem]";
const COLUMN_MULTI = "flex-1 min-w-[10rem] md:min-w-[13rem]";

function readFilter(): string {
  try {
    return localStorage.getItem(FILTER_KEY) ?? "all";
  } catch {
    return "all";
  }
}

export default function AgendaPage() {
  const { state, ctx } = useStore();
  const nowMs = useNow();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const now = salonNow(nowMs);
  const date = params.get("fecha") ?? now.date;
  const openId = params.get("cita");
  const [filter, setFilterState] = useState(readFilter);
  const scrollRef = useRef<HTMLDivElement>(null);

  const setFilter = (f: string) => {
    setFilterState(f);
    try {
      localStorage.setItem(FILTER_KEY, f);
    } catch {
      // preferencia opcional
    }
  };

  const setDate = (d: string) => setParams({ fecha: d });
  const hours = salonHours(weekday(date));
  const day = useMemo(() => liveBookingsOn(ctx, date), [ctx, date]);
  const basins = useMemo(() => assignWashbasins(day, SALON.washbasins), [day]);
  const inPose = useMemo(() => bookingsInPose(day), [day]);
  const stylists = filter === "all" ? STYLISTS : STYLISTS.filter((s) => s.id === filter);
  const cancelled = state.bookings.filter((b) => b.date === date && (b.status === "cancelada" || b.status === "no_presentada")).length;
  const services = day.filter((b) => !b.isAllergyTest);

  // Al abrir el día de hoy, llevar la vista a la hora actual
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !hours) return;
    el.scrollTop = date === now.date ? Math.max(0, (now.minutes - hours.open - 60) * PX) : 0;
  }, [date, Boolean(hours)]);

  const nextOpenDay = (from: string, dir: 1 | -1) => {
    let d = addDays(from, dir);
    for (let i = 0; i < 7 && !salonHours(weekday(d)); i++) d = addDays(d, dir);
    return d;
  };

  const openBooking = (id: string) => setParams({ fecha: date, cita: id });
  const closeSheet = () => setParams({ fecha: date });
  const openSheetBooking = openId ? state.bookings.find((b) => b.id === openId) : undefined;

  const newAt = (stylistId: string, minute: number) =>
    navigate(`/equipo/agenda/nueva?fecha=${date}&hora=${fmtTime(minute)}&estilista=${stylistId}`);

  const height = hours ? (hours.close - hours.open) * PX : 0;

  return (
    <div className="relative flex h-full flex-col">
      {/* Barra de día */}
      <div className="shrink-0 space-y-2 border-b border-neutral-200 bg-white px-3 py-2.5">
        <div className="flex items-center gap-1">
          <button onClick={() => setDate(nextOpenDay(date, -1))} className="rounded-lg p-2 hover:bg-neutral-100" aria-label="Día anterior">
            <ChevronLeft size={20} />
          </button>
          <label className="relative min-w-0 flex-1 cursor-pointer rounded-lg px-2 py-1 text-center hover:bg-neutral-100">
            <span className="block truncate font-display text-base font-semibold sm:text-lg">{capitalize(fmtDateLong(date))}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Elegir fecha"
            />
          </label>
          <button onClick={() => setDate(nextOpenDay(date, 1))} className="rounded-lg p-2 hover:bg-neutral-100" aria-label="Día siguiente">
            <ChevronRight size={20} />
          </button>
          <button
            onClick={() => setDate(now.date)}
            disabled={date === now.date}
            className="ml-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium disabled:opacity-40"
          >
            Hoy
          </button>
        </div>
        <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3">
          {[{ id: "all", name: "Todo el equipo" }, ...STYLISTS].map((s) => (
            <button
              key={s.id}
              onClick={() => setFilter(s.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-sm font-medium",
                filter === s.id ? "border-ink bg-ink text-white" : "border-neutral-300 text-neutral-700 hover:bg-neutral-100",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
        {hours && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-neutral-600">
            <span>
              <strong className="text-ink">{services.length}</strong> citas · <strong className="text-ink">{services.filter((b) => b.isColor).length}</strong>{" "}
              colores · <strong className="text-flamingo">{inPose.size}</strong> encajadas en poses
              {cancelled > 0 && ` · ${cancelled} anuladas`}
            </span>
            <span className="flex gap-3">
              <Swatch cls="seg-A" label="Activo" />
              <Swatch cls="seg-P" label="Pose" />
              <Swatch cls="seg-L" label="Lavado" />
              <Swatch cls="seg-T" label="Prueba" />
            </span>
          </div>
        )}
      </div>

      {!hours ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="font-display text-xl font-semibold">Cerrado</p>
          <p className="text-neutral-600">El salón abre de martes a sábado.</p>
          <button onClick={() => setDate(nextOpenDay(date, 1))} className="rounded-xl bg-ink px-4 py-2.5 font-semibold text-white">
            Ir al próximo día abierto
          </button>
        </div>
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-white">
          <div className="min-w-full" style={{ width: "max-content" }}>
            {/* Cabecera de columnas */}
            <div className="sticky top-0 z-20 flex border-b border-neutral-200 bg-white">
              <div className="sticky left-0 z-30 w-12 shrink-0 bg-white" />
              {stylists.map((st) => {
                const mine = day.filter((b) => b.stylistId === st.id);
                const busy = mine.reduce((s, b) => s + stylistMinutes(b.segments), 0);
                return (
                  <div key={st.id} className={cn("border-l border-neutral-200 px-2 py-1.5", stylists.length === 1 ? COLUMN_SINGLE : COLUMN_MULTI)}>
                    <p className="font-display text-sm font-semibold">{st.name}</p>
                    <p className="text-[11px] text-neutral-500">
                      {mine.length} citas · ocupada {fmtDuration(busy)}
                    </p>
                  </div>
                );
              })}
              <div className="w-28 shrink-0 border-l border-neutral-200 bg-sky-50 px-2 py-1.5 md:w-32">
                <p className="font-display text-sm font-semibold">Lavacabezas</p>
                <div className="grid grid-cols-2 text-[11px] text-neutral-500">
                  {Array.from({ length: SALON.washbasins }, (_, i) => (
                    <span key={i}>{i + 1}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Cuerpo */}
            <div className="relative flex" style={{ height }}>
              <div className="sticky left-0 z-10 w-12 shrink-0 border-r border-neutral-200 bg-white">
                {Array.from({ length: Math.floor((hours.close - hours.open) / 30) + 1 }, (_, i) => hours.open + i * 30).map((t) => (
                  <span
                    key={t}
                    className={cn("absolute right-1.5 -translate-y-1/2 text-[11px] tabular-nums", t % 60 === 0 ? "text-neutral-700" : "text-neutral-400")}
                    style={{ top: Math.max(6, Math.min(height - 6, (t - hours.open) * PX)) }}
                  >
                    {fmtTime(t)}
                  </span>
                ))}
              </div>

              {stylists.map((st) => (
                <StylistColumn
                  key={st.id}
                  wide={stylists.length === 1}
                  bookings={day.filter((b) => b.stylistId === st.id)}
                  open={hours.open}
                  height={height}
                  clientName={(id) => state.clients.find((c) => c.id === id)?.name ?? "Clienta"}
                  inPose={inPose}
                  onBooking={openBooking}
                  onEmpty={(m) => newAt(st.id, m)}
                />
              ))}

              <div className="relative w-28 shrink-0 border-l border-neutral-200 bg-sky-50/40 md:w-32" style={gridLines(PX)}>
                {day.flatMap((b) =>
                  timeline(b.segments, b.start)
                    .filter((s) => s.kind === "L")
                    .map((s) => {
                      const basin = basins.get(`${b.id}:${s.index}`) ?? 0;
                      const name = state.clients.find((c) => c.id === b.clientId)?.name.split(" ")[0] ?? "";
                      return (
                        <button
                          key={`${b.id}:${s.index}`}
                          onClick={() => openBooking(b.id)}
                          className="seg-L absolute overflow-hidden rounded px-1 text-left text-[10px] font-medium leading-tight"
                          style={{
                            top: (s.start - hours.open) * PX,
                            height: s.min * PX - 1,
                            left: `calc(${(basin / SALON.washbasins) * 100}% + 2px)`,
                            width: `calc(${100 / SALON.washbasins}% - 4px)`,
                          }}
                          title={`${name} · ${fmtTime(s.start)}–${fmtTime(s.end)}`}
                        >
                          {name}
                        </button>
                      );
                    }),
                )}
              </div>

              {date === now.date && now.minutes >= hours.open && now.minutes <= hours.close && (
                <div className="pointer-events-none absolute left-12 right-0 z-[5] border-t-2 border-flamingo" style={{ top: (now.minutes - hours.open) * PX }}>
                  <span className="absolute -left-1.5 -top-[5px] h-2 w-2 rounded-full bg-flamingo" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Link
        to={`/equipo/agenda/nueva?fecha=${date}${filter !== "all" ? `&estilista=${filter}` : ""}`}
        className="absolute bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-flamingo px-5 py-3.5 font-semibold text-ink shadow-lg hover:bg-ink hover:text-white"
      >
        <Plus size={20} /> Nueva cita
      </Link>

      <BookingSheet booking={openSheetBooking} onClose={closeSheet} />
    </div>
  );
}

function gridLines(px: number) {
  return {
    backgroundImage: "linear-gradient(to bottom, #ececec 1px, transparent 1px)",
    backgroundSize: `100% ${30 * px}px`,
  };
}

function Swatch({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn(cls, "inline-block h-2.5 w-4 rounded-sm")} />
      {label}
    </span>
  );
}

function StylistColumn({
  bookings,
  open,
  height,
  wide,
  clientName,
  inPose,
  onBooking,
  onEmpty,
}: {
  bookings: Booking[];
  open: number;
  height: number;
  wide: boolean;
  clientName: (id: string) => string;
  inPose: Set<string>;
  onBooking: (id: string) => void;
  onEmpty: (minute: number) => void;
}) {
  const lanes = useMemo(() => layoutLanes(bookings.map((b) => ({ id: b.id, start: b.start, end: bookingEnd(b) }))), [bookings]);

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const minute = open + Math.floor((e.clientY - rect.top) / PX / 15) * 15;
    onEmpty(minute);
  };

  return (
    <div
      className={cn("relative cursor-copy border-l border-neutral-200", wide ? COLUMN_SINGLE : COLUMN_MULTI)}
      style={{ height, ...gridLines(PX) }}
      onClick={handleClick}
      title="Toca un hueco para crear una cita"
    >
      {bookings.map((b) => {
        const pos = lanes.get(b.id) ?? { lane: 0, lanes: 1 };
        const width = 100 / pos.lanes;
        return (
          <button
            key={b.id}
            onClick={(e) => {
              e.stopPropagation();
              onBooking(b.id);
            }}
            className={cn(
              "absolute overflow-hidden rounded-md text-left focus:z-10",
              b.status === "completada" && "opacity-60",
              inPose.has(b.id) && "ring-2 ring-flamingo ring-offset-1",
            )}
            style={{
              top: (b.start - open) * PX,
              height: (bookingEnd(b) - b.start) * PX - 1,
              left: `calc(${pos.lane * width}% + 2px)`,
              width: `calc(${width}% - 4px)`,
            }}
            aria-label={`${clientName(b.clientId)}, ${b.serviceName}, ${fmtTime(b.start)}`}
          >
            {timeline(b.segments, b.start).map((s) => {
              const h = s.min * PX;
              const cls = b.isAllergyTest ? "seg-T" : `seg-${s.kind}`;
              return (
                <span
                  key={s.index}
                  className={cn(cls, "absolute inset-x-0 block overflow-hidden px-1.5 text-[11px] leading-tight")}
                  style={{ top: (s.start - b.start) * PX, height: h }}
                >
                  {s.index === 0 ? (
                    <>
                      <span className="block truncate pt-0.5 font-semibold">{clientName(b.clientId)}</span>
                      {h > 30 && (
                        <span className="block truncate opacity-80">
                          {fmtTime(b.start)} {b.serviceName}
                        </span>
                      )}
                    </>
                  ) : (
                    h >= 16 && (
                      <span className="block truncate pt-0.5">
                        {s.label}
                        {s.kind === "P" && h > 30 && <span className="block opacity-70">libre {s.min}′</span>}
                      </span>
                    )
                  )}
                </span>
              );
            })}
          </button>
        );
      })}
    </div>
  );
}
