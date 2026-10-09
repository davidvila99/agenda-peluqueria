import { stylistMinutes, totalMinutes } from "@/lib/scheduling";
import { fmtDuration } from "@/lib/time";
import type { Segment } from "@/lib/types";
import { cn } from "./ui";

const KIND_TEXT = { A: "Activo", P: "Pose", L: "Lavado" } as const;

/** Barra proporcional con los tramos de un servicio. */
export function SegmentBar({
  segments,
  variant = "admin",
  showLabels = false,
  className,
}: {
  segments: Segment[];
  variant?: "admin" | "public";
  showLabels?: boolean;
  className?: string;
}) {
  const total = totalMinutes(segments);
  const prefix = variant === "public" ? "pub" : "seg";
  return (
    <div className={cn("flex w-full gap-0.5 overflow-hidden rounded-md", showLabels ? "h-9" : "h-2.5", className)}>
      {segments.map((s, i) => (
        <div
          key={i}
          className={cn(`${prefix}-${s.kind}`, "flex min-w-0 items-center justify-center overflow-hidden text-[11px] font-medium leading-tight")}
          style={{ width: `${(s.min / total) * 100}%` }}
          title={`${s.label} · ${s.min} min`}
        >
          {showLabels && s.min / total > 0.14 && (
            <span className="truncate px-1">
              {s.label} {s.min}′
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function SegmentLegend({ variant = "admin", className }: { variant?: "admin" | "public"; className?: string }) {
  const prefix = variant === "public" ? "pub" : "seg";
  const labels =
    variant === "public"
      ? { A: "Contigo", P: "Pose: el color actúa", L: "Lavado" }
      : { A: "Activo (ocupa estilista)", P: "Pose (estilista libre)", L: "Lavado (estilista + lavacabezas)" };
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs", className)}>
      {(["A", "P", "L"] as const).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className={cn(`${prefix}-${k}`, "inline-block h-3 w-5 rounded-sm")} />
          {labels[k]}
        </span>
      ))}
    </div>
  );
}

export function durationSummary(segments: Segment[]): string {
  const total = totalMinutes(segments);
  const busy = stylistMinutes(segments);
  return busy === total ? fmtDuration(total) : `${fmtDuration(total)} · ${fmtDuration(total - busy)} de pose`;
}

export { KIND_TEXT };
