import type { Service, Stylist, WeeklySchedule } from "./types";

export const SALON = {
  name: "Corto y Cambio",
  tagline: "Peluquería en Malasaña",
  /** Dirección de ejemplo; editable en Ajustes y usada en el archivo de calendario. */
  defaultAddress: "Calle del Espíritu Santo 23, 28004 Madrid",
  washbasins: 2,
  cabins: 5,
  /** La prueba de alergia debe hacerse como mínimo 48 h antes del color */
  allergyLeadHours: 48,
};

export const ALLERGY_TEST_ID = "prueba-alergia";

export const SERVICES: Service[] = [
  {
    id: "corte-mujer",
    name: "Corte mujer",
    price: 38,
    segments: [{ kind: "A", min: 45, label: "Corte" }],
    description: "Diagnóstico, lavado rápido y corte a tijera o navaja.",
    isColor: false,
    public: true,
  },
  {
    id: "corte-brushing",
    name: "Corte y brushing",
    price: 48,
    segments: [{ kind: "A", min: 60, label: "Corte y brushing" }],
    description: "Corte con secado a cepillo para salir lista.",
    isColor: false,
    public: true,
  },
  {
    id: "color-raiz",
    name: "Color raíz",
    price: 55,
    segments: [
      { kind: "A", min: 20, label: "Aplicación" },
      { kind: "P", min: 35, label: "Pose" },
      { kind: "L", min: 15, label: "Lavado" },
      { kind: "A", min: 25, label: "Secado" },
    ],
    description: "Retoque de raíz con tu tono de siempre o uno nuevo.",
    isColor: true,
    public: true,
  },
  {
    id: "balayage",
    name: "Balayage",
    price: 120,
    segments: [
      { kind: "A", min: 45, label: "Aplicación" },
      { kind: "P", min: 50, label: "Pose" },
      { kind: "L", min: 15, label: "Lavado" },
      { kind: "A", min: 40, label: "Secado" },
    ],
    description: "Aclarado a mano alzada, degradado y con matiz incluido.",
    isColor: true,
    public: true,
  },
  {
    id: "mechas",
    name: "Mechas",
    price: 95,
    segments: [
      { kind: "A", min: 60, label: "Aplicación" },
      { kind: "P", min: 40, label: "Pose" },
      { kind: "L", min: 15, label: "Lavado" },
      { kind: "A", min: 35, label: "Secado" },
    ],
    description: "Mechas con papel para luz definida, finas o marcadas.",
    isColor: true,
    public: true,
  },
  {
    id: "keratina",
    name: "Alisado de keratina",
    price: 150,
    segments: [
      { kind: "A", min: 30, label: "Aplicación" },
      { kind: "P", min: 30, label: "Pose" },
      { kind: "L", min: 15, label: "Lavado" },
      { kind: "A", min: 60, label: "Secado y plancha" },
    ],
    description: "Elimina el encrespado y deja el pelo liso hasta tres meses.",
    isColor: false,
    public: true,
  },
  {
    id: "peinado",
    name: "Peinado",
    price: 30,
    segments: [{ kind: "A", min: 30, label: "Peinado" }],
    description: "Ondas, recogido o liso pulido para un plan especial.",
    isColor: false,
    public: true,
  },
  {
    id: "corte-hombre",
    name: "Corte hombre",
    price: 22,
    segments: [{ kind: "A", min: 30, label: "Corte" }],
    description: "Corte a máquina y tijera con acabado en nuca y patillas.",
    isColor: false,
    public: true,
  },
  {
    id: ALLERGY_TEST_ID,
    name: "Prueba de alergia",
    price: 0,
    segments: [{ kind: "A", min: 10, label: "Prueba en piel" }],
    description: "Toque de tinte detrás de la oreja. Obligatoria 48 h antes del primer color.",
    isColor: false,
    isAllergyTest: true,
    public: false,
  },
];

const tueToSat: WeeklySchedule = {
  0: null,
  1: null,
  2: { open: 600, close: 1200 },
  3: { open: 600, close: 1200 },
  4: { open: 600, close: 1200 },
  5: { open: 600, close: 1200 },
  6: { open: 570, close: 900 },
};

export const STYLISTS: Stylist[] = [
  { id: "lucia", name: "Lucía", role: "Colorista senior", schedule: tueToSat },
  { id: "irene", name: "Irene", role: "Estilista", schedule: tueToSat },
  { id: "marco", name: "Marco", role: "Estilista y barbero", schedule: tueToSat },
  { id: "sara", name: "Sara", role: "Colorista", schedule: tueToSat },
];

export function getService(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

export function getStylist(id: string): Stylist | undefined {
  return STYLISTS.find((s) => s.id === id);
}

export const PUBLIC_SERVICES = SERVICES.filter((s) => s.public);

/** Horario de apertura del salón un día dado (unión de los horarios del equipo). */
export function salonHours(weekdayIndex: number): { open: number; close: number } | null {
  let open = Infinity;
  let close = -Infinity;
  for (const st of STYLISTS) {
    const h = st.schedule[weekdayIndex];
    if (!h) continue;
    open = Math.min(open, h.open);
    close = Math.max(close, h.close);
  }
  return open === Infinity ? null : { open, close };
}
